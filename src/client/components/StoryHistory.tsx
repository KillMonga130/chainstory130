import React, { useState } from 'react';
import { StoryChapter, StoryPath } from '../../shared/types/story';
import { VotingStats } from '../../shared/types/voting';

interface StoryHistoryProps {
  path: StoryPath;
  chapters: StoryChapter[];
  decisions: Array<{
    chapterId: string;
    winningChoice: string;
    voteStats: VotingStats;
  }>;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const StoryHistory: React.FC<StoryHistoryProps> = ({
  path,
  chapters,
  decisions,
  isOpen,
  onToggle,
  className = ''
}) => {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  const getChapterById = (chapterId: string): StoryChapter | undefined => {
    return chapters.find(chapter => chapter.id === chapterId);
  };

  const getDecisionForChapter = (chapterId: string) => {
    return decisions.find(decision => decision.chapterId === chapterId);
  };

  const renderChapterSummary = (chapterId: string, index: number) => {
    const chapter = getChapterById(chapterId);
    const decision = getDecisionForChapter(chapterId);
    
    if (!chapter) return null;

    const isSelected = selectedChapter === chapterId;

    return (
      <div key={chapterId} className="history-chapter">
        <button
          className={`chapter-summary ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedChapter(isSelected ? null : chapterId)}
        >
          <div className="chapter-header">
            <span className="chapter-number">Chapter {index + 1}</span>
            <span className="chapter-title">{chapter.title}</span>
          </div>
          
          {decision && (
            <div className="decision-summary">
              <span className="winning-choice">"{decision.winningChoice}"</span>
              <span className="vote-count">
                {decision.voteStats.totalVotes} votes ({decision.voteStats.winningPercentage.toFixed(1)}%)
              </span>
            </div>
          )}
        </button>

        {isSelected && (
          <div className="chapter-details slide-up-animation">
            <div className="chapter-content">
              <p className="horror-text text-sm">
                {chapter.content.length > 200 
                  ? `${chapter.content.substring(0, 200)}...` 
                  : chapter.content
                }
              </p>
            </div>
            
            {decision && (
              <div className="decision-details">
                <h5 className="horror-text font-semibold text-xs mb-2">Community Decision:</h5>
                <div className="decision-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Votes:</span>
                    <span className="stat-value">{decision.voteStats.totalVotes}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Unique Voters:</span>
                    <span className="stat-value">{decision.voteStats.uniqueVoters}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Winning Choice:</span>
                    <span className="stat-value">"{decision.winningChoice}"</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Win Percentage:</span>
                    <span className="stat-value">{decision.voteStats.winningPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPathSummary = () => {
    return (
      <div className="path-summary">
        <h4 className="horror-subtitle text-sm mb-3">Story Path</h4>
        <div className="path-visualization">
          {path.chapters.map((_, index) => (
            <div key={index} className="path-node">
              <div className="node-dot" />
              {index < path.decisions.length && (
                <div className="path-connection">
                  <span className="decision-label">
                    {path.decisions[index]}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className="history-toggle horror-button"
        onClick={onToggle}
        title={isOpen ? 'Close History' : 'View Story History'}
      >
        <span className="toggle-icon">
          {isOpen ? '✕' : '📖'}
        </span>
      </button>

      {/* History Sidebar */}
      <div className={`story-history ${isOpen ? 'open' : ''} ${className}`}>
        <div className="history-header">
          <h3 className="horror-subtitle">Story History</h3>
          <button
            className="close-button"
            onClick={onToggle}
            title="Close History"
          >
            ✕
          </button>
        </div>

        <div className="history-content mobile-scroll">
          {/* Path Summary */}
          {renderPathSummary()}

          {/* Chapter History */}
          <div className="chapters-history">
            <h4 className="horror-text font-semibold mb-3">Chapters</h4>
            <div className="chapters-list">
              {path.chapters.map((chapterId, index) => 
                renderChapterSummary(chapterId, index)
              )}
            </div>
          </div>

          {/* Story Ending */}
          {path.ending && (
            <div className="story-ending">
              <h4 className="horror-subtitle text-sm mb-3">Story Ending</h4>
              <div className="ending-card horror-card">
                <h5 className="ending-title">{path.ending.title}</h5>
                <p className="ending-type">Type: {path.ending.type}</p>
                <p className="horror-text text-sm mt-2">
                  {path.ending.content}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="history-overlay"
          onClick={onToggle}
        />
      )}

      
    </>
  );
};

