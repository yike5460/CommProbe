/**
 * SlackUserCard Component
 * Displays a Slack user profile summary card with activity-focused design
 */

'use client';

import { SlackUserProfile } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, TrendingUp, Hash, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface SlackUserCardProps {
  user: SlackUserProfile;
  onViewDetails?: (userId: string) => void;
}

export function SlackUserCard({ user, onViewDetails }: SlackUserCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onViewDetails) {
      onViewDetails(user.user_id);
    } else {
      router.push(`/slack/users/${user.user_id}`);
    }
  };

  const getActivityVariant = (activity: number): 'default' | 'secondary' | 'outline' => {
    if (activity >= 200) return 'default';
    if (activity >= 50) return 'secondary';
    return 'outline';
  };

  const getActivityLabel = (activity: number): string => {
    if (activity >= 200) return 'Very Active';
    if (activity >= 50) return 'Active';
    return 'Low Activity';
  };

  const formatLastActive = (timestamp: number): string => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* Avatar with online indicator */}
          <div className="relative">
            <Avatar className="h-14 w-14 ring-2 ring-purple-200">
              <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white text-lg">
                {user.user_name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {user.activity_trend === 'increasing' && (
              <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">
              {user.display_name || user.user_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{user.user_email}</p>
            <p className="text-xs text-muted-foreground">
              Last active: {formatLastActive(user.last_updated)}
            </p>
          </div>

          {/* Activity Level Badge */}
          <Badge variant={getActivityVariant(user.total_activity)} className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {getActivityLabel(user.total_activity)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Activity Metrics - Visual Representation */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-2 bg-purple-50 rounded-lg">
            <MessageCircle className="h-5 w-5 text-purple-600 mb-1" />
            <p className="text-xl font-bold text-purple-700">{user.total_messages}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
          <div className="flex flex-col items-center p-2 bg-blue-50 rounded-lg">
            <Hash className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-xl font-bold text-blue-700">{user.active_channels}</p>
            <p className="text-xs text-muted-foreground">Channels</p>
          </div>
          <div className="flex flex-col items-center p-2 bg-green-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 mb-1" />
            <p className="text-xl font-bold text-green-700">
              {user.engagement_score?.toFixed(1) || '0.0'}
            </p>
            <p className="text-xs text-muted-foreground">Engagement</p>
          </div>
        </div>

        {/* Recent Channels (Bubbles) */}
        {user.channel_breakdown && user.channel_breakdown.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Active in:</p>
            <div className="flex flex-wrap gap-2">
              {user.channel_breakdown.slice(0, 4).map((ch) => (
                <div
                  key={ch.channel_id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full"
                >
                  <Hash className="h-3 w-3" />
                  <span className="text-xs">{ch.channel_name}</span>
                </div>
              ))}
              {user.channel_breakdown.length > 4 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{user.channel_breakdown.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Currently Exploring (instead of static interests) */}
        {user.interests && user.interests.length > 0 && (
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Currently exploring:</p>
            <div className="flex flex-wrap gap-1">
              {user.interests.slice(0, 3).map((interest, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary Preview */}
        {user.ai_persona_summary && (
          <div className="border-l-2 border-purple-300 pl-3">
            <p className="text-sm text-muted-foreground italic line-clamp-2">
              "{user.ai_persona_summary}"
            </p>
          </div>
        )}

        {/* Action Button */}
        <Button
          variant="ghost"
          className="w-full mt-auto group-hover:bg-purple-50 group-hover:text-purple-700 transition-colors"
          onClick={handleClick}
        >
          View Activity Details →
        </Button>
      </CardContent>
    </Card>
  );
}
