import { redis } from '@devvit/web/server';
import { Story, Round, Submission, LeaderboardEntry, UserContribution } from '../../shared/types/api';

// Redis key patterns
const KEYS = {
  CURRENT_STORY: 'stories:current',
  ARCHIVED_STORY: (storyId: string) => `stories:archive:${storyId}`,
  CURRENT_ROUND: 'rounds:current',
  ROUND_HISTORY: (storyId: string, roundNumber: number) => `rounds:history:${storyId}:${roundNumber}`,
  USER_SUBMISSIONS: (userId: string) => `users:submissions:${userId}`,
  LEADERBOARD_TOP: 'leaderboard:top',
  TEMP_ROUND_SUBMISSIONS: (roundNumber: number) => `temp:round:${roundNumber}:submissions`,
  DAILY_STATS: (date: string) => `stats:daily:${date}`,
} as const;

// Story CRUD operations
export class StoryRedisHelper {
  
  /**
   * Get the current active story
   */
  static async getCurrentStory(): Promise<Story | null> {
    try {
      const storyData = await redis.get(KEYS.CURRENT_STORY);
      if (!storyData) return null;
      
      return JSON.parse(storyData) as Story;
    } catch (error) {
      console.error('Error getting current story:', error);
      return null;
    }
  }

  /**
   * Create a new story and set it as current
   */
  static async createNewStory(): Promise<Story> {
    const now = Date.now();
    const story: Story = {
      id: `story_${now}`,
      created: now,
      sentences: [],
      roundNumber: 1,
      totalVotes: 0,
      status: 'active',
      contributors: [],
    };

    try {
      await redis.set(KEYS.CURRENT_STORY, JSON.stringify(story));
      return story;
    } catch (error) {
      console.error('Error creating new story:', error);
      throw new Error('Failed to create new story');
    }
  }

  /**
   * Update the current story
   */
  static async updateCurrentStory(story: Story): Promise<void> {
    try {
      await redis.set(KEYS.CURRENT_STORY, JSON.stringify(story));
    } catch (error) {
      console.error('Error updating current story:', error);
      throw new Error('Failed to update story');
    }
  }

  /**
   * Archive a completed story
   */
  static async archiveStory(story: Story): Promise<void> {
    try {
      // Store in archive
      await redis.set(KEYS.ARCHIVED_STORY(story.id), JSON.stringify(story));
      
      // Remove from current if it's the current story
      const currentStory = await this.getCurrentStory();
      if (currentStory && currentStory.id === story.id) {
        await redis.del(KEYS.CURRENT_STORY);
      }
    } catch (error) {
      console.error('Error archiving story:', error);
      throw new Error('Failed to archive story');
    }
  }

  /**
   * Get an archived story by ID
   */
  static async getArchivedStory(storyId: string): Promise<Story | null> {
    try {
      const storyData = await redis.get(KEYS.ARCHIVED_STORY(storyId));
      if (!storyData) return null;
      
      return JSON.parse(storyData) as Story;
    } catch (error) {
      console.error('Error getting archived story:', error);
      return null;
    }
  }

  /**
   * Add a sentence to the current story
   */
  static async addSentenceToStory(sentence: string, userId: string, upvotes: number): Promise<Story | null> {
    try {
      const story = await this.getCurrentStory();
      if (!story) return null;

      // Add sentence
      story.sentences.push(sentence);
      story.totalVotes += upvotes;
      story.roundNumber += 1;

      // Add contributor if not already present
      if (!story.contributors.includes(userId)) {
        story.contributors.push(userId);
      }

      // Check if story is complete
      if (story.sentences.length >= 100) {
        story.status = 'completed';
        story.completedAt = Date.now();
      }

      await this.updateCurrentStory(story);
      return story;
    } catch (error) {
      console.error('Error adding sentence to story:', error);
      return null;
    }
  }
}

// Round CRUD operations
export class RoundRedisHelper {

  /**
   * Get the current round
   */
  static async getCurrentRound(): Promise<Round | null> {
    try {
      const roundData = await redis.get(KEYS.CURRENT_ROUND);
      if (!roundData) return null;
      
      return JSON.parse(roundData) as Round;
    } catch (error) {
      console.error('Error getting current round:', error);
      return null;
    }
  }

  /**
   * Create a new round
   */
  static async createNewRound(storyId: string, roundNumber: number): Promise<Round> {
    const now = Date.now();
    const round: Round = {
      storyId,
      roundNumber,
      startTime: now,
      endTime: now + (60 * 60 * 1000), // 1 hour from now
      submissions: [],
    };

    try {
      await redis.set(KEYS.CURRENT_ROUND, JSON.stringify(round));
      return round;
    } catch (error) {
      console.error('Error creating new round:', error);
      throw new Error('Failed to create new round');
    }
  }

  /**
   * Add a submission to the current round
   */
  static async addSubmissionToRound(submission: Submission): Promise<void> {
    try {
      const round = await this.getCurrentRound();
      if (!round) {
        throw new Error('No current round found');
      }

      round.submissions.push(submission);
      await redis.set(KEYS.CURRENT_ROUND, JSON.stringify(round));

      // Also store in temporary submissions for easy access
      const tempKey = KEYS.TEMP_ROUND_SUBMISSIONS(round.roundNumber);
      const existingSubmissions = await redis.get(tempKey);
      const submissions = existingSubmissions ? JSON.parse(existingSubmissions) : [];
      submissions.push(submission);
      await redis.set(tempKey, JSON.stringify(submissions));
      
      // Set expiry for temp data (2 hours)
      await redis.expire(tempKey, 7200);
    } catch (error) {
      console.error('Error adding submission to round:', error);
      throw new Error('Failed to add submission');
    }
  }

  /**
   * Complete a round with the winning submission
   */
  static async completeRound(winner: Round['winner']): Promise<void> {
    try {
      const round = await this.getCurrentRound();
      if (!round) return;

      round.winner = winner;
      round.endTime = Date.now();

      // Archive the round
      await redis.set(KEYS.ROUND_HISTORY(round.storyId, round.roundNumber), JSON.stringify(round));
      
      // Clear current round
      await redis.del(KEYS.CURRENT_ROUND);
    } catch (error) {
      console.error('Error completing round:', error);
      throw new Error('Failed to complete round');
    }
  }

  /**
   * Get submissions for the current round
   */
  static async getCurrentRoundSubmissions(): Promise<Submission[]> {
    try {
      const round = await this.getCurrentRound();
      if (!round) return [];

      const tempKey = KEYS.TEMP_ROUND_SUBMISSIONS(round.roundNumber);
      const submissionsData = await redis.get(tempKey);
      
      return submissionsData ? JSON.parse(submissionsData) : [];
    } catch (error) {
      console.error('Error getting current round submissions:', error);
      return [];
    }
  }
}

// User contribution tracking
export class UserRedisHelper {

  /**
   * Get user contributions
   */
  static async getUserContributions(userId: string): Promise<UserContribution | null> {
    try {
      const contributionData = await redis.get(KEYS.USER_SUBMISSIONS(userId));
      if (!contributionData) return null;
      
      return JSON.parse(contributionData) as UserContribution;
    } catch (error) {
      console.error('Error getting user contributions:', error);
      return null;
    }
  }

  /**
   * Add a user submission
   */
  static async addUserSubmission(
    userId: string, 
    storyId: string, 
    roundNumber: number, 
    sentence: string, 
    upvotes: number, 
    wasWinner: boolean
  ): Promise<void> {
    try {
      let contributions = await this.getUserContributions(userId);
      
      if (!contributions) {
        contributions = {
          userId,
          submissions: [],
          totalSubmissions: 0,
          totalWins: 0,
          totalUpvotes: 0,
        };
      }

      contributions.submissions.push({
        storyId,
        roundNumber,
        sentence,
        upvotes,
        wasWinner,
      });

      contributions.totalSubmissions += 1;
      contributions.totalUpvotes += upvotes;
      if (wasWinner) {
        contributions.totalWins += 1;
      }

      await redis.set(KEYS.USER_SUBMISSIONS(userId), JSON.stringify(contributions));
    } catch (error) {
      console.error('Error adding user submission:', error);
      throw new Error('Failed to track user submission');
    }
  }
}

// Leaderboard operations
export class LeaderboardRedisHelper {

  /**
   * Get top leaderboard entries
   */
  static async getTopLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const leaderboardData = await redis.get(KEYS.LEADERBOARD_TOP);
      if (!leaderboardData) return [];
      
      return JSON.parse(leaderboardData) as LeaderboardEntry[];
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Update leaderboard with a new completed story
   */
  static async updateLeaderboard(story: Story): Promise<void> {
    try {
      if (story.status !== 'completed' || story.sentences.length !== 100) {
        return; // Only completed stories go on leaderboard
      }

      const currentLeaderboard = await this.getTopLeaderboard();
      
      const newEntry: LeaderboardEntry = {
        rank: 0, // Will be calculated after sorting
        storyId: story.id,
        sentenceCount: story.sentences.length,
        totalVotes: story.totalVotes,
        creator: story.contributors[0] || 'anonymous',
        completedAt: story.completedAt!,
        preview: story.sentences.slice(0, 2).join(' ').substring(0, 100),
      };

      // Add new entry and sort
      const updatedLeaderboard = [...currentLeaderboard, newEntry]
        .sort((a, b) => {
          // Sort by total votes DESC, then by completion date ASC (older first)
          if (a.totalVotes !== b.totalVotes) {
            return b.totalVotes - a.totalVotes;
          }
          return a.completedAt - b.completedAt;
        })
        .slice(0, 10) // Keep only top 10
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      await redis.set(KEYS.LEADERBOARD_TOP, JSON.stringify(updatedLeaderboard));
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      throw new Error('Failed to update leaderboard');
    }
  }
}

// Utility functions
export class RedisUtilityHelper {

  /**
   * Clean up expired temporary data
   */
  static async cleanupTempData(): Promise<void> {
    try {
      // This would typically scan for temp keys and remove expired ones
      // For now, we rely on Redis TTL to handle cleanup automatically
      console.log('Temporary data cleanup completed (handled by Redis TTL)');
    } catch (error) {
      console.error('Error during temp data cleanup:', error);
    }
  }

  /**
   * Get daily statistics
   */
  static async getDailyStats(date: string): Promise<any> {
    try {
      const statsData = await redis.get(KEYS.DAILY_STATS(date));
      return statsData ? JSON.parse(statsData) : null;
    } catch (error) {
      console.error('Error getting daily stats:', error);
      return null;
    }
  }

  /**
   * Update daily statistics
   */
  static async updateDailyStats(date: string, stats: any): Promise<void> {
    try {
      await redis.set(KEYS.DAILY_STATS(date), JSON.stringify(stats));
    } catch (error) {
      console.error('Error updating daily stats:', error);
      throw new Error('Failed to update daily stats');
    }
  }
}
