import React from 'react';
import { StoryProgression } from '../../shared/types/story';

interface StoryProgressProps {
  progression: StoryProgression;
  className?: string;
}

export const StoryProgress: React.FC<StoryProgressProps> = ({ 
  progression, 
  className = '' 
}) => {
  const { totalChapters, currentPosition, progressPercentage, completedPaths, availablePaths } = progression;

  const renderProgressDots = () => {
    const dots = [];
    for (let i = 0; i < totalChapters; i++) {
      const isActive = i === currentPosition;
      const isCompleted = i < currentPosition;
      
      dots.push(
        <div
          key={i}
          className={`progress-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          title={`Chapter ${i + 1}`}
        />
      );
    }
    return dots;
  };

  const renderProgressBar = () => {
    return (
      <div className="progress-bar-container">
        <div className="progress-bar-track">
          <div 
            className="progress-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-percentage">
          {progressPercentage}% Complete
        </div>
      </div>
    );
  };

  return (
    <div className={`story-progress ${className}`}>
      <div className="progress-header">
        <h3 className="horror-subtitle text-center">Story Progress</h3>
      </div>

      {/* Progress Bar */}
      <div className="progress-section mb-6">
        {renderProgressBar()}
      </div>

      {/* Progress Dots */}
      <div className="progress-indicator">
        {renderProgressDots()}
      </div>

      {/* Chapter Info */}
      <div className="chapter-info text-center mt-4">
        <p className="horror-text text-sm">
          Chapter <span className="font-bold text-horror-orange">{currentPosition + 1}</span> of{' '}
          <span className="font-bold">{totalChapters}</span>
        </p>
      </div>

      {/* Path Information */}
      {(completedPaths.length > 0 || availablePaths.length > 0) && (
        <div className="path-info mt-6">
          <div className="horror-card">
            <h4 className="horror-text font-semibold mb-3 text-center">Narrative Paths</h4>
            
            {completedPaths.length > 0 && (
              <div className="completed-paths mb-3">
                <p className="horror-text text-xs mb-2 opacity-75">Paths Taken:</p>
                <div className="path-list">
                  {completedPaths.map((path, index) => (
                    <span key={index} className="path-tag completed">
                      {path}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {availablePaths.length > 0 && (
              <div className="available-paths">
                <p className="horror-text text-xs mb-2 opacity-75">Available Paths:</p>
                <div className="path-list">
                  {availablePaths.map((path, index) => (
                    <span key={index} className="path-tag available">
                      {path}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      
    </div>
  );
};

