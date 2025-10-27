import { useEffect, useState } from 'react';
import type { Story, ArchiveResponse } from '../../shared/types/api';
import { ArchiveSkeleton } from './LoadingStates';
import { NetworkError } from './ErrorStates';
import { ShareButton } from './ShareStory';
import { apiRequest, ApiError } from '../utils/api';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

const getCachedData = (key: string): any | null => {
  const cached = apiCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    apiCache.delete(key);
    return null;
  }
  
  return cached.data;
};

const setCachedData = (key: string, data: any, ttl: number = 5000) => {
  apiCache.set(key, { data, timestamp: Date.now(), ttl });
};

type SortOption = 'date' | 'votes';

export const Archive = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const networkStatus = useNetworkStatus();

  const loadArchive = async (page: number = currentPage, sort: SortOption = sortBy, useCache = true, isRetry = false) => {
    const cacheKey = `archive-${page}-${sort}`;
    
    // Try cache first if enabled and not a retry
    if (useCache && !isRetry) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setStories(cachedData.stories);
        setTotalPages(cachedData.totalPages);
        setCurrentPage(cachedData.currentPage);
        setLoading(false);
        setError(null);
        return;
      }
    }

    // Check network status
    if (!networkStatus.isOnline) {
      const networkError = new Error('No internet connection') as ApiError;
      networkError.code = 'NETWORK_OFFLINE';
      networkError.retryable = true;
      setError(networkError);
      setLoading(false);
      setIsRetrying(false);
      return;
    }

    try {
      setLoading(!isRetry); // Don't show loading on retry
      setIsRetrying(isRetry);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        sort,
        limit: '10',
      });

      const data = await apiRequest<ArchiveResponse>(
        `/api/archive/stories?${params}`,
        {
          headers: useCache ? {} : { 'Cache-Control': 'no-cache' }
        },
        {
          maxRetries: isRetry ? 0 : 2, // Don't retry on manual retry
          baseDelay: 1000,
          maxDelay: 5000
        }
      );
      
      if (data.type !== 'archive') {
        throw new Error('Invalid response format') as ApiError;
      }
      
      // Cache for 60 seconds (archive doesn't change frequently)
      setCachedData(cacheKey, {
        stories: data.stories,
        totalPages: data.totalPages,
        currentPage: data.currentPage
      }, 60000);
      
      setStories(data.stories);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
      setRetryCount(0);
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to load archive', apiError);
      setError(apiError);
      setRetryCount(isRetry ? retryCount : retryCount + 1);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadArchive(1, sortBy);
  }, [sortBy]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      loadArchive(newPage, sortBy);
    }
  };

  const retryLoadArchive = () => {
    loadArchive(currentPage, sortBy, false, true);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleStoryExpansion = (storyId: string) => {
    setExpandedStory(expandedStory === storyId ? null : storyId);
  };

  const getStoryPreview = (sentences: string[]) => {
    const firstSentences = sentences.slice(0, 3).join(' ');
    return firstSentences.length > 150 
      ? firstSentences.substring(0, 150) + '...'
      : firstSentences + (sentences.length > 3 ? '...' : '');
  };

  if (loading && stories.length === 0) {
    return <ArchiveSkeleton />;
  }

  if (error && stories.length === 0) {
    return (
      <NetworkError
        onRetry={retryLoadArchive}
        retrying={isRetrying}
        retryCount={retryCount}
        maxRetries={3}
      />
    );
  }

  if (stories.length === 0 && !loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📖</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Archived Stories Yet</h3>
        <p className="text-gray-600">
          Completed stories will appear here once the community finishes some 100-sentence stories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sorting controls - Mobile optimized */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Story Archive</h2>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 flex-shrink-0">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="mobile-input flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Completion Date</option>
              <option value="votes">Popularity</option>
            </select>
          </div>
          
          <button
            onClick={() => loadArchive(currentPage, sortBy, false)}
            disabled={loading}
            className="touch-button text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stories grid - Mobile optimized */}
      <div className="grid gap-4 sm:gap-6">
        {stories.map((story) => (
          <div key={story.id} className="mobile-card bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                  <span className="text-xs sm:text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded w-fit">
                    Completed
                  </span>
                  <span className="text-xs sm:text-sm text-gray-500">
                    {story.completedAt && formatDate(story.completedAt)}
                  </span>
                </div>
                
                <div className="mb-3">
                  <p className="text-gray-800 leading-relaxed text-sm sm:text-base">
                    {getStoryPreview(story.sentences)}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center">
                    <span className="font-medium">{story.sentences.length}</span>
                    <span className="ml-1">sentences</span>
                  </span>
                  <span className="flex items-center">
                    <span className="font-medium text-green-600">{story.totalVotes}</span>
                    <span className="ml-1">votes</span>
                  </span>
                  <span className="flex items-center">
                    <span className="font-medium">{story.contributors.length}</span>
                    <span className="ml-1">contributors</span>
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleStoryExpansion(story.id)}
                  className="touch-button bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-medium"
                >
                  {expandedStory === story.id ? 'Hide Full Story' : 'Read Full Story'}
                </button>
                <ShareButton story={story} size="sm" />
              </div>
            </div>
            
            {/* Expanded full story */}
            {expandedStory === story.id && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Complete Story</h4>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 max-h-64 sm:max-h-96 overflow-y-auto mobile-scroll">
                  <div className="space-y-2">
                    {story.sentences.map((sentence, index) => (
                      <p key={index} className="text-gray-800 leading-relaxed text-sm sm:text-base">
                        <span className="font-medium text-gray-600 mr-2 text-xs sm:text-sm">[{index + 1}]</span>
                        {sentence}
                      </p>
                    ))}
                  </div>
                </div>
                
                <div className="mt-3 sm:mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong>Story Statistics:</strong> This story was completed with {story.sentences.length} sentences, 
                    received {story.totalVotes} total votes, and had {story.contributors.length} unique contributors.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination - Mobile optimized */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 sm:gap-2 px-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="touch-button px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">‹</span>
          </button>
          
          <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`touch-button flex-shrink-0 px-3 py-2 text-sm border rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="touch-button px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">›</span>
          </button>
        </div>
      )}

      {/* Archive info */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Showing page {currentPage} of {totalPages} 
          {stories.length > 0 && ` (${stories.length} stories on this page)`}
        </p>
        <p className="mt-1">
          Stories are sorted by {sortBy === 'date' ? 'completion date' : 'total votes'} 
          in descending order.
        </p>
      </div>
    </div>
  );
};
