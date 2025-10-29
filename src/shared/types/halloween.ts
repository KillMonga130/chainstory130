// Halloween Pumpkin Collector Game Types 🎃👻

export interface Position {
  x: number;
  y: number;
}

export interface GameState {
  ghost: Position;
  monsters: Position[];
  pumpkins: Position[];
  score: number;
  lives: number;
  level: number;
  gameStatus: 'playing' | 'game-over' | 'paused' | 'level-complete';
  timeLeft: number;
  powerUpActive: boolean;
  powerUpTimeLeft: number;
}

export interface GameConfig {
  boardWidth: number;
  boardHeight: number;
  ghostSpeed: number;
  monsterSpeed: number;
  pumpkinCount: number;
  monsterCount: number;
  levelDuration: number; // seconds
  maxLives: number;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  level: number;
  timestamp: number;
}

// API Types
export interface StartGameRequest {
  username?: string;
}

export interface StartGameResponse {
  gameId: string;
  gameState: GameState;
  config: GameConfig;
}

export interface MoveGhostRequest {
  gameId: string;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface MoveGhostResponse {
  gameState: GameState;
  message?: string;
}

export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
}

export interface GameOverRequest {
  gameId: string;
  finalScore: number;
}

export interface GameOverResponse {
  rank: number;
  message: string;
}
