'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TwitterConfigSection } from '@/components/config/TwitterConfigSection';
import { useSystemConfiguration, useUpdateSystemConfiguration } from '@/hooks/useApi';
import {
  Settings,
  Database,
  Clock,
  Server,
  Shield,
  Zap,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Globe
} from 'lucide-react';

export default function ConfigPage() {
  const { data: config, isLoading, refetch } = useSystemConfiguration();
  const updateConfigMutation = useUpdateSystemConfiguration();

  // Local state for form management
  const [crawlSettings, setCrawlSettings] = useState({
    default_subreddits: config?.crawl_settings.default_subreddits || ['LawFirm', 'Lawyertalk', 'legaltech'],
    default_crawl_type: config?.crawl_settings.default_crawl_type || 'both',
    default_days_back: config?.crawl_settings.default_days_back || 3,
    default_min_score: config?.crawl_settings.default_min_score || 5,
    max_posts_per_crawl: config?.crawl_settings.max_posts_per_crawl || 100
  });

  const [twitterSettings, setTwitterSettings] = useState({
    twitter_enabled: config?.crawl_settings.twitter_enabled || false,
    twitter_lookback_days: config?.crawl_settings.twitter_lookback_days || 7,
    twitter_min_engagement: config?.crawl_settings.twitter_min_engagement || 5,
    twitter_api_tier: (config?.crawl_settings.twitter_api_tier || 'basic') as 'free' | 'basic' | 'pro'
  });

  const [analysisSettings, setAnalysisSettings] = useState({
    priority_threshold: config?.analysis_settings.priority_threshold || 7,
    ai_model: config?.analysis_settings.ai_model || 'gpt-4',
    analysis_timeout_seconds: config?.analysis_settings.analysis_timeout_seconds || 300,
    max_retries: config?.analysis_settings.max_retries || 3
  });

  const [storageSettings, setStorageSettings] = useState({
    insights_ttl_days: config?.storage_settings.insights_ttl_days || 30,
    max_insights_per_request: config?.storage_settings.max_insights_per_request || 100,
    analytics_cache_ttl_minutes: config?.storage_settings.analytics_cache_ttl_minutes || 15
  });

  const [systemSettings, setSystemSettings] = useState({
    maintenance_mode: config?.system_settings.maintenance_mode || false,
    rate_limit_per_minute: config?.system_settings.rate_limit_per_minute || 60
  });

  const handleSaveSettings = (section: string) => {
    const updates: any = {};

    switch (section) {
      case 'crawl':
        updates.crawl_settings = { ...crawlSettings, ...twitterSettings };
        break;
      case 'twitter':
        updates.crawl_settings = twitterSettings;
        break;
      case 'analysis':
        updates.analysis_settings = analysisSettings;
        break;
      case 'storage':
        updates.storage_settings = storageSettings;
        break;
      case 'system':
        updates.system_settings = systemSettings;
        break;
    }

    updateConfigMutation.mutate(updates, {
      onSuccess: () => {
        refetch();
      }
    });
  };

  const handleResetSettings = () => {
    if (config) {
      setCrawlSettings(config.crawl_settings);
      setTwitterSettings({
        twitter_enabled: config.crawl_settings.twitter_enabled || false,
        twitter_lookback_days: config.crawl_settings.twitter_lookback_days || 7,
        twitter_min_engagement: config.crawl_settings.twitter_min_engagement || 5,
        twitter_api_tier: (config.crawl_settings.twitter_api_tier || 'basic') as 'free' | 'basic' | 'pro'
      });
      setAnalysisSettings(config.analysis_settings);
      setStorageSettings(config.storage_settings);
      setSystemSettings(config.system_settings);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded w-64 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-muted rounded w-32" />
                    <div className="h-3 bg-muted rounded w-48" />
                    <div className="h-8 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage system settings and operational parameters
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleResetSettings}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Changes
          </Button>
        </div>
      </div>

      {/* System Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Version</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {config?.system_settings.api_version || 'v1.0.0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environment</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {config?.system_settings.environment || 'development'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance Mode</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {systemSettings.maintenance_mode ? (
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <span className="font-medium">
                {systemSettings.maintenance_mode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemSettings.rate_limit_per_minute}
            </div>
            <p className="text-xs text-muted-foreground">
              requests/minute
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="crawl" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="crawl">Crawl Settings</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="crawl" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Crawl Configuration
              </CardTitle>
              <CardDescription>
                Configure Reddit crawling parameters and default settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="default_subreddits">Default Subreddits</Label>
                    <Textarea
                      id="default_subreddits"
                      placeholder="LawFirm, Lawyertalk, legaltech (comma-separated)"
                      value={crawlSettings.default_subreddits.join(', ')}
                      onChange={(e) => setCrawlSettings({
                        ...crawlSettings,
                        default_subreddits: e.target.value.split(',').map(s => s.trim())
                      })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="crawl_type">Default Crawl Type</Label>
                    <Select
                      value={crawlSettings.default_crawl_type}
                      onValueChange={(value: any) => setCrawlSettings({
                        ...crawlSettings,
                        default_crawl_type: value
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crawl">Crawl Only</SelectItem>
                        <SelectItem value="search">Search Only</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="days_back">Default Days Back</Label>
                    <Input
                      id="days_back"
                      type="number"
                      value={crawlSettings.default_days_back}
                      onChange={(e) => setCrawlSettings({
                        ...crawlSettings,
                        default_days_back: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="min_score">Minimum Score</Label>
                    <Input
                      id="min_score"
                      type="number"
                      value={crawlSettings.default_min_score}
                      onChange={(e) => setCrawlSettings({
                        ...crawlSettings,
                        default_min_score: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_posts">Max Posts per Crawl</Label>
                    <Input
                      id="max_posts"
                      type="number"
                      value={crawlSettings.max_posts_per_crawl}
                      onChange={(e) => setCrawlSettings({
                        ...crawlSettings,
                        max_posts_per_crawl: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSaveSettings('crawl')}
                  disabled={updateConfigMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Crawl Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Twitter Configuration */}
          <TwitterConfigSection
            config={twitterSettings}
            onChange={(updates) => setTwitterSettings({ ...twitterSettings, ...updates })}
            isLoading={updateConfigMutation.isPending}
          />

          <div className="flex justify-end">
            <Button
              onClick={() => handleSaveSettings('twitter')}
              disabled={updateConfigMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Twitter Settings
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5" />
                Analysis Configuration
              </CardTitle>
              <CardDescription>
                Configure AI analysis parameters and performance settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="priority_threshold">Priority Threshold</Label>
                    <Input
                      id="priority_threshold"
                      type="number"
                      min="1"
                      max="10"
                      value={analysisSettings.priority_threshold}
                      onChange={(e) => setAnalysisSettings({
                        ...analysisSettings,
                        priority_threshold: parseFloat(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ai_model">AI Model</Label>
                    <Select
                      value={analysisSettings.ai_model}
                      onValueChange={(value) => setAnalysisSettings({
                        ...analysisSettings,
                        ai_model: value
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="claude-3">Claude 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="timeout">Analysis Timeout (seconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={analysisSettings.analysis_timeout_seconds}
                      onChange={(e) => setAnalysisSettings({
                        ...analysisSettings,
                        analysis_timeout_seconds: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="retries">Max Retries</Label>
                    <Input
                      id="retries"
                      type="number"
                      value={analysisSettings.max_retries}
                      onChange={(e) => setAnalysisSettings({
                        ...analysisSettings,
                        max_retries: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSaveSettings('analysis')}
                  disabled={updateConfigMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Analysis Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Storage Configuration
              </CardTitle>
              <CardDescription>
                Configure data retention and caching settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="insights_ttl">Insights TTL (days)</Label>
                    <Input
                      id="insights_ttl"
                      type="number"
                      value={storageSettings.insights_ttl_days}
                      onChange={(e) => setStorageSettings({
                        ...storageSettings,
                        insights_ttl_days: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_insights">Max Insights per Request</Label>
                    <Input
                      id="max_insights"
                      type="number"
                      value={storageSettings.max_insights_per_request}
                      onChange={(e) => setStorageSettings({
                        ...storageSettings,
                        max_insights_per_request: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cache_ttl">Analytics Cache TTL (minutes)</Label>
                    <Input
                      id="cache_ttl"
                      type="number"
                      value={storageSettings.analytics_cache_ttl_minutes}
                      onChange={(e) => setStorageSettings({
                        ...storageSettings,
                        analytics_cache_ttl_minutes: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSaveSettings('storage')}
                  disabled={updateConfigMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Storage Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                System Configuration
              </CardTitle>
              <CardDescription>
                Configure system-wide settings and operational parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="maintenance">Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable to temporarily disable API access
                      </p>
                    </div>
                    <Switch
                      id="maintenance"
                      checked={systemSettings.maintenance_mode}
                      onCheckedChange={(checked) => setSystemSettings({
                        ...systemSettings,
                        maintenance_mode: checked
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="rate_limit">Rate Limit (per minute)</Label>
                    <Input
                      id="rate_limit"
                      type="number"
                      value={systemSettings.rate_limit_per_minute}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        rate_limit_per_minute: parseInt(e.target.value)
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSaveSettings('system')}
                  disabled={updateConfigMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save System Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}