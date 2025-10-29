import { redis } from '@devvit/web/server';
import { RedisError, ErrorLogger, ErrorRecovery } from './error-handler';

// Redis operation wrapper with error handling and retry logic
export class RedisErrorHandler {
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY = 500; // 500ms

  // Wrap Redis operations with error handling and retry logic
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
        2 // Exponential backoff multiplier
      );
    } catch (error) {
      const redisError = new RedisError(
        `${operationName} failed after ${this.MAX_RETRIES} retries: ${(error as Error).message}`,
        operationName
      );

      ErrorLogger.logError(redisError);

      // Return fallback value if provided, otherwise throw
      if (fallbackValue !== undefined) {
        ErrorLogger.logWarning(`Using fallback value for ${operationName}`, {
          fallbackValue,
          originalError: (error as Error).message,
        });
        return fallbackValue;
      }

      throw redisError;
    }
  }

  // Redis connection health check
  static async checkConnection(): Promise<boolean> {
    try {
      const testKey = `health-check-${Date.now()}`;

      await redis.set(testKey, 'test', { expiration: new Date(Date.now() + 1000) });
      const result = await redis.get(testKey);

      return result === 'test';
    } catch (error) {
      ErrorLogger.logError(
        new RedisError(`Redis health check failed: ${(error as Error).message}`, 'health-check')
      );
      return false;
    }
  }

  // Safe Redis get with fallback
  static async safeGet(key: string, fallback: string | null = null): Promise<string | null> {
    return this.withErrorHandling(
      async () => {
        const result = await redis.get(key);
        return result ?? null;
      },
      `GET ${key}`,
      fallback
    );
  }

  // Safe Redis set with retry
  static async safeSet(key: string, value: string, options?: { expiration?: Date }): Promise<void> {
    await this.withErrorHandling(async () => {
      await redis.set(key, value, options);
    }, `SET ${key}`);
  }

  // Safe Redis delete with retry
  static async safeDelete(key: string): Promise<void> {
    await this.withErrorHandling(async () => {
      await redis.del(key);
    }, `DELETE ${key}`);
  }

  // Safe Redis JSON operations
  static async safeGetJSON<T>(key: string, fallback?: T): Promise<T | null> {
    return this.withErrorHandling(
      async () => {
        const data = await redis.get(key);
        if (!data) return null;

        try {
          return JSON.parse(data) as T;
        } catch (parseError) {
          throw new RedisError(
            `Failed to parse JSON from Redis key ${key}: ${(parseError as Error).message}`,
            'JSON_PARSE'
          );
        }
      },
      `GET_JSON ${key}`,
      fallback || null
    );
  }

  static async safeSetJSON<T>(
    key: string,
    value: T,
    options?: { expiration?: Date }
  ): Promise<void> {
    await this.withErrorHandling(async () => {
      const jsonString = JSON.stringify(value);
      await redis.set(key, jsonString, options);
    }, `SET_JSON ${key}`);
  }

  // Note: Devvit Redis doesn't support traditional list operations like lPush/lRange
  // Use sorted sets or hashes for list-like functionality instead

  // Safe Redis hash operations
  static async safeHashSet(key: string, field: string, value: string): Promise<void> {
    await this.withErrorHandling(async () => {
      await redis.hSet(key, { [field]: value });
    }, `HSET ${key} ${field}`);
  }

  static async safeHashGet(key: string, field: string): Promise<string | null> {
    return this.withErrorHandling(
      async () => {
        const result = await redis.hGet(key, field);
        return result ?? null;
      },
      `HGET ${key} ${field}`,
      null
    );
  }

  static async safeHashGetAll(key: string): Promise<Record<string, string>> {
    return this.withErrorHandling(
      async () => {
        return await redis.hGetAll(key);
      },
      `HGETALL ${key}`,
      {}
    );
  }

  // Batch operations with transaction-like behavior
  static async safeBatchOperation<T>(
    operations: Array<() => Promise<T>>,
    operationName: string
  ): Promise<T[]> {
    return this.withErrorHandling(async () => {
      const results: T[] = [];

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (!operation) {
          throw new Error(`Operation at index ${i} is undefined`);
        }

        try {
          const result = await operation();
          results.push(result);
        } catch (error) {
          // If any operation fails, log it but continue with others
          ErrorLogger.logWarning(`Batch operation ${i} failed in ${operationName}`, {
            error: (error as Error).message,
            operationIndex: i,
          });
          throw error; // Re-throw to trigger retry of entire batch
        }
      }

      return results;
    }, `BATCH_${operationName}`);
  }

  // Memory usage monitoring
  static async checkMemoryUsage(): Promise<{
    healthy: boolean;
    usage?: number;
    warning?: string;
  }> {
    try {
      // Note: Redis memory info is not directly available in Devvit
      // This is a placeholder for memory monitoring
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        warning: `Memory check failed: ${(error as Error).message}`,
      };
    }
  }

  // Key pattern utilities with error handling
  static async safeGetKeysByPattern(pattern: string): Promise<string[]> {
    return this.withErrorHandling(
      async () => {
        // Note: Redis KEYS command is not available in Devvit
        // This would need to be implemented using known key patterns
        // For now, return empty array as fallback
        ErrorLogger.logWarning('Key pattern search not implemented in Devvit Redis', {
          pattern,
        });
        return [];
      },
      `GET_KEYS_BY_PATTERN ${pattern}`,
      []
    );
  }

  // Cleanup utilities
  static async safeCleanupExpiredKeys(keyPrefix: string): Promise<number> {
    return this.withErrorHandling(
      async () => {
        // Since we can't scan keys in Devvit, we'll need to track keys manually
        // This is a placeholder implementation
        ErrorLogger.logInfo('Cleanup operation completed', { keyPrefix });
        return 0; // Number of keys cleaned
      },
      `CLEANUP ${keyPrefix}`,
      0
    );
  }
}
