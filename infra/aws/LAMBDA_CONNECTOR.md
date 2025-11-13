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

### 6. **Dynamic Bot Token Configuration** (Phase 1.7)
- Bot token can be configured dynamically via `/slack/config` API endpoint
- Configuration stored in DynamoDB `supio-system-config` table
- Lambda checks config table first, falls back to environment variable
- Enables runtime configuration without Lambda redeployment

**Bot Token Resolution Order:**
1. Check environment variable `SLACK_BOT_TOKEN`
2. If not set or "DISABLED", query config table with key `config_id='slack_settings'`
3. If config exists and has `bot_token`, use it
4. If no token found, return "Slack integration disabled" error

**Implementation** (`lambda/collector/slack/index.py`):
```python
# Try to get bot token from config table first
bot_token = SLACK_BOT_TOKEN
config_table_name = os.environ.get('CONFIG_TABLE_NAME', '')

if (not bot_token or bot_token == 'DISABLED') and config_table_name:
    try:
        dynamodb_resource = boto3.resource('dynamodb')
        config_table = dynamodb_resource.Table(config_table_name)
        response = config_table.get_item(Key={'config_id': 'slack_settings'})

        if 'Item' in response and response['Item'].get('bot_token'):
            bot_token = response['Item']['bot_token']
            logger.info("Using bot token from configuration table")
    except Exception as e:
        logger.warning(f"Could not load bot token from config table: {str(e)}")
```

## Phase 1 Revisions: Activity-Focused Analysis

### AI Prompt Changes (Phase 1.1-1.3)

The Slack integration AI prompts were revised to shift from **product management focus** to **personal activity and team engagement focus**.

#### User Analysis Prompts (Phase 1.1)
**File:** `lambda/collector/slack/bedrock_client.py` - `analyze_user_content()` method

**OLD Focus** (Product Manager):
- Core interests for product alignment
- Key opinions on product topics
- Expertise for team planning
- Product-related pain points

**NEW Focus** (Personal Activity):
- Daily/weekly activity summary
- Personal interests and hobbies
- Learning and growth areas
- Team collaboration patterns
- Current projects and responsibilities
- Communication preferences

**Updated Prompt** (Lines 166-179):
```python
prompt = f"""Analyze {user_name}'s recent activity in the Slack channel #{channel_name} to provide a personal activity summary.

Content ({len(messages)} messages, {len(replies)} replies):
{combined_content}

Provide a friendly, personal activity summary:
1. **Activity Overview**: Summarize their participation level and engagement in this channel
2. **Topics Discussed**: What topics and subjects did they discuss?
3. **Personal Interests**: What personal interests or professional passions are evident?
4. **Collaboration Style**: How do they interact with team members?
5. **Key Contributions**: What valuable insights or help did they provide?
6. **Current Focus**: What are they currently working on or thinking about?

Write in a friendly, supportive tone that helps team members understand each other better."""
```

**Updated System Prompt** (Line 181):
```python
system_prompt = "You are a friendly team collaboration assistant helping organization members understand each other's daily activities, interests, and contributions. Focus on personal growth, team dynamics, and mutual understanding rather than product management."
```

#### Channel Analysis Prompts (Phase 1.2)
**File:** `lambda/collector/slack/bedrock_client.py` - `analyze_channel_content()` method

**OLD Focus** (Product Insights):
- Feature requests extraction
- Product opportunities identification
- Strategic recommendations
- Roadmap prioritization

**NEW Focus** (Daily Digest):
- Daily conversation summary
- Participation levels and engagement
- Content highlights and interesting discussions
- Team collaboration patterns
- Knowledge sharing moments

**Updated Prompt** (Lines 235-249):
```python
prompt = f"""Provide a daily summary of conversations in the Slack channel #{channel_name}.

Messages (sample of {len(sampled_messages)} from {len(all_messages)} total):
{combined_content}

Provide a conversational daily digest:
1. **Channel Activity Overview**: Overall participation level and engagement in this period
2. **Main Discussion Topics**: What were the primary topics discussed?
3. **Interesting Highlights**: Notable conversations, insights, or memorable moments
4. **Active Participants**: Who contributed most to discussions?
5. **Helpful Content**: Useful information, tips, resources, or knowledge shared
6. **Team Mood**: What's the overall team sentiment and energy level?
7. **Ongoing Discussions**: Any topics that will continue or action items mentioned?

Write as a friendly daily digest that helps team members catch up on what they missed."""
```

**Updated System Prompt** (Line 251):
```python
system_prompt = "You are a friendly team collaboration assistant creating daily channel summaries. Focus on helping team members stay connected, catch up on discussions, and understand team dynamics. Write in a warm, conversational tone."
```

#### Overall Insights Generation (Phase 1.3)
**File:** `lambda/collector/slack/bedrock_client.py` - `generate_overall_insights()` method

**OLD Focus** (Professional Expertise):
- Cross-channel product focus
- Professional expertise profile
- Influence on product decisions

**NEW Focus** (Personal Activity):
- Daily activity across channels
- Personal growth and interests
- Team engagement patterns
- Work-life balance indicators

**Updated Prompt** (Lines 294-314):
```python
prompt = f"""Based on {user_name}'s recent activity across multiple Slack channels, create a friendly personal activity summary.

Activity Summary:
- Total Channels: {summary_stats.get('total_channels_joined', 0)}
- Active Channels: {summary_stats.get('active_channels', 0)}
- Total Messages: {summary_stats.get('total_messages', 0)}
- Total Replies: {summary_stats.get('total_replies', 0)}

Per-Channel Activities:
{combined_analyses}

Create a warm, personal activity summary:
1. **Activity Highlights**: What has {user_name} been up to recently? Summarize their main activities and contributions
2. **Areas of Interest**: What topics are they passionate about or actively exploring?
3. **Collaboration Highlights**: How have they helped or collaborated with teammates? Any notable interactions?
4. **Personal Growth**: What are they learning, exploring, or developing?
5. **Engagement Pattern**: When and where are they most active? What drives their participation?
6. **Team Connections**: Who do they interact with most frequently?
7. **Personal Summary**: Create a friendly 2-3 sentence description that captures their recent vibe, focus, and energy

Write as if you're a friendly colleague helping others understand what {user_name} is up to."""
```

### Data Model Enhancements (Phase 1.4-1.5)

**File:** `lambda/collector/slack/models.py`

**New User Profile Fields** (Phase 1.4):
```python
engagement_score: Optional[float] = None  # Calculated: activity / time_period
activity_trend: Optional[Literal['increasing', 'stable', 'decreasing']] = None
most_active_time: Optional[str] = None  # e.g., "9-11 AM" or "afternoon"
collaboration_network: Optional[List[dict]] = None  # Top collaborators with counts
recent_topics: Optional[List[str]] = None  # Topics from last 7 days
```

**New Channel Summary Fields** (Phase 1.5):
```python
daily_digest: Optional[str] = None  # New field for conversational summaries
highlights: Optional[List[dict]] = None  # Top messages: {author, text, timestamp, reactions}
participation_rate: Optional[float] = None  # Engagement percentage
topic_clusters: Optional[List[dict]] = None  # Grouped themes: {topic, count, messages}
activity_trend: Optional[Literal['up', 'stable', 'down']] = None
```

**Deprecated Fields** (Kept for backward compatibility):
```python
feature_requests: Optional[List[str]] = []  # Product-focused
pain_points: Optional[List[str]] = []  # Product-focused
product_opportunities: Optional[List[str]] = []  # Product-focused
strategic_recommendations: Optional[List[str]] = []  # Product-focused
```

**TypeScript Type Updates** (`ui/src/types/index.ts`):
- All new Python fields mirrored in TypeScript interfaces
- `SlackUserProfile` interface includes activity-focused fields
- `SlackChannelSummary` interface includes daily digest fields

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
    "total_channels_in_workspace": 152,
    "channels_analyzed": 20,
    "channels_skipped": 132,
    "messages_analyzed": 342,
    "replies_analyzed": 156,
    "active_channels": 15,
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

### Timeout Prevention Strategy

**Issue:** Users in many channels (>50) could cause Lambda timeout before data is saved to DynamoDB.

**Solution Implemented:**
1. **Channel Limiting**: Analyze only the top 20 most active channels (sorted by member count)
2. **Early Sorting**: Channels are sorted and limited BEFORE message fetching (not after)
3. **Metadata Tracking**: Response includes total channels, analyzed, and skipped counts

**Code Implementation** (`index.py` lines 132-143):
```python
# Sort channels by activity and limit to prevent timeout
channels_sorted = sorted(channels, key=lambda ch: ch.get('num_members', 0), reverse=True)
max_channels = 20  # Limit to 20 for better coverage
limited_channels = channels_sorted[:max_channels]

if len(channels) > max_channels:
    logger.info(f"Limiting analysis to top {max_channels} channels (out of {len(channels)} total)")

# Get messages and replies from LIMITED channels only
user_messages = slack_analyzer.get_user_messages(user_id, limited_channels, days=...)
user_replies = slack_analyzer.get_user_replies(user_id, limited_channels, days=...)
```

**Impact:**
- ✅ Prevents timeout for users with 150+ channels
- ✅ Guarantees data is saved to DynamoDB
- ✅ Covers most active channels (where users are most engaged)
- ✅ Analysis completes in <5 minutes even for heavy users
- ℹ️ Skipped channels are logged and tracked in metadata

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

The API Lambda invokes the Slack Collector Lambda asynchronously with job tracking:

```python
# Generate job ID
job_id = str(uuid.uuid4())

# Create job record in supio-slack-jobs table
jobs_table.put_item(Item={
    'job_id': job_id,
    'status': 'pending',
    'analysis_type': 'user',
    'user_email': 'user@example.com',
    'workspace_id': 'default',
    'created_at': int(time.time()),
    'updated_at': int(time.time()),
    'ttl': int(time.time()) + (7 * 24 * 60 * 60)  # 7 days
})

# Invoke collector Lambda
lambda_client.invoke(
    FunctionName=os.environ['SLACK_COLLECTOR_FUNCTION_NAME'],
    InvocationType='Event',  # Async invocation
    Payload=json.dumps({
        'job_id': job_id,  # Pass job_id to collector
        'analysis_type': 'user',
        'user_email': 'user@example.com',
        'days': 30
    })
)

# Return job_id to caller
return {'job_id': job_id, 'message': 'User analysis started'}
```

### Job Status Tracking

The system tracks job progress through the `supio-slack-jobs` DynamoDB table:

**Job Lifecycle:**
1. **API Lambda** creates job with status `pending`
2. **Collector Lambda** updates to `processing` when analysis starts
3. **Collector Lambda** updates to `completed` (with result_location) or `failed` (with error_message)

**Job Status Endpoint:**
```python
# GET /slack/jobs/{job_id}/status
jobs_table = dynamodb.Table(os.environ['SLACK_JOBS_TABLE_NAME'])
response = jobs_table.get_item(Key={'job_id': job_id})
```

**Status Updates in Collector Lambda:**
```python
# At start of analysis
update_job_status(jobs_table, job_id, 'processing')

# On success
update_job_status(
    jobs_table,
    job_id,
    'completed',
    result_location=result['s3_location'],
    user_id=result['metadata']['user_id']
)

# On error
update_job_status(jobs_table, job_id, 'failed', error=str(e))
```

**Job Table Schema:**
- `job_id` (PK): UUID
- `status`: pending | processing | completed | failed
- `analysis_type`: user | channel
- `user_id`, `user_email`, `channel_id` (optional, indexed via UserIndex GSI)
- `workspace_id`: Workspace identifier
- `created_at`, `updated_at`: Unix timestamps
- `error_message`: Error details (if failed)
- `result_location`: S3 path (if completed)
- `ttl`: Auto-cleanup after 7 days

**Benefits:**
- Real-time progress visibility
- Better error handling
- Prevents duplicate analysis triggers
- Enables frontend polling and automatic refresh

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