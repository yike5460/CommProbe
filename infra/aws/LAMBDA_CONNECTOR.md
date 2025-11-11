# Implementation Notes - Lambda Collector

## Key Revisions from Prototype

This document summarizes how the Lambda collector strictly follows the validated prototype code from `/infra/prototype/reddit_crawler.py`.

## Core Features Implemented

### 1. **Recursive Comment Tree Fetching**
- Implements `fetch_comment_tree()` function with depth tracking
- Supports `MAX_COMMENT_DEPTH = 4` levels of nested replies
- Fetches up to `MAX_REPLIES_PER_COMMENT = 10` replies per comment
- Preserves context by including all replies when `PRESERVE_CONTEXT = True`

### 2. **Dual Crawling Strategies**
- **Browse-based discovery** (`crawl_subreddit`): Fetches from hot, new, rising, top listings
- **Keyword search** (`search_keywords`): Targeted search for specific terms
- Configurable via `crawl_type` parameter: 'crawl', 'search', or 'both'

### 3. **Data Extraction Methods**
- `extract_post_data()`: Extracts all post metadata including edited status
- `extract_comment_data()`: Includes depth tracking for hierarchical structure
- `get_content_hash()`: MD5 hash for change detection (supports incremental mode)

### 4. **Keyword Relevance Filtering**
- `is_relevant()`: Filters content based on keywords
- Checks both post title and content
- Preserves author replies when `ALWAYS_INCLUDE_AUTHOR = True`

### 5. **Rate Limiting & Error Handling**
- Implements delays between API calls (0.1s to 1.0s)
- Exponential backoff on rate limit errors (60s)
- PRAW configuration with `ratelimit_seconds=300`

### 6. **Configuration Constants**
From prototype, all limits are preserved:
```python
MAX_REQUESTS_PER_MINUTE = 30
POSTS_PER_LISTING = 25
COMMENTS_PER_POST = 20
SEARCH_LIMIT = 10
SEARCH_COMMENTS_LIMIT = 10
MAX_COMMENT_DEPTH = 4
MAX_REPLIES_PER_COMMENT = 10
MIN_COMMENT_SCORE = -5
```

## Lambda-Specific Adaptations

### 1. **Stateless Operation**
- Lambda doesn't persist `reddit_crawl_record.json` between invocations
- Incremental mode simplified (optional via event parameter)
- Rate limit tracking removed (handled by Lambda concurrency limits)

### 2. **Environment Variables**
- Reddit credentials from CDK context parameters
- Passed as Lambda environment variables
- Validation on Lambda startup

### 3. **S3 Storage**
- Results saved to S3 instead of local JSON files
- Hierarchical key structure: `reddit/YYYY-MM-DD/crawl_TIMESTAMP.json`
- Includes nested comment count in metadata

### 4. **Event-Driven Configuration**
Lambda accepts configuration via event payload:
```json
{
  "subreddits": ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"],
  "keywords": ["Supio", "EvenUp", "Eve", "medical records", "demand letter", "medical chronology", ...],
  "days_back": 3,
  "min_score": 10,
  "incremental": false,
  "crawl_type": "both"
}
```

## Dependencies

### Lambda Layer Requirements
```
praw>=7.7.0       # Reddit API wrapper
boto3>=1.28.0     # AWS SDK (included for consistency)
requests>=2.31.0  # Required by PRAW
```

Note: Removed pandas, numpy, tqdm from prototype as they're not used in Lambda execution.

## Deployment

### Using CDK Context Parameters
```bash
npx cdk deploy \
  --context redditClientId=YOUR_CLIENT_ID \
  --context redditClientSecret=YOUR_SECRET
```

### Manual Trigger
The Step Functions state machine can be triggered:
1. Automatically via EventBridge (weekly on Mondays)
2. Manually via the TriggerFunction Lambda

## Validation Checklist

✅ Recursive comment tree fetching with depth control  
✅ Both crawl and search methods implemented  
✅ Exact data extraction matching prototype  
✅ Keyword relevance filtering  
✅ Rate limiting and backoff logic  
✅ All configuration constants preserved  
✅ Hash-based change detection  
✅ Nested comment structure maintained  
✅ Error handling and retry logic  

## Output Format

The Lambda produces the same hierarchical JSON structure as the prototype:
```json
{
  "posts": [
    {
      "id": "...",
      "title": "...",
      "comments": [
        {
          "id": "...",
          "body": "...",
          "depth": 0,
          "replies": [
            {
              "id": "...",
              "depth": 1,
              "replies": [...]
            }
          ]
        }
      ]
    }
  ]
}
```

This ensures compatibility with downstream analysis components expecting the prototype's data format.

---

# Slack Collector Lambda

## Overview

The Slack Collector Lambda analyzes Slack workspace data for internal team insights, including user engagement patterns, channel discussions, feature requests, and sentiment analysis. It is based on the validated prototype from `/infra/prototype/slack/slack_user_analyzer.py`.

**Key Differences from Reddit/Twitter Collectors:**
- Performs AI analysis **inline** (uses Amazon Bedrock Claude Sonnet 4.5 directly in Lambda)
- Stores results in dedicated `supio-slack-profiles` DynamoDB table
- Does not flow through Analyzer/Storer pipeline
- Focus: Internal team analytics vs. external community feedback

## Core Features Implemented

### 1. **Slack User Analysis**
- Analyzes individual team members' Slack activity across channels
- Extracts:
  - Interests and focus areas
  - Expertise areas and knowledge domains
  - Communication style and patterns
  - Key opinions and perspectives
  - Pain points mentioned
  - Influence level (based on engagement metrics)
- Generates AI-powered persona summaries using Claude

### 2. **Slack Channel Analysis**
- Analyzes channel discussions for strategic insights
- Extracts:
  - Key topics and themes
  - Feature requests from team conversations
  - Pain points and blockers
  - Sentiment analysis (positive/neutral/negative)
  - Key contributors and their engagement levels
  - Product opportunities
  - Strategic recommendations

### 3. **Slack API Integration**
- Uses Slack SDK for Python (`slack-sdk`)
- Fetches messages from channels with pagination
- Resolves user information (email, name, display name)
- Handles both public and private channels (when bot is invited)
- Respects Slack API rate limits

### 4. **AI-Powered Analysis**
- Uses Amazon Bedrock Claude Sonnet 4.5: `us.anthropic.claude-sonnet-4-20250514-v1:0`
- Structured prompts for user profiling and channel analysis
- Token usage tracking for cost monitoring
- Retry logic with exponential backoff

### 5. **Data Storage**
- **S3**: Raw analysis results stored as JSON
  - Path: `s3://bucket/slack/YYYY-MM-DD/{TYPE}_{ID}.json`
- **DynamoDB**: Processed profiles stored in `supio-slack-profiles` table
  - PK: `USER#{user_id}` or `CHANNEL#{channel_id}`
  - SK: `WORKSPACE#{workspace_id}`
  - TTL: 180 days (auto-cleanup)
  - GSI: `WorkspaceIndex` for workspace-wide queries

## Migration from Prototype

### What's Preserved from Prototype

**Keep As-Is:**
- All analysis logic in `SlackUserAnalyzer` class
- All AI prompts in `BedrockContentAnalyzer` class
- Message collection and pagination logic
- Rate limiting and retry logic
- Data extraction and formatting
- User/channel resolution logic

**Adapt for Lambda:**
- Remove CLI argument parsing (`argparse`)
- Replace `print()` statements with `logger.info()` for CloudWatch
- Add S3 storage for raw data
- Add DynamoDB storage for profiles
- Return JSON response instead of printing to console
- Use environment variables for configuration
- Lambda handler event/response format

### Key Classes Migrated

1. **SlackUserAnalyzer** → `lambda/collector/slack/slack_analyzer.py`
   - Main analysis orchestration
   - Message collection from channels
   - User activity aggregation
   - Channel breakdown generation

2. **BedrockContentAnalyzer** → `lambda/collector/slack/bedrock_client.py`
   - Claude API integration
   - Prompt engineering for user/channel analysis
   - Token usage tracking
   - Retry logic with exponential backoff

3. **Data Storage** → `lambda/collector/slack/data_storage.py` (NEW)
   - S3 upload utilities
   - DynamoDB write operations
   - TTL calculation (180 days)
   - Query utilities for retrieving profiles

4. **Data Models** → `lambda/collector/slack/models.py` (NEW)
   - Pydantic models for type safety
   - `SlackUserProfile`
   - `SlackChannelSummary`
   - `LambdaInput` and `LambdaOutput`

## Lambda Configuration

### Environment Variables

```python
SLACK_BOT_TOKEN = os.environ['SLACK_BOT_TOKEN']  # From CDK context parameter
BUCKET_NAME = os.environ['BUCKET_NAME']  # S3 bucket for raw data
SLACK_PROFILES_TABLE = os.environ['SLACK_PROFILES_TABLE']  # DynamoDB table name
AWS_BEDROCK_REGION = os.environ.get('AWS_BEDROCK_REGION', 'us-west-2')
```

### Input Event Schema

```json
{
  "analysis_type": "user",
  "user_email": "user@example.com",
  "user_id": "U123456789",
  "days": 30,
  "workspace_id": "T123456789"
}
```

**Parameters:**
- `analysis_type` (required): `"user"` or `"channel"` or `"workspace"`
- `user_email` (optional): For user analysis (either email or user_id required)
- `user_id` (optional): Slack user ID (either email or user_id required)
- `channel_name` (optional): For channel analysis (either name or channel_id required)
- `channel_id` (optional): Slack channel ID (either name or channel_id required)
- `days` (optional): Analysis period in days (default: 30)
- `workspace_id` (optional): Slack workspace ID (default: from token)

### Output Response Schema

```json
{
  "platform": "slack",
  "analysis_type": "user",
  "s3_location": "s3://bucket/slack/2025-01-16/USER_U123456789.json",
  "workspace_id": "T123456789",
  "status": "success",
  "metadata": {
    "user_id": "U123456789",
    "user_email": "user@example.com",
    "messages_analyzed": 342,
    "channels_analyzed": 8,
    "ai_tokens_used": 12500,
    "analysis_duration_seconds": 45
  }
}
```

## Dependencies

### Lambda Layer Requirements

```
slack-sdk>=3.27.1      # Slack API client
boto3>=1.28.0          # AWS SDK (S3, DynamoDB, Bedrock)
pydantic>=2.0.0        # Data validation and type safety
```

**Note:** `slack-sdk` is added to the existing Lambda layer that includes `praw` and `tweepy`.

## Deployment

### Using CDK Context Parameters

```bash
npx cdk deploy \
  --context redditClientId=YOUR_REDDIT_ID \
  --context redditClientSecret=YOUR_REDDIT_SECRET \
  --context twitterBearerToken=YOUR_TWITTER_TOKEN \
  --context slackBotToken=xoxb-YOUR-SLACK-TOKEN
```

### Lambda Timeout and Memory

- **Timeout**: 15 minutes (900 seconds)
  - User analysis: 2-5 minutes typical
  - Channel analysis: 1-3 minutes typical
- **Memory**: 2048 MB (higher memory for AI analysis via Bedrock)
- **Runtime**: Python 3.12

## DynamoDB Schema

### supio-slack-profiles Table

**Primary Key:**
- `PK` (String): `USER#{user_id}` or `CHANNEL#{channel_id}`
- `SK` (String): `WORKSPACE#{workspace_id}`

**Attributes:**
- `entity_type`: `"user_profile"` or `"channel_summary"`
- `user_id`, `user_email`, `user_name`, `display_name` (for users)
- `channel_id`, `channel_name`, `is_private`, `num_members` (for channels)
- `analysis_date`, `analysis_period_days`
- `total_messages`, `total_replies`, `total_activity` (for users)
- `messages_analyzed` (for channels)
- `interests`, `expertise_areas`, `key_opinions`, `pain_points` (JSON arrays)
- `channel_breakdown` (JSON array of channel activity)
- `key_topics`, `feature_requests`, `product_opportunities` (JSON arrays for channels)
- `sentiment`, `key_contributors` (for channels)
- `ai_insights`, `ai_persona_summary` (text)
- `ai_tokens_used`, `last_updated`, `ttl`

**Global Secondary Index:**
- `WorkspaceIndex`:
  - `workspace_id` (PK)
  - `last_updated` (SK)
  - Enables workspace-wide queries sorted by recency

## API Integration

### Trigger Analysis (via API Lambda)

The API Lambda invokes the Slack Collector Lambda asynchronously:

```python
lambda_client.invoke(
    FunctionName=os.environ['SLACK_COLLECTOR_FUNCTION_NAME'],
    InvocationType='Event',  # Async invocation
    Payload=json.dumps({
        'analysis_type': 'user',
        'user_email': 'user@example.com',
        'days': 30
    })
)
```

### Retrieve Results (via API Lambda)

The API Lambda queries DynamoDB directly:

```python
table = dynamodb.Table(os.environ['SLACK_PROFILES_TABLE_NAME'])
response = table.get_item(
    Key={
        'PK': f'USER#{user_id}',
        'SK': f'WORKSPACE#{workspace_id}'
    }
)
```

## Error Handling

### Common Error Scenarios

1. **Slack Token Invalid/Expired**
   - Error: `invalid_auth` or `token_revoked`
   - Action: Update CDK context parameter and redeploy

2. **User/Channel Not Found**
   - Error: `user_not_found` or `channel_not_found`
   - Action: Return 404 response with error message

3. **Bot Not in Channel**
   - Error: `not_in_channel`
   - Action: Return error instructing to invite bot to channel

4. **Bedrock API Throttling**
   - Error: `ThrottlingException`
   - Action: Exponential backoff retry (3 attempts)

5. **Lambda Timeout**
   - Risk: AI analysis takes longer than 15 minutes
   - Mitigation: Limit message analysis to configurable range (default: 30 days)

## Validation Checklist

✅ Slack SDK integration for message collection
✅ User profile analysis with AI insights
✅ Channel summary analysis with sentiment
✅ Amazon Bedrock integration (Claude Sonnet 4.5)
✅ S3 storage for raw data
✅ DynamoDB storage with TTL
✅ WorkspaceIndex GSI for efficient queries
✅ Error handling and retry logic
✅ CloudWatch logging for debugging
✅ Token usage tracking for cost monitoring

## Output Format Examples

### User Profile (DynamoDB Item)

```json
{
  "PK": "USER#U123456789",
  "SK": "WORKSPACE#T123456789",
  "entity_type": "user_profile",
  "user_id": "U123456789",
  "user_email": "john@example.com",
  "user_name": "john.doe",
  "display_name": "John Doe",
  "workspace_id": "T123456789",
  "total_channels": 15,
  "active_channels": 8,
  "total_messages": 342,
  "total_replies": 89,
  "total_activity": 431,
  "analysis_date": "2025-01-16",
  "analysis_period_days": 30,
  "interests": ["Product development", "AI/ML", "Customer feedback"],
  "expertise_areas": ["Machine learning", "API design", "Data analysis"],
  "communication_style": "Technical and detail-oriented",
  "key_opinions": ["Advocates for AI automation", "Prefers incremental releases"],
  "pain_points": ["Manual data entry", "Tool integration gaps"],
  "influence_level": "high",
  "channel_breakdown": [
    {
      "channel_id": "C123456",
      "channel_name": "product",
      "message_count": 145,
      "reply_count": 42,
      "last_activity": "2025-01-15T10:30:00Z",
      "ai_summary": "Leads AI feature discussions"
    }
  ],
  "ai_insights": "John is a highly engaged technical leader...",
  "ai_persona_summary": "Technical Product Leader with AI/ML focus",
  "ai_tokens_used": 12500,
  "last_updated": 1705420800,
  "ttl": 1721006400
}
```

### Channel Summary (DynamoDB Item)

```json
{
  "PK": "CHANNEL#C123456789",
  "SK": "WORKSPACE#T123456789",
  "entity_type": "channel_summary",
  "channel_id": "C123456789",
  "channel_name": "product-feedback",
  "workspace_id": "T123456789",
  "is_private": false,
  "num_members": 42,
  "analysis_date": "2025-01-16",
  "analysis_period_days": 30,
  "messages_analyzed": 485,
  "channel_purpose": "Product feedback and feature requests",
  "key_topics": ["Medical records automation", "UI/UX improvements"],
  "feature_requests": ["Batch processing", "Mobile app", "CRM integrations"],
  "pain_points": ["Slow processing", "Manual data entry"],
  "sentiment": "positive",
  "key_contributors": [
    {"user_id": "U123", "user_name": "jane.product", "contribution_level": "high"}
  ],
  "product_opportunities": ["Build batch processing - high demand"],
  "strategic_recommendations": ["Prioritize batch processing feature"],
  "ai_summary": "Channel shows strong engagement around automation...",
  "ai_tokens_used": 15200,
  "last_updated": 1705420800,
  "ttl": 1721006400
}
```

## Comparison: Slack vs Reddit/Twitter Collectors

| Feature | Reddit/Twitter | Slack |
|---------|---------------|-------|
| **Data Source** | External communities | Internal workspace |
| **Analysis** | Via separate Analyzer Lambda | Inline with Bedrock |
| **Storage** | `supio-insights` table | `supio-slack-profiles` table |
| **Pipeline** | Collector → Analyzer → Storer | Collector → S3 + DynamoDB |
| **Focus** | Product-market insights | Team analytics |
| **Update Frequency** | Continuous crawling | On-demand analysis |
| **TTL** | 90 days | 180 days |
| **AI Model** | Claude (in Analyzer) | Claude (inline in Collector) |

This architecture separates external community insights (Reddit/Twitter) from internal team analytics (Slack) while maintaining a unified API interface.