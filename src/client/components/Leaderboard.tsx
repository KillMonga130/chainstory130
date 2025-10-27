import { useEffect, useState } from 'react';
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/types/api';
import { LeaderboardSkeleton } from './LoadingStates';
import { NetworkError } from './ErrorStates';
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

export const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const networkStatus = useNetworkStatus();

  const loadLeaderboard = async (useCache = true, isRetry = false) => {
    const cacheKey = 'leaderboard-top-10';
    
    // Try cache first if enabled and not a retry
    if (useCache && !isRetry) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setLeaderboard(cachedData);
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

      const data = await apiRequest<LeaderboardResponse>(
        '/api/leaderboard/top-10',
        {
          headers: useCache ? {} : { 'Cache-Control': 'no-cache' }
        },
        {
          maxRetries: isRetry ? 0 : 2, // Don't retry on manual retry
          baseDelay: 1000,
          maxDelay: 5000
        }
      );
      
      if (data.type !== 'leaderboard') {
        throw new Error('Invalid response format') as ApiError;
      }
      
      // Cache for 30 seconds (leaderboard doesn't change frequently)
      setCachedData(cacheKey, data.stories, 30000);
      
      setLeaderboard(data.stories);
      setRetryCount(0);
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to load leaderboard', apiError);
      setError(apiError);
      setRetryCount(isRetry ? retryCount : retryCount + 1);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const toggleStoryExpansion = (storyId: string) => {
    setExpandedStory(expandedStory === storyId ? null : storyId);
  };

  const retryLoadLeaderboard = () => {
    loadLeaderboard(false, true);
  };

  if (loading && leaderboard.length === 0) {
    return <LeaderboardSkeleton />;
  }

  if (error && leaderboard.length === 0) {
    return (
      <NetworkError
        onRetry={retryLoadLeaderboard}
        retrying={isRetrying}
        retryCount={retryCount}
        maxRetries={3}
      />
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📚</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Completed Stories Yet</h3>
        <p className="text-gray-600">
          The leaderboard will show the top 10 completed stories once the community finishes some stories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Top Stories</h2>
        <button
          onClick={() => loadLeaderboard(false)}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Mobile-first responsive design */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Mobile card layout for small screens */}
        <div className="block sm:hidden">
          <div className="divide-y divide-gray-200">
            {leaderboard.map((entry) => (
              <div key={entry.storyId} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-xl font-bold text-gray-900 mr-3">
                      {getRankIcon(entry.rank)}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">
                        {entry.preview}...
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        by u/{entry.creator}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center">
                      <span className="font-bold text-green-600">{entry.totalVotes}</span>
                      <span className="ml-1">votes</span>
                    </span>
                    <span>{entry.sentenceCount} sentences</span>
                    <span>{formatDate(entry.completedAt)}</span>
                  </div>
                  <button
                    onClick={() => toggleStoryExpansion(entry.storyId)}
                    className="touch-button text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1"
                  >
                    {expandedStory === entry.storyId ? 'Hide' : 'View'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop table layout for larger screens */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Story
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Votes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((entry) => (
                <tr key={entry.storyId} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-900">
                        {getRankIcon(entry.rank)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-xs">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {entry.preview}...
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.sentenceCount} sentences
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      u/{entry.creator}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-bold text-green-600">
                        {entry.totalVotes}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">votes</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(entry.completedAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleStoryExpansion(entry.storyId)}
                      className="touch-button text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {expandedStory === entry.storyId ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Story Preview */}
      {expandedStory && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Story Preview</h3>
            <button
              onClick={() => setExpandedStory(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-gray-800 leading-relaxed">
              {leaderboard.find(entry => entry.storyId === expandedStory)?.preview}...
            </p>
            <p className="text-sm text-gray-500 mt-2 italic">
              Note: This is a preview. Full story viewing will be available in the Archive section.
            </p>
          </div>
        </div>
      )}

      <div className="text-center text-sm text-gray-500">
        <p>Leaderboard updates automatically when new stories are completed.</p>
        <p>Rankings are based on total community votes received.</p>
      </div>
    </div>
  );
};
