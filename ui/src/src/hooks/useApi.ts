/**
 * React Query hooks for API integration
 *
 * Provides type-safe, cached API hooks for all endpoints
 * Handles loading states, error handling, and data synchronization
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  InsightsListParams,
  AnalyticsParams,
  TrendsParams,
  CompetitorParams,
  CrawlTriggerRequest,
  ConfigurationUpdateRequest,
  ExecutionLogsParams,
} from '@/types';
import { apiService, formatApiError } from '@/services/api';

// ================================
// Query Keys for consistent caching
// ================================

export const queryKeys = {
  // Core pipeline
  apiDocs: ['api', 'docs'] as const,
  executions: ['executions'] as const,
  executionStatus: (name: string) => ['execution', 'status', name] as const,
  executionLogs: (name: string, params?: ExecutionLogsParams) => ['execution', 'logs', name, params] as const,

  // Insights
  insights: (params?: InsightsListParams) => ['insights', params] as const,
  insightDetails: (id: string) => ['insight', id] as const,

  // Analytics
  analyticsSummary: (params?: AnalyticsParams) => ['analytics', 'summary', params] as const,
  analyticsTrends: (params?: TrendsParams) => ['analytics', 'trends', params] as const,
  analyticsCompetitors: (params?: CompetitorParams) => ['analytics', 'competitors', params] as const,

  // System
  systemConfig: ['system', 'config'] as const,
  systemHealth: ['system', 'health'] as const,
} as const;

// ================================
// Core Pipeline Hooks
// ================================

/**
 * Get API documentation
 */
export const useApiDocumentation = () => {
  return useQuery({
    queryKey: queryKeys.apiDocs,
    queryFn: () => apiService.getApiDocumentation(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    meta: {
      errorMessage: 'Failed to load API documentation',
    },
  });
};

/**
 * List recent executions
 */
export const useExecutions = () => {
  return useQuery({
    queryKey: queryKeys.executions,
    queryFn: () => apiService.listExecutions(),
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    staleTime: 10 * 1000, // 10 seconds
    meta: {
      errorMessage: 'Failed to load executions',
    },
  });
};

/**
 * Get execution status
 */
export const useExecutionStatus = (executionName: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.executionStatus(executionName),
    queryFn: () => apiService.getJobStatus(executionName),
    enabled: enabled && !!executionName,
    refetchInterval: (data) => {
      // Stop polling if execution is complete
      if (data?.status && ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(data.status)) {
        return false;
      }
      return 5 * 1000; // Poll every 5 seconds for running executions
    },
    meta: {
      errorMessage: 'Failed to load execution status',
    },
  });
};

/**
 * Get execution logs
 */
export const useExecutionLogs = (
  executionName: string,
  params?: ExecutionLogsParams,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: queryKeys.executionLogs(executionName, params),
    queryFn: () => apiService.getExecutionLogs(executionName, params),
    enabled: enabled && !!executionName,
    staleTime: 30 * 1000, // 30 seconds
    meta: {
      errorMessage: 'Failed to load execution logs',
    },
  });
};

// ================================
// Data Access Hooks
// ================================

/**
 * Get insights with filtering
 */
export const useInsights = (params?: InsightsListParams) => {
  return useQuery({
    queryKey: queryKeys.insights(params),
    queryFn: () => apiService.getInsights(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true, // Keep previous data while loading new filters
    meta: {
      errorMessage: 'Failed to load insights',
    },
  });
};

/**
 * Get single insight details
 */
export const useInsightDetails = (insightId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.insightDetails(insightId),
    queryFn: () => apiService.getInsightDetails(insightId),
    enabled: enabled && !!insightId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    meta: {
      errorMessage: 'Failed to load insight details',
    },
  });
};

// ================================
// Analytics Hooks
// ================================

/**
 * Get analytics summary
 */
export const useAnalyticsSummary = (params?: AnalyticsParams) => {
  return useQuery({
    queryKey: queryKeys.analyticsSummary(params),
    queryFn: () => apiService.getAnalyticsSummary(params),
    staleTime: 15 * 60 * 1000, // 15 minutes for analytics
    cacheTime: 30 * 60 * 1000, // 30 minutes
    meta: {
      errorMessage: 'Failed to load analytics summary',
    },
  });
};

/**
 * Get analytics trends
 */
export const useAnalyticsTrends = (params?: TrendsParams) => {
  return useQuery({
    queryKey: queryKeys.analyticsTrends(params),
    queryFn: () => apiService.getAnalyticsTrends(params),
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    meta: {
      errorMessage: 'Failed to load analytics trends',
    },
  });
};

/**
 * Get competitor analysis
 */
export const useCompetitorAnalysis = (params?: CompetitorParams) => {
  return useQuery({
    queryKey: queryKeys.analyticsCompetitors(params),
    queryFn: () => apiService.getCompetitorAnalysis(params),
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    meta: {
      errorMessage: 'Failed to load competitor analysis',
    },
  });
};

// ================================
// System Configuration Hooks
// ================================

/**
 * Get system configuration
 */
export const useSystemConfiguration = () => {
  return useQuery({
    queryKey: queryKeys.systemConfig,
    queryFn: () => apiService.getSystemConfiguration(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 20 * 60 * 1000, // 20 minutes
    meta: {
      errorMessage: 'Failed to load system configuration',
    },
  });
};

/**
 * Get system health
 */
export const useSystemHealth = () => {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: () => apiService.getSystemHealth(),
    refetchInterval: 60 * 1000, // Refresh every minute
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 503 (service unavailable) - it's expected for unhealthy systems
      if (error?.status === 503) return false;
      return failureCount < 3;
    },
    meta: {
      errorMessage: 'Failed to load system health',
      skipToast: true, // Don't show toast for health check failures
    },
  });
};

// ================================
// Mutation Hooks
// ================================

/**
 * Trigger crawl job
 */
export const useTriggerCrawl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: CrawlTriggerRequest) => apiService.triggerCrawl(params),
    onSuccess: () => {
      // Invalidate executions list to show the new job
      queryClient.invalidateQueries({ queryKey: queryKeys.executions });
    },
    meta: {
      successMessage: 'Crawl job started successfully',
      errorMessage: 'Failed to start crawl job',
    },
  });
};

/**
 * Cancel execution
 */
export const useCancelExecution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (executionName: string) => apiService.cancelExecution(executionName),
    onSuccess: (_, executionName) => {
      // Invalidate the specific execution status and executions list
      queryClient.invalidateQueries({ queryKey: queryKeys.executionStatus(executionName) });
      queryClient.invalidateQueries({ queryKey: queryKeys.executions });
    },
    meta: {
      successMessage: 'Execution cancelled successfully',
      errorMessage: 'Failed to cancel execution',
    },
  });
};

/**
 * Update system configuration
 */
export const useUpdateSystemConfiguration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (configUpdate: ConfigurationUpdateRequest) =>
      apiService.updateSystemConfiguration(configUpdate),
    onSuccess: () => {
      // Invalidate system configuration to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.systemConfig });
    },
    meta: {
      successMessage: 'System configuration updated successfully',
      errorMessage: 'Failed to update system configuration',
    },
  });
};

// ================================
// Utility Hooks
// ================================

/**
 * Test API connectivity
 */
export const useApiConnectionTest = () => {
  return useMutation({
    mutationFn: () => apiService.testConnection(),
    meta: {
      successMessage: 'API connection successful',
      errorMessage: 'API connection failed',
    },
  });
};

/**
 * Hook to get formatted error message from React Query error
 */
export const useFormattedError = (error: unknown): string | null => {
  if (!error) return null;
  return formatApiError(error);
};

/**
 * Hook to invalidate all queries (useful for refresh functionality)
 */
export const useRefreshAll = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries();
  };
};