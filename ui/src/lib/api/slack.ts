/**
 * Slack API Client for Internal Team Analytics
 *
 * Provides type-safe API methods for Slack user and channel analysis
 * Handles authentication, error handling, and response transformation
 */

import {
  SlackAnalysisRequest,
  SlackAnalysisResponse,
  SlackUserProfile,
  SlackChannelSummary,
  SlackUserListResponse,
  SlackChannelListResponse,
} from '@/types';
import { SupioApiError } from '@/services/api';

/**
 * Slack API Service class
 */
export class SlackApiService {
  private baseUrl: string;

  constructor() {
    // Use the same proxy endpoint pattern as main API
    this.baseUrl = '/api/proxy/slack';
  }

  /**
   * Generic request method with error handling
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Construct full URL with proper path handling
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `Slack API request failed with status ${response.status}`;
        let errorDetails: string | undefined;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorDetails = errorData.message || errorData.details;
        } catch {
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
  // User Analysis Endpoints
  // ================================

  /**
   * POST /slack/analyze/user - Trigger user analysis
   */
  async analyzeUser(request: SlackAnalysisRequest): Promise<SlackAnalysisResponse> {
    return this.request('/analyze/user', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        analysis_type: 'user',
      }),
    });
  }

  /**
   * GET /slack/users/{user_id} - Get user profile
   */
  async getUserProfile(userId: string, workspaceId: string = 'default'): Promise<SlackUserProfile> {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    return this.request(`/users/${encodeURIComponent(userId)}?${params}`);
  }

  /**
   * GET /slack/users - List user profiles
   */
  async listUsers(workspaceId: string = 'default', limit: number = 50): Promise<SlackUserListResponse> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      limit: limit.toString(),
    });
    return this.request(`/users?${params}`);
  }

  // ================================
  // Channel Analysis Endpoints
  // ================================

  /**
   * POST /slack/analyze/channel - Trigger channel analysis
   */
  async analyzeChannel(request: SlackAnalysisRequest): Promise<SlackAnalysisResponse> {
    return this.request('/analyze/channel', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        analysis_type: 'channel',
      }),
    });
  }

  /**
   * GET /slack/channels/{channel_id} - Get channel summary
   */
  async getChannelSummary(
    channelId: string,
    workspaceId: string = 'default'
  ): Promise<SlackChannelSummary> {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    return this.request(`/channels/${encodeURIComponent(channelId)}?${params}`);
  }

  /**
   * GET /slack/channels - List channel summaries
   */
  async listChannels(
    workspaceId: string = 'default',
    limit: number = 50
  ): Promise<SlackChannelListResponse> {
    const params = new URLSearchParams({
      workspace_id: workspaceId,
      limit: limit.toString(),
    });
    return this.request(`/channels?${params}`);
  }

  // ================================
  // Utility Methods
  // ================================

  /**
   * Get API base URL (for debugging)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ================================
// Singleton instance
// ================================

/**
 * Singleton Slack API service instance
 */
export const slackApiService = new SlackApiService();

// ================================
// Utility functions
// ================================

/**
 * Build Slack analysis request from form values
 */
export function buildSlackAnalysisRequest(
  type: 'user' | 'channel',
  values: Record<string, any>
): SlackAnalysisRequest {
  const request: SlackAnalysisRequest = {
    analysis_type: type,
    days: values.days ? Number(values.days) : 30,
    workspace_id: values.workspace_id || 'default',
  };

  if (type === 'user') {
    if (values.user_email) request.user_email = values.user_email;
    if (values.user_id) request.user_id = values.user_id;
  } else {
    if (values.channel_name) request.channel_name = values.channel_name;
    if (values.channel_id) request.channel_id = values.channel_id;
  }

  return request;
}

/**
 * Filter users by influence level
 */
export function filterUsersByInfluence(
  users: SlackUserProfile[],
  level: 'all' | 'high' | 'medium' | 'low'
): SlackUserProfile[] {
  if (level === 'all') return users;
  return users.filter((user) => user.influence_level === level);
}

/**
 * Filter channels by sentiment
 */
export function filterChannelsBySentiment(
  channels: SlackChannelSummary[],
  sentiment: 'all' | 'positive' | 'neutral' | 'negative'
): SlackChannelSummary[] {
  if (sentiment === 'all') return channels;
  return channels.filter((channel) => channel.sentiment === sentiment);
}

/**
 * Search users by name or email
 */
export function searchUsers(users: SlackUserProfile[], query: string): SlackUserProfile[] {
  if (!query) return users;
  const lowerQuery = query.toLowerCase();
  return users.filter(
    (user) =>
      user.user_name.toLowerCase().includes(lowerQuery) ||
      user.user_email.toLowerCase().includes(lowerQuery) ||
      (user.display_name && user.display_name.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Search channels by name
 */
export function searchChannels(channels: SlackChannelSummary[], query: string): SlackChannelSummary[] {
  if (!query) return channels;
  const lowerQuery = query.toLowerCase();
  return channels.filter((channel) => channel.channel_name.toLowerCase().includes(lowerQuery));
}

/**
 * Sort users by activity level
 */
export function sortUsersByActivity(
  users: SlackUserProfile[],
  direction: 'asc' | 'desc' = 'desc'
): SlackUserProfile[] {
  return [...users].sort((a, b) => {
    const diff = a.total_activity - b.total_activity;
    return direction === 'desc' ? -diff : diff;
  });
}

/**
 * Sort channels by messages analyzed
 */
export function sortChannelsByActivity(
  channels: SlackChannelSummary[],
  direction: 'asc' | 'desc' = 'desc'
): SlackChannelSummary[] {
  return [...channels].sort((a, b) => {
    const diff = a.messages_analyzed - b.messages_analyzed;
    return direction === 'desc' ? -diff : diff;
  });
}
