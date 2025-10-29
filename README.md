# 🐭 Cat vs Mouse Chase 🐱

A fun arcade-style game built with Devvit Web where you help a brave mouse collect cheese while avoiding a hungry cat!

## 🎮 How to Play

- **Move the Mouse**: Use WASD or Arrow Keys to control the mouse
- **Collect Cheese**: Gather all the golden cheese pieces to score points (10 points each)
- **Avoid the Cat**: The orange cat will chase you - don't let it catch you!
- **Level Up**: Complete levels by collecting all cheese before time runs out
- **Get Faster**: The cat gets faster and smarter with each level
- **Compete**: Try to get the highest score on the leaderboard!

## 🚀 Features

- **Smooth Controls**: Responsive keyboard movement with WASD or arrow keys
- **Progressive Difficulty**: Cat AI gets faster and more aggressive each level
- **Scoring System**: Points for cheese collection, level completion, and survival time
- **Global Leaderboard**: Compete with other players for the top score
- **Mobile Friendly**: Touch-optimized interface that works on all devices
- **Real-time Gameplay**: Smooth 60fps game loop with collision detection

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + HTML5 Canvas
- **Backend**: Express.js + Node.js
- **Platform**: Reddit Devvit Web
- **Game Engine**: Custom JavaScript game engine with collision detection
- **Storage**: In-memory game sessions and leaderboard

## 🎯 Game Mechanics

### Controls
- **WASD Keys**: Move mouse up/left/down/right
- **Arrow Keys**: Alternative movement controls
- **Responsive Movement**: Smooth character movement with boundary detection

### Scoring
- **Cheese Collection**: 10 points per cheese piece
- **Level Completion**: 50 bonus points per level
- **Survival Bonus**: Points based on time remaining × level multiplier
- **Progressive Scoring**: Higher levels = higher potential scores

### Difficulty Progression
- **Level 1**: Cat moves at base speed
- **Level 2+**: Cat speed increases by 2 units per level
- **Smart AI**: Cat moves toward mouse with slight randomness
- **Adaptive Challenge**: Game becomes more challenging as you progress

## 🏆 Leaderboard System

- **Top 10 Rankings**: See the highest scores from all players
- **Player Stats**: Username, score, level reached, and play date
- **Rank Badges**: Special medals for top 3 positions (🥇🥈🥉)
- **Real-time Updates**: Leaderboard refreshes automatically

## 📱 Mobile Optimization

- **Touch Controls**: Optimized for mobile gameplay
- **Responsive Canvas**: Game scales to fit any screen size
- **Touch Targets**: All buttons meet 44px minimum size
- **Safe Areas**: Proper padding for notched devices

## 🎨 Visual Design

- **Cute Characters**: Friendly mouse and cat sprites
- **Colorful Graphics**: Bright, engaging visual style
- **Smooth Animations**: Fluid character movement
- **Visual Feedback**: Clear game state indicators

## 🔧 Development

### Getting Started
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development server
4. Open the provided playtest URL

### Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run deploy`: Deploy to Reddit
- `npm run launch`: Publish for review

### Project Structure
```
src/
├── client/                 # React frontend
│   ├── App.tsx            # Main game app
│   ├── components/        # UI components
│   │   ├── GameBoard.tsx  # Canvas game renderer
│   │   ├── GameUI.tsx     # Game controls & stats
│   │   └── Leaderboard.tsx # Score rankings
│   └── hooks/
│       └── useGame.ts     # Game state management
├── server/                # Express backend
│   ├── index.ts          # API endpoints
│   ├── core/
│   │   ├── game-engine.ts # Game logic
│   │   └── game-storage.ts # Score storage
└── shared/
    └── types/game.ts     # TypeScript definitions
```

## 🎪 Fun Features

- **Cat Eyes Glow**: Cat's eyes turn red when close to mouse
- **Cheese Sparkles**: Animated cheese with sparkle effects  
- **Level Celebrations**: Special messages for level completion
- **Smooth Gameplay**: 60fps game loop with collision detection
- **Progressive Challenge**: Each level brings new excitement

Ready to help the mouse escape? Start playing and see how high you can score! 🏃‍♂️💨
