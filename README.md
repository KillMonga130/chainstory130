## Chain Story - Collaborative Storytelling Game

A real-time collaborative storytelling game built on Reddit's Devvit platform where communities work together to create epic 100-sentence stories through democratic voting and creative collaboration.

### What is Chain Story?

Chain Story transforms Reddit into a dynamic collaborative writing platform where every community member becomes a co-author. Players submit sentences to continue an ongoing story, and the community votes on the best contributions using Reddit's native upvote system. Every hour at the top of the hour (UTC), the highest-voted sentence becomes the official next part of the story. When a story reaches exactly 100 sentences, it's completed, archived, and celebrated on the leaderboard while a fresh story automatically begins.

### What Makes Chain Story Innovative?

- **Democratic Storytelling**: Every sentence is chosen by community vote, creating truly collaborative narratives
- **Hourly Drama**: Regular voting cycles create anticipation and engagement throughout the day
- **Native Reddit Integration**: Uses Reddit's commenting and voting systems as core gameplay mechanics
- **Progressive Narrative Building**: Stories develop organically through 100 rounds of community creativity
- **Persistent Legacy**: Completed stories become permanent community achievements displayed in archives
- **Real-Time Engagement**: Live countdown timers and instant updates keep players connected
- **Constrained Creativity**: 10-150 character limits force concise, impactful storytelling
- **Multi-Tab Experience**: Seamlessly switch between active story, leaderboards, and archives

### Technology Stack

- [Devvit](https://developers.reddit.com/): Reddit's developer platform for immersive games
- [React](https://react.dev/): Frontend UI framework
- [TypeScript](https://www.typescriptlang.org/): Type-safe development
- [Express](https://expressjs.com/): Backend API server
- [Redis](https://redis.io/): Data persistence (via Devvit)
- [Tailwind CSS](https://tailwindcss.com/): Styling framework
- [Vite](https://vite.dev/): Build tool and development server

## How to Play Chain Story

### Step-by-Step Gameplay:

#### 1. **Enter the Story Tab**
- Open Chain Story in a Reddit post to access the main game interface
- The **Story tab** shows the current collaborative story in progress
- Read all existing sentences (numbered [1] through [current]) to understand the narrative

#### 2. **Understand the Current Round**
- Check the round counter (e.g., "Round 15 • 14/100 sentences")
- Watch the live countdown timer showing time until the next round
- See real-time statistics: total votes, contributors, and story status

#### 3. **Submit Your Creative Contribution**
- Scroll to the submission form below the story display
- Write a sentence that continues the narrative (10-150 characters required)
- Use the live character counter to stay within limits
- The word counter helps you craft concise, impactful sentences
- Click "Submit Sentence" to post your contribution as a Reddit comment

#### 4. **Participate in Community Voting**
- Your sentence appears as a Reddit comment on the post
- Other players vote using Reddit's upvote system
- Vote on other players' sentences to help choose the best continuation
- The submission with the most upvotes wins the round

#### 5. **Watch Round Resolution**
- Every hour at :00 UTC, the round automatically ends
- The highest-voted sentence becomes the official next part of the story
- The story updates in real-time with the winning sentence
- A new round begins immediately for the next sentence

#### 6. **Explore Community Achievements**
- **Leaderboard Tab**: View the top 10 completed stories ranked by total votes
- **Archive Tab**: Browse all completed 100-sentence stories with full text
- Sort archives by completion date or popularity
- Read complete stories with expandable full-text views

#### 7. **Story Completion Celebration**
- When the 100th sentence is added, the story is marked complete
- Completed stories are automatically archived and added to the leaderboard
- A new story begins immediately for continued community collaboration

### Game Rules & Mechanics:

#### **Submission Rules:**
- **Character Limit**: Sentences must be 10-150 characters (strictly enforced)
- **One Per Round**: Each player can submit one sentence per hourly round
- **No Editing**: Submissions cannot be modified once posted (Reddit comment rules)
- **Content Guidelines**: Follow Reddit's community guidelines and subreddit rules

#### **Voting & Selection:**
- **Democratic Process**: Community votes determine winning sentences using Reddit upvotes
- **Hourly Cycles**: Rounds end precisely at :00 UTC every hour
- **Automatic Resolution**: System automatically selects the highest-voted submission
- **Tie Breaking**: In case of ties, the earliest submission wins

#### **Story Progression:**
- **Fixed Length**: All stories must reach exactly 100 sentences to complete
- **Sequential Building**: Each sentence builds on all previous sentences
- **Persistent Progress**: Stories continue across multiple days until completion
- **Automatic Archival**: Completed stories are immediately archived and ranked

### Advanced Features:

#### **Real-Time Experience:**
- **Live Updates**: Story display updates automatically when rounds resolve
- **Countdown Timers**: Always know exactly when the next round begins
- **Status Indicators**: Visual feedback for submission success/failure
- **Responsive Design**: Optimized for both mobile and desktop Reddit users

#### **Community Features:**
- **Contributor Tracking**: See how many unique players contributed to each story
- **Vote Aggregation**: Total community votes across all rounds displayed
- **Story Statistics**: Detailed metrics for each completed story
- **Leaderboard Rankings**: Stories ranked by total community engagement

#### **Archive System:**
- **Pagination**: Browse archives 10 stories at a time
- **Sorting Options**: Sort by completion date or total votes
- **Full Story View**: Expand any archived story to read the complete 100-sentence narrative
- **Search & Discovery**: Easy navigation through community's storytelling history

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
├── client/                    # React frontend (runs in Reddit webview)
│   ├── App.tsx               # Main app with tab navigation
│   ├── main.tsx              # React app entry point
│   ├── index.html            # HTML template
│   ├── index.css             # Tailwind CSS styles
│   ├── hooks/                # Custom React hooks
│   │   └── useStory.ts       # Story state management
│   └── components/           # React UI components
│       ├── StoryDisplay.tsx  # Current story viewer with countdown
│       ├── SubmissionForm.tsx # Sentence submission interface
│       ├── Leaderboard.tsx   # Top stories ranking
│       └── Archive.tsx       # Completed stories browser
├── server/                   # Express backend (API endpoints)
│   ├── index.ts             # Main server with Reddit integration
│   ├── core/                # Business logic modules
│   └── jobs/                # Scheduled job handlers
└── shared/                  # Shared TypeScript definitions
    └── types/api.ts         # Game data structures & validation
```

## Game Architecture

### **Frontend Architecture:**
- **React SPA**: Single-page application with tab-based navigation
- **Component-Based**: Modular UI components for story display, submission, leaderboard, and archive
- **Real-Time Updates**: Live countdown timers and automatic story refreshing
- **Responsive Design**: Mobile-first design optimized for Reddit's diverse user base
- **State Management**: Custom hooks for story data and submission handling

### **Backend Architecture:**
- **Express Server**: RESTful API endpoints for all game operations
- **Scheduled Jobs**: Automated hourly round resolution and daily maintenance
- **Reddit Integration**: Native comment posting and vote retrieval via Devvit SDK
- **Data Persistence**: Redis-based storage for stories, rounds, and user contributions
- **Real-Time Messaging**: WebSocket-like updates through Devvit's real-time channels

### **Data Flow:**
1. **Story Creation**: New stories automatically created when previous ones complete
2. **Submission Process**: Player sentences posted as Reddit comments via API
3. **Vote Aggregation**: Hourly jobs fetch comment votes and determine winners
4. **Story Updates**: Winning sentences added to story and broadcast to all players
5. **Completion Handling**: 100-sentence stories archived and new ones initiated

## Cursor Integration

This template comes with a pre-configured cursor environment. To get started, [download cursor](https://www.cursor.com/downloads) and enable the `devvit-mcp` when prompted.
