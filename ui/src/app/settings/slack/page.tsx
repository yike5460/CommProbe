/**
 * Slack Settings Page
 * Configure Slack workspace and trigger team analysis
 */

'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { AnalysisTrigger } from '@/components/slack';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  CheckCircle,
  Users,
  Hash,
  MessageCircle,
  Mail,
  Shield,
  Info,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SlackSettingsPage() {
  const [workspaceId, setWorkspaceId] = useState('default');
  const [defaultDays, setDefaultDays] = useState(30);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = () => {
    // In a real implementation, this would save to localStorage or backend
    localStorage.setItem('slack_workspace_id', workspaceId);
    localStorage.setItem('slack_default_days', defaultDays.toString());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Slack Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure workspace settings and trigger team analysis
        </p>
      </div>

      {/* Save Success Alert */}
      {saveSuccess && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Workspace Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>
            Configure your Slack workspace connection and default analysis parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace_id">Workspace ID</Label>
            <Input
              id="workspace_id"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="T123456789"
            />
            <p className="text-xs text-muted-foreground">
              Your Slack workspace identifier (found in workspace settings)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_days">Default Analysis Period (days)</Label>
            <Input
              id="default_days"
              type="number"
              min="7"
              max="90"
              value={defaultDays}
              onChange={(e) => setDefaultDays(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Default number of days to analyze (7-90 days)
            </p>
          </div>

          <Button onClick={handleSaveSettings}>Save Settings</Button>
        </CardContent>
      </Card>

      {/* Analysis Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* User Analysis */}
        <AnalysisTrigger type="user" defaultValues={{ workspace_id: workspaceId, days: defaultDays }} />

        {/* Channel Analysis */}
        <AnalysisTrigger type="channel" defaultValues={{ workspace_id: workspaceId, days: defaultDays }} />
      </div>

      {/* Bot Permissions Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Bot Permissions
          </CardTitle>
          <CardDescription>
            Required OAuth scopes for the CommProbe Slack bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">channels:history</p>
                <p className="text-xs text-muted-foreground">Read public channel messages</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">channels:read</p>
                <p className="text-xs text-muted-foreground">List public channels</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">groups:history</p>
                <p className="text-xs text-muted-foreground">Read private channel messages (when invited)</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">groups:read</p>
                <p className="text-xs text-muted-foreground">List private channels</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">users:read</p>
                <p className="text-xs text-muted-foreground">View people in workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">users:read.email</p>
                <p className="text-xs text-muted-foreground">View email addresses</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Usage Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">User Analysis</p>
              <p className="text-xs text-muted-foreground">
                Analyzes individual team member activity, interests, and communication patterns.
                Results available in 2-5 minutes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Channel Analysis</p>
              <p className="text-xs text-muted-foreground">
                Extracts product feedback, feature requests, and strategic insights from channel discussions.
                Results available in 1-3 minutes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">AI-Powered Analysis</p>
              <p className="text-xs text-muted-foreground">
                Uses Claude Sonnet 4.5 for deep understanding of context, sentiment, and insights.
                All analysis is stored for 180 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
