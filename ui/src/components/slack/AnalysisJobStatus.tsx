/**
 * AnalysisJobStatus Component
 * Displays real-time status of Slack analysis jobs with polling
 */

'use client';

import { useEffect } from 'react';
import { useSlackJobStatus } from '@/hooks/useSlackApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

interface AnalysisJobStatusProps {
  jobId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  compact?: boolean;
}

export function AnalysisJobStatus({
  jobId,
  onComplete,
  onError,
  compact = false,
}: AnalysisJobStatusProps) {
  const { data: job, isLoading, error } = useSlackJobStatus(jobId);

  // Trigger callbacks when job completes
  useEffect(() => {
    if (job?.status === 'completed' && onComplete) {
      onComplete();
    }
    if (job?.status === 'failed' && onError && job.error_message) {
      onError(job.error_message);
    }
  }, [job?.status, job?.error_message, onComplete, onError]);

  if (isLoading && !job) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Loading job status...</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>Failed to load job status</AlertDescription>
      </Alert>
    );
  }

  if (!job) return null;

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-yellow-500',
      message: 'Analysis queued...',
      progress: 10,
    },
    processing: {
      icon: Loader2,
      color: 'text-blue-500',
      message: 'Analyzing messages with AI...',
      progress: 50,
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-green-500',
      message: 'Analysis complete!',
      progress: 100,
    },
    failed: {
      icon: XCircle,
      color: 'text-red-500',
      message: 'Analysis failed',
      progress: 0,
    },
  };

  const config = statusConfig[job.status];
  const Icon = config.icon;

  const content = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-5 w-5 ${config.color} ${
            job.status === 'processing' ? 'animate-spin' : ''
          }`}
        />
        <span className="font-medium">{config.message}</span>
      </div>

      {job.status !== 'failed' && (
        <Progress value={config.progress} className="w-full" />
      )}

      {job.status === 'failed' && job.error_message && (
        <Alert variant="destructive">
          <AlertDescription>{job.error_message}</AlertDescription>
        </Alert>
      )}

      {job.status === 'completed' && (
        <p className="text-sm text-muted-foreground">
          Results are now available in the table below.
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Job ID: {job.job_id.slice(0, 8)}...</span>
        <span>
          Updated {new Date(job.updated_at * 1000).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );

  if (compact) {
    return <div className="p-4 border rounded-lg">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Progress</CardTitle>
        <CardDescription>
          Tracking {job.analysis_type} analysis for{' '}
          {job.user_email || job.channel_name || job.user_id || job.channel_id}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
