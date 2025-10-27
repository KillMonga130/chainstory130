import { navigateTo } from '@devvit/web/client';
import { useStory } from './hooks/useStory';
import { useState } from 'react';
import { StoryDisplay, SubmissionForm, Leaderboard, Archive } from './components';

type TabType = 'story' | 'leaderboard' | 'archive';

export const App = () => {
  const { story, loading, submitting, lastSubmissionMessage, submitSentence, refreshStory } =
    useStory();
  const [activeTab, setActiveTab] = useState<TabType>('story');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading Chain Story...</div>
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
    <div className="flex relative flex-col min-h-screen">
      <div className="w-full max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">Chain Story</h1>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('story')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'story'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Story
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'leaderboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'archive'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Archive
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-96">
          {renderTabContent()}
        </div>

        {/* Refresh Button - Only show on Story tab */}
        {activeTab === 'story' && (
          <div className="text-center mt-6">
            <button
              onClick={refreshStory}
              className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Refresh Story
            </button>
          </div>
        )}
      </div>

      <footer className="mt-auto py-4 flex justify-center gap-3 text-[0.8em] text-gray-600">
        <button
          className="cursor-pointer hover:text-gray-800"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="cursor-pointer hover:text-gray-800"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="cursor-pointer hover:text-gray-800"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
    </div>
  );
};
