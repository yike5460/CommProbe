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
    "GET /": "This documentation"
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
  "subreddits": ["LawFirm", "Lawyertalk", "legaltech"],
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
    "subreddits": ["LawFirm", "Lawyertalk", "legaltech"],
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