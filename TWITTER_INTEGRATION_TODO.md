# X (Twitter) Integration - Implementation TODO

## Overview
This document provides step-by-step instructions for implementing X (Twitter) as a new data source alongside Reddit for the Legal Tech Intelligence Platform.

**Last Updated:** 2025-01-20 (Based on latest X API documentation from docs.x.com)
**Estimated Timeline:** 3-4 weeks
**Priority:** Medium-High
**Dependencies:** X API v2 access (Free, Basic, or Pro tier)

**⚠️ IMPORTANT UPDATE - X API Pricing (2025):**
- **Free Tier:** $0/month - 100 posts/month read access ⚠️ (Very limited!)
- **Basic Tier:** $200/month - 15,000 posts/month ✅ **RECOMMENDED**
- **Pro Tier:** $5,000/month - 1,000,000 posts/month (For scale)
- **Enterprise Tier:** Custom pricing - Unlimited access

**Recommendation:** Start with **Basic tier ($200/month)** for reliable, official API access

---

## 🚀 Quick Reference: Deployment Commands

### Current Deployment (Reddit Only):
```bash
cd /Users/kyiamzn/03_code/CommProbe/infra/aws
npx cdk deploy \
  --context redditClientId=iPH6UMuXs_0pFWYBHi8gOg \
  --context redditClientSecret=K6LYsuo4BTkP_ILb2GpE_45dBQ6PqA
```

### Future Deployment (Reddit + Twitter):
```bash
cd /Users/kyiamzn/03_code/CommProbe/infra/aws
npx cdk deploy \
  --context redditClientId=iPH6UMuXs_0pFWYBHi8gOg \
  --context redditClientSecret=K6LYsuo4BTkP_ILb2GpE_45dBQ6PqA \
  --context twitterBearerToken=YOUR_TWITTER_BEARER_TOKEN_HERE
```

**Note:** After obtaining your X API Bearer Token from https://developer.x.com/, replace `YOUR_TWITTER_BEARER_TOKEN_HERE` with the actual token value.

---

## Phase 1: Prerequisites & Setup (Week 1, Days 1-2)

### Task 1.1: X Developer Account Setup (Updated for 2025)
**Owner:** DevOps/Backend Engineer
**Estimated Time:** 2-4 hours (+ approval time)

**⚠️ BREAKING CHANGE - X API Tiers (2025):**
The API tiers have been completely restructured. **Essential/Elevated tiers are DEPRECATED.**

**New Tier Structure:**

| Tier | Cost | Posts/Month | Rate Limit (search_recent_tweets) | Recommended For |
|------|------|-------------|-----------------------------------|-----------------|
| **Free** | $0 | 100 | ~1 req/15min | Testing only ❌ |
| **Basic** | **$200** | **15,000** | ~5-15 req/15min | **MVP ✅** |
| **Pro** | $5,000 | 1M | 75-300 req/15min | Production scale |
| **Enterprise** | Custom | Unlimited | Custom | Large deployments |

**Steps:**
1. Apply for X Developer Account at https://developer.x.com/
2. Choose API tier:
  - **Testing:** Free tier ($0/month) - 100 posts/month (very limited)
  - **Production:** Basic tier ($200/month) - 15,000 posts/month ✅ **RECOMMENDED**
  - **Scale:** Pro tier ($5,000/month) - 1M posts/month
3. Create a new Project: "Legal Tech Intelligence Platform"
4. Create a new App within the project: "Supio Insights Collector"
5. Generate credentials (OAuth 2.0 Bearer Token - Recommended for read-only):
  - **Bearer Token** (for app-only access - simplest) ✅ **RECOMMENDED**
  - OR API Key + API Secret (for OAuth 1.0a - legacy)
  - OR Client ID + Client Secret (for OAuth 2.0 user context - if posting needed)

**Acceptance Criteria:**
- [ ] Developer account approved
- [ ] App created with proper access level
- [ ] All credentials saved securely
- [ ] Rate limits documented

**Documentation:**
```bash
# Store credentials securely (DO NOT commit to git!)

# Method 1: Bearer Token (App-Only Access - RECOMMENDED for read-only)
export TWITTER_BEARER_TOKEN="AAAAAAAAAAAAAAAAAAAAAxxxxxxxxxxxxxxxxxxxxxxxx"

# Method 2: OAuth 1.0a (User Context - if posting/liking needed)
export TWITTER_API_KEY="xxxxxxxxxxxxxxxxxxx"
export TWITTER_API_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWITTER_ACCESS_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWITTER_ACCESS_TOKEN_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxx"

# Method 3: OAuth 2.0 PKCE (Modern user context)
export TWITTER_CLIENT_ID="xxxxxxxxxxxxxxxxxxxx"
export TWITTER_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**⚠️ Cost Advisory:**
- Free tier (100 posts/month) is insufficient for weekly collection (need ~400-500 posts/month)
- **Basic tier ($200/month) is required** for meaningful data collection in production
- Provides 15,000 posts/month capacity (more than sufficient for weekly legal tech monitoring)

---

### Task 1.2: Update CDK Infrastructure
**Owner:** DevOps/Backend Engineer
**Estimated Time:** 3-4 hours

**Files to Modify:**
- `infra/aws/src/main.ts`
- `infra/aws/cdk.json`

**Steps:**

1. **Add Twitter credentials to CDK context:**
```typescript
// infra/aws/src/main.ts

// Existing Reddit credentials (already implemented)
const redditClientId = this.node.tryGetContext('redditClientId');
const redditClientSecret = this.node.tryGetContext('redditClientSecret');
const redditUserAgent = this.node.tryGetContext('redditUserAgent') || 'legal-legal-crawler/1.0 by u/YOUR_USERNAME';

// NEW! Add Twitter credentials after Reddit section
const twitterBearerToken = this.node.tryGetContext('twitterBearerToken');
const twitterApiKey = this.node.tryGetContext('twitterApiKey');
const twitterApiSecret = this.node.tryGetContext('twitterApiSecret');

// Allow optional Twitter credentials (can deploy without Twitter enabled)
if (!twitterBearerToken) {
  console.warn(
    '⚠️  Twitter API credentials not provided. Twitter collection will be disabled.\n' +
    'To enable Twitter, provide credentials using:\n' +
    'npx cdk deploy \\\n' +
    '  --context redditClientId=iPH6UMuXs_0pFWYBHi8gOg \\\n' +
    '  --context redditClientSecret=K6LYsuo4BTkP_ILb2GpE_45dBQ6PqA \\\n' +
    '  --context twitterBearerToken=YOUR_TWITTER_BEARER_TOKEN'
  );
}
```

2. **Create Twitter Collector Lambda:**
```typescript
// Twitter/X Collector Lambda
const twitterCollector = new lambda.Function(this, 'TwitterCollectorFunction', {
  runtime: lambda.Runtime.PYTHON_3_12,
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/collector/twitter')),
  handler: 'index.handler',
  timeout: Duration.minutes(15),
  memorySize: 1024,
  environment: {
    BUCKET_NAME: rawDataBucket.bucketName,
    TWITTER_BEARER_TOKEN: twitterBearerToken || 'DISABLED',
    TWITTER_API_KEY: twitterApiKey || 'DISABLED',
    TWITTER_API_SECRET: twitterApiSecret || 'DISABLED',
  },
  layers: [dependenciesLayer],
  logRetention: logs.RetentionDays.ONE_WEEK,
});

// Grant S3 permissions
rawDataBucket.grantReadWrite(twitterCollector);
```

3. **Update Step Functions to Parallel execution:**
```typescript
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';

const definition = new sfn.Parallel(this, 'ParallelCollection', {
  comment: 'Collect from Reddit and Twitter in parallel',
  resultPath: '$.collectionResults',
})
  .branch(
    new sfnTasks.LambdaInvoke(this, 'CollectReddit', {
      lambdaFunction: redditCollector,
      outputPath: '$.Payload',
    })
  )
  .branch(
    new sfnTasks.LambdaInvoke(this, 'CollectTwitter', {
      lambdaFunction: twitterCollector,
      outputPath: '$.Payload',
    })
  )
  .next(
    new sfnTasks.LambdaInvoke(this, 'AnalyzePosts', {
      lambdaFunction: analyzerFunction,
      outputPath: '$.Payload',
    })
  )
  .next(
    new sfnTasks.LambdaInvoke(this, 'StoreInsights', {
      lambdaFunction: storerFunction,
      outputPath: '$.Payload',
    })
  );

const stateMachine = new sfn.StateMachine(this, 'MultiSourcePipeline', {
  stateMachineName: 'supio-multi-source-insights-pipeline',
  definition,
  timeout: Duration.hours(1),
});
```

4. **Update EventBridge schedule (optional - separate schedules):**
```typescript
// Reddit collection - Monday 2 AM UTC
new events.Rule(this, 'WeeklyRedditCollection', {
  schedule: events.Schedule.cron({ minute: '0', hour: '2', weekDay: 'MON' }),
  targets: [new eventsTargets.SfnStateMachine(stateMachine, {
    input: events.RuleTargetInput.fromObject({
      source: 'reddit',
      manual_trigger: false,
    }),
  })],
});

// Twitter collection - Monday 3 AM UTC (after Reddit)
new events.Rule(this, 'WeeklyTwitterCollection', {
  schedule: events.Schedule.cron({ minute: '0', hour: '3', weekDay: 'MON' }),
  targets: [new eventsTargets.SfnStateMachine(stateMachine, {
    input: events.RuleTargetInput.fromObject({
      source: 'twitter',
      manual_trigger: false,
    }),
  })],
});
```

**Acceptance Criteria:**
- [ ] CDK synthesis successful (`npx cdk synth`)
- [ ] No TypeScript errors
- [ ] Infrastructure diff shows expected changes (`npx cdk diff`)
- [ ] Credentials handled securely (context, not hardcoded)

---

### Task 1.3: Update Lambda Dependencies Layer
**Owner:** Backend Engineer
**Estimated Time:** 1-2 hours

**Files to Modify:**
- `infra/aws/lambda/layer/requirements.txt`

**Steps:**

1. **Add X API library (Latest version from Context7):**
```txt
# infra/aws/lambda/layer/requirements.txt

# Existing dependencies
praw==7.7.1
boto3==1.34.0
requests==2.31.0

# NEW! X API client (Latest stable version)
tweepy==4.14.0  # Twitter for Python - Official library
# OR alternative: python-twitter==3.5 (sns-sdks/python-twitter)
```

**Library Options Comparison:**

| Library | Version | Trust Score | Code Snippets | Recommendation |
|---------|---------|-------------|---------------|----------------|
| **tweepy** | 4.14.0 | 8.0/10 | 260 examples | ✅ **RECOMMENDED** |
| python-twitter | 3.5 | 7.4/10 | 125 examples | Alternative |
| twscrape | Latest | 8.5/10 | 20 examples | Scraping (no API) |
| twikit | Latest | 7.9/10 | 70 examples | Scraping (no API key) |

2. **Test dependency installation locally:**
```bash
cd infra/aws/lambda/layer
python3.12 -m venv test_env
source test_env/bin/activate
pip install -r requirements.txt
python -c "import tweepy; print('Tweepy version:', tweepy.__version__)"
deactivate
rm -rf test_env
```

**Acceptance Criteria:**
- [ ] tweepy installs without errors
- [ ] No version conflicts with existing dependencies
- [ ] Import test successful

---

## Phase 2: Twitter Collector Implementation (Week 1-2, Days 3-7)

### Task 2.1: Create Twitter Collector Lambda Structure
**Owner:** Backend Engineer
**Estimated Time:** 6-8 hours

**Files to Create:**
- `infra/aws/lambda/collector/twitter/index.py`
- `infra/aws/lambda/collector/twitter/__init__.py`

**Steps:**

1. **Create directory structure:**
```bash
mkdir -p infra/aws/lambda/collector/twitter
touch infra/aws/lambda/collector/twitter/__init__.py
touch infra/aws/lambda/collector/twitter/index.py
```

2. **Implement Twitter Collector (infra/aws/lambda/collector/twitter/index.py):**

```python
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

    def __init__(
        self,
        bearer_token: str,
        s3_bucket: str,
        api_tier: str = 'basic',  # NEW! Tier-aware configuration
    ):
        """
        Initialize Lambda X/Twitter crawler with Tweepy client (Latest pattern)

        Args:
            bearer_token: X API v2 Bearer Token (app-only access)
            s3_bucket: S3 bucket name for data storage
            api_tier: API tier ('free', 'basic', 'pro') for rate limiting

        Note: OAuth 2.0 Bearer Token is RECOMMENDED for read-only access.
              From Tweepy docs: client = tweepy.Client("Bearer Token here")
        """
        if not bearer_token:
            raise ValueError("Missing required X API Bearer Token")

        # Initialize Tweepy client with Bearer Token (simplest auth method)
        # Reference: Tweepy authentication.rst - OAuth 2.0 Bearer Token pattern
        self.client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=True  # Automatic rate limit handling
        )

        # Set rate limits based on tier
        self.api_tier = api_tier
        if api_tier == 'free':
            self.max_requests_per_15min = self.FREE_TIER_MAX_REQUESTS_PER_15MIN
            self.monthly_cap = self.FREE_TIER_MONTHLY_CAP
        elif api_tier == 'basic':
            self.max_requests_per_15min = self.BASIC_TIER_MAX_REQUESTS_PER_15MIN
            self.monthly_cap = self.BASIC_TIER_MONTHLY_CAP
        elif api_tier == 'pro':
            self.max_requests_per_15min = self.PRO_TIER_MAX_REQUESTS_PER_15MIN
            self.monthly_cap = self.PRO_TIER_MONTHLY_CAP

        self.s3_bucket = s3_bucket
        self.request_count = 0
        self.collected_tweets = []

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

    def collect_tweets(
        self,
        lookback_days: int = 7,
        min_engagement: int = 5,
    ) -> Dict:
        """
        Main collection method - searches for relevant tweets

        Args:
            lookback_days: Number of days to look back
            min_engagement: Minimum likes + retweets

        Returns:
            Collection summary with S3 location
        """
        print(f"Starting Twitter collection (lookback: {lookback_days} days)")

        start_time = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        for query in self.search_queries:
            try:
                print(f"Searching for: {query}")
                tweets = self._search_recent_tweets(
                    query=query,
                    start_time=start_time,
                    max_results=self.MAX_TWEETS_PER_QUERY,
                )

                for tweet in tweets:
                    if self._is_relevant(tweet, min_engagement):
                        tweet_data = self._extract_tweet_data(tweet)
                        self.collected_tweets.append(tweet_data)

                print(f"Collected {len(tweets)} tweets for query: {query}")

                # Rate limit pause
                time.sleep(2)

            except tweepy.errors.TweepyException as e:
                print(f"Error searching '{query}': {e}")
                continue

        # Save to S3
        s3_key = self._save_to_s3()

        return {
            'statusCode': 200,
            'tweets_collected': len(self.collected_tweets),
            's3_location': f"s3://{self.s3_bucket}/{s3_key}",
            'platform': 'twitter',
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
                max_results=max_results,  # Max 100 per request
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
            if hasattr(response, 'includes') and 'users' in response.includes:
                users = {user.id: user for user in response.includes['users']}

            # Enrich tweets with user data
            enriched_tweets = []
            for tweet in response.data:
                tweet.user = users.get(tweet.author_id)
                enriched_tweets.append(tweet)

            self.request_count += 1

            # Rate limit info from response headers
            if hasattr(response, 'meta'):
                print(f"Rate limit remaining: {response.meta.get('x-rate-limit-remaining', 'unknown')}")

            return enriched_tweets

        except tweepy.errors.TooManyRequests as e:
            # Handle 429 - Rate limit exceeded
            # Response header 'x-rate-limit-reset' tells when limit resets
            print(f"Rate limit exceeded for query: {query}")
            print(f"Tweepy will automatically wait (wait_on_rate_limit=True)")
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
        total_engagement = metrics['like_count'] + metrics['retweet_count']
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
            'id': tweet.id,
            'tweet_id': str(tweet.id),
            'text': tweet.text,
            'url': f"https://twitter.com/user/status/{tweet.id}",
            'created_at': tweet.created_at.isoformat(),
            'author': {
                'id': str(tweet.author_id),
                'username': user.username if user else 'unknown',
                'name': user.name if user else 'unknown',
                'verified': user.verified if user else False,
            },
            'metrics': {
                'likes': metrics['like_count'],
                'retweets': metrics['retweet_count'],
                'replies': metrics['reply_count'],
                'quotes': metrics.get('quote_count', 0),
            },
            'conversation_id': str(tweet.conversation_id),
            'lang': tweet.lang,
            'collected_at': datetime.now(timezone.utc).isoformat(),
        }

    def _save_to_s3(self) -> str:
        """Save collected tweets to S3"""
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S')
        s3_key = f"twitter/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}/tweets_{timestamp}.json"

        data = {
            'platform': 'twitter',
            'collected_at': datetime.now(timezone.utc).isoformat(),
            'total_tweets': len(self.collected_tweets),
            'tweets': self.collected_tweets,
        }

        s3.put_object(
            Bucket=self.s3_bucket,
            Key=s3_key,
            Body=json.dumps(data, indent=2),
            ContentType='application/json',
        )

        print(f"Saved {len(self.collected_tweets)} tweets to s3://{self.s3_bucket}/{s3_key}")
        return s3_key


def handler(event, context):
    """
    Lambda handler for Twitter collection

    Event format:
    {
        "lookback_days": 7,
        "min_engagement": 5,
        "manual_trigger": false
    }
    """
    try:
        # Get credentials from environment
        bearer_token = os.environ.get('TWITTER_BEARER_TOKEN')
        api_key = os.environ.get('TWITTER_API_KEY')
        api_secret = os.environ.get('TWITTER_API_SECRET')
        bucket_name = os.environ.get('BUCKET_NAME')

        # Check if Twitter is disabled
        if bearer_token == 'DISABLED':
            return {
                'statusCode': 200,
                'message': 'Twitter collection is disabled (no credentials provided)',
                'tweets_collected': 0,
            }

        # Parse event parameters
        lookback_days = event.get('lookback_days', 7)
        min_engagement = event.get('min_engagement', 5)

        # Initialize crawler
        crawler = LambdaTwitterCrawler(
            bearer_token=bearer_token,
            api_key=api_key,
            api_secret=api_secret,
            s3_bucket=bucket_name,
        )

        # Collect tweets
        result = crawler.collect_tweets(
            lookback_days=lookback_days,
            min_engagement=min_engagement,
        )

        return result

    except Exception as e:
        print(f"Error in Twitter collector: {e}")
        return {
            'statusCode': 500,
            'error': str(e),
            'tweets_collected': 0,
        }
```

**Acceptance Criteria:**
- [ ] Code follows existing collector pattern
- [ ] Error handling implemented
- [ ] S3 integration working
- [ ] Rate limiting respected
- [ ] Local testing passes

---

### Task 2.2: Update Analyzer Lambda for Twitter
**Owner:** Backend Engineer
**Estimated Time:** 3-4 hours

**Files to Modify:**
- `infra/aws/lambda/analyzer/index.py`

**Steps:**

1. **Update analyzer to handle Twitter data:**

```python
# infra/aws/lambda/analyzer/index.py

def handler(event, context):
    """
    Analyze posts from multiple sources (Reddit + Twitter)
    """
    # Parse collection results from Step Functions Parallel state
    collection_results = event.get('collectionResults', [])

    all_posts = []

    # Extract posts from each source
    for result in collection_results:
        if result.get('platform') == 'reddit':
            # Load Reddit data from S3
            reddit_posts = load_reddit_posts(result['s3_location'])
            all_posts.extend(reddit_posts)
        elif result.get('platform') == 'twitter':
            # Load Twitter data from S3
            twitter_posts = load_twitter_posts(result['s3_location'])
            all_posts.extend(twitter_posts)

    # Analyze all posts with unified prompt
    analyzed_posts = []
    for post in all_posts:
        analysis = analyze_with_bedrock(post)
        analyzed_posts.append(analysis)

    return {
        'statusCode': 200,
        'insights_analyzed': len(analyzed_posts),
        'results': analyzed_posts
    }


def load_twitter_posts(s3_location: str) -> List[Dict]:
    """Load and format Twitter data for analysis"""
    # Parse s3://bucket/key
    bucket, key = parse_s3_location(s3_location)

    # Load from S3
    response = s3.get_object(Bucket=bucket, Key=key)
    data = json.loads(response['Body'].read())

    # Convert to unified format
    posts = []
    for tweet in data.get('tweets', []):
        posts.append({
            'id': tweet['tweet_id'],
            'platform': 'twitter',
            'title': f"@{tweet['author']['username']}",
            'content': tweet['text'],
            'author': tweet['author']['username'],
            'url': tweet['url'],
            'score': tweet['metrics']['likes'] + tweet['metrics']['retweets'],
            'created_utc': tweet['created_at'],
            'metrics': tweet['metrics'],
        })

    return posts
```

**Acceptance Criteria:**
- [ ] Handles both Reddit and Twitter data
- [ ] Unified data format for analysis
- [ ] Platform source tracked
- [ ] No breaking changes to existing Reddit analysis

---

## Phase 3: API & Configuration Updates (Week 2, Days 8-10)

### Task 3.1: Update API Lambda for Twitter
**Owner:** Backend Engineer
**Estimated Time:** 4-5 hours

**Files to Modify:**
- `infra/aws/lambda/api/index.py`

**Steps:**

1. **Add Twitter configuration to default settings:**

```python
DEFAULT_CRAWL_SETTINGS = {
    'default_subreddits': ['LawFirm', 'Lawyertalk', 'legaltech', 'legaltechAI'],
    'default_crawl_type': 'both',
    'default_days_back': 7,
    'default_min_score': 10,
    'max_posts_per_crawl': 500,

    # NEW! Twitter settings
    'twitter_enabled': True,
    'twitter_lookback_days': 7,
    'twitter_min_engagement': 5,
    'twitter_max_tweets_per_query': 100,
    'twitter_search_queries': [
        'legaltech OR #legaltech',
        'personal injury attorney OR PI attorney',
        'Supio OR EvenUp OR Eve',
    ],
}
```

2. **Update trigger handler to support platform selection:**

```python
def handle_trigger_crawl(event, context, headers):
    """Handle POST /trigger with platform selection"""
    body = json.loads(event.get('body', '{}'))

    # Load configuration
    config = load_config_from_dynamodb()

    # Platform selection
    platforms = body.get('platforms', ['reddit', 'twitter'])  # Both by default

    execution_input = {
        'manual_trigger': True,
        'platforms': platforms,
        'reddit_config': {
            'subreddits': config.get('default_subreddits'),
            'days_back': body.get('days_back', config.get('default_days_back')),
        },
        'twitter_config': {
            'enabled': 'twitter' in platforms and config.get('twitter_enabled'),
            'lookback_days': body.get('twitter_lookback_days', config.get('twitter_lookback_days')),
            'min_engagement': body.get('twitter_min_engagement', config.get('twitter_min_engagement')),
        },
    }

    # Start Step Functions
    response = sfn.start_execution(...)
    return response
```

3. **Update insights list to show platform:**

```python
def handle_list_insights(event, headers):
    """GET /insights with platform filtering"""
    params = event.get('queryStringParameters', {})
    platform = params.get('platform')  # NEW! Filter by platform

    # Build filter expression
    filter_expr = ''
    if platform:
        filter_expr += 'source_type = :platform'
        expr_values[':platform'] = platform

    # Query DynamoDB...
    return insights
```

**Acceptance Criteria:**
- [ ] Configuration supports Twitter settings
- [ ] Platform selection in trigger endpoint
- [ ] Insights filterable by platform
- [ ] Backward compatible with existing API

---

### Task 3.2: Update DynamoDB Schema
**Owner:** Backend Engineer
**Estimated Time:** 2 hours

**Files to Modify:**
- `infra/aws/lambda/storer/index.py`

**Steps:**

1. **Update insights schema to include platform:**

```python
def store_insight(insight, table_name):
    """Store insight with platform metadata"""

    item = {
        'PK': f"INSIGHT#{date}",
        'SK': f"PRIORITY#{priority}#ID#{post_id}",
        'post_id': insight['id'],
        'source_type': insight.get('platform', 'reddit'),  # NEW!
        'source_url': insight['url'],

        # Platform-specific metadata
        'platform_metadata': {
            'reddit': {
                'subreddit': insight.get('subreddit'),
                'post_score': insight.get('score'),
            } if insight.get('platform') == 'reddit' else None,

            'twitter': {
                'tweet_id': insight.get('tweet_id'),
                'author_username': insight.get('author', {}).get('username'),
                'likes': insight.get('metrics', {}).get('likes'),
                'retweets': insight.get('metrics', {}).get('retweets'),
            } if insight.get('platform') == 'twitter' else None,
        },

        # Rest of the insight data...
    }

    table.put_item(Item=item)
```

**Acceptance Criteria:**
- [ ] Platform tracked in insights
- [ ] Platform-specific metadata preserved
- [ ] Existing Reddit data unchanged
- [ ] DynamoDB writes successful

---

## Phase 4: Frontend Updates (Week 2-3, Days 11-14)

### Task 4.1: Update Frontend Components
**Owner:** Frontend Engineer
**Estimated Time:** 6-8 hours

**Files to Modify:**
- `ui/src/app/dashboard/page.tsx`
- `ui/src/app/insights/page.tsx`
- `ui/src/app/config/page.tsx`
- `ui/src/types/index.ts`

**Steps:**

1. **Add platform filter to insights page:**

```typescript
// ui/src/app/insights/page.tsx

export default function InsightsPage() {
  const [platform, setPlatform] = useState<'all' | 'reddit' | 'twitter'>('all');

  const { data: insights } = useInsights({
    platform: platform !== 'all' ? platform : undefined,
    priority_min: 5,
  });

  return (
    <div>
      {/* Platform filter */}
      <Select value={platform} onValueChange={setPlatform}>
        <SelectTrigger>
          <SelectValue placeholder="Filter by platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Platforms</SelectItem>
          <SelectItem value="reddit">Reddit Only</SelectItem>
          <SelectItem value="twitter">X (Twitter) Only</SelectItem>
        </SelectContent>
      </Select>

      {/* Insights grid */}
      <InsightsGrid insights={insights} />
    </div>
  );
}
```

2. **Add Twitter configuration section:**

```typescript
// ui/src/app/config/page.tsx

export default function ConfigPage() {
  const [config, setConfig] = useState(null);

  return (
    <div>
      {/* Existing Reddit config */}
      <Card>
        <CardHeader>
          <CardTitle>Reddit Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Existing fields */}
        </CardContent>
      </Card>

      {/* NEW! Twitter config */}
      <Card>
        <CardHeader>
          <CardTitle>X (Twitter) Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Enable Twitter Collection</Label>
              <Switch
                checked={config?.twitter_enabled}
                onCheckedChange={(v) => updateConfig('twitter_enabled', v)}
              />
            </div>

            <div>
              <Label>Lookback Days</Label>
              <Input
                type="number"
                value={config?.twitter_lookback_days || 7}
                onChange={(e) => updateConfig('twitter_lookback_days', parseInt(e.target.value))}
              />
            </div>

            <div>
              <Label>Minimum Engagement</Label>
              <Input
                type="number"
                value={config?.twitter_min_engagement || 5}
                onChange={(e) => updateConfig('twitter_min_engagement', parseInt(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

3. **Add platform badge to insight cards:**

```typescript
// ui/src/components/InsightCard.tsx

export function InsightCard({ insight }: { insight: Insight }) {
  const platformIcon = insight.source_type === 'twitter'
    ? <Twitter className="h-4 w-4" />
    : <MessageSquare className="h-4 w-4" />;

  const platformColor = insight.source_type === 'twitter'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-orange-100 text-orange-800';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className={platformColor}>
            {platformIcon}
            {insight.source_type}
          </Badge>
          <PriorityBadge score={insight.priority_score} />
        </div>
        <h3>{insight.feature_summary}</h3>
      </CardHeader>
      {/* Rest of card */}
    </Card>
  );
}
```

**Acceptance Criteria:**
- [ ] Platform filter functional
- [ ] Twitter config UI working
- [ ] Platform badges displayed
- [ ] No UI regressions

---

## Phase 5: Testing & Validation (Week 3-4, Days 15-20)

### Task 5.1: Unit Testing
**Owner:** Backend Engineer
**Estimated Time:** 4-6 hours

**Files to Create:**
- `infra/aws/lambda/collector/twitter/test_index.py`

**Steps:**

1. **Create unit tests:**

```python
# test_index.py
import pytest
from unittest.mock import Mock, patch
from index import LambdaTwitterCrawler, handler


@pytest.fixture
def mock_twitter_client():
    with patch('tweepy.Client') as mock:
        yield mock


def test_twitter_crawler_init(mock_twitter_client):
    """Test crawler initialization"""
    crawler = LambdaTwitterCrawler(
        bearer_token='test_token',
        api_key='test_key',
        api_secret='test_secret',
        s3_bucket='test-bucket',
    )

    assert crawler.s3_bucket == 'test-bucket'
    assert len(crawler.search_queries) > 0


def test_is_relevant():
    """Test relevance filtering"""
    crawler = LambdaTwitterCrawler(...)

    # Mock tweet with high engagement
    tweet = Mock()
    tweet.text = "Great new legaltech tool for medical records"
    tweet.public_metrics = {'like_count': 10, 'retweet_count': 5}

    assert crawler._is_relevant(tweet, min_engagement=5) is True

    # Mock tweet with low engagement
    tweet.public_metrics = {'like_count': 1, 'retweet_count': 0}
    assert crawler._is_relevant(tweet, min_engagement=5) is False


def test_handler_disabled_twitter(monkeypatch):
    """Test handler when Twitter is disabled"""
    monkeypatch.setenv('TWITTER_BEARER_TOKEN', 'DISABLED')

    result = handler({}, None)

    assert result['statusCode'] == 200
    assert result['tweets_collected'] == 0
```

2. **Run tests:**

```bash
cd infra/aws/lambda/collector/twitter
python -m pytest test_index.py -v
```

**Acceptance Criteria:**
- [ ] All unit tests pass
- [ ] Code coverage > 80%
- [ ] Edge cases handled
- [ ] Mock API responses working

---

### Task 5.2: Integration Testing
**Owner:** Full Stack Engineer
**Estimated Time:** 6-8 hours

**Steps:**

1. **Test Twitter API connection:**

```bash
# Test script
python3 <<EOF
import tweepy

client = tweepy.Client(bearer_token="YOUR_TOKEN")
response = client.search_recent_tweets(
    query="legaltech",
    max_results=10,
    tweet_fields=['created_at', 'public_metrics']
)

print(f"Found {len(response.data)} tweets")
for tweet in response.data:
    print(f"- {tweet.text[:50]}...")
EOF
```

2. **Test Lambda locally:**

```bash
# Create test event
cat > test_event.json <<EOF
{
  "lookback_days": 1,
  "min_engagement": 1
}
EOF

# Invoke locally
cd infra/aws
sam local invoke TwitterCollectorFunction --event test_event.json
```

3. **Test Step Functions execution:**

```bash
# Deploy stack
npx cdk deploy --context twitterBearerToken=YOUR_TOKEN

# Trigger manually
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-west-2:xxx:stateMachine:supio-multi-source-insights-pipeline \
  --input '{"platforms": ["twitter"], "twitter_config": {"lookback_days": 1}}'
```

4. **Verify data in S3:**

```bash
# Check S3 for Twitter data
aws s3 ls s3://supio-raw-data-xxx/twitter/ --recursive

# Download and inspect
aws s3 cp s3://supio-raw-data-xxx/twitter/2025-01-20/tweets_xxx.json -
```

**Acceptance Criteria:**
- [ ] Twitter API authentication successful
- [ ] Tweets collected and saved to S3
- [ ] Step Functions completes successfully
- [ ] Data format correct
- [ ] Analyzer processes Twitter data
- [ ] Insights stored in DynamoDB

---

### Task 5.3: End-to-End Testing
**Owner:** QA/Full Stack Engineer
**Estimated Time:** 4-6 hours

**Test Scenarios:**

1. **Scenario 1: Reddit + Twitter Collection**
  - Trigger: POST /trigger with both platforms
  - Expected: Both collectors run in parallel
  - Verify: S3 has data from both sources
  - Verify: Insights table has entries from both platforms

2. **Scenario 2: Twitter-Only Collection**
  - Trigger: POST /trigger with `{"platforms": ["twitter"]}`
  - Expected: Only Twitter collector runs
  - Verify: No Reddit data collected

3. **Scenario 3: Platform Filter in UI**
  - Action: Select "Twitter Only" in insights filter
  - Expected: Only Twitter insights displayed
  - Verify: API receives platform=twitter parameter

4. **Scenario 4: Configuration Persistence**
  - Action: Disable Twitter in config UI
  - Action: Save configuration
  - Action: Trigger collection
  - Expected: Twitter collector skipped
  - Verify: Only Reddit data collected

5. **Scenario 5: Rate Limit Handling**
  - Action: Trigger multiple collections rapidly
  - Expected: Tweepy handles rate limits gracefully
  - Verify: No errors, automatic backoff

**Acceptance Criteria:**
- [ ] All scenarios pass
- [ ] No errors in CloudWatch logs
- [ ] Data quality verified
- [ ] UI displays correctly
- [ ] Performance acceptable

---

## Phase 6: Documentation & Deployment (Week 4, Days 21-25)

### Task 6.1: Update Documentation
**Owner:** Tech Writer/Engineer
**Estimated Time:** 4-6 hours

**Files to Update:**
- `README.md`
- `infra/aws/API_INTEGRATION.md`
- `DESIGN_DOCUMENT_OVERALL.md` ✅ (Already updated)
- Create: `TWITTER_INTEGRATION_GUIDE.md`

**Steps:**

1. **Update README.md:**

```markdown
## Prerequisites

### Twitter API Access
To enable Twitter data collection:
1. Apply for Twitter Developer account
2. Create app with Essential or Elevated access
3. Generate Bearer Token and API credentials
4. Configure in CDK context:

\`\`\`bash
npx cdk deploy \\
  --context redditClientId=YOUR_REDDIT_ID \\
  --context redditClientSecret=YOUR_REDDIT_SECRET \\
  --context twitterBearerToken=YOUR_TWITTER_TOKEN \\
  --context twitterApiKey=YOUR_TWITTER_KEY \\
  --context twitterApiSecret=YOUR_TWITTER_SECRET
\`\`\`

### Configuration
- Twitter collection can be enabled/disabled via `/config` endpoint
- Platform selection available in trigger API: `POST /trigger {"platforms": ["reddit", "twitter"]}`
```

2. **Create Twitter Integration Guide:**

```markdown
# Twitter Integration Guide

## Overview
This guide covers Twitter (X) integration for legal tech insights collection.

## API Access Tiers

| Tier | Cost | Rate Limits | Features |
|------|------|-------------|----------|
| Essential | Free | 500k tweets/month | Basic search |
| Elevated | $100/month | 2M tweets/month | User context |
| Pro | $5000/month | 10M tweets/month | Full archive |

## Configuration

### Search Queries
Optimize search queries for legal tech:
- Use OR operators: `legaltech OR (legal tech)`
- Include hashtags: `#legaltech #lawfirm`
- Product mentions: `Supio OR EvenUp`
- Combine keywords: `(medical records) (attorney OR lawyer)`

### Rate Limits
- Essential: 300 requests per 15-min window
- Automatic backoff enabled via Tweepy
- Collect during off-peak hours (Monday 3 AM UTC)

## Troubleshooting

### Error: "429 Too Many Requests"
- Wait for rate limit window reset (15 minutes)
- Reduce `max_tweets_per_query` in config
- Upgrade to Elevated tier

### Error: "401 Unauthorized"
- Verify Bearer Token is correct
- Check API key permissions
- Regenerate credentials if needed

### No Tweets Collected
- Verify search queries return results on Twitter website
- Check `min_engagement` threshold (lower to 1 for testing)
- Increase `lookback_days` to 14
```

**Acceptance Criteria:**
- [ ] All documentation updated
- [ ] Code examples tested
- [ ] Troubleshooting guide complete
- [ ] API endpoints documented

---

### Task 6.2: Production Deployment
**Owner:** DevOps Engineer
**Estimated Time:** 3-4 hours

**Steps:**

1. **Pre-deployment checklist:**

```bash
# Navigate to infrastructure directory
cd infra/aws

# Verify CDK synthesis
npx cdk synth

# Run tests
npm run test

# Check for security issues
npm audit

# Verify credentials are NOT committed
git grep -i "bearer.*token" || echo "Safe"
git grep -i "api.*key" || echo "Safe"
```

2. **Deploy to production (using your existing command pattern):**

```bash
# Set environment
export AWS_PROFILE=production
export AWS_REGION=us-west-2

# Navigate to CDK directory
cd /Users/kyiamzn/03_code/CommProbe/infra/aws

# Deploy with production credentials (matching your existing pattern)
npx cdk deploy \
  --context redditClientId=iPH6UMuXs_0pFWYBHi8gOg \
  --context redditClientSecret=K6LYsuo4BTkP_ILb2GpE_45dBQ6PqA \
  --context twitterBearerToken=YOUR_TWITTER_BEARER_TOKEN_HERE

# OR store in cdk.json to avoid passing each time:
# Edit infra/aws/cdk.json and add to "context" section:
# {
#   "context": {
#     "redditClientId": "iPH6UMuXs_0pFWYBHi8gOg",
#     "redditClientSecret": "K6LYsuo4BTkP_ILb2GpE_45dBQ6PqA",
#     "twitterBearerToken": "YOUR_TWITTER_BEARER_TOKEN_HERE"
#   }
# }
```

**Note:** Follow your existing credential management pattern. If you have Reddit credentials in cdk.json, add Twitter credentials there as well.

3. **Capture outputs:**

```bash
# Capture outputs
export API_URL=$(aws cloudformation describe-stacks \
  --stack-name legal-crawler-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

export API_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name legal-crawler-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text)

export API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)

# Update frontend config
echo "NEXT_PUBLIC_API_URL=$API_URL" > ui/src/.env.production
echo "NEXT_PUBLIC_API_KEY=$API_KEY" >> ui/src/.env.production
```

3. **Post-deployment verification:**

```bash
# Test API
curl -X POST $API_URL/trigger \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"platforms": ["twitter"], "twitter_config": {"lookback_days": 1}}'

# Check execution
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:...:stateMachine:supio-multi-source-insights-pipeline \
  --max-items 1

# Monitor logs
aws logs tail /aws/lambda/TwitterCollectorFunction --follow
```

**Acceptance Criteria:**
- [ ] Deployment successful
- [ ] No errors in deployment
- [ ] API responding correctly
- [ ] Scheduled runs working
- [ ] Monitoring enabled

---

### Task 6.3: Monitoring & Alerting
**Owner:** DevOps Engineer
**Estimated Time:** 2-3 hours

**Steps:**

1. **Create CloudWatch Dashboard:**

```typescript
// Add to CDK stack
const dashboard = new cloudwatch.Dashboard(this, 'MultiSourceDashboard', {
  dashboardName: 'supio-multi-source-insights',
});

dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'Collection Metrics',
    left: [
      redditCollector.metricInvocations(),
      twitterCollector.metricInvocations(),
    ],
  }),
  new cloudwatch.GraphWidget({
    title: 'Error Rates',
    left: [
      redditCollector.metricErrors(),
      twitterCollector.metricErrors(),
    ],
  }),
);
```

2. **Create SNS alerts:**

```typescript
const alarmTopic = new sns.Topic(this, 'AlarmTopic');

// Alert on Twitter collector failures
new cloudwatch.Alarm(this, 'TwitterCollectorErrorAlarm', {
  metric: twitterCollector.metricErrors(),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'Twitter collector failed',
});

alarmTopic.addSubscription(
  new subscriptions.EmailSubscription('team@example.com')
);
```

**Acceptance Criteria:**
- [ ] Dashboard created
- [ ] Alerts configured
- [ ] Email notifications working
- [ ] Metrics visible

---

## Phase 7: Rollout & Optimization (Week 4, Days 26-28)

### Task 7.1: Gradual Rollout
**Owner:** Product Manager + DevOps
**Estimated Time:** Ongoing

**Steps:**

1. **Week 1: Shadow Mode**
  - Enable Twitter collection
  - Don't display in UI yet
  - Monitor data quality
  - Compare with Reddit insights

2. **Week 2: Beta Release**
  - Show Twitter insights to internal team
  - Gather feedback on relevance
  - Adjust search queries
  - Tune engagement threshold

3. **Week 3: Limited Release**
  - Enable for subset of users
  - Add platform filter to UI
  - Monitor usage metrics
  - Fix any issues

4. **Week 4: Full Release**
  - Enable for all users
  - Announce new feature
  - Update documentation
  - Collect user feedback

**Acceptance Criteria:**
- [ ] Phased rollout complete
- [ ] No major issues
- [ ] User feedback positive
- [ ] Metrics improved

---

## Success Metrics

Track these KPIs after Twitter integration:

| Metric | Baseline (Reddit Only) | Target (+ Twitter) | Actual |
|--------|------------------------|--------------------|----- --|
| **Insights Collected/Week** | 50-100 | 100-150 | ___ |
| **High Priority Insights** | 10-20 | 20-30 | ___ |
| **Unique Product Mentions** | 30-50 | 60-80 | ___ |
| **Average Priority Score** | 6.2 | 6.5+ | ___ |
| **Data Collection Time** | 15 min | <20 min | ___ |
| **False Positive Rate** | <10% | <10% | ___ |

---

## Rollback Plan

If critical issues arise:

1. **Disable Twitter collection:**
```bash
# Update config via API
curl -X PUT $API_URL/config \\
  -H "X-API-Key: $API_KEY" \\
  -d '{"crawl_settings": {"twitter_enabled": false}}'
```

2. **Revert CDK changes:**
```bash
git revert <commit-hash>
npx cdk deploy
```

3. **Remove Twitter insights:**
```python
# Clean up script
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('supio-insights')

# Scan for Twitter insights
response = table.scan(
    FilterExpression='source_type = :twitter',
    ExpressionAttributeValues={':twitter': 'twitter'}
)

# Delete items
for item in response['Items']:
    table.delete_item(Key={'PK': item['PK'], 'SK': item['SK']})
```

---

## Cost Estimate (UPDATED FOR 2025 X API PRICING)

### ⚠️ CRITICAL UPDATE: X API Pricing Changed

**Old Pricing (Deprecated):**
- ~~Essential: $0/month~~ - NO LONGER EXISTS
- ~~Elevated: $100/month~~ - NO LONGER EXISTS

**New Pricing (2025):**

| Tier | Monthly Cost | Posts/Month | Weekly Collection Viable? | Recommendation |
|------|--------------|-------------|---------------------------|----------------|
| **Free** | $0 | 100 posts | ❌ NO (4 weeks = 400+ posts needed) | Testing only |
| **Basic** | **$200** | 15,000 posts | ✅ YES | **API approach** |
| **Pro** | $5,000 | 1M posts | ✅ YES | Overkill for weekly |

### X API Basic Tier - Total Cost

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
X API Basic Tier:              $200.00/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS Infrastructure (Additional):
  - Lambda executions:          $  1.50/month
  - S3 storage:                 $  0.10/month
  - DynamoDB writes:            $  0.50/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Monthly Cost:            $202.10/month
Total Annual Cost:             $2,425.20/year
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### X API Pro Tier - Total Cost (If Scaling Needed)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
X API Pro Tier:                $5,000.00/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS Infrastructure (Additional):
  - Lambda executions:          $  1.50/month
  - S3 storage:                 $  0.10/month
  - DynamoDB writes:            $  0.50/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Monthly Cost:            $5,002.10/month
Total Annual Cost:             $60,025.20/year
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Capacity Planning

**Basic Tier Analysis (Recommended):**
- Monthly capacity: 15,000 posts
- Weekly collection: ~200-500 posts/week
- Monthly usage: ~800-2,000 posts/month
- Utilization: 5-13% of capacity
- Headroom: 87-95% spare capacity for growth
- **Verdict:** ✅ Sufficient with room to scale

**Free Tier Analysis:**
- Monthly capacity: 100 posts
- Weekly collection: ~200-500 posts/week
- **Verdict:** ❌ Will hit limit in first week, unsuitable for production

---

## Support & Maintenance

### Weekly Tasks
- [ ] Review Twitter insights quality
- [ ] Adjust search queries based on results
- [ ] Check rate limit usage
- [ ] Monitor CloudWatch metrics

### Monthly Tasks
- [ ] Review API costs
- [ ] Optimize search queries
- [ ] Update keyword list
- [ ] Analyze user engagement

### Quarterly Tasks
- [ ] Evaluate API tier (upgrade/downgrade)
- [ ] Review competitor mentions
- [ ] Update documentation
- [ ] Plan new features

---

## Additional Resources

**Official X Documentation:**
- **X API Docs:** https://docs.x.com/
- **X API v2 Reference:** https://docs.x.com/x-api
- **Rate Limits:** https://docs.x.com/x-api/fundamentals/rate-limits
- **Authentication:** https://docs.x.com/x-api/authentication
- **Pricing:** https://docs.x.com/x-api/pricing

**Tweepy (Python Client):**
- **Tweepy Documentation:** https://docs.tweepy.org/
- **GitHub Repository:** https://github.com/tweepy/tweepy
- **API v2 Client:** https://github.com/tweepy/tweepy/blob/master/docs/client.rst
- **Authentication Patterns:** https://github.com/tweepy/tweepy/blob/master/docs/authentication.rst

**AWS Documentation:**
- **Step Functions Parallel State:** https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html
- **Lambda Python Runtime:** https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html
- **CDK TypeScript Reference:** https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html

---

## Appendix: Example Data

### Example Twitter Data Structure

```json
{
  "platform": "twitter",
  "collected_at": "2025-01-20T10:00:00Z",
  "total_tweets": 42,
  "tweets": [
    {
      "id": "1234567890",
      "tweet_id": "1234567890",
      "text": "Just discovered @Supio for medical records automation. Game changer for PI cases! #legaltech",
      "url": "https://twitter.com/user/status/1234567890",
      "created_at": "2025-01-20T09:45:00Z",
      "author": {
        "id": "987654321",
        "username": "pi_attorney_jane",
        "name": "Jane Smith, Esq.",
        "verified": false
      },
      "metrics": {
        "likes": 15,
        "retweets": 3,
        "replies": 2,
        "quotes": 1
      },
      "conversation_id": "1234567890",
      "lang": "en",
      "collected_at": "2025-01-20T10:00:00Z"
    }
  ]
}
```

---

## 🎯 Final Recommendations (Based on Latest X API Docs)

### For CommProbe Legal Tech Intelligence Platform:

**RECOMMENDED APPROACH: X API Basic Tier ($200/month)**

**Rationale:**
1. **Official Support:** Supported by X, no TOS violations
2. **Reliability:** 99.9% uptime, guaranteed rate limits
3. **Capacity:** 15,000 posts/month (sufficient for 500 posts/week)
4. **Structured Data:** Clean JSON responses from official API
5. **Tweepy Integration:** Mature Python library with 260+ code examples

**Implementation Timeline:**
- Week 1: Account setup and credential generation (Days 1-2)
- Week 2: Lambda implementation and testing (Days 3-10)
- Week 3: Integration and end-to-end testing (Days 11-17)
- Week 4: Production deployment and monitoring (Days 18-28)

**Annual Investment:**
- API costs: $2,400/year
- AWS infrastructure: $25/year
- Total: $2,425/year

### Tier Selection Guide

**Start with Basic Tier if:**
- ✅ Weekly collection < 3,500 posts/week
- ✅ Need reliable, supported API
- ✅ Can budget $200/month
- ✅ Want official data access

**Upgrade to Pro Tier if:**
- Collection > 15,000 posts/month
- Need real-time filtered stream
- Require higher rate limits (300 req/15min)
- Can budget $5,000/month

**Free Tier (NOT RECOMMENDED):**
- ❌ Only 100 posts/month (25/week)
- ❌ Insufficient for production use
- ⚠️ Use only for initial API testing

### Success Metrics (Monitor First 3 Months)

| Metric | Target | Monitoring |
|--------|--------|------------|
| Collection Success Rate | >99% | CloudWatch metrics |
| Average Posts/Week | 200-500 | DynamoDB counts |
| API Cost/Post | ~$0.27 | Billing dashboard |
| Rate Limit Usage | <80% | API response headers |
| Data Quality Score | >9/10 | Manual review |

**Decision Point:** If usage consistently exceeds 12,000 posts/month (80% of capacity), plan upgrade to Pro tier.

---

## 📚 Updated References (2025)

**Official X Documentation:**
- Main docs: https://docs.x.com/
- X API Overview: https://docs.x.com/x-api/getting-started/about-x-api
- Rate Limits: https://docs.x.com/x-api/fundamentals/rate-limits
- Authentication: https://docs.x.com/x-api/authentication
- Search Endpoints: https://docs.x.com/x-api/tweets/search
- Pricing: https://docs.x.com/x-api/pricing

**Tweepy Documentation (Official Python Client):**
- Tweepy Docs: https://docs.tweepy.org/
- API v2 Client Reference: https://github.com/tweepy/tweepy/blob/master/docs/client.rst
- Authentication Guide: https://github.com/tweepy/tweepy/blob/master/docs/authentication.rst
- FAQ & Best Practices: https://github.com/tweepy/tweepy/blob/master/docs/faq.rst
- Rate Limit Handling: Built-in with `wait_on_rate_limit=True`

**Alternative Python Libraries (Context7 validated):**
- **tweepy** (Trust Score 8.0/10): 260 code examples, most mature ✅ **RECOMMENDED**
- python-twitter (Trust Score 7.4/10): 125 code examples, alternative client
- Tweepy plugins: token-refresher, rate-limit plugins available

**AWS Integration:**
- Step Functions Parallel State: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html
- Lambda Python Runtime: https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html
- DynamoDB Best Practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html

---

**Document Version:** 2.0 (Updated for 2025 X API changes)
**Last Updated:** 2025-01-20
**Based on:** docs.x.com official documentation + Context7 Tweepy library validation
**Author:** Engineering Team
**Status:** Ready for Implementation - X API Basic Tier recommended
