import { VoteCount, UserVoteStatus } from '../../shared/types/voting';
import { StoryChapter } from '../../shared/types/story';

/**
 * Utility functions for managing optimistic updates and server-side validation
 */

export interface OptimisticVoteUpdate {
  chapterId: string;
  choiceId: string;
  userId?: string;
  timestamp: Date;
}

export interface OptimisticChapterUpdate {
  newChapter: StoryChapter;
  previousChapterId: string;
  winningChoice: string;
  timestamp: Date;
}

/**
 * Validates if an optimistic vote update matches server data
 */
export const validateOptimisticVote = (
  optimisticUpdate: OptimisticVoteUpdate,
  serverVoteCounts: VoteCount[],
  serverUserStatus: UserVoteStatus
): { isValid: boolean; conflicts: string[] } => {
  const conflicts: string[] = [];

  // Check if the user's vote status matches
  if (serverUserStatus.hasVoted && serverUserStatus.choiceId !== optimisticUpdate.choiceId) {
    conflicts.push('User vote choice mismatch');
  }

  // Check if the vote counts are reasonable (within expected range)
  const targetChoice = serverVoteCounts.find(vc => vc.choiceId === optimisticUpdate.choiceId);
  if (targetChoice && targetChoice.count === 0 && serverUserStatus.hasVoted) {
    conflicts.push('Vote count inconsistency');
  }

  return {
    isValid: conflicts.length === 0,
    conflicts
  };
};

/**
 * Merges optimistic updates with server data, resolving conflicts
 */
export const mergeOptimisticWithServer = (
  optimisticVoteCounts: VoteCount[],
  serverVoteCounts: VoteCount[],
  optimisticUserStatus: UserVoteStatus,
  serverUserStatus: UserVoteStatus
): { voteCounts: VoteCount[]; userStatus: UserVoteStatus; hadConflicts: boolean } => {
  let hadConflicts = false;

  // Server data always takes precedence for user status
  let finalUserStatus = serverUserStatus;
  if (JSON.stringify(optimisticUserStatus) !== JSON.stringify(serverUserStatus)) {
    hadConflicts = true;
    console.log('User status conflict resolved in favor of server data');
  }

  // For vote counts, use server data but log any significant discrepancies
  const finalVoteCounts = serverVoteCounts.map(serverCount => {
    const optimisticCount = optimisticVoteCounts.find(oc => oc.choiceId === serverCount.choiceId);
    
    if (optimisticCount && Math.abs(optimisticCount.count - serverCount.count) > 1) {
      hadConflicts = true;
      console.log(`Vote count discrepancy for choice ${serverCount.choiceId}: optimistic=${optimisticCount.count}, server=${serverCount.count}`);
    }
    
    return serverCount;
  });

  return {
    voteCounts: finalVoteCounts,
    userStatus: finalUserStatus,
    hadConflicts
  };
};

/**
 * Creates a rollback function for optimistic vote updates
 */
export const createVoteRollback = (
  originalVoteCounts: VoteCount[],
  originalUserStatus: UserVoteStatus,
  setState: (update: any) => void
) => {
  return () => {
    console.log('Rolling back optimistic vote update');
    setState({
      voteCounts: originalVoteCounts,
      userVoteStatus: originalUserStatus
    });
  };
};

/**
 * Calculates the expected vote counts after an optimistic update
 */
export const calculateOptimisticVoteCounts = (
  currentVoteCounts: VoteCount[],
  choiceId: string,
  increment: number = 1
): VoteCount[] => {
  // Update the counts first
  const updatedCounts = currentVoteCounts.map(count => 
    count.choiceId === choiceId 
      ? { ...count, count: Math.max(0, count.count + increment) }
      : count
  );

  // Recalculate percentages
  const totalVotes = updatedCounts.reduce((sum, count) => sum + count.count, 0);
  
  return updatedCounts.map(count => ({
    ...count,
    percentage: totalVotes > 0 ? Math.round((count.count / totalVotes) * 100) : 0
  }));
};

/**
 * Checks if two vote count arrays are equivalent
 */
export const areVoteCountsEquivalent = (
  counts1: VoteCount[],
  counts2: VoteCount[]
): boolean => {
  if (counts1.length !== counts2.length) return false;
  
  return counts1.every(count1 => {
    const count2 = counts2.find(c => c.choiceId === count1.choiceId);
    return count2 && count2.count === count1.count;
  });
};

/**
 * Generates a unique ID for optimistic updates
 */
export const generateOptimisticUpdateId = (
  type: 'vote' | 'chapter',
  data: any
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  const dataHash = JSON.stringify(data).length; // Simple hash
  
  return `${type}_${timestamp}_${dataHash}_${random}`;
};
