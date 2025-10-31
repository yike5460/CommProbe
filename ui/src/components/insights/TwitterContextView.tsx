// components/insights/TwitterContextView.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Heart, Repeat2, MessageCircle, Quote } from 'lucide-react';

interface TwitterContextViewProps {
  tweetId: string;
  authorUsername: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  engagementScore: number;
  tweetUrl: string;
  language?: string;
}

export const TwitterContextView: React.FC<TwitterContextViewProps> = ({
  tweetId,
  authorUsername,
  likes,
  retweets,
  replies,
  quotes,
  engagementScore,
  tweetUrl,
  language = 'en'
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Twitter Context</CardTitle>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            View on Twitter
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Author Info */}
        <div>
          <p className="text-sm text-neutral-600">Posted by</p>
          <a
            href={`https://twitter.com/${authorUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-medium text-blue-600 hover:underline"
          >
            @{authorUsername}
          </a>
        </div>

        {/* Engagement Metrics */}
        <div>
          <p className="text-sm text-neutral-600 mb-2">Engagement Metrics</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <span className="text-sm">{likes.toLocaleString()} likes</span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{retweets.toLocaleString()} retweets</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{replies.toLocaleString()} replies</span>
            </div>
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4 text-purple-500" />
              <span className="text-sm">{quotes.toLocaleString()} quotes</span>
            </div>
          </div>
        </div>

        {/* Total Engagement Score */}
        <div>
          <p className="text-sm text-neutral-600">Total Engagement</p>
          <p className="text-2xl font-bold text-blue-600">{engagementScore.toLocaleString()}</p>
        </div>

        {/* Metadata */}
        <div className="flex gap-2">
          <Badge variant="outline">Tweet ID: {tweetId}</Badge>
          {language && <Badge variant="outline">{language.toUpperCase()}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
};
