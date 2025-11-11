/**
 * Slack User Profile Detail Page
 * Comprehensive view of individual user's Slack activity and AI insights
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSlackUserProfile, useAnalyzeSlackUser } from '@/hooks/useSlackApi';
import {
  Hash,
  MessageCircle,
  MessageSquare,
  Activity,
  Sparkles,
  Brain,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function UserProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.user_id as string;

  const { data: profile, isLoading, error, refetch } = useSlackUserProfile(userId);
  const analyzeUser = useAnalyzeSlackUser();

  const handleReanalyze = async () => {
    if (!profile) return;
    try {
      await analyzeUser.mutateAsync({
        user_email: profile.user_email,
        days: profile.analysis_period_days,
        workspace_id: profile.workspace_id,
      });
      // Refetch after a delay to allow processing
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      console.error('Failed to trigger reanalysis:', error);
    }
  };

  const getInfluenceBadgeVariant = (level: string) => {
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

  if (error || !profile) {
    return (
      <AppLayout>
        <Card className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">User Profile Not Found</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Unable to load user profile'}
            </p>
            <Button onClick={() => router.push('/slack/users')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users List
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
        onClick={() => router.push('/slack/users')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Users
      </Button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {/* Avatar */}
        <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
          <span className="text-2xl font-semibold text-purple-700">
            {profile.user_name[0]?.toUpperCase()}
          </span>
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{profile.display_name || profile.user_name}</h1>
          <p className="text-muted-foreground">{profile.user_email}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant={getInfluenceBadgeVariant(profile.influence_level)}>
              {profile.influence_level} Influence
            </Badge>
            <Badge variant="outline">{profile.analysis_period_days}-day analysis</Badge>
            <Badge variant="outline">
              Updated {formatDistanceToNow(new Date(profile.last_updated * 1000))} ago
            </Badge>
          </div>
        </div>

        <Button
          onClick={handleReanalyze}
          disabled={analyzeUser.isPending}
        >
          {analyzeUser.isPending ? (
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

      {/* Engagement Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_channels}</div>
            <p className="text-xs text-muted-foreground">
              Active in {profile.active_channels} channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_messages}</div>
            <p className="text-xs text-muted-foreground">Total messages posted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies Made</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_replies}</div>
            <p className="text-xs text-muted-foreground">Replies to others</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_activity}</div>
            <p className="text-xs text-muted-foreground">Combined engagement</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Persona Summary */}
      {profile.ai_persona_summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Persona Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed whitespace-pre-line">
              {profile.ai_persona_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Interests & Expertise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Interests & Focus Areas</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.interests && profile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, i) => (
                  <Badge key={i} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No interests identified</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expertise Areas</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.expertise_areas && profile.expertise_areas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.expertise_areas.map((area, i) => (
                  <Badge key={i} variant="outline">
                    {area}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No expertise areas identified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel Activity Breakdown */}
      {profile.channel_breakdown && profile.channel_breakdown.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Channel Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.channel_breakdown.map((channel) => (
                <div
                  key={channel.channel_id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{channel.channel_name}</p>
                      {channel.last_activity && (
                        <p className="text-xs text-muted-foreground">
                          Last active: {new Date(channel.last_activity).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-right">
                      <p className="font-semibold">{channel.message_count}</p>
                      <p className="text-xs text-muted-foreground">Messages</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{channel.reply_count}</p>
                      <p className="text-xs text-muted-foreground">Replies</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Opinions & Pain Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Key Opinions */}
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-green-700">Key Opinions</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.key_opinions && profile.key_opinions.length > 0 ? (
              <ul className="space-y-2">
                {profile.key_opinions.map((opinion, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <span className="text-sm">{opinion}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No key opinions identified</p>
            )}
          </CardContent>
        </Card>

        {/* Pain Points */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-orange-700">Pain Points</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.pain_points && profile.pain_points.length > 0 ? (
              <ul className="space-y-2">
                {profile.pain_points.map((pain, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-1 flex-shrink-0" />
                    <span className="text-sm">{pain}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No pain points identified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full AI Insights */}
      {profile.ai_insights && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              Detailed AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {profile.ai_insights}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata Footer */}
      <div className="text-sm text-muted-foreground text-center py-4 border-t">
        Analysis Date: {new Date(profile.analysis_date).toLocaleDateString()} •
        Analysis Period: {profile.analysis_period_days} days •
        Messages Analyzed: {profile.total_messages.toLocaleString()} •
        AI Tokens Used: {profile.ai_tokens_used.toLocaleString()}
      </div>
    </AppLayout>
  );
}
