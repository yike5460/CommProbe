"""
Twitter/X API Crawler Prototype
Tests basic Twitter API v2 integration for legal tech insights collection

$ python prototype/twitter_crawler_prototype.py 
Initializing Twitter API client...

============================================================
🚀 Starting Twitter API Prototype Crawl
============================================================

=== Testing Authentication ===
   Testing Bearer Token with simple search...
Rate limit exceeded. Sleeping for 834 seconds.
✅ Authentication successful!
   Bearer Token is valid (app-only access)
   Test search returned 10 results

--- Query 1/1 ---

📊 Searching for: 'legaltech OR #legaltech'
   Max results: 10, Days back: 3
Rate limit exceeded. Sleeping for 901 seconds.
   ✅ Found 10 tweets
   📊 Rate limit remaining: unknown
   ✅ Relevant: @CPiaeq: RT @legalsifter_AI: “Crypto has no laws.”

That’s what peopl...
   ✅ Relevant: @CPiaeq: RT @legalsifter_AI: Tornado Cash changed Web3 forever.

For ...
   ✅ Relevant: @CPiaeq: RT @legalsifter_AI: Everyone audits smart contracts.

Almost...

============================================================
📊 Crawl Summary
============================================================
✅ Total tweets collected: 10
✅ Relevant tweets (filtered): 3
✅ Unique authors: 3
💾 Results saved to: twitter_prototype_results_20251027_133847.json
============================================================

📝 Sample Relevant Tweets:

1. @CPiaeq (0 likes)
   RT @legalsifter_AI: “Crypto has no laws.”

That’s what people said in 2015.

In 2025, AI + LegalTech...
   https://twitter.com/user/status/1982803899170861416

2. @CPiaeq (0 likes)
   RT @legalsifter_AI: Tornado Cash changed Web3 forever.

For the first time, law touched code directl...
   https://twitter.com/user/status/1982803076978237836

3. @CPiaeq (0 likes)
   RT @legalsifter_AI: Everyone audits smart contracts.

Almost no one audits obligations.

LegalSifter...
   https://twitter.com/user/status/1982803022171226620

✅ Prototype test completed successfully!

💡 Next steps:
   1. Review the results JSON file
   2. Adjust search queries if needed
   3. Proceed with CDK infrastructure implementation
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

try:
    import tweepy
except ImportError:
    print("ERROR: tweepy not installed. Installing...")
    import subprocess
    subprocess.check_call(["pip", "install", "tweepy==4.14.0"])
    import tweepy


class TwitterCrawlerPrototype:
    """
    Prototype Twitter crawler for legal tech insights
    Tests API access, search functionality, and data collection
    """

    def __init__(self, bearer_token: str):
        """
        Initialize Twitter API client with Bearer Token

        Args:
            bearer_token: X API v2 Bearer Token for app-only authentication
        """
        if not bearer_token:
            raise ValueError("Bearer token is required")

        print("Initializing Twitter API client...")
        self.client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=True  # Automatic rate limit handling
        )

        # PI Law focused search queries (REDUCED for Free tier testing)
        # Full list will be used in production with Basic tier
        self.search_queries = [
            "legaltech OR #legaltech",  # Simplified for testing
            # Commented out for Free tier rate limit testing
            # "(personal injury attorney) OR (PI attorney) OR #PIlaw",
            # "Supio OR EvenUp OR Eve medical records",
            # "(medical records processing) (law OR legal)",
            # "(demand letter automation) (attorney OR lawyer)",
        ]

        # Keywords for relevance filtering
        self.keywords = [
            "Supio", "EvenUp", "Eve",
            "medical records", "demand letter", "medical chronology",
            "personal injury", "PI attorney", "settlement demand",
            "legaltech", "legal AI", "case management",
        ]

        self.collected_tweets = []

    def test_authentication(self) -> bool:
        """
        Test API authentication by performing a simple search

        Returns:
            True if authentication successful, False otherwise
        """
        try:
            print("\n=== Testing Authentication ===")
            print("   Testing Bearer Token with simple search...")

            # For Bearer Token (app-only auth), we test by doing a simple search
            # get_me() requires user context auth, not Bearer Token
            response = self.client.search_recent_tweets(
                query="test",
                max_results=10,
                tweet_fields=['created_at']
            )

            print(f"✅ Authentication successful!")
            print(f"   Bearer Token is valid (app-only access)")
            print(f"   Test search returned {len(response.data) if response.data else 0} results")
            return True

        except tweepy.errors.Unauthorized as e:
            print(f"❌ Authentication failed: {e}")
            print("   Check that your Bearer Token is correct")
            return False
        except tweepy.errors.Forbidden as e:
            print(f"❌ Access forbidden: {e}")
            print("   Your API tier may not have access to this endpoint")
            return False
        except Exception as e:
            print(f"❌ Error testing authentication: {e}")
            return False

    def search_tweets(
        self,
        query: str,
        max_results: int = 10,
        days_back: int = 7
    ) -> List[Dict]:
        """
        Search for tweets matching query

        Args:
            query: Search query string
            max_results: Maximum tweets to return (max 100 per request)
            days_back: Number of days to look back

        Returns:
            List of tweet data dictionaries
        """
        try:
            print(f"\n📊 Searching for: '{query}'")
            print(f"   Max results: {max_results}, Days back: {days_back}")

            start_time = datetime.now(timezone.utc) - timedelta(days=days_back)

            # Call Twitter API v2 search endpoint
            response = self.client.search_recent_tweets(
                query=query,
                start_time=start_time,
                max_results=min(max_results, 100),  # API max is 100
                tweet_fields=[
                    'created_at',
                    'public_metrics',
                    'author_id',
                    'conversation_id',
                    'in_reply_to_user_id',
                    'lang',
                    'entities',
                ],
                user_fields=['username', 'name', 'verified', 'description', 'public_metrics'],
                expansions=['author_id', 'referenced_tweets.id'],
            )

            if not response.data:
                print(f"   ℹ️  No tweets found for this query")
                return []

            # Build user lookup dictionary
            users = {}
            if hasattr(response, 'includes') and response.includes:
                if 'users' in response.includes:
                    users = {user.id: user for user in response.includes['users']}

            # Extract and format tweets
            tweets = []
            for tweet in response.data:
                user = users.get(tweet.author_id)

                tweet_data = {
                    'id': str(tweet.id),
                    'text': tweet.text,
                    'url': f"https://twitter.com/user/status/{tweet.id}",
                    'created_at': tweet.created_at.isoformat() if tweet.created_at else None,
                    'author': {
                        'id': str(tweet.author_id),
                        'username': user.username if user else 'unknown',
                        'name': user.name if user else 'unknown',
                        'verified': user.verified if user else False,
                    },
                    'metrics': {
                        'likes': tweet.public_metrics.get('like_count', 0),
                        'retweets': tweet.public_metrics.get('retweet_count', 0),
                        'replies': tweet.public_metrics.get('reply_count', 0),
                        'quotes': tweet.public_metrics.get('quote_count', 0),
                    },
                    'engagement_score': (
                        tweet.public_metrics.get('like_count', 0) +
                        tweet.public_metrics.get('retweet_count', 0)
                    ),
                    'conversation_id': str(tweet.conversation_id),
                    'lang': tweet.lang,
                }

                tweets.append(tweet_data)

            print(f"   ✅ Found {len(tweets)} tweets")

            # Show rate limit info
            if hasattr(response, 'meta') and response.meta:
                remaining = response.meta.get('x-rate-limit-remaining', 'unknown')
                print(f"   📊 Rate limit remaining: {remaining}")

            return tweets

        except tweepy.errors.TooManyRequests as e:
            print(f"   ⚠️  Rate limit exceeded. Tweepy will auto-wait.")
            raise
        except tweepy.errors.Unauthorized as e:
            print(f"   ❌ Authentication error: {e}")
            raise
        except tweepy.errors.TweepyException as e:
            print(f"   ❌ API error: {e}")
            raise
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
            raise

    def is_relevant(self, tweet: Dict, min_engagement: int = 5) -> bool:
        """
        Check if tweet is relevant to legal tech / PI law

        Args:
            tweet: Tweet data dictionary
            min_engagement: Minimum likes + retweets threshold

        Returns:
            True if relevant, False otherwise
        """
        # Check engagement
        if tweet['engagement_score'] < min_engagement:
            return False

        # Check keyword relevance
        text = tweet['text'].lower()
        return any(keyword.lower() in text for keyword in self.keywords)

    def run_prototype_crawl(
        self,
        max_tweets_per_query: int = 10,
        days_back: int = 7,
        min_engagement: int = 5
    ) -> Dict:
        """
        Run prototype crawl across all search queries

        Args:
            max_tweets_per_query: Max tweets per search query
            days_back: Days to look back
            min_engagement: Minimum engagement threshold

        Returns:
            Summary statistics dictionary
        """
        print("\n" + "="*60)
        print("🚀 Starting Twitter API Prototype Crawl")
        print("="*60)

        # Test authentication first
        if not self.test_authentication():
            print("\n❌ Authentication failed. Please check your bearer token.")
            return {'success': False, 'error': 'Authentication failed'}

        all_tweets = []
        relevant_tweets = []

        # Search each query
        for i, query in enumerate(self.search_queries, 1):
            print(f"\n--- Query {i}/{len(self.search_queries)} ---")
            try:
                tweets = self.search_tweets(
                    query=query,
                    max_results=max_tweets_per_query,
                    days_back=days_back
                )

                all_tweets.extend(tweets)

                # Filter for relevant tweets
                for tweet in tweets:
                    if self.is_relevant(tweet, min_engagement):
                        relevant_tweets.append(tweet)
                        print(f"   ✅ Relevant: @{tweet['author']['username']}: {tweet['text'][:60]}...")

            except Exception as e:
                print(f"   ⚠️  Error with query '{query}': {e}")
                continue

        # Save results
        results = {
            'success': True,
            'collected_at': datetime.now(timezone.utc).isoformat(),
            'config': {
                'days_back': days_back,
                'min_engagement': min_engagement,
                'queries': self.search_queries,
            },
            'stats': {
                'total_tweets': len(all_tweets),
                'relevant_tweets': len(relevant_tweets),
                'unique_authors': len(set(t['author']['username'] for t in all_tweets)),
            },
            'tweets': relevant_tweets,
        }

        # Save to file
        output_file = f"twitter_prototype_results_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        # Print summary
        print("\n" + "="*60)
        print("📊 Crawl Summary")
        print("="*60)
        print(f"✅ Total tweets collected: {results['stats']['total_tweets']}")
        print(f"✅ Relevant tweets (filtered): {results['stats']['relevant_tweets']}")
        print(f"✅ Unique authors: {results['stats']['unique_authors']}")
        print(f"💾 Results saved to: {output_file}")
        print("="*60)

        # Show sample tweets
        if relevant_tweets:
            print("\n📝 Sample Relevant Tweets:")
            for i, tweet in enumerate(relevant_tweets[:3], 1):
                print(f"\n{i}. @{tweet['author']['username']} ({tweet['metrics']['likes']} likes)")
                print(f"   {tweet['text'][:100]}...")
                print(f"   {tweet['url']}")

        return results


def main():
    """
    Main entry point for prototype testing
    """
    # Get bearer token from environment or hardcoded for testing
    bearer_token = os.getenv(
        'TWITTER_BEARER_TOKEN',
        'AAAAAAAAAAAAAAAAAAAAADI25AEAAAAAH282Z5Gi4tdw1o12WlKP4vcpWY8%3DHgcIiWpe62ppw1ecCLdsoKFyc4ljvQTXlxEFkM67FBJMz7VsPZ'
    )

    if not bearer_token:
        print("❌ No bearer token provided!")
        print("   Set TWITTER_BEARER_TOKEN environment variable or edit script")
        return

    try:
        # Initialize crawler
        crawler = TwitterCrawlerPrototype(bearer_token)

        # Run prototype crawl
        # Using VERY small limits for Free tier testing (only 100 posts/month!)
        results = crawler.run_prototype_crawl(
            max_tweets_per_query=10,  # Very small batch for Free tier
            days_back=3,  # Shorter lookback to reduce API calls
            min_engagement=1  # Lower threshold for testing
        )

        if results['success']:
            print("\n✅ Prototype test completed successfully!")
            print("\n💡 Next steps:")
            print("   1. Review the results JSON file")
            print("   2. Adjust search queries if needed")
            print("   3. Proceed with CDK infrastructure implementation")
        else:
            print(f"\n❌ Prototype test failed: {results.get('error')}")

    except KeyboardInterrupt:
        print("\n\n⚠️  Crawl interrupted by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
