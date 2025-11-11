/**
 * Slack Channel Detail Page
 * Detailed channel analysis with product insights and recommendations
 */

'use client';

export const runtime = 'edge';

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSlackChannelSummary, useAnalyzeSlackChannel } from '@/hooks/useSlackApi';
import {
  Hash,
  Lock,
  Users,
  MessageCircle,
  Tag,
  Lightbulb,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Loader2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ChannelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.channel_id as string;

  const { data: summary, isLoading, error, refetch } = useSlackChannelSummary(channelId);
  const analyzeChannel = useAnalyzeSlackChannel();

  const handleReanalyze = async () => {
    if (!summary) return;
    try {
      await analyzeChannel.mutateAsync({
        channel_name: summary.channel_name,
        days: summary.analysis_period_days,
        workspace_id: summary.workspace_id,
      });
      // Refetch after a delay to allow processing
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      console.error('Failed to trigger reanalysis:', error);
    }
  };

  const getSentimentBadgeVariant = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'default';
      case 'neutral':
        return 'secondary';
      case 'negative':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getContributionBadgeVariant = (level: string) => {
    switch (level) {
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !summary) {
    return (
      <AppLayout>
        <Card className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Channel Summary Not Found</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Unable to load channel summary'}
            </p>
            <Button onClick={() => router.push('/slack/channels')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Channels List
            </Button>
          </div>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Back Button */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push('/slack/channels')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Channels
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Hash className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-3xl font-bold">{summary.channel_name}</h1>
            {summary.is_private && <Lock className="h-6 w-6 text-muted-foreground" />}
            <Badge variant={getSentimentBadgeVariant(summary.sentiment)} className="text-base px-3 py-1">
              {summary.sentiment}
            </Badge>
          </div>
          {summary.channel_purpose && (
            <p className="text-muted-foreground mt-2">{summary.channel_purpose}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="outline">{summary.analysis_period_days}-day analysis</Badge>
            <Badge variant="outline">
              Updated {formatDistanceToNow(new Date(summary.last_updated * 1000))} ago
            </Badge>
          </div>
        </div>

        <Button
          onClick={handleReanalyze}
          disabled={analyzeChannel.isPending}
        >
          {analyzeChannel.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analyze
            </>
          )}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.num_members}</div>
            <p className="text-xs text-muted-foreground">Total channel members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.messages_analyzed}</div>
            <p className="text-xs text-muted-foreground">Messages analyzed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Key Topics</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.key_topics?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Main discussion themes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feature Requests</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.feature_requests?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Identified requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Topics */}
      {summary.key_topics && summary.key_topics.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Key Topics & Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.key_topics.map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-sm">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Requests */}
      {summary.feature_requests && summary.feature_requests.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 mb-6">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Feature Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.feature_requests.map((request, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-medium text-orange-700 mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-foreground">{request}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pain Points */}
      {summary.pain_points && summary.pain_points.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 mb-6">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pain Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.pain_points.map((pain, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-medium text-red-700 mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-foreground">{pain}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Product Opportunities */}
      {summary.product_opportunities && summary.product_opportunities.length > 0 && (
        <Card className="border-green-200 bg-green-50/50 mb-6">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Product Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.product_opportunities.map((opportunity, i) => (
                <div key={i} className="bg-white p-3 rounded border border-green-200">
                  <p className="text-sm text-foreground">{opportunity}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategic Recommendations */}
      {summary.strategic_recommendations && summary.strategic_recommendations.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 mb-6">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.strategic_recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Contributors */}
      {summary.key_contributors && summary.key_contributors.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Key Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.key_contributors.map((contributor) => (
                <div
                  key={contributor.user_id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-sm font-semibold text-purple-700">
                      {contributor.user_name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{contributor.user_name}</p>
                    <Badge variant={getContributionBadgeVariant(contributor.contribution_level)} className="mt-1">
                      {contributor.contribution_level}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full AI Summary */}
      {summary.ai_summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI-Generated Channel Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {summary.ai_summary}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata Footer */}
      <div className="text-sm text-muted-foreground text-center py-4 border-t">
        Analysis Date: {new Date(summary.analysis_date).toLocaleDateString()} •
        Analysis Period: {summary.analysis_period_days} days •
        Messages Analyzed: {summary.messages_analyzed.toLocaleString()} •
        AI Tokens Used: {summary.ai_tokens_used.toLocaleString()}
      </div>
    </AppLayout>
  );
}
