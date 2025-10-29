/**
 * Voting system data structures for The Haunted Thread
 */

export interface Vote {
  userId: string;
  chapterId: string;
  choiceId: string;
  timestamp: Date;
}

export interface VotingSession {
  chapterId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'expired';
  totalVotes: number;
  choices: VoteChoice[];
}

export interface VoteChoice {
  choiceId: string;
  text: string;
  voteCount: number;
  percentage: number;
}

export interface VoteResult {
  success: boolean;
  message: string;
  voteCount?: number;
  userPreviousVote?: string;
}

export interface VoteCount {
  choiceId: string;
  count: number;
  percentage: number;
}

export interface UserVoteStatus {
  hasVoted: boolean;
  choiceId?: string;
  timestamp?: Date;
}

export interface VotingStats {
  totalVotes: number;
  uniqueVoters: number;
  votingDuration: number;
  winningChoice: string;
  winningPercentage: number;
}
