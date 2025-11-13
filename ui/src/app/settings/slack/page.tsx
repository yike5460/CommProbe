/**
 * Slack Settings Page
 * Configure Slack workspace and bot token
 * Theme: Consistent with main app (minimal, subtle colors)
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
  const { data: config, isLoading: configLoading } = useSlackConfig();
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
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Configuration updated successfully
          </AlertDescription>
        </Alert>
      )}

      {updateConfig.isError && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to update configuration. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {testConnection.isSuccess && testConnection.data && (
        <Alert className="mb-6">
          {testConnection.data.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
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
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Settings className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {config?.workspace_name || config?.workspace_id || 'Not configured'}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {config?.bot_token_masked || 'No token'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
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
            <Key className="h-4 w-4 text-muted-foreground" />
            Bot Token Configuration
          </CardTitle>
          <CardDescription>
            Configure your Slack bot token for API access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditingToken ? (
            <>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Bot Token</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config?.bot_token_masked || 'Not configured'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditingToken(true)}>
                  {config?.bot_token_configured ? 'Update' : 'Configure'}
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
                  size="sm"
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
                  size="sm"
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
                  Your bot token will be encrypted and stored securely in DynamoDB.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* How to Get Token */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium hover:underline">
              How to get your Slack bot token
            </summary>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground pl-4">
              <p>
                1. Go to{' '}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground inline-flex items-center gap-1"
                >
                  api.slack.com/apps
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p>2. Select your app or create a new one</p>
              <p>3. Navigate to "OAuth & Permissions"</p>
              <p>4. Copy the "Bot User OAuth Token" (starts with xoxb-)</p>
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
              Your Slack workspace identifier
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace_name">Workspace Name</Label>
            <Input
              id="workspace_name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Company"
            />
            <p className="text-xs text-muted-foreground">
              Display name for your workspace
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
              Number of days to analyze (7-90)
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

      {/* Bot Permissions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Required Bot Permissions
          </CardTitle>
          <CardDescription>
            OAuth scopes needed for the Slack bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm font-medium hover:underline">
              View Required Scopes
            </summary>
            <div className="space-y-2 mt-3">
              {[
                { scope: 'channels:history', desc: 'Read public channel messages' },
                { scope: 'channels:read', desc: 'List public channels' },
                { scope: 'groups:history', desc: 'Read private channel messages' },
                { scope: 'groups:read', desc: 'List private channels' },
                { scope: 'users:read', desc: 'View people in workspace' },
                { scope: 'users:read.email', desc: 'View email addresses' },
              ].map((item) => (
                <div key={item.scope} className="flex items-start gap-2 p-2 border rounded text-sm">
                  <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.scope}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            How to Use
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              After configuring your bot token, navigate to the Slack dashboard to view team member profiles
              and channel summaries.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Quick Start:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>Configure your bot token above</li>
              <li>Invite the bot to your Slack channels</li>
              <li>Go to Slack dashboard to view insights</li>
              <li>Analysis focuses on team collaboration and activity</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
