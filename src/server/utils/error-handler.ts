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
    super(`Reddit API error: ${message}`, statusCode || 502, 'REDDIT_API_ERROR', true, {
      operation,
    });
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
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message;

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

// Request validation middleware with better type safety
export const validateRequest = (validator: (req: Request) => void | Promise<void>) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await validator(req);
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

  static checkLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
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
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        // Use user ID or IP as identifier
        const userId = context.userId;
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
        error: error instanceof Error ? error.message : 'Unknown Redis error',
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
        error: error instanceof Error ? error.message : 'Unknown Reddit API error',
      };
    }
  }
}

// Network error types
export class NetworkError extends ApiError {
  constructor(message: string, operation?: string) {
    super(`Network error: ${message}`, 503, 'NETWORK_ERROR', true, { operation });
  }
}

export class TimeoutError extends ApiError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms: ${operation}`, 408, 'TIMEOUT_ERROR', true, {
      operation,
      timeoutMs,
    });
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics = new Map<string, { count: number; totalTime: number; errors: number }>();

  static startTimer(operation: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration, false);
    };
  }

  static recordMetric(operation: string, duration: number, isError: boolean): void {
    const existing = this.metrics.get(operation) || { count: 0, totalTime: 0, errors: 0 };

    this.metrics.set(operation, {
      count: existing.count + 1,
      totalTime: existing.totalTime + duration,
      errors: existing.errors + (isError ? 1 : 0),
    });
  }

  static getMetrics(): Record<string, { avgTime: number; count: number; errorRate: number }> {
    const result: Record<string, { avgTime: number; count: number; errorRate: number }> = {};

    for (const [operation, metrics] of this.metrics.entries()) {
      result[operation] = {
        avgTime: metrics.totalTime / metrics.count,
        count: metrics.count,
        errorRate: metrics.errors / metrics.count,
      };
    }

    return result;
  }

  static clearMetrics(): void {
    this.metrics.clear();
  }
}

// Circuit breaker for preventing cascade failures
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 60000, // 1 minute
    private readonly operationName: string = 'unknown'
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = 'half-open';
        ErrorLogger.logInfo(`Circuit breaker half-open for ${this.operationName}`);
      } else {
        throw new ApiError(
          `Circuit breaker is open for ${this.operationName}`,
          503,
          'CIRCUIT_BREAKER_OPEN'
        );
      }
    }

    try {
      const result = await operation();

      if (this.state === 'half-open') {
        this.reset();
        ErrorLogger.logInfo(`Circuit breaker closed for ${this.operationName}`);
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      ErrorLogger.logWarning(`Circuit breaker opened for ${this.operationName}`, {
        failures: this.failures,
        threshold: this.failureThreshold,
      });
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  getState(): { state: string; failures: number } {
    return {
      state: this.state,
      failures: this.failures,
    };
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
    const stopTimer = PerformanceMonitor.startTimer('retry_operation');

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation();
          stopTimer();
          return result;
        } catch (error) {
          lastError = error as Error;

          if (attempt === maxRetries) {
            break; // Don't wait after the last attempt
          }

          // Wait before retry with exponential backoff and jitter
          const baseDelay = delayMs * Math.pow(backoffMultiplier, attempt);
          const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
          const delay = baseDelay + jitter;

          await new Promise((resolve) => setTimeout(resolve, delay));

          ErrorLogger.logWarning(`Retry attempt ${attempt + 1}/${maxRetries} failed`, {
            error: lastError.message,
            nextRetryIn: delay * backoffMultiplier,
            attempt: attempt + 1,
          });
        }
      }

      stopTimer();
      PerformanceMonitor.recordMetric('retry_operation', 0, true);
      throw lastError!;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  static async withFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    fallbackCondition?: (error: Error) => boolean
  ): Promise<T> {
    const stopTimer = PerformanceMonitor.startTimer('fallback_operation');

    try {
      const result = await primaryOperation();
      stopTimer();
      return result;
    } catch (error) {
      const shouldUseFallback = fallbackCondition ? fallbackCondition(error as Error) : true;

      if (shouldUseFallback) {
        ErrorLogger.logWarning('Using fallback operation', {
          primaryError: (error as Error).message,
        });

        try {
          const result = await fallbackOperation();
          stopTimer();
          return result;
        } catch (fallbackError) {
          stopTimer();
          PerformanceMonitor.recordMetric('fallback_operation', 0, true);
          throw fallbackError;
        }
      }

      stopTimer();
      PerformanceMonitor.recordMetric('fallback_operation', 0, true);
      throw error;
    }
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string = 'unknown'
  ): Promise<T> {
    const stopTimer = PerformanceMonitor.startTimer(`timeout_${operationName}`);

    return Promise.race([
      operation().then((result) => {
        stopTimer();
        return result;
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          stopTimer();
          PerformanceMonitor.recordMetric(`timeout_${operationName}`, timeoutMs, true);
          reject(new TimeoutError(operationName, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  }
}
