# Multi-Source Legal Tech Intelligence API Integration Guide

## Overview

The Legal Tech Intelligence API provides REST endpoints for triggering and monitoring data collection from **multiple sources** (Reddit, Twitter/X, and Slack). The API supports parallel collection, platform filtering, and unified analytics across all platforms. This API is designed to be consumed by the Cloudflare Workers API Gateway and the Next.js frontend.

## Architecture

The API is implemented as a dedicated AWS Lambda function (`/infra/aws/lambda/api/index.py`) that integrates with:
- **AWS Step Functions** to orchestrate parallel multi-source collection pipeline (Reddit + Twitter + Slack)
- **DynamoDB** to read insights, manage system configuration, track platform sources, and store Slack profiles
- **CloudWatch** for execution logs and monitoring
- **Twitter API v2** via Tweepy for Twitter data collection
- **Reddit API** via PRAW for Reddit data collection
- **Slack API** via Slack SDK for internal team analysis

**Key Features:**
- Single Lambda function handles all 20 REST endpoints (14 existing + 6 Slack)
- **Multi-platform support**: Collect from Reddit, Twitter, and Slack in parallel
- **Platform filtering**: Filter insights and analytics by source platform
- **Platform metadata**: Track platform-specific metrics (Reddit scores, Twitter engagement)
- Python 3.12 runtime with shared dependencies layer (tweepy + praw)
- Configuration persistence in DynamoDB `supio-system-config` table
- Default configuration values with override capability
- Comprehensive error handling and CORS support

## API Endpoints

### Base URL
After deployment, the API will be available at:
```
https://{api-id}.execute-api.{region}.amazonaws.com/v1/
```

### Authentication
The API uses API Key authentication. Include the API key in the `X-API-Key` header:
```
X-API-Key: your-api-key-here
```

## Endpoints

### 1. GET / - API Documentation
Get API information and available endpoints.

**Response:**
```json
{
  "service": "Supio Reddit Legal Communities Crawler API",
  "version": "1.0",
  "endpoints": {
    "POST /trigger": "Start a new crawl job",
    "GET /status/{executionName}": "Check execution status",
    "GET /executions": "List recent executions",
    "GET /": "This documentation",
    "GET /insights": "List insights with filtering",
    "GET /insights/{insightId}": "Get single insight details",
    "GET /analytics/summary": "Analytics dashboard data",
    "GET /analytics/trends": "Historical trend analysis",
    "GET /analytics/competitors": "Competitive intelligence analysis",
    "DELETE /executions/{executionName}": "Cancel running job",
    "GET /logs/{executionName}": "Get execution logs",
    "GET /config": "Get system configuration",
    "PUT /config": "Update system configuration",
    "GET /health": "System health check",
    "POST /slack/analyze/user": "Trigger Slack user analysis (returns job_id)",
    "GET /slack/users/{user_id}": "Get Slack user profile",
    "GET /slack/users": "List Slack user profiles",
    "POST /slack/analyze/channel": "Trigger Slack channel analysis (returns job_id)",
    "GET /slack/channels/{channel_id}": "Get Slack channel summary",
    "GET /slack/channels": "List Slack channel summaries",
    "GET /slack/jobs/{job_id}/status": "Get job status (track analysis progress)"
  },
  "trigger_parameters": {
    "platforms": "array of platforms: reddit, twitter (optional, default: both)",
    "subreddits": "array of subreddit names (optional)",
    "crawl_type": "crawl, search, or both (optional)",
    "days_back": "number of days to look back (optional)",
    "twitter_config": "Twitter-specific configuration (optional)"
  }
}
```

### 2. POST /trigger - Start New Collection Job
Trigger a new data collection job from Reddit, Twitter, or both platforms with optional parameters.

**Platform Selection:**
- Omit `platforms` to collect from **both** Reddit and Twitter (default)
- Specify `platforms: ["reddit"]` for Reddit-only collection
- Specify `platforms: ["twitter"]` for Twitter-only collection

**Request Body Examples:**

**Example 1: Multi-Platform Collection (Reddit + Twitter)**
```json
{
  "platforms": ["reddit", "twitter"],
  "subreddits": ["LawFirm", "Lawyertalk", "legaltech"],
  "crawl_type": "both",
  "days_back": 3,
  "twitter_config": {
    "lookback_days": 7,
    "min_engagement": 5,
    "api_tier": "basic"
  }
}
```

**Example 2: Twitter-Only Collection**
```json
{
  "platforms": ["twitter"],
  "twitter_config": {
    "lookback_days": 7,
    "min_engagement": 10
  }
}
```

**Example 3: Reddit-Only Collection (Legacy Format)**
```json
{
  "subreddits": ["LawFirm", "Lawyertalk"],
  "crawl_type": "both",
  "days_back": 3
}
```

**Response:**
```json
{
  "message": "Crawl job started successfully",
  "executionArn": "arn:aws:states:us-east-1:123456789:execution:supio-reddit-insights-pipeline:manual-20250101-120000-abc12345",
  "executionName": "manual-20250101-120000-abc12345",
  "startDate": "2025-01-01T12:00:00.000000",
  "parameters": {
    "manual_trigger": true,
    "trigger_time": "2025-01-01T12:00:00.000000",
    "trigger_source": "api_gateway",
    "request_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
    "subreddits": ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"],
    "crawl_type": "both",
    "days_back": 3
  }
}
```

### 3. GET /status/{executionName} - Check Job Status
Check the status of a specific crawl job.

**Response:**
```json
{
  "executionArn": "arn:aws:states:us-east-1:123456789:execution:supio-reddit-insights-pipeline:manual-20250101-120000-abc12345",
  "status": "SUCCEEDED",
  "startDate": "2025-01-01T12:00:00.000000",
  "stopDate": "2025-01-01T12:15:30.000000",
  "input": {
    "manual_trigger": true,
    "trigger_time": "2025-01-01T12:00:00.000000",
    "subreddits": ["LawFirm", "Lawyertalk", "legaltech"]
  },
  "output": {
    "statusCode": 200,
    "posts_collected": 45,
    "comments_collected": 123,
    "s3_location": "s3://bucket/reddit/2025-01-01/crawl_20250101_120000.json"
  }
}
```

**Status Values:**
- `RUNNING` - Job is currently executing
- `SUCCEEDED` - Job completed successfully
- `FAILED` - Job failed
- `TIMED_OUT` - Job exceeded timeout limit
- `ABORTED` - Job was manually stopped

### 4. GET /executions - List Recent Jobs
Get a list of the 10 most recent crawl job executions.

**Response:**
```json
{
  "executions": [
    {
      "executionArn": "arn:aws:states:us-east-1:123456789:execution:supio-reddit-insights-pipeline:manual-20250101-120000-abc12345",
      "name": "manual-20250101-120000-abc12345",
      "status": "SUCCEEDED",
      "startDate": "2025-01-01T12:00:00.000000",
      "stopDate": "2025-01-01T12:15:30.000000"
    }
  ],
  "count": 1
}
```

### 5. GET /insights - List Insights with Filtering
Get filtered list of insights with pagination and analytics. Supports filtering by platform (Reddit, Twitter, or both).

**Query Parameters:**
- `platform` (optional): Filter by platform ("reddit" | "twitter" | omit for both)
- `priority_min` (optional): Minimum priority score (default: 0)
- `priority_max` (optional): Maximum priority score (default: 10)
- `category` (optional): Filter by feature category
- `user_segment` (optional): Filter by user segment
- `date_from` (optional): Start date filter (YYYY-MM-DD)
- `date_to` (optional): End date filter (YYYY-MM-DD)
- `limit` (optional): Number of results to return (default: 50, max: 100)

**Platform Filtering Examples:**
```bash
# Get Twitter insights only
GET /insights?platform=twitter&limit=10

# Get Reddit insights only
GET /insights?platform=reddit&limit=10

# Get all insights (both platforms)
GET /insights?limit=10
```

**Response:**
```json
{
  "data": [
    {
      "insight_id": "INSIGHT-2025-09-23-PRIORITY-8-ID-1nnv6yo",
      "post_id": "1nnv6yo",
      "priority_score": 8,
      "feature_summary": "Medical records chronology automation for personal injury cases",
      "feature_category": "medical_records_processing",
      "user_segment": "small_pi_firm",
      "source_type": "reddit",
      "subreddit": "LawFirm",
      "analyzed_at": "2025-09-23T17:44:42.643935",
      "action_required": true,
      "suggested_action": "Evaluate medical chronology automation for Q1 2026 roadmap",
      "competitors_mentioned": ["EvenUp", "Eve"],
      "platform_metadata": {
        "subreddit": "LawFirm",
        "post_score": 45,
        "upvote_ratio": 0.95,
        "flair": "Discussion"
      }
    },
    {
      "insight_id": "INSIGHT-2025-09-24-PRIORITY-9-ID-abc123",
      "post_id": "1234567890",
      "priority_score": 9,
      "feature_summary": "PI attorneys need faster medical record processing than EvenUp",
      "feature_category": "medical_records_processing",
      "user_segment": "small_pi_firm",
      "source_type": "twitter",
      "analyzed_at": "2025-09-24T10:30:00.000000",
      "action_required": true,
      "suggested_action": "Emphasize speed advantage over EvenUp in marketing",
      "competitors_mentioned": ["EvenUp"],
      "platform_metadata": {
        "tweet_id": "1234567890",
        "author_username": "pi_attorney_jane",
        "likes": 28,
        "retweets": 12,
        "replies": 5,
        "quotes": 2,
        "engagement_score": 40,
        "conversation_id": "1234567890",
        "language": "en"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "count": 25,
    "hasMore": false
  },
  "filters": {
    "platform": null,
    "priority_min": 5,
    "priority_max": 10,
    "category": "document_automation",
    "user_segment": null,
    "date_from": null,
    "date_to": null
  }
}
```

**New Fields in Response:**
- `source_type`: Platform source ("reddit" | "twitter")
- `platform_metadata`: Platform-specific data object
  - **For Reddit**: `subreddit`, `post_score`, `upvote_ratio`, `flair`
  - **For Twitter**: `tweet_id`, `author_username`, `likes`, `retweets`, `replies`, `quotes`, `engagement_score`, `conversation_id`, `language`

### 6. GET /insights/{insightId} - Get Single Insight Details
Get detailed information for a specific insight including full post content.

**Response:**
```json
{
  "data": {
    "insight_id": "INSIGHT-2025-09-23-PRIORITY-8-ID-1nnv6yo",
    "post_id": "1nnv6yo",
    "post_url": "https://reddit.com/r/LawFirm/comments/1nnv6yo/...",
    "subreddit": "LawFirm",
    "timestamp": 1758567337,
    "analyzed_at": "2025-09-23T17:44:42.643935",
    "collected_at": "2025-09-23T17:43:53.024140+00:00",
    "feature_summary": "Medical records chronology automation for personal injury cases",
    "feature_details": "PI attorney requesting AI-powered medical chronology generation from hundreds of pages of medical records...",
    "feature_category": "medical_records_processing",
    "priority_score": 9,
    "implementation_size": "large",
    "user_segment": "small_pi_firm",
    "ai_readiness": "high",
    "competitors_mentioned": ["EvenUp", "Eve"],
    "supio_mentioned": false,
    "competitive_advantage": "Faster medical chronology generation with better accuracy than EvenUp",
    "action_required": true,
    "suggested_action": "Evaluate medical records AI feasibility for Q1 2026 roadmap",
    "pain_points": ["Manual medical chronology creation", "8-20 hours per case", "Medical terminology comprehension"],
    "post_score": 45,
    "num_comments": 23
  }
}
```

### 7. GET /analytics/summary - Analytics Dashboard Data
Get aggregated analytics for dashboard and reporting. Supports filtering by platform to analyze Reddit or Twitter data separately.

**Query Parameters:**
- `platform` (optional): Filter by platform ("reddit" | "twitter" | omit for both)
- `period` (optional): Time period (7d, 30d, 90d) (default: 7d)
- `group_by` (optional): Comma-separated list of grouping fields (category, user_segment)

**Platform Filtering Examples:**
```bash
# Get Twitter-only analytics
GET /analytics/summary?platform=twitter&period=7d

# Get Reddit-only analytics
GET /analytics/summary?platform=reddit&period=30d

# Get combined analytics (both platforms)
GET /analytics/summary?period=7d
```

**Response:**
```json
{
  "data": {
    "period": "7d",
    "date_range": {
      "start": "2025-09-16",
      "end": "2025-09-23"
    },
    "total_insights": 127,
    "high_priority_insights": 23,
    "actionable_insights": 45,
    "avg_priority_score": 6.2,
    "by_category": {
      "medical_records_processing": {
        "count": 42,
        "avg_priority": 8.1
      },
      "demand_letter_automation": {
        "count": 35,
        "avg_priority": 7.8
      },
      "medical_chronology": {
        "count": 31,
        "avg_priority": 7.9
      }
    },
    "by_user_segment": {
      "small_pi_firm": {
        "count": 48,
        "avg_priority": 7.8
      },
      "solo_pi_attorney": {
        "count": 42,
        "avg_priority": 7.5
      },
      "mid_size_pi_firm": {
        "count": 37,
        "avg_priority": 7.2
      }
    },
    "top_competitors": {
      "EvenUp": 22,
      "Eve": 18
    },
    "recent_high_priority": [
      {
        "insight_id": "INSIGHT-2025-09-23-PRIORITY-9-ID-abc123",
        "priority_score": 9,
        "feature_summary": "AI-powered medical chronology automation for PI cases",
        "analyzed_at": "2025-09-23T15:30:00"
      }
    ]
  },
  "meta": {
    "generated_at": "2025-09-23T17:45:00.000Z",
    "items_analyzed": 127
  }
}
```

### 8. GET /config - Get System Configuration
Get current system configuration settings including crawl parameters, analysis settings, and system defaults.

**Configuration Persistence:**
- Configuration is stored in DynamoDB table `supio-system-config`
- Config item key: `config_id = "system_config"`
- If no saved config exists, returns default values
- POST /trigger automatically loads saved config and uses it as baseline

**Response:**
```json
{
  "crawl_settings": {
    "default_subreddits": ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"],
    "default_crawl_type": "both",
    "default_days_back": 3,
    "default_min_score": 10,
    "max_posts_per_crawl": 500,
    "twitter_enabled": true,
    "twitter_lookback_days": 7,
    "twitter_min_engagement": 5,
    "twitter_api_tier": "basic",
    "twitter_search_queries": [
      "legaltech OR (legal tech) OR #legaltech",
      "(personal injury attorney) OR (PI attorney) OR #PIlaw",
      "Supio OR EvenUp OR Eve medical records"
    ]
  },
  "analysis_settings": {
    "priority_threshold": 5,
    "ai_model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "analysis_timeout_seconds": 30,
    "max_retries": 3
  },
  "storage_settings": {
    "insights_ttl_days": 90,
    "max_insights_per_request": 100,
    "analytics_cache_ttl_minutes": 15
  },
  "system_settings": {
    "api_version": "1.0",
    "environment": "production",
    "maintenance_mode": false,
    "rate_limit_per_minute": 60
  }
}
```

**New Twitter Configuration Fields:**
- `twitter_enabled`: Enable/disable Twitter collection (boolean)
- `twitter_lookback_days`: Days to look back for Twitter collection (number, default: 7)
- `twitter_min_engagement`: Minimum likes + retweets threshold (number, default: 5)
- `twitter_api_tier`: Twitter API tier ("free" | "basic" | "pro", default: "basic")
- `twitter_search_queries`: Array of Twitter search queries (array of strings)

**Default Values (Hardcoded in Lambda):**
- These defaults are returned if no configuration is saved in DynamoDB
- Defined in `/infra/aws/lambda/api/index.py` as constants

### 9. PUT /config - Update System Configuration
Update system configuration settings. Configuration is persisted to DynamoDB and will be automatically loaded on the next crawl trigger.

**Configuration Persistence Flow:**
1. PUT /config saves new settings to DynamoDB `supio-system-config` table
2. POST /trigger loads saved config from DynamoDB
3. Trigger request body can still override saved config for one-time adjustments
4. EventBridge scheduled runs also use saved configuration

**Request Body:**
```json
{
  "crawl_settings": {
    "default_days_back": 5,
    "default_subreddits": ["LawFirm", "Lawyertalk", "legaltech"]
  },
  "system_settings": {
    "maintenance_mode": false
  }
}
```

**Implementation Notes:**
- Configuration is merged with existing values (partial updates supported)
- DynamoDB item structure: `{config_id: "system_config", config: {...}, updated_at: timestamp}`
- Invalid sections return 400 error
- Valid sections: crawl_settings, analysis_settings, storage_settings, system_settings

**Response:**
```json
{
  "message": "Configuration updated successfully",
  "updated_sections": ["crawl_settings", "system_settings"],
  "timestamp": "2025-09-23T17:45:00.000Z",
  "updated_by": "api_user"
}
```

**Error Response (400):**
```json
{
  "error": "Invalid configuration section: invalid_section"
}
```

### 10. GET /health - System Health Check
Comprehensive system health check including database connectivity, AI service status, and performance metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-23T17:45:00.000Z",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "response_time_ms": 50
    },
    "storage": {
      "status": "healthy",
      "response_time_ms": 25
    },
    "ai_service": {
      "status": "healthy",
      "response_time_ms": 150
    },
    "pipeline": {
      "status": "healthy",
      "last_execution": "2025-09-23T16:30:00.000Z"
    }
  },
  "metrics": {
    "total_requests": 1250,
    "error_rate": 0.02,
    "avg_response_time_ms": 125,
    "active_executions": 0
  },
  "resources": {
    "memory_usage_percent": 45,
    "cpu_usage_percent": 12,
    "disk_usage_percent": 23
  }
}
```

**Health Status Values:**
- `healthy` - All systems operational
- `degraded` - Some non-critical systems experiencing issues
- `unhealthy` - Critical systems failing

### 11. GET /analytics/trends - Historical Trend Analysis
Get historical trend analysis for strategic planning and forecasting.

**Query Parameters:**
- `metric` (optional): Metric to analyze (priority_score, insights_count, avg_score) (default: priority_score)
- `period` (optional): Time period (7d, 30d, 90d) (default: 30d)
- `group_by` (optional): Grouping interval (day, week, month) (default: day)

**Response:**
```json
{
  "data": {
    "metric": "priority_score",
    "period": "30d",
    "group_by": "day",
    "date_range": {
      "start": "2025-08-25",
      "end": "2025-09-24"
    },
    "trend_points": [
      {
        "date": "2025-09-20",
        "value": 7.2,
        "count": 15
      },
      {
        "date": "2025-09-21",
        "value": 6.8,
        "count": 12
      }
    ],
    "summary": {
      "trend_direction": "increasing",
      "volatility": 2.4,
      "total_data_points": 30,
      "avg_value": 6.9
    }
  },
  "meta": {
    "generated_at": "2025-09-24T02:15:00.000Z",
    "total_insights_analyzed": 450
  }
}
```

### 12. GET /analytics/competitors - Competitive Intelligence Analysis
Get competitive analysis and market positioning insights for strategic decision making.

**Query Parameters:**
- `competitor` (optional): Filter by specific competitor name
- `sentiment` (optional): Filter by sentiment (positive, negative, neutral)
- `limit` (optional): Number of results to return (default: 50, max: 100)

**Response:**
```json
{
  "data": {
    "competitors": [
      {
        "name": "EvenUp",
        "total_mentions": 32,
        "avg_priority": 8.2,
        "categories": {
          "medical_records_processing": 22,
          "demand_letter_automation": 15,
          "medical_chronology": 10
        },
        "user_segments": {
          "small_pi_firm": 18,
          "solo_pi_attorney": 10,
          "mid_size_pi_firm": 4
        },
        "sentiment_breakdown": {
          "positive": 8,
          "negative": 20,
          "neutral": 4
        },
        "insights": [
          {
            "insight_id": "INSIGHT-2025-09-23-PRIORITY-9-ID-abc123",
            "priority_score": 9,
            "feature_summary": "PI attorneys want EvenUp-like medical chronology but faster and more accurate",
            "competitive_advantage": "Faster medical chronology generation with better medical terminology extraction than EvenUp",
            "analyzed_at": "2025-09-23T15:30:00",
            "subreddit": "LawFirm"
          }
        ]
      }
    ],
    "market_analysis": {
      "market_leader": "EvenUp",
      "total_competitors_mentioned": 6,
      "avg_mentions_per_competitor": 18.5,
      "most_discussed_categories": {
        "medical_records_processing": 58,
        "demand_letter_automation": 42,
        "medical_chronology": 35
      }
    }
  },
  "filters": {
    "competitor": null,
    "sentiment": "positive",
    "limit": 50
  },
  "meta": {
    "generated_at": "2025-09-24T02:15:00.000Z",
    "total_insights_analyzed": 450
  }
}
```

### 13. DELETE /executions/{executionName} - Cancel Running Job
Cancel a running crawl job execution for operational control and resource management.

**Response (Success):**
```json
{
  "message": "Execution cancellation requested successfully",
  "executionArn": "arn:aws:states:us-east-1:123456789:execution:supio-reddit-insights-pipeline:manual-20250923-021621-e5cff012",
  "executionName": "manual-20250923-021621-e5cff012",
  "stopDate": "2025-09-24T02:15:30.000Z",
  "previous_status": "RUNNING",
  "new_status": "ABORTED"
}
```

**Error Response (409 - Cannot Cancel):**
```json
{
  "error": "Cannot cancel execution",
  "message": "Execution is already in terminal state: SUCCEEDED",
  "current_status": "SUCCEEDED"
}
```

**Error Response (404 - Not Found):**
```json
{
  "error": "Execution not found"
}
```

### 14. GET /logs/{executionName} - Get Execution Logs
Get detailed execution logs for debugging, troubleshooting, and operational visibility.

**Query Parameters:**
- `level` (optional): Log level filter (DEBUG, INFO, WARN, ERROR, ALL) (default: INFO)
- `limit` (optional): Number of log entries to return (default: 100, max: 1000)
- `start_time` (optional): ISO timestamp to start from

**Response:**
```json
{
  "data": {
    "execution_name": "manual-20250923-021621-e5cff012",
    "execution_arn": "arn:aws:states:us-east-1:123456789:execution:supio-reddit-insights-pipeline:manual-20250923-021621-e5cff012",
    "execution_status": "SUCCEEDED",
    "logs": [
      {
        "timestamp": "2025-09-23T02:19:48.000Z",
        "level": "INFO",
        "event_type": "ExecutionSucceeded",
        "message": "Execution completed successfully",
        "details": {
          "output": "{\"statusCode\": 200, \"insights_stored\": 15}"
        }
      },
      {
        "timestamp": "2025-09-23T02:18:30.000Z",
        "level": "INFO",
        "event_type": "TaskStateExited",
        "message": "Exited state: StoreInsights",
        "details": {
          "name": "StoreInsights"
        }
      },
      {
        "timestamp": "2025-09-23T02:16:21.000Z",
        "level": "INFO",
        "event_type": "ExecutionStarted",
        "message": "Execution started",
        "details": {
          "input": "{\"manual_trigger\": true, \"subreddits\": [\"legaladvice\"]}"
        }
      }
    ],
    "log_summary": {
      "total_events": 25,
      "filtered_logs": 15,
      "error_count": 0,
      "execution_duration": null
    }
  },
  "filters": {
    "level": "INFO",
    "limit": 100,
    "start_time": null
  },
  "meta": {
    "generated_at": "2025-09-24T02:15:00.000Z"
  }
}
```

**Error Response (404 - Execution Not Found):**
```json
{
  "error": "Execution not found"
}
```

## Slack API Endpoints

The API provides endpoints for analyzing Slack workspace data to gain insights into internal team communication, user engagement, and channel activity. These endpoints enable **internal team analytics** separate from external community insights (Reddit/Twitter).

### 15. POST /slack/analyze/user - Trigger Slack User Analysis

Analyze a Slack user's interests, opinions, expertise areas, and engagement patterns across channels.

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "user_id": "U123456789",
  "days": 30,
  "workspace_id": "T123456789"
}
```

**Parameters:**
- `user_email` (optional): User's email address (either email or user_id required)
- `user_id` (optional): Slack user ID (either email or user_id required)
- `days` (optional): Number of days to analyze (default: 30)
- `workspace_id` (optional): Slack workspace ID (default: configured workspace)

**Response:** `202 Accepted`
```json
{
  "message": "User analysis started",
  "job_id": "51203e3a-8a2e-483d-a7b2-d0f198c6d4cf",
  "request_id": "abc-123",
  "user_id": "U123456789",
  "user_email": "john@example.com",
  "estimated_completion": "2-5 minutes"
}
```

**Response Fields:**
- `job_id`: UUID for tracking analysis progress (use with `/slack/jobs/{job_id}/status`)
- `message`: Confirmation message
- `request_id`: API Gateway request ID
- `estimated_completion`: Expected time to complete

**Use Case:** Understand individual team member's focus areas, expertise, communication patterns, and pain points for better team alignment and resource allocation.

### 16. GET /slack/users/{user_id} - Get Slack User Profile

Get detailed profile and analysis for a specific Slack user.

**Path Parameters:**
- `user_id`: Slack user ID (e.g., U123456789)

**Query Parameters:**
- `workspace_id` (optional): Slack workspace ID (default: configured workspace)

**Response:** `200 OK`
```json
{
  "user_id": "U123456789",
  "workspace_id": "T123456789",
  "user_email": "john@example.com",
  "user_name": "john.doe",
  "display_name": "John Doe",
  "total_channels": 15,
  "active_channels": 8,
  "total_messages": 342,
  "total_replies": 89,
  "total_activity": 431,
  "analysis_date": "2025-01-16",
  "analysis_period_days": 30,
  "interests": [
    "Product development",
    "AI/ML integration",
    "Customer feedback analysis"
  ],
  "expertise_areas": [
    "Machine learning",
    "API design",
    "Data analysis"
  ],
  "communication_style": "Technical and detail-oriented, prefers data-driven discussions",
  "key_opinions": [
    "Advocates for AI-powered automation in medical records processing",
    "Prefers incremental releases over big-bang deployments"
  ],
  "pain_points": [
    "Manual data entry processes",
    "Lack of integration between tools",
    "Slow customer feedback loops"
  ],
  "influence_level": "high",
  "channel_breakdown": [
    {
      "channel_id": "C123456",
      "channel_name": "product",
      "message_count": 145,
      "reply_count": 42,
      "last_activity": "2025-01-15T10:30:00Z",
      "ai_summary": "Leads discussions on AI feature roadmap and medical records automation"
    }
  ],
  "ai_insights": "John is a highly engaged technical leader...",
  "ai_persona_summary": "Technical Product Leader with AI/ML focus...",
  "ai_tokens_used": 12500,
  "last_updated": 1705420800
}
```

**Error Response (404):**
```json
{
  "error": "User profile not found"
}
```

### 17. GET /slack/users - List Slack User Profiles

List all analyzed Slack user profiles with optional filtering.

**Query Parameters:**
- `workspace_id` (optional): Filter by workspace ID (default: configured workspace)
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `influence_level` (optional): Filter by influence level (high, medium, low)
- `sort_by` (optional): Sort by field (activity, last_updated, influence_level) (default: last_updated)

**Response:** `200 OK`
```json
{
  "users": [
    {
      "user_id": "U123456789",
      "user_name": "john.doe",
      "display_name": "John Doe",
      "user_email": "john@example.com",
      "total_activity": 431,
      "influence_level": "high",
      "active_channels": 8,
      "last_updated": 1705420800,
      "top_interests": ["Product development", "AI/ML integration"]
    }
  ],
  "count": 15,
  "workspace_id": "T123456789"
}
```

### 18. POST /slack/analyze/channel - Trigger Slack Channel Analysis

Analyze a Slack channel for key topics, feature requests, pain points, sentiment, and product opportunities.

**Request Body:**
```json
{
  "channel_name": "general",
  "channel_id": "C123456789",
  "days": 30,
  "workspace_id": "T123456789"
}
```

**Parameters:**
- `channel_name` (optional): Channel name without # (either name or id required)
- `channel_id` (optional): Slack channel ID (either name or id required)
- `days` (optional): Number of days to analyze (default: 30)
- `workspace_id` (optional): Slack workspace ID (default: configured workspace)

**Response:** `202 Accepted`
```json
{
  "message": "Channel analysis started",
  "job_id": "a6407166-97b7-4913-9b87-6ff33a7b63f3",
  "request_id": "def-456",
  "channel_id": "C123456789",
  "channel_name": "general",
  "estimated_completion": "1-3 minutes"
}
```

**Response Fields:**
- `job_id`: UUID for tracking analysis progress (use with `/slack/jobs/{job_id}/status`)
- `message`: Confirmation message
- `request_id`: API Gateway request ID
- `estimated_completion`: Expected time to complete

**Use Case:** Understand channel-specific discussions, identify feature requests, gauge team sentiment, and discover product opportunities from internal conversations.

### 19. GET /slack/channels/{channel_id} - Get Slack Channel Summary

Get detailed analysis and insights for a specific Slack channel.

**Path Parameters:**
- `channel_id`: Slack channel ID (e.g., C123456789)

**Query Parameters:**
- `workspace_id` (optional): Slack workspace ID (default: configured workspace)

**Response:** `200 OK`
```json
{
  "channel_id": "C123456789",
  "workspace_id": "T123456789",
  "channel_name": "product-feedback",
  "is_private": false,
  "num_members": 42,
  "analysis_date": "2025-01-16",
  "analysis_period_days": 30,
  "messages_analyzed": 485,
  "channel_purpose": "Product feedback and feature requests from internal team",
  "key_topics": [
    "Medical records automation",
    "UI/UX improvements",
    "Integration requests",
    "Performance optimization"
  ],
  "feature_requests": [
    "Batch processing for medical chronologies",
    "Custom report templates",
    "Mobile app for attorneys",
    "Integration with CaseManagement Pro"
  ],
  "pain_points": [
    "Slow processing time for large document sets",
    "Manual data entry for patient information",
    "Limited export format options"
  ],
  "sentiment": "positive",
  "key_contributors": [
    {
      "user_id": "U123456",
      "user_name": "jane.product",
      "contribution_level": "high"
    }
  ],
  "product_opportunities": [
    "Build batch processing feature - high demand from sales team",
    "Develop mobile app - attorneys want on-the-go access",
    "Create integrations marketplace - multiple CRM requests"
  ],
  "strategic_recommendations": [
    "Prioritize batch processing - mentioned in 23 messages",
    "Survey team on mobile app requirements",
    "Evaluate CaseManagement Pro integration ROI"
  ],
  "ai_summary": "The product-feedback channel shows strong engagement...",
  "ai_tokens_used": 15200,
  "last_updated": 1705420800
}
```

**Error Response (404):**
```json
{
  "error": "Channel summary not found"
}
```

### 20. GET /slack/channels - List Slack Channel Summaries

List all analyzed Slack channel summaries with optional filtering.

**Query Parameters:**
- `workspace_id` (optional): Filter by workspace ID (default: configured workspace)
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `sentiment` (optional): Filter by sentiment (positive, neutral, negative)
- `sort_by` (optional): Sort by field (messages_analyzed, last_updated, num_members) (default: last_updated)

**Response:** `200 OK`
```json
{
  "channels": [
    {
      "channel_id": "C123456789",
      "channel_name": "product-feedback",
      "is_private": false,
      "num_members": 42,
      "messages_analyzed": 485,
      "sentiment": "positive",
      "key_topics": ["Medical records automation", "UI/UX improvements"],
      "feature_requests_count": 15,
      "last_updated": 1705420800
    }
  ],
  "count": 8,
  "workspace_id": "T123456789"
}
```

### 21. GET /slack/jobs/{job_id}/status - Get Job Status

Get the current status of an asynchronous Slack analysis job.

**Path Parameters:**
- `job_id`: UUID of the analysis job (returned from analyze endpoints)

**Response:** `200 OK`
```json
{
  "job_id": "51203e3a-8a2e-483d-a7b2-d0f198c6d4cf",
  "status": "processing",
  "analysis_type": "user",
  "user_id": "U123456789",
  "user_email": "john@example.com",
  "channel_id": null,
  "workspace_id": "T123456789",
  "created_at": 1762928958,
  "updated_at": 1762928961,
  "error_message": null,
  "result_location": "s3://bucket/slack/2025-01-12/USER_U123456789.json"
}
```

**Job Status Values:**
- `pending`: Job created, waiting to start
- `processing`: Analysis in progress (Collector Lambda running)
- `completed`: Analysis finished successfully, data available
- `failed`: Analysis failed (see error_message for details)

**Error Response (404 - Job Not Found):**
```json
{
  "error": "Job not found"
}
```

**Use Case:** Poll this endpoint to track analysis progress. Recommended polling interval: 5 seconds. Frontend should stop polling when status reaches `completed` or `failed`.

### Slack Analysis Workflow

**Typical Usage Pattern (With Job Tracking):**
1. Trigger analysis: `POST /slack/analyze/user` or `POST /slack/analyze/channel`
2. Receive `job_id` in response
3. Poll status: `GET /slack/jobs/{job_id}/status` every 5 seconds
4. When status = `completed`, retrieve results: `GET /slack/users/{user_id}` or `GET /slack/channels/{channel_id}`
5. Browse all profiles: `GET /slack/users` or `GET /slack/channels`

**Legacy Usage (Without Job Tracking):**
1. Trigger analysis: `POST /slack/analyze/user` or `POST /slack/analyze/channel`
2. Wait 1-5 minutes for AI analysis to complete
3. Retrieve results: `GET /slack/users/{user_id}` or `GET /slack/channels/{channel_id}`
4. Browse all profiles: `GET /slack/users` or `GET /slack/channels`

**Re-analysis:**
- Slack profiles and channel summaries are cached in DynamoDB with 180-day TTL
- Re-trigger analysis to get fresh insights after significant time has passed
- Useful for tracking changes in user interests or channel sentiment over time

**Job Tracking Benefits:**
- Real-time progress visibility for users
- Better error handling and reporting
- Prevents users from repeatedly triggering analysis
- Enables automatic data refresh on completion

## Multi-Platform Support

### Platform Architecture

The API supports collecting and analyzing data from multiple platforms simultaneously:

1. **Parallel Collection**: Reddit, Twitter, and Slack collectors run in parallel via Step Functions
2. **Unified Format**: All platforms convert to unified data format for analysis
3. **Platform Tracking**: Each insight tagged with `source_type` field
4. **Platform Filtering**: Filter insights and analytics by platform
5. **Dedicated Storage**: Slack data stored in separate `supio-slack-profiles` DynamoDB table

### Platform-Specific Behavior

**Reddit:**
- Uses PRAW (Python Reddit API Wrapper)
- Collects from specified subreddits
- Tracks: post_score, upvote_ratio, subreddit, flair
- Rate limit: Reddit API limits (varies by app)
- Focus: External community feedback

**Twitter:**
- Uses Tweepy (Twitter API v2 client)
- Searches by queries (keywords, hashtags, mentions)
- Tracks: likes, retweets, replies, quotes, engagement_score
- Rate limit: Tier-dependent (Basic: 15 requests per 15 minutes)
- Timeout handling: Stops gracefully before Lambda timeout
- Focus: External community feedback

**Slack:**
- Uses Slack SDK (Python)
- Analyzes internal workspace conversations
- Tracks: user engagement, channel activity, interests, opinions
- Storage: Dedicated `supio-slack-profiles` DynamoDB table (separate from insights)
- TTL: 180 days for Slack profiles
- Rate limit: Slack API standard limits
- Focus: Internal team analytics

### Data Flow

```
POST /trigger {"platforms": ["reddit", "twitter", "slack"]}
    ↓
Step Functions: Parallel State
    ├─→ Reddit Collector Lambda → Analyzer → Storer → DynamoDB (supio-insights)
    ├─→ Twitter Collector Lambda → Analyzer → Storer → DynamoDB (supio-insights)
    └─→ Slack Collector Lambda → S3 + DynamoDB (supio-slack-profiles)
        ↓
    Results aggregated
        ↓
GET /insights?platform=twitter (external insights)
GET /slack/users (internal analytics)
```

**Note:** Slack data flows directly to `supio-slack-profiles` table, bypassing the analyzer/storer pipeline since analysis is performed inline by the Slack Collector Lambda using Amazon Bedrock.

### Platform Filtering Best Practices

**When to filter by platform:**
- Comparing Reddit vs Twitter engagement
- Platform-specific analytics
- Troubleshooting collection issues
- Understanding source distribution

**When to use combined view:**
- Overall market intelligence
- Comprehensive competitor analysis
- Trend analysis across all channels
- Total insight counts

## Cloudflare Workers Integration Example

Here's how to integrate this API into your Cloudflare Workers:

```typescript
// types/crawler.ts
export type Platform = 'reddit' | 'twitter';

export interface CrawlTriggerRequest {
  platforms?: Platform[];  // New: Platform selection (default: both)
  subreddits?: string[];
  crawl_type?: 'crawl' | 'search' | 'both';
  days_back?: number;
  twitter_config?: TwitterConfig;  // New: Twitter-specific config
}

export interface TwitterConfig {
  lookback_days?: number;
  min_engagement?: number;
  api_tier?: 'free' | 'basic' | 'pro';
  max_tweets_per_query?: number;
}

export interface CrawlTriggerResponse {
  message: string;
  executionArn: string;
  executionName: string;
  startDate: string;
  parameters: any;
}

export interface CrawlStatusResponse {
  executionArn: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  startDate: string;
  stopDate?: string;
  input: any;
  output?: any;
}

export interface InsightsListResponse {
  data: InsightSummary[];
  pagination: {
    limit: number;
    count: number;
    hasMore: boolean;
  };
  filters: {
    priority_min?: number;
    priority_max?: number;
    category?: string;
    user_segment?: string;
    date_from?: string;
    date_to?: string;
  };
}

export interface InsightSummary {
  insight_id: string;
  post_id: string;
  priority_score: number;
  feature_summary: string;
  feature_category: string;
  user_segment: string;
  source_type: Platform;  // New: Platform source
  subreddit?: string;  // Optional: Only for Reddit
  analyzed_at: string;
  action_required: boolean;
  suggested_action: string;
  competitors_mentioned: string[];
  platform_metadata?: RedditMetadata | TwitterMetadata;  // New: Platform-specific data
}

export interface RedditMetadata {
  subreddit: string;
  post_score: number;
  upvote_ratio: number;
  flair?: string;
}

export interface TwitterMetadata {
  tweet_id: string;
  author_username: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  engagement_score: number;
  conversation_id: string;
  language: string;
}

export interface InsightDetailsResponse {
  data: InsightDetails;
}

export interface InsightDetails {
  insight_id: string;
  post_id: string;
  post_url: string;
  source_type: Platform;  // New: Platform source
  subreddit?: string;  // Optional: Only for Reddit
  timestamp: number;
  analyzed_at: string;
  collected_at: string;
  feature_summary: string;
  feature_details: string;
  feature_category: string;
  priority_score: number;
  implementation_size: string;
  user_segment: string;
  ai_readiness: string;
  competitors_mentioned: string[];
  supio_mentioned: boolean;
  competitive_advantage: string;
  action_required: boolean;
  suggested_action: string;
  pain_points: string[];
  post_score?: number;  // Optional: Only for Reddit
  num_comments?: number;  // Optional: Only for Reddit
  platform_metadata?: RedditMetadata | TwitterMetadata;  // New: Platform-specific data
}

export interface AnalyticsSummaryResponse {
  data: AnalyticsData;
  meta: {
    generated_at: string;
    items_analyzed: number;
  };
}

export interface AnalyticsData {
  period: string;
  date_range: {
    start: string;
    end: string;
  };
  total_insights: number;
  high_priority_insights: number;
  actionable_insights: number;
  avg_priority_score: number;
  by_category?: Record<string, { count: number; avg_priority: number }>;
  by_user_segment?: Record<string, { count: number; avg_priority: number }>;
  top_competitors: Record<string, number>;
  recent_high_priority: Array<{
    insight_id: string;
    priority_score: number;
    feature_summary: string;
    analyzed_at: string;
  }>;
}

// services/crawlerApi.ts
export class CrawlerApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.CRAWLER_API_URL || '';
    this.apiKey = process.env.CRAWLER_API_KEY || '';
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  async triggerCrawl(params?: CrawlTriggerRequest): Promise<CrawlTriggerResponse> {
    const response = await this.request('/trigger', {
      method: 'POST',
      body: params ? JSON.stringify(params) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to trigger crawl: ${response.statusText}`);
    }

    return response.json();
  }

  async getJobStatus(executionName: string): Promise<CrawlStatusResponse> {
    const response = await this.request(`/status/${executionName}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Job not found');
      }
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    return response.json();
  }

  async listRecentJobs(): Promise<{ executions: any[]; count: number }> {
    const response = await this.request('/executions');

    if (!response.ok) {
      throw new Error(`Failed to list jobs: ${response.statusText}`);
    }

    return response.json();
  }

  async listInsights(params?: {
    platform?: Platform;  // New: Filter by platform
    priority_min?: number;
    priority_max?: number;
    category?: string;
    user_segment?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<InsightsListResponse> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = searchParams.toString() ? `/insights?${searchParams.toString()}` : '/insights';
    const response = await this.request(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to list insights: ${response.statusText}`);
    }

    return response.json();
  }

  async getInsightDetails(insightId: string): Promise<InsightDetailsResponse> {
    const response = await this.request(`/insights/${encodeURIComponent(insightId)}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Insight not found');
      }
      throw new Error(`Failed to get insight details: ${response.statusText}`);
    }

    return response.json();
  }

  async getAnalyticsSummary(params?: {
    platform?: Platform;  // New: Filter by platform
    period?: '7d' | '30d' | '90d';
    group_by?: string;
  }): Promise<AnalyticsSummaryResponse> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value);
        }
      });
    }

    const endpoint = searchParams.toString() ? `/analytics/summary?${searchParams.toString()}` : '/analytics/summary';
    const response = await this.request(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to get analytics summary: ${response.statusText}`);
    }

    return response.json();
  }

  async getSystemConfiguration(): Promise<SystemConfigurationResponse> {
    const response = await this.request('/config');

    if (!response.ok) {
      throw new Error(`Failed to get system configuration: ${response.statusText}`);
    }

    return response.json();
  }

  async updateSystemConfiguration(configUpdate: any): Promise<ConfigurationUpdateResponse> {
    const response = await this.request('/config', {
      method: 'PUT',
      body: JSON.stringify(configUpdate),
    });

    if (!response.ok) {
      if (response.status === 400) {
        const error = await response.json();
        throw new Error(`Invalid configuration: ${error.error}`);
      }
      throw new Error(`Failed to update system configuration: ${response.statusText}`);
    }

    return response.json();
  }

  async getSystemHealth(): Promise<HealthCheckResponse> {
    const response = await this.request('/health');

    if (!response.ok) {
      // Health endpoint can return 503 for degraded/unhealthy systems
      if (response.status === 503) {
        return response.json(); // Still return health data even if unhealthy
      }
      throw new Error(`Failed to get system health: ${response.statusText}`);
    }

    return response.json();
  }
}

// Additional TypeScript interfaces for Priority 2 endpoints
export interface SystemConfigurationResponse {
  crawl_settings: {
    default_subreddits: string[];
    default_crawl_type: 'crawl' | 'search' | 'both';
    default_days_back: number;
    default_min_score: number;
    max_posts_per_crawl: number;
  };
  analysis_settings: {
    priority_threshold: number;
    ai_model: string;
    analysis_timeout_seconds: number;
    max_retries: number;
  };
  storage_settings: {
    insights_ttl_days: number;
    max_insights_per_request: number;
    analytics_cache_ttl_minutes: number;
  };
  system_settings: {
    api_version: string;
    environment: 'development' | 'staging' | 'production';
    maintenance_mode: boolean;
    rate_limit_per_minute: number;
  };
}

export interface ConfigurationUpdateResponse {
  message: string;
  updated_sections: string[];
  timestamp: string;
  updated_by: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime_seconds?: number;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      response_time_ms?: number;
      error?: string;
    };
    storage?: {
      status: 'healthy' | 'unhealthy';
      response_time_ms?: number;
    };
    ai_service?: {
      status: 'healthy' | 'unhealthy';
      response_time_ms?: number;
    };
    pipeline: {
      status: 'healthy' | 'unhealthy';
      response_time_ms?: number;
      last_execution?: string;
      error?: string;
    };
  };
  metrics?: {
    total_requests?: number;
    error_rate?: number;
    avg_response_time_ms?: number;
    active_executions?: number;
  };
  resources?: {
    memory_usage_percent?: number;
    cpu_usage_percent?: number;
    disk_usage_percent?: number;
  };
}

// Usage in Cloudflare Workers route handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const crawlerApi = new CrawlerApiService();

    if (request.method === 'POST' && new URL(request.url).pathname === '/api/crawler/trigger') {
      try {
        const body = await request.json() as CrawlTriggerRequest;
        const result = await crawlerApi.triggerCrawl(body);

        return Response.json({
          success: true,
          data: result
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    if (request.method === 'GET' && new URL(request.url).pathname.startsWith('/api/crawler/status/')) {
      try {
        const executionName = new URL(request.url).pathname.split('/').pop();
        const result = await crawlerApi.getJobStatus(executionName!);

        return Response.json({
          success: true,
          data: result
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error.message
        }, { status: error.message === 'Job not found' ? 404 : 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
```

## Environment Variables

Set these environment variables in your Cloudflare Workers:

```bash
CRAWLER_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/v1
CRAWLER_API_KEY=your-api-key-here
```

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (invalid endpoint or execution not found)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

All error responses include a JSON body with error details:
```json
{
  "error": "Error message here",
  "message": "Additional details if available"
}
```

## Rate Limits

The API is configured with the following limits:
- **Rate Limit**: 10 requests per second
- **Burst Limit**: 20 concurrent requests
- **Monthly Quota**: 1000 requests per month

These limits can be adjusted in the CDK configuration if needed.

## CORS Support

The API includes full CORS support with:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,POST,OPTIONS`
- `Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`

## Deployment

To deploy the API:

1. Ensure Reddit API credentials are configured in cdk.json context or pass via CLI
2. Deploy the CDK stack:
   ```bash
   cd infra/aws
   npx cdk deploy --context redditClientId=YOUR_CLIENT_ID --context redditClientSecret=YOUR_CLIENT_SECRET
   ```
3. Note the API URL and API Key from the deployment outputs:
   - `ApiUrl`: Full API Gateway URL (e.g., https://xxxxxx.execute-api.us-west-2.amazonaws.com/v1/)
   - `ApiKeyId`: API Key ID for retrieving the actual key
4. Get the actual API key value:
   ```bash
   aws apigateway get-api-key --api-key <ApiKeyId> --include-value --query 'value' --output text
   ```
5. Configure frontend environment variables:
   - `NEXT_PUBLIC_API_URL`: The API Gateway URL from step 3
   - `NEXT_PUBLIC_API_KEY`: The API key value from step 4

The API will be immediately available for triggering crawl jobs and monitoring their status.

## Implementation Details

### Lambda Function Structure

**File:** `/infra/aws/lambda/api/index.py`

**Key Components:**
- `handler()`: Main entry point, routes requests to appropriate handlers
- `handle_trigger_crawl()`: Loads config from DynamoDB, starts Step Functions execution
- `handle_list_insights()`: Queries DynamoDB with filtering support
- `handle_analytics_summary()`: Aggregates insights for dashboard
- `handle_get_config()`: Returns current configuration or defaults
- `handle_update_config()`: Persists configuration to DynamoDB
- `convert_decimals()`: Helper to serialize DynamoDB Decimal types

**Environment Variables:**
- `STATE_MACHINE_ARN`: ARN of Step Functions state machine
- `INSIGHTS_TABLE_NAME`: DynamoDB insights table name (`supio-insights`)
- `CONFIG_TABLE_NAME`: DynamoDB config table name (`supio-system-config`)

**DynamoDB Tables Used:**
1. **supio-insights** - Main insights storage
   - PK: `INSIGHT#{YYYY-MM-DD}`
   - SK: `PRIORITY#{score}#ID#{post_id}`
   - GSI1PK/GSI1SK: For priority-based queries

2. **supio-system-config** - Configuration persistence (NEW!)
   - PK: `config_id` (always "system_config")
   - Attributes: `config` (nested JSON), `updated_at`, `updated_by`
   - RemovalPolicy: RETAIN (persists even if stack is deleted)

### Configuration Behavior

**Default Values (when no config in DynamoDB):**
```python
DEFAULT_CRAWL_SETTINGS = {
    'default_subreddits': ['LawFirm', 'Lawyertalk', 'legaltech', 'legaltechAI'],
    'default_crawl_type': 'both',
    'default_days_back': 3,
    'default_min_score': 10,
    'max_posts_per_crawl': 500
}
```

**Override Priority (highest to lowest):**
1. Request body parameters in POST /trigger
2. Saved configuration in DynamoDB
3. Hardcoded defaults in Lambda code

**Example Flow:**
```
1. User updates config via PUT /config { "crawl_settings": { "default_days_back": 7 } }
2. Config saved to DynamoDB
3. User triggers crawl via POST /trigger (no body)
4. Lambda loads config from DynamoDB → uses days_back=7
5. User triggers crawl with POST /trigger { "days_back": 3 }
6. Lambda uses days_back=3 (request overrides saved config for this execution only)
```
