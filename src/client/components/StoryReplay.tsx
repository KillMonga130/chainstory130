/**
 * Story Replay Component - Handles story restart and replay functionality
 */

import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';
import './StoryReplay.css';

interface StoryBranch {
  branchId: string;
  title: string;
  description: string;
  isCompleted: boolean;
  choices: Array<{
    id: string;
    text: string;
    description?: string;
  }>;
}

interface ReplayData {
  pathId: string;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    choices: Array<{
      id: string;
      text: string;
      description?: string;
    }>;
  }>;
  decisions: string[];
  ending?: any;
}

interface CompletedPathsData {
  completedPaths: string[];
  totalCompleted: number;
  stats: {
    totalChapters: number;
    completedPaths: number;
    availableBranches: number;
  };
}

interface StoryReplayProps {
  onRestart?: (chapter: any, context: any) => void;
  onClose?: () => void;
}

export const StoryReplay: React.FC<StoryReplayProps> = ({ onRestart, onClose }) => {
  const [activeTab, setActiveTab] = useState<'branches' | 'completed' | 'replay'>('branches');
  const [branches, setBranches] = useState<StoryBranch[]>([]);
  const [completedPaths, setCompletedPaths] = useState<CompletedPathsData | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches and completed paths on mount
  useEffect(() => {
    loadBranches();
    loadCompletedPaths();
  }, []);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/story/branches');
      const result = await response.json();

      if (result.success) {
        setBranches(result.data.branches);
      } else {
        setError('Failed to load story branches');
      }
    } catch (err) {
      setError('Error loading story branches');
      console.error('Error loading branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedPaths = async () => {
    try {
      const response = await fetch('/api/story/completed');
      const result = await response.json();

      if (result.success) {
        setCompletedPaths(result.data);
      } else {
        console.warn('Failed to load completed paths');
      }
    } catch (err) {
      console.error('Error loading completed paths:', err);
    }
  };

  const loadReplayData = async (pathId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/story/replay/${pathId}`);
      const result = await response.json();

      if (result.success) {
        setReplayData(result.data);
        setActiveTab('replay');
      } else {
        setError('Failed to load replay data');
      }
    } catch (err) {
      setError('Error loading replay data');
      console.error('Error loading replay:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (preserveHistory: boolean = true) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/story/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preserveHistory }),
      });

      const result = await response.json();

      if (result.success) {
        // Notify parent component about restart
        if (onRestart) {
          onRestart(result.data.chapter, result.data.context);
        }

        // Refresh data
        await loadBranches();
        await loadCompletedPaths();

        // Close the replay interface
        if (onClose) {
          onClose();
        }
      } else {
        setError('Failed to restart story');
      }
    } catch (err) {
      setError('Error restarting story');
      console.error('Error restarting story:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderBranches = () => (
    <div className="story-branches">
      <div className="branches-header">
        <h3>Alternative Story Paths</h3>
        <p>Explore different narrative branches and see where each path leads.</p>
      </div>

      {branches.length === 0 ? (
        <div className="no-branches">
          <p>No alternative branches available yet.</p>
        </div>
      ) : (
        <div className="branches-grid">
          {branches.map((branch) => (
            <div
              key={branch.branchId}
              className={`branch-card ${branch.isCompleted ? 'completed' : 'available'}`}
            >
              <div className="branch-header">
                <h4>{branch.title}</h4>
                {branch.isCompleted && <span className="completed-badge">✓ Completed</span>}
              </div>

              <p className="branch-description">{branch.description}</p>

              <div className="branch-choices">
                <h5>Available Choices:</h5>
                <ul>
                  {branch.choices.map((choice) => (
                    <li key={choice.id}>
                      <strong>{choice.text}</strong>
                      {choice.description && (
                        <span className="choice-desc"> - {choice.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {branch.isCompleted && (
                <button className="replay-button" onClick={() => loadReplayData(branch.branchId)}>
                  View Replay
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCompleted = () => (
    <div className="completed-paths">
      <div className="completed-header">
        <h3>Completed Story Paths</h3>
        {completedPaths && (
          <div className="completion-stats">
            <div className="stat">
              <span className="stat-number">{completedPaths.totalCompleted}</span>
              <span className="stat-label">Paths Completed</span>
            </div>
            <div className="stat">
              <span className="stat-number">{completedPaths.stats.availableBranches}</span>
              <span className="stat-label">Total Branches</span>
            </div>
            <div className="stat">
              <span className="stat-number">{completedPaths.stats.totalChapters}</span>
              <span className="stat-label">Chapters Explored</span>
            </div>
          </div>
        )}
      </div>

      {!completedPaths || completedPaths.completedPaths.length === 0 ? (
        <div className="no-completed">
          <p>No completed paths yet. Finish a story to see it here!</p>
        </div>
      ) : (
        <div className="completed-list">
          {completedPaths.completedPaths.map((pathId, index) => (
            <div key={pathId} className="completed-path-item">
              <div className="path-info">
                <h4>Path #{index + 1}</h4>
                <p className="path-id">{pathId}</p>
              </div>
              <button className="replay-button" onClick={() => loadReplayData(pathId)}>
                View Replay
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReplay = () => {
    if (!replayData) return null;

    return (
      <div className="story-replay">
        <div className="replay-header">
          <button className="back-button" onClick={() => setActiveTab('completed')}>
            ← Back to Completed Paths
          </button>
          <h3>Story Replay: {replayData.pathId}</h3>
        </div>

        <div className="replay-content">
          {replayData.chapters.map((chapter, index) => (
            <div key={chapter.id} className="replay-chapter">
              <div className="chapter-header">
                <h4>{chapter.title}</h4>
                <span className="chapter-number">Chapter {index + 1}</span>
              </div>

              <div className="chapter-content">
                <p>{chapter.content}</p>
              </div>

              <div className="chapter-choices">
                <h5>Available Choices:</h5>
                <ul>
                  {chapter.choices.map((choice) => (
                    <li
                      key={choice.id}
                      className={replayData.decisions[index] === choice.id ? 'chosen' : ''}
                    >
                      {replayData.decisions[index] === choice.id && (
                        <span className="chosen-indicator">→ </span>
                      )}
                      <strong>{choice.text}</strong>
                      {choice.description && (
                        <span className="choice-desc"> - {choice.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {replayData.ending && (
            <div className="replay-ending">
              <h4>Story Ending</h4>
              <p>{replayData.ending.content}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className="story-replay-container">
        <div className="replay-modal">
          <div className="modal-header">
            <h2>Story Management</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="modal-content">
            {/* Restart Section */}
            <div className="restart-section">
              <h3>Restart Story</h3>
              <p>Begin a new journey through the haunted thread.</p>
              <div className="restart-buttons">
                <button
                  className="restart-button preserve"
                  onClick={() => handleRestart(true)}
                  disabled={loading}
                >
                  Restart (Keep History)
                </button>
                <button
                  className="restart-button fresh"
                  onClick={() => handleRestart(false)}
                  disabled={loading}
                >
                  Fresh Start
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button
                className={`tab-button ${activeTab === 'branches' ? 'active' : ''}`}
                onClick={() => setActiveTab('branches')}
              >
                Story Branches
              </button>
              <button
                className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                Completed Paths
              </button>
              {replayData && (
                <button
                  className={`tab-button ${activeTab === 'replay' ? 'active' : ''}`}
                  onClick={() => setActiveTab('replay')}
                >
                  Replay
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="tab-content">
              {loading && <LoadingSpinner />}
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                  <button onClick={() => setError(null)}>Dismiss</button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {activeTab === 'branches' && renderBranches()}
                  {activeTab === 'completed' && renderCompleted()}
                  {activeTab === 'replay' && renderReplay()}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default StoryReplay;
