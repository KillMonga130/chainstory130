import React, { useState, useEffect } from 'react';
import { StoryChoice } from '../../shared/types/story';
import { VoteCount, UserVoteStatus } from '../../shared/types/voting';

interface VotingInterfaceProps {
  choices: StoryChoice[];
  voteCounts: VoteCount[];
  userVoteStatus: UserVoteStatus;
  votingActive: boolean;
  onVote: (choiceId: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const VotingInterface: React.FC<VotingInterfaceProps> = ({
  choices,
  voteCounts,
  userVoteStatus,
  votingActive,
  onVote,
  isLoading = false,
  className = '',
}) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (userVoteStatus.hasVoted && userVoteStatus.choiceId) {
      setSelectedChoice(userVoteStatus.choiceId);
    }
  }, [userVoteStatus]);

  const handleVote = async (choiceId: string) => {
    if (!votingActive || userVoteStatus.hasVoted || isVoting) return;

    setIsVoting(true);
    try {
      await onVote(choiceId);
      setSelectedChoice(choiceId);
    } catch (error) {
      console.error('Failed to cast vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const getVoteCount = (choiceId: string): number => {
    const voteData = voteCounts.find((vc) => vc.choiceId === choiceId);
    return voteData?.count || 0;
  };

  const getVotePercentage = (choiceId: string): number => {
    const voteData = voteCounts.find((vc) => vc.choiceId === choiceId);
    return voteData?.percentage || 0;
  };

  const getTotalVotes = (): number => {
    return voteCounts.reduce((total, vc) => total + vc.count, 0);
  };

  const getButtonClass = (choiceId: string): string => {
    const baseClass = 'voting-button horror-transition';
    const isSelected = selectedChoice === choiceId;
    const hasVoted = userVoteStatus.hasVoted;

    if (isSelected) {
      return `${baseClass} selected glow-animation`;
    }

    if (hasVoted && !isSelected) {
      return `${baseClass} opacity-50`;
    }

    if (!votingActive) {
      return `${baseClass} opacity-75 cursor-not-allowed`;
    }

    return baseClass;
  };

  const renderVoteCount = (choiceId: string) => {
    const count = getVoteCount(choiceId);
    const percentage = getVotePercentage(choiceId);

    return (
      <div className="vote-count-display">
        <div className="flex justify-between items-center">
          <span className="text-sm">Votes: {count}</span>
          <span className="text-sm font-bold">{percentage.toFixed(1)}%</span>
        </div>
        <div className="vote-progress-bar mt-1">
          <div className="vote-progress-fill" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  };

  if (!choices || choices.length === 0) {
    return (
      <div className={`voting-interface ${className}`}>
        <div className="horror-card text-center">
          <p className="horror-text">No choices available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`voting-interface ${className}`}>
      <div className="voting-header text-center mb-6">
        <h2 className="horror-subtitle">{votingActive ? 'Cast Your Vote' : 'Voting Complete'}</h2>
        {votingActive && !userVoteStatus.hasVoted && (
          <p className="horror-text text-sm mt-2">Choose your path through the darkness...</p>
        )}
        {userVoteStatus.hasVoted && (
          <p className="horror-text text-sm mt-2 text-horror-orange">
            You have cast your vote. Waiting for others...
          </p>
        )}
      </div>

      <div className="voting-section">
        {choices.map((choice, index) => (
          <div key={choice.id} className="voting-choice slide-up-animation">
            <button
              className={getButtonClass(choice.id)}
              onClick={() => handleVote(choice.id)}
              disabled={!votingActive || userVoteStatus.hasVoted || isVoting || isLoading}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="choice-content">
                <div className="choice-text font-semibold mb-2">{choice.text}</div>
                {choice.description && (
                  <div className="choice-description text-sm opacity-80 mb-3">
                    {choice.description}
                  </div>
                )}
                {choice.consequences && (
                  <div className="choice-consequences text-xs opacity-60 italic">
                    {choice.consequences}
                  </div>
                )}
              </div>
            </button>

            {renderVoteCount(choice.id)}
          </div>
        ))}
      </div>

      <div className="voting-stats text-center mt-6">
        <div className="horror-card">
          <p className="horror-text text-sm">
            Total Votes: <span className="font-bold text-horror-orange">{getTotalVotes()}</span>
          </p>
          {!votingActive && (
            <p className="horror-text text-xs mt-2 opacity-75">
              The community has spoken. The story continues...
            </p>
          )}
        </div>
      </div>

      {isVoting && (
        <div className="voting-loading-overlay">
          <div className="loading-spinner" />
          <p className="horror-text text-sm mt-2">Casting your vote...</p>
        </div>
      )}
    </div>
  );
};
