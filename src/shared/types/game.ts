// Game types for Cat vs Mouse Chase

export interface Position {
  x: number;
  y: number;
}

export interface GameState {
  mouse: Position;
  cat: Position;
  cheese: Position[];
  score: number;
  gameStatus: 'playing' | 'caught' | 'paused';
  level: number;
  timeLeft: number;
}

export interface GameConfig {
  boardWidth: number;
  boardHeight: number;
  mouseSpeed: number;
  catSpeed: number;
  cheeseCount: number;
  levelDuration: number; // seconds
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

export interface MoveMouseRequest {
  gameId: string;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface MoveMouseResponse {
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
