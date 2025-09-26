'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsSummary, useCompetitorAnalysis } from '@/hooks/useApi';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Download,
  Calendar,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [competitorFilter, setCompetitorFilter] = useState<string>('all');

  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsSummary({ period });
  const { data: competitorData, isLoading: competitorLoading } = useCompetitorAnalysis({
    competitor: competitorFilter !== 'all' ? competitorFilter : undefined
  });

  const getTrendIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change}%`;
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Data visualization and competitive intelligence
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={period} onValueChange={(value: '7d' | '30d' | '90d') => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analyticsData?.data.total_insights || 0}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(12)}
              <span className="ml-1">{formatChange(12)} from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analyticsData?.data.high_priority_insights || 0}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(8)}
              <span className="ml-1">{formatChange(8)} from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Priority Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analyticsData?.data.avg_priority_score?.toFixed(1) || '0.0'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(-2)}
              <span className="ml-1">{formatChange(-2)} from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actionable Insights</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? '...' : analyticsData?.data.actionable_insights || 0}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(15)}
              <span className="ml-1">{formatChange(15)} from last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="segments">User Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Insights Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Insights Timeline
                </CardTitle>
                <CardDescription>
                  Daily insights collected over the past {period}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-64 bg-muted rounded animate-pulse" />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Interactive chart would be rendered here</p>
                      <p className="text-sm">Using Recharts or similar library</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="mr-2 h-5 w-5" />
                  Priority Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of insights by priority level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-sm">Critical (9-10)</span>
                    </div>
                    <span className="text-sm font-medium">
                      {analyticsData?.data.by_category ?
                        Object.values(analyticsData.data.by_category).reduce((sum, cat) => sum + cat.count, 0) * 0.15 : 0} insights
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      <span className="text-sm">High (7-8)</span>
                    </div>
                    <span className="text-sm font-medium">
                      {analyticsData?.data.by_category ?
                        Object.values(analyticsData.data.by_category).reduce((sum, cat) => sum + cat.count, 0) * 0.25 : 0} insights
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span className="text-sm">Medium (5-6)</span>
                    </div>
                    <span className="text-sm font-medium">
                      {analyticsData?.data.by_category ?
                        Object.values(analyticsData.data.by_category).reduce((sum, cat) => sum + cat.count, 0) * 0.35 : 0} insights
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full" />
                      <span className="text-sm">Low (1-4)</span>
                    </div>
                    <span className="text-sm font-medium">
                      {analyticsData?.data.by_category ?
                        Object.values(analyticsData.data.by_category).reduce((sum, cat) => sum + cat.count, 0) * 0.25 : 0} insights
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Insights by Category</CardTitle>
              <CardDescription>
                Feature category performance and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-32 mb-2" />
                        <div className="h-3 bg-muted rounded w-20" />
                      </div>
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-16" />
                      </div>
                    </div>
                  ))
                ) : (
                  Object.entries(analyticsData?.data.by_category || {}).map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <h4 className="font-medium capitalize">
                          {category.replace('_', ' ')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Avg Priority: {data.avg_priority.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{data.count}</div>
                        <div className="text-sm text-muted-foreground">insights</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Competitive Intelligence</CardTitle>
                  <CardDescription>
                    Competitor mentions and market analysis
                  </CardDescription>
                </div>
                <Select value={competitorFilter} onValueChange={setCompetitorFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by competitor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Competitors</SelectItem>
                    {Object.keys(analyticsData?.data.top_competitors || {}).map((competitor) => (
                      <SelectItem key={competitor} value={competitor}>
                        {competitor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-24 mb-2" />
                        <div className="h-3 bg-muted rounded w-16" />
                      </div>
                      <div className="animate-pulse">
                        <div className="h-6 bg-muted rounded w-12" />
                      </div>
                    </div>
                  ))
                ) : (
                  Object.entries(analyticsData?.data.top_competitors || {}).map(([competitor, mentions]) => (
                    <div key={competitor} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <h4 className="font-medium">{competitor}</h4>
                        <p className="text-sm text-muted-foreground">
                          Legal tech competitor
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {mentions} mentions
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Segments Analysis</CardTitle>
              <CardDescription>
                Insights breakdown by user segments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analyticsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-32 mb-2" />
                        <div className="h-8 bg-muted rounded w-16 mb-2" />
                        <div className="h-3 bg-muted rounded w-24" />
                      </div>
                    </div>
                  ))
                ) : (
                  Object.entries(analyticsData?.data.by_user_segment || {}).map(([segment, data]) => (
                    <div key={segment} className="p-4 rounded-lg border">
                      <h4 className="font-medium capitalize mb-2">
                        {segment.replace('_', ' ')}
                      </h4>
                      <div className="text-2xl font-bold mb-1">{data.count}</div>
                      <div className="text-sm text-muted-foreground">
                        Avg Priority: {data.avg_priority.toFixed(1)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}