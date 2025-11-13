/**
 * SlackChannelCard Component
 * Displays a Slack channel summary card with daily digest focus
 * Theme: Consistent with main app (minimal, subtle colors)
 */

'use client';

import { SlackChannelSummary } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Hash, Lock, MessageCircle, Activity, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SlackChannelCardProps {
  channel: SlackChannelSummary;
  onViewDetails?: (channelId: string) => void;
}

export function SlackChannelCard({ channel, onViewDetails }: SlackChannelCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onViewDetails) {
      onViewDetails(channel.channel_id);
    } else {
      router.push(`/slack/channels/${channel.channel_id}`);
    }
  };

  const getActivityLevel = (messages: number, days: number): string => {
    const messagesPerDay = messages / days;
    if (messagesPerDay >= 10) return 'Very Active';
    if (messagesPerDay >= 3) return 'Active';
    return 'Low Activity';
  };

  const extractHighlights = (summary: string): string => {
    const sentences = summary?.split('.') || [];
    return sentences[0] ? sentences[0] + '.' : 'No highlights available yet';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Hash className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-base truncate">{channel.channel_name}</h3>
            {channel.is_private && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>

          {/* Activity Level Badge */}
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {getActivityLevel(channel.messages_analyzed, channel.analysis_period_days)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {channel.messages_analyzed} messages • {channel.num_members} members
        </p>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Digest Preview */}
        {(channel.daily_digest || channel.ai_summary) && (
          <div className="border-l-2 border-border pl-3 py-2">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {channel.daily_digest || extractHighlights(channel.ai_summary)}
            </p>
          </div>
        )}

        {/* Main Topics */}
        {channel.key_topics && channel.key_topics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Topics:</p>
            <div className="flex flex-wrap gap-1">
              {channel.key_topics.slice(0, 4).map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Active Participants */}
        {channel.key_contributors && channel.key_contributors.length > 0 && (
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Contributors:</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {channel.key_contributors.slice(0, 4).map((contributor) => (
                  <Avatar key={contributor.user_id} className="h-7 w-7 border-2 border-background">
                    <AvatarFallback className="text-xs bg-muted text-foreground">
                      {contributor.user_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {channel.key_contributors.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{channel.key_contributors.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          variant="outline"
          className="w-full mt-auto"
          onClick={handleClick}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}
