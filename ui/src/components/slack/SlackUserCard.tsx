/**
 * SlackUserCard Component
 * Displays a Slack user profile summary card
 */

'use client';

import { SlackUserProfile } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, TrendingUp, Hash } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

  const getInfluenceBadgeVariant = (level: string) => {
    switch (level) {
      case 'high':
        return 'default'; // primary color
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* Avatar Placeholder */}
          <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
            <span className="text-lg font-semibold text-purple-700">
              {user.user_name[0]?.toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {user.display_name || user.user_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{user.user_email}</p>
          </div>

          <Badge variant={getInfluenceBadgeVariant(user.influence_level)}>
            {user.influence_level}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Activity Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{user.total_channels}</p>
            <p className="text-xs text-muted-foreground">Channels</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{user.total_messages}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{user.total_activity}</p>
            <p className="text-xs text-muted-foreground">Activity</p>
          </div>
        </div>

        {/* Top Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Top Interests</p>
            <div className="flex flex-wrap gap-1">
              {user.interests.slice(0, 3).map((interest, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {interest}
                </Badge>
              ))}
              {user.interests.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{user.interests.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Communication Style */}
        {user.communication_style && (
          <div>
            <p className="text-sm font-medium mb-1">Communication Style</p>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {user.communication_style}
            </p>
          </div>
        )}

        {/* View Details Button */}
        <Button
          variant="outline"
          className="w-full mt-auto"
          onClick={handleClick}
        >
          View Full Profile
        </Button>
      </CardContent>
    </Card>
  );
}
