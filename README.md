## Chain Story - Collaborative Storytelling Game

A real-time collaborative storytelling game built on Reddit's Devvit platform where users work together to create 100-sentence stories through community voting.

### What is Chain Story?

Chain Story is an innovative social game that transforms Reddit into a collaborative writing platform. Players submit sentences to continue an ongoing story, and the community votes on the best contributions. Every hour, the highest-voted sentence becomes the official next part of the story. When a story reaches 100 sentences, it's completed and archived, and a new story begins.

### What Makes Chain Story Unique?

- **Community-Driven Narrative**: Stories evolve based on collective creativity and democratic voting
- **Hourly Rounds**: Creates excitement and urgency with regular voting cycles
- **Reddit Integration**: Leverages Reddit's native commenting and voting systems for gameplay
- **Persistent Stories**: Completed stories are archived and ranked on leaderboards
- **Real-Time Collaboration**: Multiple users can contribute simultaneously to the same story
- **Character Limits**: 10-150 character constraint encourages concise, impactful writing

### Technology Stack

- [Devvit](https://developers.reddit.com/): Reddit's developer platform for immersive games
- [React](https://react.dev/): Frontend UI framework
- [TypeScript](https://www.typescriptlang.org/): Type-safe development
- [Express](https://expressjs.com/): Backend API server
- [Redis](https://redis.io/): Data persistence (via Devvit)
- [Tailwind CSS](https://tailwindcss.com/): Styling framework
- [Vite](https://vite.dev/): Build tool and development server

## How to Play Chain Story

### For Players:

1. **Join the Story**: Open the Chain Story app in a Reddit post to see the current collaborative story
2. **Read the Current Story**: Review all previous sentences (numbered 1-100) to understand the narrative so far
3. **Submit Your Sentence**: 
   - Write a sentence between 10-150 characters that continues the story
   - Make it engaging and build on what came before
   - Submit your contribution as a Reddit comment
4. **Vote on Submissions**: Upvote the best sentences submitted by other players during the current round
5. **Wait for Round Resolution**: Every hour at :00 UTC, the highest-voted sentence becomes official
6. **Watch the Story Grow**: Return to see how your sentence (if it won) or others' sentences advance the narrative
7. **Story Completion**: When the 100th sentence is added, the story is complete and archived

### Game Rules:

- **Sentence Length**: Must be 10-150 characters (enforced by the system)
- **One Submission Per Round**: Players can submit one sentence per hourly round
- **Voting Period**: You have up to one hour to vote on submissions before the round ends
- **Democratic Selection**: The sentence with the most upvotes wins each round
- **Story Progression**: Stories must reach exactly 100 sentences to be considered complete
- **No Editing**: Once submitted, sentences cannot be modified (Reddit comment rules apply)

### Game Features:

- **Live Story Display**: See the current story with all sentences numbered and organized
- **Real-Time Stats**: Track contributors, total votes, and story progress
- **Character Counter**: Visual feedback on sentence length while typing
- **Round Timer**: Know exactly when the next round begins
- **Story Archive**: Browse completed 100-sentence stories
- **Leaderboard**: See the most popular completed stories ranked by total votes

## Getting Started for Developers

> Make sure you have Node 22 downloaded on your machine before running!

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start the development server
4. Follow the Devvit setup wizard to connect your Reddit developer account
5. Open the provided playtest URL to test the game

## Development Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run check`: Type checks, lints, and prettifies your app

## Project Structure

```
src/
├── client/          # React frontend (runs in Reddit webview)
│   ├── App.tsx      # Main game interface
│   ├── hooks/       # React hooks for game logic
│   └── main.tsx     # App entry point
├── server/          # Express backend (API endpoints)
│   └── index.ts     # Server with Reddit integration
└── shared/          # Shared TypeScript types
    └── types/api.ts # Game data structures
```

## Game Architecture

- **Frontend**: React app displaying story interface and submission form
- **Backend**: Express server handling story data and Reddit API integration
- **Data Storage**: Redis (via Devvit) for persistent story and user data
- **Real-Time Updates**: Scheduled jobs for hourly round resolution
- **Reddit Integration**: Comments for submissions, voting for selection

## Cursor Integration

This template comes with a pre-configured cursor environment. To get started, [download cursor](https://www.cursor.com/downloads) and enable the `devvit-mcp` when prompted.
