import { useState, useEffect } from 'react';
import { navigateTo } from '@devvit/web/client';
import {
  StoryChapter,
  VotingInterface,
  StoryProgress,
  StoryHistory,
  StoryReplay,
  LoadingSpinner,
  ErrorBoundary,
  ParticleEffects,
  Transition,
  AdminInterface,
  ContentReportButton,
} from './components/index';
import { LoadingOverlay } from './components/LoadingOverlay';
import { useStory } from './hooks/useStory';
import { useVoting } from './hooks/useVoting';
import { useRealtime } from './hooks/useRealtime';
import { useSynchronizedState } from './hooks/useSynchronizedState';
import { useConcurrentInteractions } from './hooks/useConcurrentInteractions';
import { ModerationProvider, useModeration } from './contexts/ModerationContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { ConnectionMonitor, ClientPerformanceMonitor } from './utils/error-handler';

const AppContent = () => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showReplayInterface, setShowReplayInterface] = useState(false);
  const [postId] = useState('haunted-thread-demo'); // This should come from Devvit context
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [showResetStoryModal, setShowResetStoryModal] = useState(false);
  const [showResetVotingModal, setShowResetVotingModal] = useState(false);
  const [resetAdminKey, setResetAdminKey] = useState('');

  const { showAdminInterface, setShowAdminInterface, adminKey, setAdminKey, moderationEnabled } =
    useModeration();

  const {
    currentChapter: storyChapter,
    context,
    progression,
    votingActive: storyVotingActive,
    loading: storyLoading,
    error: storyError,
    refreshStory,
  } = useStory();

  const {
    voteCounts: originalVoteCounts,
    userVoteStatus: originalUserVoteStatus,
    loading: votingLoading,
    error: votingError,
    castVote: originalCastVote,
    refreshVoteCounts,
    refreshVoteStatus,
  } = useVoting();

  // Synchronized state management
  const {
    state: syncState,
    updateState: updateSyncState,
    handleVoteUpdate,
    handleChapterTransition,
    handleStoryReset,
    handleVotingEnded,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    hasOptimisticUpdates,
  } = useSynchronizedState({
    currentChapter: storyChapter,
    context,
    voteCounts: originalVoteCounts,
    userVoteStatus: originalUserVoteStatus,
    votingActive: storyVotingActive,
  });

  // Concurrent interactions management
  const { isProcessing, pendingActionsCount, queueAction, clearQueue } =
    useConcurrentInteractions();

  // Use synchronized state values
  const currentChapter = syncState.currentChapter;
  const voteCounts = syncState.voteCounts;
  const userVoteStatus = syncState.userVoteStatus;
  const votingActive = syncState.votingActive;

  // Set up realtime updates with synchronized state handlers
  const { connectionStatus, reconnect } = useRealtime({
    postId,
    onVoteUpdate: handleVoteUpdate,
    onChapterTransition: handleChapterTransition,
    onStoryReset: handleStoryReset,
    onVotingEnded: handleVotingEnded,
    onError: (error) => {
      console.error('Realtime connection error:', error);
    },
  });

  // Fallback polling when realtime is not available
  useEffect(() => {
    if ((connectionStatus === 'disconnected' || connectionStatus === 'error') && currentChapter) {
      const pollInterval = setInterval(() => {
        refreshVoteCounts(currentChapter.id);
        refreshVoteStatus(currentChapter.id);
      }, 3000); // Poll every 3 seconds

      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [connectionStatus, currentChapter, refreshVoteCounts, refreshVoteStatus]);

  // Refresh vote data when chapter changes
  useEffect(() => {
    if (currentChapter) {
      console.log('📖 Chapter changed to:', currentChapter.id);
      console.log('🔄 Refreshing vote data for new chapter...');

      // Clear any pending actions for the old chapter
      clearQueue();

      // Refresh vote data for the new chapter
      refreshVoteCounts(currentChapter.id);
      refreshVoteStatus(currentChapter.id);
    }
  }, [currentChapter?.id, refreshVoteCounts, refreshVoteStatus, clearQueue]);

  // Initialize performance monitoring and connection monitoring
  useEffect(() => {
    const stopTimer = ClientPerformanceMonitor.startTimer('app_initialization');

    // Set up connection monitoring
    const unsubscribe = ConnectionMonitor.addListener((online) => {
      if (!online) {
        console.warn('Network connection lost');
      } else {
        console.log('Network connection restored');
      }
    });

    // Performance monitoring - log app startup
    ClientPerformanceMonitor.recordMetric('app_startup', performance.now(), false);

    stopTimer();

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync external state changes to synchronized state
  useEffect(() => {
    updateSyncState({
      currentChapter: storyChapter,
      context,
      votingActive: storyVotingActive,
    });
  }, [storyChapter, context, storyVotingActive, updateSyncState]);

  useEffect(() => {
    updateSyncState({
      voteCounts: originalVoteCounts,
      userVoteStatus: originalUserVoteStatus,
    });
  }, [originalVoteCounts, originalUserVoteStatus, updateSyncState]);

  // Enhanced vote handler with optimistic updates and concurrent interaction management
  const handleVote = async (choiceId: string) => {
    if (!currentChapter) return;

    console.log('Attempting to cast vote:', { chapterId: currentChapter.id, choiceId });

    try {
      await queueAction('vote', { chapterId: currentChapter.id, choiceId }, async () => {
        // Apply optimistic update
        const optimisticUpdateId = `vote_${currentChapter.id}_${choiceId}_${Date.now()}`;

        applyOptimisticUpdate({
          id: optimisticUpdateId,
          type: 'vote',
          data: { chapterId: currentChapter.id, choiceId },
          rollback: () => {
            // Rollback logic would restore previous state
            console.log('Rolling back optimistic vote update');
          },
        });

        try {
          // Execute the actual vote
          console.log('Calling originalCastVote...');
          await originalCastVote(currentChapter.id, choiceId);
          console.log('Vote cast successfully!');

          // Refresh vote counts immediately since realtime might not be working
          setTimeout(() => {
            console.log('Refreshing vote counts after vote...');
            refreshVoteCounts(currentChapter.id);
          }, 1000);

          // The optimistic update will be cleared when the server response comes through realtime
          return { success: true };
        } catch (error) {
          console.error('Error in originalCastVote:', error);
          // Rollback optimistic update on error
          rollbackOptimisticUpdate(optimisticUpdateId);
          throw error;
        }
      });
    } catch (error) {
      console.error('Failed to cast vote:', error);
    }
  };

  // Handle story restart from replay interface
  const handleStoryRestart = (chapter: any, context: any) => {
    // Update the synchronized state with the new chapter and context
    updateSyncState({
      currentChapter: chapter,
      context: context,
      votingActive: true,
    });

    // Refresh the story to ensure consistency
    refreshStory();

    // Close the replay interface
    setShowReplayInterface(false);
  };

  // Show loading state
  if (storyLoading && !currentChapter) {
    return (
      <div className="story-container">
        <LoadingSpinner
          message="Loading The Haunted Thread..."
          size="large"
          className="horror-pulse"
        />
      </div>
    );
  }

  // Show error state
  if (storyError && !currentChapter) {
    return (
      <ErrorBoundary>
        <div className="story-container">
          <div className="horror-card text-center">
            <div className="text-6xl mb-4">💀</div>
            <h2 className="horror-subtitle">The Darkness Consumed the Story</h2>
            <p className="horror-text mb-6">{storyError}</p>
            <button className="horror-button" onClick={refreshStory}>
              🔄 Try Again
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const handleAdminLogin = () => {
    if (adminKeyInput.trim()) {
      setAdminKey(adminKeyInput.trim());
      setShowAdminInterface(true);
      setShowAdminLogin(false);
      setAdminKeyInput('');
    }
  };

  const handleAdminLogout = () => {
    setAdminKey('');
    setShowAdminInterface(false);
  };

  return (
    <ErrorBoundary>
      <div className="story-container">
        {/* Admin Interface */}
        {showAdminInterface && adminKey && (
          <AdminInterface adminKey={adminKey} onClose={handleAdminLogout} />
        )}

        {/* Story Replay Interface */}
        {showReplayInterface && (
          <StoryReplay
            onRestart={handleStoryRestart}
            onClose={() => setShowReplayInterface(false)}
          />
        )}

        {/* Admin Login Modal */}
        {showAdminLogin && (
          <div className="admin-login-modal">
            <div className="admin-login-content">
              <h3>Administrator Access</h3>
              <div className="form-group">
                <label>Admin Key:</label>
                <input
                  type="password"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="Enter admin key"
                  autoFocus
                />
              </div>
              <div className="admin-login-actions">
                <button onClick={handleAdminLogin} disabled={!adminKeyInput.trim()}>
                  Login
                </button>
                <button onClick={() => setShowAdminLogin(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Atmospheric Particle Effects */}
        <ParticleEffects type="fog" intensity="low" />
        <ParticleEffects type="shadows" intensity="medium" />

        {/* Story Header */}
        <Transition type="horror-fade" delay={200}>
          <div className="story-header">
            <h1 className="horror-title flicker-animation">The Haunted Thread</h1>
            <p className="horror-text text-center opacity-75 eerie-sway">
              A community-driven horror experience where your choices shape the nightmare...
            </p>

            {/* Control Buttons */}
            <div className="story-controls">
              {/* Story Replay Button */}
              <button
                onClick={() => setShowReplayInterface(true)}
                className="story-control-button"
                title="Story Management & Replay"
              >
                🔄
              </button>

              {/* Admin Access Button */}
              {!showAdminInterface ? (
                <button
                  onClick={() => setShowAdminLogin(true)}
                  className="story-control-button admin-access-button"
                  title="Administrator Access"
                >
                  ⚙️
                </button>
              ) : (
                <button
                  onClick={handleAdminLogout}
                  className="story-control-button admin-access-button active"
                  title="Exit Admin Mode"
                >
                  👑
                </button>
              )}
            </div>
          </div>
        </Transition>

        {/* Story Progress */}
        {progression && (
          <Transition type="slide" delay={400}>
            <StoryProgress progression={progression} />
          </Transition>
        )}

        {/* Current Chapter */}
        {currentChapter && (
          <Transition type="chapter-transition" delay={600}>
            <div className="chapter-container">
              <StoryChapter chapter={currentChapter} className="horror-entrance shadow-dance" />

              {/* Content Moderation */}
              {moderationEnabled && (
                <div className="chapter-moderation">
                  <ContentReportButton
                    contentType="chapter"
                    contentId={currentChapter.id}
                    className="chapter-report"
                  />
                </div>
              )}
            </div>
          </Transition>
        )}

        {/* Voting Interface */}
        {currentChapter && (
          <Transition type="slide" delay={800}>
            <VotingInterface
              choices={currentChapter.choices}
              voteCounts={voteCounts}
              userVoteStatus={userVoteStatus}
              votingActive={votingActive}
              onVote={handleVote}
              isLoading={votingLoading}
              className="creepy-pulse"
            />
          </Transition>
        )}

        {/* Admin Controls */}
        <div className="text-center mt-6 mb-4 flex gap-2 justify-center flex-wrap">
          <button
            className="horror-button-small opacity-50 hover:opacity-100 transition-opacity"
            onClick={() => {
              setResetAdminKey('');
              setShowResetStoryModal(true);
            }}
            title="Reset story to beginning (requires admin key)"
          >
            🔄 Reset Story
          </button>

          {currentChapter && (
            <button
              className="horror-button-small opacity-50 hover:opacity-100 transition-opacity"
              onClick={() => {
                setResetAdminKey('');
                setShowResetVotingModal(true);
              }}
              title="Reset voting for current chapter (requires admin key)"
            >
              🗳️ Reset Voting
            </button>
          )}
        </div>

        {/* Reset Story Modal */}
        {showResetStoryModal && (
          <div className="admin-login-modal">
            <div className="admin-login-content">
              <h3>Reset Story</h3>
              <p className="horror-text text-sm mb-4">
                This will reset the entire story to the beginning. All progress will be lost.
              </p>
              <div className="form-group">
                <label>Admin Key:</label>
                <input
                  type="password"
                  value={resetAdminKey}
                  onChange={(e) => setResetAdminKey(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && resetAdminKey.trim()) {
                      try {
                        const response = await fetch('/api/admin/reset', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            adminKey: resetAdminKey,
                            reason: 'Manual reset from UI',
                          }),
                        });
                        const result = await response.json();

                        if (result.success) {
                          window.location.reload();
                        } else {
                          alert('Reset failed: ' + result.message);
                        }
                      } catch (error) {
                        alert('Error resetting story: ' + error);
                      }
                    }
                  }}
                  placeholder="Enter admin key"
                  autoFocus
                />
              </div>
              <div className="admin-login-actions">
                <button
                  onClick={async () => {
                    if (!resetAdminKey.trim()) return;

                    try {
                      const response = await fetch('/api/admin/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          adminKey: resetAdminKey,
                          reason: 'Manual reset from UI',
                        }),
                      });
                      const result = await response.json();

                      if (result.success) {
                        window.location.reload();
                      } else {
                        alert('Reset failed: ' + result.message);
                      }
                    } catch (error) {
                      alert('Error resetting story: ' + error);
                    }
                  }}
                  disabled={!resetAdminKey.trim()}
                >
                  Reset Story
                </button>
                <button onClick={() => setShowResetStoryModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Voting Modal */}
        {showResetVotingModal && currentChapter && (
          <div className="admin-login-modal">
            <div className="admin-login-content">
              <h3>Reset Voting</h3>
              <p className="horror-text text-sm mb-4">
                This will clear all votes for the current chapter and start a new voting session.
              </p>
              <div className="form-group">
                <label>Admin Key:</label>
                <input
                  type="password"
                  value={resetAdminKey}
                  onChange={(e) => setResetAdminKey(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && resetAdminKey.trim()) {
                      try {
                        const response = await fetch('/api/admin/reset-voting', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            adminKey: resetAdminKey,
                            chapterId: currentChapter.id,
                          }),
                        });
                        const result = await response.json();

                        if (result.success) {
                          window.location.reload();
                        } else {
                          alert('Reset failed: ' + result.message);
                        }
                      } catch (error) {
                        alert('Error resetting voting: ' + error);
                      }
                    }
                  }}
                  placeholder="Enter admin key"
                  autoFocus
                />
              </div>
              <div className="admin-login-actions">
                <button
                  onClick={async () => {
                    if (!resetAdminKey.trim()) return;

                    try {
                      const response = await fetch('/api/admin/reset-voting', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          adminKey: resetAdminKey,
                          chapterId: currentChapter.id,
                        }),
                      });
                      const result = await response.json();

                      if (result.success) {
                        window.location.reload();
                      } else {
                        alert('Reset failed: ' + result.message);
                      }
                    } catch (error) {
                      alert('Error resetting voting: ' + error);
                    }
                  }}
                  disabled={!resetAdminKey.trim()}
                >
                  Reset Voting
                </button>
                <button onClick={() => setShowResetVotingModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Connection Status - Only show when there's an issue */}
        {(connectionStatus === 'disconnected' ||
          connectionStatus === 'error' ||
          !ConnectionMonitor.getStatus()) && (
          <Transition type="horror-fade">
            <div className="connection-status-container">
              {/* Network status monitoring */}
              {!ConnectionMonitor.getStatus() && (
                <div className="horror-card text-center mt-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-horror-red">📡</span>
                    <span className="horror-text text-horror-red text-sm">
                      No internet connection detected
                    </span>
                  </div>
                </div>
              )}

              {connectionStatus === 'disconnected' && ConnectionMonitor.getStatus() && (
                <div className="horror-card text-center mt-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-horror-orange">🔄</span>
                    <span className="horror-text text-horror-orange text-sm">
                      Live updates unavailable - using polling mode
                    </span>
                    <button className="horror-button-small ml-2" onClick={reconnect}>
                      Retry Live Updates
                    </button>
                  </div>
                </div>
              )}

              {connectionStatus === 'error' && (
                <div className="horror-card text-center mt-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-horror-red">💀</span>
                    <span className="horror-text text-horror-red">
                      The spirits are not responding
                    </span>
                    <button className="horror-button-small ml-2" onClick={reconnect}>
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Transition>
        )}

        {/* Processing Status */}
        {(isProcessing || hasOptimisticUpdates) && (
          <Transition type="horror-fade">
            <div className="horror-card text-center mt-4">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-pulse w-3 h-3 bg-horror-orange rounded-full"></div>
                <span className="horror-text text-horror-orange text-sm">
                  {isProcessing &&
                    `Processing ${pendingActionsCount} action${pendingActionsCount !== 1 ? 's' : ''}...`}
                  {hasOptimisticUpdates && !isProcessing && 'Syncing with other spirits...'}
                </span>
              </div>
            </div>
          </Transition>
        )}

        {/* Error Display */}
        {(votingError || storyError) && (
          <Transition type="horror-fade">
            <div className="horror-card text-center mt-6 shake-animation">
              <p className="horror-text text-horror-red">{votingError || storyError}</p>
              {(votingError || storyError) && (
                <button
                  className="horror-button-small mt-2"
                  onClick={() => {
                    clearQueue();
                    refreshStory();
                  }}
                >
                  Clear and Retry
                </button>
              )}
            </div>
          </Transition>
        )}

        {/* Story History Sidebar */}
        {context && (
          <StoryHistory
            path={{
              chapters: context.pathTaken,
              decisions: context.previousChoices,
            }}
            chapters={[]} // This would be populated from history API
            decisions={[]} // This would be populated from history API
            isOpen={historyOpen}
            onToggle={() => setHistoryOpen(!historyOpen)}
          />
        )}

        {/* Footer */}
        <Transition type="fade" delay={1000}>
          <footer className="mt-auto py-8 flex justify-center gap-4 text-xs text-horror-fog safe-area-padding ghostly-float">
            <button
              className="touch-button cursor-pointer hover:text-horror-orange transition-colors"
              onClick={() => navigateTo('https://developers.reddit.com/docs')}
            >
              Devvit Docs
            </button>
            <span className="text-horror-gray">|</span>
            <button
              className="touch-button cursor-pointer hover:text-horror-orange transition-colors"
              onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
            >
              r/Devvit
            </button>
            <span className="text-horror-gray">|</span>
            <button
              className="touch-button cursor-pointer hover:text-horror-orange transition-colors"
              onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
            >
              Discord
            </button>
            {moderationEnabled && (
              <>
                <span className="text-horror-gray">|</span>
                <span className="text-horror-fog">Content Moderation Active</span>
              </>
            )}
          </footer>
        </Transition>
      </div>
    </ErrorBoundary>
  );
};

export const App = () => {
  return (
    <ErrorBoundary>
      <LoadingProvider>
        <ModerationProvider>
          <AppContent />
          <LoadingOverlay />
        </ModerationProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
};
