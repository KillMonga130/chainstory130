/**
 * Redis performance optimization utilities
 */

import { RedisErrorHandler } from './redis-error-handler';
import { ErrorLogger, PerformanceMonitor } from './error-handler';

// In-memory cache for frequently accessed data
class MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(maxSize: number = 1000, defaultTtlMs: number = 60000) {
    // 1 minute default TTL
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlMs;
  }

  set(key: string, value: any, ttlMs = this.defaultTtl): void {
    // Prevent memory leaks
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const globalCache = new MemoryCache();

// Cleanup expired cache entries every 5 minutes
setInterval(() => globalCache.cleanup(), 5 * 60 * 1000);

// Batch operation manager
class BatchOperationManager {
  private batches = new Map<
    string,
    {
      operations: Array<() => Promise<any>>;
      resolve: (results: any[]) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  private readonly batchDelay: number;
  private readonly maxBatchSize: number;

  constructor(batchDelayMs = 50, maxBatchSize = 10) {
    this.batchDelay = batchDelayMs;
    this.maxBatchSize = maxBatchSize;
  }

  addToBatch<T>(batchKey: string, operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const existing = this.batches.get(batchKey);

      if (existing) {
        existing.operations.push(operation);

        // If batch is full, execute immediately
        if (existing.operations.length >= this.maxBatchSize) {
          clearTimeout(existing.timeout);
          this.executeBatch(batchKey);
        }
      } else {
        // Create new batch
        const timeout = setTimeout(() => {
          this.executeBatch(batchKey);
        }, this.batchDelay);

        this.batches.set(batchKey, {
          operations: [operation],
          resolve: (results) => resolve(results[0] as T),
          reject,
          timeout,
        });
      }
    });
  }

  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch) return;

    this.batches.delete(batchKey);
    clearTimeout(batch.timeout);

    try {
      const results = await Promise.all(batch.operations.map((op) => op()));
      batch.resolve(results);
    } catch (error) {
      batch.reject(error as Error);
    }
  }
}

const batchManager = new BatchOperationManager();

// Redis optimization utilities
export class RedisOptimizer {
  private static readonly CACHE_PREFIX = 'cache:';
  private static readonly BATCH_PREFIX = 'batch:';

  // Cached get operation
  static async getCached(
    key: string,
    ttlMs = 60000, // 1 minute default
    useMemoryCache = true
  ): Promise<string | null> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;

    // Check memory cache first
    if (useMemoryCache) {
      const cached = globalCache.get(cacheKey);
      if (cached !== null) {
        PerformanceMonitor.recordMetric('redis_cache_hit', 0, false);
        return cached;
      }
    }

    const stopTimer = PerformanceMonitor.startTimer('redis_get_cached');

    try {
      const value = await RedisErrorHandler.safeGet(key);

      // Cache the result
      if (value !== null && useMemoryCache) {
        globalCache.set(cacheKey, value, ttlMs);
      }

      stopTimer();
      PerformanceMonitor.recordMetric('redis_cache_miss', 0, false);
      return value;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  // Cached JSON get operation
  static async getJSONCached<T>(
    key: string,
    ttlMs = 60000,
    useMemoryCache = true
  ): Promise<T | null> {
    const cacheKey = `${this.CACHE_PREFIX}json:${key}`;

    // Check memory cache first
    if (useMemoryCache) {
      const cached = globalCache.get(cacheKey);
      if (cached !== null) {
        PerformanceMonitor.recordMetric('redis_json_cache_hit', 0, false);
        return cached;
      }
    }

    const stopTimer = PerformanceMonitor.startTimer('redis_get_json_cached');

    try {
      const value = await RedisErrorHandler.safeGetJSON<T>(key);

      // Cache the result
      if (value !== null && useMemoryCache) {
        globalCache.set(cacheKey, value, ttlMs);
      }

      stopTimer();
      PerformanceMonitor.recordMetric('redis_json_cache_miss', 0, false);
      return value;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  // Set with cache invalidation
  static async setWithCacheInvalidation(
    key: string,
    value: string,
    options?: { expiration?: Date }
  ): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('redis_set_with_cache_invalidation');

    try {
      await RedisErrorHandler.safeSet(key, value, options);

      // Invalidate memory cache
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      globalCache.delete(cacheKey);

      stopTimer();
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  // Set JSON with cache invalidation
  static async setJSONWithCacheInvalidation<T>(
    key: string,
    value: T,
    options?: { expiration?: Date }
  ): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('redis_set_json_with_cache_invalidation');

    try {
      await RedisErrorHandler.safeSetJSON(key, value, options);

      // Invalidate memory cache
      const cacheKey = `${this.CACHE_PREFIX}json:${key}`;
      globalCache.delete(cacheKey);

      stopTimer();
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  // Batched get operations
  static async getBatched(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];

    const batchKey = `${this.BATCH_PREFIX}get:${keys.join(',')}`;

    return batchManager.addToBatch(batchKey, async () => {
      const stopTimer = PerformanceMonitor.startTimer('redis_get_batched');

      try {
        const results = await Promise.all(keys.map((key) => RedisErrorHandler.safeGet(key)));

        stopTimer();
        return results;
      } catch (error) {
        stopTimer();
        throw error;
      }
    });
  }

  // Optimized vote count retrieval with caching
  static async getVoteCountsOptimized(
    postId: string,
    chapterId: string,
    choiceIds: string[]
  ): Promise<Array<{ choiceId: string; count: number }>> {
    const cacheKey = `vote_counts:${postId}:${chapterId}`;

    // Try cache first
    const cached = await this.getCached(cacheKey, 5000); // 5 second cache
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        ErrorLogger.logWarning('Failed to parse cached vote counts', { error });
      }
    }

    const stopTimer = PerformanceMonitor.startTimer('redis_get_vote_counts_optimized');

    try {
      // Batch get all vote counts
      const voteCountKeys = choiceIds.map(
        (choiceId) => `haunted_thread:vote_count:${postId}:${chapterId}:${choiceId}`
      );

      const counts = await this.getBatched(voteCountKeys);

      const results = choiceIds.map((choiceId, index) => ({
        choiceId,
        count: parseInt(counts[index] || '0'),
      }));

      // Cache the results
      await this.setWithCacheInvalidation(cacheKey, JSON.stringify(results), {
        expiration: new Date(Date.now() + 5000),
      });

      stopTimer();
      return results;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  // Optimized user vote status check with caching
  static async getUserVoteStatusOptimized(
    postId: string,
    userId: string,
    chapterId: string
  ): Promise<{ hasVoted: boolean; choiceId?: string }> {
    const cacheKey = `user_vote:${postId}:${chapterId}:${userId}`;

    // Try cache first (short TTL for user-specific data)
    const cached = await this.getCached(cacheKey, 10000); // 10 second cache
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        ErrorLogger.logWarning('Failed to parse cached user vote status', { error });
      }
    }

    const stopTimer = PerformanceMonitor.startTimer('redis_get_user_vote_status_optimized');

    try {
      const userVoteKey = `haunted_thread:user_vote:${postId}:${chapterId}:${userId}`;
      const choiceId = await RedisErrorHandler.safeGet(userVoteKey);

      const result = {
        hasVoted: !!choiceId,
        ...(choiceId && { choiceId }),
      };

      // Cache the result
      await this.setWithCacheInvalidation(cacheKey, JSON.stringify(result), {
        expiration: new Date(Date.now() + 10000),
      });

      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }

  // Bulk cache invalidation
  static async invalidateCachePattern(pattern: string): Promise<void> {
    // Since we can't use Redis KEYS in Devvit, we'll clear memory cache
    // and log the pattern for manual cleanup if needed

    const keys = Array.from(globalCache['cache'].keys());
    const matchingKeys = keys.filter((key) => key.includes(pattern));

    matchingKeys.forEach((key) => globalCache.delete(key));

    ErrorLogger.logInfo('Cache invalidation completed', {
      pattern,
      invalidatedKeys: matchingKeys.length,
    });
  }

  // Cache statistics
  static getCacheStats(): {
    memoryCache: { size: number; maxSize: number };
    performance: Record<string, { avgTime: number; count: number; errorRate: number }>;
  } {
    return {
      memoryCache: {
        size: globalCache.size(),
        maxSize: globalCache['maxSize'],
      },
      performance: PerformanceMonitor.getMetrics(),
    };
  }

  // Clear all caches
  static clearAllCaches(): void {
    globalCache.clear();
    ErrorLogger.logInfo('All caches cleared');
  }

  // Preload frequently accessed data
  static async preloadData(keys: string[]): Promise<void> {
    const stopTimer = PerformanceMonitor.startTimer('redis_preload_data');

    try {
      await Promise.all(
        keys.map((key) => this.getCached(key, 300000)) // 5 minute cache
      );

      stopTimer();
      ErrorLogger.logInfo('Data preloaded successfully', { keyCount: keys.length });
    } catch (error) {
      stopTimer();
      ErrorLogger.logWarning('Data preload failed', { error });
    }
  }
}
