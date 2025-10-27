import React, { useState, useEffect } from 'react';

// Connection status indicator component
export const ConnectionStatus = ({ isOnline }: { isOnline: boolean }) => {
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowStatus(true);
    } else {
      // Show "back online" briefly, then hide
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showStatus) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-red-500 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-200' : 'bg-red-200 animate-pulse'}`} />
        <span className="text-sm font-medium">
          {isOnline ? 'Back online' : 'Connection lost'}
        </span>
      </div>
    </div>
  );
};

// Generic error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorMessage
          title="Something went wrong"
          message="An unexpected error occurred. Please refresh the page to try again."
          type="error"
          actions={[
            {
              label: 'Refresh Page',
              onClick: () => window.location.reload(),
              variant: 'primary'
            }
          ]}
        />
      );
    }

    return this.props.children;
  }
}

// Generic error message component
interface ErrorAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

interface ErrorMessageProps {
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  actions?: ErrorAction[];
  className?: string;
}

export const ErrorMessage = ({ 
  title, 
  message, 
  type = 'error', 
  actions = [], 
  className = '' 
}: ErrorMessageProps) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  return (
    <div className={`mobile-card rounded-lg border p-4 sm:p-6 ${getTypeStyles()} ${className}`}>
      <div className="flex items-start">
        <span className="mr-3 mt-0.5 text-lg">{getIcon()}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-sm sm:text-base mb-2">{title}</h3>
          <p className="text-xs sm:text-sm mb-4 leading-relaxed">{message}</p>
          
          {actions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={action.loading}
                  className={`touch-button px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100'
                  }`}
                >
                  {action.loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    action.label
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Network error component with retry functionality
interface NetworkErrorProps {
  onRetry: () => void;
  retrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export const NetworkError = ({ 
  onRetry, 
  retrying = false, 
  retryCount = 0, 
  maxRetries: _maxRetries = 3 
}: NetworkErrorProps) => {
  return (
    <ErrorMessage
      title="Connection Problem"
      message={
        retryCount > 0
          ? `Failed to connect after ${retryCount} attempt${retryCount > 1 ? 's' : ''}. Please check your internet connection and try again.`
          : "Unable to connect to the server. Please check your internet connection."
      }
      type="error"
      actions={[
        {
          label: retrying ? 'Retrying...' : 'Try Again',
          onClick: onRetry,
          variant: 'primary',
          loading: retrying
        }
      ]}
    />
  );
};

// Form validation error component
interface FormErrorProps {
  errors: string[];
  className?: string;
}

export const FormError = ({ errors, className = '' }: FormErrorProps) => {
  if (errors.length === 0) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-start">
        <span className="mr-2 mt-0.5 text-red-500">❌</span>
        <div className="flex-1">
          <p className="text-red-800 font-medium text-sm mb-1">Please fix the following errors:</p>
          <ul className="text-red-700 text-xs space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-1">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Real-time connection status component
interface RealTimeStatusProps {
  connected: boolean;
  reconnecting: boolean;
  onReconnect?: () => void;
}

export const RealTimeStatus = ({ connected, reconnecting, onReconnect }: RealTimeStatusProps) => {
  if (connected) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="mr-2 text-yellow-600">⚠️</span>
          <div>
            <p className="text-yellow-800 font-medium text-sm">
              {reconnecting ? 'Reconnecting...' : 'Real-time updates unavailable'}
            </p>
            <p className="text-yellow-700 text-xs mt-1">
              {reconnecting 
                ? 'Attempting to restore live updates'
                : 'You may need to refresh manually to see new content'
              }
            </p>
          </div>
        </div>
        {!reconnecting && onReconnect && (
          <button
            onClick={onReconnect}
            className="touch-button bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700 active:bg-yellow-800"
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
};
