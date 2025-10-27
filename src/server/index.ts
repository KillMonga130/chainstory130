import express from 'express';
import { 
  CurrentStoryResponse, 
  SubmitSentenceRequest, 
  SubmitSentenceResponse,
  LeaderboardResponse,
  ArchiveResponse,
  validateSentenceLength
} from '../shared/types/api';
import { reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { 
  StoryRedisHelper, 
  RoundRedisHelper, 
  LeaderboardRedisHelper 
} from './core/redis-helpers';

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
    console.log('Hourly round resolution job triggered');
    // TODO: Implement hourly round resolution logic in future tasks
    // This will fetch comments from the past hour, find the highest-voted sentence,
    // and append it to the current story
    
    res.json({
      status: 'success',
      message: 'Hourly round resolution completed',
    });
  } catch (error) {
    console.error(`Error in hourly round resolution: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve hourly round',
    });
  }
});

router.post('/internal/scheduler/daily-maintenance', async (_req, res): Promise<void> => {
  try {
    console.log('Daily maintenance job triggered');
    // TODO: Implement daily maintenance logic in future tasks
    // This will archive completed stories, update leaderboards, and clean up Redis data
    
    res.json({
      status: 'success',
      message: 'Daily maintenance completed',
    });
  } catch (error) {
    console.error(`Error in daily maintenance: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete daily maintenance',
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
