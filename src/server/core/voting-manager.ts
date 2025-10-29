/**
 * Redis-based voting data persistence for The Haunted Thread
 * Handles vote storage, counting, aggregation, and duplicate prevention using Redis transactions
 */

import { redis } from '@devvit/web/server';
import {
  Vote,
  VotingSession,
  VoteResult,
  VoteCount,
  UserVoteStatus,
  VotingStats,
} from '../../shared/types/voting.js';
import { RedisOptimizer } from '../utils/redis-optimizer';
import { ErrorLogger, PerformanceMonitor, CircuitBreaker } from '../utils/error-handler';

export class VotingManager {
  private static readonly VOTE_PREFIX = 'haunted_thread:vote';
  private static readonly SESSION_PREFIX = 'haunted_thread:voting_session';
  private static readonly USER_VOTE_PREFIX = 'haunted_thread:user_vote';
  private static readonly VOTE_COUNT_PREFIX = 'haunted_thread:vote_count';

  // Circuit breakers for different operations
  private static readonly countCircuitBreaker = new CircuitBreaker(3, 15000, 'count_operations');

  /**
   * Casts a vote using Redis transactions to prevent race conditions
   */
  static async castVote(
    postId: string,
    userId: string,
    chapterId: string,
    choiceId: string
  ): Promise<VoteResult> {
    const userVoteKey = `${this.USER_VOTE_PREFIX}:${postId}:${chapterId}:${userId}`;
    const voteCountKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:${choiceId}`;
    const totalVotesKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:total`;
    const uniqueVotersKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:unique_voters`;

    try {
      // Use Redis transaction to ensure atomicity
      const txn = await redis.watch(userVoteKey);
      await txn.multi();

      // Check if user has already voted
      const existingVote = await redis.get(userVoteKey);
      if (existingVote) {
        return {
          success: false,
          message: 'User has already voted for this chapter',
          userPreviousVote: existingVote,
        };
      }

      // Check if voting session is still active
      const session = await this.getVotingSession(postId, chapterId);
      if (!session || session.status !== 'active') {
        return {
          success: false,
          message: 'Voting is not currently active for this chapter',
        };
      }

      // Create vote record
      const vote: Vote = {
        userId,
        chapterId,
        choiceId,
        timestamp: new Date(),
      };

      const voteKey = `${this.VOTE_PREFIX}:${postId}:${chapterId}:${userId}`;

      // Execute transaction
      await txn.set(userVoteKey, choiceId);
      await txn.expire(userVoteKey, 86400); // 24 hours TTL
      await txn.set(
        voteKey,
        JSON.stringify({
          ...vote,
          timestamp: vote.timestamp.toISOString(),
        })
      );
      await txn.expire(voteKey, 86400);
      await txn.incrBy(voteCountKey, 1);
      await txn.expire(voteCountKey, 86400);
      await txn.incrBy(totalVotesKey, 1);
      await txn.expire(totalVotesKey, 86400);
      await txn.hSet(uniqueVotersKey, { [userId]: '1' });
      await txn.expire(uniqueVotersKey, 86400);

      await txn.exec();

      // Get updated vote count
      const newVoteCount = await redis.get(voteCountKey);

      return {
        success: true,
        message: 'Vote cast successfully',
        voteCount: parseInt(newVoteCount || '0'),
      };
    } catch (error) {
      console.error('Error casting vote:', error);
      return {
        success: false,
        message: 'Failed to cast vote due to server error',
      };
    }
  }

  /**
   * Gets vote counts for all choices in a chapter (optimized with caching)
   */
  static async getVoteCounts(postId: string, chapterId: string): Promise<VoteCount[]> {
    return this.countCircuitBreaker.execute(async () => {
      const stopTimer = PerformanceMonitor.startTimer('voting_get_counts');

      try {
        // Get voting session to know available choices
        const session = await this.getVotingSessionCached(postId, chapterId);
        if (!session) {
          stopTimer();
          return [];
        }

        const choiceIds = session.choices.map((choice) => choice.choiceId);

        // Use optimized batch retrieval
        const voteCounts = await RedisOptimizer.getVoteCountsOptimized(
          postId,
          chapterId,
          choiceIds
        );

        // Calculate percentages
        const totalVotes = voteCounts.reduce((sum, count) => sum + count.count, 0);

        const result = voteCounts.map(({ choiceId, count }) => ({
          choiceId,
          count,
          percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        }));

        stopTimer();
        return result;
      } catch (error) {
        stopTimer();
        PerformanceMonitor.recordMetric('voting_get_counts', 0, true);
        ErrorLogger.logWarning('Error getting vote counts', {
          postId,
          chapterId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    });
  }

  /**
   * Gets aggregated voting statistics for a chapter
   */
  static async getVotingStats(postId: string, chapterId: string): Promise<VotingStats | null> {
    try {
      const totalVotesKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:total`;
      const uniqueVotersKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:unique_voters`;

      const [totalVotes, uniqueVotersData, session] = await Promise.all([
        redis.get(totalVotesKey),
        redis.hGetAll(uniqueVotersKey),
        this.getVotingSession(postId, chapterId),
      ]);

      const uniqueVoters = Object.keys(uniqueVotersData).length;

      if (!session) return null;

      const voteCounts = await this.getVoteCounts(postId, chapterId);
      const winningChoice = voteCounts.reduce((prev, current) =>
        current.count > prev.count ? current : prev
      );

      const votingDuration = session.endTime
        ? session.endTime.getTime() - session.startTime.getTime()
        : Date.now() - session.startTime.getTime();

      return {
        totalVotes: parseInt(totalVotes || '0'),
        uniqueVoters: uniqueVoters || 0,
        votingDuration,
        winningChoice: winningChoice.choiceId,
        winningPercentage: winningChoice.percentage,
      };
    } catch (error) {
      console.error('Error getting voting stats:', error);
      return null;
    }
  }

  /**
   * Checks if a user has voted for a specific chapter (optimized with caching)
   */
  static async hasUserVoted(
    postId: string,
    userId: string,
    chapterId: string
  ): Promise<UserVoteStatus> {
    return this.countCircuitBreaker.execute(async () => {
      const stopTimer = PerformanceMonitor.startTimer('voting_check_user_voted');

      try {
        // Use optimized cached lookup
        const result = await RedisOptimizer.getUserVoteStatusOptimized(postId, userId, chapterId);

        // If user has voted, get additional timestamp info
        if (result.hasVoted && result.choiceId) {
          const voteKey = `${this.VOTE_PREFIX}:${postId}:${chapterId}:${userId}`;
          const voteData = await RedisOptimizer.getCached(voteKey, 30000); // 30 second cache

          if (voteData) {
            try {
              const vote = JSON.parse(voteData);
              (result as any).timestamp = new Date(vote.timestamp);
            } catch (error) {
              ErrorLogger.logWarning('Error parsing vote timestamp', {
                postId,
                userId,
                chapterId,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        stopTimer();
        return result;
      } catch (error) {
        stopTimer();
        PerformanceMonitor.recordMetric('voting_check_user_voted', 0, true);
        ErrorLogger.logWarning('Error checking user vote status', {
          postId,
          userId,
          chapterId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return { hasVoted: false };
      }
    });
  }

  /**
   * Creates a new voting session for a chapter
   */
  static async createVotingSession(
    postId: string,
    chapterId: string,
    choices: Array<{ choiceId: string; text: string }>,
    durationMinutes: number = 60
  ): Promise<VotingSession> {
    const sessionKey = `${this.SESSION_PREFIX}:${postId}:${chapterId}`;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const session: VotingSession = {
      chapterId,
      startTime,
      endTime,
      status: 'active',
      totalVotes: 0,
      choices: choices.map((choice) => ({
        choiceId: choice.choiceId,
        text: choice.text,
        voteCount: 0,
        percentage: 0,
      })),
    };

    const sessionData = {
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime ? session.endTime.toISOString() : undefined,
    };

    await redis.set(sessionKey, JSON.stringify(sessionData));
    await redis.expire(sessionKey, 86400); // 24 hours TTL

    return session;
  }

  /**
   * Gets voting session information (cached)
   */
  static async getVotingSessionCached(
    postId: string,
    chapterId: string
  ): Promise<VotingSession | null> {
    const stopTimer = PerformanceMonitor.startTimer('voting_get_session_cached');

    try {
      const sessionKey = `${this.SESSION_PREFIX}:${postId}:${chapterId}`;
      const data = await RedisOptimizer.getCached(sessionKey, 30000); // 30 second cache

      if (!data) {
        stopTimer();
        return null;
      }

      const sessionData = JSON.parse(data);

      const result = {
        ...sessionData,
        startTime: new Date(sessionData.startTime),
        endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
      };

      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('voting_get_session_cached', 0, true);
      ErrorLogger.logWarning('Error getting voting session', {
        postId,
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Gets voting session information (non-cached for backwards compatibility)
   */
  static async getVotingSession(postId: string, chapterId: string): Promise<VotingSession | null> {
    const stopTimer = PerformanceMonitor.startTimer('voting_get_session');

    try {
      const sessionKey = `${this.SESSION_PREFIX}:${postId}:${chapterId}`;
      const data = await redis.get(sessionKey);

      if (!data) {
        stopTimer();
        return null;
      }

      const sessionData = JSON.parse(data);

      const result = {
        ...sessionData,
        startTime: new Date(sessionData.startTime),
        endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
      };

      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('voting_get_session', 0, true);
      ErrorLogger.logWarning('Error getting voting session (non-cached)', {
        postId,
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Ends a voting session and determines the winner
   */
  static async endVotingSession(
    postId: string,
    chapterId: string
  ): Promise<{
    winningChoice: string;
    stats: VotingStats;
  } | null> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}:${postId}:${chapterId}`;
      const session = await this.getVotingSession(postId, chapterId);

      if (!session) return null;

      // Update session status
      const updatedSession = {
        ...session,
        status: 'completed' as const,
        endTime: new Date(),
      };

      const sessionData = {
        ...updatedSession,
        startTime: updatedSession.startTime.toISOString(),
        endTime: updatedSession.endTime ? updatedSession.endTime.toISOString() : undefined,
      };

      await redis.set(sessionKey, JSON.stringify(sessionData));
      await redis.expire(sessionKey, 86400);

      // Get final stats
      const stats = await this.getVotingStats(postId, chapterId);
      if (!stats) return null;

      return {
        winningChoice: stats.winningChoice,
        stats,
      };
    } catch (error) {
      console.error('Error ending voting session:', error);
      return null;
    }
  }

  /**
   * Gets the winning choice for a completed voting session
   */
  static async getWinningChoice(postId: string, chapterId: string): Promise<string | null> {
    try {
      const voteCounts = await this.getVoteCounts(postId, chapterId);
      if (voteCounts.length === 0) return null;

      const winner = voteCounts.reduce((prev, current) =>
        current.count > prev.count ? current : prev
      );

      return winner.choiceId;
    } catch (error) {
      console.error('Error getting winning choice:', error);
      return null;
    }
  }

  /**
   * Gets all votes for a chapter (for debugging/admin purposes)
   * Note: This method is limited since we can't use pattern matching in Devvit Redis
   */
  static async getAllVotes(postId: string, chapterId: string): Promise<Vote[]> {
    try {
      // Since we can't use pattern matching, we'll need to track voters separately
      const uniqueVotersKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:unique_voters`;
      const votersData = await redis.hGetAll(uniqueVotersKey);
      const voterIds = Object.keys(votersData);

      const votes: Vote[] = [];

      for (const userId of voterIds) {
        const voteKey = `${this.VOTE_PREFIX}:${postId}:${chapterId}:${userId}`;
        const data = await redis.get(voteKey);
        if (data) {
          try {
            const voteData = JSON.parse(data);
            votes.push({
              ...voteData,
              timestamp: new Date(voteData.timestamp),
            });
          } catch (error) {
            console.error('Error parsing vote data:', error);
          }
        }
      }

      return votes;
    } catch (error) {
      console.error('Error getting all votes:', error);
      return [];
    }
  }

  /**
   * Removes all voting data for a chapter
   */
  static async clearChapterVotes(postId: string, chapterId: string): Promise<void> {
    try {
      // Get all voters for this chapter
      const uniqueVotersKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:unique_voters`;
      const votersData = await redis.hGetAll(uniqueVotersKey);
      const voterIds = Object.keys(votersData);

      // Delete individual vote records
      for (const userId of voterIds) {
        const voteKey = `${this.VOTE_PREFIX}:${postId}:${chapterId}:${userId}`;
        const userVoteKey = `${this.USER_VOTE_PREFIX}:${postId}:${chapterId}:${userId}`;
        await redis.del(voteKey);
        await redis.del(userVoteKey);
      }

      // Get session to know available choices
      const session = await this.getVotingSession(postId, chapterId);
      if (session) {
        for (const choice of session.choices) {
          const voteCountKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:${choice.choiceId}`;
          await redis.del(voteCountKey);
        }
      }

      // Delete aggregate keys
      const keysToDelete = [
        `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:total`,
        uniqueVotersKey,
        `${this.SESSION_PREFIX}:${postId}:${chapterId}`,
      ];

      for (const key of keysToDelete) {
        await redis.del(key);
      }
    } catch (error) {
      console.error('Error clearing chapter votes:', error);
    }
  }

  /**
   * Removes all voting data for a story
   * Note: This is a simplified version since we can't use pattern matching
   */
  static async clearStoryVotes(_postId: string): Promise<void> {
    try {
      // This method would need to be enhanced to track all chapters for a story
      // For now, we'll provide a basic implementation
      console.warn(
        'clearStoryVotes: Limited implementation - cannot clear all data without chapter tracking'
      );

      // We could implement this by maintaining a set of chapter IDs per story
      // Similar to how we track chapters in the story state manager
    } catch (error) {
      console.error('Error clearing story votes:', error);
    }
  }

  /**
   * Gets voting statistics for the entire story
   * Note: Limited implementation due to Redis pattern matching restrictions
   */
  static async getStoryVotingStats(_postId: string): Promise<{
    totalVotes: number;
    totalChapters: number;
    uniqueParticipants: number;
    averageVotesPerChapter: number;
  }> {
    try {
      // This would need to be enhanced with proper chapter tracking
      // For now, return basic stats
      console.warn('getStoryVotingStats: Limited implementation - requires chapter tracking');

      return {
        totalVotes: 0,
        totalChapters: 0,
        uniqueParticipants: 0,
        averageVotesPerChapter: 0,
      };
    } catch (error) {
      console.error('Error getting story voting stats:', error);
      return {
        totalVotes: 0,
        totalChapters: 0,
        uniqueParticipants: 0,
        averageVotesPerChapter: 0,
      };
    }
  }

  /**
   * Validates voting data integrity
   */
  static async validateVotingData(
    postId: string,
    chapterId: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check if voting session exists
      const session = await this.getVotingSession(postId, chapterId);
      if (!session) {
        errors.push('Voting session not found');
        return { isValid: false, errors };
      }

      // Check vote count consistency
      const voteCounts = await this.getVoteCounts(postId, chapterId);
      const totalVotesKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:total`;
      const storedTotal = parseInt((await redis.get(totalVotesKey)) || '0');
      const calculatedTotal = voteCounts.reduce((sum, count) => sum + count.count, 0);

      if (storedTotal !== calculatedTotal) {
        errors.push(`Vote count mismatch: stored=${storedTotal}, calculated=${calculatedTotal}`);
      }

      // Check unique voters count
      const uniqueVotersKey = `${this.VOTE_COUNT_PREFIX}:${postId}:${chapterId}:unique_voters`;
      const uniqueVotersData = await redis.hGetAll(uniqueVotersKey);
      const uniqueVotersCount = Object.keys(uniqueVotersData).length;

      if (uniqueVotersCount > storedTotal) {
        errors.push(
          `Unique voters count (${uniqueVotersCount}) exceeds total votes (${storedTotal})`
        );
      }
    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
