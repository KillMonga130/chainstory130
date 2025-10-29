import { GameState, GameConfig, LeaderboardEntry } from '../../shared/types/halloween';

// Simple in-memory storage for Halloween game
interface GameSession {
  gameId: string;
  gameState: GameState;
  config: GameConfig;
  username?: string;
  createdAt: number;
  lastActivity: number;
}

class HalloweenGameStorage {
  private games = new Map<string, GameSession>();
  private leaderboard: LeaderboardEntry[] = [
    // Add some sample scores for demo
    { username: 'SpookyPlayer', score: 1250, level: 5, timestamp: Date.now() - 3600000 },
    { username: 'PumpkinMaster', score: 980, level: 4, timestamp: Date.now() - 7200000 },
    { username: 'GhostHunter', score: 750, level: 3, timestamp: Date.now() - 10800000 },
  ];

  // Generate a unique game ID
  generateGameId(): string {
    return `halloween_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new game session
  createGame(gameState: GameState, config: GameConfig, username?: string): string {
    const gameId = this.generateGameId();
    const now = Date.now();
    
    this.games.set(gameId, {
      gameId,
      gameState,
      config,
      username,
      createdAt: now,
      lastActivity: now,
    });

    console.log(`🎃 Created Halloween game: ${gameId} for ${username || 'anonymous'}`);
    return gameId;
  }

  // Get a game session
  getGame(gameId: string): GameSession | null {
    const game = this.games.get(gameId);
    if (game) {
      // Update last activity
      game.lastActivity = Date.now();
    }
    return game || null;
  }

  // Update game state
  updateGame(gameId: string, gameState: GameState): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    game.gameState = gameState;
    game.lastActivity = Date.now();
    return true;
  }

  // Delete a game session
  deleteGame(gameId: string): boolean {
    console.log(`🗑️ Deleting game session: ${gameId}`);
    return this.games.delete(gameId);
  }

  // Add score to leaderboard
  addScore(username: string, score: number, level: number): number {
    const entry: LeaderboardEntry = {
      username: username || 'Anonymous Ghost',
      score,
      level,
      timestamp: Date.now(),
    };

    this.leaderboard.push(entry);

    // Sort by score (descending) and keep top 20
    this.leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.timestamp - a.timestamp; // Newer first for ties
    });

    if (this.leaderboard.length > 20) {
      this.leaderboard = this.leaderboard.slice(0, 20);
    }

    // Find rank of this entry
    const rank = this.leaderboard.findIndex(e => 
      e.username === entry.username && 
      e.score === entry.score && 
      e.timestamp === entry.timestamp
    ) + 1;

    console.log(`👻 New score added: ${username} scored ${score} (rank #${rank})`);
    return rank;
  }

  // Get leaderboard
  getLeaderboard(limit: number = 10): LeaderboardEntry[] {
    return this.leaderboard.slice(0, limit);
  }

  // Get game statistics
  getStats() {
    return {
      activeGames: this.games.size,
      totalScores: this.leaderboard.length,
      topScore: this.leaderboard[0]?.score || 0,
      averageLevel: this.leaderboard.length > 0 
        ? Math.round(this.leaderboard.reduce((sum, entry) => sum + entry.level, 0) / this.leaderboard.length)
        : 0,
    };
  }

  // Clean up inactive games (older than 30 minutes of inactivity)
  cleanupInactiveGames(): number {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    let cleaned = 0;

    for (const [gameId, game] of this.games.entries()) {
      if (game.lastActivity < thirtyMinutesAgo) {
        this.games.delete(gameId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} inactive Halloween games`);
    }
    return cleaned;
  }

  // Get all active game IDs (for debugging)
  getActiveGameIds(): string[] {
    return Array.from(this.games.keys());
  }
}

// Export singleton instance
export const halloweenStorage = new HalloweenGameStorage();

// Auto-cleanup every 15 minutes
setInterval(() => {
  halloweenStorage.cleanupInactiveGames();
}, 15 * 60 * 1000);
