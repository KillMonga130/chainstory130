import { useEffect, useState } from 'react';
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/types/api';

export const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/leaderboard/top-10');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data: LeaderboardResponse = await res.json();
      if (data.type !== 'leaderboard') throw new Error('Unexpected response type');
      
      setLeaderboard(data.stories);
    } catch (err) {
      console.error('Failed to load leaderboard', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const toggleStoryExpansion = (storyId: string) => {
    setExpandedStory(expandedStory === storyId ? null : storyId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-xl text-gray-600">Loading leaderboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-2">
          <span className="text-red-500 mr-2">❌</span>
          <h3 className="text-lg font-semibold text-red-800">Error Loading Leaderboard</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadLeaderboard}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📚</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Completed Stories Yet</h3>
        <p className="text-gray-600">
          The leaderboard will show the top 10 completed stories once the community finishes some stories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Top Stories</h2>
        <button
          onClick={loadLeaderboard}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Story
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Votes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((entry) => (
                <tr key={entry.storyId} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-900">
                        {getRankIcon(entry.rank)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-xs">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {entry.preview}...
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.sentenceCount} sentences
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      u/{entry.creator}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-bold text-green-600">
                        {entry.totalVotes}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">votes</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(entry.completedAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleStoryExpansion(entry.storyId)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {expandedStory === entry.storyId ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Story Preview */}
      {expandedStory && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Story Preview</h3>
            <button
              onClick={() => setExpandedStory(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-gray-800 leading-relaxed">
              {leaderboard.find(entry => entry.storyId === expandedStory)?.preview}...
            </p>
            <p className="text-sm text-gray-500 mt-2 italic">
              Note: This is a preview. Full story viewing will be available in the Archive section.
            </p>
          </div>
        </div>
      )}

      <div className="text-center text-sm text-gray-500">
        <p>Leaderboard updates automatically when new stories are completed.</p>
        <p>Rankings are based on total community votes received.</p>
      </div>
    </div>
  );
};
