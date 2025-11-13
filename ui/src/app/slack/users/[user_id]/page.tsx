/**
 * Slack User Profile Detail Page
 * Comprehensive view with activity timeline, charts, and collaboration network
 */

'use client';

export const runtime = 'edge';

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSlackUserProfile, useAnalyzeSlackUser } from '@/hooks/useSlackApi';
import {
  Hash,
  MessageCircle,
  MessageSquare,
  Activity,
  Sparkles,
  Brain,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';

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
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      console.error('Failed to trigger reanalysis:', error);
    }
  };

  const formatLastActive = (timestamp: number): string => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  // Prepare activity timeline data (mock for now - can be enhanced with real data)
  const activityTimelineData = profile?.channel_breakdown?.slice(0, 10).map((ch, idx) => ({
    date: `Week ${idx + 1}`,
    messages: ch.message_count,
    replies: ch.reply_count,
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
      <Button variant="ghost" className="mb-4" onClick={() => router.push('/slack/users')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Users
      </Button>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-xl p-8 text-white mb-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
            <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-600 to-purple-800 text-white">
              {profile.user_name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.display_name || profile.user_name}</h1>
            <p className="text-purple-100">{profile.user_email}</p>
            {profile.most_active_time && (
              <p className="text-sm text-purple-200 mt-1">
                Most active: {profile.most_active_time}
              </p>
            )}
            <div className="flex gap-4 mt-3">
              <div>
                <p className="text-2xl font-bold">{profile.total_activity}</p>
                <p className="text-xs text-purple-200">Total Activity</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{profile.active_channels}</p>
                <p className="text-xs text-purple-200">Active Channels</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {profile.engagement_score?.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-purple-200">Engagement</p>
              </div>
              {profile.activity_trend && (
                <div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {profile.activity_trend}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
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
                Refresh Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Activity Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Timeline Chart */}
          {activityTimelineData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Message and reply activity over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={activityTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="messages"
                      stackId="1"
                      stroke="#8b5cf6"
                      fill="#c4b5fd"
                      name="Messages"
                    />
                    <Area
                      type="monotone"
                      dataKey="replies"
                      stackId="1"
                      stroke="#6366f1"
                      fill="#a5b4fc"
                      name="Replies"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Channel Participation Breakdown */}
          {profile.channel_breakdown && profile.channel_breakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Channel Participation</CardTitle>
                <CardDescription>Message activity across channels</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={profile.channel_breakdown.slice(0, 10)}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="channel_name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="message_count" fill="#8b5cf6" name="Messages" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Topics */}
          {profile.recent_topics && profile.recent_topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Topics</CardTitle>
                <CardDescription>Topics discussed in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.recent_topics.map((topic, i) => (
                    <Badge key={i} variant="secondary" className="text-sm">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Insights */}
        <div className="space-y-6">
          {/* Personal Summary */}
          {profile.ai_persona_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Personal Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {profile.ai_persona_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Currently Exploring */}
          {profile.interests && profile.interests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Currently Exploring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest, i) => (
                    <Badge key={i} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collaboration Network */}
          {profile.collaboration_network && profile.collaboration_network.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Collaborators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profile.collaboration_network.map((person) => (
                    <div key={person.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                            {person.user_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{person.user_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {person.interaction_count} interactions
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Engagement Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Channels</span>
                <span className="font-semibold">{profile.total_channels}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Channels</span>
                <span className="font-semibold">{profile.active_channels}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Messages</span>
                <span className="font-semibold">{profile.total_messages}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Replies</span>
                <span className="font-semibold">{profile.total_replies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Engagement Score</span>
                <span className="font-semibold">
                  {profile.engagement_score?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="font-semibold text-xs">
                  {formatLastActive(profile.last_updated)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Expertise Areas */}
          {profile.expertise_areas && profile.expertise_areas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Expertise Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise_areas.map((area, i) => (
                    <Badge key={i} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Full AI Insights */}
      {profile.ai_insights && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              Detailed Activity Analysis
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
    </AppLayout>
  );
}
