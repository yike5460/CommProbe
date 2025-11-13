/**
 * SlackUserCard Component
 * Displays a Slack user profile summary card with activity-focused design
 * Theme: Consistent with main app (minimal, subtle colors)
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
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-muted text-foreground">
              {user.user_name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {user.display_name || user.user_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{user.user_email}</p>
            <p className="text-xs text-muted-foreground">
              {formatLastActive(user.last_updated)}
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
        {/* Activity Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 border rounded-lg">
            <MessageCircle className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{user.total_messages}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
          <div className="flex flex-col items-center p-3 border rounded-lg">
            <Hash className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{user.active_channels}</p>
            <p className="text-xs text-muted-foreground">Channels</p>
          </div>
          <div className="flex flex-col items-center p-3 border rounded-lg">
            <TrendingUp className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-bold">
              {user.engagement_score?.toFixed(1) || '0.0'}
            </p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
        </div>

        {/* Recent Channels */}
        {user.channel_breakdown && user.channel_breakdown.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Active in:</p>
            <div className="flex flex-wrap gap-1">
              {user.channel_breakdown.slice(0, 4).map((ch) => (
                <Badge key={ch.channel_id} variant="outline" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {ch.channel_name}
                </Badge>
              ))}
              {user.channel_breakdown.length > 4 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{user.channel_breakdown.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Currently Exploring - Filter out placeholders */}
        {user.interests && user.interests.length > 0 && (
          (() => {
            const validInterests = user.interests.filter(
              interest => !interest.includes('analysis in progress')
            );
            return validInterests.length > 0 ? (
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Interests:</p>
                <div className="flex flex-wrap gap-1">
                  {validInterests.slice(0, 3).map((interest, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null;
          })()
        )}

        {/* AI Summary Preview */}
        {user.ai_persona_summary && (
          <div className="border-l-2 border-border pl-3">
            <p className="text-sm text-muted-foreground italic line-clamp-2">
              {user.ai_persona_summary}
            </p>
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
