import express from 'express';
import {
  CastVoteRequest,
  CastVoteResponse,
  GetVoteCountsResponse,
  GetVoteStatusResponse,
} from '../shared/types/api';
import { reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { VotingManager } from './core/voting-manager.js';
import { RealtimeManager } from './core/realtime-manager.js';
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

// ===== VOTING SYSTEM ENDPOINTS =====

// Cast a vote for a story choice
router.post<{}, CastVoteResponse, CastVoteRequest>(
  '/api/vote',
  RateLimiter.middleware(20, 60000), // 20 votes per minute
  validateRequest((req) => {
    const { chapterId, choiceId } = req.body;

    if (!chapterId || typeof chapterId !== 'string') {
      throw new Error('chapterId is required and must be a string');
    }

    if (!choiceId || typeof choiceId !== 'string') {
      throw new Error('choiceId is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { chapterId, choiceId } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    // Get user ID from Reddit context
    let userId: string;
    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        throw new ValidationError('User authentication required');
      }
      userId = username;
    } catch (error) {
      throw new ValidationError('Failed to authenticate user');
    }

    console.log(
      `Vote request: postId=${postId}, chapterId=${chapterId}, choiceId=${choiceId}, userId=${userId}`
    );

    // Check if voting session exists and is active
    const votingSession = await VotingManager.getVotingSession(postId!, chapterId);
    console.log('Voting session check:', {
      sessionExists: !!votingSession,
      status: votingSession?.status,
      chapterId,
    });

    // Cast vote using VotingManager
    const result = await VotingManager.castVote(postId!, userId, chapterId, choiceId);

    if (result.success) {
      ErrorLogger.logInfo('Vote cast successfully', {
        postId,
        chapterId,
        choiceId,
        userId,
        voteCount: result.voteCount,
      });

      // Broadcast vote update to all connected clients
      try {
        const voteCounts = await VotingManager.getVoteCounts(postId!, chapterId);
        const totalVotes = voteCounts.reduce((sum, count) => sum + count.count, 0);

        await RealtimeManager.broadcastVoteUpdate(postId!, chapterId, voteCounts, totalVotes);
      } catch (broadcastError) {
        // Log but don't fail the vote - realtime is not critical
        ErrorLogger.logWarning('Failed to broadcast vote update', {
          postId,
          chapterId,
          error: broadcastError instanceof Error ? broadcastError.message : 'Unknown error',
        });
      }
    } else {
      ErrorLogger.logWarning('Vote casting failed', {
        postId,
        chapterId,
        choiceId,
        userId,
        reason: result.message,
      });
    }

    res.json({
      success: result.success,
      data: result,
      ...(result.success ? {} : { error: result.message }),
    });
  })
);

// Get vote counts for a chapter
router.get<{ chapterId: string }, GetVoteCountsResponse>(
  '/api/vote/counts/:chapterId',
  RateLimiter.middleware(60, 60000), // 60 requests per minute
  validateRequest((req) => {
    const { chapterId } = req.params;

    if (!chapterId || typeof chapterId !== 'string') {
      throw new Error('chapterId is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { chapterId } = req.params;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Vote counts request: postId=${postId}, chapterId=${chapterId}`);

    // Get vote counts using VotingManager
    const voteCounts = await VotingManager.getVoteCounts(postId as string, chapterId as string);

    // Set cache headers for vote count data
    res.set({
      'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
      'Vary': 'Accept-Encoding',
    });

    res.json({
      success: true,
      data: voteCounts,
    });
  })
);

// Check if user has voted for a chapter
router.get<{ chapterId: string }, GetVoteStatusResponse>(
  '/api/vote/status/:chapterId',
  RateLimiter.middleware(60, 60000), // 60 requests per minute
  validateRequest((req) => {
    const { chapterId } = req.params;

    if (!chapterId || typeof chapterId !== 'string') {
      throw new Error('chapterId is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { chapterId } = req.params;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    // Get user ID from Reddit context
    let userId: string;
    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        // Return not voted status for unauthenticated users
        res.json({
          success: true,
          data: { hasVoted: false },
        });
        return;
      }
      userId = username;
    } catch (error) {
      // Return not voted status if authentication fails
      res.json({
        success: true,
        data: { hasVoted: false },
      });
      return;
    }

    console.log(`Vote status request: postId=${postId}, chapterId=${chapterId}, userId=${userId}`);

    // Check user vote status using VotingManager
    const voteStatus = await VotingManager.hasUserVoted(
      postId as string,
      userId,
      chapterId as string
    );

    // Set cache headers for user-specific data
    res.set({
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=20',
    });

    res.json({
      success: true,
      data: voteStatus,
    });
  })
);

// Get realtime channel name for client connection
router.get(
  '/api/realtime/channel',
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    const channelName = RealtimeManager.getClientChannelName(postId);

    res.json({
      success: true,
      data: {
        channelName,
        postId,
      },
    });
  })
);

// Test realtime connection (for debugging)
router.post(
  '/api/realtime/test',
  RateLimiter.middleware(5, 60000), // 5 tests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    // Validate realtime setup
    const validation = await RealtimeManager.validateRealtimeSetup();
    if (!validation.isConfigured) {
      res.status(500).json({
        success: false,
        error: `Realtime not configured: ${validation.error}`,
      });
      return;
    }

    // Send test message
    await RealtimeManager.broadcastConnectionTest(postId);

    res.json({
      success: true,
      data: {
        message: 'Test message sent to realtime channel',
        channelName: RealtimeManager.getClientChannelName(postId),
        timestamp: new Date().toISOString(),
      },
    });
  })
);

// ===== PERFORMANCE MONITORING ENDPOINTS =====

// Get performance metrics (admin only)
router.get(
  '/api/admin/performance',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const adminKey = req.query.adminKey as string;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey query parameter is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const adminKey = req.query.adminKey as string;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin performance metrics request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    if (!AdminManager.validateAdminKey(adminKey)) {
      throw new ValidationError('Invalid admin credentials');
    }

    // Get performance metrics
    const { PerformanceMonitor } = await import('./utils/error-handler');
    const { RedisOptimizer } = await import('./utils/redis-optimizer');
    const { RealtimeManager } = await import('./core/realtime-manager');

    const metrics = {
      server: PerformanceMonitor.getMetrics(),
      redis: RedisOptimizer.getCacheStats(),
      realtime: RealtimeManager.getPerformanceStats(),
      timestamp: new Date().toISOString(),
    };

    // Set cache headers for admin data
    res.set({
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=20',
    });

    res.json({
      success: true,
      data: metrics,
    });
  })
);

// Clear performance metrics (admin only)
router.post(
  '/api/admin/performance/clear',
  RateLimiter.middleware(5, 300000), // 5 requests per 5 minutes
  validateRequest((req) => {
    const { adminKey } = req.body;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { adminKey } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin clear performance metrics request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    if (!AdminManager.validateAdminKey(adminKey)) {
      throw new ValidationError('Invalid admin credentials');
    }

    // Clear performance metrics
    const { PerformanceMonitor } = await import('./utils/error-handler');
    const { RedisOptimizer } = await import('./utils/redis-optimizer');
    const { RealtimeManager } = await import('./core/realtime-manager');

    PerformanceMonitor.clearMetrics();
    RedisOptimizer.clearAllCaches();
    RealtimeManager.flushPendingMessages();

    ErrorLogger.logInfo('Performance metrics cleared by admin', { postId });

    res.json({
      success: true,
      message: 'Performance metrics cleared successfully',
    });
  })
);

// Health check endpoint
router.get(
  '/api/health',
  RateLimiter.middleware(30, 60000), // 30 requests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    const healthChecks: {
      server: { healthy: boolean; timestamp: string };
      redis: { healthy: boolean; error?: string };
      realtime: { healthy: boolean; error?: string };
    } = {
      server: { healthy: true, timestamp: new Date().toISOString() },
      redis: { healthy: true },
      realtime: { healthy: true },
    };

    try {
      // Check Redis health
      const { HealthChecker } = await import('./utils/error-handler');
      healthChecks.redis = await HealthChecker.checkRedisHealth();

      // Check realtime health
      const { RealtimeManager } = await import('./core/realtime-manager');
      const realtimeCheck = await RealtimeManager.validateRealtimeSetup();
      healthChecks.realtime = {
        healthy: realtimeCheck.isConfigured,
        ...(realtimeCheck.error && { error: realtimeCheck.error }),
      };
    } catch (error) {
      healthChecks.server.healthy = false;
      ErrorLogger.logWarning('Health check failed', {
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const overallHealthy = Object.values(healthChecks).every((check) => check.healthy);
    const statusCode = overallHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: overallHealthy,
      data: {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        checks: healthChecks,
        postId,
      },
    });
  })
);

// ===== ADMINISTRATIVE ENDPOINTS =====

// Manual story advancement (admin only)
router.post(
  '/api/admin/advance',
  RateLimiter.middleware(5, 300000), // 5 requests per 5 minutes
  validateRequest((req) => {
    const { adminKey } = req.body;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { adminKey, forceChoice, reason } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin advance story request: postId=${postId}, forceChoice=${forceChoice}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    const result = await AdminManager.advanceStory(postId, adminKey, forceChoice, reason);

    if (result.success) {
      ErrorLogger.logInfo('Story advanced by admin', {
        postId,
        newChapter: result.newChapter?.id,
        forceChoice: !!forceChoice,
      });
    } else {
      ErrorLogger.logWarning('Admin story advancement failed', {
        postId,
        error: result.error,
      });
    }

    res.json({
      success: result.success,
      data: result.success
        ? {
            newChapter: result.newChapter,
            previousStats: result.previousStats,
          }
        : undefined,
      error: result.error,
    });
  })
);

// Reset story to beginning (admin only)
router.post(
  '/api/admin/reset',
  RateLimiter.middleware(2, 300000), // 2 requests per 5 minutes
  validateRequest((req) => {
    const { adminKey } = req.body;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { adminKey, reason } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin reset story request: postId=${postId}, reason=${reason}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    const result = await AdminManager.resetStory(postId, adminKey, reason);

    if (result.success) {
      ErrorLogger.logInfo('Story reset by admin', {
        postId,
        reason: reason || 'No reason provided',
      });
    } else {
      ErrorLogger.logWarning('Admin story reset failed', {
        postId,
        error: result.error,
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Story reset successfully' : result.error,
    });
  })
);

// Get story statistics (admin only)
router.get(
  '/api/admin/stats',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const adminKey = req.query.adminKey as string;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey query parameter is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const adminKey = req.query.adminKey as string;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin stats request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    const result = await AdminManager.getStoryStats(postId, adminKey);

    if (result.success) {
      // Set cache headers for admin data
      res.set({
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      });
    }

    res.json({
      success: result.success,
      data: result.stats,
      error: result.error,
    });
  })
);

// Flag content for moderation (admin only)
router.post(
  '/api/admin/moderate',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const { adminKey, action, targetType, targetId } = req.body;

    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey is required and must be a string');
    }

    if (!action || !['flag', 'remove', 'approve'].includes(action)) {
      throw new Error('action must be one of: flag, remove, approve');
    }

    if (!targetType || !['chapter', 'choice', 'story'].includes(targetType)) {
      throw new Error('targetType must be one of: chapter, choice, story');
    }

    if (!targetId || typeof targetId !== 'string') {
      throw new Error('targetId is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { adminKey, action, targetType, targetId, reason } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(
      `Admin moderation request: postId=${postId}, action=${action}, targetType=${targetType}, targetId=${targetId}`
    );

    const { AdminManager } = await import('./core/admin-manager.js');

    if (action === 'flag') {
      const result = await AdminManager.flagContent(
        postId,
        adminKey,
        targetType,
        targetId,
        reason || 'No reason provided'
      );

      if (result.success) {
        ErrorLogger.logInfo('Content flagged by admin', {
          postId,
          targetType,
          targetId,
          reportId: result.reportId,
        });
      }

      res.json({
        success: result.success,
        data: result.success
          ? {
              action: 'flag',
              targetType,
              targetId,
              moderatedAt: new Date(),
              reportId: result.reportId,
            }
          : undefined,
        error: result.error,
      });
    } else {
      // For remove/approve actions, we would need additional logic
      // For now, just acknowledge the request
      res.json({
        success: true,
        data: {
          action,
          targetType,
          targetId,
          moderatedAt: new Date(),
        },
      });
    }
  })
);

// Get moderation statistics (admin only)
router.get(
  '/api/admin/moderation',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const adminKey = req.query.adminKey as string;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey query parameter is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const adminKey = req.query.adminKey as string;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin moderation stats request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    const result = await AdminManager.getModerationStats(postId, adminKey);

    if (result.success) {
      // Set cache headers for admin data
      res.set({
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      });
    }

    res.json({
      success: result.success,
      data: result.stats,
      error: result.error,
    });
  })
);

// Get admin action logs (admin only)
router.get(
  '/api/admin/logs',
  RateLimiter.middleware(5, 60000), // 5 requests per minute
  validateRequest((req) => {
    const adminKey = req.query.adminKey as string;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey query parameter is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const adminKey = req.query.adminKey as string;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin logs request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    const result = await AdminManager.getAdminLogs(postId, adminKey);

    if (result.success) {
      // Set cache headers for admin data
      res.set({
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      });
    }

    res.json({
      success: result.success,
      data: { logs: result.logs || [] },
      error: result.error,
    });
  })
);

// ===== CONTENT MODERATION ENDPOINTS =====

// Report inappropriate content
router.post(
  '/api/moderation/report',
  RateLimiter.middleware(10, 300000), // 10 reports per 5 minutes
  validateRequest((req) => {
    const { contentType, contentId, reason } = req.body;

    if (!contentType || !['chapter', 'choice', 'story'].includes(contentType)) {
      throw new Error('contentType must be one of: chapter, choice, story');
    }

    if (!contentId || typeof contentId !== 'string') {
      throw new Error('contentId is required and must be a string');
    }

    if (!reason || typeof reason !== 'string') {
      throw new Error('reason is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { contentType, contentId, reason, description } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    // Get user ID from Reddit context
    let reportedBy: string;
    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        throw new ValidationError('User authentication required to report content');
      }
      reportedBy = username;
    } catch (error) {
      throw new ValidationError('Failed to authenticate user for content reporting');
    }

    console.log(
      `Content report: postId=${postId}, contentType=${contentType}, contentId=${contentId}, reportedBy=${reportedBy}`
    );

    const { ContentModerator } = await import('./core/content-moderator.js');
    const result = await ContentModerator.reportContent(
      postId,
      contentType,
      contentId,
      reportedBy,
      reason,
      description
    );

    if (result.success) {
      ErrorLogger.logInfo('Content reported', {
        postId,
        contentType,
        contentId,
        reportedBy,
        reportId: result.reportId,
      });
    } else {
      ErrorLogger.logWarning('Content report failed', {
        postId,
        contentType,
        contentId,
        reportedBy,
        error: result.error,
      });
    }

    res.json({
      success: result.success,
      data: result.success ? { reportId: result.reportId } : undefined,
      error: result.error,
    });
  })
);

// Get content reports (admin only)
router.get(
  '/api/admin/reports',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const adminKey = req.query.adminKey as string;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey query parameter is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const adminKey = req.query.adminKey as string;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin reports request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    if (!AdminManager.validateAdminKey(adminKey)) {
      throw new ValidationError('Invalid admin credentials');
    }

    const { ContentModerator } = await import('./core/content-moderator.js');
    const reports = await ContentModerator.getContentReports(postId);

    // Set cache headers for admin data
    res.set({
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    });

    res.json({
      success: true,
      data: { reports },
    });
  })
);

// Update report status (admin only)
router.post(
  '/api/admin/reports/:reportId/status',
  RateLimiter.middleware(20, 60000), // 20 requests per minute
  validateRequest((req) => {
    const { adminKey, status } = req.body;
    const { reportId } = req.params;

    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey is required and must be a string');
    }

    if (!reportId || typeof reportId !== 'string') {
      throw new Error('reportId is required and must be a string');
    }

    if (!status || !['pending', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      throw new Error('status must be one of: pending, reviewing, resolved, dismissed');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { adminKey, status, moderatorNotes } = req.body;
    const { reportId } = req.params;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(
      `Admin update report status: postId=${postId}, reportId=${reportId}, status=${status}`
    );

    const { AdminManager } = await import('./core/admin-manager.js');
    if (!AdminManager.validateAdminKey(adminKey)) {
      throw new ValidationError('Invalid admin credentials');
    }

    // Get moderator ID (in a real system, this would come from authentication)
    const moderatorId = 'admin'; // Placeholder

    const { ContentModerator } = await import('./core/content-moderator');
    const result = await (ContentModerator.updateReportStatus as any)(
      postId,
      reportId,
      status,
      moderatorId,
      moderatorNotes
    );

    if (result.success) {
      ErrorLogger.logInfo('Report status updated', {
        postId,
        reportId,
        status,
        moderatorId,
      });
    } else {
      ErrorLogger.logWarning('Report status update failed', {
        postId,
        reportId,
        error: result.error,
      });
    }

    res.json({
      success: result.success,
      data: result.success ? { reportId, status, updatedAt: new Date() } : undefined,
      error: result.error,
    });
  })
);

// Validate content before posting
router.post(
  '/api/moderation/validate',
  RateLimiter.middleware(30, 60000), // 30 requests per minute
  validateRequest((req) => {
    const { content, contentType } = req.body;

    if (!content || typeof content !== 'string') {
      throw new Error('content is required and must be a string');
    }

    if (!contentType || !['chapter', 'choice', 'story'].includes(contentType)) {
      throw new Error('contentType must be one of: chapter, choice, story');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { content, contentType } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(
      `Content validation: postId=${postId}, contentType=${contentType}, length=${content.length}`
    );

    const { ContentModerator } = await import('./core/content-moderator.js');
    const result = await ContentModerator.validateContent(content, contentType);

    // Set cache headers for validation results
    res.set({
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', // 5 minutes
    });

    res.json({
      success: true,
      data: {
        isValid: result.isValid,
        filteredContent: result.filteredContent,
        violations: result.violations,
        requiresApproval: result.requiresApproval,
      },
    });
  })
);

// Get content awaiting review (admin only)
router.get(
  '/api/admin/review-queue',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const adminKey = req.query.adminKey as string;
    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey query parameter is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const adminKey = req.query.adminKey as string;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Admin review queue request: postId=${postId}`);

    const { AdminManager } = await import('./core/admin-manager.js');
    if (!AdminManager.validateAdminKey(adminKey)) {
      throw new ValidationError('Invalid admin credentials');
    }

    const { ContentModerator } = await import('./core/content-moderator.js');
    const contentAwaitingReview = await ContentModerator.getContentAwaitingReview(postId);

    // Set cache headers for admin data
    res.set({
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    });

    res.json({
      success: true,
      data: { contentAwaitingReview },
    });
  })
);

// Add custom content filter (admin only)
router.post(
  '/api/admin/filters',
  RateLimiter.middleware(5, 300000), // 5 requests per 5 minutes
  validateRequest((req) => {
    const { adminKey, pattern, severity, action } = req.body;

    if (!adminKey || typeof adminKey !== 'string') {
      throw new Error('adminKey is required and must be a string');
    }

    if (!pattern || typeof pattern !== 'string') {
      throw new Error('pattern is required and must be a string');
    }

    if (!severity || !['low', 'medium', 'high'].includes(severity)) {
      throw new Error('severity must be one of: low, medium, high');
    }

    if (!action || !['flag', 'block', 'replace'].includes(action)) {
      throw new Error('action must be one of: flag, block, replace');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { adminKey, pattern, severity, action, replacement } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(
      `Admin add filter: postId=${postId}, pattern=${pattern}, severity=${severity}, action=${action}`
    );

    const { AdminManager } = await import('./core/admin-manager.js');
    if (!AdminManager.validateAdminKey(adminKey)) {
      throw new ValidationError('Invalid admin credentials');
    }

    const { ContentModerator } = await import('./core/content-moderator.js');
    const result = await ContentModerator.addCustomFilter(postId, {
      pattern,
      severity,
      action,
      replacement,
    });

    if (result.success) {
      ErrorLogger.logInfo('Custom filter added', {
        postId,
        filterId: result.filterId,
        pattern,
        severity,
        action,
      });
    } else {
      ErrorLogger.logWarning('Custom filter addition failed', {
        postId,
        pattern,
        error: result.error,
      });
    }

    res.json({
      success: result.success,
      data: result.success ? { filterId: result.filterId } : undefined,
      error: result.error,
    });
  })
);

// ===== STORY SYSTEM ENDPOINTS =====

// Reset story to beginning
router.post(
  '/api/story/restart',
  RateLimiter.middleware(5, 300000), // 5 restarts per 5 minutes
  validateRequest((req) => {
    const { preserveHistory } = req.body;
    if (preserveHistory !== undefined && typeof preserveHistory !== 'boolean') {
      throw new Error('preserveHistory must be a boolean if provided');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { preserveHistory = true } = req.body;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Story restart request: postId=${postId}, preserveHistory=${preserveHistory}`);

    const { StoryStateManager } = await import('./core/story-state-manager.js');
    const { StoryProgressionEngine } = await import('./core/story-progression-engine.js');

    try {
      // Reset the story state
      await StoryStateManager.resetStory(postId, preserveHistory);

      // Initialize with the opening chapter
      const progressionEngine = new StoryProgressionEngine();
      const initialChapter = progressionEngine.getInitialChapter();
      const initialContext = await StoryStateManager.initializeStory(postId, initialChapter);

      ErrorLogger.logInfo('Story restarted', {
        postId,
        preserveHistory,
        newChapterId: initialChapter.id,
      });

      res.json({
        success: true,
        data: {
          chapter: initialChapter,
          context: initialContext,
          message: preserveHistory
            ? 'Story restarted, history preserved'
            : 'Story restarted, fresh start',
        },
      });
    } catch (error) {
      ErrorLogger.logWarning('Story restart failed', {
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to restart story',
      });
    }
  })
);

// Get alternative story branches
router.get(
  '/api/story/branches',
  RateLimiter.middleware(30, 60000), // 30 requests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Alternative branches request: postId=${postId}`);

    const { StoryStateManager } = await import('./core/story-state-manager.js');

    try {
      const alternatives = await StoryStateManager.getAlternativeBranches(postId);

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        'Vary': 'Accept-Encoding',
      });

      res.json({
        success: true,
        data: {
          branches: alternatives,
          totalBranches: alternatives.length,
          completedBranches: alternatives.filter((b) => b.isCompleted).length,
        },
      });
    } catch (error) {
      ErrorLogger.logWarning('Failed to get alternative branches', {
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alternative branches',
      });
    }
  })
);

// Get story replay data for a specific path
router.get(
  '/api/story/replay/:pathId',
  RateLimiter.middleware(20, 60000), // 20 requests per minute
  validateRequest((req) => {
    const { pathId } = req.params;
    if (!pathId || typeof pathId !== 'string') {
      throw new Error('pathId is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { pathId } = req.params;
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Story replay request: postId=${postId}, pathId=${pathId}`);

    const { StoryStateManager } = await import('./core/story-state-manager.js');

    try {
      const replayData = await StoryStateManager.getStoryReplay(postId, pathId as string);

      if (!replayData) {
        res.status(404).json({
          success: false,
          error: 'Story path not found or not completed',
        });
        return;
      }

      // Set cache headers for replay data
      res.set({
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 minutes
        'Vary': 'Accept-Encoding',
      });

      res.json({
        success: true,
        data: replayData,
      });
    } catch (error) {
      ErrorLogger.logWarning('Failed to get story replay', {
        postId,
        pathId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve story replay data',
      });
    }
  })
);

// Get completed story paths
router.get(
  '/api/story/completed',
  RateLimiter.middleware(30, 60000), // 30 requests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      throw new ValidationError('postId is required but missing from context');
    }

    console.log(`Completed paths request: postId=${postId}`);

    const { StoryStateManager } = await import('./core/story-state-manager.js');

    try {
      const completedPaths = await StoryStateManager.getCompletedPaths(postId);
      const stats = await StoryStateManager.getStoryStats(postId);

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=240', // 2 minutes
        'Vary': 'Accept-Encoding',
      });

      res.json({
        success: true,
        data: {
          completedPaths,
          totalCompleted: completedPaths.length,
          stats: {
            totalChapters: stats.totalChapters,
            completedPaths: stats.completedPaths,
            availableBranches: stats.availableBranches,
          },
        },
      });
    } catch (error) {
      ErrorLogger.logWarning('Failed to get completed paths', {
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve completed paths',
      });
    }
  })
);

// Get current story state
router.get(
  '/api/story/current',
  RateLimiter.middleware(60, 60000), // 60 requests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    try {
      const { postId } = context;

      console.log(`Current story request: postId=${postId}, context:`, context);

      // For development, allow requests without postId
      const effectivePostId = postId || 'dev-post-id';

      console.log(`Using postId: ${effectivePostId}`);

      // Import story components
      const { StoryStateManager } = await import('./core/story-state-manager.js');
      const { StoryProgressionEngine } = await import('./core/story-progression-engine.js');

      // Try to get current chapter from state
      let currentChapter = await StoryStateManager.getCurrentChapter(effectivePostId);
      let storyContext = await StoryStateManager.getStoryContext(effectivePostId);
      let progression = await StoryStateManager.getProgression(effectivePostId);

      // If no story exists, initialize with first chapter
      if (!currentChapter || !storyContext) {
        console.log('No existing story found, initializing new story');

        const progressionEngine = new StoryProgressionEngine();
        const initialChapter = progressionEngine.getInitialChapter();

        // Initialize story state
        storyContext = await StoryStateManager.initializeStory(effectivePostId, initialChapter);
        currentChapter = initialChapter;
        progression = await StoryStateManager.getProgression(effectivePostId);

        // Create initial voting session
        await VotingManager.createVotingSession(
          effectivePostId,
          initialChapter.id,
          initialChapter.choices.map((choice) => ({
            choiceId: choice.id,
            text: choice.text,
          })),
          60 // 60 minutes voting duration
        );

        console.log('Story initialized with chapter:', initialChapter.id);
      }

      // Check if voting is active for current chapter
      let votingSession = await VotingManager.getVotingSession(effectivePostId, currentChapter.id);

      // If no voting session exists for this chapter, create one
      if (!votingSession) {
        console.log('No voting session found, creating one for chapter:', currentChapter.id);
        votingSession = await VotingManager.createVotingSession(
          effectivePostId,
          currentChapter.id,
          currentChapter.choices.map((choice) => ({
            choiceId: choice.id,
            text: choice.text,
          })),
          60 // 60 minutes voting duration
        );
      }

      const votingActive = votingSession?.status === 'active';

      console.log('Voting session status:', {
        sessionExists: !!votingSession,
        status: votingSession?.status,
        votingActive,
        chapterId: currentChapter.id,
      });

      // Get current vote counts
      const voteCounts = await VotingManager.getVoteCounts(effectivePostId, currentChapter.id);

      // Update chapter with current vote counts
      const updatedChapter = {
        ...currentChapter,
        choices: currentChapter.choices.map((choice) => {
          const voteCount = voteCounts.find((vc) => vc.choiceId === choice.id);
          return {
            ...choice,
            voteCount: voteCount?.count || 0,
          };
        }),
      };

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'Vary': 'Accept-Encoding',
      });

      res.json({
        success: true,
        data: {
          chapter: updatedChapter,
          context: storyContext,
          progression,
          votingActive,
          voteCounts,
        },
      });
    } catch (error) {
      console.error('Error in /api/story/current:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current story',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// Get story history
router.get(
  '/api/story/history',
  RateLimiter.middleware(30, 60000), // 30 requests per minute
  asyncHandler(async (_req, res): Promise<void> => {
    const { postId } = context;

    // For development, allow requests without postId
    const effectivePostId = postId || 'dev-post-id';

    console.log(`Story history request: postId=${effectivePostId}`);

    const { StoryStateManager } = await import('./core/story-state-manager.js');

    try {
      // Get story history and context
      const [history, storyContext, allChapters] = await Promise.all([
        StoryStateManager.getStoryHistory(effectivePostId),
        StoryStateManager.getStoryContext(effectivePostId),
        StoryStateManager.getAllChapters(effectivePostId),
      ]);

      // Build path from context
      const path = {
        chapters: storyContext?.pathTaken || [],
        decisions: storyContext?.previousChoices || [],
        ending: undefined, // Could be populated if story has ended
      };

      // Build decisions with vote stats
      const decisions = await Promise.all(
        history.map(async (entry) => {
          const stats = await VotingManager.getVotingStats(effectivePostId, entry.chapterId);
          return {
            chapterId: entry.chapterId,
            winningChoice: entry.winningChoice,
            voteStats: stats || {
              totalVotes: 0,
              uniqueVoters: 0,
              votingDuration: 0,
              winningChoice: entry.winningChoice,
              winningPercentage: 0,
            },
          };
        })
      );

      res.json({
        success: true,
        data: {
          path,
          chapters: allChapters,
          decisions,
          totalChapters: allChapters.length,
          storyAge: storyContext ? Date.now() - storyContext.storyStartTime.getTime() : 0,
        },
      });
    } catch (error) {
      console.error('Error getting story history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get story history',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// Advance story to next chapter (triggered when voting ends)
router.post(
  '/api/story/advance',
  RateLimiter.middleware(10, 60000), // 10 requests per minute
  validateRequest((req) => {
    const { chapterId } = req.body;
    if (!chapterId || typeof chapterId !== 'string') {
      throw new Error('chapterId is required and must be a string');
    }
  }),
  asyncHandler(async (req, res): Promise<void> => {
    const { chapterId, forceChoice } = req.body;
    const { postId } = context;

    // For development, allow requests without postId
    const effectivePostId = postId || 'dev-post-id';

    console.log(
      `Story advance request: postId=${effectivePostId}, chapterId=${chapterId}, forceChoice=${forceChoice}`
    );

    const { StoryProgressionEngine } = await import('./core/story-progression-engine.js');

    try {
      const progressionEngine = new StoryProgressionEngine();

      // Advance the story
      const result = await progressionEngine.advanceStory(effectivePostId, chapterId, forceChoice);

      if (result.success) {
        // Broadcast chapter transition to all connected clients
        if (result.newChapter && !result.hasEnded) {
          const stats = await VotingManager.getVotingStats(effectivePostId, chapterId);
          if (stats) {
            await RealtimeManager.broadcastChapterTransition(
              effectivePostId,
              result.newChapter,
              stats.winningChoice,
              stats
            );
          }
        }

        // If story has ended, broadcast ending
        if (result.hasEnded && result.ending) {
          await RealtimeManager.broadcastMessage(effectivePostId, {
            type: 'story_ended',
            timestamp: new Date(),
            data: {
              ending: result.ending,
              chapterId,
            },
          });
        }

        ErrorLogger.logInfo('Story advanced successfully', {
          postId: effectivePostId,
          chapterId,
          newChapter: result.newChapter?.id,
          hasEnded: result.hasEnded,
        });

        res.json({
          success: true,
          data: {
            newChapter: result.newChapter,
            hasEnded: result.hasEnded,
            ending: result.ending,
          },
        });
      } else {
        ErrorLogger.logWarning('Story advancement failed', {
          postId: effectivePostId,
          chapterId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: result.error || 'Failed to advance story',
        });
      }
    } catch (error) {
      console.error('Error advancing story:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to advance story',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// Health check endpoint
router.get(
  '/api/health',
  asyncHandler(async (_req, res): Promise<void> => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      features: ['voting', 'story'],
    });
  })
);

// Debug endpoint to test basic functionality
router.get('/api/debug', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is working',
    timestamp: new Date().toISOString(),
    context: {
      postId: context.postId,
      subredditName: context.subredditName,
    },
  });
});

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
