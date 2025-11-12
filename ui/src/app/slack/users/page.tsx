/**
 * Slack Users List Page
 * Displays all analyzed Slack users with filtering capabilities
 */

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout';
import { SlackUserCard, AnalysisTrigger, AnalysisJobStatus } from '@/components/slack';
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
import { useFilteredSlackUsers } from '@/hooks/useSlackApi';
import { Users, Search, Filter, Loader2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function SlackUsersPage() {
  const [workspaceId, setWorkspaceId] = useState('default');
  const [influenceLevel, setInfluenceLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useFilteredSlackUsers(workspaceId, {
    influenceLevel,
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
              // Refresh users list
              queryClient.invalidateQueries({ queryKey: ['slack', 'users'] });
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
            <Users className="h-8 w-8" />
            Team Member Profiles
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze individual team member interests, expertise, and engagement patterns
          </p>
        </div>

        <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Analyze New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Analyze Team Member</DialogTitle>
            </DialogHeader>
            <AnalysisTrigger
              type="user"
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

            {/* Influence Level Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Influence Level</label>
              <Select
                value={influenceLevel}
                onValueChange={(value: any) => setInfluenceLevel(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="high">High Influence</SelectItem>
                  <SelectItem value="medium">Medium Influence</SelectItem>
                  <SelectItem value="low">Low Influence</SelectItem>
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
                  placeholder="Search by name or email..."
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
              <span className="text-destructive">Error loading users</span>
            ) : (
              <span>
                Showing {data?.count || 0} user{data?.count !== 1 ? 's' : ''}
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
            <p className="text-destructive mb-2">Failed to load user profiles</p>
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
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Users Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || influenceLevel !== 'all'
                ? 'Try adjusting your filters to see more results'
                : 'Start by analyzing a team member to see their profile here'}
            </p>
            <Button onClick={() => setShowAnalysisDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Analyze First User
            </Button>
          </div>
        </Card>
      )}

      {/* User Cards Grid */}
      {!isLoading && !error && data && data.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.users.map((user) => (
            <SlackUserCard key={user.user_id} user={user} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
