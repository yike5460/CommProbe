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
/slack/users           # Slack user profiles list (NEW!)
/slack/users/[user_id] # Slack user profile detail (NEW!)
/slack/channels        # Slack channel insights list (NEW!)
/slack/channels/[channel_id] # Slack channel detail (NEW!)
/settings/slack        # Slack configuration (NEW!)
/api/proxy/[...path]   # API proxy to avoid CORS issues
```

### 2.2 Navigation Hierarchy

**Top-Level Navigation (Sidebar):**
1. **Dashboard** - Overview with KPIs and recent insights
2. **Insights** - Feature request explorer with filtering
3. **Analytics** - Summary analytics dashboard
4. **Trends** - Historical trend analysis charts
5. **Internal Analytics** (NEW! - Slack Section)
   - **User Profiles** - Slack user analysis and insights
   - **Channel Insights** - Slack channel summaries
   - **Slack Settings** - Configuration and triggers
6. **Operations** - Pipeline execution monitoring
7. **Config** - System configuration settings

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

The UI now supports insights from multiple platforms (Reddit, Twitter, and Slack). Visual distinction is critical for user understanding.

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

/* Slack Platform (NEW!) */
--slack-primary: #611f69;     /* Slack purple */
--slack-bg: #faf5ff;          /* Light purple background */
--slack-text: #581c87;        /* Dark purple text */

/* Multi-Platform (All) */
--multi-primary: #6366f1;     /* Indigo */
--multi-bg: #f5f3ff;          /* Light purple background */
--multi-text: #4338ca;        /* Dark indigo text */
```

**Platform Icons:**
- **Reddit**: `MessageSquare` icon from lucide-react (or Reddit alien icon)
- **Twitter**: `Twitter` icon from lucide-react (bird icon)
- **Slack**: `MessageCircle` or `Hash` icon from lucide-react (for internal team insights)
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

<Badge className="bg-slack-bg text-slack-text">
  <MessageCircle className="h-3 w-3 mr-1" />
  Slack
</Badge>

<Badge className="bg-multi-bg text-multi-text">
  <Layers className="h-3 w-3 mr-1" />
  All Platforms
</Badge>
```

**Platform Filter Dropdown:**
```tsx
<Select value={platform} onValueChange={setPlatform}>
  <SelectTrigger className="w-[200px]">
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
    <SelectItem value="slack">
      <MessageCircle className="h-4 w-4 inline mr-2" />
      Slack Only
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

### 4.5 Slack Internal Analytics (NEW!)

**Purpose**: Slack integration provides internal team analysis capabilities, including user engagement tracking, channel insights, and team communication patterns. This is distinct from external community insights (Reddit/Twitter) as it focuses on internal team dynamics.

#### 4.5.1 Slack User Profiles List (`/slack/users`)

**Primary View**: Table/grid of analyzed Slack users with key metrics

```tsx
// Slack Users List Page
<div className="space-y-6 p-6">
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-3xl font-bold">Team Member Profiles</h1>
      <p className="text-neutral-600 mt-2">
        Analyze individual team member interests, expertise, and engagement patterns
      </p>
    </div>
    <AnalysisTrigger type="user" />
  </div>

  {/* Filters */}
  <div className="flex gap-4">
    <Select value={workspaceId} onValueChange={setWorkspaceId}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select Workspace" />
      </SelectTrigger>
    </Select>

    <Select value={influenceFilter} onValueChange={setInfluenceFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All Influence Levels" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Levels</SelectItem>
        <SelectItem value="high">High Influence</SelectItem>
        <SelectItem value="medium">Medium Influence</SelectItem>
        <SelectItem value="low">Low Influence</SelectItem>
      </SelectContent>
    </Select>

    <Input
      type="search"
      placeholder="Search by name or email..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-[300px]"
    />
  </div>

  {/* User Cards Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {users.map((user) => (
      <SlackUserCard key={user.user_id} user={user} />
    ))}
  </div>
</div>
```

**SlackUserCard Component:**
```tsx
interface SlackUserCardProps {
  user: SlackUserProfile;
}

const SlackUserCard: React.FC<SlackUserCardProps> = ({ user }) => (
  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
    <CardHeader>
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{user.user_name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold">{user.display_name || user.user_name}</h3>
          <p className="text-sm text-neutral-600">{user.user_email}</p>
        </div>
        <Badge variant={getInfluenceBadgeVariant(user.influence_level)}>
          {user.influence_level}
        </Badge>
      </div>
    </CardHeader>

    <CardContent className="space-y-4">
      {/* Activity Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold text-primary">{user.total_channels}</p>
          <p className="text-xs text-neutral-600">Channels</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-primary">{user.total_messages}</p>
          <p className="text-xs text-neutral-600">Messages</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-primary">{user.total_activity}</p>
          <p className="text-xs text-neutral-600">Activity</p>
        </div>
      </div>

      {/* Top Interests */}
      <div>
        <p className="text-sm font-medium mb-2">Top Interests</p>
        <div className="flex flex-wrap gap-1">
          {user.interests.slice(0, 3).map((interest, i) => (
            <Badge key={i} variant="outline" size="sm">{interest}</Badge>
          ))}
        </div>
      </div>

      {/* Communication Style */}
      <div>
        <p className="text-sm font-medium mb-1">Communication Style</p>
        <p className="text-sm text-neutral-600">{user.communication_style}</p>
      </div>

      {/* View Details Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/slack/users/${user.user_id}`)}
      >
        View Full Profile
      </Button>
    </CardContent>
  </Card>
);
```

#### 4.5.2 Slack User Profile Detail (`/slack/users/[user_id]`)

**Purpose**: Comprehensive view of individual user's Slack activity and AI-generated insights

```tsx
// Slack User Profile Detail Page
<div className="container mx-auto p-6 space-y-6">
  {/* Header */}
  <div className="flex items-center gap-4">
    <Avatar className="h-16 w-16">
      <AvatarFallback>{profile.user_name[0]}</AvatarFallback>
    </Avatar>
    <div className="flex-1">
      <h1 className="text-3xl font-bold">{profile.display_name || profile.user_name}</h1>
      <p className="text-neutral-600">{profile.user_email}</p>
      <div className="flex gap-2 mt-2">
        <Badge variant={getInfluenceBadgeVariant(profile.influence_level)}>
          {profile.influence_level} Influence
        </Badge>
        <Badge variant="outline">
          {profile.analysis_period_days}-day analysis
        </Badge>
        <Badge variant="outline">
          Last updated: {formatDistanceToNow(new Date(profile.last_updated * 1000))}
        </Badge>
      </div>
    </div>
    <Button onClick={() => triggerReanalysis(profile.user_email)}>
      Re-analyze
    </Button>
  </div>

  {/* Engagement Metrics */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <MetricCard
      title="Total Channels"
      value={profile.total_channels}
      icon={Hash}
      description={`Active in ${profile.active_channels} channels`}
    />
    <MetricCard
      title="Messages Sent"
      value={profile.total_messages}
      icon={MessageCircle}
      description="Total messages posted"
    />
    <MetricCard
      title="Replies Made"
      value={profile.total_replies}
      icon={MessageSquare}
      description="Replies to others"
    />
    <MetricCard
      title="Total Activity"
      value={profile.total_activity}
      icon={Activity}
      description="Combined engagement score"
    />
  </div>

  {/* AI-Generated Persona Summary */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        AI Persona Summary
      </h2>
    </CardHeader>
    <CardContent>
      <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
        {profile.ai_persona_summary}
      </p>
    </CardContent>
  </Card>

  {/* Interests & Expertise */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Interests & Focus Areas</h3>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest, i) => (
            <Badge key={i} variant="secondary">{interest}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <h3 className="font-semibold">Expertise Areas</h3>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {profile.expertise_areas.map((area, i) => (
            <Badge key={i} variant="outline">{area}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>

  {/* Channel Activity Breakdown */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Channel Activity Breakdown</h2>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={profile.channel_breakdown}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="channel_name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="message_count" fill="#611f69" name="Messages" />
          <Bar dataKey="reply_count" fill="#9c27b0" name="Replies" />
        </BarChart>
      </ResponsiveContainer>

      {/* Channel Details Table */}
      <div className="mt-4">
        <DataTable
          columns={[
            { key: 'channel_name', label: 'Channel', sortable: true },
            { key: 'message_count', label: 'Messages', sortable: true },
            { key: 'reply_count', label: 'Replies', sortable: true },
            { key: 'last_activity', label: 'Last Active', sortable: true },
          ]}
          data={profile.channel_breakdown}
        />
      </div>
    </CardContent>
  </Card>

  {/* Key Opinions & Pain Points */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-green-700">Key Opinions</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {profile.key_opinions.map((opinion, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-sm">{opinion}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <h3 className="font-semibold text-orange-700">Pain Points</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {profile.pain_points.map((pain, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 mt-1 flex-shrink-0" />
              <span className="text-sm">{pain}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  </div>

  {/* Full AI Insights */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Brain className="h-5 w-5 text-blue-500" />
        Detailed AI Analysis
      </h2>
    </CardHeader>
    <CardContent>
      <div className="prose max-w-none">
        <Markdown>{profile.ai_insights}</Markdown>
      </div>
    </CardContent>
  </Card>

  {/* Metadata Footer */}
  <div className="text-sm text-neutral-600 text-center">
    Analysis Date: {new Date(profile.analysis_date).toLocaleDateString()} •
    Analysis Period: {profile.analysis_period_days} days •
    Messages Analyzed: {profile.total_messages} •
    AI Tokens Used: {profile.ai_tokens_used.toLocaleString()}
  </div>
</div>
```

#### 4.5.3 Slack Channel Insights List (`/slack/channels`)

**Purpose**: List of analyzed Slack channels with product insights and sentiment

```tsx
// Slack Channels List Page
<div className="space-y-6 p-6">
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-3xl font-bold">Channel Insights</h1>
      <p className="text-neutral-600 mt-2">
        Discover product feedback, feature requests, and strategic insights from team channels
      </p>
    </div>
    <AnalysisTrigger type="channel" />
  </div>

  {/* Filters */}
  <div className="flex gap-4">
    <Select value={workspaceId} onValueChange={setWorkspaceId}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select Workspace" />
      </SelectTrigger>
    </Select>

    <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All Sentiments" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Sentiments</SelectItem>
        <SelectItem value="positive">Positive</SelectItem>
        <SelectItem value="neutral">Neutral</SelectItem>
        <SelectItem value="negative">Negative</SelectItem>
      </SelectContent>
    </Select>

    <Input
      type="search"
      placeholder="Search channels..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-[300px]"
    />
  </div>

  {/* Channel Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {channels.map((channel) => (
      <SlackChannelCard key={channel.channel_id} channel={channel} />
    ))}
  </div>
</div>
```

**SlackChannelCard Component:**
```tsx
const SlackChannelCard: React.FC<{ channel: SlackChannelSummary }> = ({ channel }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-neutral-600" />
          <h3 className="font-semibold text-lg">{channel.channel_name}</h3>
          {channel.is_private && (
            <Lock className="h-4 w-4 text-neutral-500" />
          )}
        </div>
        <Badge variant={getSentimentBadgeVariant(channel.sentiment)}>
          {channel.sentiment}
        </Badge>
      </div>
      <p className="text-sm text-neutral-600 mt-1">{channel.channel_purpose}</p>
    </CardHeader>

    <CardContent className="space-y-4">
      {/* Metrics */}
      <div className="flex justify-around text-center">
        <div>
          <p className="text-xl font-bold">{channel.num_members}</p>
          <p className="text-xs text-neutral-600">Members</p>
        </div>
        <div>
          <p className="text-xl font-bold">{channel.messages_analyzed}</p>
          <p className="text-xs text-neutral-600">Messages</p>
        </div>
        <div>
          <p className="text-xl font-bold">{channel.key_topics.length}</p>
          <p className="text-xs text-neutral-600">Topics</p>
        </div>
      </div>

      {/* Key Topics */}
      <div>
        <p className="text-sm font-medium mb-2">Key Topics</p>
        <div className="flex flex-wrap gap-1">
          {channel.key_topics.slice(0, 4).map((topic, i) => (
            <Badge key={i} variant="secondary" size="sm">{topic}</Badge>
          ))}
        </div>
      </div>

      {/* Feature Requests Count */}
      {channel.feature_requests.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-2 rounded">
          <Lightbulb className="h-4 w-4" />
          <span>{channel.feature_requests.length} feature request(s) identified</span>
        </div>
      )}

      {/* Product Opportunities Count */}
      {channel.product_opportunities.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
          <Target className="h-4 w-4" />
          <span>{channel.product_opportunities.length} product opportunity(ies)</span>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/slack/channels/${channel.channel_id}`)}
      >
        View Full Analysis
      </Button>
    </CardContent>
  </Card>
);
```

#### 4.5.4 Slack Channel Detail (`/slack/channels/[channel_id]`)

**Purpose**: Detailed channel analysis with product insights and recommendations

```tsx
// Slack Channel Detail Page
<div className="container mx-auto p-6 space-y-6">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div>
      <div className="flex items-center gap-3">
        <Hash className="h-8 w-8 text-neutral-600" />
        <h1 className="text-3xl font-bold">{summary.channel_name}</h1>
        {summary.is_private && (
          <Lock className="h-6 w-6 text-neutral-500" />
        )}
        <Badge variant={getSentimentBadgeVariant(summary.sentiment)} size="lg">
          {summary.sentiment}
        </Badge>
      </div>
      <p className="text-neutral-600 mt-2">{summary.channel_purpose}</p>
      <div className="flex gap-2 mt-2">
        <Badge variant="outline">
          {summary.analysis_period_days}-day analysis
        </Badge>
        <Badge variant="outline">
          Last updated: {formatDistanceToNow(new Date(summary.last_updated * 1000))}
        </Badge>
      </div>
    </div>
    <Button onClick={() => triggerReanalysis(summary.channel_name)}>
      Re-analyze Channel
    </Button>
  </div>

  {/* Key Metrics */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <MetricCard
      title="Members"
      value={summary.num_members}
      icon={Users}
      description="Total channel members"
    />
    <MetricCard
      title="Messages Analyzed"
      value={summary.messages_analyzed}
      icon={MessageCircle}
      description="Messages in analysis period"
    />
    <MetricCard
      title="Key Topics"
      value={summary.key_topics.length}
      icon={Tag}
      description="Main discussion themes"
    />
    <MetricCard
      title="Feature Requests"
      value={summary.feature_requests.length}
      icon={Lightbulb}
      description="Identified requests"
    />
  </div>

  {/* Key Topics */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Key Topics & Themes</h2>
    </CardHeader>
    <CardContent>
      <div className="flex flex-wrap gap-2">
        {summary.key_topics.map((topic, i) => (
          <Badge key={i} variant="secondary" size="lg">{topic}</Badge>
        ))}
      </div>
    </CardContent>
  </Card>

  {/* Feature Requests (Highlighted) */}
  {summary.feature_requests.length > 0 && (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <h2 className="text-xl font-semibold text-orange-800 flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Feature Requests
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {summary.feature_requests.map((request, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="font-medium text-orange-700">{i + 1}.</span>
              <span className="text-neutral-800">{request}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )}

  {/* Pain Points */}
  {summary.pain_points.length > 0 && (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <h2 className="text-xl font-semibold text-red-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Pain Points
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {summary.pain_points.map((pain, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="font-medium text-red-700">{i + 1}.</span>
              <span className="text-neutral-800">{pain}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )}

  {/* Product Opportunities (Highlighted) */}
  {summary.product_opportunities.length > 0 && (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <h2 className="text-xl font-semibold text-green-800 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Product Opportunities
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {summary.product_opportunities.map((opportunity, i) => (
            <div key={i} className="bg-white p-3 rounded border border-green-200">
              <p className="text-neutral-800">{opportunity}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )}

  {/* Strategic Recommendations */}
  {summary.strategic_recommendations.length > 0 && (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <h2 className="text-xl font-semibold text-blue-800 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Strategic Recommendations
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {summary.strategic_recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <span className="text-neutral-800">{rec}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )}

  {/* Key Contributors */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Key Contributors</h2>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.key_contributors.map((contributor) => (
          <div key={contributor.user_id} className="flex items-center gap-3 p-3 border rounded">
            <Avatar>
              <AvatarFallback>{contributor.user_name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{contributor.user_name}</p>
              <Badge variant={getContributionBadgeVariant(contributor.contribution_level)} size="sm">
                {contributor.contribution_level}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>

  {/* Full AI Summary */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        AI-Generated Channel Summary
      </h2>
    </CardHeader>
    <CardContent>
      <div className="prose max-w-none">
        <Markdown>{summary.ai_summary}</Markdown>
      </div>
    </CardContent>
  </Card>

  {/* Metadata Footer */}
  <div className="text-sm text-neutral-600 text-center">
    Analysis Date: {new Date(summary.analysis_date).toLocaleDateString()} •
    Analysis Period: {summary.analysis_period_days} days •
    Messages Analyzed: {summary.messages_analyzed} •
    AI Tokens Used: {summary.ai_tokens_used.toLocaleString()}
  </div>
</div>
```

#### 4.5.5 Slack Settings Page (`/settings/slack`)

**Purpose**: Configure Slack workspace, trigger analysis, and manage settings

```tsx
// Slack Settings Page
<div className="container mx-auto p-6 space-y-6">
  <div>
    <h1 className="text-3xl font-bold">Slack Configuration</h1>
    <p className="text-neutral-600 mt-2">
      Configure workspace settings and trigger team analysis
    </p>
  </div>

  {/* Workspace Configuration */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Workspace Settings</h2>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <label className="text-sm font-medium">Workspace ID</label>
        <Input
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder="T123456789"
        />
        <p className="text-xs text-neutral-500 mt-1">
          Your Slack workspace identifier
        </p>
      </div>

      <div>
        <label className="text-sm font-medium">Default Analysis Period (days)</label>
        <Input
          type="number"
          value={defaultDays}
          onChange={(e) => setDefaultDays(Number(e.target.value))}
          min="7"
          max="90"
        />
      </div>

      <Button onClick={saveSettings}>Save Settings</Button>
    </CardContent>
  </Card>

  {/* Analysis Triggers */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* User Analysis */}
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Analyze Team Member</h2>
      </CardHeader>
      <CardContent>
        <AnalysisTrigger type="user" />
      </CardContent>
    </Card>

    {/* Channel Analysis */}
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Analyze Channel</h2>
      </CardHeader>
      <CardContent>
        <AnalysisTrigger type="channel" />
      </CardContent>
    </Card>
  </div>

  {/* Bot Permissions */}
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Bot Permissions</h2>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm">channels:history - Read public channel messages</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm">channels:read - List public channels</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm">users:read - View people in workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm">users:read.email - View email addresses</span>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

**AnalysisTrigger Component:**
```tsx
interface AnalysisTriggerProps {
  type: 'user' | 'channel';
}

const AnalysisTrigger: React.FC<AnalysisTriggerProps> = ({ type }) => {
  const [formData, setFormData] = useState({});
  const analyzeUser = useAnalyzeSlackUser();
  const analyzeChannel = useAnalyzeSlackChannel();

  const handleSubmit = async () => {
    try {
      if (type === 'user') {
        await analyzeUser.mutateAsync(formData);
        toast.success('User analysis started! Results will be available in 2-5 minutes.');
      } else {
        await analyzeChannel.mutateAsync(formData);
        toast.success('Channel analysis started! Results will be available in 1-3 minutes.');
      }
    } catch (error) {
      toast.error(`Analysis failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {type === 'user' ? (
        <>
          <div>
            <label className="text-sm font-medium">User Email or ID</label>
            <Input
              placeholder="user@example.com or U123456789"
              value={formData.user_email || formData.user_id || ''}
              onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium">Channel Name or ID</label>
            <Input
              placeholder="general or C123456789"
              value={formData.channel_name || formData.channel_id || ''}
              onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
            />
          </div>
        </>
      )}

      <div>
        <label className="text-sm font-medium">Analysis Period (days)</label>
        <Input
          type="number"
          value={formData.days || 30}
          onChange={(e) => setFormData({ ...formData, days: Number(e.target.value) })}
          min="7"
          max="90"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={analyzeUser.isPending || analyzeChannel.isPending}
        className="w-full"
      >
        {analyzeUser.isPending || analyzeChannel.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          `Analyze ${type === 'user' ? 'User' : 'Channel'}`
        )}
      </Button>
    </div>
  );
};
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