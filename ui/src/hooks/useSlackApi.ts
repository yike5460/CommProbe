/**
 * React Query hooks for Slack API integration
 *
 * Provides type-safe, cached Slack API hooks for all endpoints
 * Handles loading states, error handling, and data synchronization
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SlackAnalysisRequest,
  SlackUserProfile,
  SlackChannelSummary,
} from '@/types';
import { slackApiService } from '@/lib/api/slack';

// ================================
// Query Keys for consistent caching
// ================================

export const slackQueryKeys = {
  // Users
  users: (workspaceId?: string, limit?: number) => ['slack', 'users', workspaceId, limit] as const,
  userProfile: (userId: string, workspaceId?: string) => ['slack', 'user', userId, workspaceId] as const,

  // Channels
  channels: (workspaceId?: string, limit?: number) => ['slack', 'channels', workspaceId, limit] as const,
  channelSummary: (channelId: string, workspaceId?: string) =>
    ['slack', 'channel', channelId, workspaceId] as const,

  // Configuration
  config: () => ['slack', 'config'] as const,
} as const;

// ================================
// User Query Hooks
// ================================

/**
 * Get Slack user profile
 */
export const useSlackUserProfile = (userId: string, workspaceId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: slackQueryKeys.userProfile(userId, workspaceId),
    queryFn: () => slackApiService.getUserProfile(userId, workspaceId),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    meta: {
      errorMessage: 'Failed to load user profile',
    },
  });
};

/**
 * List Slack user profiles
 */
export const useSlackUsers = (workspaceId?: string, limit?: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: slackQueryKeys.users(workspaceId, limit),
    queryFn: () => slackApiService.listUsers(workspaceId, limit),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      ...data,
      // Sort users by activity level (desc) by default
      users: [...data.users].sort((a, b) => b.total_activity - a.total_activity),
    }),
    meta: {
      errorMessage: 'Failed to load user profiles',
    },
  });
};

// ================================
// Channel Query Hooks
// ================================

/**
 * Get Slack channel summary
 */
export const useSlackChannelSummary = (
  channelId: string,
  workspaceId?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: slackQueryKeys.channelSummary(channelId, workspaceId),
    queryFn: () => slackApiService.getChannelSummary(channelId, workspaceId),
    enabled: enabled && !!channelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    meta: {
      errorMessage: 'Failed to load channel summary',
    },
  });
};

/**
 * List Slack channel summaries
 */
export const useSlackChannels = (workspaceId?: string, limit?: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: slackQueryKeys.channels(workspaceId, limit),
    queryFn: () => slackApiService.listChannels(workspaceId, limit),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      ...data,
      // Sort channels by messages analyzed (desc) by default
      channels: [...data.channels].sort((a, b) => b.messages_analyzed - a.messages_analyzed),
    }),
    meta: {
      errorMessage: 'Failed to load channel summaries',
    },
  });
};

// ================================
// Mutation Hooks
// ================================

/**
 * Analyze Slack user
 */
export const useAnalyzeSlackUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SlackAnalysisRequest) => slackApiService.analyzeUser(request),
    onSuccess: (_, variables) => {
      // Invalidate users list to show updated data
      queryClient.invalidateQueries({ queryKey: ['slack', 'users'] });

      // If we have a user_id, invalidate that specific user profile
      if (variables.user_id) {
        queryClient.invalidateQueries({
          queryKey: slackQueryKeys.userProfile(variables.user_id, variables.workspace_id),
        });
      }
    },
    meta: {
      successMessage: 'User analysis started! Tracking progress...',
      errorMessage: 'Failed to start user analysis',
    },
  });
};

/**
 * Analyze Slack channel
 */
export const useAnalyzeSlackChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SlackAnalysisRequest) => slackApiService.analyzeChannel(request),
    onSuccess: (_, variables) => {
      // Invalidate channels list to show updated data
      queryClient.invalidateQueries({ queryKey: ['slack', 'channels'] });

      // If we have a channel_id, invalidate that specific channel summary
      if (variables.channel_id) {
        queryClient.invalidateQueries({
          queryKey: slackQueryKeys.channelSummary(variables.channel_id, variables.workspace_id),
        });
      }
    },
    meta: {
      successMessage: 'Channel analysis started! Tracking progress...',
      errorMessage: 'Failed to start channel analysis',
    },
  });
};

// ================================
// Utility Hooks
// ================================

/**
 * Hook to refresh all Slack data
 */
export const useRefreshSlackData = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['slack'] });
  };
};

/**
 * Hook to prefetch user profile (useful for optimistic loading on hover)
 */
export const usePrefetchUserProfile = () => {
  const queryClient = useQueryClient();

  return (userId: string, workspaceId?: string) => {
    queryClient.prefetchQuery({
      queryKey: slackQueryKeys.userProfile(userId, workspaceId),
      queryFn: () => slackApiService.getUserProfile(userId, workspaceId),
      staleTime: 5 * 60 * 1000,
    });
  };
};

/**
 * Hook to prefetch channel summary (useful for optimistic loading on hover)
 */
export const usePrefetchChannelSummary = () => {
  const queryClient = useQueryClient();

  return (channelId: string, workspaceId?: string) => {
    queryClient.prefetchQuery({
      queryKey: slackQueryKeys.channelSummary(channelId, workspaceId),
      queryFn: () => slackApiService.getChannelSummary(channelId, workspaceId),
      staleTime: 5 * 60 * 1000,
    });
  };
};

/**
 * Hook to get filtered users with client-side filtering
 */
export const useFilteredSlackUsers = (
  workspaceId?: string,
  filters?: {
    searchQuery?: string;
    activityLevel?: 'all' | 'very-active' | 'active' | 'moderate' | 'low';
  }
) => {
  const { data, ...queryResult } = useSlackUsers(workspaceId);

  if (!data || !filters) {
    return { data, ...queryResult };
  }

  let filteredUsers = data.users;

  // Filter by activity level
  if (filters.activityLevel && filters.activityLevel !== 'all') {
    filteredUsers = filteredUsers.filter((user) => {
      const totalActivity = user.total_activity || 0;
      switch (filters.activityLevel) {
        case 'very-active':
          return totalActivity >= 50;
        case 'active':
          return totalActivity >= 10 && totalActivity < 50;
        case 'moderate':
          return totalActivity >= 5 && totalActivity < 10;
        case 'low':
          return totalActivity >= 1 && totalActivity < 5;
        default:
          return true;
      }
    });
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredUsers = filteredUsers.filter(
      (user) =>
        user.user_name.toLowerCase().includes(query) ||
        user.user_email.toLowerCase().includes(query) ||
        (user.display_name && user.display_name.toLowerCase().includes(query))
    );
  }

  return {
    data: {
      ...data,
      users: filteredUsers,
      count: filteredUsers.length,
    },
    ...queryResult,
  };
};

/**
 * Hook to get filtered channels with client-side filtering
 */
export const useFilteredSlackChannels = (
  workspaceId?: string,
  filters?: {
    searchQuery?: string;
    activityVolume?: 'all' | 'very-active' | 'active' | 'moderate' | 'quiet';
  }
) => {
  const { data, ...queryResult } = useSlackChannels(workspaceId);

  if (!data || !filters) {
    return { data, ...queryResult };
  }

  let filteredChannels = data.channels;

  // Filter by activity volume
  if (filters.activityVolume && filters.activityVolume !== 'all') {
    filteredChannels = filteredChannels.filter((channel) => {
      const messagesAnalyzed = channel.messages_analyzed || 0;
      switch (filters.activityVolume) {
        case 'very-active':
          return messagesAnalyzed >= 100;
        case 'active':
          return messagesAnalyzed >= 50 && messagesAnalyzed < 100;
        case 'moderate':
          return messagesAnalyzed >= 10 && messagesAnalyzed < 50;
        case 'quiet':
          return messagesAnalyzed < 10;
        default:
          return true;
      }
    });
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredChannels = filteredChannels.filter((channel) =>
      channel.channel_name.toLowerCase().includes(query)
    );
  }

  return {
    data: {
      ...data,
      channels: filteredChannels,
      count: filteredChannels.length,
    },
    ...queryResult,
  };
};

/**
 * Poll job status until completion
 * Automatically stops polling when job reaches terminal state (completed/failed)
 */
export const useSlackJobStatus = (jobId: string | null) => {
  return useQuery({
    queryKey: ['slack', 'job', jobId],
    queryFn: () => slackApiService.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when job reaches terminal state
      if (!data || data.status === 'completed' || data.status === 'failed') {
        return false;
      }
      // Poll every 5 seconds while pending/processing
      return 5000;
    },
    staleTime: 0, // Always fetch fresh status
    retry: 3,
  });
};

// ================================
// Configuration Hooks
// ================================

/**
 * Get Slack configuration
 */
export const useSlackConfig = () => {
  return useQuery({
    queryKey: slackQueryKeys.config(),
    queryFn: () => slackApiService.getSlackConfig(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    meta: {
      errorMessage: 'Failed to load Slack configuration',
    },
  });
};

/**
 * Update Slack configuration
 */
export const useUpdateSlackConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config) => slackApiService.updateSlackConfig(config),
    onSuccess: () => {
      // Invalidate config to refetch
      queryClient.invalidateQueries({ queryKey: slackQueryKeys.config() });
    },
    meta: {
      successMessage: 'Slack configuration updated successfully',
      errorMessage: 'Failed to update Slack configuration',
    },
  });
};

/**
 * Test Slack connection
 */
export const useTestSlackConnection = () => {
  return useMutation({
    mutationFn: () => slackApiService.testConnection(),
    meta: {
      errorMessage: 'Connection test failed',
    },
  });
};

/**
 * Delete user profile
 */
export const useDeleteSlackUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, workspaceId }: { userId: string; workspaceId?: string }) =>
      slackApiService.deleteUserProfile(userId, workspaceId),
    onSuccess: () => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: ['slack', 'users'] });
    },
    meta: {
      successMessage: 'User profile deleted successfully',
      errorMessage: 'Failed to delete user profile',
    },
  });
};

/**
 * Delete channel summary
 */
export const useDeleteSlackChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, workspaceId }: { channelId: string; workspaceId?: string }) =>
      slackApiService.deleteChannelSummary(channelId, workspaceId),
    onSuccess: () => {
      // Invalidate channels list
      queryClient.invalidateQueries({ queryKey: ['slack', 'channels'] });
    },
    meta: {
      successMessage: 'Channel summary deleted successfully',
      errorMessage: 'Failed to delete channel summary',
    },
  });
};
