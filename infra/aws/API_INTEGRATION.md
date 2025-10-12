# Reddit Crawler API Integration Guide

## Overview

The Reddit Crawler API provides REST endpoints for triggering and monitoring Reddit data collection jobs. This API is designed to be consumed by the Cloudflare Workers API Gateway.

## Architecture

The API is implemented as a dedicated AWS Lambda function (`/infra/aws/lambda/api/index.py`) that integrates with AWS Step Functions to orchestrate the Reddit crawling pipeline. This follows the same architecture pattern as other Lambda functions in the system.

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
    "GET /health": "System health check"
  },
  "trigger_parameters": {
    "subreddits": "array of subreddit names (optional)",
    "crawl_type": "crawl, search, or both (optional)",
    "days_back": "number of days to look back (optional)"
  }
}
```

### 2. POST /trigger - Start New Crawl Job
Trigger a new Reddit crawling job with optional parameters.

**Request Body (Optional):**
```json
{
  "subreddits": ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"],
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
Get filtered list of insights with pagination and analytics.

**Query Parameters:**
- `priority_min` (optional): Minimum priority score (default: 0)
- `priority_max` (optional): Maximum priority score (default: 10)
- `category` (optional): Filter by feature category
- `user_segment` (optional): Filter by user segment
- `date_from` (optional): Start date filter (YYYY-MM-DD)
- `date_to` (optional): End date filter (YYYY-MM-DD)
- `limit` (optional): Number of results to return (default: 50, max: 100)

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
      "subreddit": "LawFirm",
      "analyzed_at": "2025-09-23T17:44:42.643935",
      "action_required": true,
      "suggested_action": "Evaluate medical chronology automation for Q1 2026 roadmap",
      "competitors_mentioned": ["EvenUp", "Eve"]
    }
  ],
  "pagination": {
    "limit": 50,
    "count": 25,
    "hasMore": false
  },
  "filters": {
    "priority_min": 5,
    "priority_max": 10,
    "category": "document_automation",
    "user_segment": null,
    "date_from": null,
    "date_to": null
  }
}
```

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
Get aggregated analytics for dashboard and reporting.

**Query Parameters:**
- `period` (optional): Time period (7d, 30d, 90d) (default: 7d)
- `group_by` (optional): Comma-separated list of grouping fields (category, user_segment)

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

**Response:**
```json
{
  "crawl_settings": {
    "default_subreddits": ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"],
    "default_crawl_type": "both",
    "default_days_back": 3,
    "default_min_score": 10,
    "max_posts_per_crawl": 500
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

### 9. PUT /config - Update System Configuration
Update system configuration settings. Only specified sections will be updated; other settings remain unchanged.

**Request Body:**
```json
{
  "crawl_settings": {
    "default_days_back": 5
  },
  "system_settings": {
    "maintenance_mode": false
  }
}
```

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

## Cloudflare Workers Integration Example

Here's how to integrate this API into your Cloudflare Workers:

```typescript
// types/crawler.ts
export interface CrawlTriggerRequest {
  subreddits?: string[];
  crawl_type?: 'crawl' | 'search' | 'both';
  days_back?: number;
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
  subreddit: string;
  analyzed_at: string;
  action_required: boolean;
  suggested_action: string;
  competitors_mentioned: string[];
}

export interface InsightDetailsResponse {
  data: InsightDetails;
}

export interface InsightDetails {
  insight_id: string;
  post_id: string;
  post_url: string;
  subreddit: string;
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
  post_score: number;
  num_comments: number;
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

1. Ensure Reddit API credentials are configured
2. Deploy the CDK stack:
   ```bash
   npx cdk deploy --context redditClientId=YOUR_CLIENT_ID --context redditClientSecret=YOUR_CLIENT_SECRET
   ```
3. Note the API URL and API Key from the deployment outputs
4. Configure your Cloudflare Workers with the API URL and key

The API will be immediately available for triggering crawl jobs and monitoring their status.
