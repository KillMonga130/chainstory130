/**
 * Client-side error handling and performance utilities
 */

// Error types for client-side operations
export class ClientError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CLIENT_ERROR',
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export class NetworkError extends ClientError {
  constructor(message: string, public readonly status?: number) {
    super(message, 'NETWORK_ERROR', { status });
  }
}

export class ValidationError extends ClientError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
  }
}

export class TimeoutError extends ClientError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms: ${operation}`, 'TIMEOUT_ERROR', { operation, timeoutMs });
  }
}

// Performance monitoring for client operations
export class ClientPerformanceMonitor {
  private static metrics = new Map<string, { count: number; totalTime: number; errors: number }>();
  private static readonly MAX_METRICS = 100; // Prevent memory leaks

  static startTimer(operation: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration, false);
    };
  }

  static recordMetric(operation: string, duration: number, isError: boolean): void {
    // Prevent memory leaks by limiting stored metrics
    if (this.metrics.size >= this.MAX_METRICS) {
      const firstKey = this.metrics.keys().next().value;
      if (firstKey) {
        this.metrics.delete(firstKey);
      }
    }

    const existing = this.metrics.get(operation) || { count: 0, totalTime: 0, errors: 0 };
    
    this.metrics.set(operation, {
      count: existing.count + 1,
      totalTime: existing.totalTime + duration,
      errors: existing.errors + (isError ? 1 : 0)
    });
  }

  static getMetrics(): Record<string, { avgTime: number; count: number; errorRate: number }> {
    const result: Record<string, { avgTime: number; count: number; errorRate: number }> = {};
    
    for (const [operation, metrics] of this.metrics.entries()) {
      result[operation] = {
        avgTime: Math.round(metrics.totalTime / metrics.count * 100) / 100, // Round to 2 decimals
        count: metrics.count,
        errorRate: Math.round((metrics.errors / metrics.count) * 100) / 100
      };
    }
    
    return result;
  }

  static clearMetrics(): void {
    this.metrics.clear();
  }
}

// Enhanced fetch wrapper with retry, timeout, and error handling
export class ApiClient {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly DEFAULT_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  static async request<T>(
    url: string,
    options: RequestInit & {
      timeout?: number;
      retries?: number;
      retryDelay?: number;
      retryCondition?: (error: Error, attempt: number) => boolean;
    } = {}
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.DEFAULT_RETRIES,
      retryDelay = this.RETRY_DELAY,
      retryCondition = (error, attempt) => {
        // Retry on network errors, timeouts, and 5xx status codes
        return (
          error instanceof NetworkError ||
          error instanceof TimeoutError ||
          (error instanceof NetworkError && error.status && error.status >= 500)
        ) && attempt < retries;
      },
      ...fetchOptions
    } = options;

    const stopTimer = ClientPerformanceMonitor.startTimer(`api_${url}`);
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.executeRequest<T>(url, fetchOptions, timeout);
        stopTimer();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries && retryCondition(lastError, attempt)) {
          console.warn(`API request failed, retrying (${attempt + 1}/${retries}):`, {
            url,
            error: lastError.message,
            attempt: attempt + 1
          });

          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    stopTimer();
    ClientPerformanceMonitor.recordMetric(`api_${url}`, 0, true);
    throw lastError!;
  }

  private static async executeRequest<T>(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      // Handle API error responses
      if (data.success === false) {
        throw new ClientError(data.error || 'API request failed', data.code || 'API_ERROR');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(url, timeoutMs);
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network connection failed');
      }

      throw error;
    }
  }

  // Convenience methods for common HTTP operations
  static async get<T>(url: string, options?: RequestInit & {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    retryCondition?: (error: Error, attempt: number) => boolean;
  }): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  static async post<T>(url: string, data?: any, options?: RequestInit & {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    retryCondition?: (error: Error, attempt: number) => boolean;
  }): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      ...(data && { body: JSON.stringify(data) }),
    });
  }

  static async put<T>(url: string, data?: any, options?: RequestInit & {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    retryCondition?: (error: Error, attempt: number) => boolean;
  }): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      ...(data && { body: JSON.stringify(data) }),
    });
  }

  static async delete<T>(url: string, options?: RequestInit & {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    retryCondition?: (error: Error, attempt: number) => boolean;
  }): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// Connection status monitoring
export class ConnectionMonitor {
  private static listeners: Array<(online: boolean) => void> = [];
  private static isOnline = navigator.onLine;
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners(false);
    });

    this.initialized = true;
  }

  static addListener(callback: (online: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  static getStatus(): boolean {
    return this.isOnline;
  }

  private static notifyListeners(online: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.error('Error in connection status listener:', error);
      }
    });
  }
}

// Error boundary utilities
export class ErrorReporting {
  private static errorQueue: Array<{
    error: Error;
    context: Record<string, any>;
    timestamp: Date;
  }> = [];
  private static readonly MAX_QUEUE_SIZE = 50;

  static reportError(error: Error, context: Record<string, any> = {}): void {
    // Add to queue
    this.errorQueue.push({
      error,
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    });

    // Prevent memory leaks
    if (this.errorQueue.length > this.MAX_QUEUE_SIZE) {
      this.errorQueue.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', error, context);
    }
  }

  static getErrorQueue(): Array<{
    error: Error;
    context: Record<string, any>;
    timestamp: Date;
  }> {
    return [...this.errorQueue];
  }

  static clearErrorQueue(): void {
    this.errorQueue.length = 0;
  }
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitMs);
  };
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  };
}

// Initialize connection monitoring
ConnectionMonitor.initialize();
