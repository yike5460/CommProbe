"""
AWS Lambda handler for X (Twitter) Legal Communities Crawler
Collects tweets, threads, and replies related to legal tech and PI law
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import boto3
import tweepy
from botocore.exceptions import ClientError

# Initialize AWS clients
s3 = boto3.client('s3')


class LambdaTwitterCrawler:
    """
    Lambda-adapted Twitter Legal Communities Crawler
    Uses Twitter API v2 for data collection
    """

    # X API v2 rate limits (Updated for 2025 tier structure)
    # Reference: https://docs.x.com/x-api/fundamentals/rate-limits

    # Free tier (100 posts/month)
    FREE_TIER_MAX_REQUESTS_PER_15MIN = 1  # Extremely limited!
    FREE_TIER_MONTHLY_CAP = 100

    # Basic tier ($200/month - RECOMMENDED)
    BASIC_TIER_MAX_REQUESTS_PER_15MIN = 15  # Conservative estimate
    BASIC_TIER_MONTHLY_CAP = 15000
    BASIC_TIER_MAX_TWEETS_PER_REQUEST = 100

    # Pro tier ($5,000/month)
    PRO_TIER_MAX_REQUESTS_PER_15MIN = 300
    PRO_TIER_MONTHLY_CAP = 1000000

    # Crawling configuration
    MIN_ENGAGEMENT = 5  # Minimum likes + retweets
    LOOKBACK_DAYS = 7
    MAX_TWEET_AGE_HOURS = 168  # 7 days (search_recent_tweets limit)
    MAX_TWEETS_PER_QUERY = 100  # Max per API call

    def __init__(
        self,
        bearer_token: str,
        s3_bucket: str,
        api_tier: str = 'basic',  # 'free', 'basic', or 'pro'
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        lambda_timeout_buffer: int = 120,  # Stop 2 minutes before Lambda timeout
    ):
        """
        Initialize Lambda X/Twitter crawler with Tweepy client

        Args:
            bearer_token: X API v2 Bearer Token (app-only access)
            s3_bucket: S3 bucket name for data storage
            api_tier: API tier ('free', 'basic', 'pro') for rate limiting
            api_key: Optional API key (for OAuth 1.0a if needed)
            api_secret: Optional API secret (for OAuth 1.0a if needed)
            lambda_timeout_buffer: Seconds before Lambda timeout to stop collection (default: 120s)

        Note: OAuth 2.0 Bearer Token is RECOMMENDED for read-only access.
        """
        if not bearer_token or bearer_token == 'DISABLED':
            raise ValueError("Missing required X API Bearer Token or Twitter disabled")

        # Initialize Tweepy client with Bearer Token (simplest auth method)
        # IMPORTANT: wait_on_rate_limit=False to prevent Lambda timeout
        # We'll handle rate limiting manually and return gracefully
        self.client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=False  # Manual rate limit handling to prevent Lambda timeout
        )

        # Set rate limits based on tier
        self.api_tier = api_tier
        if api_tier == 'free':
            self.max_requests_per_15min = self.FREE_TIER_MAX_REQUESTS_PER_15MIN
            self.monthly_cap = self.FREE_TIER_MONTHLY_CAP
            self.max_tweets_per_request = 10  # Very small for Free tier
        elif api_tier == 'basic':
            self.max_requests_per_15min = self.BASIC_TIER_MAX_REQUESTS_PER_15MIN
            self.monthly_cap = self.BASIC_TIER_MONTHLY_CAP
            self.max_tweets_per_request = self.BASIC_TIER_MAX_TWEETS_PER_REQUEST
        elif api_tier == 'pro':
            self.max_requests_per_15min = self.PRO_TIER_MAX_REQUESTS_PER_15MIN
            self.monthly_cap = self.PRO_TIER_MONTHLY_CAP
            self.max_tweets_per_request = 100

        self.s3_bucket = s3_bucket
        self.request_count = 0
        self.collected_tweets = []
        self.lambda_timeout_buffer = lambda_timeout_buffer
        self.start_time = None  # Will be set when collection starts
        self.rate_limit_hit = False

        # PI Law focused search queries
        self.search_queries = [
            "legaltech OR (legal tech) OR #legaltech",
            "(personal injury attorney) OR (PI attorney) OR #PIlaw",
            "Supio OR EvenUp OR Eve medical records",
            "(medical records processing) (law OR legal)",
            "(demand letter automation) (attorney OR lawyer)",
        ]

        # Keywords for relevance filtering
        self.keywords = [
            "Supio", "EvenUp", "Eve",
            "medical records", "demand letter", "medical chronology",
            "personal injury", "PI attorney", "settlement demand",
            "legaltech", "legal AI", "case management",
        ]

    def _should_stop_collection(self, lambda_timeout_seconds: int = 900) -> bool:
        """
        Check if we should stop collection due to approaching Lambda timeout

        Args:
            lambda_timeout_seconds: Lambda timeout in seconds (default: 900 = 15 minutes)

        Returns:
            True if we should stop collection, False otherwise
        """
        if not self.start_time:
            return False

        elapsed = (datetime.now(timezone.utc) - self.start_time).total_seconds()
        time_remaining = lambda_timeout_seconds - elapsed

        # Stop if we have less time remaining than the buffer
        if time_remaining < self.lambda_timeout_buffer:
            print(f"⏰ Approaching Lambda timeout - stopping collection")
            print(f"   Elapsed: {elapsed:.1f}s, Remaining: {time_remaining:.1f}s, Buffer: {self.lambda_timeout_buffer}s")
            return True

        return False

    def collect_tweets(
        self,
        lookback_days: int = 7,
        min_engagement: int = 5,
        max_tweets_per_query: Optional[int] = None,
        lambda_timeout_seconds: int = 900,  # 15 minutes default
    ) -> Dict:
        """
        Main collection method - searches for relevant tweets

        Args:
            lookback_days: Number of days to look back
            min_engagement: Minimum likes + retweets
            max_tweets_per_query: Override default max tweets per query
            lambda_timeout_seconds: Lambda timeout in seconds (default: 900 = 15 min)

        Returns:
            Collection summary with S3 location
        """
        self.start_time = datetime.now(timezone.utc)
        print(f"Starting Twitter collection at {self.start_time.isoformat()}")
        print(f"Lookback: {lookback_days} days | API Tier: {self.api_tier}")
        print(f"Lambda timeout: {lambda_timeout_seconds}s | Buffer: {self.lambda_timeout_buffer}s")

        start_time = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        max_results = max_tweets_per_query or self.max_tweets_per_request
        queries_processed = 0

        for query in self.search_queries:
            # Check if we should stop due to approaching timeout
            if self._should_stop_collection(lambda_timeout_seconds):
                print(f"⚠️  Stopping early - processed {queries_processed}/{len(self.search_queries)} queries")
                break

            # Retry logic for rate limits
            max_retries = 1  # Retry once if we have time
            retry_count = 0
            query_success = False

            while retry_count <= max_retries and not query_success:
                try:
                    if retry_count == 0:
                        print(f"Searching for: {query}")
                    else:
                        print(f"Retry attempt {retry_count} for: {query}")

                    tweets = self._search_recent_tweets(
                        query=query,
                        start_time=start_time,
                        max_results=max_results,
                    )

                    relevant_count = 0
                    for tweet in tweets:
                        if self._is_relevant(tweet, min_engagement):
                            tweet_data = self._extract_tweet_data(tweet)
                            self.collected_tweets.append(tweet_data)
                            relevant_count += 1

                    print(f"Collected {len(tweets)} tweets ({relevant_count} relevant) for query: {query}")
                    queries_processed += 1
                    query_success = True

                    # Rate limit pause between queries (unless we hit rate limit)
                    if not self.rate_limit_hit:
                        time.sleep(2)

                except tweepy.errors.TooManyRequests as e:
                    print(f"⚠️  Rate limit exceeded for query '{query}' (attempt {retry_count + 1}/{max_retries + 1})")
                    self.rate_limit_hit = True

                    # If this was our last retry, stop
                    if retry_count >= max_retries:
                        print(f"   Max retries reached, stopping collection")
                        break

                    # Check if we have time to wait for rate limit reset
                    if self._should_stop_collection(lambda_timeout_seconds):
                        print(f"   Not enough time to wait for rate limit reset")
                        print(f"   Stopping collection and returning collected data")
                        break

                    # Try to get rate limit reset time from Twitter API v2 response headers
                    # Reference: https://developer.twitter.com/en/docs/twitter-api/rate-limits
                    rate_limit_reset_seconds = 900  # Default: 15 minutes (Twitter's standard window)

                    try:
                        # Debug: Check what we have in the exception
                        print(f"   Debug - Exception type: {type(e)}")
                        print(f"   Debug - Has response: {hasattr(e, 'response')}")

                        # Tweepy v4 stores the response in e.response
                        # Twitter API v2 returns x-rate-limit-reset as Unix timestamp
                        if hasattr(e, 'response') and e.response is not None:
                            print(f"   Debug - Response type: {type(e.response)}")
                            print(f"   Debug - Response has headers: {hasattr(e.response, 'headers')}")

                            # Try to get headers from response
                            headers = None
                            if hasattr(e.response, 'headers'):
                                headers = e.response.headers
                                print(f"   Debug - Headers type: {type(headers)}")
                                # Print available headers for debugging
                                if hasattr(headers, 'keys'):
                                    header_keys = list(headers.keys())
                                    print(f"   Debug - Available headers: {header_keys}")

                            if headers:
                                # Get the reset timestamp (Unix epoch seconds)
                                # Try both lowercase and capitalized versions
                                reset_timestamp = headers.get('x-rate-limit-reset') or headers.get('X-Rate-Limit-Reset')

                                if reset_timestamp:
                                    print(f"   Found rate limit reset timestamp: {reset_timestamp}")
                                    reset_time = datetime.fromtimestamp(int(reset_timestamp), tz=timezone.utc)
                                    wait_seconds = (reset_time - datetime.now(timezone.utc)).total_seconds()

                                    if wait_seconds > 0 and wait_seconds < 1800:  # Sanity check: between 0 and 30 minutes
                                        rate_limit_reset_seconds = wait_seconds
                                        print(f"   Calculated wait time: {wait_seconds:.0f}s until {reset_time.isoformat()}")
                                    else:
                                        print(f"   Wait time {wait_seconds:.0f}s seems incorrect, using default")
                                else:
                                    print(f"   No x-rate-limit-reset header found in response")
                            else:
                                print(f"   Could not access headers from response")
                        else:
                            print(f"   No response object available in exception")

                    except Exception as parse_error:
                        print(f"   Could not parse rate limit reset time: {parse_error}")
                        import traceback
                        traceback.print_exc()
                        print(f"   Using default: {rate_limit_reset_seconds}s (15 minutes)")

                    # Calculate if we have enough time to wait
                    elapsed = (datetime.now(timezone.utc) - self.start_time).total_seconds()
                    time_remaining = lambda_timeout_seconds - elapsed - self.lambda_timeout_buffer

                    if rate_limit_reset_seconds < time_remaining:
                        print(f"   Rate limit resets in {rate_limit_reset_seconds:.0f}s ({rate_limit_reset_seconds/60:.1f} minutes)")
                        print(f"   Time remaining: {time_remaining:.0f}s ({time_remaining/60:.1f} minutes) - waiting for reset...")
                        time.sleep(rate_limit_reset_seconds + 5)  # Add 5s buffer after reset
                        print(f"   Retrying query after rate limit reset")
                        retry_count += 1
                    else:
                        print(f"   Not enough time to wait {rate_limit_reset_seconds:.0f}s ({rate_limit_reset_seconds/60:.1f} min)")
                        print(f"   Only {time_remaining:.0f}s ({time_remaining/60:.1f} min) remaining")
                        print(f"   Stopping collection and returning collected data")
                        break

                except tweepy.errors.TweepyException as e:
                    print(f"Error searching '{query}': {e}")
                    break  # Don't retry on other errors

            # If we stopped due to rate limit without success, break outer loop
            if not query_success and self.rate_limit_hit:
                print(f"Stopping collection - unable to complete query '{query}'")
                break

        # Calculate execution time
        execution_time = (datetime.now(timezone.utc) - self.start_time).total_seconds()
        print(f"\nCollection completed in {execution_time:.1f}s")
        print(f"Queries processed: {queries_processed}/{len(self.search_queries)}")

        # Save to S3
        s3_key = self._save_to_s3()

        return {
            'statusCode': 200,
            'tweets_collected': len(self.collected_tweets),
            's3_location': f"s3://{self.s3_bucket}/{s3_key}" if s3_key else None,
            'platform': 'twitter',
            'api_requests_made': self.request_count,
            'api_tier': self.api_tier,
            'queries_processed': queries_processed,
            'queries_total': len(self.search_queries),
            'execution_time_seconds': execution_time,
            'stopped_early': queries_processed < len(self.search_queries),
            'rate_limit_hit': self.rate_limit_hit,
        }

    def _search_recent_tweets(
        self,
        query: str,
        start_time: datetime,
        max_results: int = 100,
    ) -> List:
        """
        Search recent tweets with expansions using X API v2

        Reference: Tweepy docs - GET /2/tweets/search/recent
        https://github.com/tweepy/tweepy/blob/master/docs/client.rst

        Note: search_recent_tweets searches last 7 days only (X API v2 limitation)
        For full archive search, use search_all_tweets (requires Academic Research access)
        """
        try:
            # Call Tweepy Client.search_recent_tweets
            # Reference: GET /2/tweets/search/recent endpoint
            response = self.client.search_recent_tweets(
                query=query,
                start_time=start_time,
                max_results=min(max_results, 100),  # API max is 100
                tweet_fields=[
                    'created_at',       # When tweet was posted
                    'public_metrics',   # Likes, retweets, replies, quotes
                    'author_id',        # Author ID for user lookup
                    'conversation_id',  # Thread ID
                    'in_reply_to_user_id',  # Reply context
                    'lang',             # Language code
                    'entities',         # Hashtags, mentions, URLs
                ],
                user_fields=['username', 'name', 'verified', 'description', 'public_metrics'],
                expansions=['author_id', 'referenced_tweets.id'],
            )

            if not response.data:
                print(f"No tweets found for query: {query}")
                return []

            # Build user lookup from includes
            # Reference: Tweepy FAQ - Accessing includes data
            users = {}
            if hasattr(response, 'includes') and response.includes:
                if 'users' in response.includes:
                    users = {user.id: user for user in response.includes['users']}

            # Enrich tweets with user data
            enriched_tweets = []
            for tweet in response.data:
                tweet.user = users.get(tweet.author_id)
                enriched_tweets.append(tweet)

            self.request_count += 1

            # Rate limit info from response metadata
            if hasattr(response, 'meta'):
                remaining = response.meta.get('x-rate-limit-remaining', 'unknown')
                print(f"  Rate limit remaining: {remaining}")

            return enriched_tweets

        except tweepy.errors.TooManyRequests as e:
            # Handle 429 - Rate limit exceeded
            # Tweepy will automatically wait (wait_on_rate_limit=True)
            print(f"Rate limit exceeded for query: {query}")
            raise

        except tweepy.errors.Unauthorized as e:
            # Handle 401 - Invalid credentials
            print(f"Authentication failed: {e}")
            raise

        except tweepy.errors.TweepyException as e:
            # Handle other Tweepy errors
            print(f"Tweepy error for query '{query}': {e}")
            raise

    def _is_relevant(self, tweet, min_engagement: int) -> bool:
        """Check if tweet is relevant to PI law / legal tech"""
        # Check engagement threshold
        metrics = tweet.public_metrics
        total_engagement = metrics.get('like_count', 0) + metrics.get('retweet_count', 0)
        if total_engagement < min_engagement:
            return False

        # Check keyword relevance
        text = tweet.text.lower()
        return any(keyword.lower() in text for keyword in self.keywords)

    def _extract_tweet_data(self, tweet) -> Dict:
        """Extract structured data from tweet object"""
        metrics = tweet.public_metrics
        user = tweet.user

        return {
            'id': str(tweet.id),
            'tweet_id': str(tweet.id),
            'text': tweet.text,
            'url': f"https://twitter.com/user/status/{tweet.id}",
            'created_at': tweet.created_at.isoformat() if tweet.created_at else None,
            'author': {
                'id': str(tweet.author_id),
                'username': user.username if user else 'unknown',
                'name': user.name if user else 'unknown',
                'verified': user.verified if user and hasattr(user, 'verified') else False,
            },
            'metrics': {
                'likes': metrics.get('like_count', 0),
                'retweets': metrics.get('retweet_count', 0),
                'replies': metrics.get('reply_count', 0),
                'quotes': metrics.get('quote_count', 0),
            },
            'engagement_score': metrics.get('like_count', 0) + metrics.get('retweet_count', 0),
            'conversation_id': str(tweet.conversation_id),
            'lang': tweet.lang if hasattr(tweet, 'lang') else 'unknown',
            'collected_at': datetime.now(timezone.utc).isoformat(),
        }

    def _save_to_s3(self) -> Optional[str]:
        """Save collected tweets to S3"""
        if not self.collected_tweets:
            print("No tweets to save")
            return None

        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        s3_key = f"twitter/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}/tweets_{timestamp}.json"

        data = {
            'platform': 'twitter',
            'collected_at': datetime.now(timezone.utc).isoformat(),
            'total_tweets': len(self.collected_tweets),
            'api_tier': self.api_tier,
            'tweets': self.collected_tweets,
        }

        try:
            s3.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=json.dumps(data, indent=2),
                ContentType='application/json',
            )

            print(f"Saved {len(self.collected_tweets)} tweets to s3://{self.s3_bucket}/{s3_key}")
            return s3_key
        except Exception as e:
            print(f"Error saving to S3: {e}")
            return None


def handler(event, context):
    """
    Lambda handler for Twitter collection

    Event format:
    {
        "lookback_days": 7,
        "min_engagement": 5,
        "manual_trigger": false,
        "api_tier": "basic"
    }
    """
    try:
        print("="*60)
        print("Twitter/X Collector Lambda")
        print("="*60)
        print(f"Event: {json.dumps(event, indent=2)}")

        # Get credentials from environment
        bearer_token = os.environ.get('TWITTER_BEARER_TOKEN')
        api_key = os.environ.get('TWITTER_API_KEY')
        api_secret = os.environ.get('TWITTER_API_SECRET')
        bucket_name = os.environ.get('BUCKET_NAME')

        # Check if Twitter is disabled
        if not bearer_token or bearer_token == 'DISABLED':
            print("Twitter collection is disabled (no credentials provided)")
            return {
                'statusCode': 200,
                'body': {
                    'message': 'Twitter collection is disabled (no credentials provided)',
                    'tweets_collected': 0,
                    'platform': 'twitter',
                }
            }

        # Parse event parameters
        lookback_days = event.get('lookback_days', 7)
        min_engagement = event.get('min_engagement', 5)
        api_tier = event.get('api_tier', 'basic')  # default to basic tier
        max_tweets_per_query = event.get('max_tweets_per_query')

        # Calculate Lambda timeout from context
        # Lambda context provides get_remaining_time_in_millis()
        lambda_timeout_ms = context.get_remaining_time_in_millis() if hasattr(context, 'get_remaining_time_in_millis') else 900000
        lambda_timeout_seconds = lambda_timeout_ms // 1000

        print(f"Configuration:")
        print(f"  - Lookback days: {lookback_days}")
        print(f"  - Min engagement: {min_engagement}")
        print(f"  - API tier: {api_tier}")
        print(f"  - Lambda timeout: {lambda_timeout_seconds}s ({lambda_timeout_seconds/60:.1f} minutes)")

        # Initialize crawler
        crawler = LambdaTwitterCrawler(
            bearer_token=bearer_token,
            api_key=api_key,
            api_secret=api_secret,
            s3_bucket=bucket_name,
            api_tier=api_tier,
        )

        # Collect tweets with timeout awareness
        result = crawler.collect_tweets(
            lookback_days=lookback_days,
            min_engagement=min_engagement,
            max_tweets_per_query=max_tweets_per_query,
            lambda_timeout_seconds=lambda_timeout_seconds,
        )

        # Analyze competitor mentions
        competitor_counts = {}
        for tweet in crawler.collected_tweets:
            text = tweet['text'].lower()
            for competitor in ["Supio", "EvenUp", "Eve"]:
                if competitor.lower() in text:
                    competitor_counts[competitor] = competitor_counts.get(competitor, 0) + 1

        print("\nTop mentioned competitors:")
        for competitor, count in sorted(competitor_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {competitor}: {count} mentions")

        # Log early termination warnings
        if result.get('stopped_early'):
            print(f"\n⚠️  Collection stopped early:")
            print(f"   - Queries processed: {result['queries_processed']}/{result['queries_total']}")
            if result.get('rate_limit_hit'):
                print(f"   - Reason: Rate limit exceeded")
            else:
                print(f"   - Reason: Approaching Lambda timeout")

        # Return result with body structure matching Reddit collector
        return {
            'statusCode': result['statusCode'],
            'body': {
                'tweets_collected': result['tweets_collected'],
                'platform': 'twitter',
                's3_location': result['s3_location'],
                'api_requests_made': result['api_requests_made'],
                'api_tier': result['api_tier'],
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'competitor_mentions': competitor_counts,
                'execution_summary': {
                    'queries_processed': result.get('queries_processed', len(crawler.search_queries)),
                    'queries_total': result.get('queries_total', len(crawler.search_queries)),
                    'keywords_searched': len(crawler.keywords),
                    'lookback_days': lookback_days,
                    'min_engagement': min_engagement,
                    'execution_time_seconds': result.get('execution_time_seconds'),
                    'stopped_early': result.get('stopped_early', False),
                    'rate_limit_hit': result.get('rate_limit_hit', False),
                }
            }
        }

    except Exception as e:
        print(f"Error in Twitter collection: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'body': {
                'error': str(e),
                'platform': 'twitter',
                'tweets_collected': 0,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        }
