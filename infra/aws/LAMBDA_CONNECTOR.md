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
  "subreddits": ["LawFirm", "Lawyertalk", "legaltech"],
  "keywords": ["Supio", "Harvey", "Casetext", ...],
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