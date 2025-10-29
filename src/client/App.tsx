import { navigateTo } from '@devvit/web/client';
import { useGame } from './hooks/useGame';
import { useState } from 'react';
import { 
  GameBoard,
  GameUI,
  LoadingSpinner,
  ConnectionStatus,
  ErrorBoundary,
  NetworkError,
  Leaderboard
} from './components';
import { useNetworkStatus } from './hooks/useNetworkStatus';

type TabType = 'game' | 'leaderboard';

export const App = () => {
  const { 
    gameState, 
    config, 
    loading, 
    error,
    startGame,
    moveMouseDirection,
    pauseGame
  } = useGame();
  const networkStatus = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<TabType>('game');

  // Show error state if there's an error and no game data
  if (error && !gameState && !loading) {
    return (
      <div className="flex justify-center items-center min-h-screen safe-area-padding p-4">
        <NetworkError
          onRetry={startGame}
          retrying={loading}
          retryCount={0}
          maxRetries={3}
        />
      </div>
    );
  }

  if (loading && !gameState) {
    return (
      <div className="flex justify-center items-center min-h-screen safe-area-padding">
        <LoadingSpinner message="Loading Cat vs Mouse Chase..." />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'game':
        return (
          <div className="space-y-6">
            {gameState && config && (
              <>
                <GameUI
                  gameState={gameState}
                  onStartGame={startGame}
                  onPauseGame={pauseGame}
                  isLoading={loading}
                />
                <div className="flex justify-center">
                  <GameBoard
                    gameState={gameState}
                    config={config}
                    onMouseMove={moveMouseDirection}
                  />
                </div>
              </>
            )}
            {!gameState && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🐭🐱</div>
                <h2 className="text-2xl font-bold mb-4">Cat vs Mouse Chase!</h2>
                <p className="text-gray-600 mb-6">
                  Help the mouse collect cheese while avoiding the hungry cat!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  disabled={loading}
                >
                  🎮 Start Playing
                </button>
              </div>
            )}
          </div>
        );
      case 'leaderboard':
        return <Leaderboard />;
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              🐭 Cat vs Mouse Chase 🐱
            </h1>
          </div>

          {/* Tab Navigation - Mobile optimized */}
          <div className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('game')}
              className={`touch-button flex-shrink-0 px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors no-select ${
                activeTab === 'game'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎮 Game
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`touch-button flex-shrink-0 px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors no-select ${
                activeTab === 'leaderboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏆 Leaderboard
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[24rem]">
            {renderTabContent()}
          </div>
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
