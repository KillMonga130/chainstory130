/**
 * API contract interfaces for client-server communication
 */

import { StoryChapter, StoryPath, StoryContext } from './story.js';
import { VoteResult, VoteCount, UserVoteStatus, VotingStats } from './voting.js';

// Story API Endpoints

export interface GetCurrentStoryResponse {
  success: boolean;
  data?: {
    chapter: StoryChapter;
    context: StoryContext;
    votingActive: boolean;
  };
  error?: string;
}

export interface GetStoryHistoryResponse {
  success: boolean;
  data?: {
    path: StoryPath;
    chapters: StoryChapter[];
    decisions: Array<{
      chapterId: string;
      winningChoice: string;
      voteStats: VotingStats;
    }>;
  };
  error?: string;
}

export interface ResetStoryRequest {
  adminKey?: string;
  reason?: string;
}

export interface ResetStoryResponse {
  success: boolean;
  message: string;
}

// Voting API Endpoints

export interface CastVoteRequest {
  chapterId: string;
  choiceId: string;
}

export interface CastVoteResponse {
  success: boolean;
  data?: VoteResult;
  error?: string;
}

export interface GetVoteCountsResponse {
  success: boolean;
  data?: VoteCount[];
  error?: string;
}

export interface GetVoteStatusResponse {
  success: boolean;
  data?: UserVoteStatus;
  error?: string;
}

// Administrative API Endpoints

export interface AdvanceStoryRequest {
  adminKey: string;
  forceChoice?: string;
  reason?: string;
}

export interface AdvanceStoryResponse {
  success: boolean;
  data?: {
    newChapter: StoryChapter;
    previousStats: VotingStats;
  };
  error?: string;
}

export interface GetStoryStatsResponse {
  success: boolean;
  data?: {
    totalChapters: number;
    totalVotes: number;
    uniqueParticipants: number;
    averageVotesPerChapter: number;
    storyDuration: number;
    currentEngagement: number;
  };
  error?: string;
}

// Realtime Message Types

export interface RealtimeMessage {
  type: 'vote_update' | 'chapter_transition' | 'story_reset' | 'voting_ended';
  timestamp: Date;
  data: any;
}

export interface VoteUpdateMessage extends RealtimeMessage {
  type: 'vote_update';
  data: {
    chapterId: string;
    voteCounts: VoteCount[];
    totalVotes: number;
  };
}

export interface ChapterTransitionMessage extends RealtimeMessage {
  type: 'chapter_transition';
  data: {
    newChapter: StoryChapter;
    winningChoice: string;
    previousStats: VotingStats;
  };
}

export interface StoryResetMessage extends RealtimeMessage {
  type: 'story_reset';
  data: {
    reason: string;
    newChapter: StoryChapter;
  };
}

export interface VotingEndedMessage extends RealtimeMessage {
  type: 'voting_ended';
  data: {
    chapterId: string;
    winningChoice: string;
    finalStats: VotingStats;
  };
}

// Error Response Types

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  fields: Record<string, string>;
}

export interface AuthenticationError extends ApiError {
  code: 'AUTH_ERROR';
  message: 'Authentication required' | 'Invalid credentials' | 'Insufficient permissions';
}

export interface NotFoundError extends ApiError {
  code: 'NOT_FOUND';
  resource: string;
}

export interface ConflictError extends ApiError {
  code: 'CONFLICT';
  message: 'Resource conflict' | 'Duplicate vote' | 'Invalid state';
}
