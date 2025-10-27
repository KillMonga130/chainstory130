import { navigateTo } from '@devvit/web/client';
import { useStory } from './hooks/useStory';
import { useState } from 'react';

export const App = () => {
  const { story, loading, submitting, lastSubmissionMessage, submitSentence, refreshStory } =
    useStory();
  const [sentence, setSentence] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentence.trim() || submitting) return;

    const result = await submitSentence(sentence);
    if (result.success) {
      setSentence(''); // Clear form on success
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading Chain Story...</div>
      </div>
    );
  }

  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-6 p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">Chain Story</h1>

        {story && (
          <>
            {/* Story Display */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Current Story</h2>
                <div className="text-sm text-gray-600">
                  Round {story.roundNumber} • {story.sentences.length}/100 sentences
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
                {story.sentences.length > 0 ? (
                  <div className="space-y-2">
                    {story.sentences.map((sentence, index) => (
                      <p key={index} className="text-gray-800">
                        <span className="font-medium text-gray-600">[{index + 1}]</span> {sentence}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">
                    No sentences yet. Be the first to start the story!
                  </p>
                )}
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <span>Contributors: {story.contributors.length}</span>
                <span>Total Votes: {story.totalVotes}</span>
                <span>Status: {story.status}</span>
              </div>
            </div>

            {/* Submission Form */}
            {story.status === 'active' && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Add Your Sentence</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <textarea
                      value={sentence}
                      onChange={(e) => setSentence(e.target.value)}
                      placeholder="Continue the story with your sentence (10-150 characters)..."
                      className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      disabled={submitting}
                    />
                    <div className="flex justify-between mt-2 text-sm">
                      <span
                        className={`${
                          sentence.length < 10
                            ? 'text-red-500'
                            : sentence.length > 150
                              ? 'text-red-500'
                              : 'text-green-600'
                        }`}
                      >
                        {sentence.length}/150 characters
                        {sentence.length < 10 && ' (minimum 10)'}
                        {sentence.length > 150 && ' (maximum 150)'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submitting || sentence.trim().length < 10 || sentence.trim().length > 150
                    }
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Sentence'}
                  </button>
                </form>

                {lastSubmissionMessage && (
                  <div
                    className={`mt-4 p-3 rounded-lg ${
                      lastSubmissionMessage.includes('Submitted!')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {lastSubmissionMessage}
                  </div>
                )}
              </div>
            )}

            {story.status === 'completed' && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
                🎉 Story Complete! This story has reached 100 sentences and has been archived.
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <button
            onClick={refreshStory}
            className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Refresh Story
          </button>
        </div>
      </div>

      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[0.8em] text-gray-600">
        <button
          className="cursor-pointer"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="cursor-pointer"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-gray-300">|</span>
        <button
          className="cursor-pointer"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
    </div>
  );
};
