import { useEffect, useState } from 'react';
import type { Story } from '../../shared/types/api';

interface StoryDisplayProps {
  story: Story;
}

export const StoryDisplay = ({ story }: StoryDisplayProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const currentHour = new Date(now);
      currentHour.setMinutes(0, 0, 0);
      const nextHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
      const remaining = nextHour.getTime() - now;

      if (remaining <= 0) {
        setTimeRemaining('Round ending soon...');
        return;
      }

      const minutes = Math.floor(remaining / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mobile-card bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
        <h2 className="text-lg sm:text-xl font-semibold">Current Story</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-gray-600">
          <span>Round {story.roundNumber} • {story.sentences.length}/100 sentences</span>
          {story.status === 'active' && (
            <span className="text-blue-600 font-medium">
              Next round: {timeRemaining}
            </span>
          )}
        </div>
      </div>

      {story.status === 'completed' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center">
            <span className="text-lg mr-2">🎉</span>
            <span className="font-semibold">Story Complete!</span>
          </div>
          <p className="mt-1 text-sm">
            This story has reached 100 sentences and has been archived.
          </p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 max-h-48 sm:max-h-64 md:max-h-80 overflow-y-auto mobile-scroll">
        {story.sentences.length > 0 ? (
          <div className="space-y-2">
            {story.sentences.map((sentence, index) => (
              <p key={index} className="text-gray-800 leading-relaxed text-sm sm:text-base">
                <span className="font-medium text-gray-600 mr-2 text-xs sm:text-sm">[{index + 1}]</span>
                {sentence}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic text-center py-6 sm:py-8 text-sm sm:text-base">
            No sentences yet. Be the first to start the story!
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
        <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
          <div className="font-semibold text-blue-800 text-sm sm:text-base">{story.sentences.length}</div>
          <div className="text-blue-600 text-xs sm:text-sm">Sentences</div>
        </div>
        <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
          <div className="font-semibold text-green-800 text-sm sm:text-base">{story.totalVotes}</div>
          <div className="text-green-600 text-xs sm:text-sm">Total Votes</div>
        </div>
        <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
          <div className="font-semibold text-purple-800 text-sm sm:text-base">{story.contributors.length}</div>
          <div className="text-purple-600 text-xs sm:text-sm">Contributors</div>
        </div>
        <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg">
          <div className="font-semibold text-orange-800 capitalize text-sm sm:text-base">{story.status}</div>
          <div className="text-orange-600 text-xs sm:text-sm">Status</div>
        </div>
      </div>
    </div>
  );
};
