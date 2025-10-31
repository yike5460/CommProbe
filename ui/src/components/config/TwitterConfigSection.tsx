// components/config/TwitterConfigSection.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Twitter, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TwitterConfigSectionProps {
  config: {
    twitter_enabled: boolean;
    twitter_lookback_days: number;
    twitter_min_engagement: number;
    twitter_api_tier: 'free' | 'basic' | 'pro';
  };
  onChange: (updates: Partial<TwitterConfigSectionProps['config']>) => void;
  isLoading?: boolean;
}

export const TwitterConfigSection: React.FC<TwitterConfigSectionProps> = ({
  config,
  onChange,
  isLoading = false
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Twitter className="h-5 w-5 text-[#1da1f2]" />
            <CardTitle>Twitter (X) Settings</CardTitle>
          </div>
          <Badge variant={config.twitter_enabled ? "default" : "secondary"}>
            {config.twitter_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <CardDescription>
          Configure Twitter data collection and search parameters
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Twitter Collection</Label>
            <p className="text-sm text-neutral-500">
              Collect insights from Twitter/X platform
            </p>
          </div>
          <Switch
            checked={config.twitter_enabled}
            onCheckedChange={(checked) => onChange({ twitter_enabled: checked })}
            disabled={isLoading}
          />
        </div>

        {/* API Tier Indicator */}
        {config.twitter_enabled && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Current API Tier: <strong>{config.twitter_api_tier}</strong>
              {config.twitter_api_tier === 'basic' && ' ($200/month, 15,000 posts)'}
            </AlertDescription>
          </Alert>
        )}

        {/* Lookback Days */}
        <div className="space-y-2">
          <Label htmlFor="twitter-lookback">Lookback Days</Label>
          <Input
            id="twitter-lookback"
            type="number"
            min={1}
            max={14}
            value={config.twitter_lookback_days}
            onChange={(e) => onChange({ twitter_lookback_days: parseInt(e.target.value) })}
            disabled={!config.twitter_enabled || isLoading}
          />
          <p className="text-xs text-neutral-500">
            Number of days to look back for Twitter data (1-14 days)
          </p>
        </div>

        {/* Minimum Engagement */}
        <div className="space-y-2">
          <Label htmlFor="twitter-engagement">Minimum Engagement</Label>
          <Input
            id="twitter-engagement"
            type="number"
            min={0}
            max={100}
            value={config.twitter_min_engagement}
            onChange={(e) => onChange({ twitter_min_engagement: parseInt(e.target.value) })}
            disabled={!config.twitter_enabled || isLoading}
          />
          <p className="text-xs text-neutral-500">
            Minimum total likes + retweets to collect tweet (default: 5)
          </p>
        </div>

        {/* API Tier Display */}
        <div className="space-y-2">
          <Label>API Tier</Label>
          <Select
            value={config.twitter_api_tier}
            onValueChange={(value) => onChange({ twitter_api_tier: value as any })}
            disabled={!config.twitter_enabled || isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free (100 posts/month)</SelectItem>
              <SelectItem value="basic">Basic ($200/month, 15K posts)</SelectItem>
              <SelectItem value="pro">Pro ($5K/month, 1M posts)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
