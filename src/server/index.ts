import express from 'express';
import { 
  CurrentStoryResponse, 
  SubmitSentenceRequest, 
  SubmitSentenceResponse,
  LeaderboardResponse,
  ArchiveResponse,
  validateSentenceLength,
  RealTimeMessage,
  StoryUpdateMessage,
  NewRoundMessage,
  StoryCompleteMessage
} from '../shared/types/api';
import { reddit, createServer, context, getServerPort, realtime } from '@devvit/web/server';
import { createPost } from './core/post';
import { 
  StoryRedisHelper, 
  RoundRedisHelper, 
  LeaderboardRedisHelper,
  UserRedisHelper,
  RedisUtilityHelper 
} from './core/redis-helpers';

// Real-time messaging helper
class RealTimeHelper {
  private static readonly CHANNEL_NAME = 'story-updates';

  static async broadcastMessage(message: RealTimeMessage): Promise<void> {
    try {
      // Ensure message is JSON-serializable by stringifying and parsing
      const jsonMessage = JSON.parse(JSON.stringify(message));
      await realtime.send(this.CHANNEL_NAME, jsonMessage);
      console.log(`Broadcast ${message.type} message to ${this.CHANNEL_NAME} channel`);
    } catch (error) {
      console.error(`Failed to broadcast ${message.type} message:`, error);
      // Log the error but don't throw - real-time is not critical for core functionality
      // The game should continue to work even if real-time updates fail
      if (error instanceof Error) {
        console.error(`Real-time error details: ${error.message}`);
      }
    }
  }

  static async broadcastStoryUpdate(
    story: any, 
    roundTimeRemaining: number, 
    newSentence?: {
      sentence: string;
      roundNumber: number;
      userId: string;
      upvotes: number;
    } | undefined
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

  static async broadcastStoryComplete(
    completedStory: any, 
    newStory: any
  ): Promise<void> {
    const message: StoryCompleteMessage = {
      type: 'story-complete',
      completedStory,
      newStory,
    };
    await this.broadcastMessage(message);
  }
}

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{}, CurrentStoryResponse | { status: string; message: string }>(
  '/api/story/current',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Current Story Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      let story = await StoryRedisHelper.getCurrentStory();
      
      // Create new story if none exists
      if (!story) {
        story = await StoryRedisHelper.createNewStory();
        // Also create the first round
        await RoundRedisHelper.createNewRound(story.id, story.roundNumber);
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
    } catch (error) {
      console.error(`API Current Story Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error getting current story';
      if (error instanceof Error) {
        errorMessage = `Failed to get current story: ${error.message}`;
      }
      res.status(500).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{}, SubmitSentenceResponse | { status: string; message: string }, SubmitSentenceRequest>(
  '/api/submit-sentence',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { storyId, roundNumber, sentence } = req.body;
      
      if (!storyId || !roundNumber || !sentence) {
        res.status(400).json({
          status: 'error',
          message: 'storyId, roundNumber, and sentence are required',
        });
        return;
      }

      // Validate sentence length
      const validation = validateSentenceLength(sentence);
      if (!validation.valid) {
        res.status(400).json({
          status: 'error',
          message: validation.error!,
        });
        return;
      }

      // Get current user
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(401).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      // Verify story and round are current
      const currentStory = await StoryRedisHelper.getCurrentStory();
      const currentRound = await RoundRedisHelper.getCurrentRound();
      
      if (!currentStory || currentStory.id !== storyId) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid story ID or story no longer active',
        });
        return;
      }

      if (!currentRound || currentRound.roundNumber !== roundNumber) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid round number or round has ended',
        });
        return;
      }

      if (currentStory.status !== 'active') {
        res.status(400).json({
          status: 'error',
          message: 'Story is no longer accepting submissions',
        });
        return;
      }

      // Post as Reddit comment with round format
      const commentBody = `[Round ${roundNumber}] ${sentence.trim()}`;
      const comment = await reddit.submitComment({
        id: postId,
        text: commentBody,
      });

      // Store submission in Redis
      const submission = {
        commentId: comment.id,
        sentence: sentence.trim(),
        upvotes: 1, // Comments start with 1 upvote
        userId: username,
        timestamp: Date.now(),
      };

      await RoundRedisHelper.addSubmissionToRound(submission);

      // Note: We don't broadcast individual submissions as they need to be voted on first
      // Real-time updates will be sent when the round resolves and a winner is selected

      res.json({
        type: 'submit-sentence',
        success: true,
        message: 'Submitted! Your sentence is being voted on',
        commentId: comment.id,
      });
    } catch (error) {
      console.error(`Error submitting sentence:`, error);
      let errorMessage = 'Failed to submit sentence';
      if (error instanceof Error) {
        errorMessage = `Submission failed: ${error.message}`;
      }
      res.status(500).json({ 
        type: 'submit-sentence',
        success: false,
        message: errorMessage 
      });
    }
  }
);

router.get<{}, LeaderboardResponse | { status: string; message: string }>(
  '/api/leaderboard/top-10',
  async (_req, res): Promise<void> => {
    try {
      const stories = await LeaderboardRedisHelper.getTopLeaderboard();
      
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
      // For now, return empty archive - this will be implemented in future tasks
      // when we have archived stories to display
      const page = parseInt(req.query.page as string) || 1;
      
      res.json({
        type: 'archive',
        stories: [],
        totalPages: 0,
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

// Real-time channel connection endpoint
router.get('/api/realtime/connect', async (_req, res): Promise<void> => {
  try {
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
  } catch (error) {
    console.error('Error connecting to real-time channel:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to real-time updates',
    });
  }
});

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

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
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const comments = await reddit.getComments({
      postId,
      limit: 100,
      sort: 'new',
    }).all();

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
    await RealTimeHelper.broadcastStoryUpdate(
      updatedStory,
      newRoundTimeRemaining,
      {
        sentence: winningSubmission.sentence,
        roundNumber: currentRound.roundNumber,
        userId: winningSubmission.userId,
        upvotes: winningSubmission.upvotes,
      }
    );

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
      console.log(`Story ${updatedStory.id} completed with ${updatedStory.sentences.length} sentences`);
      
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
        console.log(`Archived completed story ${currentStory.id} and created new story ${newStory.id}`);
        
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

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
