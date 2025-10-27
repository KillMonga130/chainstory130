import { useState } from 'react';

interface HelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Help = ({ isOpen, onClose }: HelpProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">How to Play Chain Story</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Close help"
          >
            ×
          </button>
        </div>
        
        <div className="px-6 py-4 space-y-6">
          {/* Game Overview */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🎯 Game Overview</h3>
            <p className="text-gray-700 leading-relaxed">
              Chain Story is a collaborative storytelling game where the Reddit community creates stories together, 
              one sentence at a time. Every hour, the community votes on submitted sentences, and the most popular 
              one becomes the official continuation of the story.
            </p>
          </section>

          {/* How to Participate */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">✍️ How to Participate</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">1</span>
                <p className="text-gray-700">Read the current story to understand the narrative context</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">2</span>
                <p className="text-gray-700">Submit your sentence continuation using the form below the story</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">3</span>
                <p className="text-gray-700">Vote on other players' sentences using Reddit's upvote system</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">4</span>
                <p className="text-gray-700">Watch as the highest-voted sentence becomes part of the official story</p>
              </div>
            </div>
          </section>

          {/* Sentence Requirements */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 Sentence Requirements</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-600">⚠️</span>
                <span className="font-medium text-yellow-800">Important Rules</span>
              </div>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Minimum:</strong> 10 characters long</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Maximum:</strong> 150 characters long</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">ℹ️</span>
                  <span>Sentences should continue the story naturally</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">ℹ️</span>
                  <span>Be creative but keep it appropriate for all audiences</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Voting and Selection */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🗳️ Voting and Selection Process</h3>
            <div className="space-y-3">
              <p className="text-gray-700">
                <strong>Hourly Rounds:</strong> Every hour at the top of the hour (e.g., 1:00, 2:00, 3:00), 
                the system automatically selects the winning sentence.
              </p>
              <p className="text-gray-700">
                <strong>Selection Criteria:</strong> The sentence with the most Reddit upvotes becomes the 
                official continuation. In case of ties, the first submitted sentence wins.
              </p>
              <p className="text-gray-700">
                <strong>Voting Window:</strong> You can submit and vote on sentences throughout the hour. 
                The countdown timer shows when the current round ends.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Tip:</strong> Submit early in the round to give your sentence more time to collect votes!
                </p>
              </div>
            </div>
          </section>

          {/* Story Completion */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🏁 Story Completion and Archival</h3>
            <div className="space-y-3">
              <p className="text-gray-700">
                <strong>Story Length:</strong> Each story is exactly 100 sentences long. Once the 100th 
                sentence is added, the story is automatically completed.
              </p>
              <p className="text-gray-700">
                <strong>Archival:</strong> Completed stories are permanently saved in the Archive section 
                where anyone can read them anytime.
              </p>
              <p className="text-gray-700">
                <strong>Leaderboard:</strong> The best stories (ranked by total upvotes) appear on the 
                Leaderboard for everyone to discover and enjoy.
              </p>
              <p className="text-gray-700">
                <strong>New Stories:</strong> When a story completes, a brand new story automatically 
                begins, so the collaborative storytelling never stops!
              </p>
            </div>
          </section>

          {/* Tips for Success */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Tips for Success</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Read the entire story before submitting to maintain narrative flow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Submit early in each round to maximize voting time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Vote on other sentences you like - community engagement makes better stories</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Be creative but consider what the community will enjoy reading</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Check back regularly to see how the story develops</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Navigation Help */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🧭 Navigation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-1">Story Tab</h4>
                <p className="text-sm text-gray-600">Current active story, submission form, and real-time updates</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-1">Leaderboard</h4>
                <p className="text-sm text-gray-600">Top 10 completed stories ranked by community votes</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-1">Archive</h4>
                <p className="text-sm text-gray-600">Browse all completed stories with search and sorting</p>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium"
          >
            Got it! Let's Play
          </button>
        </div>
      </div>
    </div>
  );
};

interface HelpButtonProps {
  className?: string;
}

export const HelpButton = ({ className = '' }: HelpButtonProps) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsHelpOpen(true)}
        className={`touch-button bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 ${className}`}
        aria-label="Show game rules and help"
      >
        <span>?</span>
        <span className="hidden sm:inline">Help</span>
      </button>
      <Help isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};
