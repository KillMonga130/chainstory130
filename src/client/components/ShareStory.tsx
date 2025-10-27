import { useState } from 'react';
import type { Story, LeaderboardEntry } from '../../shared/types/api';

interface ShareStoryProps {
  story?: Story | undefined;
  leaderboardEntry?: LeaderboardEntry | undefined;
  onClose: () => void;
}

export const ShareStory = ({ story, leaderboardEntry, onClose }: ShareStoryProps) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Generate the shareable Reddit markdown format
  const generateShareableText = (): string => {
    if (!story && !leaderboardEntry) return '';

    const storyData = story || {
      sentences: [], // We don't have full story for leaderboard entries
      contributors: [],
      totalVotes: leaderboardEntry?.totalVotes || 0,
      completedAt: leaderboardEntry?.completedAt || Date.now(),
      id: leaderboardEntry?.storyId || ''
    };

    const completedDate = new Date(storyData.completedAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let shareText = '';

    // Title
    shareText += `# 📖 Chain Story Community Creation\n\n`;

    // Story metadata
    if (leaderboardEntry) {
      shareText += `**Leaderboard Rank:** #${leaderboardEntry.rank} 🏆\n`;
    }
    shareText += `**Completed:** ${completedDate}\n`;
    shareText += `**Total Votes:** ${storyData.totalVotes} ⬆️\n`;
    shareText += `**Contributors:** ${story?.contributors.length || leaderboardEntry?.sentenceCount || 0} writers\n`;
    shareText += `**Length:** ${story?.sentences.length || leaderboardEntry?.sentenceCount || 100} sentences\n\n`;

    shareText += `---\n\n`;

    // Story content
    if (story && story.sentences.length > 0) {
      shareText += `## The Complete Story\n\n`;
      
      story.sentences.forEach((sentence, index) => {
        shareText += `**[${index + 1}]** ${sentence}\n\n`;
      });
    } else if (leaderboardEntry) {
      shareText += `## Story Preview\n\n`;
      shareText += `${leaderboardEntry.preview}...\n\n`;
      shareText += `*This is a preview from the leaderboard. The full story contains ${leaderboardEntry.sentenceCount} sentences.*\n\n`;
    }

    shareText += `---\n\n`;

    // Footer
    shareText += `## About Chain Story\n\n`;
    shareText += `This story was created collaboratively by the Reddit community using Chain Story, `;
    shareText += `where players submit sentences and vote on the best continuations every hour. `;
    shareText += `Each story is exactly 100 sentences long and represents the collective creativity `;
    shareText += `of our community.\n\n`;

    if (story?.contributors.length) {
      shareText += `**Special thanks to all ${story.contributors.length} contributors who made this story possible!**\n\n`;
    }

    shareText += `*Want to participate? Join us in creating the next community story!*\n\n`;
    shareText += `---\n\n`;
    shareText += `*Generated from Chain Story - A collaborative storytelling game*`;

    return shareText;
  };

  const copyToClipboard = async () => {
    try {
      setCopyError(false);
      const shareText = generateShareableText();
      
      if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API
        await navigator.clipboard.writeText(shareText);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  const shareText = generateShareableText();
  const wordCount = shareText.split(/\s+/).length;
  const charCount = shareText.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Share Story</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Close share dialog"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Ready to Share</h3>
              <p className="text-blue-800 text-sm">
                This formatted text is optimized for Reddit posts and includes the story content, 
                statistics, and attribution to all contributors.
              </p>
              <div className="mt-2 text-xs text-blue-700">
                <span className="mr-4">Words: {wordCount}</span>
                <span>Characters: {charCount}</span>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
              <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {shareText}
              </pre>
            </div>

            {copyError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">
                  ❌ Failed to copy to clipboard. Please manually select and copy the text above.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
          <button
            onClick={copyToClipboard}
            disabled={copied}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {copied ? '✅ Copied to Clipboard!' : '📋 Copy to Clipboard'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ShareButtonProps {
  story?: Story | undefined;
  leaderboardEntry?: LeaderboardEntry | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

export const ShareButton = ({ story, leaderboardEntry, className = '', size = 'md' }: ShareButtonProps) => {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const sizeClasses = size === 'sm' 
    ? 'px-3 py-1 text-sm' 
    : 'px-4 py-2 text-sm';

  return (
    <>
      <button
        onClick={() => setIsShareOpen(true)}
        className={`touch-button bg-green-100 text-green-700 hover:bg-green-200 active:bg-green-300 transition-colors rounded-lg font-medium flex items-center gap-2 ${sizeClasses} ${className}`}
        aria-label="Share story"
      >
        <span>📤</span>
        <span className="hidden sm:inline">Share</span>
      </button>
      {isShareOpen && (
        <ShareStory
          story={story}
          leaderboardEntry={leaderboardEntry}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </>
  );
};
