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
import { useAnalyticsTrends } from '@/hooks/useApi';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Download,
  BarChart3,
  LineChart,
  PieChart,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

export default function TrendsPage() {
  const [metric, setMetric] = useState<'priority_score' | 'insights_count' | 'avg_score'>('insights_count');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const { data: trendsData, isLoading } = useAnalyticsTrends({
    metric,
    period,
    group_by: groupBy
  });

  const getTrendIcon = (direction: string) => {
    if (direction === 'increasing') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (direction === 'decreasing') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (direction: string) => {
    if (direction === 'increasing') return 'text-green-600 bg-green-50';
    if (direction === 'decreasing') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const metricLabels = {
    'priority_score': 'Priority Score',
    'insights_count': 'Insights Count',
    'avg_score': 'Average Score'
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trends Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Historical insights and performance trends
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Metric Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Metric</label>
              <Select value={metric} onValueChange={(value: any) => setMetric(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insights_count">Insights Count</SelectItem>
                  <SelectItem value="priority_score">Priority Score</SelectItem>
                  <SelectItem value="avg_score">Average Score</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Period</label>
              <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Group By Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Group By</label>
              <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chart Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Chart Type</label>
              <Select defaultValue="line">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend Direction</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getTrendIcon(trendsData?.data.summary.trend_direction || 'stable')}
              <span className="text-2xl font-bold capitalize">
                {isLoading ? '...' : trendsData?.data.summary.trend_direction || 'Stable'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : trendsData?.data.summary.total_data_points || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Over {period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Value</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : trendsData?.data.summary.avg_value?.toFixed(1) || '0.0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metricLabels[metric]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volatility</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : `${(trendsData?.data.summary.volatility || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Data variance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                {metricLabels[metric]} Trends
              </CardTitle>
              <CardDescription>
                {metricLabels[metric]} over time ({period} grouped by {groupBy})
              </CardDescription>
            </div>
            <Badge
              className={getTrendColor(trendsData?.data.summary.trend_direction || 'stable')}
              variant="secondary"
            >
              {getTrendIcon(trendsData?.data.summary.trend_direction || 'stable')}
              <span className="ml-1 capitalize">
                {trendsData?.data.summary.trend_direction || 'Stable'}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-96 bg-muted rounded animate-pulse" />
          ) : (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <LineChart className="h-24 w-24 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Interactive Trend Chart</p>
                <p className="text-sm">
                  {trendsData?.data.trend_points?.length || 0} data points from {' '}
                  {trendsData?.data.date_range?.start} to {trendsData?.data.date_range?.end}
                </p>
                <p className="text-xs mt-2">
                  Chart would be rendered using Recharts or similar visualization library
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trend Data Points</CardTitle>
          <CardDescription>
            Raw data points for the selected trend analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded border">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-24 mb-1" />
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : trendsData?.data.trend_points?.length ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trendsData.data.trend_points.slice(0, 20).map((point, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded border">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {new Date(point.date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {point.count} data points
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{point.value}</div>
                    <div className="text-sm text-muted-foreground">
                      {metricLabels[metric]}
                    </div>
                  </div>
                </div>
              ))}
              {trendsData.data.trend_points.length > 20 && (
                <div className="text-center py-4 text-muted-foreground">
                  Showing first 20 of {trendsData.data.trend_points.length} data points
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trend data available for the selected criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}