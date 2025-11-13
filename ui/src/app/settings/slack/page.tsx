/**
 * Slack Settings Page
 * Configure Slack workspace and bot token
 */

'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  CheckCircle,
  XCircle,
  Shield,
  Info,
  Key,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSlackConfig, useUpdateSlackConfig, useTestSlackConnection } from '@/hooks/useSlackApi';

export default function SlackSettingsPage() {
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('default');
  const [workspaceName, setWorkspaceName] = useState('');
  const [defaultDays, setDefaultDays] = useState(30);

  // Query hooks
  const { data: config, isLoading: configLoading, error: configError } = useSlackConfig();
  const updateConfig = useUpdateSlackConfig();
  const testConnection = useTestSlackConnection();

  // Load config data into form
  useEffect(() => {
    if (config) {
      setWorkspaceId(config.workspace_id || 'default');
      setWorkspaceName(config.workspace_name || '');
      setDefaultDays(config.default_analysis_days || 30);
    }
  }, [config]);

  const handleSaveToken = async () => {
    if (!botToken) return;

    try {
      await updateConfig.mutateAsync({
        bot_token: botToken,
      });
      setBotToken('');
      setIsEditingToken(false);
    } catch (error) {
      console.error('Failed to save bot token:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateConfig.mutateAsync({
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        default_analysis_days: defaultDays,
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleTestConnection = async () => {
    await testConnection.mutateAsync();
  };

  const connectionStatus = config?.bot_token_configured ? 'connected' : 'disconnected';

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Slack Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your Slack workspace connection and bot settings
        </p>
      </div>

      {/* Success/Error Alerts */}
      {updateConfig.isSuccess && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Configuration updated successfully!
          </AlertDescription>
        </Alert>
      )}

      {updateConfig.isError && (
        <Alert className="mb-6 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to update configuration. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {testConnection.isSuccess && testConnection.data && (
        <Alert className={`mb-6 ${testConnection.data.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {testConnection.data.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={testConnection.data.success ? 'text-green-800' : 'text-red-800'}>
            {testConnection.data.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Connection Status</span>
            {configLoading ? (
              <Badge variant="outline">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Checking...
              </Badge>
            ) : connectionStatus === 'connected' ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-purple-600 flex items-center justify-center">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-medium">
                  Workspace: {config?.workspace_name || config?.workspace_id || 'Not configured'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Token: {config?.bot_token_masked || 'Not configured'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!config?.bot_token_configured || testConnection.isPending}
            >
              {testConnection.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bot Token Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Bot Token Configuration
          </CardTitle>
          <CardDescription>
            Configure your Slack bot token for API access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditingToken ? (
            <>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Bot Token</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config?.bot_token_masked || 'Not configured'}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setIsEditingToken(true)}>
                  {config?.bot_token_configured ? 'Update Token' : 'Configure Token'}
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Your bot token is securely stored and encrypted. Only the last 4 characters are displayed.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="bot_token">Slack Bot Token</Label>
                <Input
                  id="bot_token"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-your-bot-token-here"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Your bot token starts with "xoxb-" and can be found in your Slack app settings
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveToken}
                  disabled={!botToken || updateConfig.isPending}
                >
                  {updateConfig.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Token'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingToken(false);
                    setBotToken('');
                  }}
                  disabled={updateConfig.isPending}
                >
                  Cancel
                </Button>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Security Note:</strong> Your bot token will be encrypted and stored securely in DynamoDB.
                  It will be used by the backend Lambda functions for API access.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* How to Get Token */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-purple-700 hover:text-purple-800">
              How to get your Slack bot token
            </summary>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground pl-4">
              <p>
                1. Go to{' '}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 hover:underline inline-flex items-center gap-1"
                >
                  api.slack.com/apps
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p>2. Select your app or create a new one</p>
              <p>3. Navigate to "OAuth & Permissions"</p>
              <p>4. Copy the "Bot User OAuth Token" (starts with xoxb-)</p>
              <p>5. Paste it in the field above</p>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Workspace Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>
            Configure default analysis parameters
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
            <Label htmlFor="workspace_name">Workspace Name</Label>
            <Input
              id="workspace_name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Company Workspace"
            />
            <p className="text-xs text-muted-foreground">
              Human-readable workspace name for display
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

          <Button
            onClick={handleSaveSettings}
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Bot Permissions (Collapsed by default) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Required Bot Permissions
          </CardTitle>
          <CardDescription>
            OAuth scopes needed for the CommProbe Slack bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-purple-700 hover:text-purple-800">
              View Required Scopes
            </summary>
            <div className="space-y-3 mt-3">
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
          </details>
        </CardContent>
      </Card>

      {/* API Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How to Use Slack Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              After configuring your bot token, navigate to the Slack dashboard to view team member profiles
              and channel summaries. The analysis runs automatically when you view users or channels.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Quick Start:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>Configure your bot token above</li>
              <li>Invite the bot to your Slack channels</li>
              <li>Go to Slack dashboard to view team insights</li>
              <li>Analysis focuses on team collaboration and daily activity</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
