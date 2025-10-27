import { useEffect, useState } from 'react';
import type { Story, ArchiveResponse } from '../../shared/types/api';

type SortOption = 'date' | 'votes';

export const Archive = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const loadArchive = async (page: number = currentPage, sort: SortOption = sortBy) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        sort,
        limit: '10',
      });

      const res = await fetch(`/api/archive/stories?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data: ArchiveResponse = await res.json();
      if (data.type !== 'archive') throw new Error('Unexpected response type');
      
      setStories(data.stories);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err) {
      console.error('Failed to load archive', err);
      setError(err instanceof Error ? err.message : 'Failed to load archive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive(1, sortBy);
  }, [sortBy]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      loadArchive(newPage, sortBy);
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleStoryExpansion = (storyId: string) => {
    setExpandedStory(expandedStory === storyId ? null : storyId);
  };

  const getStoryPreview = (sentences: string[]) => {
    const firstSentences = sentences.slice(0, 3).join(' ');
    return firstSentences.length > 150 
      ? firstSentences.substring(0, 150) + '...'
      : firstSentences + (sentences.length > 3 ? '...' : '');
  };

  if (loading && stories.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-xl text-gray-600">Loading archive...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-2">
          <span className="text-red-500 mr-2">❌</span>
          <h3 className="text-lg font-semibold text-red-800">Error Loading Archive</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={() => loadArchive()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (stories.length === 0 && !loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📖</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Archived Stories Yet</h3>
        <p className="text-gray-600">
          Completed stories will appear here once the community finishes some 100-sentence stories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sorting controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Story Archive</h2>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Completion Date</option>
              <option value="votes">Popularity</option>
            </select>
          </div>
          
          <button
            onClick={() => loadArchive()}
            disabled={loading}
            className="text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 px-3 py-1 rounded-lg transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stories grid */}
      <div className="grid gap-6">
        {stories.map((story) => (
          <div key={story.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                    Completed
                  </span>
                  <span className="text-sm text-gray-500">
                    {story.completedAt && formatDate(story.completedAt)}
                  </span>
                </div>
                
                <div className="mb-3">
                  <p className="text-gray-800 leading-relaxed">
                    {getStoryPreview(story.sentences)}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <span className="font-medium">{story.sentences.length}</span>
                    <span className="ml-1">sentences</span>
                  </span>
                  <span className="flex items-center">
                    <span className="font-medium text-green-600">{story.totalVotes}</span>
                    <span className="ml-1">votes</span>
                  </span>
                  <span className="flex items-center">
                    <span className="font-medium">{story.contributors.length}</span>
                    <span className="ml-1">contributors</span>
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleStoryExpansion(story.id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {expandedStory === story.id ? 'Hide Full Story' : 'Read Full Story'}
                </button>
              </div>
            </div>
            
            {/* Expanded full story */}
            {expandedStory === story.id && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold mb-4">Complete Story</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {story.sentences.map((sentence, index) => (
                      <p key={index} className="text-gray-800 leading-relaxed">
                        <span className="font-medium text-gray-600 mr-2">[{index + 1}]</span>
                        {sentence}
                      </p>
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Story Statistics:</strong> This story was completed with {story.sentences.length} sentences, 
                    received {story.totalVotes} total votes, and had {story.contributors.length} unique contributors.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Archive info */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Showing page {currentPage} of {totalPages} 
          {stories.length > 0 && ` (${stories.length} stories on this page)`}
        </p>
        <p className="mt-1">
          Stories are sorted by {sortBy === 'date' ? 'completion date' : 'total votes'} 
          in descending order.
        </p>
      </div>
    </div>
  );
};
