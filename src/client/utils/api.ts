// API utilities with retry logic and error handling

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  retryable?: boolean;
}

// Create an API error with additional metadata
export const createApiError = (
  message: string,
  status?: number,
  code?: string,
  retryable = false
): ApiError => {
  const error = new Error(message) as ApiError;
  if (status !== undefined) error.status = status;
  if (code !== undefined) error.code = code;
  error.retryable = retryable;
  return error;
};

// Check if an error is retryable
export const isRetryableError = (error: Error): boolean => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true; // Network errors
  }

  const apiError = error as ApiError;
  if (apiError.retryable !== undefined) {
    return apiError.retryable;
  }

  // Retry on specific HTTP status codes
  if (apiError.status) {
    return [408, 429, 500, 502, 503, 504].includes(apiError.status);
  }

  return false;
};

// Sleep utility for delays
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Calculate exponential backoff delay with jitter
const calculateDelay = (
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number => {
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
};

// Fetch with retry logic
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryCondition = isRetryableError,
  } = retryOptions;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        ...(options.signal && { signal: options.signal }), // Preserve abort signal if defined
      });

      // Handle HTTP errors
      if (!response.ok) {
        const isRetryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        throw createApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          'HTTP_ERROR',
          isRetryable
        );
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !retryCondition(lastError)) {
        throw lastError;
      }

      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier);
      await sleep(delay);
    }
  }

  throw lastError!;
};

// Typed API response handler
export const handleApiResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    throw createApiError(
      'Invalid response format: expected JSON',
      response.status,
      'INVALID_RESPONSE_FORMAT'
    );
  }

  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    throw createApiError('Failed to parse JSON response', response.status, 'JSON_PARSE_ERROR');
  }
};

// Combined fetch with retry and JSON parsing
export const apiRequest = async <T>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> => {
  const response = await fetchWithRetry(url, options, retryOptions);
  return handleApiResponse<T>(response);
};

// Network status detection
export const checkNetworkStatus = (): boolean => {
  return navigator.onLine;
};

// Create abort controller with timeout
export const createAbortController = (timeoutMs?: number): AbortController => {
  const controller = new AbortController();

  if (timeoutMs) {
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  return controller;
};

// Validate API response structure
export const validateApiResponse = <T>(
  data: unknown,
  validator: (data: unknown) => data is T
): T => {
  if (!validator(data)) {
    throw createApiError('Invalid API response structure', undefined, 'INVALID_RESPONSE_STRUCTURE');
  }
  return data;
};
