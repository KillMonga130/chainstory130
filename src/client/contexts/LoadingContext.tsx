/**
 * Enhanced loading state management with user feedback
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface LoadingState {
  id: string;
  message: string;
  progress?: number | undefined;
  type: 'loading' | 'processing' | 'saving' | 'connecting' | 'error' | 'success';
  startTime: Date;
  timeout?: number | undefined;
}

interface LoadingContextType {
  loadingStates: LoadingState[];
  isLoading: boolean;
  startLoading: (id: string, message: string, options?: {
    progress?: number;
    type?: LoadingState['type'];
    timeout?: number;
  }) => void;
  updateLoading: (id: string, updates: Partial<Pick<LoadingState, 'message' | 'progress' | 'type'>>) => void;
  stopLoading: (id: string) => void;
  clearAllLoading: () => void;
  getLoadingState: (id: string) => LoadingState | undefined;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: React.ReactNode;
  globalTimeout?: number; // Default timeout for all loading states
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ 
  children, 
  globalTimeout = 30000 // 30 seconds default timeout
}) => {
  const [loadingStates, setLoadingStates] = useState<LoadingState[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const startLoading = useCallback((
    id: string, 
    message: string, 
    options: {
      progress?: number;
      type?: LoadingState['type'];
      timeout?: number;
    } = {}
  ) => {
    const { progress, type = 'loading', timeout = globalTimeout } = options;

    // Clear existing timeout for this ID
    const existingTimeout = timeoutRefs.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const newState: LoadingState = {
      id,
      message,
      ...(progress !== undefined && { progress }),
      type,
      startTime: new Date(),
      ...(timeout > 0 && { timeout })
    };

    setLoadingStates(prev => {
      const filtered = prev.filter(state => state.id !== id);
      return [...filtered, newState];
    });

    // Set timeout if specified
    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        updateLoading(id, { 
          type: 'error', 
          message: `Operation timed out after ${timeout / 1000} seconds` 
        });
        
        // Auto-remove after showing error for 3 seconds
        setTimeout(() => stopLoading(id), 3000);
      }, timeout);
      
      timeoutRefs.current.set(id, timeoutId);
    }
  }, [globalTimeout]);

  const updateLoading = useCallback((
    id: string, 
    updates: Partial<Pick<LoadingState, 'message' | 'progress' | 'type'>>
  ) => {
    setLoadingStates(prev => 
      prev.map(state => 
        state.id === id ? { ...state, ...updates } : state
      )
    );
  }, []);

  const stopLoading = useCallback((id: string) => {
    // Clear timeout
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }

    setLoadingStates(prev => prev.filter(state => state.id !== id));
  }, []);

  const clearAllLoading = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    
    setLoadingStates([]);
  }, []);

  const getLoadingState = useCallback((id: string) => {
    return loadingStates.find(state => state.id === id);
  }, [loadingStates]);

  const isLoading = loadingStates.some(state => 
    state.type === 'loading' || state.type === 'processing' || state.type === 'saving' || state.type === 'connecting'
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  const value: LoadingContextType = {
    loadingStates,
    isLoading,
    startLoading,
    updateLoading,
    stopLoading,
    clearAllLoading,
    getLoadingState
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// Hook for managing a specific loading operation
export const useLoadingOperation = (id: string) => {
  const { startLoading, updateLoading, stopLoading, getLoadingState } = useLoading();

  const start = useCallback((message: string, options?: Parameters<typeof startLoading>[2]) => {
    startLoading(id, message, options);
  }, [id, startLoading]);

  const update = useCallback((updates: Parameters<typeof updateLoading>[1]) => {
    updateLoading(id, updates);
  }, [id, updateLoading]);

  const stop = useCallback(() => {
    stopLoading(id);
  }, [id, stopLoading]);

  const state = getLoadingState(id);

  return {
    start,
    update,
    stop,
    state,
    isActive: !!state
  };
};

// Hook for async operations with automatic loading management
export const useAsyncOperation = <T extends any[], R>(
  id: string,
  operation: (...args: T) => Promise<R>,
  options: {
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
    timeout?: number;
    onSuccess?: (result: R) => void;
    onError?: (error: Error) => void;
  } = {}
) => {
  const { start, update, stop } = useLoadingOperation(id);
  const [result, setResult] = useState<R | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: T): Promise<R> => {
    try {
      setError(null);
      setResult(null);
      
      start(options.loadingMessage || 'Processing...', {
        type: 'processing',
        ...(options.timeout && { timeout: options.timeout })
      });

      const result = await operation(...args);
      
      if (options.successMessage) {
        update({ type: 'success', message: options.successMessage });
        setTimeout(stop, 2000); // Show success for 2 seconds
      } else {
        stop();
      }

      setResult(result);
      options.onSuccess?.(result);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      
      update({ 
        type: 'error', 
        message: options.errorMessage || error.message 
      });
      
      // Auto-hide error after 5 seconds
      setTimeout(stop, 5000);
      
      options.onError?.(error);
      throw error;
    }
  }, [operation, start, update, stop, options]);

  return {
    execute,
    result,
    error,
    isLoading: !!useLoadingOperation(id).state
  };
};
