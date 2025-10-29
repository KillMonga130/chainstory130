/**
 * Global loading overlay component with multiple loading states
 */

import React from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  className?: string;
  maxVisible?: number; // Maximum number of loading states to show at once
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  className = '',
  maxVisible = 3
}) => {
  const { loadingStates } = useLoading();

  // Filter and sort loading states
  const activeStates = loadingStates
    .filter(state => 
      state.type === 'loading' || 
      state.type === 'processing' || 
      state.type === 'saving' || 
      state.type === 'connecting' ||
      state.type === 'error' ||
      state.type === 'success'
    )
    .sort((a, b) => {
      // Prioritize errors and success messages
      if (a.type === 'error' && b.type !== 'error') return -1;
      if (b.type === 'error' && a.type !== 'error') return 1;
      if (a.type === 'success' && b.type !== 'success') return -1;
      if (b.type === 'success' && a.type !== 'success') return 1;
      
      // Then by start time (newest first)
      return b.startTime.getTime() - a.startTime.getTime();
    })
    .slice(0, maxVisible);

  if (activeStates.length === 0) {
    return null;
  }

  return (
    <div className={`loading-overlay ${className}`}>
      <div className="loading-overlay-backdrop" />
      <div className="loading-overlay-content">
        {activeStates.map((state, index) => (
          <div 
            key={state.id} 
            className={`loading-state-item ${state.type}`}
            style={{ 
              animationDelay: `${index * 100}ms`,
              zIndex: 1000 - index 
            }}
          >
            <LoadingSpinner
              message={state.message}
              progress={state.progress}
              type={state.type}
              size="medium"
              showElapsedTime={state.type === 'loading' || state.type === 'processing'}
              timeout={state.timeout}
            />
          </div>
        ))}
        
        {loadingStates.length > maxVisible && (
          <div className="loading-overflow-indicator">
            <span className="horror-text text-sm opacity-75">
              +{loadingStates.length - maxVisible} more operations...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Mini loading indicator for inline use
export const InlineLoadingIndicator: React.FC<{
  message?: string;
  size?: 'small' | 'medium';
  className?: string;
}> = ({ message, size = 'small', className = '' }) => {
  return (
    <div className={`inline-loading-indicator ${className}`}>
      <div className={`loading-dots ${size}`}>
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
      {message && (
        <span className="loading-text horror-text text-sm opacity-75">
          {message}
        </span>
      )}
    </div>
  );
};

// Connection status indicator
export const ConnectionStatusIndicator: React.FC<{
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  className?: string;
}> = ({ status, className = '' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: '🟢',
          text: 'Connected',
          color: 'text-horror-green'
        };
      case 'connecting':
        return {
          icon: '🟡',
          text: 'Connecting...',
          color: 'text-horror-orange'
        };
      case 'disconnected':
        return {
          icon: '🔴',
          text: 'Disconnected',
          color: 'text-horror-red'
        };
      case 'error':
        return {
          icon: '⚠️',
          text: 'Connection Error',
          color: 'text-horror-red'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`connection-status-indicator ${status} ${className}`}>
      <span className="status-icon">{config.icon}</span>
      <span className={`status-text horror-text text-sm ${config.color}`}>
        {config.text}
      </span>
      {status === 'connecting' && (
        <InlineLoadingIndicator size="small" />
      )}
    </div>
  );
};
