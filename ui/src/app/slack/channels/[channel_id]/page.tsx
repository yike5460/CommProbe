/**
 * Slack Channel Detail Page
 * Daily digest with highlights, participation leaderboard, and topic analysis
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
import { useSlackChannelSummary, useAnalyzeSlackChannel, useDeleteSlackChannel } from '@/hooks/useSlackApi';
import {
  Hash,
  Lock,
  MessageCircle,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Trophy,
  Activity,
  Users as UsersIcon,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// Helper function to render markdown-style text as formatted HTML
function renderMarkdownText(text: string) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let inList = false;
  let listItems: JSX.Element[] = [];

  const flushList = (index: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${index}`} className="list-disc ml-6 space-y-1 mb-3">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      flushList(idx);
      return;
    }

    // Main headers (# Title)
    if (trimmed.match(/^# [^#]/)) {
      flushList(idx);
      // Remove all emojis and special characters using regex
      const content = trimmed.replace(/^# /, '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
      elements.push(
        <h2 key={idx} className="text-2xl font-bold mt-6 mb-3 first:mt-0">
          {content}
        </h2>
      );
    }
    // Section headers (##)
    else if (trimmed.startsWith('## ')) {
      flushList(idx);
      // Remove all emojis and special characters
      const content = trimmed.replace('## ', '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
      elements.push(
        <h3 key={idx} className="text-lg font-bold mt-5 mb-2">
          {content}
        </h3>
      );
    }
    // Sub headers (###)
    else if (trimmed.startsWith('### ')) {
      flushList(idx);
      let content = trimmed.replace('### ', '');
      // Remove markdown bold (**text**)
      content = content.replace(/\*\*(.*?)\*\*/g, '$1');
      // Remove all emojis and special characters
      content = content.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
      elements.push(
        <h4 key={idx} className="text-base font-semibold mt-4 mb-2">
          {content}
        </h4>
      );
    }
    // Bullet points (-)
    else if (trimmed.startsWith('- ')) {
      inList = true;
      const content = trimmed.substring(2);
      // Process inline markdown links [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      let match;

      while ((match = linkRegex.exec(content)) !== null) {
        // Add text before link
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        // Add link
        parts.push(
          <a
            key={match.index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {match[1]}
          </a>
        );
        lastIndex = match.index + match[0].length;
      }
      // Add remaining text
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      listItems.push(
        <li key={idx} className="text-sm text-muted-foreground">
          {parts.length > 0 ? parts : content}
        </li>
      );
    }
    // Regular paragraphs
    else {
      flushList(idx);
      let content = trimmed;

      // Process inline markdown bold (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        parts.push(
          <strong key={match.index} className="font-semibold text-foreground">
            {match[1]}
          </strong>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      // Process links in non-bold text
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const finalParts: (string | JSX.Element)[] = [];

      parts.forEach((part, partIdx) => {
        if (typeof part === 'string') {
          let str = part;
          let lastLinkIndex = 0;
          let linkMatch;

          while ((linkMatch = linkRegex.exec(str)) !== null) {
            if (linkMatch.index > lastLinkIndex) {
              finalParts.push(str.substring(lastLinkIndex, linkMatch.index));
            }
            finalParts.push(
              <a
                key={`${idx}-link-${partIdx}-${linkMatch.index}`}
                href={linkMatch[2]}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {linkMatch[1]}
              </a>
            );
            lastLinkIndex = linkMatch.index + linkMatch[0].length;
          }
          if (lastLinkIndex < str.length) {
            finalParts.push(str.substring(lastLinkIndex));
          }
        } else {
          finalParts.push(part);
        }
      });

      elements.push(
        <p key={idx} className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {finalParts.length > 0 ? finalParts : content}
        </p>
      );
    }
  });

  flushList(lines.length);

  return <div className="space-y-1">{elements}</div>;
}

export default function ChannelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.channel_id as string;

  const { data: summary, isLoading, error, refetch } = useSlackChannelSummary(channelId);
  const analyzeChannel = useAnalyzeSlackChannel();
  const deleteChannel = useDeleteSlackChannel();

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

  const handleDelete = async () => {
    if (!summary) return;
    if (!confirm(`Are you sure you want to delete the summary for #${summary.channel_name}?`)) {
      return;
    }
    try {
      await deleteChannel.mutateAsync({
        channelId: summary.channel_id,
        workspaceId: summary.workspace_id,
      });
      // Redirect to channels list after successful deletion
      router.push('/slack/channels');
    } catch (error) {
      console.error('Failed to delete channel summary:', error);
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

  // Prepare topic cluster data - filter out placeholders
  const topicClusterData = summary?.topic_clusters
    ?.filter(cluster => cluster.topic !== 'Topics analysis in progress')
    ?.map((cluster) => ({
      topic: cluster.topic.length > 20 ? cluster.topic.substring(0, 20) + '...' : cluster.topic,
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

      {/* Header Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border-2 bg-muted flex items-center justify-center">
                <Hash className="h-8 w-8 text-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">#{summary.channel_name}</h1>
                  {summary.is_private && <Lock className="h-5 w-5 text-muted-foreground" />}
                </div>
                {summary.channel_purpose && (
                  <p className="text-muted-foreground mt-1">{summary.channel_purpose}</p>
                )}
                <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                  <span>{summary.num_members} members</span>
                  <span>•</span>
                  <span>{summary.messages_analyzed} messages</span>
                  {summary.participation_rate && (
                    <>
                      <span>•</span>
                      <span>{(summary.participation_rate * 100).toFixed(0)}% participation</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
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
                    Refresh
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleteChannel.isPending}
              >
                {deleteChannel.isPending ? (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Highlights */}
          {summary.highlights && summary.highlights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.highlights.map((highlight, i) => (
                    <div key={i} className="border-l-2 border-border pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs bg-muted text-foreground">
                            {highlight.author?.substring(0, 2)?.toUpperCase() || 'U'}
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
                      <p className="text-sm text-foreground">{highlight.text}</p>
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
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  Daily Digest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {renderMarkdownText(summary.daily_digest)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation Topics - Filter out placeholders */}
          {summary.key_topics && summary.key_topics.length > 0 && (
            (() => {
              const validTopics = summary.key_topics.filter(
                topic => topic !== 'Topics analysis in progress'
              );
              return validTopics.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Topics</CardTitle>
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

          {/* Topic Distribution Chart - Only show if we have real data */}
          {topicClusterData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Topic Distribution</CardTitle>
                <CardDescription>Message count by discussion topic</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topicClusterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="topic"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#6366f1"
                      name="Messages"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* AI Summary - with proper markdown rendering */}
          {summary.ai_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  Channel Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {renderMarkdownText(summary.ai_summary)}
                </div>
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
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.key_contributors.slice(0, 5).map((contributor, i) => (
                    <div key={contributor.user_id} className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-foreground font-bold text-xs">
                        #{i + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted text-foreground">
                          {contributor.user_name?.substring(0, 2)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contributor.user_name || contributor.user_id}
                        </p>
                        <Badge variant={getContributionBadgeVariant(contributor.contribution_level)} className="text-xs mt-1">
                          {contributor.contribution_level}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channel Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
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
                <span className="text-xs font-semibold">
                  {formatDistanceToNow(new Date(summary.last_updated * 1000), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
