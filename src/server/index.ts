import express from 'express';
import {
  CurrentStoryResponse,
  SubmitSentenceRequest,
  SubmitSentenceResponse,
  LeaderboardResponse,
  ArchiveResponse,
  UserContribution,
  Story,
  validateSentenceLength,
  RealTimeMessage,
  StoryUpdateMessage,
  NewRoundMessage,
  StoryCompleteMessage,
} from '../shared/types/api';
import { reddit, createServer, context, getServerPort, realtime } from '@devvit/web/server';
import { createPost } from './core/post';
import {
  StoryRedisHelper,
  RoundRedisHelper,
  LeaderboardRedisHelper,
  ArchiveRedisHelper,
  UserRedisHelper,
  RedisUtilityHelper,
} from './core/redis-helpers';
import {
  errorHandler,
  asyncHandler,
  validateRequest,
  RateLimiter,
  ErrorLogger,
  ValidationError,
  AuthenticationError,
} from './utils/error-handler';
import { RedditErrorHandler } from './utils/reddit-error-handler';
import { RedisErrorHandler } from './utils/redis-error-handler';

// Real-time messaging helper
class RealTimeHelper {
  private static readonly CHANNEL_NAME = 'story-updates';

  static async broadcastMessage(message: RealTimeMessage): Promise<void> {
    try {
      // Ensure message is JSON-serializable by stringifying and parsing
      const jsonMessage = JSON.parse(JSON.stringify(message));
      await realtime.send(this.CHANNEL_NAME, jsonMessage);
      ErrorLogger.logInfo(`Broadcast ${message.type} message`, {
        channel: this.CHANNEL_NAME,
        messageType: message.type,
      });
    } catch (error) {
      // Log the error but don't throw - real-time is not critical for core functionality
      ErrorLogger.logWarning(`Failed to broadcast ${message.type} message`, {
        channel: this.CHANNEL_NAME,
        messageType: message.type,
        error: (error as Error).message,
      });
    }
  }

  static async broadcastStoryUpdate(
    story: any,
    roundTimeRemaining: number,
    newSentence?:
      | {
          sentence: string;
          roundNumber: number;
          userId: string;
          upvotes: number;
        }
      | undefined
  ): Promise<void> {
    const message: StoryUpdateMessage = {
      type: 'story-update',
      story,
      roundTimeRemaining,
      ...(newSentence && { newSentence }),
    };
    await this.broadcastMessage(message);
  }

  static async broadcastNewRound(
    storyId: string,
    roundNumber: number,
    roundTimeRemaining: number
  ): Promise<void> {
    const message: NewRoundMessage = {
      type: 'new-round',
      storyId,
      roundNumber,
      roundTimeRemaining,
    };
    await this.broadcastMessage(message);
  }

  static async broadcastStoryComplete(completedStory: any, newStory: any): Promise<void> {
    const message: StoryCompleteMessage = {
      type: 'story-complete',
      completedStory,
      newStory,
    };
    await this.broadcastMessage(message);
  }
}

const app = express();

// Performance middleware
app.use((_req, res, next) => {
  // Add security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  });

  // Add performance headers
  res.set('Server-Timing', `total;dur=${Date.now()}`);

  next();
});

// Middleware for JSON body parsing with size limits and error handling
app.use(
  express.json({
    limit: '1mb',
    verify: (_req, _res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (error) {
        throw new ValidationError('Invalid JSON format');
      }
    },
  })
);

// Middleware for URL-encoded body parsing with size limits
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware for plain text body parsing with size limits
app.use(express.text({ limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warning' : 'info';

    if (logLevel === 'warning') {
      ErrorLogger.logWarning(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, {
        statusCode: res.statusCode,
        method: req.method,
        url: req.url,
        duration,
        userAgent: req.headers['user-agent'],
      });
    } else {
      ErrorLogger.logInfo(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, {
        statusCode: res.statusCode,
        duration,
      });
    }
  });

  next();
});

const router = express.Router();

router.get<{}, CurrentStoryResponse | { status: string; message: string }>(
  '/api/story/current',
  RateLimiter.middleware(30, 60000), // 30 requests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    // Set performance-optimized cache headers
    res.set({
      'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
      'Vary': 'Accept-Encoding',
    });

    let story = await StoryRedisHelper.getCurrentStory();

    // Create new story if none exists
    if (!story) {
      story = await StoryRedisHelper.createNewStory();
      // Also create the first round
      await RoundRedisHelper.createNewRound(story.id, story.roundNumber);
      ErrorLogger.logInfo('Created new story and round', {
        storyId: story.id,
        roundNumber: story.roundNumber,
      });
    }

    // Calculate time remaining in current round (assuming hourly rounds)
    const currentRound = await RoundRedisHelper.getCurrentRound();
    const roundTimeRemaining = currentRound
      ? Math.max(0, Math.floor((currentRound.endTime - Date.now()) / 1000))
      : 3600; // Default to 1 hour if no round found

    res.json({
      type: 'current-story',
      story,
      roundTimeRemaining,
    });
  })
);

router.post<
  {},
  SubmitSentenceResponse | { status: string; message: string },
  SubmitSentenceRequest
>(
  '/api/submit-sentence',
  RateLimiter.middleware(5, 60000), // 5 submissions per minute
  validateRequest((req) => {
    const { storyId, roundNumber, sentence } = req.body;

    if (!storyId || typeof storyId !== 'string') {
      throw new Error('storyId is required and must be a string');
    }

    if (!roundNumber || typeof roundNumber !== 'number') {
      throw new Error('roundNumber is required and must be a number');
    }

    if (!sentence || typeof sentence !== 'string') {
      throw new Error('sentence is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      throw new ValidationError('postId is required');
    }

    const { storyId, roundNumber, sentence } = req.body;

    // Validate sentence length
    const validation = validateSentenceLength(sentence);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // Get current user with error handling
    const username = await RedditErrorHandler.safeGetCurrentUsername();
    if (!username) {
      throw new AuthenticationError('User authentication required');
    }

    // Verify story and round are current
    const currentStory = await StoryRedisHelper.getCurrentStory();
    const currentRound = await RoundRedisHelper.getCurrentRound();

    if (!currentStory || currentStory.id !== storyId) {
      throw new ValidationError('Invalid story ID or story no longer active');
    }

    if (!currentRound || currentRound.roundNumber !== roundNumber) {
      throw new ValidationError('Invalid round number or round has ended');
    }

    if (currentStory.status !== 'active') {
      throw new ValidationError('Story is no longer accepting submissions');
    }

    // Post as Reddit comment with round format and error handling
    const commentBody = `[Round ${roundNumber}] ${sentence.trim()}`;
    const commentResult = await RedditErrorHandler.safeSubmitComment(postId, commentBody);

    // Store submission in Redis
    const submission = {
      commentId: commentResult.id,
      sentence: sentence.trim(),
      upvotes: 1, // Comments start with 1 upvote
      userId: username,
      timestamp: Date.now(),
    };

    await RoundRedisHelper.addSubmissionToRound(submission);

    // Track user submission for contribution history
    await UserRedisHelper.trackUserSubmission(username, storyId, roundNumber, sentence.trim());

    ErrorLogger.logInfo('Sentence submitted successfully', {
      storyId,
      roundNumber,
      userId: username,
      commentId: commentResult.id,
      fallbackUsed: commentResult.fallbackUsed,
    });

    res.json({
      type: 'submit-sentence',
      success: true,
      message: commentResult.fallbackUsed
        ? 'Submitted with fallback text! Your sentence is being voted on'
        : 'Submitted! Your sentence is being voted on',
      commentId: commentResult.id,
    });
  })
);

router.get<{}, LeaderboardResponse | { status: string; message: string }>(
  '/api/leaderboard/top-10',
  async (_req, res): Promise<void> => {
    try {
      // Get leaderboard with caching (10-minute TTL handled in Redis helper)
      const stories = await LeaderboardRedisHelper.getTopLeaderboard();

      // Set optimized cache headers for client-side caching (10 minutes)
      res.set({
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
        'Vary': 'Accept-Encoding',
        'ETag': `leaderboard-${stories.length}-${Date.now()}`,
      });

      res.json({
        type: 'leaderboard',
        stories,
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get leaderboard',
      });
    }
  }
);

router.get<{}, ArchiveResponse | { status: string; message: string }>(
  '/api/archive/stories',
  async (req, res): Promise<void> => {
    try {
      // Parse query parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const sort = (req.query.sort as string) === 'votes' ? 'votes' : 'date';

      // Get paginated archived stories
      const result = await ArchiveRedisHelper.getArchivedStories(page, limit, sort);

      // Set optimized cache headers for client-side caching (5 minutes for archive)
      res.set({
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Vary': 'Accept-Encoding',
        'ETag': `archive-${page}-${sort}-${result.stories.length}`,
      });

      res.json({
        type: 'archive',
        stories: result.stories,
        totalPages: result.totalPages,
        currentPage: page,
      });
    } catch (error) {
      console.error('Error getting archive:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get archive',
      });
    }
  }
);

router.get<{}, UserContribution | { status: string; message: string }>(
  '/api/user/contributions',
  async (_req, res): Promise<void> => {
    try {
      // Get current user
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(401).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      // Get user contributions
      const contributions = await UserRedisHelper.getUserContributions(username);

      if (!contributions) {
        // Return empty contribution record for new users
        const emptyContributions: UserContribution = {
          userId: username,
          submissions: [],
          totalSubmissions: 0,
          totalWins: 0,
          totalUpvotes: 0,
        };

        res.json(emptyContributions);
        return;
      }

      // Set cache headers for client-side caching (1 minute)
      res.set('Cache-Control', 'public, max-age=60');

      res.json(contributions);
    } catch (error) {
      console.error('Error getting user contributions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get user contributions',
      });
    }
  }
);

router.get<
  {},
  | { stories: Story[]; totalPages: number; currentPage: number }
  | { status: string; message: string }
>('/api/user/stories', async (req, res): Promise<void> => {
  try {
    // Get current user
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(401).json({
        status: 'error',
        message: 'User authentication required',
      });
      return;
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

    // Get stories the user contributed to
    const result = await UserRedisHelper.getUserStories(username, page, limit);

    // Set cache headers for client-side caching (1 minute)
    res.set('Cache-Control', 'public, max-age=60');

    res.json({
      stories: result.stories,
      totalPages: result.totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error('Error getting user stories:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user stories',
    });
  }
});

router.get<{}, { stats: any } | { status: string; message: string }>(
  '/api/user/stats',
  async (_req, res): Promise<void> => {
    try {
      // Get current user
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(401).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      // Get user statistics
      const stats = await UserRedisHelper.getUserStats(username);

      if (!stats) {
        // Return empty stats for new users
        const emptyStats = {
          totalSubmissions: 0,
          totalWins: 0,
          totalUpvotes: 0,
          winRate: 0,
          averageUpvotes: 0,
          storiesContributedTo: 0,
        };

        res.json({ stats: emptyStats });
        return;
      }

      // Set cache headers for client-side caching (1 minute)
      res.set('Cache-Control', 'public, max-age=60');

      res.json({ stats });
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get user stats',
      });
    }
  }
);

// Health check endpoint
router.get(
  '/api/health',
  asyncHandler(async (_req, res): Promise<void> => {
    const healthChecks = {
      redis: await RedisErrorHandler.checkConnection(),
      reddit: await RedditErrorHandler.checkApiHealth(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    const isHealthy = healthChecks.redis && healthChecks.reddit.healthy;
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks: healthChecks,
    });
  })
);

// Real-time channel connection endpoint
router.get(
  '/api/realtime/connect',
  asyncHandler(async (_req, res): Promise<void> => {
    // Subscribe user to the story-updates channel
    const channelName = 'story-updates';

    // Get current story to send initial state
    const currentStory = await StoryRedisHelper.getCurrentStory();
    const currentRound = await RoundRedisHelper.getCurrentRound();

    const roundTimeRemaining = currentRound
      ? Math.max(0, Math.floor((currentRound.endTime - Date.now()) / 1000))
      : 3600;

    res.json({
      status: 'success',
      message: 'Connected to real-time updates',
      channelName,
      initialState: {
        story: currentStory,
        roundTimeRemaining,
      },
    });
  })
);

router.post(
  '/internal/on-app-install',
  asyncHandler(async (_req, res): Promise<void> => {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  })
);

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/scheduler/hourly-round', async (_req, res): Promise<void> => {
  try {
    console.log('Hourly round resolution job triggered at', new Date().toISOString());

    const { postId } = context;
    if (!postId) {
      console.error('No postId found in context for hourly round resolution');
      res.status(400).json({
        status: 'error',
        message: 'postId required for round resolution',
      });
      return;
    }

    // Get current story and round
    const currentStory = await StoryRedisHelper.getCurrentStory();
    const currentRound = await RoundRedisHelper.getCurrentRound();

    if (!currentStory || currentStory.status !== 'active') {
      console.log('No active story found, skipping round resolution');
      res.json({
        status: 'success',
        message: 'No active story to resolve',
      });
      return;
    }

    if (!currentRound) {
      console.log('No current round found, creating new round');
      await RoundRedisHelper.createNewRound(currentStory.id, currentStory.roundNumber);
      res.json({
        status: 'success',
        message: 'Created new round, no resolution needed',
      });
      return;
    }

    // Fetch comments from the past hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const comments = await reddit
      .getComments({
        postId,
        limit: 100,
        sort: 'new',
      })
      .all();

    // Filter comments that match the current round format and are from the past hour
    const roundPattern = new RegExp(`^\\[Round ${currentRound.roundNumber}\\]\\s+(.+)$`);
    const validSubmissions: Array<{
      commentId: string;
      sentence: string;
      upvotes: number;
      userId: string;
      timestamp: number;
    }> = [];

    for (const comment of comments) {
      // Check if comment is from the past hour
      const commentTime = new Date(comment.createdAt).getTime();
      if (commentTime < oneHourAgo) continue;

      // Check if comment matches round format
      if (!comment.body) continue;
      const match = comment.body.match(roundPattern);
      if (!match || !match[1]) continue;

      const sentence = match[1].trim();

      // Validate sentence length
      const validation = validateSentenceLength(sentence);
      if (!validation.valid) continue;

      validSubmissions.push({
        commentId: comment.id,
        sentence,
        upvotes: comment.score,
        userId: comment.authorName || 'anonymous',
        timestamp: commentTime,
      });
    }

    let winningSubmission = null;
    let fallbackUsed = false;

    if (validSubmissions.length === 0) {
      // No submissions found, use fallback sentence
      console.log('No valid submissions found, using fallback sentence');
      winningSubmission = {
        commentId: 'fallback',
        sentence: 'The silence grew...',
        upvotes: 0,
        userId: 'system',
        timestamp: Date.now(),
      };
      fallbackUsed = true;
    } else {
      // Find highest-voted submission (ties broken by earliest submission)
      winningSubmission = validSubmissions.reduce((best, current) => {
        if (current.upvotes > best.upvotes) return current;
        if (current.upvotes === best.upvotes && current.timestamp < best.timestamp) return current;
        return best;
      });
    }

    // Add winning sentence to story
    const updatedStory = await StoryRedisHelper.addSentenceToStory(
      winningSubmission.sentence,
      winningSubmission.userId,
      winningSubmission.upvotes
    );

    if (!updatedStory) {
      throw new Error('Failed to update story with winning sentence');
    }

    // Broadcast story update with new sentence
    const newRoundTimeRemaining = 3600; // 1 hour for next round
    await RealTimeHelper.broadcastStoryUpdate(updatedStory, newRoundTimeRemaining, {
      sentence: winningSubmission.sentence,
      roundNumber: currentRound.roundNumber,
      userId: winningSubmission.userId,
      upvotes: winningSubmission.upvotes,
    });

    // Complete the current round
    await RoundRedisHelper.completeRound({
      commentId: winningSubmission.commentId,
      sentence: winningSubmission.sentence,
      upvotes: winningSubmission.upvotes,
      userId: winningSubmission.userId,
    });

    // Track user contribution if not fallback
    if (!fallbackUsed) {
      await UserRedisHelper.addUserSubmission(
        winningSubmission.userId,
        updatedStory.id,
        currentRound.roundNumber,
        winningSubmission.sentence,
        winningSubmission.upvotes,
        true // wasWinner
      );
    }

    // Check if story is completed
    if (updatedStory.status === 'completed') {
      console.log(
        `Story ${updatedStory.id} completed with ${updatedStory.sentences.length} sentences`
      );

      // Archive the completed story
      await StoryRedisHelper.archiveStory(updatedStory);

      // Update leaderboard
      await LeaderboardRedisHelper.updateLeaderboard(updatedStory);

      // Create new story for next cycle
      const newStory = await StoryRedisHelper.createNewStory();
      await RoundRedisHelper.createNewRound(newStory.id, newStory.roundNumber);

      console.log(`New story ${newStory.id} created to replace completed story`);

      // Broadcast story completion
      await RealTimeHelper.broadcastStoryComplete(updatedStory, newStory);

      res.json({
        status: 'success',
        message: `Round resolved. Story completed and archived. New story created.`,
        details: {
          completedStoryId: updatedStory.id,
          newStoryId: newStory.id,
          winningSentence: winningSubmission.sentence,
          fallbackUsed,
          totalSubmissions: validSubmissions.length,
        },
      });
    } else {
      // Create next round
      await RoundRedisHelper.createNewRound(updatedStory.id, updatedStory.roundNumber);

      // Broadcast new round start
      await RealTimeHelper.broadcastNewRound(
        updatedStory.id,
        updatedStory.roundNumber,
        3600 // 1 hour for next round
      );

      res.json({
        status: 'success',
        message: `Round ${currentRound.roundNumber} resolved successfully`,
        details: {
          storyId: updatedStory.id,
          currentRound: updatedStory.roundNumber,
          winningSentence: winningSubmission.sentence,
          fallbackUsed,
          totalSubmissions: validSubmissions.length,
          sentencesRemaining: 100 - updatedStory.sentences.length,
        },
      });
    }
  } catch (error) {
    console.error(`Error in hourly round resolution: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve hourly round',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/internal/scheduler/daily-maintenance', async (_req, res): Promise<void> => {
  try {
    console.log('Daily maintenance job triggered at', new Date().toISOString());

    const maintenanceResults = {
      storiesChecked: 0,
      leaderboardUpdated: false,
      tempDataCleaned: false,
      statsLogged: false,
      newStoryCreated: false,
      errors: [] as string[],
    };

    // 1. Check current story status and ensure new story exists if needed
    try {
      const currentStory = await StoryRedisHelper.getCurrentStory();
      maintenanceResults.storiesChecked = 1;

      if (!currentStory) {
        // No current story exists, create one
        const newStory = await StoryRedisHelper.createNewStory();
        await RoundRedisHelper.createNewRound(newStory.id, newStory.roundNumber);
        maintenanceResults.newStoryCreated = true;
        console.log(`Created new story ${newStory.id} during daily maintenance`);

        // Broadcast new round start
        await RealTimeHelper.broadcastNewRound(
          newStory.id,
          newStory.roundNumber,
          3600 // 1 hour for first round
        );
      } else if (currentStory.status === 'completed') {
        // Current story is completed but not archived (edge case)
        await StoryRedisHelper.archiveStory(currentStory);
        await LeaderboardRedisHelper.updateLeaderboard(currentStory);

        // Create new story
        const newStory = await StoryRedisHelper.createNewStory();
        await RoundRedisHelper.createNewRound(newStory.id, newStory.roundNumber);
        maintenanceResults.newStoryCreated = true;
        console.log(
          `Archived completed story ${currentStory.id} and created new story ${newStory.id}`
        );

        // Broadcast story completion during maintenance
        await RealTimeHelper.broadcastStoryComplete(currentStory, newStory);
      }
    } catch (error) {
      const errorMsg = `Error checking story status: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      maintenanceResults.errors.push(errorMsg);
    }

    // 2. Update leaderboard rankings (refresh cache)
    try {
      // The leaderboard is updated when stories complete, but we can refresh the cache
      // by getting the current leaderboard (this validates the data structure)
      const leaderboard = await LeaderboardRedisHelper.getTopLeaderboard();
      maintenanceResults.leaderboardUpdated = true;
      console.log(`Leaderboard maintenance completed, ${leaderboard.length} entries found`);
    } catch (error) {
      const errorMsg = `Error updating leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      maintenanceResults.errors.push(errorMsg);
    }

    // 3. Clean up temporary Redis data
    try {
      await RedisUtilityHelper.cleanupTempData();
      maintenanceResults.tempDataCleaned = true;
      console.log('Temporary data cleanup completed');
    } catch (error) {
      const errorMsg = `Error cleaning temp data: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      maintenanceResults.errors.push(errorMsg);
    }

    // 4. Log daily statistics
    try {
      const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (!yesterdayDate) {
        throw new Error('Failed to generate yesterday date string');
      }
      const yesterday = yesterdayDate;

      // Get current leaderboard to count completed stories
      const leaderboard = await LeaderboardRedisHelper.getTopLeaderboard();

      // Create daily stats (simplified version - in a real implementation,
      // we'd track these metrics throughout the day)
      const dailyStats = {
        date: yesterday,
        storiesCompleted: 0, // Would need to track this during the day
        totalSubmissions: 0, // Would need to track this during the day
        uniqueContributors: 0, // Would need to track this during the day
        totalUpvotes: 0, // Would need to track this during the day
        leaderboardEntries: leaderboard.length,
        maintenanceRun: new Date().toISOString(),
      };

      await RedisUtilityHelper.updateDailyStats(yesterday, dailyStats);
      maintenanceResults.statsLogged = true;
      console.log(`Daily statistics logged for ${yesterday}`);
    } catch (error) {
      const errorMsg = `Error logging daily stats: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      maintenanceResults.errors.push(errorMsg);
    }

    // Return results
    const hasErrors = maintenanceResults.errors.length > 0;
    const statusCode = hasErrors ? 207 : 200; // 207 Multi-Status for partial success

    res.status(statusCode).json({
      status: hasErrors ? 'partial_success' : 'success',
      message: hasErrors
        ? `Daily maintenance completed with ${maintenanceResults.errors.length} errors`
        : 'Daily maintenance completed successfully',
      results: maintenanceResults,
    });
  } catch (error) {
    console.error(`Critical error in daily maintenance: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete daily maintenance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Use router middleware
app.use(router);

// Error handling middleware (must be last)
app.use(errorHandler);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
