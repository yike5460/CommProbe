'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInsights, useInsightDetails } from '@/hooks/useApi';
import { useAppStore } from '@/stores/appStore';
import {
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  Calendar,
  Users,
  Tag,
  FolderOpen,
  Target,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Clock,
  MessageSquare,
  TrendingUp,
  Lightbulb
} from 'lucide-react';

// Constants to avoid recreating objects on each render
const DEFAULT_FILTERS = { priority_min: 5, priority_max: 10, limit: 20 };

export default function InsightsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUserSegment, setSelectedUserSegment] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('priority');
  const [selectedInsight, setSelectedInsight] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isHydrated, setIsHydrated] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // Get store filters only after hydration
  const storeFilters = useAppStore((state) => state.preferences.defaultFilters);

  // Use memoized filters to avoid recreating object on each render
  const defaultFilters = useMemo(() => {
    return isHydrated ? storeFilters : DEFAULT_FILTERS;
  }, [isHydrated, storeFilters]);

  // Set hydrated flag after component mounts (client-side only)
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data: insightsData, isLoading, error } = useInsights({
    priority_min: 5,
    priority_max: 10,
    category: selectedCategory !== 'all' ? selectedCategory as any : undefined,
    user_segment: selectedUserSegment !== 'all' ? selectedUserSegment as any : undefined,
  });

  // Fetch detailed insight data when modal is open
  const { data: insightDetails, isLoading: insightDetailsLoading } = useInsightDetails(
    selectedInsight?.insight_id || '',
    { enabled: !!selectedInsight?.insight_id && isModalOpen }
  );

  // Sort and filter insights
  const allProcessedInsights = useMemo(() => {
    let insights = insightsData?.data || [];

    // Filter by search query
    if (searchQuery) {
      insights = insights.filter(insight =>
        insight.feature_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        insight.feature_category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by priority
    if (selectedPriority !== 'all') {
      insights = insights.filter(insight => {
        const score = insight.priority_score;
        switch (selectedPriority) {
          case 'critical': return score >= 9;
          case 'high': return score >= 7 && score < 9;
          case 'medium': return score >= 5 && score < 7;
          case 'low': return score < 5;
          default: return true;
        }
      });
    }

    // Sort insights
    insights = [...insights].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.priority_score - a.priority_score;
        case 'date':
          return new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime();
        case 'category':
          return a.feature_category.localeCompare(b.feature_category);
        default:
          return 0;
      }
    });

    return insights;
  }, [insightsData?.data, searchQuery, selectedPriority, sortBy]);

  // Calculate pagination
  const totalItems = allProcessedInsights.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageItems = allProcessedInsights.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedUserSegment, selectedPriority, sortBy]);

  const handleViewInsight = (insight: any) => {
    setSelectedInsight(insight);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInsight(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 9) return 'bg-red-500';
    if (score >= 7) return 'bg-orange-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 9) return 'Critical';
    if (score >= 7) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  };

  // These should ideally come from the system configuration API
  // but are hardcoded for now as they represent standard enum values
  // PI-focused categories
  const categories = [
    'medical_records_processing',
    'demand_letter_automation',
    'medical_chronology',
    'settlement_valuation',
    'case_management',
    'document_automation',
    'workflow_management',
    'ai_integration'
  ];

  // PI attorney segments
  const userSegments = [
    'solo_pi_attorney',
    'small_pi_firm',
    'mid_size_pi_firm',
    'large_pi_firm',
    'large_law_firm',
    'mid_size_firm',
    'solo_practitioner'
  ];

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Insights Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Discover and analyze PI law feature requests and medical records automation insights
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <Filter className="mr-2 h-4 w-4" />
            Advanced Filters
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6 bg-gradient-to-r from-background to-muted/20 border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-0 bg-background/50 backdrop-blur-sm focus:bg-background transition-colors h-10"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 bg-background/30 backdrop-blur-sm rounded-lg px-3 border h-10">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto focus:ring-0 min-w-[120px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      <div className="flex items-center gap-2">
                        <Tag className="h-3 w-3" />
                        {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Segment Filter */}
            <div className="flex items-center gap-2 bg-background/30 backdrop-blur-sm rounded-lg px-3 border h-10">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedUserSegment} onValueChange={setSelectedUserSegment}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto focus:ring-0 min-w-[130px]">
                  <SelectValue placeholder="User Segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  {userSegments.map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {segment.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2 bg-background/30 backdrop-blur-sm rounded-lg px-3 border h-10">
              <Target className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto focus:ring-0 min-w-[100px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      Critical (9-10)
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      High (7-8)
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      Medium (5-6)
                    </div>
                  </SelectItem>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                      Low (1-4)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedUserSegment('all');
                setSelectedPriority('all');
                setSortBy('priority');
                setCurrentPage(1);
              }}
              className="bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-colors border h-10 px-4"
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Loading...' :
            totalItems > 0
              ? `Showing ${startIndex + 1}-${Math.min(endIndex, totalItems)} of ${totalItems} insights`
              : 'No insights found'
          }
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Insights Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Failed to load insights. Please try again.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {currentPageItems.map((insight) => (
            <Card key={insight.insight_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge
                    className={`${getPriorityColor(insight.priority_score)} text-white`}
                  >
                    {getPriorityLabel(insight.priority_score)} - {insight.priority_score.toFixed(1)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewInsight(insight)}
                    title="View insight details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg leading-tight">
                  {insight.feature_summary}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    <span className="capitalize">
                      {insight.feature_category.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="capitalize">
                      {insight.user_segment.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(insight.analyzed_at).toLocaleDateString()}
                    </span>
                  </div>

                  {insight.action_required && (
                    <Badge variant="outline" className="text-orange-600">
                      Action Required
                    </Badge>
                  )}

                  {insight.competitors_mentioned.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Competitors: </span>
                      {insight.competitors_mentioned.slice(0, 2).join(', ')}
                      {insight.competitors_mentioned.length > 2 && '...'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {totalItems === 0 && !isLoading && (
            <Card className="col-span-full">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No insights found matching your criteria.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalItems} total insights)
          </div>

          <div className="flex items-center space-x-2">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="flex items-center"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center space-x-1">
              {/* First page */}
              {currentPage > 3 && (
                <>
                  <Button
                    variant={1 === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    className="w-10"
                  >
                    1
                  </Button>
                  {currentPage > 4 && <span className="text-muted-foreground">...</span>}
                </>
              )}

              {/* Pages around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}

              {/* Last page */}
              {currentPage < totalPages - 2 && totalPages > 5 && (
                <>
                  {currentPage < totalPages - 3 && <span className="text-muted-foreground">...</span>}
                  <Button
                    variant={totalPages === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    className="w-10"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="flex items-center"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Insight Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-3">
                <Badge
                  className={`${getPriorityColor((insightDetails?.data.priority_score || selectedInsight?.priority_score) || 0)} text-white`}
                >
                  {getPriorityLabel((insightDetails?.data.priority_score || selectedInsight?.priority_score) || 0)} - {((insightDetails?.data.priority_score || selectedInsight?.priority_score) || 0).toFixed(1)}
                </Badge>
                <span className="text-lg font-semibold">Insight Details</span>
              </span>
            </DialogTitle>
            <DialogDescription>
              Comprehensive analysis and source information
            </DialogDescription>
          </DialogHeader>

          {selectedInsight && (
            <div className="space-y-6 mt-4">
              {insightDetailsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Feature Summary */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <MessageSquare className="mr-2 h-5 w-5" />
                      Feature Summary
                    </h3>
                    <p className="text-foreground leading-relaxed bg-muted/50 p-4 rounded-lg">
                      {insightDetails?.data.feature_summary || selectedInsight.feature_summary}
                    </p>
                  </div>

                  {/* Feature Details */}
                  {insightDetails?.data.feature_details && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <Lightbulb className="mr-2 h-5 w-5" />
                        Feature Details
                      </h3>
                      <p className="text-foreground leading-relaxed bg-muted/50 p-4 rounded-lg">
                        {insightDetails.data.feature_details}
                      </p>
                    </div>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                          <Tag className="mr-2 h-4 w-4" />
                          Category
                        </h4>
                        <Badge variant="outline" className="text-sm">
                          {(insightDetails?.data.feature_category || selectedInsight.feature_category).replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          User Segment
                        </h4>
                        <Badge variant="outline" className="text-sm">
                          {(insightDetails?.data.user_segment || selectedInsight.user_segment).replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Priority Score
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(insightDetails?.data.priority_score || selectedInsight.priority_score)}`}></div>
                          <span className="font-medium">{(insightDetails?.data.priority_score || selectedInsight.priority_score).toFixed(1)} / 10.0</span>
                        </div>
                      </div>

                      {insightDetails?.data.implementation_size && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                            <Target className="mr-2 h-4 w-4" />
                            Implementation Size
                          </h4>
                          <Badge variant="outline" className="text-sm capitalize">
                            {insightDetails.data.implementation_size}
                          </Badge>
                        </div>
                      )}

                      {insightDetails?.data.ai_readiness && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                            <Lightbulb className="mr-2 h-4 w-4" />
                            AI Readiness
                          </h4>
                          <Badge variant="outline" className="text-sm capitalize">
                            {insightDetails.data.ai_readiness}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                          <Clock className="mr-2 h-4 w-4" />
                          Analyzed Date
                        </h4>
                        <p className="text-sm">{new Date(insightDetails?.data.analyzed_at || selectedInsight.analyzed_at).toLocaleString()}</p>
                      </div>

                      {(insightDetails?.data.action_required || selectedInsight.action_required) && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Status
                          </h4>
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Action Required
                          </Badge>
                        </div>
                      )}

                      {insightDetails?.data.post_score && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Post Score
                          </h4>
                          <span className="text-sm font-medium">{insightDetails.data.post_score} points</span>
                        </div>
                      )}

                      {insightDetails?.data.num_comments && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center">
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Comments
                          </h4>
                          <span className="text-sm font-medium">{insightDetails.data.num_comments} comments</span>
                        </div>
                      )}

                      {(insightDetails?.data.competitors_mentioned || selectedInsight.competitors_mentioned)?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2">
                            Competitors Mentioned
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {(insightDetails?.data.competitors_mentioned || selectedInsight.competitors_mentioned).map((competitor: string, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {competitor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Source Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <ExternalLink className="mr-2 h-5 w-5" />
                      Source Information
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Original Source</h4>
                        {insightDetails?.data.post_url ? (
                          <a
                            href={insightDetails.data.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <span className="mr-2">View on Reddit</span>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <div className="inline-flex items-center text-muted-foreground">
                            <span className="mr-2">Reddit URL Loading...</span>
                            <Badge variant="outline" className="text-xs">
                              Loading Details
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Subreddit</h4>
                        <Badge variant="secondary" className="text-sm">
                          r/{insightDetails?.data.subreddit || selectedInsight.subreddit}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Discussion Context</h4>
                        <p className="text-sm text-muted-foreground">
                          Sourced from Reddit legal technology discussions in r/{insightDetails?.data.subreddit || selectedInsight.subreddit}
                        </p>
                      </div>

                      {insightDetails?.data.collected_at && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-2">Collected Date</h4>
                          <p className="text-sm">{new Date(insightDetails.data.collected_at).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Competitive Analysis */}
                  {insightDetails?.data.competitive_advantage && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <Target className="mr-2 h-5 w-5" />
                        Competitive Advantage
                      </h3>
                      <p className="text-foreground leading-relaxed bg-muted/50 p-4 rounded-lg">
                        {insightDetails.data.competitive_advantage}
                      </p>
                    </div>
                  )}

                  {/* Suggested Action */}
                  {insightDetails?.data.suggested_action && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Suggested Action
                      </h3>
                      <p className="text-foreground leading-relaxed bg-muted/50 p-4 rounded-lg">
                        {insightDetails.data.suggested_action}
                      </p>
                    </div>
                  )}

                  {/* Pain Points */}
                  {insightDetails?.data.pain_points && insightDetails.data.pain_points.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Pain Points
                      </h3>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <ul className="space-y-2">
                          {insightDetails.data.pain_points.map((point: string, index: number) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-muted-foreground mt-1">•</span>
                              <span className="text-foreground">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={handleCloseModal}>
                      Close
                    </Button>
                    {insightDetails?.data.post_url ? (
                      <Button
                        onClick={() => window.open(insightDetails.data.post_url, '_blank')}
                        className="flex items-center"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Source
                      </Button>
                    ) : (
                      <Button
                        disabled={insightDetailsLoading}
                        className="flex items-center"
                        title={insightDetailsLoading ? "Loading source URL..." : "Source URL not available"}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {insightDetailsLoading ? 'Loading...' : 'View Source'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}