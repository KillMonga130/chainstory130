import { GameState, GameConfig, Position } from '../../shared/types/halloween';

export class HalloweenGameEngine {
  private static readonly DEFAULT_CONFIG: GameConfig = {
    boardWidth: 800,
    boardHeight: 600,
    ghostSpeed: 20,
    monsterSpeed: 12,
    pumpkinCount: 8,
    monsterCount: 3,
    levelDuration: 90, // 90 seconds per level
    maxLives: 3,
  };

  static createNewGame(): { gameState: GameState; config: GameConfig } {
    const config = { ...this.DEFAULT_CONFIG };

    const gameState: GameState = {
      ghost: { x: 100, y: 100 },
      monsters: this.generateMonsters(config),
      pumpkins: this.generatePumpkins(config),
      score: 0,
      lives: config.maxLives,
      level: 1,
      gameStatus: 'playing',
      timeLeft: config.levelDuration,
      powerUpActive: false,
      powerUpTimeLeft: 0,
    };

    return { gameState, config };
  }

  static moveGhost(
    gameState: GameState,
    config: GameConfig,
    direction: 'up' | 'down' | 'left' | 'right'
  ): GameState {
    if (gameState.gameStatus !== 'playing') {
      return gameState;
    }

    const newGameState = { ...gameState };
    const ghost = { ...gameState.ghost };

    // Move ghost based on direction
    switch (direction) {
      case 'up':
        ghost.y = Math.max(20, ghost.y - config.ghostSpeed);
        break;
      case 'down':
        ghost.y = Math.min(config.boardHeight - 20, ghost.y + config.ghostSpeed);
        break;
      case 'left':
        ghost.x = Math.max(20, ghost.x - config.ghostSpeed);
        break;
      case 'right':
        ghost.x = Math.min(config.boardWidth - 20, ghost.x + config.ghostSpeed);
        break;
    }

    newGameState.ghost = ghost;

    // Move monsters towards ghost (unless power-up is active)
    if (!gameState.powerUpActive) {
      newGameState.monsters = gameState.monsters.map((monster) =>
        this.moveMonster(monster, ghost, config, gameState.level)
      );
    } else {
      // During power-up, monsters move away from ghost
      newGameState.monsters = gameState.monsters.map((monster) =>
        this.moveMonsterAway(monster, ghost, config)
      );
      newGameState.powerUpTimeLeft = Math.max(0, gameState.powerUpTimeLeft - 1);
      if (newGameState.powerUpTimeLeft === 0) {
        newGameState.powerUpActive = false;
      }
    }

    // Check for pumpkin collection
    const { pumpkins, collected, powerUp } = this.checkPumpkinCollection(ghost, gameState.pumpkins);
    newGameState.pumpkins = pumpkins;
    newGameState.score += collected * 25; // 25 points per pumpkin

    // Handle power-up pumpkin
    if (powerUp) {
      newGameState.powerUpActive = true;
      newGameState.powerUpTimeLeft = 100; // 10 seconds at 10fps
      newGameState.score += 100; // Bonus for power-up
    }

    // Check if monster caught ghost (only if no power-up)
    if (!newGameState.powerUpActive && this.checkMonsterCaughtGhost(newGameState.monsters, ghost)) {
      newGameState.lives -= 1;
      if (newGameState.lives <= 0) {
        newGameState.gameStatus = 'game-over';
      } else {
        // Reset ghost position
        newGameState.ghost = { x: 100, y: 100 };
      }
    }

    // Check if all pumpkins collected (level complete)
    if (newGameState.pumpkins.length === 0 && newGameState.gameStatus === 'playing') {
      newGameState.gameStatus = 'level-complete';
      newGameState.level += 1;
      newGameState.score += 200; // Level completion bonus
      newGameState.timeLeft = config.levelDuration;

      // Generate new level
      newGameState.pumpkins = this.generatePumpkins(config);
      newGameState.monsters = this.generateMonsters(config, newGameState.level);
      newGameState.gameStatus = 'playing';
    }

    return newGameState;
  }

  private static moveMonster(
    monster: Position,
    ghost: Position,
    config: GameConfig,
    level: number
  ): Position {
    const monsterSpeed = config.monsterSpeed + (level - 1) * 2; // Monsters get faster each level

    // Calculate direction to ghost
    const dx = ghost.x - monster.x;
    const dy = ghost.y - monster.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return monster;

    // Normalize direction and apply speed
    const moveX = (dx / distance) * monsterSpeed;
    const moveY = (dy / distance) * monsterSpeed;

    // Add some randomness to make monster movement less predictable
    const randomFactor = 0.2;
    const randomX = (Math.random() - 0.5) * monsterSpeed * randomFactor;
    const randomY = (Math.random() - 0.5) * monsterSpeed * randomFactor;

    return {
      x: Math.max(20, Math.min(config.boardWidth - 20, monster.x + moveX + randomX)),
      y: Math.max(20, Math.min(config.boardHeight - 20, monster.y + moveY + randomY)),
    };
  }

  private static moveMonsterAway(monster: Position, ghost: Position, config: GameConfig): Position {
    const monsterSpeed = config.monsterSpeed * 0.8; // Slower when running away

    // Calculate direction away from ghost
    const dx = monster.x - ghost.x;
    const dy = monster.y - ghost.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // If on same position, move randomly
      return {
        x: Math.max(20, Math.min(config.boardWidth - 20, monster.x + (Math.random() - 0.5) * 40)),
        y: Math.max(20, Math.min(config.boardHeight - 20, monster.y + (Math.random() - 0.5) * 40)),
      };
    }

    // Normalize direction and apply speed
    const moveX = (dx / distance) * monsterSpeed;
    const moveY = (dy / distance) * monsterSpeed;

    return {
      x: Math.max(20, Math.min(config.boardWidth - 20, monster.x + moveX)),
      y: Math.max(20, Math.min(config.boardHeight - 20, monster.y + moveY)),
    };
  }

  private static checkPumpkinCollection(
    ghost: Position,
    pumpkins: Position[]
  ): { pumpkins: Position[]; collected: number; powerUp: boolean } {
    const collectionRadius = 25;
    let collected = 0;
    let powerUp = false;

    const remainingPumpkins = pumpkins.filter((pumpkin, index) => {
      const distance = Math.sqrt(
        Math.pow(ghost.x - pumpkin.x, 2) + Math.pow(ghost.y - pumpkin.y, 2)
      );

      if (distance < collectionRadius) {
        collected++;
        // Every 5th pumpkin is a power-up (golden pumpkin)
        if ((index + 1) % 5 === 0) {
          powerUp = true;
        }
        return false; // Remove this pumpkin
      }
      return true; // Keep this pumpkin
    });

    return { pumpkins: remainingPumpkins, collected, powerUp };
  }

  private static checkMonsterCaughtGhost(monsters: Position[], ghost: Position): boolean {
    const catchRadius = 30;

    return monsters.some((monster) => {
      const distance = Math.sqrt(
        Math.pow(monster.x - ghost.x, 2) + Math.pow(monster.y - ghost.y, 2)
      );
      return distance < catchRadius;
    });
  }

  private static generatePumpkins(config: GameConfig): Position[] {
    const pumpkins: Position[] = [];
    const margin = 40;

    for (let i = 0; i < config.pumpkinCount; i++) {
      pumpkins.push({
        x: Math.random() * (config.boardWidth - 2 * margin) + margin,
        y: Math.random() * (config.boardHeight - 2 * margin) + margin,
      });
    }

    return pumpkins;
  }

  private static generateMonsters(config: GameConfig, level: number = 1): Position[] {
    const monsters: Position[] = [];
    const margin = 60;
    const monsterCount = Math.min(config.monsterCount + Math.floor(level / 3), 6); // Max 6 monsters

    for (let i = 0; i < monsterCount; i++) {
      // Place monsters away from starting position (100, 100)
      let x, y;
      do {
        x = Math.random() * (config.boardWidth - 2 * margin) + margin;
        y = Math.random() * (config.boardHeight - 2 * margin) + margin;
      } while (Math.sqrt(Math.pow(x - 100, 2) + Math.pow(y - 100, 2)) < 150);

      monsters.push({ x, y });
    }

    return monsters;
  }

  static calculateScore(gameState: GameState): number {
    // Base score from pumpkin collection
    let score = gameState.score;

    // Bonus for surviving with lives
    const lifeBonus = gameState.lives * 50;
    score += lifeBonus;

    // Level completion bonus
    const levelBonus = (gameState.level - 1) * 300;
    score += levelBonus;

    // Time bonus
    const timeBonus = Math.max(0, gameState.timeLeft) * gameState.level;
    score += timeBonus;

    return score;
  }
}
