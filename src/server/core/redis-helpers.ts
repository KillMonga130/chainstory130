import { redis } from '@devvit/web/server';
import { Story, Round, Submission, LeaderboardEntry, UserContribution } from '../../shared/types/api';
import { RedisErrorHandler } from '../utils/redis-error-handler';
import { RedisError, ErrorLogger } from '../utils/error-handler';

// Redis key patterns
const KEYS = {
  CURRENT_STORY: 'stories:current',
  ARCHIVED_STORY: (storyId: string) => `stories:archive:${storyId}`,
  ARCHIVED_STORY_IDS: 'stories:archive:ids', // Set of archived story IDs
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
    return await RedisErrorHandler.safeGetJSON<Story>(KEYS.CURRENT_STORY);
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

    await RedisErrorHandler.safeSetJSON(KEYS.CURRENT_STORY, story);
    ErrorLogger.logInfo('New story created', { storyId: story.id });
    return story;
  }

  /**
   * Update the current story
   */
  static async updateCurrentStory(story: Story): Promise<void> {
    await RedisErrorHandler.safeSetJSON(KEYS.CURRENT_STORY, story);
    ErrorLogger.logInfo('Story updated', { storyId: story.id, status: story.status });
  }

  /**
   * Archive a completed story
   */
  static async archiveStory(story: Story): Promise<void> {
    await RedisErrorHandler.withErrorHandling(
      async () => {
        // Store in archive
        await RedisErrorHandler.safeSetJSON(KEYS.ARCHIVED_STORY(story.id), story);
        
        // Add to archived story IDs set (using a simple string list approach)
        const idList = (await RedisErrorHandler.safeGetJSON<string[]>(KEYS.ARCHIVED_STORY_IDS)) || [];
        if (!idList.includes(story.id)) {
          idList.push(story.id);
          await RedisErrorHandler.safeSetJSON(KEYS.ARCHIVED_STORY_IDS, idList);
        }
        
        // Remove from current if it's the current story
        const currentStory = await this.getCurrentStory();
        if (currentStory && currentStory.id === story.id) {
          await RedisErrorHandler.safeDelete(KEYS.CURRENT_STORY);
        }
        
        ErrorLogger.logInfo('Story archived', { 
          storyId: story.id, 
          sentences: story.sentences.length,
          totalVotes: story.totalVotes 
        });
      },
      'ARCHIVE_STORY'
    );
  }

  /**
   * Get an archived story by ID
   */
  static async getArchivedStory(storyId: string): Promise<Story | null> {
    return await RedisErrorHandler.safeGetJSON<Story>(KEYS.ARCHIVED_STORY(storyId));
  }

  /**
   * Add a sentence to the current story
   */
  static async addSentenceToStory(sentence: string, userId: string, upvotes: number): Promise<Story | null> {
    return await RedisErrorHandler.withErrorHandling(
      async () => {
        const story = await this.getCurrentStory();
        if (!story) {
          throw new RedisError('No current story found', 'ADD_SENTENCE');
        }

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
        
        ErrorLogger.logInfo('Sentence added to story', {
          storyId: story.id,
          sentenceCount: story.sentences.length,
          userId,
          upvotes,
          completed: story.status === 'completed'
        });
        
        return story;
      },
      'ADD_SENTENCE_TO_STORY',
      null
    );
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

  /**
   * Get stories that a user has contributed to
   */
  static async getUserStories(
    userId: string, 
    page: number, 
    limit: number
  ): Promise<{ stories: Story[]; totalPages: number }> {
    try {
      const contributions = await this.getUserContributions(userId);
      
      if (!contributions || contributions.submissions.length === 0) {
        return { stories: [], totalPages: 0 };
      }

      // Get unique story IDs that the user contributed to
      const uniqueStoryIds = [...new Set(contributions.submissions.map(sub => sub.storyId))];
      
      // Fetch the actual stories (both current and archived)
      const stories: Story[] = [];
      
      for (const storyId of uniqueStoryIds) {
        // Try to get from current story first
        const currentStory = await StoryRedisHelper.getCurrentStory();
        if (currentStory && currentStory.id === storyId) {
          stories.push(currentStory);
          continue;
        }

        // Try to get from archive
        const archivedStory = await StoryRedisHelper.getArchivedStory(storyId);
        if (archivedStory) {
          stories.push(archivedStory);
        }
      }

      // Sort stories by completion date DESC (most recent first)
      const sortedStories = stories.sort((a, b) => {
        const aCompleted = a.completedAt || a.created;
        const bCompleted = b.completedAt || b.created;
        return bCompleted - aCompleted;
      });

      // Paginate results
      const totalStories = sortedStories.length;
      const totalPages = Math.ceil(totalStories / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const pageStories = sortedStories.slice(startIndex, endIndex);

      return {
        stories: pageStories,
        totalPages,
      };
    } catch (error) {
      console.error('Error getting user stories:', error);
      return { stories: [], totalPages: 0 };
    }
  }

  /**
   * Get user contribution statistics
   */
  static async getUserStats(userId: string): Promise<{
    totalSubmissions: number;
    totalWins: number;
    totalUpvotes: number;
    winRate: number;
    averageUpvotes: number;
    storiesContributedTo: number;
  } | null> {
    try {
      const contributions = await this.getUserContributions(userId);
      
      if (!contributions) {
        return null;
      }

      const uniqueStories = new Set(contributions.submissions.map(sub => sub.storyId)).size;
      const winRate = contributions.totalSubmissions > 0 
        ? (contributions.totalWins / contributions.totalSubmissions) * 100 
        : 0;
      const averageUpvotes = contributions.totalSubmissions > 0 
        ? contributions.totalUpvotes / contributions.totalSubmissions 
        : 0;

      return {
        totalSubmissions: contributions.totalSubmissions,
        totalWins: contributions.totalWins,
        totalUpvotes: contributions.totalUpvotes,
        winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
        averageUpvotes: Math.round(averageUpvotes * 100) / 100, // Round to 2 decimal places
        storiesContributedTo: uniqueStories,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  /**
   * Track a user submission (even if they don't win)
   */
  static async trackUserSubmission(
    userId: string, 
    storyId: string, 
    roundNumber: number, 
    sentence: string
  ): Promise<void> {
    try {
      // This tracks all submissions, not just winners
      // We'll update with actual upvotes and winner status during round resolution
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

      // Check if this submission already exists (avoid duplicates)
      const existingSubmission = contributions.submissions.find(
        sub => sub.storyId === storyId && sub.roundNumber === roundNumber && sub.sentence === sentence
      );

      if (!existingSubmission) {
        contributions.submissions.push({
          storyId,
          roundNumber,
          sentence,
          upvotes: 0, // Will be updated during round resolution
          wasWinner: false, // Will be updated during round resolution
        });

        contributions.totalSubmissions += 1;
        await redis.set(KEYS.USER_SUBMISSIONS(userId), JSON.stringify(contributions));
      }
    } catch (error) {
      console.error('Error tracking user submission:', error);
      // Don't throw error - this is not critical for core functionality
    }
  }
}

// Leaderboard operations
export class LeaderboardRedisHelper {

  /**
   * Get top leaderboard entries with caching
   */
  static async getTopLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const cacheKey = KEYS.LEADERBOARD_TOP;
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData) as LeaderboardEntry[];
        // Return cached data (Redis will handle expiration automatically)
        return parsed;
      }

      // Cache miss or expired - rebuild leaderboard from archived stories
      const leaderboard = await this.rebuildLeaderboard();
      
      // Cache for 10 minutes (600 seconds) using set with expiration
      await redis.set(cacheKey, JSON.stringify(leaderboard), { expiration: new Date(Date.now() + 600000) });
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Rebuild leaderboard from all archived stories
   */
  private static async rebuildLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      // Get all archived story IDs from the list
      const archivedIdsData = await redis.get(KEYS.ARCHIVED_STORY_IDS);
      const archivedIds = archivedIdsData ? JSON.parse(archivedIdsData) : [];
      
      if (archivedIds.length === 0) {
        return [];
      }

      // Fetch all archived stories
      const stories: Story[] = [];
      for (const storyId of archivedIds) {
        const storyData = await redis.get(KEYS.ARCHIVED_STORY(storyId));
        if (storyData) {
          const story = JSON.parse(storyData) as Story;
          if (story.status === 'completed' && story.sentences.length === 100) {
            stories.push(story);
          }
        }
      }
      // and rely on the updateLeaderboard method to populate entries.

      // Convert to leaderboard entries and sort
      const entries: LeaderboardEntry[] = stories
        .map((story) => ({
          rank: 0, // Will be set after sorting
          storyId: story.id,
          sentenceCount: story.sentences.length,
          totalVotes: story.totalVotes,
          creator: story.contributors[0] || 'anonymous',
          completedAt: story.completedAt!,
          preview: story.sentences.slice(0, 2).join(' ').substring(0, 100),
        }))
        .sort((a, b) => {
          // Sort by total votes DESC, then by creation date ASC (older stories rank higher on ties)
          if (a.totalVotes !== b.totalVotes) {
            return b.totalVotes - a.totalVotes;
          }
          return a.completedAt - b.completedAt;
        })
        .slice(0, 10) // Keep only top 10
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return entries;
    } catch (error) {
      console.error('Error rebuilding leaderboard:', error);
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

      // Invalidate cache to force rebuild on next request
      await redis.del(KEYS.LEADERBOARD_TOP);
      
      console.log(`Leaderboard cache invalidated for new completed story: ${story.id}`);
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      throw new Error('Failed to update leaderboard');
    }
  }
}

// Archive operations
export class ArchiveRedisHelper {

  /**
   * Get paginated archived stories with sorting
   */
  static async getArchivedStories(
    page: number, 
    limit: number, 
    sort: 'date' | 'votes'
  ): Promise<{ stories: Story[]; totalPages: number }> {
    try {
      // Get all archived story IDs from the list
      const archivedIdsData = await redis.get(KEYS.ARCHIVED_STORY_IDS);
      const archivedIds = archivedIdsData ? JSON.parse(archivedIdsData) : [];
      
      if (archivedIds.length === 0) {
        return { stories: [], totalPages: 0 };
      }

      // Fetch all archived stories
      const stories: Story[] = [];
      for (const storyId of archivedIds) {
        const storyData = await redis.get(KEYS.ARCHIVED_STORY(storyId));
        if (storyData) {
          const story = JSON.parse(storyData) as Story;
          if (story.status === 'completed' || story.status === 'archived') {
            stories.push(story);
          }
        }
      }

      // Sort stories based on requested sort order
      const sortedStories = stories.sort((a, b) => {
        if (sort === 'votes') {
          // Sort by total votes DESC, then by completion date DESC (newer first)
          if (a.totalVotes !== b.totalVotes) {
            return b.totalVotes - a.totalVotes;
          }
          return (b.completedAt || 0) - (a.completedAt || 0);
        } else {
          // Sort by completion date DESC (newer first), then by total votes DESC
          const aCompleted = a.completedAt || 0;
          const bCompleted = b.completedAt || 0;
          if (aCompleted !== bCompleted) {
            return bCompleted - aCompleted;
          }
          return b.totalVotes - a.totalVotes;
        }
      });

      // Calculate pagination
      const totalStories = sortedStories.length;
      const totalPages = Math.ceil(totalStories / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      // Get page slice
      const pageStories = sortedStories.slice(startIndex, endIndex);

      return {
        stories: pageStories,
        totalPages,
      };
    } catch (error) {
      console.error('Error getting archived stories:', error);
      return { stories: [], totalPages: 0 };
    }
  }

  /**
   * Get a specific archived story by ID
   */
  static async getArchivedStoryById(storyId: string): Promise<Story | null> {
    try {
      const storyData = await redis.get(KEYS.ARCHIVED_STORY(storyId));
      if (!storyData) return null;
      
      return JSON.parse(storyData) as Story;
    } catch (error) {
      console.error('Error getting archived story by ID:', error);
      return null;
    }
  }

  /**
   * Search archived stories by text (future enhancement)
   */
  static async searchArchivedStories(
    query: string, 
    page: number, 
    limit: number
  ): Promise<{ stories: Story[]; totalPages: number }> {
    try {
      // Get all archived stories first
      const allStories = await this.getArchivedStories(1, 1000, 'date');
      
      // Simple text search in story sentences
      const matchingStories = allStories.stories.filter(story => {
        const fullText = story.sentences.join(' ').toLowerCase();
        return fullText.includes(query.toLowerCase());
      });

      // Paginate results
      const totalStories = matchingStories.length;
      const totalPages = Math.ceil(totalStories / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const pageStories = matchingStories.slice(startIndex, endIndex);

      return {
        stories: pageStories,
        totalPages,
      };
    } catch (error) {
      console.error('Error searching archived stories:', error);
      return { stories: [], totalPages: 0 };
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
