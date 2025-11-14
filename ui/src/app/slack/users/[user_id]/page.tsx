/**
 * Slack User Profile Detail Page
 * Comprehensive view with activity timeline, charts, and collaboration network
 * Theme: Consistent with main app (minimal, subtle colors)
 */

'use client';

export const runtime = 'edge';

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSlackUserProfile, useAnalyzeSlackUser, useDeleteSlackUser } from '@/hooks/useSlackApi';
import {
  MessageCircle,
  Activity,
  Sparkles,
  Brain,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Users,
  Trash2,
  Hash,
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
  Cell,
  Legend,
  PieChart,
  Pie,
  ComposedChart,
  Line,
} from 'recharts';

// Helper function to render markdown text with proper formatting
function renderMarkdownText(text: string) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: JSX.Element[] = [];

  const flushList = (index: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${index}`} className="list-disc ml-6 space-y-1 mb-3">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  // Helper to clean text: remove emojis and process bold
  const cleanAndFormatText = (text: string) => {
    // Remove emojis
    let cleaned = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

    // Process bold (**text**)
    const parts: (string | JSX.Element)[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(cleaned)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleaned.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < cleaned.length) {
      parts.push(cleaned.substring(lastIndex));
    }

    return parts.length > 0 ? parts : cleaned;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(idx);
      return;
    }

    // Main headers (# Title)
    if (trimmed.match(/^# [^#]/)) {
      flushList(idx);
      const content = cleanAndFormatText(trimmed.replace(/^# /, ''));
      elements.push(
        <h2 key={idx} className="text-2xl font-bold mt-6 mb-3 first:mt-0">
          {content}
        </h2>
      );
    }
    // Section headers (##)
    else if (trimmed.startsWith('## ')) {
      flushList(idx);
      const content = cleanAndFormatText(trimmed.replace(/^## /, ''));
      elements.push(
        <h3 key={idx} className="text-lg font-bold mt-5 mb-2">
          {content}
        </h3>
      );
    }
    // Sub headers (###)
    else if (trimmed.startsWith('### ')) {
      flushList(idx);
      const content = cleanAndFormatText(trimmed.replace(/^### /, ''));
      elements.push(
        <h4 key={idx} className="text-base font-semibold mt-4 mb-2">
          {content}
        </h4>
      );
    }
    // Bullet points (-)
    else if (trimmed.startsWith('- ')) {
      const content = cleanAndFormatText(trimmed.substring(2));
      listItems.push(
        <li key={idx} className="text-sm text-muted-foreground">
          {content}
        </li>
      );
    }
    // Regular paragraphs
    else {
      flushList(idx);
      const content = cleanAndFormatText(trimmed);
      elements.push(
        <p key={idx} className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {content}
        </p>
      );
    }
  });

  flushList(lines.length);
  return <div className="space-y-1">{elements}</div>;
}

export default function UserProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.user_id as string;

  const { data: profile, isLoading, error, refetch } = useSlackUserProfile(userId);
  const analyzeUser = useAnalyzeSlackUser();
  const deleteUser = useDeleteSlackUser();

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

  const handleDelete = async () => {
    if (!profile) return;
    if (!confirm(`Are you sure you want to delete the profile for ${profile.display_name || profile.user_name}?`)) {
      return;
    }
    try {
      await deleteUser.mutateAsync({
        userId: profile.user_id,
        workspaceId: profile.workspace_id,
      });
      router.push('/slack/users');
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const formatLastActive = (timestamp: number): string => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  // Prepare activity timeline data - sorted by total activity
  const activityTimelineData = profile?.channel_breakdown
    ?.map((ch) => ({
      name: ch.channel_name.length > 15 ? ch.channel_name.substring(0, 15) + '...' : ch.channel_name,
      fullName: ch.channel_name,
      messages: ch.message_count,
      replies: ch.reply_count,
      total: ch.message_count + ch.reply_count,
    }))
    .sort((a, b) => b.total - a.total) || [];

  // Prepare channel participation data with percentages
  const totalActivity = profile?.total_activity || 1;
  const channelParticipationData = profile?.channel_breakdown
    ?.map((ch) => ({
      channel_name: ch.channel_name,
      message_count: ch.message_count,
      reply_count: ch.reply_count,
      total: ch.message_count + ch.reply_count,
      percentage: ((ch.message_count + ch.reply_count) / totalActivity) * 100,
    }))
    .sort((a, b) => b.total - a.total) || [];

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

      {/* Header Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-muted text-foreground">
                {profile.user_name?.substring(0, 2)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{profile.display_name || profile.user_name}</h1>
              <p className="text-muted-foreground">{profile.user_email}</p>
              {profile.most_active_time && (
                <p className="text-sm text-muted-foreground mt-1">
                  Most active: {profile.most_active_time}
                </p>
              )}
              <div className="flex gap-6 mt-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-indigo-600" />
                    <p className="text-xl font-bold">{profile.total_messages}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Messages</p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-600" />
                    <p className="text-xl font-bold">{profile.total_replies}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Replies</p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-pink-600" />
                    <p className="text-xl font-bold">{profile.active_channels}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Active Channels</p>
                </div>
                {profile.collaboration_network && profile.collaboration_network.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-600" />
                      <p className="text-xl font-bold">{profile.collaboration_network.length}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Collaborators</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
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
                    Refresh
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleteUser.isPending}
              >
                {deleteUser.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Activity Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Distribution - Combined View */}
          {activityTimelineData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>
                  Message and reply distribution across {activityTimelineData.length} active channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Stacked Bar Chart - showing breakdown by channel */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Channel Activity Breakdown</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={activityTimelineData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" stroke="#9ca3af" />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={100}
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                          }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                                  <p className="font-semibold text-sm mb-1">{data.fullName}</p>
                                  <p className="text-xs text-indigo-600">Messages: {data.messages}</p>
                                  <p className="text-xs text-purple-600">Replies: {data.replies}</p>
                                  <p className="text-xs font-semibold mt-1">Total: {data.total}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar dataKey="messages" stackId="a" fill="#6366f1" name="Messages" />
                        <Bar dataKey="replies" stackId="a" fill="#8b5cf6" name="Replies" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie Chart - showing channel contribution */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Channel Contribution</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={activityTimelineData}
                          dataKey="total"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent, index }) => {
                            // Only show name for top 3 channels
                            if (index < 3) {
                              return `${name}: ${(percent * 100).toFixed(0)}%`;
                            }
                            return `${(percent * 100).toFixed(0)}%`;
                          }}
                          labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                        >
                          {activityTimelineData.map((entry, index) => {
                            // Harmonized color palette - indigo, purple, pink, amber, cyan, blue, rose
                            const colors = [
                              '#6366f1', // indigo-500
                              '#8b5cf6', // purple-500
                              '#ec4899', // pink-500
                              '#f59e0b', // amber-500
                              '#06b6d4', // cyan-500
                              '#3b82f6', // blue-500
                              '#f43f5e', // rose-500
                            ];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                          }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const percentage = ((data.total / totalActivity) * 100).toFixed(1);
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                                  <p className="font-semibold text-sm mb-1">{data.fullName}</p>
                                  <div className="flex items-center gap-3 text-xs mt-2">
                                    <div className="flex items-center gap-1">
                                      <MessageCircle className="h-3 w-3 text-indigo-600" />
                                      <span>{data.messages}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Activity className="h-3 w-3 text-purple-600" />
                                      <span>{data.replies}</span>
                                    </div>
                                  </div>
                                  <p className="text-xs font-semibold mt-2">
                                    {data.total} activities ({percentage}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channel Participation Insights */}
          {channelParticipationData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Channel Participation Insights</CardTitle>
                <CardDescription>
                  Detailed breakdown of activity across {channelParticipationData.length} channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Top Channels Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                      <div className="text-xl font-bold text-indigo-600 truncate" title={channelParticipationData[0]?.channel_name}>
                        #{channelParticipationData[0]?.channel_name || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Most Active Channel</div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1 text-xs">
                          <MessageCircle className="h-3 w-3 text-indigo-600" />
                          <span className="font-semibold text-indigo-700">{channelParticipationData[0]?.message_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Activity className="h-3 w-3 text-indigo-600" />
                          <span className="font-semibold text-indigo-700">{channelParticipationData[0]?.reply_count || 0}</span>
                        </div>
                        <span className="text-xs text-indigo-600">
                          ({channelParticipationData[0]?.percentage.toFixed(1) || 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <div className="text-2xl font-bold text-purple-600">
                        {channelParticipationData.length}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Active Channels</div>
                      <div className="text-sm font-semibold text-purple-700 mt-2">
                        out of {profile.total_channels} total
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg border border-pink-200">
                      <div className="text-2xl font-bold text-pink-600">
                        {(profile.total_activity / channelParticipationData.length).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Avg per Channel</div>
                      <div className="text-sm font-semibold text-pink-700 mt-2">
                        activities each
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Bar Chart with Percentage */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">Activity by Channel</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          <span>Messages</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>Replies</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {channelParticipationData.map((channel, index) => {
                        const colors = [
                          'bg-indigo-500',
                          'bg-purple-500',
                          'bg-pink-500',
                          'bg-amber-500',
                          'bg-cyan-500',
                          'bg-blue-500',
                          'bg-rose-500',
                        ];
                        const bgColor = colors[index % colors.length];

                        return (
                          <div key={channel.channel_name} className="space-y-1 group">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium truncate">{channel.channel_name}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground group-hover:text-indigo-600 transition-colors">
                                    <MessageCircle className="h-3 w-3" />
                                    <span>{channel.message_count}</span>
                                  </div>
                                  <span className="text-muted-foreground">/</span>
                                  <div className="flex items-center gap-1 text-muted-foreground group-hover:text-purple-600 transition-colors">
                                    <Activity className="h-3 w-3" />
                                    <span>{channel.reply_count}</span>
                                  </div>
                                </div>
                                <span className="text-xs font-semibold w-12 text-right">
                                  {channel.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${bgColor} transition-all duration-500 ease-out`}
                                style={{ width: `${channel.percentage}%` }}
                                title={`${channel.message_count} messages, ${channel.reply_count} replies`}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{channel.total} total activities</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Engagement Pattern */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">Engagement Pattern</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-3 w-3 rounded-full bg-indigo-500" />
                        <span className="text-muted-foreground">Messages:</span>
                        <span className="font-semibold">{profile.total_messages}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-3 w-3 rounded-full bg-purple-500" />
                        <span className="text-muted-foreground">Replies:</span>
                        <span className="font-semibold">{profile.total_replies}</span>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        {profile.total_messages > profile.total_replies
                          ? '📝 More focused on initiating conversations'
                          : profile.total_replies > profile.total_messages
                          ? '💬 More focused on responding to discussions'
                          : '⚖️ Balanced between starting and joining conversations'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Topics */}
          {profile.recent_topics && profile.recent_topics.length > 0 && (
            (() => {
              const validTopics = profile.recent_topics.filter(
                topic => !topic.includes('analysis in progress')
              );
              return validTopics.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Topics</CardTitle>
                    <CardDescription>Topics discussed in the last 7 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {validTopics.map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-sm">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()
          )}
        </div>

        {/* Right Column: Insights */}
        <div className="space-y-6">
          {/* Personal Summary */}
          {profile.ai_persona_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  Personal Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {profile.ai_persona_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Currently Exploring */}
          {profile.interests && profile.interests.length > 0 && (
            (() => {
              const validInterests = profile.interests.filter(
                interest => !interest.includes('analysis in progress')
              );
              return validInterests.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Interests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {validInterests.map((interest, i) => (
                        <Badge key={i} variant="secondary">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()
          )}

          {/* Collaboration Network */}
          {profile.collaboration_network && profile.collaboration_network.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Top Collaborators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profile.collaboration_network.map((person) => (
                    <div key={person.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-muted text-foreground">
                            {person.user_name?.substring(0, 2)?.toUpperCase() || 'U'}
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

          {/* Participation Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Participation Overview</CardTitle>
              <CardDescription>Activity breakdown over last {profile.analysis_period_days} days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Channel Breadth */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Channel Breadth</span>
                  <span className="text-sm text-muted-foreground">
                    {profile.active_channels}/{profile.total_channels}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{
                      width: `${(profile.active_channels / profile.total_channels) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active in {((profile.active_channels / profile.total_channels) * 100).toFixed(0)}% of channels
                </p>
              </div>

              {/* Activity Type Distribution */}
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Activity Distribution</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm">Messages Posted</span>
                    </div>
                    <span className="font-semibold">{profile.total_messages}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Replies Given</span>
                    </div>
                    <span className="font-semibold">{profile.total_replies}</span>
                  </div>
                </div>
              </div>

              {/* Communication Pattern */}
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Communication Style</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {profile.communication_style || 'Collaborative team member'}
                </p>
              </div>

              {/* Activity Recency */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Active</span>
                  <span className="text-sm font-semibold">
                    {formatLastActive(profile.last_updated)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expertise Areas */}
          {profile.expertise_areas && profile.expertise_areas.length > 0 && (
            (() => {
              const validExpertise = profile.expertise_areas.filter(
                area => !area.includes('analysis in progress')
              );
              return validExpertise.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Expertise</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {validExpertise.map((area, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()
          )}

          {/* Channel Breakdown List */}
          {profile.channel_breakdown && profile.channel_breakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profile.channel_breakdown.map((ch) => (
                    <div key={ch.channel_id} className="flex items-center justify-between text-sm p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{ch.channel_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ch.message_count} msgs
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Full AI Insights - with markdown rendering */}
      {profile.ai_insights && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              Activity Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {renderMarkdownText(profile.ai_insights)}
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
