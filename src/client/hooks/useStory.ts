import { useState, useEffect, useCallback } from 'react';
import { StoryChapter, StoryContext, StoryProgression } from '../../shared/types/story';
import { GetCurrentStoryResponse } from '../../shared/types/api';
import { ApiClient, ClientPerformanceMonitor, ErrorReporting } from '../utils/error-handler';
import { useLoading } from '../contexts/LoadingContext';

interface UseStoryReturn {
  currentChapter: StoryChapter | null;
  context: StoryContext | null;
  progression: StoryProgression | null;
  votingActive: boolean;
  loading: boolean;
  error: string | null;
  refreshStory: () => Promise<void>;
}

export const useStory = (): UseStoryReturn => {
  const [currentChapter, setCurrentChapter] = useState<StoryChapter | null>(null);
  const [context, setContext] = useState<StoryContext | null>(null);
  const [progression, setProgression] = useState<StoryProgression | null>(null);
  const [votingActive, setVotingActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startLoading, stopLoading, updateLoading } = useLoading();

  const fetchCurrentStory = useCallback(async () => {
    const loadingId = 'fetch-story';

    try {
      startLoading(loadingId, 'Loading story chapter...', {
        type: 'loading',
        timeout: 15000, // 15 second timeout
      });

      setError(null);

      const data: GetCurrentStoryResponse = await ApiClient.get('/api/story/current', {
        timeout: 10000, // 10 second timeout
        retries: 2,
      });

      if (data.success && data.data) {
        console.log('📖 Story data received from server:', {
          chapterId: data.data.chapter?.id,
          chapterTitle: data.data.chapter?.title,
          votingActive: data.data.votingActive,
          context: data.data.context,
        });

        setCurrentChapter(data.data.chapter);
        setContext(data.data.context);
        setVotingActive(data.data.votingActive);

        // Calculate progression
        const progression: StoryProgression = {
          totalChapters: 10, // This should come from the server
          currentPosition: data.data.context.pathTaken.length,
          completedPaths: data.data.context.pathTaken,
          availablePaths: [], // This should be calculated based on current choices
          progressPercentage: Math.round((data.data.context.pathTaken.length / 10) * 100),
        };
        setProgression(progression);

        updateLoading(loadingId, {
          type: 'success',
          message: 'Story loaded successfully',
        });

        // Auto-hide success message
        setTimeout(() => stopLoading(loadingId), 1000);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);

      // Report error for monitoring
      ErrorReporting.reportError(err as Error, {
        operation: 'fetchCurrentStory',
        url: '/api/story/current',
      });

      updateLoading(loadingId, {
        type: 'error',
        message: `Failed to load story: ${errorMessage}`,
      });

      // Auto-hide error after 5 seconds
      setTimeout(() => stopLoading(loadingId), 5000);

      ClientPerformanceMonitor.recordMetric('story_fetch_error', 0, true);
    } finally {
      setLoading(false);
    }
  }, [startLoading, stopLoading, updateLoading]);

  const refreshStory = useCallback(async () => {
    await fetchCurrentStory();
  }, [fetchCurrentStory]);

  useEffect(() => {
    fetchCurrentStory();
  }, [fetchCurrentStory]);

  return {
    currentChapter,
    context,
    progression,
    votingActive,
    loading,
    error,
    refreshStory,
  };
};
