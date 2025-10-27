## Chain Story - Collaborative Storytelling Game

A real-time collaborative storytelling game built on Reddit's Devvit platform where communities work together to create epic 100-sentence stories through democratic voting and creative collaboration.

### What is Chain Story?

Chain Story transforms Reddit into a dynamic collaborative writing platform where every community member becomes a co-author. Players submit sentences to continue an ongoing story, and the community votes on the best contributions using Reddit's native upvote system. Every hour at the top of the hour (UTC), the highest-voted sentence becomes the official next part of the story. When a story reaches exactly 100 sentences, it's completed, archived, and celebrated on the leaderboard while a fresh story automatically begins.

The game features a clean, mobile-optimized interface with three main sections:
- **Story Tab**: View the current collaborative story, real-time countdown timer, and submit your own sentences with live character validation (10-150 characters)
- **Leaderboard Tab**: Browse the top 10 completed stories ranked by community votes with expandable previews and sharing options
- **Archive Tab**: Explore all completed stories with pagination, sorting options (by date or popularity), and full-text viewing capabilities

### What Makes Chain Story Innovative?

- **Democratic Storytelling**: Every sentence is chosen by community vote, creating truly collaborative narratives that reflect the collective creativity of the entire community
- **Hourly Drama**: Regular voting cycles create anticipation and engagement throughout the day, with live countdown timers building excitement for each round resolution
- **Native Reddit Integration**: Uses Reddit's commenting and voting systems as core gameplay mechanics, making it feel natural for Reddit users while adding gamification layers
- **Progressive Narrative Building**: Stories develop organically through exactly 100 rounds of community creativity, ensuring each story has a defined arc and satisfying completion
- **Persistent Legacy**: Completed stories become permanent community achievements displayed in searchable archives and competitive leaderboards with sharing capabilities
- **Real-Time Engagement**: Live countdown timers, automatic story updates, network status monitoring, and instant feedback keep players connected and engaged
- **Constrained Creativity**: 10-150 character limits with real-time validation force concise, impactful storytelling that maintains narrative momentum and readability
- **Multi-Tab Experience**: Seamlessly switch between active story participation, competitive leaderboards, and historical archives with persistent state management
- **Mobile-First Design**: Touch-optimized interface with responsive design, safe area support, and 44px minimum touch targets ensures great gameplay on all devices
- **Community Statistics**: Track story progress with real-time metrics including vote counts, contributor numbers, completion status, and round progression
- **Intelligent Error Handling**: Robust network error detection, automatic retry logic with exponential backoff, and graceful offline mode ensure smooth gameplay even with poor connections
- **Performance Optimization**: Smart caching with TTL, lazy loading, skeleton screens, and API response optimization provide fast, responsive user experience across all devices
- **Accessibility Features**: Comprehensive help system, clear error messages, loading states, and ARIA labels ensure the game is accessible to all players
- **Story Sharing System**: Built-in sharing functionality allows players to export completed stories in Reddit-formatted markdown for easy sharing across the platform

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

#### 1. **Access the Game Interface**
- Open Chain Story in a Reddit post to access the main game interface
- The app loads with a clean, mobile-optimized design featuring three main tabs: Story, Leaderboard, and Archive
- Start on the **Story tab** to see the current collaborative story in progress
- Use the Help button (?) in the top-right corner for detailed game rules and instructions

#### 2. **Read the Current Story**
- View all existing sentences numbered [1] through [current] in chronological order in the scrollable story display
- Each sentence is displayed with clear numbering to follow the narrative flow
- Scroll through the story area to understand the current plot, tone, and writing style
- If no sentences exist yet, you'll see an invitation to start the story with the first sentence

#### 3. **Check Round Status and Timing**
- Look at the round information showing "Round X • Y/100 sentences" at the top of the story display
- Watch the live countdown timer displaying time until the next round (format: "MM:SS")
- View real-time statistics in the four-panel dashboard: Sentences, Total Votes, Contributors, and Status
- The timer counts down to the next hour (:00 UTC) when the round automatically resolves

#### 4. **Submit Your Creative Contribution**
- Scroll to the submission form below the story display
- Write a sentence that continues the narrative in the expandable text area
- **Character Requirements**: Your sentence must be exactly 10-150 characters long (strictly enforced)
- Use the live character counter that shows "X/150 characters" with color-coded feedback:
  - Red: Under 10 characters (too short) or over 150 (too long) - submission disabled
  - Yellow: 130-150 characters (approaching limit) - valid but near maximum
  - Green: 10-129 characters (optimal range) - ready to submit
- The word counter shows how many words you've written for reference
- Sentences should end with proper punctuation (. ! ?) for best results
- Click "Submit Sentence" to post your contribution as a Reddit comment

#### 5. **Participate in Community Voting**
- Your sentence appears as a Reddit comment formatted as "[Round X] Your sentence"
- Navigate to the Reddit comments section to see all submissions for the current round
- Vote on other players' sentences using Reddit's native upvote system
- The submission with the most upvotes at the end of the round wins and becomes part of the story
- You can change your votes anytime before the round ends at the top of the hour
- Encourage others to vote to increase community engagement

#### 6. **Watch Automatic Round Resolution**
- Every hour at exactly :00 UTC (1:00, 2:00, 3:00, etc.), the round automatically resolves
- The system finds the highest-voted valid sentence from the past hour
- The winning sentence is added to the story and the round counter advances to the next number
- If no valid submissions exist, a fallback sentence "The silence grew..." is automatically used
- The story display updates in real-time with the new sentence and updated statistics
- A new round immediately begins for the next sentence, continuing the collaborative process

#### 7. **Explore the Leaderboard**
- Click the **Leaderboard tab** to view the top 10 completed stories ranked by total community votes
- Stories are ranked by total votes received across all 100 sentences, with ties broken by completion date
- See story previews (first few sentences), creators, vote counts, completion dates, and rankings with medal icons
- Click "View" on any entry to expand and read a longer story preview
- Use the "Share" button to export stories in Reddit-formatted markdown for easy sharing
- The leaderboard updates automatically every 30 seconds when new stories complete

#### 8. **Browse the Archive**
- Click the **Archive tab** to explore all completed stories with full pagination support
- Use the sort dropdown to organize by "Completion Date" (newest first) or "Popularity" (most votes first)
- Navigate through pages using the pagination controls at the bottom (10 stories per page)
- Click "Read Full Story" on any entry to expand and view all 100 sentences with sentence numbering
- Each story shows comprehensive statistics: sentence count, total votes, contributor count, and completion date
- Use the "Share" button to export complete stories for sharing on Reddit or other platforms

#### 9. **Story Completion and New Cycles**
- When the 100th sentence is added, the story is automatically marked complete with a celebration message
- Completed stories are immediately archived and added to the leaderboard rankings based on total votes
- A new story begins automatically, starting fresh at Round 1 with an empty story waiting for the first sentence
- The cycle continues indefinitely, creating an ongoing collaborative storytelling experience
- You'll see completion notifications and can immediately start participating in the new story

### Game Rules & Mechanics:

#### **Submission Requirements:**
- **Character Limit**: Sentences must be exactly 10-150 characters (strictly enforced with real-time validation and color-coded feedback)
- **One Per Round**: Each player can submit one sentence per hourly round through the submission form
- **No Editing**: Submissions cannot be modified once posted (Reddit comment rules apply)
- **Content Guidelines**: Follow Reddit's community guidelines and subreddit rules for appropriate content
- **Proper Punctuation**: Sentences should end with appropriate punctuation (. ! ?) for best narrative flow
- **Real-Time Validation**: The form provides instant feedback on character count, word count, and validity before submission

#### **Voting & Selection Process:**
- **Democratic Process**: Community votes determine winning sentences using Reddit's native upvote system
- **Hourly Cycles**: Rounds end precisely at :00 UTC every hour (e.g., 1:00, 2:00, 3:00) with live countdown timers
- **Automatic Resolution**: System automatically selects the highest-voted valid submission when rounds end
- **Tie Breaking**: In case of vote ties, the earliest submission wins to ensure fair play
- **Fallback System**: If no valid submissions exist, "The silence grew..." is automatically used to maintain story continuity
- **Comment Format**: Submissions are posted as "[Round X] Your sentence" for easy identification in Reddit comments
- **Live Updates**: Story display refreshes automatically when new winning sentences are selected

#### **Story Progression:**
- **Fixed Length**: All stories must reach exactly 100 sentences to complete, ensuring consistent story arcs
- **Sequential Building**: Each sentence builds on all previous sentences chronologically with numbered display
- **Persistent Progress**: Stories continue across multiple days until completion, maintaining long-term engagement
- **Automatic Archival**: Completed stories are immediately archived and ranked on the leaderboard by total votes
- **Continuous Cycle**: New stories begin automatically when previous ones complete, ensuring endless collaborative storytelling
- **Real-Time Statistics**: Track progress with live metrics including sentence count, vote totals, contributor numbers, and completion status

### Advanced Features:

#### **Real-Time Experience:**
- **Live Countdown Timers**: Precise countdown to the next round resolution showing minutes and seconds until the top of each hour
- **Automatic Story Updates**: Story display refreshes automatically when new sentences are added without requiring page reload
- **Network Status Monitoring**: Real-time connection status with offline/online indicators and graceful degradation
- **Status Indicators**: Clear visual feedback for submission success, errors, loading states, and network connectivity
- **Responsive Design**: Mobile-first interface optimized for touch interactions on all device sizes with safe area support
- **Performance Optimization**: Smart caching with TTL, lazy loading, and skeleton screens for fast loading times

#### **Community Features:**
- **Contributor Tracking**: Real-time display of unique players who have contributed to each story with running counts
- **Vote Aggregation**: Running total of community votes across all rounds for each story displayed in statistics dashboard
- **Story Statistics Dashboard**: Four-panel display showing sentences, total votes, contributors, and current status with color-coded indicators
- **Leaderboard Rankings**: Top 10 stories ranked by total community engagement with medal icons, detailed metrics, and expandable previews
- **Story Previews**: Expandable previews in both leaderboard and archive for quick story browsing without full page navigation

#### **Archive & Discovery System:**
- **Paginated Browsing**: Navigate through completed stories 10 at a time with intuitive pagination controls and page indicators
- **Dual Sorting Options**: Sort by completion date (newest first) or popularity (most votes first) with persistent sort preferences
- **Full Story Expansion**: Click to expand any archived story and read all 100 sentences with clear sentence numbering and formatting
- **Story Statistics**: Each archive entry shows completion date, vote totals, contributor counts, and story length with visual indicators
- **Mobile-Optimized Navigation**: Touch-friendly pagination and sorting controls optimized for mobile users with proper touch targets

#### **User Interface Enhancements:**
- **Tab-Based Navigation**: Clean three-tab interface (Story/Leaderboard/Archive) with active state indicators and smooth transitions
- **Touch-Friendly Controls**: All buttons meet 44px minimum touch target size for mobile accessibility with proper spacing
- **Loading States**: Skeleton screens, spinners, and progressive loading provide feedback during data loading and API calls
- **Intelligent Error Handling**: Network error detection, automatic retry logic with exponential backoff, and graceful degradation
- **Safe Area Support**: Proper padding for devices with notches and rounded corners using CSS safe area insets
- **Smart Caching**: API response caching with configurable TTL for improved performance and reduced server load

#### **Error Recovery & Resilience:**
- **Automatic Retry Logic**: Failed requests automatically retry with exponential backoff and configurable retry limits
- **Network Status Detection**: Monitors online/offline status and prevents requests when offline with clear user feedback
- **Graceful Degradation**: App continues to function with cached data when network is unavailable with offline indicators
- **User-Friendly Error Messages**: Clear, actionable error messages with specific retry instructions and troubleshooting guidance
- **Connection Recovery**: Automatic reconnection attempts when network is restored with success notifications

#### **Sharing & Export System:**
- **Reddit-Formatted Export**: Generate shareable Reddit markdown format with story content, statistics, and contributor attribution
- **Copy-to-Clipboard**: One-click copying with fallback support for older browsers and secure/non-secure contexts
- **Story Metadata**: Include completion dates, vote counts, contributor numbers, and leaderboard rankings in shared content
- **Mobile-Optimized Sharing**: Touch-friendly sharing interface with modal dialogs optimized for mobile devices

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
