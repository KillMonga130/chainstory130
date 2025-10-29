/**
 * Optimized realtime message broadcasting for The Haunted Thread
 * Handles post-specific channel management, message throttling, and batching
 */

import { realtime } from '@devvit/web/server';
// Realtime message types are defined inline to avoid serialization issues
import { VoteCount, VotingStats } from '../../shared/types/voting.js';
import { StoryChapter } from '../../shared/types/story.js';
import { ErrorLogger, PerformanceMonitor } from '../utils/error-handler';

// Message throttling and batching utilities
class MessageThrottler {
  private pendingMessages = new Map<
    string,
    {
      message: any;
      timestamp: number;
      timeout: NodeJS.Timeout;
    }
  >();

  private readonly throttleMs: number;
  private readonly maxPendingMessages: number;

  constructor(throttleMs = 1000, maxPendingMessages = 100) {
    this.throttleMs = throttleMs;
    this.maxPendingMessages = maxPendingMessages;
  }

  throttle(key: string, message: any, sendFn: (msg: any) => Promise<void>): void {
    // Clear existing timeout for this key
    const existing = this.pendingMessages.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Prevent memory leaks
    if (this.pendingMessages.size >= this.maxPendingMessages) {
      const oldestKey = this.pendingMessages.keys().next().value;
      if (oldestKey) {
        const oldest = this.pendingMessages.get(oldestKey);
        if (oldest) {
          clearTimeout(oldest.timeout);
          this.pendingMessages.delete(oldestKey);
        }
      }
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      this.pendingMessages.delete(key);
      try {
        await sendFn(message);
      } catch (error) {
        ErrorLogger.logWarning('Throttled message send failed', {
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, this.throttleMs);

    this.pendingMessages.set(key, {
      message,
      timestamp: Date.now(),
      timeout,
    });
  }

  flush(key?: string): void {
    if (key) {
      const pending = this.pendingMessages.get(key);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingMessages.delete(key);
      }
    } else {
      // Flush all
      for (const [, pending] of this.pendingMessages) {
        clearTimeout(pending.timeout);
      }
      this.pendingMessages.clear();
    }
  }

  getPendingCount(): number {
    return this.pendingMessages.size;
  }
}

// Message batching for multiple updates
class MessageBatcher {
  private batches = new Map<
    string,
    {
      messages: any[];
      timeout: NodeJS.Timeout;
    }
  >();

  private readonly batchDelayMs: number;
  private readonly maxBatchSize: number;

  constructor(batchDelayMs = 500, maxBatchSize = 10) {
    this.batchDelayMs = batchDelayMs;
    this.maxBatchSize = maxBatchSize;
  }

  addToBatch(
    batchKey: string,
    message: any,
    sendBatchFn: (messages: any[]) => Promise<void>
  ): void {
    const existing = this.batches.get(batchKey);

    if (existing) {
      existing.messages.push(message);

      // If batch is full, send immediately
      if (existing.messages.length >= this.maxBatchSize) {
        clearTimeout(existing.timeout);
        this.sendBatch(batchKey, sendBatchFn);
      }
    } else {
      // Create new batch
      const timeout = setTimeout(() => {
        this.sendBatch(batchKey, sendBatchFn);
      }, this.batchDelayMs);

      this.batches.set(batchKey, {
        messages: [message],
        timeout,
      });
    }
  }

  private async sendBatch(
    batchKey: string,
    sendBatchFn: (messages: any[]) => Promise<void>
  ): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch) return;

    this.batches.delete(batchKey);
    clearTimeout(batch.timeout);

    try {
      await sendBatchFn(batch.messages);
    } catch (error) {
      ErrorLogger.logWarning('Batch message send failed', {
        batchKey,
        messageCount: batch.messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export class RealtimeManager {
  private static readonly CHANNEL_PREFIX = 'haunted_thread';
  private static readonly voteThrottler = new MessageThrottler(1000); // 1 second throttle for votes
  private static readonly generalThrottler = new MessageThrottler(500); // 500ms for other messages
  private static readonly messageBatcher = new MessageBatcher(300, 5); // 300ms batch delay, max 5 messages

  /**
   * Gets the channel name for a specific post
   */
  private static getChannelName(postId: string): string {
    return `${this.CHANNEL_PREFIX}_${postId}`;
  }

  /**
   * Broadcasts a vote update to all clients connected to the post (throttled)
   */
  static async broadcastVoteUpdate(
    postId: string,
    chapterId: string,
    voteCounts: VoteCount[],
    totalVotes: number
  ): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_vote_update');

    try {
      const channel = this.getChannelName(postId);
      const throttleKey = `vote_update:${postId}:${chapterId}`;

      const message = {
        type: 'vote_update',
        timestamp: new Date().toISOString(),
        data: {
          chapterId,
          voteCounts,
          totalVotes,
        },
      };

      // Throttle vote updates to prevent spam
      this.voteThrottler.throttle(throttleKey, message, async (msg) => {
        await realtime.send(channel, JSON.parse(JSON.stringify(msg)));

        ErrorLogger.logInfo('Vote update broadcasted', {
          channel,
          chapterId,
          totalVotes,
          choiceCount: voteCounts.length,
        });
      });

      stopTimer();
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_vote_update', 0, true);
      ErrorLogger.logWarning('Error broadcasting vote update', {
        postId,
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - realtime failures shouldn't break the voting process
    }
  }

  /**
   * Broadcasts a chapter transition to all clients (immediate, not throttled)
   */
  static async broadcastChapterTransition(
    postId: string,
    newChapter: StoryChapter,
    winningChoice: string,
    previousStats: VotingStats
  ): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_chapter_transition');

    try {
      const channel = this.getChannelName(postId);

      const message = {
        type: 'chapter_transition',
        timestamp: new Date().toISOString(),
        data: {
          newChapter,
          winningChoice,
          previousStats,
        },
      };

      // Chapter transitions are important and should be sent immediately
      await realtime.send(channel, JSON.parse(JSON.stringify(message)));

      stopTimer();
      ErrorLogger.logInfo('Chapter transition broadcasted', {
        channel,
        newChapterId: newChapter.id,
        winningChoice,
        totalVotes: previousStats.totalVotes,
      });
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_chapter_transition', 0, true);
      ErrorLogger.logWarning('Error broadcasting chapter transition', {
        postId,
        newChapterId: newChapter.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Broadcasts a story reset notification (immediate, not throttled)
   */
  static async broadcastStoryReset(
    postId: string,
    reason: string,
    newChapter: StoryChapter
  ): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_story_reset');

    try {
      const channel = this.getChannelName(postId);

      const message = {
        type: 'story_reset',
        timestamp: new Date().toISOString(),
        data: {
          reason,
          newChapter,
        },
      };

      // Story resets are important and should be sent immediately
      await realtime.send(channel, JSON.parse(JSON.stringify(message)));

      stopTimer();
      ErrorLogger.logInfo('Story reset broadcasted', {
        channel,
        reason,
        newChapterId: newChapter.id,
      });
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_story_reset', 0, true);
      ErrorLogger.logWarning('Error broadcasting story reset', {
        postId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets the channel name for client-side connection
   * This is a utility method that clients can use to get the correct channel name
   */
  static getClientChannelName(postId: string): string {
    return this.getChannelName(postId);
  }

  /**
   * Broadcasts voting ended notification (throttled)
   */
  static async broadcastVotingEnded(
    postId: string,
    chapterId: string,
    winningChoice: string,
    finalStats: VotingStats
  ): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_voting_ended');

    try {
      const channel = this.getChannelName(postId);
      const throttleKey = `voting_ended:${postId}:${chapterId}`;

      const message = {
        type: 'voting_ended',
        timestamp: new Date().toISOString(),
        data: {
          chapterId,
          winningChoice,
          finalStats,
        },
      };

      // Throttle to prevent duplicate notifications
      this.generalThrottler.throttle(throttleKey, message, async (msg) => {
        await realtime.send(channel, JSON.parse(JSON.stringify(msg)));

        ErrorLogger.logInfo('Voting ended broadcasted', {
          channel,
          chapterId,
          winningChoice,
          totalVotes: finalStats.totalVotes,
        });
      });

      stopTimer();
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_voting_ended', 0, true);
      ErrorLogger.logWarning('Error broadcasting voting ended', {
        postId,
        chapterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Broadcasts a generic message to the post channel (throttled)
   */
  static async broadcastMessage(postId: string, message: any): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_generic_message');

    try {
      const channel = this.getChannelName(postId);
      const throttleKey = `generic:${postId}:${message.type || 'unknown'}`;

      // Ensure timestamp is serializable
      const serializableMessage = {
        ...message,
        timestamp:
          message.timestamp instanceof Date
            ? message.timestamp.toISOString()
            : message.timestamp || new Date().toISOString(),
      };

      this.generalThrottler.throttle(throttleKey, serializableMessage, async (msg) => {
        await realtime.send(channel, msg);

        ErrorLogger.logInfo('Generic message broadcasted', {
          channel,
          type: msg.type,
          timestamp: msg.timestamp,
        });
      });

      stopTimer();
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_generic_message', 0, true);
      ErrorLogger.logWarning('Error broadcasting generic message', {
        postId,
        messageType: message.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Broadcasts connection status for debugging (throttled)
   */
  static async broadcastConnectionTest(postId: string): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_connection_test');

    try {
      const channel = this.getChannelName(postId);
      const throttleKey = `connection_test:${postId}`;

      const message = {
        type: 'connection_test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Realtime connection is working',
          serverTime: new Date().toISOString(),
        },
      };

      this.generalThrottler.throttle(throttleKey, message, async (msg) => {
        await realtime.send(channel, msg);

        ErrorLogger.logInfo('Connection test broadcasted', { channel });
      });

      stopTimer();
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_connection_test', 0, true);
      ErrorLogger.logWarning('Error broadcasting connection test', {
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validates that realtime is properly configured
   */
  static async validateRealtimeSetup(): Promise<{
    isConfigured: boolean;
    error?: string;
  }> {
    const stopTimer = PerformanceMonitor.startTimer('realtime_validate_setup');

    try {
      // Test sending a message to a test channel
      await realtime.send('test_channel', { test: true });
      stopTimer();
      return { isConfigured: true };
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_validate_setup', 0, true);
      return {
        isConfigured: false,
        error: error instanceof Error ? error.message : 'Unknown realtime error',
      };
    }
  }

  /**
   * Batch broadcast multiple vote updates (for efficiency)
   */
  static async batchBroadcastVoteUpdates(
    postId: string,
    updates: Array<{
      chapterId: string;
      voteCounts: VoteCount[];
      totalVotes: number;
    }>
  ): Promise<void> {
    if (updates.length === 0) return;

    const stopTimer = PerformanceMonitor.startTimer('realtime_batch_vote_updates');

    try {
      const channel = this.getChannelName(postId);
      const batchKey = `vote_updates:${postId}`;

      const messages = updates.map((update) => ({
        type: 'vote_update',
        timestamp: new Date().toISOString(),
        data: update,
      }));

      this.messageBatcher.addToBatch(batchKey, messages, async (batchedMessages) => {
        // Send as a single batched message
        const batchMessage = {
          type: 'vote_update_batch',
          timestamp: new Date().toISOString(),
          data: {
            updates: batchedMessages.flat(),
          },
        };

        await realtime.send(channel, JSON.parse(JSON.stringify(batchMessage)));

        ErrorLogger.logInfo('Batch vote updates broadcasted', {
          channel,
          updateCount: batchedMessages.flat().length,
        });
      });

      stopTimer();
    } catch (error) {
      stopTimer();
      PerformanceMonitor.recordMetric('realtime_batch_vote_updates', 0, true);
      ErrorLogger.logWarning('Error broadcasting batch vote updates', {
        postId,
        updateCount: updates.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get realtime performance statistics
   */
  static getPerformanceStats(): {
    throttler: { pending: number };
    batcher: { pending: number };
    metrics: Record<string, { avgTime: number; count: number; errorRate: number }>;
  } {
    return {
      throttler: {
        pending: this.voteThrottler.getPendingCount() + this.generalThrottler.getPendingCount(),
      },
      batcher: {
        pending: this.messageBatcher['batches'].size,
      },
      metrics: PerformanceMonitor.getMetrics(),
    };
  }

  /**
   * Flush all pending messages (for shutdown or testing)
   */
  static flushPendingMessages(): void {
    this.voteThrottler.flush();
    this.generalThrottler.flush();
    ErrorLogger.logInfo('All pending realtime messages flushed');
  }
}
