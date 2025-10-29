import { useState, useCallback } from 'react';
import { VoteCount, UserVoteStatus } from '../../shared/types/voting';
import {
  CastVoteRequest,
  CastVoteResponse,
  GetVoteCountsResponse,
  GetVoteStatusResponse,
} from '../../shared/types/api';
import { ApiClient, ClientPerformanceMonitor, ErrorReporting } from '../utils/error-handler';
import { useLoading } from '../contexts/LoadingContext';

interface UseVotingReturn {
  voteCounts: VoteCount[];
  userVoteStatus: UserVoteStatus;
  loading: boolean;
  error: string | null;
  castVote: (chapterId: string, choiceId: string) => Promise<void>;
  refreshVoteCounts: (chapterId: string) => Promise<void>;
  refreshVoteStatus: (chapterId: string) => Promise<void>;
}

export const useVoting = (): UseVotingReturn => {
  const [voteCounts, setVoteCounts] = useState<VoteCount[]>([]);
  const [userVoteStatus, setUserVoteStatus] = useState<UserVoteStatus>({ hasVoted: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startLoading, stopLoading, updateLoading } = useLoading();

  const castVote = useCallback(
    async (chapterId: string, choiceId: string) => {
      const loadingId = `cast-vote-${chapterId}-${choiceId}`;

      try {
        startLoading(loadingId, 'Casting your vote...', {
          type: 'processing',
          timeout: 10000, // 10 second timeout
        });

        setLoading(true);
        setError(null);

        const requestBody: CastVoteRequest = {
          chapterId,
          choiceId,
        };

        const data: CastVoteResponse = await ApiClient.post('/api/vote', requestBody, {
          timeout: 8000, // 8 second timeout
          retries: 2,
          retryCondition: (error, attempt) => {
            // Don't retry on validation errors (400s) or duplicate votes
            if (error.message.includes('already voted') || error.message.includes('validation')) {
              return false;
            }
            return attempt < 2;
          },
        });

        if (data.success) {
          // Update user vote status
          setUserVoteStatus({
            hasVoted: true,
            choiceId,
            timestamp: new Date(),
          });

          updateLoading(loadingId, {
            type: 'success',
            message: 'Vote cast successfully!',
          });

          // Refresh vote counts and status immediately after voting
          setTimeout(() => {
            refreshVoteCounts(chapterId);
            refreshVoteStatus(chapterId);
          }, 500);

          // Auto-hide success message
          setTimeout(() => stopLoading(loadingId), 2000);
        } else {
          throw new Error(data.error || 'Vote was not successful');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);

        // Report error for monitoring
        ErrorReporting.reportError(err as Error, {
          operation: 'castVote',
          chapterId,
          choiceId,
          url: '/api/vote',
        });

        updateLoading(loadingId, {
          type: 'error',
          message: `Failed to cast vote: ${errorMessage}`,
        });

        // Auto-hide error after 5 seconds
        setTimeout(() => stopLoading(loadingId), 5000);

        ClientPerformanceMonitor.recordMetric('vote_cast_error', 0, true);
        throw err; // Re-throw so the component can handle it
      } finally {
        setLoading(false);
      }
    },
    [startLoading, stopLoading, updateLoading]
  );

  const refreshVoteCounts = useCallback(async (chapterId: string) => {
    try {
      console.log('Fetching vote counts for chapter:', chapterId);
      const data: GetVoteCountsResponse = await ApiClient.get(`/api/vote/counts/${chapterId}`, {
        timeout: 5000, // 5 second timeout
        retries: 1,
      });

      if (data.success && data.data) {
        console.log('Vote counts updated:', data.data);
        setVoteCounts(data.data);
      } else {
        console.warn('Vote counts request failed:', data);
      }
    } catch (err) {
      console.error('Error refreshing vote counts:', err);
      // Don't set error state for this as it's not critical
      // But still report for monitoring
      ErrorReporting.reportError(err as Error, {
        operation: 'refreshVoteCounts',
        chapterId,
        url: `/api/vote/counts/${chapterId}`,
      });

      ClientPerformanceMonitor.recordMetric('vote_counts_refresh_error', 0, true);
    }
  }, []);

  const refreshVoteStatus = useCallback(async (chapterId: string) => {
    try {
      const data: GetVoteStatusResponse = await ApiClient.get(`/api/vote/status/${chapterId}`, {
        timeout: 5000, // 5 second timeout
        retries: 1,
      });

      if (data.success && data.data) {
        setUserVoteStatus(data.data);
      }
    } catch (err) {
      // Don't set error state for this as it's not critical
      // But still report for monitoring
      ErrorReporting.reportError(err as Error, {
        operation: 'refreshVoteStatus',
        chapterId,
        url: `/api/vote/status/${chapterId}`,
      });

      ClientPerformanceMonitor.recordMetric('vote_status_refresh_error', 0, true);
    }
  }, []);

  return {
    voteCounts,
    userVoteStatus,
    loading,
    error,
    castVote,
    refreshVoteCounts,
    refreshVoteStatus,
  };
};
