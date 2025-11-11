/**
 * AnalysisTrigger Component
 * Form to trigger Slack user or channel analysis
 */

'use client';

import { useState } from 'react';
import { useAnalyzeSlackUser, useAnalyzeSlackChannel } from '@/hooks/useSlackApi';
import { SlackAnalysisRequest } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, Hash, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AnalysisTriggerProps {
  type: 'user' | 'channel';
  onSuccess?: (response: any) => void;
  onError?: (error: Error) => void;
  defaultValues?: Partial<SlackAnalysisRequest>;
  compact?: boolean;
}

export function AnalysisTrigger({
  type,
  onSuccess,
  onError,
  defaultValues,
  compact = false,
}: AnalysisTriggerProps) {
  const analyzeUser = useAnalyzeSlackUser();
  const analyzeChannel = useAnalyzeSlackChannel();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<SlackAnalysisRequest>>({
    days: defaultValues?.days || 30,
    workspace_id: defaultValues?.workspace_id || 'default',
    ...defaultValues,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (type === 'user') {
        if (!formData.user_email && !formData.user_id) {
          setError('Please provide either a user email or user ID');
          return;
        }

        const response = await analyzeUser.mutateAsync({
          ...formData,
          analysis_type: 'user',
        } as SlackAnalysisRequest);

        if (onSuccess) onSuccess(response);
      } else {
        if (!formData.channel_name && !formData.channel_id) {
          setError('Please provide either a channel name or channel ID');
          return;
        }

        const response = await analyzeChannel.mutateAsync({
          ...formData,
          analysis_type: 'channel',
        } as SlackAnalysisRequest);

        if (onSuccess) onSuccess(response);
      }

      // Reset form on success
      setFormData({
        days: 30,
        workspace_id: 'default',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start analysis';
      setError(errorMessage);
      if (onError && err instanceof Error) onError(err);
    }
  };

  const isLoading = analyzeUser.isPending || analyzeChannel.isPending;

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {type === 'user' ? (
        <div className="space-y-2">
          <Label htmlFor="user_input">User Email or ID</Label>
          <Input
            id="user_input"
            placeholder="user@example.com or U123456789"
            value={formData.user_email || formData.user_id || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                [e.target.value.includes('@') ? 'user_email' : 'user_id']: e.target.value,
              })
            }
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">
            Enter an email address or Slack user ID
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="channel_input">Channel Name or ID</Label>
          <Input
            id="channel_input"
            placeholder="general or C123456789"
            value={formData.channel_name || formData.channel_id || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                [e.target.value.startsWith('C') ? 'channel_id' : 'channel_name']: e.target.value,
              })
            }
            disabled={isLoading}
            required
          />
          <p className="text-xs text-muted-foreground">
            Enter a channel name (without #) or Slack channel ID
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="days">Analysis Period (days)</Label>
        <Input
          id="days"
          type="number"
          min="7"
          max="90"
          value={formData.days || 30}
          onChange={(e) => setFormData({ ...formData, days: Number(e.target.value) })}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Analyze messages from the last 7-90 days
        </p>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            {type === 'user' ? (
              <Users className="mr-2 h-4 w-4" />
            ) : (
              <Hash className="mr-2 h-4 w-4" />
            )}
            Analyze {type === 'user' ? 'User' : 'Channel'}
          </>
        )}
      </Button>
    </form>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {type === 'user' ? (
            <>
              <Users className="h-5 w-5" />
              Analyze Team Member
            </>
          ) : (
            <>
              <Hash className="h-5 w-5" />
              Analyze Channel
            </>
          )}
        </CardTitle>
        <CardDescription>
          {type === 'user'
            ? 'Trigger AI analysis of a team member\'s Slack activity and interests'
            : 'Trigger AI analysis of a channel\'s discussions and insights'}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
