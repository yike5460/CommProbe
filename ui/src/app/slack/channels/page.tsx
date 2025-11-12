/**
 * Slack Channels List Page
 * Displays all analyzed Slack channels with filtering capabilities
 */

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout';
import { SlackChannelCard, AnalysisTrigger, AnalysisJobStatus } from '@/components/slack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useFilteredSlackChannels } from '@/hooks/useSlackApi';
import { Hash, Search, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function SlackChannelsPage() {
  const [workspaceId, setWorkspaceId] = useState('default');
  const [sentiment, setSentiment] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useFilteredSlackChannels(workspaceId, {
    sentiment,
    searchQuery,
  });

  return (
    <AppLayout>
      {/* Active Job Status Indicator */}
      {activeJobId && (
        <div className="mb-6">
          <AnalysisJobStatus
            jobId={activeJobId}
            onComplete={() => {
              // Refresh channels list
              queryClient.invalidateQueries({ queryKey: ['slack', 'channels'] });
              // Clear active job
              setActiveJobId(null);
            }}
            onError={(error) => {
              // Clear active job on error
              setActiveJobId(null);
            }}
          />
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Hash className="h-8 w-8" />
            Channel Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover product feedback, feature requests, and strategic insights from team channels
          </p>
        </div>

        <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Analyze New Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Analyze Channel</DialogTitle>
            </DialogHeader>
            <AnalysisTrigger
              type="channel"
              compact
              onSuccess={(response) => {
                // Capture job_id from response
                if (response.job_id) {
                  setActiveJobId(response.job_id);
                }
                setShowAnalysisDialog(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Workspace Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Workspace</label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Workspace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sentiment Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Sentiment</label>
              <Select
                value={sentiment}
                onValueChange={(value: any) => setSentiment(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sentiments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-muted-foreground">
            {isLoading ? (
              <span>Loading...</span>
            ) : error ? (
              <span className="text-destructive">Error loading channels</span>
            ) : (
              <span>
                Showing {data?.count || 0} channel{data?.count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="p-6">
          <div className="text-center">
            <p className="text-destructive mb-2">Failed to load channel summaries</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && data && data.count === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Channels Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || sentiment !== 'all'
                ? 'Try adjusting your filters to see more results'
                : 'Start by analyzing a channel to see its insights here'}
            </p>
            <Button onClick={() => setShowAnalysisDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Analyze First Channel
            </Button>
          </div>
        </Card>
      )}

      {/* Channel Cards Grid */}
      {!isLoading && !error && data && data.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.channels.map((channel) => (
            <SlackChannelCard key={channel.channel_id} channel={channel} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
