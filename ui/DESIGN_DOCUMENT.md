# Legal Tech Intelligence Dashboard - UI/UX Design Document

## Executive Summary

This document outlines the comprehensive UI/UX design for the Legal Community Feedback Collector & Analyzer frontend application. The system provides product managers and legal tech professionals with actionable insights from Reddit communities, competitive intelligence, and data-driven feature prioritization tools.

**Technology Stack:**
- **Framework:** Next.js 15.0.0 (App Router)
- **React:** React 19.1.0 with React DOM 19.1.0
- **Styling:** Tailwind CSS v4 + shadcn/ui components + lucide-react icons
- **Deployment:** Cloudflare Pages with @cloudflare/next-on-pages adapter
- **State Management:** TanStack Query (React Query v5) + Zustand v5
- **Charts:** Recharts v3 + date-fns for formatting
- **API Integration:** 14 REST endpoints via `/api/proxy` to avoid CORS

---

## 1. User Personas & Requirements

### Primary User: Product Manager
- **Goals:** Identify high-priority feature requests, track competitive landscape, validate product decisions
- **Pain Points:** Information overload, scattered feedback sources, difficulty prioritizing features
- **Key Workflows:** Morning insight review, weekly roadmap planning, competitive analysis
- **Success Metrics:** Time to identify actionable insights, accuracy of feature prioritization

### Secondary User: Legal Tech Professional
- **Goals:** Stay informed on industry trends, understand user sentiment, identify market opportunities
- **Pain Points:** Manual monitoring of communities, lack of structured analysis
- **Key Workflows:** Market research, trend analysis, competitor tracking

---

## 2. Information Architecture

### 2.1 Application Structure

```
/ (root page.tsx)      # Landing page
/dashboard             # Executive dashboard with KPIs
/insights              # Feature request explorer with filtering
/analytics             # Data visualization and summaries
/trends                # Historical trend analysis (separate page)
/operations            # Pipeline execution monitoring
/config                # System configuration management
/api/proxy/[...path]   # API proxy to avoid CORS issues
```

### 2.2 Navigation Hierarchy

**Top-Level Navigation (Sidebar):**
1. **Dashboard** - Overview with KPIs and recent insights
2. **Insights** - Feature request explorer with filtering
3. **Analytics** - Summary analytics dashboard
4. **Trends** - Historical trend analysis charts
5. **Operations** - Pipeline execution monitoring
6. **Config** - System configuration settings

**Layout Components:**
- AppLayout: Main layout wrapper with Sidebar + Header
- Sidebar: Navigation menu with icons (using lucide-react)
- Header: Page title and user actions
- QueryProvider: TanStack Query setup
- ThemeProvider: Theme context (future dark mode support)

---

## 3. Design System & Visual Language

### 3.1 Color Palette

```css
/* Primary Colors - Professional Legal Tech */
--primary-50: #f0f9ff;    /* Light blue background */
--primary-100: #e0f2fe;   /* Card backgrounds */
--primary-500: #0ea5e9;   /* Primary actions */
--primary-600: #0284c7;   /* Primary hover */
--primary-900: #0c4a6e;   /* Dark text */

/* Secondary Colors - Data Visualization */
--success-500: #10b981;   /* Positive metrics */
--warning-500: #f59e0b;   /* Medium priority */
--error-500: #ef4444;     /* High priority alerts */
--neutral-100: #f5f5f5;   /* Background */
--neutral-800: #1f2937;   /* Primary text */

/* Priority Score Colors */
--priority-low: #6b7280;     /* Score 1-3 */
--priority-medium: #f59e0b;  /* Score 4-6 */
--priority-high: #ef4444;    /* Score 7-8 */
--priority-critical: #dc2626; /* Score 9-10 */
```

### 3.2 Typography

```css
/* Font Families (Tailwind CSS defaults) */
--font-sans: system-ui, -apple-system, sans-serif;  /* UI text */
--font-mono: ui-monospace, monospace;               /* Code/data */

/* Type Scale (Tailwind CSS v4) */
--text-xs: 0.75rem;    /* Labels, captions */
--text-sm: 0.875rem;   /* Body text, descriptions */
--text-base: 1rem;     /* Default body */
--text-lg: 1.125rem;   /* Subheadings */
--text-xl: 1.25rem;    /* Section titles */
--text-2xl: 1.5rem;    /* Page titles */
--text-3xl: 1.875rem;  /* Dashboard headers */
```

### 3.3 Component Architecture (shadcn/ui)

**Core Components:**
- `Card` - Container for insights and metrics
- `Badge` - Priority scores and categories
- `Button` - Actions and navigation
- `DataTable` - Insights listing with sorting/filtering
- `Dialog` - Insight details and configuration
- `Tabs` - Analytics section switching
- `Progress` - Loading states and metrics
- `Alert` - System notifications and errors
- `Select` - Dropdowns for filters (including platform filter)

### 3.4 Multi-Platform Visual Language (NEW!)

The UI now supports insights from multiple platforms (Reddit and Twitter). Visual distinction is critical for user understanding.

**Platform Color Scheme:**
```css
/* Reddit Platform */
--reddit-primary: #ff4500;    /* Reddit orange */
--reddit-bg: #fef2f2;         /* Light orange background */
--reddit-text: #991b1b;       /* Dark red text */

/* Twitter Platform */
--twitter-primary: #1da1f2;   /* Twitter blue */
--twitter-bg: #eff6ff;        /* Light blue background */
--twitter-text: #1e40af;      /* Dark blue text */

/* Multi-Platform (Both) */
--multi-primary: #6366f1;     /* Indigo */
--multi-bg: #f5f3ff;          /* Light purple background */
--multi-text: #4338ca;        /* Dark indigo text */
```

**Platform Icons:**
- **Reddit**: `MessageSquare` icon from lucide-react (or Reddit alien icon)
- **Twitter**: `Twitter` icon from lucide-react (bird icon)
- **Multi-Platform**: `Layers` icon from lucide-react

**Platform Badges:**
```tsx
<Badge className="bg-reddit-bg text-reddit-text">
  <MessageSquare className="h-3 w-3 mr-1" />
  Reddit
</Badge>

<Badge className="bg-twitter-bg text-twitter-text">
  <Twitter className="h-3 w-3 mr-1" />
  Twitter
</Badge>

<Badge className="bg-multi-bg text-multi-text">
  <Layers className="h-3 w-3 mr-1" />
  All Platforms
</Badge>
```

**Platform Filter Dropdown:**
```tsx
<Select value={platform} onValueChange={setPlatform}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="All Platforms" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">
      <Layers className="h-4 w-4 inline mr-2" />
      All Platforms
    </SelectItem>
    <SelectItem value="reddit">
      <MessageSquare className="h-4 w-4 inline mr-2" />
      Reddit Only
    </SelectItem>
    <SelectItem value="twitter">
      <Twitter className="h-4 w-4 inline mr-2" />
      Twitter Only
    </SelectItem>
  </SelectContent>
</Select>
```

---

## 4. Page-by-Page Design Specifications

### 4.1 Dashboard Overview (`/dashboard`)

**Layout:** 12-column grid with responsive breakpoints
**Key Components:**

```tsx
// Dashboard Layout Structure
<div className="grid grid-cols-12 gap-6 p-6">
  {/* KPI Summary Cards */}
  <div className="col-span-12 lg:col-span-8">
    <KPISummaryGrid />
  </div>

  {/* Quick Actions Panel */}
  <div className="col-span-12 lg:col-span-4">
    <QuickActionsPanel />
  </div>

  {/* High Priority Insights */}
  <div className="col-span-12 lg:col-span-8">
    <HighPriorityInsights />
  </div>

  {/* Recent Activity Feed */}
  <div className="col-span-12 lg:col-span-4">
    <ActivityFeed />
  </div>

  {/* Analytics Preview */}
  <div className="col-span-12">
    <AnalyticsPreview />
  </div>
</div>
```

**KPI Cards Design:**
```tsx
interface KPICard {
  title: string;
  value: number | string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// Example KPIs
const kpis = [
  {
    title: "High Priority Insights",
    value: 23,
    change: +15,
    trend: 'up',
    priority: 'high'
  },
  {
    title: "New Feature Requests",
    value: 127,
    change: +8,
    trend: 'up',
    priority: 'medium'
  },
  {
    title: "Competitor Mentions",
    value: 45,
    change: -5,
    trend: 'down',
    priority: 'low'
  }
];
```

### 4.2 Insights Explorer (`/insights`)

**Primary View:** Data table with advanced filtering
**Secondary Views:** Category grouping, priority queue, detail modal

```tsx
// Insights Page with Platform Filter
<div className="flex flex-col gap-4">
  {/* Platform Filter Bar */}
  <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
    <label className="text-sm font-medium">Platform:</label>
    <PlatformFilter value={platform} onChange={setPlatform} />
    <div className="ml-auto flex gap-2">
      <Badge variant="outline">{filteredCount} insights</Badge>
    </div>
  </div>

  {/* Insights Table */}
  <DataTable
    columns={[
      { key: 'platform_badge', label: 'Source', render: (row) => <PlatformBadge platform={row.source_type} /> },
      { key: 'priority_score', label: 'Priority', sortable: true },
      { key: 'feature_summary', label: 'Feature Request', searchable: true },
      { key: 'feature_category', label: 'Category', filterable: true },
      { key: 'user_segment', label: 'User Segment', filterable: true },
      { key: 'analyzed_at', label: 'Date', sortable: true },
      { key: 'actions', label: 'Actions' }
    ]}
    data={insights}
    filters={{
      platform: { type: 'select', options: ['all', 'reddit', 'twitter'] },  // NEW!
      priority_min: { type: 'slider', range: [1, 10] },
      category: { type: 'multiselect', options: categories },
      user_segment: { type: 'multiselect', options: segments },
      date_range: { type: 'daterange' }
    }}
    pagination={{
      pageSize: 50,
      serverSide: true
    }}
  />
</div>
```

**Filter Panel Design:**
- **Platform Filter** (NEW!) - Prominent dropdown at the top
- Collapsible sidebar with advanced filter controls
- Real-time filter application with URL state persistence
- Filter preset management (save/load common filters)
- Clear filters and reset functionality
- Platform filter shows insight count per platform

**Insight Detail Modal:**
```tsx
// Detailed insight view with platform-specific context
<Dialog>
  <DialogHeader>
    <div className="flex items-center gap-2">
      <PlatformBadge platform={insight.source_type} size="lg" />
      <PriorityBadge score={insight.priority_score} />
    </div>
    <h2>{insight.feature_summary}</h2>
  </DialogHeader>

  <DialogContent>
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Feature Details</TabsTrigger>
        <TabsTrigger value="source">
          {insight.source_type === 'reddit' ? 'Reddit Context' : 'Twitter Context'}
        </TabsTrigger>
        <TabsTrigger value="competitive">Competitive Intel</TabsTrigger>
        <TabsTrigger value="actions">Action Items</TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <FeatureDetailsView insight={insight} />
      </TabsContent>

      <TabsContent value="source">
        {insight.source_type === 'reddit' ? (
          <RedditContextView
            postUrl={insight.post_url}
            subreddit={insight.platform_metadata?.subreddit}
            postScore={insight.platform_metadata?.post_score}
            upvoteRatio={insight.platform_metadata?.upvote_ratio}
            flair={insight.platform_metadata?.flair}
          />
        ) : (
          <TwitterContextView
            tweetId={insight.platform_metadata?.tweet_id}
            authorUsername={insight.platform_metadata?.author_username}
            likes={insight.platform_metadata?.likes}
            retweets={insight.platform_metadata?.retweets}
            replies={insight.platform_metadata?.replies}
            quotes={insight.platform_metadata?.quotes}
            engagementScore={insight.platform_metadata?.engagement_score}
            tweetUrl={insight.post_url}
          />
        )}
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

**Platform-Specific Context Views:**

**RedditContextView Component:**
- Subreddit badge with link
- Post score and upvote ratio
- Number of comments
- Flair tag (if available)
- Direct link to Reddit post

**TwitterContextView Component:**
- Author username with @ symbol
- Tweet engagement metrics (likes, retweets, replies, quotes)
- Total engagement score
- Tweet language indicator
- Direct link to Twitter status

### 4.3 Analytics Dashboard (`/analytics`)

**Trends View (`/analytics/trends`):**
- Interactive time-series charts using Recharts
- Metric selection (priority_score, insights_count, avg_score)
- Time period controls (7d, 30d, 90d)
- Trend direction indicators with statistical significance

```tsx
// Trend Chart Component
<Card>
  <CardHeader>
    <div className="flex justify-between items-center">
      <h3>Historical Trends</h3>
      <TrendControls />
    </div>
  </CardHeader>

  <CardContent>
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0ea5e9"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  </CardContent>
</Card>
```

**Competitive Intelligence View (`/analytics/competitors`):**
- Competitor comparison matrix
- Sentiment analysis visualization
- Market positioning charts
- Feature gap analysis

```tsx
// Competitive Intelligence Layout
<div className="space-y-6">
  <CompetitorOverview competitors={competitorData} />

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <SentimentAnalysisChart />
    <MarketShareChart />
  </div>

  <FeatureGapMatrix />
</div>
```

### 4.4 Operations Panel (`/operations`)

**Execution Monitoring (`/operations/executions`):**
- Real-time pipeline status dashboard
- Execution history with status indicators
- Manual trigger controls
- Performance metrics and error tracking

```tsx
// Execution Status Dashboard
<div className="space-y-6">
  <ExecutionOverview />

  <Card>
    <CardHeader>
      <h3>Recent Executions</h3>
      <ManualTriggerButton />
    </CardHeader>

    <CardContent>
      <DataTable
        columns={[
          { key: 'name', label: 'Execution Name' },
          { key: 'status', label: 'Status', render: StatusBadge },
          { key: 'startDate', label: 'Started' },
          { key: 'duration', label: 'Duration' },
          { key: 'actions', label: 'Actions' }
        ]}
        data={executions}
      />
    </CardContent>
  </Card>
</div>
```

---

## 5. Component Library Specifications

### 5.1 Custom Components

**PriorityBadge Component:**
```tsx
interface PriorityBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  score,
  size = 'md',
  showLabel = true
}) => {
  const getVariant = (score: number) => {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  };

  return (
    <Badge variant={getVariant(score)} size={size}>
      {showLabel && 'Priority '}
      {score}/10
    </Badge>
  );
};
```

**InsightCard Component:**
```tsx
interface InsightCardProps {
  insight: Insight;
  onViewDetails: (id: string) => void;
  onExport: (id: string) => void;
}

const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  onViewDetails,
  onExport
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <PriorityBadge score={insight.priority_score} />
            <h3 className="font-semibold mt-2">{insight.feature_summary}</h3>
            <p className="text-sm text-neutral-600">
              {insight.feature_category} • {insight.user_segment}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onViewDetails(insight.insight_id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(insight.insight_id)}>
                Export to JIRA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm mb-4">{insight.feature_details?.substring(0, 200)}...</p>

        <div className="flex justify-between items-center text-xs text-neutral-500">
          <span>r/{insight.subreddit}</span>
          <span>{formatDistanceToNow(new Date(insight.analyzed_at))}</span>
        </div>

        {insight.competitors_mentioned?.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1">
              {insight.competitors_mentioned.map(competitor => (
                <Badge key={competitor} variant="outline" size="sm">
                  {competitor}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### 5.2 Data Visualization Components

**MetricChart Component:**
```tsx
interface MetricChartProps {
  data: Array<{ date: string; value: number; count: number }>;
  metric: 'priority_score' | 'insights_count' | 'avg_score';
  timeframe: '7d' | '30d' | '90d';
}

const MetricChart: React.FC<MetricChartProps> = ({ data, metric, timeframe }) => {
  const formatValue = (value: number) => {
    switch (metric) {
      case 'priority_score':
      case 'avg_score':
        return value.toFixed(1);
      case 'insights_count':
        return value.toString();
      default:
        return value.toString();
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
          </linearGradient>
        </defs>

        <XAxis
          dataKey="date"
          tickFormatter={(date) => format(new Date(date), 'MMM d')}
        />
        <YAxis tickFormatter={formatValue} />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip
          labelFormatter={(date) => format(new Date(date), 'PPP')}
          formatter={(value) => [formatValue(value as number), metric]}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke="#0ea5e9"
          fillOpacity={1}
          fill="url(#colorValue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
```

---

## 6. API Integration Architecture

### 6.1 API Service Layer

```typescript
// services/api.ts
class SupioApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL!;
    this.apiKey = process.env.NEXT_PUBLIC_API_KEY!;
  }

  // Core API methods matching the 14 endpoints
  async getInsights(params: InsightsListParams): Promise<InsightsListResponse> {
    return this.request('/insights', { params });
  }

  async getInsightDetails(insightId: string): Promise<InsightDetailsResponse> {
    return this.request(`/insights/${encodeURIComponent(insightId)}`);
  }

  async getAnalyticsSummary(params: AnalyticsParams): Promise<AnalyticsSummaryResponse> {
    return this.request('/analytics/summary', { params });
  }

  async getAnalyticsTrends(params: TrendsParams): Promise<TrendsResponse> {
    return this.request('/analytics/trends', { params });
  }

  async getCompetitorAnalysis(params: CompetitorParams): Promise<CompetitorResponse> {
    return this.request('/analytics/competitors', { params });
  }

  async triggerCrawl(params?: CrawlTriggerRequest): Promise<CrawlTriggerResponse> {
    return this.request('/trigger', { method: 'POST', body: params });
  }

  async getExecutionStatus(executionName: string): Promise<JobStatusResponse> {
    return this.request(`/status/${executionName}`);
  }

  async listExecutions(): Promise<ExecutionListResponse> {
    return this.request('/executions');
  }

  private async request(endpoint: string, options: RequestOptions = {}): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }
}
```

### 6.2 React Query Integration

```typescript
// hooks/useInsights.ts
export const useInsights = (params: InsightsListParams) => {
  return useQuery({
    queryKey: ['insights', params],
    queryFn: () => apiService.getInsights(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useInsightDetails = (insightId: string) => {
  return useQuery({
    queryKey: ['insight', insightId],
    queryFn: () => apiService.getInsightDetails(insightId),
    enabled: !!insightId,
  });
};

export const useAnalyticsSummary = (params: AnalyticsParams) => {
  return useQuery({
    queryKey: ['analytics', 'summary', params],
    queryFn: () => apiService.getAnalyticsSummary(params),
    staleTime: 15 * 60 * 1000, // 15 minutes for analytics
  });
};

// Mutations for actions
export const useTriggerCrawl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CrawlTriggerRequest) => apiService.triggerCrawl(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });
};
```

---

## 7. State Management Strategy

### 7.1 Global State (Zustand)

```typescript
// stores/appStore.ts
interface AppState {
  // User preferences
  preferences: {
    defaultFilters: InsightsListParams;
    dashboardLayout: string[];
    theme: 'light' | 'dark';
  };

  // UI state
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

export const useAppStore = create<AppState>((set) => ({
  preferences: {
    defaultFilters: { priority_min: 5, limit: 50 },
    dashboardLayout: ['kpis', 'insights', 'analytics'],
    theme: 'light',
  },

  ui: {
    sidebarCollapsed: false,
    activeInsightId: null,
    currentView: 'dashboard',
  },

  setPreferences: (preferences) =>
    set((state) => ({
      preferences: { ...state.preferences, ...preferences },
    })),

  toggleSidebar: () =>
    set((state) => ({
      ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed },
    })),

  setActiveInsight: (id) =>
    set((state) => ({
      ui: { ...state.ui, activeInsightId: id },
    })),
}));
```

### 7.2 URL State Management

```typescript
// hooks/useURLState.ts
export const useInsightsFilters = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => ({
    priority_min: Number(searchParams.get('priority_min')) || 0,
    priority_max: Number(searchParams.get('priority_max')) || 10,
    category: searchParams.get('category') || undefined,
    user_segment: searchParams.get('user_segment') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    limit: Number(searchParams.get('limit')) || 50,
  }), [searchParams]);

  const setFilters = useCallback((newFilters: Partial<InsightsListParams>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, value.toString());
      } else {
        params.delete(key);
      }
    });

    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  return { filters, setFilters };
};
```

---

## 8. Performance Optimization

### 8.1 Code Splitting Strategy

```typescript
// Dynamic imports for heavy components
const AnalyticsDashboard = dynamic(() => import('../components/AnalyticsDashboard'), {
  loading: () => <AnalyticsLoadingSkeleton />,
});

const DataVisualization = dynamic(() => import('../components/DataVisualization'), {
  loading: () => <ChartLoadingSkeleton />,
});

// Route-based code splitting
const OperationsPanel = dynamic(() => import('../pages/operations'), {
  ssr: false, // Client-side only for admin functionality
});
```

### 8.2 Data Loading Patterns

```typescript
// Parallel data fetching on dashboard
export async function generateStaticProps() {
  const queryClient = new QueryClient();

  // Prefetch critical dashboard data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['analytics', 'summary', { period: '7d' }],
      queryFn: () => apiService.getAnalyticsSummary({ period: '7d' }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['insights', { priority_min: 8, limit: 10 }],
      queryFn: () => apiService.getInsights({ priority_min: 8, limit: 10 }),
    }),
  ]);

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 300, // 5 minutes
  };
}
```

### 8.3 Caching Strategy

```typescript
// Service Worker for API caching
// sw.js
const CACHE_NAME = 'supio-api-v1';
const API_CACHE_URLS = [
  '/api/insights',
  '/api/analytics/summary',
  '/api/config',
];

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            // Return cached version while fetching fresh data
            fetch(event.request).then((fetchResponse) => {
              cache.put(event.request, fetchResponse.clone());
            });
            return response;
          }

          return fetch(event.request).then((fetchResponse) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

---

## 9. Cloudflare Deployment Architecture

### 9.1 Pages Configuration

```toml
# wrangler.toml
name = "supio-legal-intelligence"
compatibility_date = "2024-01-01"

[env.production]
route = "dashboard.supio.com/*"

[env.staging]
route = "staging-dashboard.supio.com/*"

[[env.production.services]]
binding = "API"
service = "supio-api-worker"

[build]
command = "npm run build"
destination = "out"

[build.environment_variables]
NEXT_PUBLIC_API_URL = "https://6bsn9muwfi.execute-api.us-west-2.amazonaws.com/v1"
NEXT_PUBLIC_API_KEY = "vPJlvaa0DS9tqxH41eNIA20Sofzb0cG719d8dd0i"
```

### 9.2 API Proxy Implementation (Next.js API Routes)

**IMPORTANT:** The frontend uses a Next.js API route proxy instead of Cloudflare Workers middleware to avoid CORS issues and securely handle API keys.

```typescript
// app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'DELETE');
}

async function handleProxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY!;

    // Build the full API URL
    const path = pathSegments.join('/');
    const url = new URL(path, apiUrl);

    // Copy query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    // Forward the request to AWS API Gateway
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };

    const body = method !== 'GET' ? await request.text() : undefined;

    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy error', message: error.message },
      { status: 500 }
    );
  }
}
```

**Benefits of this approach:**
- Securely stores API key on server-side (not exposed to client)
- Avoids CORS preflight requests
- Simplifies frontend API calls (no need for API key in client code)
- Works seamlessly with Cloudflare Pages deployment

---

## 10. Error Handling & Loading States

### 10.1 Error Boundaries

```tsx
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo);

    // Send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Sentry, LogRocket, etc.
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Alert variant="destructive" className="m-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Something went wrong</AlertTitle>
    <AlertDescription>
      {error.message || 'An unexpected error occurred. Please try refreshing the page.'}
    </AlertDescription>
  </Alert>
);
```

### 10.2 Loading Skeletons

```tsx
// components/LoadingSkeletons.tsx
export const InsightsTableSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-4 w-[200px]" />
    </CardHeader>

    <CardContent>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[300px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
            <Skeleton className="h-4 w-[100px]" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const ChartLoadingSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-4 w-[150px]" />
    </CardHeader>

    <CardContent>
      <div className="space-y-4">
        <div className="flex justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </CardContent>
  </Card>
);
```

---

## 11. Testing Strategy

### 11.1 Component Testing

```typescript
// __tests__/components/InsightCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { InsightCard } from '../components/InsightCard';

const mockInsight = {
  insight_id: 'INSIGHT#2025-01-01#PRIORITY#8#ID#test123',
  priority_score: 8,
  feature_summary: 'Document automation for contract review',
  feature_category: 'document_automation',
  user_segment: 'large_law_firm',
  analyzed_at: '2025-01-01T10:00:00Z',
  subreddit: 'LawFirm',
  competitors_mentioned: ['EvenUp', 'Eve'],
};

describe('InsightCard', () => {
  it('renders insight information correctly', () => {
    render(
      <InsightCard
        insight={mockInsight}
        onViewDetails={jest.fn()}
        onExport={jest.fn()}
      />
    );

    expect(screen.getByText('Document automation for contract review')).toBeInTheDocument();
    expect(screen.getByText('Priority 8/10')).toBeInTheDocument();
    expect(screen.getByText('EvenUp')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('calls onViewDetails when detail button is clicked', () => {
    const onViewDetails = jest.fn();
    render(
      <InsightCard
        insight={mockInsight}
        onViewDetails={onViewDetails}
        onExport={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('View Details'));
    expect(onViewDetails).toHaveBeenCalledWith(mockInsight.insight_id);
  });
});
```

### 11.2 API Integration Testing

```typescript
// __tests__/api/apiService.test.ts
import { SupioApiService } from '../services/api';

// Mock fetch
global.fetch = jest.fn();

describe('SupioApiService', () => {
  let apiService: SupioApiService;

  beforeEach(() => {
    apiService = new SupioApiService();
    (fetch as jest.Mock).mockClear();
  });

  it('fetches insights with correct parameters', async () => {
    const mockResponse = {
      data: [mockInsight],
      pagination: { count: 1, hasMore: false },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await apiService.getInsights({
      priority_min: 7,
      category: 'document_automation',
      limit: 10,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/insights?priority_min=7&category=document_automation&limit=10'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': expect.any(String),
        }),
      })
    );

    expect(result).toEqual(mockResponse);
  });
});
```

---

## 12. Accessibility & Internationalization

### 12.1 Accessibility Features

```tsx
// Accessible data table with screen reader support
const AccessibleDataTable: React.FC<DataTableProps> = ({ data, columns }) => {
  return (
    <div role="region" aria-label="Insights data table">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                aria-sort={
                  sortColumn === column.key
                    ? sortDirection === 'asc' ? 'ascending' : 'descending'
                    : 'none'
                }
              >
                {column.sortable ? (
                  <Button
                    variant="ghost"
                    onClick={() => handleSort(column.key)}
                    aria-label={`Sort by ${column.label}`}
                  >
                    {column.label}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((row, index) => (
            <TableRow key={row.id} aria-rowindex={index + 2}>
              {columns.map((column) => (
                <TableCell key={column.key}>
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div
        role="status"
        aria-live="polite"
        aria-label={`Showing ${data.length} results`}
        className="sr-only"
      >
        Showing {data.length} of {totalCount} results
      </div>
    </div>
  );
};
```

### 12.2 Keyboard Navigation

```typescript
// hooks/useKeyboardNavigation.ts
export const useKeyboardNavigation = (items: any[], onSelect: (item: any) => void) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case 'Enter':
          event.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;

        case 'Escape':
          event.preventDefault();
          setSelectedIndex(0);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onSelect]);

  return { selectedIndex, setSelectedIndex };
};
```

---

## 13. Development Workflow

### 13.1 Project Structure

```
/ui/src/
├── app/                    # Next.js 15 App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   ├── globals.css        # Global Tailwind styles
│   ├── dashboard/page.tsx # Dashboard page
│   ├── insights/page.tsx  # Insights explorer
│   ├── analytics/page.tsx # Analytics summary
│   ├── trends/page.tsx    # Trends analysis
│   ├── operations/page.tsx # Operations panel
│   ├── config/page.tsx    # Configuration page
│   └── api/proxy/[...path]/route.ts  # API proxy endpoint
├── components/            # Reusable components
│   ├── ui/               # shadcn/ui components (15 components)
│   ├── layout/           # AppLayout, Header, Sidebar
│   └── providers/        # QueryProvider, ThemeProvider
├── hooks/                # Custom React hooks
│   └── useApi.ts         # React Query hooks for all API calls
├── services/             # API services
│   └── api.ts            # SupioApiService singleton
├── stores/               # Zustand state management
├── types/                # TypeScript definitions
│   └── index.ts          # All API types
├── lib/                  # Utility functions
└── public/               # Static assets
```

### 13.2 Development Commands

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:cf": "npx @cloudflare/next-on-pages@1",
    "preview": "npm run build:cf && wrangler pages dev .vercel/output/static",
    "deploy": "npm run build:cf && wrangler pages deploy .vercel/output/static",
    "start": "next start",
    "lint": "eslint"
  }
}
```

---

## 14. Future Enhancements

### Phase 2 Features (Q2 2025)
- **Advanced Analytics:** Custom dashboard builder, advanced filtering, export capabilities
- **Collaboration:** Team sharing, comment system, assignment workflow
- **Notifications:** Real-time alerts, email digests, Slack integration
- **Mobile App:** React Native companion app for on-the-go access

### Phase 3 Features (Q3 2025)
- **AI Assistant:** Natural language queries, automated insights, predictive recommendations
- **Integration Hub:** JIRA/Linear sync, CRM integration, calendar scheduling
- **White-label:** Customizable branding, multi-tenant architecture
- **Advanced Visualization:** 3D charts, interactive maps, custom chart builder

---

## Conclusion

This UI/UX design document provides a comprehensive foundation for building a professional, scalable, and user-focused legal tech intelligence dashboard. The design prioritizes product manager workflows while maintaining flexibility for future enhancements and integrations.

The combination of Next.js 14, Tailwind CSS, shadcn/ui components, and Cloudflare deployment creates a modern, performant, and cost-effective solution that can scale with Supio's growth.

---

*Document Version: 1.0*
*Last Updated: 2025-01-16*
*Author: UI/UX Design Team*