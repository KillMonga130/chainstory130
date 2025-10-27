import { useCallback, useEffect, useState, useRef } from 'react';
import type { 
  CurrentStoryResponse, 
  SubmitSentenceRequest, 
  SubmitSentenceResponse,
  Story 
} from '../../shared/types/api';
import { apiRequest, createAbortController, ApiError, createApiError } from '../utils/api';
import { useNetworkStatus } from './useNetworkStatus';

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

interface StoryState {
  loading: boolean;
  story: Story | null;
  roundTimeRemaining: number;
  username: string | null;
  submitting: boolean;
  lastSubmissionMessage: string | null;
  error: ApiError | null;
  retryCount: number;
  isRetrying: boolean;
}

export const useStory = () => {
  const [state, setState] = useState<StoryState>({
    loading: true,
    story: null,
    roundTimeRemaining: 0,
    username: null,
    submitting: false,
    lastSubmissionMessage: null,
    error: null,
    retryCount: 0,
    isRetrying: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const networkStatus = useNetworkStatus();

  const loadCurrentStory = useCallback(async (useCache = true, isRetry = false) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cacheKey = 'current-story';
    
    // Try cache first if enabled and not a retry
    if (useCache && !isRetry) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setState((prev) => ({ 
          ...prev, 
          story: cachedData.story, 
          roundTimeRemaining: cachedData.roundTimeRemaining,
          loading: false,
          error: null
        }));
        return;
      }
    }

    // Check network status before making request
    if (!networkStatus.isOnline) {
      const error = createApiError(
        'No internet connection. Please check your network and try again.',
        undefined,
        'NETWORK_OFFLINE',
        true
      );
      setState((prev) => ({ 
        ...prev, 
        loading: false, 
        error,
        isRetrying: false
      }));
      return;
    }

    try {
      setState((prev) => ({ 
        ...prev, 
        loading: !isRetry, // Don't show loading on retry
        isRetrying: isRetry,
        error: null 
      }));
      
      abortControllerRef.current = createAbortController(10000); // 10 second timeout
      
      const data = await apiRequest<CurrentStoryResponse>(
        '/api/story/current',
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Cache-Control': useCache ? 'max-age=5' : 'no-cache',
          }
        },
        {
          maxRetries: isRetry ? 0 : 2, // Don't retry on manual retry
          baseDelay: 1000,
          maxDelay: 5000
        }
      );

      if (data.type !== 'current-story') {
        throw createApiError('Invalid response format', undefined, 'INVALID_RESPONSE');
      }
      
      // Cache the response for 5 seconds
      setCachedData(cacheKey, { 
        story: data.story, 
        roundTimeRemaining: data.roundTimeRemaining 
      }, 5000);
      
      setState((prev) => ({ 
        ...prev, 
        story: data.story, 
        roundTimeRemaining: data.roundTimeRemaining,
        loading: false,
        error: null,
        retryCount: 0,
        isRetrying: false
      }));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      
      const apiError = err as ApiError;
      console.error('Failed to load current story', apiError);
      
      setState((prev) => ({ 
        ...prev, 
        loading: false,
        error: apiError,
        retryCount: isRetry ? prev.retryCount : prev.retryCount + 1,
        isRetrying: false
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, [networkStatus.isOnline]);

  useEffect(() => {
    loadCurrentStory();
  }, [loadCurrentStory]);

  const submitSentence = useCallback(
    async (sentence: string) => {
      if (!state.story) {
        const errorMessage = 'No active story found. Please refresh the page and try again.';
        setState((prev) => ({ 
          ...prev, 
          lastSubmissionMessage: errorMessage 
        }));
        return { success: false, message: errorMessage };
      }

      // Validate sentence length
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length < 10 || trimmedSentence.length > 150) {
        const errorMessage = 'Sentence must be between 10 and 150 characters long.';
        setState((prev) => ({ 
          ...prev, 
          lastSubmissionMessage: errorMessage 
        }));
        return { success: false, message: errorMessage };
      }

      // Check network status
      if (!networkStatus.isOnline) {
        const errorMessage = 'No internet connection. Please check your network and try again.';
        setState((prev) => ({ 
          ...prev, 
          lastSubmissionMessage: errorMessage 
        }));
        return { success: false, message: errorMessage };
      }

      try {
        setState((prev) => ({ ...prev, submitting: true, lastSubmissionMessage: null }));

        const requestBody: SubmitSentenceRequest = {
          storyId: state.story.id,
          roundNumber: state.story.roundNumber,
          sentence: trimmedSentence,
        };

        const data = await apiRequest<SubmitSentenceResponse>(
          '/api/submit-sentence',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          },
          {
            maxRetries: 1, // Only retry once for submissions
            baseDelay: 2000,
            retryCondition: (error) => {
              const apiError = error as ApiError;
              // Don't retry on client errors (4xx), only server errors
              return !apiError.status || apiError.status >= 500;
            }
          }
        );

        setState((prev) => ({ 
          ...prev, 
          submitting: false,
          lastSubmissionMessage: data.message 
        }));

        // Refresh story after successful submission
        if (data.success) {
          setTimeout(() => loadCurrentStory(false), 1000);
        }

        return { success: data.success, message: data.message };
      } catch (err) {
        const apiError = err as ApiError;
        console.error('Failed to submit sentence', apiError);
        
        let errorMessage = 'Failed to submit sentence. Please try again.';
        
        // Provide specific error messages based on error type
        if (apiError.status === 429) {
          errorMessage = 'You are submitting too quickly. Please wait a moment and try again.';
        } else if (apiError.status === 400) {
          errorMessage = 'Invalid sentence format. Please check your input and try again.';
        } else if (apiError.status === 409) {
          errorMessage = 'This round has already ended. Please refresh and try again.';
        } else if (apiError.code === 'NETWORK_OFFLINE') {
          errorMessage = 'No internet connection. Please check your network and try again.';
        } else if (apiError.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please check your connection and try again.';
        }
        
        setState((prev) => ({ 
          ...prev, 
          submitting: false,
          lastSubmissionMessage: errorMessage 
        }));
        return { success: false, message: errorMessage };
      }
    },
    [state.story, networkStatus.isOnline, loadCurrentStory]
  );

  const refreshStory = useCallback(() => {
    loadCurrentStory(false); // Force fresh data on manual refresh
  }, [loadCurrentStory]);

  const retryLoadStory = useCallback(() => {
    loadCurrentStory(false, true); // Force fresh data and mark as retry
  }, [loadCurrentStory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    submitSentence,
    refreshStory,
    retryLoadStory,
    networkStatus,
  } as const;
};
