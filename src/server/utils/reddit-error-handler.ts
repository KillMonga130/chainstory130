import { reddit, context } from '@devvit/web/server';
import { RedditApiError, ErrorLogger, ErrorRecovery } from './error-handler';

// Reddit API operation wrapper with error handling and retry logic
export class RedditErrorHandler {
  private static readonly MAX_RETRIES = 2; // Lower retries for Reddit API due to rate limits
  private static readonly BASE_DELAY = 2000; // 2 seconds
  private static readonly RATE_LIMIT_DELAY = 60000; // 1 minute for rate limit errors

  // Wrap Reddit API operations with error handling and retry logic
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await ErrorRecovery.withRetry(
        operation,
        this.MAX_RETRIES,
        this.BASE_DELAY,
        1.5 // Lower backoff multiplier for Reddit API
      );
    } catch (error) {
      const originalError = error as Error;
      let statusCode = 502; // Bad Gateway as default for external API errors

      // Parse Reddit API specific errors
      if (originalError.message.includes('429') || originalError.message.includes('rate limit')) {
        statusCode = 429;
      } else if (
        originalError.message.includes('401') ||
        originalError.message.includes('unauthorized')
      ) {
        statusCode = 401;
      } else if (
        originalError.message.includes('403') ||
        originalError.message.includes('forbidden')
      ) {
        statusCode = 403;
      } else if (
        originalError.message.includes('404') ||
        originalError.message.includes('not found')
      ) {
        statusCode = 404;
      }

      const redditError = new RedditApiError(
        `${operationName} failed: ${originalError.message}`,
        operationName,
        statusCode
      );

      ErrorLogger.logError(redditError);

      // Return fallback value if provided, otherwise throw
      if (fallbackValue !== undefined) {
        ErrorLogger.logWarning(`Using fallback value for ${operationName}`, {
          fallbackValue,
          originalError: originalError.message,
        });
        return fallbackValue;
      }

      throw redditError;
    }
  }

  // Safe comment submission with retry and fallback
  static async safeSubmitComment(
    postId: string,
    text: string,
    fallbackText?: string
  ): Promise<{ id: string; success: boolean; fallbackUsed: boolean }> {
    let fallbackUsed = false;

    const result = await this.withErrorHandling(async () => {
      try {
        const comment = await reddit.submitComment({
          id: postId as any,
          text,
        });
        return { id: comment.id, success: true, fallbackUsed: false };
      } catch (error) {
        // If primary comment fails and we have fallback text, try that
        if (fallbackText && fallbackText !== text) {
          ErrorLogger.logWarning('Primary comment failed, trying fallback text', {
            originalText: text,
            fallbackText,
            error: (error as Error).message,
          });

          const fallbackComment = await reddit.submitComment({
            id: postId as any,
            text: fallbackText,
          });

          fallbackUsed = true;
          return { id: fallbackComment.id, success: true, fallbackUsed: true };
        }

        throw error;
      }
    }, 'SUBMIT_COMMENT');

    return { ...result, fallbackUsed };
  }

  // Safe comment fetching with pagination and error handling
  static async safeGetComments(
    postId: string,
    options: {
      limit?: number;
      sort?: 'new' | 'top' | 'hot';
      timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    } = {}
  ): Promise<
    Array<{
      id: string;
      body: string;
      score: number;
      authorName: string;
      createdAt: string;
    }>
  > {
    return this.withErrorHandling(
      async () => {
        const comments = await reddit
          .getComments({
            postId: postId as any,
            limit: options.limit || 100,
            sort: (options.sort || 'new') as any,
          })
          .all();

        return comments.map((comment) => ({
          id: comment.id,
          body: comment.body || '',
          score: comment.score,
          authorName: comment.authorName || 'anonymous',
          createdAt: comment.createdAt.toISOString(),
        }));
      },
      'GET_COMMENTS',
      [] // Return empty array as fallback
    );
  }

  // Safe user authentication check
  static async safeGetCurrentUsername(): Promise<string | null> {
    return this.withErrorHandling(
      async () => {
        const username = await reddit.getCurrentUsername();
        return username || null;
      },
      'GET_CURRENT_USERNAME',
      null
    );
  }

  // Safe post creation with validation
  static async safeCreatePost(
    subredditName: string,
    title: string,
    text?: string,
    url?: string
  ): Promise<{ id: string; url: string }> {
    return this.withErrorHandling(async () => {
      // Validate inputs
      if (!title || title.trim().length === 0) {
        throw new Error('Post title cannot be empty');
      }

      if (title.length > 300) {
        throw new Error('Post title too long (max 300 characters)');
      }

      const postData: any = {
        subredditName,
        title: title.trim(),
      };

      if (text?.trim()) {
        postData.text = text.trim();
      }

      if (url) {
        postData.url = url;
      }

      const post = await reddit.submitPost(postData);

      return {
        id: post.id,
        url: post.url,
      };
    }, 'CREATE_POST');
  }

  // Safe subreddit information fetching
  static async safeGetSubredditInfo(): Promise<{
    name: string;
    members: number;
    description?: string;
  } | null> {
    return this.withErrorHandling(
      async () => {
        const { subredditName } = context;
        if (!subredditName) {
          throw new Error('No subreddit context available');
        }

        // Note: Specific subreddit info methods may not be available in Devvit
        // This is a placeholder implementation
        return {
          name: subredditName,
          members: 0, // Would need actual API call
          description: '',
        };
      },
      'GET_SUBREDDIT_INFO',
      null
    );
  }

  // Rate limit handling utilities
  static async handleRateLimit(error: Error): Promise<void> {
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      ErrorLogger.logWarning('Reddit API rate limit hit, waiting before retry', {
        waitTime: this.RATE_LIMIT_DELAY,
        error: error.message,
      });

      // Wait for rate limit to reset
      await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_DELAY));
    }
  }

  // Batch comment processing with error handling
  static async safeBatchProcessComments<T>(
    comments: Array<{
      id: string;
      body: string;
      score: number;
      authorName: string;
      createdAt: string;
    }>,
    processor: (comment: any) => Promise<T>,
    operationName: string
  ): Promise<T[]> {
    const results: T[] = [];
    const errors: Array<{ commentId: string; error: string }> = [];

    for (const comment of comments) {
      try {
        const result = await processor(comment);
        results.push(result);
      } catch (error) {
        const errorMessage = (error as Error).message;
        errors.push({ commentId: comment.id, error: errorMessage });

        ErrorLogger.logWarning(`Failed to process comment in ${operationName}`, {
          commentId: comment.id,
          error: errorMessage,
        });
      }
    }

    if (errors.length > 0) {
      ErrorLogger.logWarning(`Batch comment processing completed with errors`, {
        operationName,
        totalComments: comments.length,
        successfullyProcessed: results.length,
        errors: errors.length,
        errorDetails: errors,
      });
    }

    return results;
  }

  // Comment validation utilities
  static validateCommentFormat(
    commentBody: string,
    expectedPattern: RegExp
  ): { valid: boolean; match?: RegExpMatchArray; error?: string } {
    try {
      if (!commentBody || commentBody.trim().length === 0) {
        return { valid: false, error: 'Comment body is empty' };
      }

      const match = commentBody.match(expectedPattern);
      if (!match) {
        return { valid: false, error: 'Comment does not match expected format' };
      }

      return { valid: true, match };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${(error as Error).message}`,
      };
    }
  }

  // Health check for Reddit API
  static async checkApiHealth(): Promise<{
    healthy: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      await this.safeGetCurrentUsername();
      const responseTime = Date.now() - startTime;

      return { healthy: true, responseTime };
    } catch (error) {
      return {
        healthy: false,
        error: (error as Error).message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  // Context validation
  static validateContext(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { postId, subredditName } = context;

    if (!postId) {
      errors.push('Missing postId in context');
    }

    if (!subredditName) {
      errors.push('Missing subredditName in context');
    }

    // userId might be optional depending on the operation

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
