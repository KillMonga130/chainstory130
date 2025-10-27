import { navigateTo } from '@devvit/web/client';
import { useStory } from './hooks/useStory';
import { useState } from 'react';
import { 
  StoryDisplay, 
  SubmissionForm, 
  LoadingSpinner, 
  LeaderboardSkeleton, 
  ArchiveSkeleton,
  ConnectionStatus,
  ErrorBoundary,
  NetworkError,
  HelpButton,
  Leaderboard,
  Archive
} from './components';

type TabType = 'story' | 'leaderboard' | 'archive';

export const App = () => {
  const { 
    story, 
    loading, 
    submitting, 
    lastSubmissionMessage, 
    error,
    isRetrying,
    retryCount,
    submitSentence, 
    refreshStory,
    retryLoadStory,
    networkStatus
  } = useStory();
  const [activeTab, setActiveTab] = useState<TabType>('story');

  // Show error state if there's an error and no story data
  if (error && !story && !loading) {
    return (
      <div className="flex justify-center items-center min-h-screen safe-area-padding p-4">
        <NetworkError
          onRetry={retryLoadStory}
          retrying={isRetrying}
          retryCount={retryCount}
          maxRetries={3}
        />
      </div>
    );
  }

  if (loading && !story) {
    return (
      <div className="flex justify-center items-center min-h-screen safe-area-padding">
        <LoadingSpinner message="Loading Chain Story..." />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'story':
        return (
          <div className="space-y-6">
            {story && <StoryDisplay story={story} />}
            {story?.status === 'active' && (
              <SubmissionForm
                storyId={story.id}
                roundNumber={story.roundNumber}
                submitting={submitting}
                lastSubmissionMessage={lastSubmissionMessage}
                onSubmit={submitSentence}
              />
            )}
            {story?.status === 'completed' && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
                🎉 Story Complete! This story has reached 100 sentences and has been archived.
              </div>
            )}
          </div>
        );
      case 'leaderboard':
        return <Leaderboard />;
      case 'archive':
        return <Archive />;
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex relative flex-col min-h-screen safe-area-padding">
        {/* Connection status indicator */}
        <ConnectionStatus isOnline={networkStatus.isOnline} />
        
        <div className="w-full max-w-4xl mx-auto p-3 sm:p-4">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chain Story</h1>
          <HelpButton />
        </div>

        {/* Tab Navigation - Mobile optimized */}
        <div className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('story')}
            className={`touch-button flex-shrink-0 px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors no-select ${
              activeTab === 'story'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Story
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`touch-button flex-shrink-0 px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors no-select ${
              activeTab === 'leaderboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`touch-button flex-shrink-0 px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors no-select ${
              activeTab === 'archive'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Archive
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[24rem]">
          {renderTabContent()}
        </div>

        {/* Refresh Button - Only show on Story tab, mobile optimized */}
        {activeTab === 'story' && (
          <div className="text-center mt-4 sm:mt-6">
            <button
              onClick={refreshStory}
              className="touch-button bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium"
            >
              Refresh Story
            </button>
          </div>
        )}
      </div>

      <footer className="mt-auto py-4 flex justify-center gap-3 text-xs sm:text-sm text-gray-600 safe-area-padding">
        <button
          className="touch-button cursor-pointer hover:text-gray-800 active:text-gray-900 transition-colors"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="touch-button cursor-pointer hover:text-gray-800 active:text-gray-900 transition-colors"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="touch-button cursor-pointer hover:text-gray-800 active:text-gray-900 transition-colors"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
      </div>
    </ErrorBoundary>
  );
};
