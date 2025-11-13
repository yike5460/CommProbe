/**
 * SlackChannelCard Component
 * Displays a Slack channel summary card with daily digest focus
 */

'use client';

import { SlackChannelSummary } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Hash, Lock, Sparkles, Activity } from 'lucide-react';
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
    // Extract first meaningful sentence from AI summary
    const sentences = summary?.split('.') || [];
    return sentences[0] ? sentences[0] + '.' : 'No highlights available yet';
  };

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Hash className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">{channel.channel_name}</h3>
                {channel.is_private && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {channel.messages_analyzed} messages • {channel.num_members} members
              </p>
            </div>
          </div>

          {/* Activity Level */}
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {getActivityLevel(channel.messages_analyzed, channel.analysis_period_days)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Today's Highlights */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Today's Highlights
          </p>
          <p className="text-sm text-blue-800 line-clamp-2">
            {channel.daily_digest || extractHighlights(channel.ai_summary)}
          </p>
        </div>

        {/* Main Topics (Bubbles) */}
        {channel.key_topics && channel.key_topics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Main topics:</p>
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
            <p className="text-xs font-medium text-muted-foreground mb-2">Active participants:</p>
            <div className="flex -space-x-2">
              {channel.key_contributors.slice(0, 5).map((contributor) => (
                <Avatar key={contributor.user_id} className="h-8 w-8 border-2 border-white">
                  <AvatarFallback className="text-xs bg-gradient-to-br from-purple-400 to-purple-600 text-white">
                    {contributor.user_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {channel.key_contributors.length > 5 && (
                <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{channel.key_contributors.length - 5}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          variant="ghost"
          className="w-full mt-auto group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors"
          onClick={handleClick}
        >
          Read Full Digest →
        </Button>
      </CardContent>
    </Card>
  );
}
