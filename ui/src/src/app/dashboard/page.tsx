'use client';

import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAnalyticsSummary, useSystemHealth, useExecutions } from '@/hooks/useApi';
import {
  TrendingUp,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Play,
  BarChart3,
  Users,
  Target
} from 'lucide-react';

export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsSummary();
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: executions, isLoading: executionsLoading } = useExecutions();

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Legal Tech Intelligence Overview
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analytics?.data.total_insights || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analytics?.data.high_priority_insights || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Priority Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analytics?.data.avg_priority_score?.toFixed(1) || '0.0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Out of 10.0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthLoading ? '...' : health?.status || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent High Priority Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
              High Priority Insights
            </CardTitle>
            <CardDescription>
              Latest insights requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {analytics?.data.recent_high_priority?.slice(0, 5).map((insight) => (
                  <div key={insight.insight_id} className="flex items-start space-x-3 p-3 rounded-lg border">
                    <Badge variant="outline" className="mt-1">
                      {insight.priority_score.toFixed(1)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {insight.feature_summary}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(insight.analyzed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No high priority insights found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Play className="mr-2 h-5 w-5 text-blue-500" />
              Recent Executions
            </CardTitle>
            <CardDescription>
              Latest crawl and analysis jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {executionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {executions?.executions?.slice(0, 5).map((execution) => (
                  <div key={execution.executionArn} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <Badge
                        variant={
                          execution.status === 'SUCCEEDED' ? 'default' :
                          execution.status === 'RUNNING' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {execution.status}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{execution.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(execution.startDate).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No recent executions found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5 text-purple-500" />
              Insights by Category
            </CardTitle>
            <CardDescription>
              Feature categories distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(analytics?.data.by_category || {}).map(([category, data]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {category.replace('_', ' ')}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {data.count} insights
                      </span>
                      <Badge variant="outline">
                        {data.avg_priority.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Competitors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5 text-green-500" />
              Top Competitors
            </CardTitle>
            <CardDescription>
              Most mentioned competitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(analytics?.data.top_competitors || {}).map(([competitor, mentions]) => (
                  <div key={competitor} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{competitor}</span>
                    <Badge variant="secondary">
                      {mentions} mentions
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}