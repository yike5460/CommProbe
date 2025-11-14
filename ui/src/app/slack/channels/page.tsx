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
import { Hash, Search, Plus, Loader2, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function SlackChannelsPage() {
  const [workspaceId, setWorkspaceId] = useState('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityVolume, setActivityVolume] = useState<'all' | 'very-active' | 'active' | 'moderate' | 'quiet'>('all');
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useFilteredSlackChannels(workspaceId, {
    searchQuery,
    activityVolume,
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

      {/* Filters - Compact Design */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* Workspace Filter - Compact */}
            <div className="min-w-[180px]">
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Workspace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Activity Volume Filter - Compact */}
            <div className="min-w-[220px]">
              <Select
                value={activityVolume}
                onValueChange={(value: any) => setActivityVolume(value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Activity Volume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activity Volumes</SelectItem>
                  <SelectItem value="very-active">Very Active (100+)</SelectItem>
                  <SelectItem value="active">Active (50-99)</SelectItem>
                  <SelectItem value="moderate">Moderate (10-49)</SelectItem>
                  <SelectItem value="quiet">Quiet (&lt; 10)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Search - Compact and Flex Grow */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
          </div>

          {/* Results Count - Compact */}
          <div className="mt-3 text-xs text-muted-foreground pl-7">
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
              {searchQuery
                ? 'Try adjusting your search to see more results'
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
