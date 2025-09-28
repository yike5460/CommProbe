'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExecutions, useSystemHealth, useTriggerCrawl, useCancelExecution } from '@/hooks/useApi';
import {
  Play,
  Square,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Database,
  Server,
  Monitor
} from 'lucide-react';

export default function OperationsPage() {
  const [executionFilter, setExecutionFilter] = useState<string>('all');
  const { data: executions, isLoading: executionsLoading, refetch: refetchExecutions } = useExecutions();
  const { data: healthData, isLoading: healthLoading } = useSystemHealth();
  const triggerCrawlMutation = useTriggerCrawl();
  const cancelExecutionMutation = useCancelExecution();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'SUCCEEDED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'TIMED_OUT':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'ABORTED':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'SUCCEEDED':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'TIMED_OUT':
        return <Badge className="bg-orange-100 text-orange-800">Timeout</Badge>;
      case 'ABORTED':
        return <Badge className="bg-gray-100 text-gray-800">Aborted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleTriggerCrawl = () => {
    triggerCrawlMutation.mutate(undefined, {
      onSuccess: () => {
        refetchExecutions();
      }
    });
  };

  const handleCancelExecution = (executionName: string) => {
    cancelExecutionMutation.mutate(executionName, {
      onSuccess: () => {
        refetchExecutions();
      }
    });
  };

  const filteredExecutions = executions?.executions.filter(execution => {
    if (executionFilter === 'all') return true;
    return execution.status === executionFilter;
  }) || [];

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Operations Center</h1>
          <p className="text-muted-foreground mt-1">
            System monitoring and pipeline management
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleTriggerCrawl}
            disabled={triggerCrawlMutation.isPending}
          >
            {triggerCrawlMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Trigger Crawl
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge className={getHealthStatusColor(healthData?.status || 'unknown')}>
                {healthData?.status || 'Unknown'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {healthData?.uptime_seconds ?
                `Uptime: ${Math.floor(healthData.uptime_seconds / 3600)}h` :
                'Checking status...'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {healthData?.checks.database.status === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {healthData?.checks.database.status || 'Unknown'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {healthData?.checks.database.response_time_ms ?
                `${healthData.checks.database.response_time_ms}ms` :
                'Checking...'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {healthData?.checks.pipeline.status === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {healthData?.checks.pipeline.status || 'Unknown'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {healthData?.checks.pipeline.last_execution ?
                `Last: ${new Date(healthData.checks.pipeline.last_execution).toLocaleString()}` :
                'No recent execution'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthData?.metrics?.avg_response_time_ms || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Avg response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="executions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="executions">Pipeline Executions</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="executions" className="space-y-6">
          {/* Execution Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Select value={executionFilter} onValueChange={setExecutionFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Executions</SelectItem>
                      <SelectItem value="RUNNING">Running</SelectItem>
                      <SelectItem value="SUCCEEDED">Succeeded</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="TIMED_OUT">Timed Out</SelectItem>
                      <SelectItem value="ABORTED">Aborted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => refetchExecutions()}
                    disabled={executionsLoading}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${executionsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredExecutions.length} executions
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Executions List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>
                Pipeline execution history and status monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-48 mb-2" />
                        <div className="h-3 bg-muted rounded w-32" />
                      </div>
                      <div className="animate-pulse">
                        <div className="h-6 bg-muted rounded w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredExecutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No executions found matching your criteria</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredExecutions.map((execution) => (
                    <div key={execution.executionArn} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(execution.status)}
                        <div>
                          <h4 className="font-medium">{execution.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Started: {new Date(execution.startDate).toLocaleString()}</span>
                            {execution.stopDate && (
                              <span>Ended: {new Date(execution.stopDate).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(execution.status)}
                        {execution.status === 'RUNNING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelExecution(execution.name)}
                            disabled={cancelExecutionMutation.isPending}
                          >
                            <Square className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Database Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  Database Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge className={getHealthStatusColor(healthData?.checks.database.status || 'unknown')}>
                      {healthData?.checks.database.status || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Response Time</span>
                    <span className="text-sm">
                      {healthData?.checks.database.response_time_ms || 0}ms
                    </span>
                  </div>
                  {healthData?.checks.database.error && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">{healthData.checks.database.error}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5" />
                  Pipeline Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge className={getHealthStatusColor(healthData?.checks.pipeline.status || 'unknown')}>
                      {healthData?.checks.pipeline.status || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Response Time</span>
                    <span className="text-sm">
                      {healthData?.checks.pipeline.response_time_ms || 0}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Last Execution</span>
                    <span className="text-sm">
                      {healthData?.checks.pipeline.last_execution ?
                        new Date(healthData.checks.pipeline.last_execution).toLocaleString() :
                        'Never'
                      }
                    </span>
                  </div>
                  {healthData?.checks.pipeline.error && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">{healthData.checks.pipeline.error}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {healthData?.metrics?.total_requests || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {healthData?.metrics?.error_rate || 0}%
                    </div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {healthData?.metrics?.avg_response_time_ms || 0}ms
                    </div>
                    <p className="text-sm text-muted-foreground">Avg Response Time</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {healthData?.metrics?.active_executions || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Active Executions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {healthData?.resources?.memory_usage_percent || 0}%
                    </div>
                    <p className="text-sm text-muted-foreground">Memory Usage</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {healthData?.resources?.cpu_usage_percent || 0}%
                    </div>
                    <p className="text-sm text-muted-foreground">CPU Usage</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                System Configuration
              </CardTitle>
              <CardDescription>
                Manage system settings and pipeline configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configuration management interface</p>
                <p className="text-sm">This would connect to the /config API endpoint</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}