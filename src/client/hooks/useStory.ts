import { useCallback, useEffect, useState } from 'react';
import type { 
  CurrentStoryResponse, 
  SubmitSentenceRequest, 
  SubmitSentenceResponse,
  Story 
} from '../../shared/types/api';

interface StoryState {
  loading: boolean;
  story: Story | null;
  roundTimeRemaining: number;
  username: string | null;
  submitting: boolean;
  lastSubmissionMessage: string | null;
}

export const useStory = () => {
  const [state, setState] = useState<StoryState>({
    loading: true,
    story: null,
    roundTimeRemaining: 0,
    username: null,
    submitting: false,
    lastSubmissionMessage: null,
  });

  const loadCurrentStory = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));

      const res = await fetch('/api/story/current');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CurrentStoryResponse = await res.json();

      if (data.type !== 'current-story') throw new Error('Unexpected response');
      setState((prev) => ({ 
        ...prev, 
        story: data.story, 
        roundTimeRemaining: data.roundTimeRemaining,
        loading: false 
      }));
    } catch (err) {
      console.error('Failed to load current story', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadCurrentStory();
  }, [loadCurrentStory]);

  const submitSentence = useCallback(
    async (sentence: string) => {
      if (!state.story) {
        console.error('No story available – cannot submit sentence');
        return { success: false, message: 'No active story found' };
      }

      try {
        setState((prev) => ({ ...prev, submitting: true, lastSubmissionMessage: null }));

        const requestBody: SubmitSentenceRequest = {
          storyId: state.story.id,
          roundNumber: state.story.roundNumber,
          sentence: sentence.trim(),
        };

        const res = await fetch('/api/submit-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SubmitSentenceResponse = await res.json();

        setState((prev) => ({ 
          ...prev, 
          submitting: false,
          lastSubmissionMessage: data.message 
        }));

        return { success: data.success, message: data.message };
      } catch (err) {
        console.error('Failed to submit sentence', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit sentence';
        setState((prev) => ({ 
          ...prev, 
          submitting: false,
          lastSubmissionMessage: errorMessage 
        }));
        return { success: false, message: errorMessage };
      }
    },
    [state.story]
  );

  const refreshStory = useCallback(() => {
    loadCurrentStory();
  }, [loadCurrentStory]);

  return {
    ...state,
    submitSentence,
    refreshStory,
  } as const;
};
