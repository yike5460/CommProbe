/**
 * API Service Layer for Legal Tech Intelligence Dashboard
 *
 * Provides type-safe API methods for all 14 backend endpoints
 * Handles authentication, error handling, and response transformation
 */

import {
  CrawlTriggerRequest,
  CrawlTriggerResponse,
  JobStatusResponse,
  ExecutionListResponse,
  InsightsListParams,
  InsightsListResponse,
  InsightDetailsResponse,
  AnalyticsParams,
  AnalyticsSummaryResponse,
  TrendsParams,
  TrendsResponse,
  CompetitorParams,
  CompetitorResponse,
  SystemConfigurationResponse,
  ConfigurationUpdateRequest,
  ConfigurationUpdateResponse,
  HealthCheckResponse,
  ExecutionLogsParams,
  ExecutionLogsResponse,
  ApiError,
  RequestOptions,
} from '@/types';

/**
 * Custom API Error class for better error handling
 */
export class SupioApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'SupioApiError';
  }
}

/**
 * Main API Service class
 */
export class SupioApiService {
  private baseUrl: string;
  private apiKey: string;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.apiKey = process.env.NEXT_PUBLIC_API_KEY!;

    // Always use proxy endpoint to avoid CORS issues
    // The proxy handles the actual API calls to AWS
    this.baseUrl = '/api/proxy';

    if (!this.apiKey) {
      throw new Error('API configuration missing. Please check environment variables.');
    }

    if (!process.env.NEXT_PUBLIC_API_URL) {
      throw new Error('NEXT_PUBLIC_API_URL is required for the proxy to work.');
    }
  }

  /**
   * Generic request method with error handling
   */
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    // Always use proxy endpoint with path as URL segments
    // Remove leading slash from endpoint for proper path construction
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = new URL(`${this.baseUrl}/${cleanEndpoint}`, window.location.origin);

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // The proxy handles API key authentication - no need to add it here

      const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`;
        let errorDetails: string | undefined;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorDetails = errorData.message || errorData.details;
        } catch {
          // If we can't parse the error response, use the status text
          errorMessage = response.statusText || errorMessage;
        }

        throw new SupioApiError(response.status, errorMessage, errorDetails);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof SupioApiError) {
        throw error;
      }

      // Handle network errors, timeout, etc.
      throw new SupioApiError(
        0,
        'Network error occurred',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ================================
  // Core Pipeline Endpoints
  // ================================

  /**
   * GET / - Get API documentation
   */
  async getApiDocumentation(): Promise<any> {
    return this.request('/');
  }

  /**
   * POST /trigger - Start new crawl job
   */
  async triggerCrawl(params?: CrawlTriggerRequest): Promise<CrawlTriggerResponse> {
    return this.request('/trigger', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * GET /status/{executionName} - Check execution status
   */
  async getJobStatus(executionName: string): Promise<JobStatusResponse> {
    return this.request(`/status/${encodeURIComponent(executionName)}`);
  }

  /**
   * GET /executions - List recent executions
   */
  async listExecutions(): Promise<ExecutionListResponse> {
    return this.request('/executions');
  }

  // ================================
  // Data Access Endpoints (Priority 1)
  // ================================

  /**
   * GET /insights - List insights with filtering
   */
  async getInsights(params?: InsightsListParams): Promise<InsightsListResponse> {
    return this.request('/insights', { params });
  }

  /**
   * GET /insights/{insightId} - Get single insight details
   */
  async getInsightDetails(insightId: string): Promise<InsightDetailsResponse> {
    return this.request(`/insights/${encodeURIComponent(insightId)}`);
  }

  /**
   * GET /analytics/summary - Analytics dashboard data
   */
  async getAnalyticsSummary(params?: AnalyticsParams): Promise<AnalyticsSummaryResponse> {
    return this.request('/analytics/summary', { params });
  }

  // ================================
  // Enhanced Analytics Endpoints (Priority 3)
  // ================================

  /**
   * GET /analytics/trends - Historical trend analysis
   */
  async getAnalyticsTrends(params?: TrendsParams): Promise<TrendsResponse> {
    return this.request('/analytics/trends', { params });
  }

  /**
   * GET /analytics/competitors - Competitive intelligence analysis
   */
  async getCompetitorAnalysis(params?: CompetitorParams): Promise<CompetitorResponse> {
    return this.request('/analytics/competitors', { params });
  }

  // ================================
  // Configuration & Management Endpoints (Priority 2)
  // ================================

  /**
   * GET /config - Get system configuration
   */
  async getSystemConfiguration(): Promise<SystemConfigurationResponse> {
    return this.request('/config');
  }

  /**
   * PUT /config - Update system configuration
   */
  async updateSystemConfiguration(
    configUpdate: ConfigurationUpdateRequest
  ): Promise<ConfigurationUpdateResponse> {
    return this.request('/config', {
      method: 'PUT',
      body: configUpdate,
    });
  }

  /**
   * GET /health - System health check
   */
  async getSystemHealth(): Promise<HealthCheckResponse> {
    return this.request('/health');
  }

  // ================================
  // Operational Endpoints (Priority 4)
  // ================================

  /**
   * DELETE /executions/{executionName} - Cancel running job
   */
  async cancelExecution(executionName: string): Promise<any> {
    return this.request(`/executions/${encodeURIComponent(executionName)}`, {
      method: 'DELETE',
    });
  }

  /**
   * GET /logs/{executionName} - Get execution logs
   */
  async getExecutionLogs(
    executionName: string,
    params?: ExecutionLogsParams
  ): Promise<ExecutionLogsResponse> {
    return this.request(`/logs/${encodeURIComponent(executionName)}`, { params });
  }

  // ================================
  // Utility Methods
  // ================================

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getApiDocumentation();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get API base URL (for debugging)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}

// ================================
// Singleton instance
// ================================

/**
 * Singleton API service instance
 */
export const apiService = new SupioApiService();

// ================================
// Utility functions for common API patterns
// ================================

/**
 * Build insights filter params from form values
 */
export function buildInsightsFilters(filters: Record<string, any>): InsightsListParams {
  const params: InsightsListParams = {};

  if (filters.priority_min !== undefined) params.priority_min = Number(filters.priority_min);
  if (filters.priority_max !== undefined) params.priority_max = Number(filters.priority_max);
  if (filters.category && filters.category !== '') params.category = filters.category;
  if (filters.user_segment && filters.user_segment !== '') params.user_segment = filters.user_segment;
  if (filters.date_from && filters.date_from !== '') params.date_from = filters.date_from;
  if (filters.date_to && filters.date_to !== '') params.date_to = filters.date_to;
  if (filters.limit !== undefined) params.limit = Number(filters.limit);

  return params;
}

/**
 * Format API error for user display
 */
export function formatApiError(error: unknown): string {
  if (error instanceof SupioApiError) {
    if (error.details) {
      return `${error.message}: ${error.details}`;
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Check if error is a specific HTTP status
 */
export function isApiError(error: unknown, status?: number): boolean {
  if (!(error instanceof SupioApiError)) {
    return false;
  }

  return status === undefined || error.status === status;
}

/**
 * Retry API call with exponential backoff
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error instanceof SupioApiError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}