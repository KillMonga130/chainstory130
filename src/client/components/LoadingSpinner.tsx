import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  progress?: number; // 0-100
  type?: 'loading' | 'processing' | 'saving' | 'connecting' | 'error' | 'success';
  timeout?: number; // Show timeout warning after this many ms
  showElapsedTime?: boolean;
  onTimeout?: () => void;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 'medium',
  className = '',
  progress,
  type = 'loading',
  timeout,
  showElapsedTime = false,
  onTimeout,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);
      
      // Show timeout warning at 80% of timeout duration
      if (timeout && elapsed > timeout * 0.8 && !showTimeoutWarning) {
        setShowTimeoutWarning(true);
      }
      
      // Trigger timeout callback
      if (timeout && elapsed > timeout) {
        onTimeout?.();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeout, onTimeout, showTimeoutWarning]);

  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'spinner-small';
      case 'large':
        return 'spinner-large';
      default:
        return 'spinner-medium';
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'error':
        return 'spinner-error';
      case 'success':
        return 'spinner-success';
      case 'processing':
        return 'spinner-processing';
      case 'saving':
        return 'spinner-saving';
      case 'connecting':
        return 'spinner-connecting';
      default:
        return 'spinner-loading';
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'error':
        return '⚠️';
      case 'success':
        return '✅';
      case 'processing':
        return '⚙️';
      case 'saving':
        return '💾';
      case 'connecting':
        return '🔗';
      default:
        return null;
    }
  };

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const shouldShowSpinner = type === 'loading' || type === 'processing' || type === 'saving' || type === 'connecting';

  return (
    <div className={`loading-spinner-container ${getTypeClass()} ${className}`}>
      {shouldShowSpinner ? (
        <div className={`loading-spinner ${getSizeClass()}`}>
          <div className="spinner-ring" />
          <div className="spinner-ring" />
          <div className="spinner-ring" />
        </div>
      ) : (
        <div className={`status-icon ${getSizeClass()}`}>
          {getTypeIcon()}
        </div>
      )}

      <div className="loading-content">
        {message && (
          <p className={`loading-message horror-text ${type === 'error' ? 'text-horror-red' : type === 'success' ? 'text-horror-green' : ''}`}>
            {message}
          </p>
        )}

        {progress !== undefined && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(progress)}%</span>
          </div>
        )}

        {showElapsedTime && elapsedTime > 1000 && (
          <p className="elapsed-time horror-text text-sm opacity-75">
            {formatElapsedTime(elapsedTime)}
          </p>
        )}

        {showTimeoutWarning && (
          <p className="timeout-warning horror-text text-horror-orange text-sm">
            This is taking longer than expected...
          </p>
        )}
      </div>
    </div>
  );
};
