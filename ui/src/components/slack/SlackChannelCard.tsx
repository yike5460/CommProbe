/**
 * SlackChannelCard Component
 * Displays a Slack channel summary card
 */

'use client';

import { SlackChannelSummary } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hash, Lock, Lightbulb, Target } from 'lucide-react';
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

  const getSentimentBadgeVariant = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'default'; // green/success color
      case 'neutral':
        return 'secondary';
      case 'negative':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600';
      case 'neutral':
        return 'text-gray-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Hash className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-lg truncate">{channel.channel_name}</h3>
            {channel.is_private && (
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <Badge variant={getSentimentBadgeVariant(channel.sentiment)}>
            {channel.sentiment}
          </Badge>
        </div>
        {channel.channel_purpose && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {channel.channel_purpose}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Metrics */}
        <div className="flex justify-around text-center">
          <div>
            <p className="text-xl font-bold">{channel.num_members}</p>
            <p className="text-xs text-muted-foreground">Members</p>
          </div>
          <div>
            <p className="text-xl font-bold">{channel.messages_analyzed}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
          <div>
            <p className="text-xl font-bold">{channel.key_topics?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Topics</p>
          </div>
        </div>

        {/* Key Topics */}
        {channel.key_topics && channel.key_topics.length > 0 && (
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Key Topics</p>
            <div className="flex flex-wrap gap-1">
              {channel.key_topics.slice(0, 4).map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
              {channel.key_topics.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{channel.key_topics.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Feature Requests Count */}
        {channel.feature_requests && channel.feature_requests.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-2 rounded">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>{channel.feature_requests.length} feature request(s) identified</span>
          </div>
        )}

        {/* Product Opportunities Count */}
        {channel.product_opportunities && channel.product_opportunities.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
            <Target className="h-4 w-4 flex-shrink-0" />
            <span>{channel.product_opportunities.length} product opportunity(ies)</span>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full mt-auto"
          onClick={handleClick}
        >
          View Full Analysis
        </Button>
      </CardContent>
    </Card>
  );
}
