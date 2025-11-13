/**
 * Slack Channel Detail Page
 * Daily digest with highlights, participation leaderboard, and topic analysis
 */

'use client';

export const runtime = 'edge';

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSlackChannelSummary, useAnalyzeSlackChannel } from '@/hooks/useSlackApi';
import {
  Hash,
  Lock,
  Users,
  MessageCircle,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Trophy,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

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
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      console.error('Failed to trigger reanalysis:', error);
    }
  };

  const getContributionBadgeVariant = (level: string): 'default' | 'secondary' | 'outline' => {
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

  // Prepare topic cluster data for visualization
  const topicClusterData = summary?.topic_clusters?.map((cluster) => ({
    topic: cluster.topic,
    count: cluster.count,
  })) || [];

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
      <Button variant="ghost" className="mb-4" onClick={() => router.push('/slack/channels')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Channels
      </Button>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-8 text-white mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Hash className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">#{summary.channel_name}</h1>
                {summary.is_private && <Lock className="h-6 w-6" />}
              </div>
              {summary.channel_purpose && (
                <p className="text-blue-100 mt-1">{summary.channel_purpose}</p>
              )}
              <div className="flex gap-4 mt-2">
                <span className="text-sm">{summary.num_members} members</span>
                <span className="text-sm">•</span>
                <span className="text-sm">{summary.messages_analyzed} messages analyzed</span>
                {summary.participation_rate && (
                  <>
                    <span className="text-sm">•</span>
                    <span className="text-sm">
                      {(summary.participation_rate * 100).toFixed(0)}% participation
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
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
                Refresh Digest
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Highlights */}
          {summary.highlights && summary.highlights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  Today's Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.highlights.map((highlight, i) => (
                    <div key={i} className="border-l-4 border-yellow-400 pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                            {highlight.author[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{highlight.author}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(highlight.timestamp).toLocaleTimeString()}
                        </span>
                        {highlight.reactions && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {highlight.reactions} reactions
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{highlight.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily Digest */}
          {summary.daily_digest && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-blue-500" />
                  Daily Digest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {summary.daily_digest}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Conversation Topics */}
          {summary.key_topics && summary.key_topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conversation Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {summary.key_topics.map((topic, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-sm px-3 py-1 cursor-pointer hover:bg-purple-100 transition-colors"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Topic Clusters Chart */}
          {topicClusterData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Topic Distribution</CardTitle>
                <CardDescription>Message count by discussion topic</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topicClusterData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="topic" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" name="Messages" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participation Leaderboard */}
          {summary.key_contributors && summary.key_contributors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.key_contributors.slice(0, 5).map((contributor, i) => (
                    <div key={contributor.user_id} className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                        #{i + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white">
                          {contributor.user_name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1">{contributor.user_name}</span>
                      <Badge variant={getContributionBadgeVariant(contributor.contribution_level)}>
                        {contributor.contribution_level}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channel Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Messages analyzed</span>
                <span className="font-semibold">{summary.messages_analyzed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active members</span>
                <span className="font-semibold">{summary.num_members}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Analysis period</span>
                <span className="font-semibold">{summary.analysis_period_days} days</span>
              </div>
              {summary.participation_rate && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Participation rate</span>
                  <span className="font-semibold">
                    {(summary.participation_rate * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {summary.activity_trend && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Activity trend</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {summary.activity_trend}
                  </Badge>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last updated</span>
                <span className="font-semibold text-xs">
                  {formatDistanceToNow(new Date(summary.last_updated * 1000), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          {summary.ai_summary && (
            <Card>
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {summary.ai_summary}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
