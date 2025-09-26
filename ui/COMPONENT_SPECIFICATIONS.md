# Component Specifications & Implementation Guide

## Overview

This document provides detailed specifications for implementing the Legal Tech Intelligence Dashboard components using Next.js 14, Tailwind CSS, and shadcn/ui.

---

## Core Component Library

### 1. Layout Components

#### AppLayout
```tsx
// components/layout/AppLayout.tsx
interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title,
  showSidebar = true
}) => {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header title={title} />
      <div className="flex">
        {showSidebar && <Sidebar />}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
```

#### Sidebar Navigation
```tsx
// components/layout/Sidebar.tsx
const navigationItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    active: true
  },
  {
    label: 'Insights',
    href: '/insights',
    icon: Lightbulb,
    badge: '23'
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    children: [
      { label: 'Trends', href: '/analytics/trends' },
      { label: 'Competitors', href: '/analytics/competitors' }
    ]
  },
  {
    label: 'Operations',
    href: '/operations',
    icon: Settings,
    children: [
      { label: 'Executions', href: '/operations/executions' },
      { label: 'Logs', href: '/operations/logs' },
      { label: 'Configuration', href: '/operations/config' }
    ]
  }
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed } = useAppStore();

  return (
    <aside className={cn(
      "bg-white border-r border-neutral-200 transition-all duration-300",
      sidebarCollapsed ? "w-16" : "w-64"
    )}>
      <nav className="p-4 space-y-2">
        {navigationItems.map((item) => (
          <NavigationItem
            key={item.href}
            item={item}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>
    </aside>
  );
};
```

### 2. Data Display Components

#### InsightsDataTable
```tsx
// components/insights/InsightsDataTable.tsx
interface InsightsDataTableProps {
  data: Insight[];
  loading?: boolean;
  onRowClick?: (insight: Insight) => void;
  onExport?: (insight: Insight) => void;
}

export const InsightsDataTable: React.FC<InsightsDataTableProps> = ({
  data,
  loading,
  onRowClick,
  onExport
}) => {
  const columns: ColumnDef<Insight>[] = [
    {
      accessorKey: "priority_score",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Priority
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <PriorityBadge score={row.getValue("priority_score")} />
      ),
    },
    {
      accessorKey: "feature_summary",
      header: "Feature Request",
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="font-medium truncate">{row.getValue("feature_summary")}</p>
          <p className="text-sm text-neutral-500">
            {row.original.feature_category} • {row.original.user_segment}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "subreddit",
      header: "Source",
      cell: ({ row }) => (
        <Badge variant="outline">r/{row.getValue("subreddit")}</Badge>
      ),
    },
    {
      accessorKey: "analyzed_at",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-neutral-600">
          {formatDistanceToNow(new Date(row.getValue("analyzed_at")))} ago
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRowClick?.(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.(row.original)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Export to JIRA
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link className="mr-2 h-4 w-4" />
              View on Reddit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (loading) {
    return <InsightsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={data} />
    </div>
  );
};
```

#### MetricsCard Component
```tsx
// components/dashboard/MetricsCard.tsx
interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  loading?: boolean;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
  description,
  loading
}) => {
  if (loading) {
    return <MetricsCardSkeleton />;
  }

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-neutral-600';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return TrendingUp;
      case 'down': return TrendingDown;
      default: return Minus;
    }
  };

  const TrendIcon = getTrendIcon(trend);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-neutral-600">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-neutral-400" />}
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold text-neutral-900">{value}</div>

        {change !== undefined && (
          <div className={cn("flex items-center text-xs", getTrendColor(trend))}>
            <TrendIcon className="mr-1 h-3 w-3" />
            {change > 0 ? '+' : ''}{change}%
            <span className="ml-1 text-neutral-500">from last week</span>
          </div>
        )}

        {description && (
          <p className="text-xs text-neutral-500 mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};
```

### 3. Filter & Search Components

#### InsightsFilters
```tsx
// components/insights/InsightsFilters.tsx
interface InsightsFiltersProps {
  filters: InsightsListParams;
  onFiltersChange: (filters: Partial<InsightsListParams>) => void;
  loading?: boolean;
}

export const InsightsFilters: React.FC<InsightsFiltersProps> = ({
  filters,
  onFiltersChange,
  loading
}) => {
  const categories = [
    'document_automation',
    'workflow_management',
    'ai_integration',
    'case_management',
    'billing_automation',
    'client_communication',
    'legal_research',
    'compliance_tracking'
  ];

  const userSegments = [
    'large_law_firm',
    'mid_size_firm',
    'solo_practitioner',
    'corporate_legal',
    'government_legal',
    'legal_tech_vendor'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Filters</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Priority Range */}
        <div className="space-y-2">
          <Label>Priority Score</Label>
          <div className="px-2">
            <Slider
              value={[filters.priority_min || 0, filters.priority_max || 10]}
              onValueChange={([min, max]) =>
                onFiltersChange({ priority_min: min, priority_max: max })
              }
              max={10}
              min={0}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>{filters.priority_min || 0}</span>
              <span>{filters.priority_max || 10}</span>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={filters.category || ""}
            onValueChange={(value) =>
              onFiltersChange({ category: value || undefined })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* User Segment Filter */}
        <div className="space-y-2">
          <Label>User Segment</Label>
          <Select
            value={filters.user_segment || ""}
            onValueChange={(value) =>
              onFiltersChange({ user_segment: value || undefined })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All segments</SelectItem>
              {userSegments.map((segment) => (
                <SelectItem key={segment} value={segment}>
                  {segment.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filters.date_from || ""}
              onChange={(e) => onFiltersChange({ date_from: e.target.value })}
              placeholder="From"
            />
            <Input
              type="date"
              value={filters.date_to || ""}
              onChange={(e) => onFiltersChange({ date_to: e.target.value })}
              placeholder="To"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange({
              priority_min: 0,
              priority_max: 10,
              category: undefined,
              user_segment: undefined,
              date_from: undefined,
              date_to: undefined
            })}
            disabled={loading}
          >
            Clear All
          </Button>

          <Button size="sm" disabled={loading}>
            Save Preset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 4. Data Visualization Components

#### TrendChart
```tsx
// components/analytics/TrendChart.tsx
interface TrendChartProps {
  data: TrendPoint[];
  metric: 'priority_score' | 'insights_count' | 'avg_score';
  timeframe: '7d' | '30d' | '90d';
  loading?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  metric,
  timeframe,
  loading
}) => {
  if (loading) {
    return <ChartLoadingSkeleton />;
  }

  const formatValue = (value: number) => {
    switch (metric) {
      case 'insights_count':
        return value.toString();
      case 'priority_score':
      case 'avg_score':
        return value.toFixed(1);
      default:
        return value.toString();
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'insights_count': return 'Number of Insights';
      case 'priority_score': return 'Average Priority Score';
      case 'avg_score': return 'Average Score';
      default: return 'Value';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{getMetricLabel()} Trends</CardTitle>
          <Badge variant="outline">{timeframe}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), 'MMM d')}
              className="text-neutral-600"
            />
            <YAxis
              tickFormatter={formatValue}
              className="text-neutral-600"
            />
            <Tooltip
              labelFormatter={(date) => format(new Date(date), 'PPP')}
              formatter={(value: number) => [formatValue(value), getMetricLabel()]}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#0ea5e9' }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Trend Summary */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-neutral-500">Trend Direction</p>
            <p className="font-medium">
              {data.length > 1 && data[data.length - 1].value > data[0].value ? '↗️ Increasing' : '↘️ Decreasing'}
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Data Points</p>
            <p className="font-medium">{data.length}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Average</p>
            <p className="font-medium">
              {formatValue(data.reduce((sum, point) => sum + point.value, 0) / data.length)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### CompetitorAnalysisChart
```tsx
// components/analytics/CompetitorAnalysisChart.tsx
interface CompetitorAnalysisChartProps {
  competitors: CompetitorData[];
  loading?: boolean;
}

export const CompetitorAnalysisChart: React.FC<CompetitorAnalysisChartProps> = ({
  competitors,
  loading
}) => {
  if (loading) {
    return <ChartLoadingSkeleton />;
  }

  // Prepare data for bubble chart
  const bubbleData = competitors.map(competitor => ({
    name: competitor.name,
    mentions: competitor.total_mentions,
    avgPriority: competitor.avg_priority,
    sentiment: competitor.sentiment_breakdown.positive - competitor.sentiment_breakdown.negative,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitive Landscape</CardTitle>
        <p className="text-sm text-neutral-600">
          Bubble size = mentions, X-axis = sentiment, Y-axis = average priority
        </p>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="sentiment"
              domain={[-10, 10]}
              tickFormatter={(value) => value > 0 ? `+${value}` : value.toString()}
              label={{ value: 'Net Sentiment', position: 'insideBottom', offset: -10 }}
            />
            <YAxis
              type="number"
              dataKey="avgPriority"
              domain={[0, 10]}
              label={{ value: 'Avg Priority', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm">Mentions: {data.mentions}</p>
                      <p className="text-sm">Avg Priority: {data.avgPriority.toFixed(1)}</p>
                      <p className="text-sm">Net Sentiment: {data.sentiment > 0 ? '+' : ''}{data.sentiment}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter data={bubbleData} fill="#0ea5e9">
              {bubbleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.sentiment > 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Competitor Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.slice(0, 6).map((competitor) => (
            <div key={competitor.name} className="border rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{competitor.name}</h4>
                <Badge variant={competitor.sentiment_breakdown.positive > competitor.sentiment_breakdown.negative ? 'default' : 'destructive'}>
                  {competitor.total_mentions} mentions
                </Badge>
              </div>

              <div className="space-y-1 text-sm text-neutral-600">
                <div className="flex justify-between">
                  <span>Avg Priority:</span>
                  <span>{competitor.avg_priority.toFixed(1)}/10</span>
                </div>
                <div className="flex justify-between">
                  <span>Positive:</span>
                  <span className="text-green-600">{competitor.sentiment_breakdown.positive}</span>
                </div>
                <div className="flex justify-between">
                  <span>Negative:</span>
                  <span className="text-red-600">{competitor.sentiment_breakdown.negative}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
```

### 5. Modal & Dialog Components

#### InsightDetailModal
```tsx
// components/insights/InsightDetailModal.tsx
interface InsightDetailModalProps {
  insight: InsightDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport?: (insight: InsightDetails) => void;
}

export const InsightDetailModal: React.FC<InsightDetailModalProps> = ({
  insight,
  open,
  onOpenChange,
  onExport
}) => {
  if (!insight) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PriorityBadge score={insight.priority_score} />
              {insight.action_required && (
                <Badge variant="destructive">Action Required</Badge>
              )}
            </div>
            <Button variant="outline" onClick={() => onExport?.(insight)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Export to JIRA
            </Button>
          </div>
          <DialogTitle className="text-lg">{insight.feature_summary}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reddit">Reddit Context</TabsTrigger>
            <TabsTrigger value="competitive">Competitive Intel</TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-neutral-700">Feature Details</Label>
                  <p className="mt-1 text-sm text-neutral-600">{insight.feature_details}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-700">Category</Label>
                  <Badge variant="outline" className="mt-1">
                    {insight.feature_category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-700">Implementation Size</Label>
                  <Badge variant="outline" className="mt-1">
                    {insight.implementation_size}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-neutral-700">User Segment</Label>
                  <Badge variant="outline" className="mt-1">
                    {insight.user_segment.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-700">AI Readiness</Label>
                  <Badge variant="outline" className="mt-1">
                    {insight.ai_readiness}
                  </Badge>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-700">Pain Points</Label>
                  <div className="mt-1 space-y-1">
                    {insight.pain_points.map((point, index) => (
                      <Badge key={index} variant="outline" className="mr-1 mb-1">
                        {point}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reddit" className="space-y-4">
            <div className="bg-neutral-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">r/{insight.subreddit}</Badge>
                <div className="text-sm text-neutral-500">
                  {insight.post_score} points • {insight.num_comments} comments
                </div>
              </div>

              <Button variant="outline" asChild>
                <a href={insight.post_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Original Post
                </a>
              </Button>
            </div>

            <div>
              <Label className="text-sm font-medium text-neutral-700">Collection Details</Label>
              <div className="mt-2 text-sm text-neutral-600 space-y-1">
                <p>Collected: {format(new Date(insight.collected_at), 'PPpp')}</p>
                <p>Analyzed: {format(new Date(insight.analyzed_at), 'PPpp')}</p>
                <p>Post Timestamp: {format(new Date(insight.timestamp * 1000), 'PPpp')}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="competitive" className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-neutral-700">Competitors Mentioned</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {insight.competitors_mentioned.length > 0 ? (
                  insight.competitors_mentioned.map((competitor) => (
                    <Badge key={competitor} variant="outline">
                      {competitor}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500">No competitors mentioned</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-neutral-700">Supio Mentioned</Label>
              <Badge variant={insight.supio_mentioned ? "default" : "outline"} className="mt-2">
                {insight.supio_mentioned ? "Yes" : "No"}
              </Badge>
            </div>

            {insight.competitive_advantage && (
              <div>
                <Label className="text-sm font-medium text-neutral-700">Competitive Advantage</Label>
                <p className="mt-1 text-sm text-neutral-600">{insight.competitive_advantage}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-neutral-700">Suggested Action</Label>
              <p className="mt-1 text-sm text-neutral-600">{insight.suggested_action}</p>
            </div>

            <div className="flex gap-2">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add to Roadmap
              </Button>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact User
              </Button>
              <Button variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Research Further
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Implementation Guidelines

### 1. File Structure
```
/src/components/
├── ui/                 # shadcn/ui base components
├── layout/            # Layout components (AppLayout, Sidebar, Header)
├── dashboard/         # Dashboard-specific components
├── insights/          # Insights explorer components
├── analytics/         # Analytics and visualization components
├── operations/        # Operations panel components
├── forms/            # Form components and inputs
└── shared/           # Shared utility components
```

### 2. Styling Conventions
- Use Tailwind CSS utility classes
- Prefer shadcn/ui components over custom implementations
- Use CSS custom properties for theme variables
- Maintain consistent spacing using Tailwind's scale (4, 6, 8, 12, 16...)

### 3. State Management
- Use React Query for server state
- Use Zustand for global client state
- Use URL search params for filter state
- Use local useState for component-specific state

### 4. Performance Best Practices
- Implement proper loading states and skeletons
- Use React.memo for expensive list items
- Implement virtual scrolling for large datasets
- Use dynamic imports for heavy components
- Optimize images with Next.js Image component

### 5. Error Handling
- Implement error boundaries for each major section
- Use React Query's error handling for API errors
- Provide user-friendly error messages
- Include retry mechanisms for transient failures

### 6. Testing Strategy
- Write unit tests for utility functions
- Write integration tests for component interactions
- Use Mock Service Worker for API mocking
- Test accessibility with automated tools

---

*Last Updated: 2025-01-16*
*Author: Frontend Development Team*