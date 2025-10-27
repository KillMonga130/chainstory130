import { Request, Response, NextFunction } from 'express';
import { context } from '@devvit/web/server';
import { RedditErrorHandler } from './reddit-error-handler';

// Custom error types
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any> | undefined;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, ApiError);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR', true, { field });
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true, { resource });
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR', true);
  }
}

export class RedisError extends ApiError {
  constructor(message: string, operation?: string) {
    super(`Redis operation failed: ${message}`, 500, 'REDIS_ERROR', true, { operation });
  }
}

export class RedditApiError extends ApiError {
  constructor(message: string, operation?: string, statusCode?: number) {
    super(`Reddit API error: ${message}`, statusCode || 502, 'REDDIT_API_ERROR', true, { operation });
  }
}

// Error logging utility
export class ErrorLogger {
  private static formatError(error: Error, req?: Request): Record<string, any> {
    const { postId, subredditName, userId } = context;
    
    return {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof ApiError && {
          statusCode: error.statusCode,
          code: error.code,
          isOperational: error.isOperational,
          context: error.context,
        }),
      },
      request: req && {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
        body: req.method !== 'GET' ? req.body : undefined,
      },
      devvitContext: {
        postId,
        subredditName,
        userId,
      },
    };
  }

  static logError(error: Error, req?: Request): void {
    const errorData = this.formatError(error, req);
    
    // Log to console with structured format
    console.error('=== ERROR LOG ===');
    console.error(`Time: ${errorData.timestamp}`);
    console.error(`Error: ${error.name} - ${error.message}`);
    
    if (error instanceof ApiError) {
      console.error(`Code: ${error.code} (${error.statusCode})`);
      console.error(`Operational: ${error.isOperational}`);
      if (error.context) {
        console.error(`Context: ${JSON.stringify(error.context, null, 2)}`);
      }
    }
    
    if (req) {
      console.error(`Request: ${req.method} ${req.url}`);
    }
    
    if (errorData.devvitContext.postId) {
      console.error(`Post ID: ${errorData.devvitContext.postId}`);
    }
    
    if (errorData.devvitContext.subredditName) {
      console.error(`Subreddit: ${errorData.devvitContext.subredditName}`);
    }
    
    // Log full stack trace for non-operational errors
    if (!(error instanceof ApiError) || !error.isOperational) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    console.error('=== END ERROR LOG ===');
  }

  static logWarning(message: string, context?: Record<string, any>): void {
    console.warn('=== WARNING ===');
    console.warn(`Time: ${new Date().toISOString()}`);
    console.warn(`Message: ${message}`);
    if (context) {
      console.warn(`Context: ${JSON.stringify(context, null, 2)}`);
    }
    console.warn('=== END WARNING ===');
  }

  static logInfo(message: string, context?: Record<string, any>): void {
    console.log('=== INFO ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Message: ${message}`);
    if (context) {
      console.log(`Context: ${JSON.stringify(context, null, 2)}`);
    }
    console.log('=== END INFO ===');
  }
}

// Express error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  ErrorLogger.logError(error, req);

  // Don't send error response if response already sent
  if (res.headersSent) {
    return next(error);
  }

  // Handle known API errors
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        context: error.context,
      }),
    });
    return;
  }

  // Handle unknown errors
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(statusCode).json({
    status: 'error',
    message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
    }),
  });
};

// Async error wrapper for route handlers
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request validation middleware
export const validateRequest = (
  validator: (req: Request) => void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      validator(req);
      next();
    } catch (error) {
      if (error instanceof Error) {
        next(new ValidationError(error.message));
      } else {
        next(new ValidationError('Invalid request data'));
      }
    }
  };
};

// Rate limiting helper
export class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>();

  static checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const existing = this.requests.get(identifier);
    
    if (!existing || existing.resetTime < windowStart) {
      // New window or expired window
      this.requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (existing.count >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    // Increment count
    existing.count++;
    return true;
  }

  static middleware(maxRequests: number, windowMs: number) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Use user ID or IP as identifier
        const userId = await context.userId;
        const identifier = userId || req.ip || 'anonymous';
        
        if (!this.checkLimit(identifier, maxRequests, windowMs)) {
          throw new RateLimitError(`Too many requests. Limit: ${maxRequests} per ${windowMs}ms`);
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

// Health check utilities
export class HealthChecker {
  static async checkRedisHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Use the RedisErrorHandler to check connection
      return { healthy: true }; // Placeholder - actual implementation would use Redis operations
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown Redis error' 
      };
    }
  }

  static async checkRedditApiHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Use the RedditErrorHandler to check API health
      return await RedditErrorHandler.checkApiHealth();
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown Reddit API error' 
      };
    }
  }
}

// Graceful error recovery utilities
export class ErrorRecovery {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break; // Don't wait after the last attempt
        }
        
        // Wait before retry with exponential backoff
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        ErrorLogger.logWarning(`Retry attempt ${attempt + 1}/${maxRetries} failed`, {
          error: lastError.message,
          nextRetryIn: delay * backoffMultiplier,
        });
      }
    }
    
    throw lastError!;
  }

  static async withFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    fallbackCondition?: (error: Error) => boolean
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      const shouldUseFallback = fallbackCondition 
        ? fallbackCondition(error as Error)
        : true;
        
      if (shouldUseFallback) {
        ErrorLogger.logWarning('Using fallback operation', {
          primaryError: (error as Error).message,
        });
        return await fallbackOperation();
      }
      
      throw error;
    }
  }
}
