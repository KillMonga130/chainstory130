import express from 'express';
import {
  StartGameRequest,
  StartGameResponse,
  MoveMouseRequest,
  MoveMouseResponse,
  GetLeaderboardResponse,
  GameOverRequest,
  GameOverResponse,
} from '../shared/types/game';
import { reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { GameEngine } from './core/game-engine';
import { gameStorage } from './core/game-storage';
import {
  errorHandler,
  asyncHandler,
  validateRequest,
  RateLimiter,
  ErrorLogger,
  ValidationError,
} from './utils/error-handler';

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

// Start a new game
router.post<{}, StartGameResponse | { status: string; message: string }, StartGameRequest>(
  '/api/game/start',
  RateLimiter.middleware(10, 60000), // 10 games per minute
  asyncHandler(async (req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    // Get username if available
    let username: string | undefined;
    try {
      username = await reddit.getCurrentUsername();
    } catch (error) {
      // Username not required, continue without it
      console.log('Could not get username:', error);
    }

    // Create new game
    const { gameState, config } = GameEngine.createNewGame();
    const gameId = gameStorage.createGame(gameState, config, username);

    console.log(`Game started successfully: ${gameId} for user: ${username || 'anonymous'}`);

    ErrorLogger.logInfo('New game started', {
      gameId,
      username: username || 'anonymous',
    });

    res.json({
      gameId,
      gameState,
      config,
    });
  })
);

// Move mouse
router.post<{}, MoveMouseResponse | { status: string; message: string }, MoveMouseRequest>(
  '/api/game/move',
  RateLimiter.middleware(100, 60000), // 100 moves per minute
  validateRequest((req) => {
    const { gameId, direction } = req.body;

    if (!gameId || typeof gameId !== 'string') {
      throw new Error('gameId is required and must be a string');
    }

    if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
      throw new Error('direction must be one of: up, down, left, right');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { gameId, direction } = req.body;

    console.log(`Move request: gameId=${gameId}, direction=${direction}`);

    // Get game session
    const game = gameStorage.getGame(gameId);
    if (!game) {
      console.log(`Game not found: ${gameId}`);
      throw new ValidationError('Game not found or expired');
    }

    console.log(`Game found: ${gameId}, status: ${game.gameState.gameStatus}`);

    // Move mouse and update game state
    const newGameState = GameEngine.moveMouse(game.gameState, game.config, direction);
    
    // Update stored game state
    gameStorage.updateGame(gameId, newGameState);

    let message: string | undefined;
    if (newGameState.gameStatus === 'caught') {
      message = `Game Over! Final score: ${GameEngine.calculateScore(newGameState)}`;
    } else if (newGameState.level > game.gameState.level) {
      message = `Level Up! Welcome to level ${newGameState.level}`;
    }

    res.json({
      gameState: newGameState,
      message,
    });
  })
);

// Get leaderboard
router.get<{}, GetLeaderboardResponse | { status: string; message: string }>(
  '/api/leaderboard',
  async (_req, res): Promise<void> => {
    try {
      const entries = gameStorage.getLeaderboard(10);

      res.set({
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'Vary': 'Accept-Encoding',
      });

      res.json({
        entries,
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

// Submit final score
router.post<{}, GameOverResponse | { status: string; message: string }, GameOverRequest>(
  '/api/game/score',
  RateLimiter.middleware(5, 60000), // 5 score submissions per minute
  validateRequest((req) => {
    const { gameId, finalScore } = req.body;

    if (!gameId || typeof gameId !== 'string') {
      throw new Error('gameId is required and must be a string');
    }

    if (typeof finalScore !== 'number' || finalScore < 0) {
      throw new Error('finalScore must be a non-negative number');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { gameId, finalScore } = req.body;

    // Get game session
    const game = gameStorage.getGame(gameId);
    if (!game) {
      throw new ValidationError('Game not found or expired');
    }

    // Calculate final score
    const calculatedScore = GameEngine.calculateScore(game.gameState);
    const scoreToSubmit = Math.max(finalScore, calculatedScore);

    // Add to leaderboard
    const rank = gameStorage.addScore(
      game.username || 'Anonymous',
      scoreToSubmit,
      game.gameState.level
    );

    // Clean up game session
    gameStorage.deleteGame(gameId);

    let message = `Game Over! You scored ${scoreToSubmit} points.`;
    if (rank <= 10) {
      message += ` You made it to the top 10 leaderboard at rank #${rank}!`;
    }

    ErrorLogger.logInfo('Game completed', {
      gameId,
      username: game.username || 'anonymous',
      finalScore: scoreToSubmit,
      level: game.gameState.level,
      rank,
    });

    res.json({
      rank,
      message,
    });
  })
);

// Health check endpoint
router.get(
  '/api/health',
  asyncHandler(async (_req, res): Promise<void> => {
    const stats = gameStorage.getStats();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      gameStats: stats,
    });
  })
);

// App installation handler
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

// Menu action for creating posts
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

// Use router middleware
app.use(router);

// Error handling middleware (must be last)
app.use(errorHandler);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
