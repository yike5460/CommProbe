/**
 * TypeScript Type Definitions for Legal Tech Intelligence Dashboard
 *
 * This file contains all the type definitions for API responses,
 * component props, and application state management.
 *
 * Based on the OpenAPI schema and component specifications.
 */

// ================================
// API Request/Response Types
// ================================

// Platform Types (NEW - Twitter & Slack Integration)
export type Platform = 'reddit' | 'twitter' | 'slack';

// Crawl Trigger Types
export interface CrawlTriggerRequest {
  platforms?: Platform[];  // NEW: Platform selection (default: both)
  subreddits?: string[];
  crawl_type?: 'crawl' | 'search' | 'both';
  days_back?: number;
  min_score?: number;
  twitter_config?: TwitterConfig;  // NEW: Twitter-specific configuration
}

// Twitter Configuration (NEW)
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
  parameters: {
    manual_trigger: boolean;
    trigger_time: string;
    trigger_source: string;
    request_id: string;
    subreddits?: string[];
    crawl_type?: string;
    days_back?: number;
    min_score?: number;
  };
}

// Execution Status Types
export interface JobStatusResponse {
  executionArn: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  startDate: string;
  stopDate?: string;
  input: Record<string, any>;
  output?: {
    statusCode: number;
    insights_stored?: number;
    high_priority_count?: number;
    alerts?: Array<{
      post_id: string;
      priority: number;
      summary: string;
      action: string;
    }>;
    timestamp?: string;
  };
}

export interface ExecutionListResponse {
  executions: ExecutionSummary[];
  count: number;
}

export interface ExecutionSummary {
  executionArn: string;
  name: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  startDate: string;
  stopDate?: string;
}

// Insights Types
export interface InsightsListParams {
  platform?: Platform;  // NEW: Filter by platform
  priority_min?: number;
  priority_max?: number;
  category?: FeatureCategory;
  user_segment?: UserSegment;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface InsightsListResponse {
  data: InsightSummary[];
  pagination: {
    limit: number;
    count: number;
    hasMore: boolean;
  };
  filters: {
    platform?: Platform;  // NEW: Platform filter
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
  feature_category: FeatureCategory;
  user_segment: UserSegment;
  source_type: Platform;  // NEW: Platform source
  subreddit?: string;  // Optional: Only for Reddit
  analyzed_at: string;
  action_required: boolean;
  suggested_action: string;
  competitors_mentioned: string[];
  platform_metadata?: PlatformMetadata;  // NEW: Platform-specific data
}

export interface InsightDetailsResponse {
  data: InsightDetails;
}

export interface InsightDetails {
  insight_id: string;
  post_id: string;
  post_url: string;
  source_type: Platform;  // NEW: Platform source
  subreddit?: string;  // Optional: Only for Reddit
  timestamp: number;
  analyzed_at: string;
  collected_at: string;

  // Feature Analysis
  feature_summary: string;
  feature_details: string;
  feature_category: FeatureCategory;
  priority_score: number;
  implementation_size: ImplementationSize;

  // User Context
  user_segment: UserSegment;
  ai_readiness: AiReadiness;

  // Competitive Intelligence
  competitors_mentioned: string[];
  supio_mentioned: boolean;
  competitive_advantage: string;

  // Action Items
  action_required: boolean;
  suggested_action: string;
  pain_points: string[];

  // Post Metadata (Reddit-specific, optional)
  post_score?: number;
  num_comments?: number;

  // Platform Metadata (NEW)
  platform_metadata?: PlatformMetadata;
}

// Platform Metadata Types (NEW - Twitter Integration)
export type PlatformMetadata = RedditMetadata | TwitterMetadata;

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

// ================================
// Slack Integration Types (NEW!)
// ================================

// Slack Analysis Types
export type SlackAnalysisType = 'user' | 'channel' | 'workspace';

export interface SlackUserProfile {
  user_id: string;
  workspace_id: string;
  user_email: string;
  user_name: string;
  display_name?: string;
  total_channels: number;
  active_channels: number;
  total_messages: number;
  total_replies: number;
  total_activity: number;
  analysis_date: string;
  analysis_period_days: number;
  interests: string[];
  expertise_areas: string[];
  communication_style: string;
  key_opinions: string[];
  pain_points: string[];
  influence_level: 'high' | 'medium' | 'low';
  channel_breakdown: ChannelActivity[];
  ai_insights: string;
  ai_persona_summary: string;
  ai_tokens_used: number;
  last_updated: number;
}

export interface ChannelActivity {
  channel_id: string;
  channel_name: string;
  message_count: number;
  reply_count: number;
  last_activity: string;
  ai_summary: string;
}

export interface SlackChannelSummary {
  channel_id: string;
  workspace_id: string;
  channel_name: string;
  is_private: boolean;
  num_members: number;
  analysis_date: string;
  analysis_period_days: number;
  messages_analyzed: number;
  channel_purpose: string;
  key_topics: string[];
  feature_requests: string[];
  pain_points: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  key_contributors: KeyContributor[];
  product_opportunities: string[];
  strategic_recommendations: string[];
  ai_summary: string;
  ai_tokens_used: number;
  last_updated: number;
}

export interface KeyContributor {
  user_id: string;
  user_name: string;
  contribution_level: 'high' | 'medium' | 'low';
}

// Slack API Request/Response Types
export interface SlackAnalysisRequest {
  analysis_type: SlackAnalysisType;
  user_email?: string;
  user_id?: string;
  channel_name?: string;
  channel_id?: string;
  days?: number;
  workspace_id?: string;
}

export interface SlackAnalysisResponse {
  message: string;
  request_id: string;
  estimated_completion?: string;
}

export interface SlackUserListResponse {
  users: SlackUserProfile[];
  count: number;
  workspace_id: string;
}

export interface SlackChannelListResponse {
  channels: SlackChannelSummary[];
  count: number;
  workspace_id: string;
}

// Analytics Types
export interface AnalyticsParams {
  platform?: Platform;  // NEW: Filter by platform
  period?: '7d' | '30d' | '90d';
  group_by?: string;
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

// Trends Types
export interface TrendsParams {
  metric?: 'priority_score' | 'insights_count' | 'avg_score';
  period?: '7d' | '30d' | '90d';
  group_by?: 'day' | 'week' | 'month';
}

export interface TrendsResponse {
  data: {
    metric: string;
    period: string;
    group_by: string;
    date_range: {
      start: string;
      end: string;
    };
    trend_points: TrendPoint[];
    summary: {
      trend_direction: 'increasing' | 'decreasing' | 'stable';
      volatility: number;
      total_data_points: number;
      avg_value: number;
    };
  };
  meta: {
    generated_at: string;
    total_insights_analyzed: number;
  };
}

export interface TrendPoint {
  date: string;
  value: number;
  count: number;
}

// Competitor Analysis Types
export interface CompetitorParams {
  competitor?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  limit?: number;
}

export interface CompetitorResponse {
  data: {
    competitors: CompetitorData[];
    market_analysis: {
      market_leader?: string;
      total_competitors_mentioned: number;
      avg_mentions_per_competitor: number;
      most_discussed_categories: Record<string, number>;
    };
  };
  filters: {
    competitor?: string;
    sentiment?: string;
    limit: number;
  };
  meta: {
    generated_at: string;
    total_insights_analyzed: number;
  };
}

export interface CompetitorData {
  name: string;
  total_mentions: number;
  avg_priority: number;
  categories: Record<string, number>;
  user_segments: Record<string, number>;
  sentiment_breakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  insights: Array<{
    insight_id: string;
    priority_score: number;
    feature_summary: string;
    competitive_advantage: string;
    analyzed_at: string;
    subreddit: string;
  }>;
}

// Configuration Types
export interface SystemConfigurationResponse {
  crawl_settings: {
    default_subreddits: string[];
    default_crawl_type: 'crawl' | 'search' | 'both';
    default_days_back: number;
    default_min_score: number;
    max_posts_per_crawl: number;
    // Twitter settings (NEW)
    twitter_enabled?: boolean;
    twitter_lookback_days?: number;
    twitter_min_engagement?: number;
    twitter_api_tier?: 'free' | 'basic' | 'pro';
    twitter_search_queries?: string[];
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

export interface ConfigurationUpdateRequest {
  crawl_settings?: Partial<SystemConfigurationResponse['crawl_settings']>;
  analysis_settings?: Partial<SystemConfigurationResponse['analysis_settings']>;
  storage_settings?: Partial<SystemConfigurationResponse['storage_settings']>;
  system_settings?: Partial<SystemConfigurationResponse['system_settings']>;
}

export interface ConfigurationUpdateResponse {
  message: string;
  updated_sections: string[];
  timestamp: string;
  updated_by: string;
}

// Health Check Types
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

// Execution Logs Types
export interface ExecutionLogsParams {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'ALL';
  limit?: number;
  start_time?: string;
}

export interface ExecutionLogsResponse {
  data: {
    execution_name: string;
    execution_arn: string;
    execution_status: string;
    logs: LogEntry[];
    log_summary: {
      total_events: number;
      filtered_logs: number;
      error_count: number;
      execution_duration?: string;
    };
  };
  filters: {
    level: string;
    limit: number;
    start_time?: string;
  };
  meta: {
    generated_at: string;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  event_type: string;
  message: string;
  details: Record<string, any>;
}

// ================================
// Enum Types
// ================================

export type FeatureCategory =
  | 'document_automation'
  | 'workflow_management'
  | 'ai_integration'
  | 'case_management'
  | 'billing_automation'
  | 'client_communication'
  | 'legal_research'
  | 'compliance_tracking';

export type UserSegment =
  | 'large_law_firm'
  | 'mid_size_firm'
  | 'solo_practitioner'
  | 'corporate_legal'
  | 'government_legal'
  | 'legal_tech_vendor';

export type ImplementationSize = 'small' | 'medium' | 'large' | 'enterprise';

export type AiReadiness = 'low' | 'medium' | 'high';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

// ================================
// Component Props Types
// ================================

// Card Component Props
export interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  loading?: boolean;
}

export interface InsightCardProps {
  insight: InsightSummary;
  onViewDetails: (id: string) => void;
  onExport: (id: string) => void;
}

// Table Component Props
export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    pageSize: number;
    serverSide?: boolean;
  };
  filters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
}

// Filter Component Props
export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterProps {
  title: string;
  options: FilterOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
}

// Chart Component Props
export interface ChartProps {
  data: any[];
  loading?: boolean;
  height?: number;
  className?: string;
}

export interface TrendChartProps extends ChartProps {
  metric: 'priority_score' | 'insights_count' | 'avg_score';
  timeframe: '7d' | '30d' | '90d';
}

export interface CompetitorChartProps extends ChartProps {
  competitors: CompetitorData[];
}

// Modal Component Props
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface InsightDetailModalProps {
  insight: InsightDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport?: (insight: InsightDetails) => void;
}

// Platform Component Props (NEW - Twitter & Slack Integration)
export type PlatformValue = 'all' | 'reddit' | 'twitter' | 'slack';

export interface PlatformFilterProps {
  value: PlatformValue;
  onChange: (value: PlatformValue) => void;
  className?: string;
  disabled?: boolean;
}

export interface PlatformBadgeProps {
  platform: Platform;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

export interface TwitterContextViewProps {
  tweetId: string;
  authorUsername: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  engagementScore: number;
  tweetUrl: string;
  language?: string;
}

export interface TwitterConfigSectionProps {
  config: {
    twitter_enabled: boolean;
    twitter_lookback_days: number;
    twitter_min_engagement: number;
    twitter_api_tier: 'free' | 'basic' | 'pro';
  };
  onChange: (updates: Partial<TwitterConfigSectionProps['config']>) => void;
  isLoading?: boolean;
}

// Slack Component Props (NEW!)
export interface SlackUserCardProps {
  user: SlackUserProfile;
  onViewDetails?: (userId: string) => void;
}

export interface SlackChannelCardProps {
  channel: SlackChannelSummary;
  onViewDetails?: (channelId: string) => void;
}

export interface SlackAnalysisTriggerProps {
  type: 'user' | 'channel';
  onSuccess?: (response: SlackAnalysisResponse) => void;
  onError?: (error: Error) => void;
  defaultValues?: Partial<SlackAnalysisRequest>;
}

export interface SlackUserFiltersProps {
  workspaceId: string;
  influenceLevel?: 'all' | 'high' | 'medium' | 'low';
  searchQuery?: string;
  onWorkspaceChange: (workspaceId: string) => void;
  onInfluenceChange: (level: string) => void;
  onSearchChange: (query: string) => void;
}

export interface SlackChannelFiltersProps {
  workspaceId: string;
  sentiment?: 'all' | 'positive' | 'neutral' | 'negative';
  searchQuery?: string;
  onWorkspaceChange: (workspaceId: string) => void;
  onSentimentChange: (sentiment: string) => void;
  onSearchChange: (query: string) => void;
}

// ================================
// State Management Types
// ================================

// App Store (Zustand)
export interface AppState {
  preferences: {
    defaultFilters: InsightsListParams;
    dashboardLayout: string[];
    theme: 'light' | 'dark';
  };

  ui: {
    sidebarCollapsed: boolean;
    activeInsightId: string | null;
    currentView: string;
  };

  // Actions
  setPreferences: (preferences: Partial<AppState['preferences']>) => void;
  toggleSidebar: () => void;
  setActiveInsight: (id: string | null) => void;
}

// API Service Types
export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
}

// React Query Types
export interface QueryMeta {
  errorMessage?: string;
  successMessage?: string;
  skipToast?: boolean;
}

// ================================
// Navigation & Routing Types
// ================================

export interface NavigationItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  active?: boolean;
  children?: NavigationItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

// ================================
// Form Types
// ================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'daterange' | 'slider';
  required?: boolean;
  options?: FilterOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
}

export interface FormData {
  [key: string]: any;
}

// ================================
// Utility Types
// ================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ================================
// Event Handler Types
// ================================

export type ClickHandler = (event: React.MouseEvent) => void;
export type ChangeHandler<T = string> = (value: T) => void;
export type SubmitHandler<T = FormData> = (data: T) => void;
export type SelectHandler<T = any> = (item: T) => void;

// ================================
// Loading & Error States
// ================================

export interface LoadingState {
  loading: boolean;
  error: string | null;
}

export interface AsyncState<T> extends LoadingState {
  data: T | null;
}

export interface PaginatedState<T> extends LoadingState {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

// ================================
// Theme & Styling Types
// ================================

export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorScheme = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type Variant = 'default' | 'outline' | 'ghost' | 'destructive';

// ================================
// Export all types
// ================================

export type {
  // Re-export common types for convenience
  React,
} from 'react';