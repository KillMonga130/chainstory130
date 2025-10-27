// Core data structures for Chain Story
export interface Story {
  id: string;                    // Unique identifier (story_timestamp)
  created: number;               // Unix timestamp of creation
  sentences: string[];           // Array of story sentences [0] to [99]
  roundNumber: number;           // Current round (1-100)
  totalVotes: number;            // Sum of all winning sentence upvotes
  status: 'active' | 'completed' | 'archived';
  contributors: string[];        // Unique Reddit usernames who contributed
  completedAt?: number;          // Unix timestamp when story reached 100 sentences
}

export interface Round {
  storyId: string;               // Associated story ID
  roundNumber: number;           // Round number (1-100)
  startTime: number;             // Unix timestamp when round started
  endTime: number;               // Unix timestamp when round ended
  submissions: Submission[];     // All sentences submitted this round
  winner?: {                     // Winning submission (highest votes)
    commentId: string;
    sentence: string;
    upvotes: number;
    userId: string;
  } | undefined;
}

export interface Submission {
  commentId: string;             // Reddit comment ID
  sentence: string;              // Submitted sentence text
  upvotes: number;               // Current upvote count
  userId: string;                // Reddit username of submitter
  timestamp: number;             // Unix timestamp of submission
}

export interface LeaderboardEntry {
  rank: number;                  // Position in leaderboard (1-10)
  storyId: string;               // Story identifier
  sentenceCount: number;         // Total sentences in story (should be 100)
  totalVotes: number;            // Sum of all sentence upvotes
  creator: string;               // Username who submitted first sentence
  completedAt: number;           // When story was completed
  preview: string;               // First 100 characters of story
}

export interface UserContribution {
  userId: string;                // Reddit username
  submissions: {                 // All sentences submitted by user
    storyId: string;
    roundNumber: number;
    sentence: string;
    upvotes: number;
    wasWinner: boolean;
  }[];
  totalSubmissions: number;      // Count of all submissions
  totalWins: number;             // Count of winning submissions
  totalUpvotes: number;          // Sum of upvotes across all submissions
}

// API Response types
export type CurrentStoryResponse = {
  type: 'current-story';
  story: Story;
  roundTimeRemaining: number;    // Seconds until next round
};

export type SubmitSentenceRequest = {
  storyId: string;
  roundNumber: number;
  sentence: string;
};

export type SubmitSentenceResponse = {
  type: 'submit-sentence';
  success: boolean;
  message: string;
  commentId?: string;
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  stories: LeaderboardEntry[];
};

export type ArchiveResponse = {
  type: 'archive';
  stories: Story[];
  totalPages: number;
  currentPage: number;
};

// Validation functions
export function validateSentenceLength(sentence: string): { valid: boolean; error?: string } {
  const trimmed = sentence.trim();
  
  if (trimmed.length < 10) {
    return { valid: false, error: 'Sentence must be at least 10 characters long' };
  }
  
  if (trimmed.length > 150) {
    return { valid: false, error: 'Sentence must be no more than 150 characters long' };
  }
  
  return { valid: true };
}

export function validateStoryState(story: Story): { valid: boolean; error?: string } {
  if (story.sentences.length > 100) {
    return { valid: false, error: 'Story cannot have more than 100 sentences' };
  }
  
  if (story.roundNumber < 1 || story.roundNumber > 100) {
    return { valid: false, error: 'Round number must be between 1 and 100' };
  }
  
  if (story.status === 'completed' && story.sentences.length !== 100) {
    return { valid: false, error: 'Completed story must have exactly 100 sentences' };
  }
  
  if (story.status === 'completed' && !story.completedAt) {
    return { valid: false, error: 'Completed story must have completedAt timestamp' };
  }
  
  return { valid: true };
}
