import { useState, useCallback, useRef } from 'react';
import { VoteCount, UserVoteStatus } from '../../shared/types/voting';
import { StoryChapter, StoryContext } from '../../shared/types/story';
import { 
  VoteUpdateMessage, 
  ChapterTransitionMessage, 
  StoryResetMessage, 
  VotingEndedMessage 
} from '../../shared/types/api';
import { 
  mergeOptimisticWithServer, 
  calculateOptimisticVoteCounts,
  createVoteRollback 
} from '../utils/optimisticUpdates';

interface SynchronizedState {
  currentChapter: StoryChapter | null;
  context: StoryContext | null;
  voteCounts: VoteCount[];
  userVoteStatus: UserVoteStatus;
  votingActive: boolean;
}

interface OptimisticUpdate {
  id: string;
  type: 'vote' | 'chapter_transition';
  timestamp: number;
  data: any;
  rollback: () => void;
}

interface UseSynchronizedStateReturn {
  state: SynchronizedState;
  updateState: (updates: Partial<SynchronizedState>) => void;
  handleVoteUpdate: (message: VoteUpdateMessage) => void;
  handleChapterTransition: (message: ChapterTransitionMessage) => void;
  handleStoryReset: (message: StoryResetMessage) => void;
  handleVotingEnded: (message: VotingEndedMessage) => void;
  applyOptimisticUpdate: (update: Omit<OptimisticUpdate, 'timestamp'>) => void;
  rollbackOptimisticUpdate: (updateId: string) => void;
  clearOptimisticUpdates: () => void;
  hasOptimisticUpdates: boolean;
}

export const useSynchronizedState = (
  initialState: Partial<SynchronizedState> = {}
): UseSynchronizedStateReturn => {
  const [state, setState] = useState<SynchronizedState>({
    currentChapter: null,
    context: null,
    voteCounts: [],
    userVoteStatus: { hasVoted: false },
    votingActive: false,
    ...initialState
  });

  const optimisticUpdatesRef = useRef<Map<string, OptimisticUpdate>>(new Map());
  const [hasOptimisticUpdates, setHasOptimisticUpdates] = useState(false);

  const updateState = useCallback((updates: Partial<SynchronizedState>) => {
    setState(prevState => ({
      ...prevState,
      ...updates
    }));
  }, []);

  const applyOptimisticUpdate = useCallback((update: Omit<OptimisticUpdate, 'timestamp'>) => {
    const fullUpdate: OptimisticUpdate = {
      ...update,
      timestamp: Date.now()
    };

    // Store the optimistic update
    optimisticUpdatesRef.current.set(update.id, fullUpdate);
    setHasOptimisticUpdates(optimisticUpdatesRef.current.size > 0);

    // Apply the optimistic change
    switch (update.type) {
      case 'vote':
        const { choiceId } = update.data;
        setState(prevState => {
          // Store original state for rollback
          const originalVoteCounts = [...prevState.voteCounts];
          const originalUserStatus = { ...prevState.userVoteStatus };

          // Create rollback function
          const rollbackFn = createVoteRollback(
            originalVoteCounts,
            originalUserStatus,
            setState
          );

          // Update the rollback function in the optimistic update
          const storedUpdate = optimisticUpdatesRef.current.get(update.id);
          if (storedUpdate) {
            storedUpdate.rollback = rollbackFn;
          }

          // Update user vote status optimistically
          const newUserVoteStatus: UserVoteStatus = {
            hasVoted: true,
            choiceId,
            timestamp: new Date()
          };

          // Update vote counts optimistically using utility function
          const newVoteCounts = calculateOptimisticVoteCounts(
            prevState.voteCounts,
            choiceId,
            1
          );

          return {
            ...prevState,
            userVoteStatus: newUserVoteStatus,
            voteCounts: newVoteCounts
          };
        });
        break;

      case 'chapter_transition':
        setState(prevState => ({
          ...prevState,
          currentChapter: update.data.newChapter,
          context: update.data.newContext,
          voteCounts: [],
          userVoteStatus: { hasVoted: false },
          votingActive: true
        }));
        break;
    }

    console.log(`Applied optimistic update: ${update.id} (${update.type})`);
  }, []);

  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    const update = optimisticUpdatesRef.current.get(updateId);
    if (update) {
      console.log(`Rolling back optimistic update: ${updateId}`);
      update.rollback();
      optimisticUpdatesRef.current.delete(updateId);
      setHasOptimisticUpdates(optimisticUpdatesRef.current.size > 0);
    }
  }, []);

  const clearOptimisticUpdates = useCallback(() => {
    console.log(`Clearing ${optimisticUpdatesRef.current.size} optimistic updates`);
    optimisticUpdatesRef.current.clear();
    setHasOptimisticUpdates(false);
  }, []);

  const handleVoteUpdate = useCallback((message: VoteUpdateMessage) => {
    console.log('Handling vote update from server:', message);
    
    // Get current optimistic updates for this chapter
    const optimisticUpdates: OptimisticUpdate[] = [];
    optimisticUpdatesRef.current.forEach((update) => {
      if (update.type === 'vote' && update.data.chapterId === message.data.chapterId) {
        optimisticUpdates.push(update);
      }
    });

    // Merge optimistic updates with server data
    const currentVoteCounts = state.voteCounts;
    const currentUserStatus = state.userVoteStatus;
    
    const mergeResult = mergeOptimisticWithServer(
      currentVoteCounts,
      message.data.voteCounts,
      currentUserStatus,
      currentUserStatus // We don't get user status in vote updates, so keep current
    );

    if (mergeResult.hadConflicts) {
      console.warn('Conflicts detected when merging optimistic updates with server data');
    }

    // Clear optimistic updates for this chapter
    optimisticUpdates.forEach(update => {
      optimisticUpdatesRef.current.delete(update.id);
    });
    setHasOptimisticUpdates(optimisticUpdatesRef.current.size > 0);

    // Update state with merged data
    updateState({
      voteCounts: mergeResult.voteCounts
    });
  }, [updateState, state.voteCounts, state.userVoteStatus]);

  const handleChapterTransition = useCallback((message: ChapterTransitionMessage) => {
    console.log('Handling chapter transition from server:', message);
    
    // Clear all optimistic updates since we have a new chapter
    clearOptimisticUpdates();

    // Update state with new chapter data
    updateState({
      currentChapter: message.data.newChapter,
      voteCounts: message.data.newChapter.choices.map(choice => ({
        choiceId: choice.id,
        count: 0,
        percentage: 0
      })),
      userVoteStatus: { hasVoted: false },
      votingActive: true
    });
  }, [updateState, clearOptimisticUpdates]);

  const handleStoryReset = useCallback((message: StoryResetMessage) => {
    console.log('Handling story reset from server:', message);
    
    // Clear all optimistic updates
    clearOptimisticUpdates();

    // Reset to initial chapter
    updateState({
      currentChapter: message.data.newChapter,
      context: null,
      voteCounts: message.data.newChapter.choices.map(choice => ({
        choiceId: choice.id,
        count: 0,
        percentage: 0
      })),
      userVoteStatus: { hasVoted: false },
      votingActive: true
    });
  }, [updateState, clearOptimisticUpdates]);

  const handleVotingEnded = useCallback((message: VotingEndedMessage) => {
    console.log('Handling voting ended from server:', message);
    
    // Clear optimistic updates for this chapter
    const updatesToRemove: string[] = [];
    optimisticUpdatesRef.current.forEach((update, id) => {
      if (update.type === 'vote' && update.data.chapterId === message.data.chapterId) {
        updatesToRemove.push(id);
      }
    });
    
    updatesToRemove.forEach(id => {
      optimisticUpdatesRef.current.delete(id);
    });
    setHasOptimisticUpdates(optimisticUpdatesRef.current.size > 0);

    // Update voting status
    updateState({
      votingActive: false
    });
  }, [updateState]);

  return {
    state,
    updateState,
    handleVoteUpdate,
    handleChapterTransition,
    handleStoryReset,
    handleVotingEnded,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    clearOptimisticUpdates,
    hasOptimisticUpdates
  };
};
