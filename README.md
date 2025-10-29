# 👻 The Haunted Thread 🕯️

A collaborative horror story experience built with Devvit Web where the Reddit community shapes a spine-chilling narrative together through democratic choice-based voting! This is an advanced interactive storytelling platform that combines real-time voting, atmospheric horror design, and sophisticated state management to create a unique community-driven narrative experience.

**🎮 Play Now:** Install the app on your subreddit and watch as your community collectively writes a branching horror story, one vote at a time!

---

## 🎮 What This Game Is

**The Haunted Thread** is a real-time collaborative horror storytelling experience where Reddit users collectively write a branching horror story through democratic voting. The game presents a mysterious narrative about a haunted Reddit thread that exists across time and reality, where players discover they've become part of an impossible story spanning 50 years.

### The Story Premise

You stumble upon an old Reddit thread titled "HELP - Something is wrong with my house" posted 50 years ago—before Reddit even existed. As you read through deleted accounts and impossible timestamps, you realize the thread is responding to you personally. Your username appears in conversations you never had. The screen flickers with a chilling message: "Welcome back. We've been waiting."

### Core Gameplay

The game creates an immersive horror atmosphere where the community:

- **Reads atmospheric chapters** with flickering title animations, dynamic particle effects (fog, shadows, embers, blood drops), and spine-chilling descriptions that unfold the mystery of the haunted house at 1247 Elm Street
- **Votes on story directions** with live vote counts and real-time updates showing how the collective narrative is being shaped through animated progress bars and percentage tracking
- **Experiences branching narratives** where community decisions lead to multiple story paths and different horror endings (good, bad, neutral, or twist) including "The Digital Guardian," "Forever Online," "The Ultimate Upload," and "The New Network"
- **Tracks story progression** through visual progress indicators showing completed chapters, narrative paths taken, and overall completion percentage with dot-based navigation

Built as a React-based Devvit Web application, The Haunted Thread runs directly within Reddit posts, allowing seamless community participation without leaving the platform. The game features sophisticated real-time synchronization via WebSocket connections, optimistic UI updates, and comprehensive error handling to ensure a smooth collaborative experience even with hundreds of simultaneous participants.

**The Haunted Thread** is a real-time collaborative horror storytelling experience where Reddit users collectively write a branching horror story through democratic voting. The game presents a mysterious narrative about a haunted Reddit thread that exists across time and reality, where players discover they've become part of an impossible story spanning 50 years.

### The Story Premise

You stumble upon an old Reddit thread titled "HELP - Something is wrong with my house" posted 50 years ago—before Reddit even existed. As you read through deleted accounts and impossible timestamps, you realize the thread is responding to you personally. Your username appears in conversations you never had. The screen flickers with a chilling message: "Welcome back. We've been waiting."

### Core Gameplay

The game creates an immersive horror atmosphere where the community:

- **Reads atmospheric chapters** with flickering title animations, dynamic particle effects (fog, shadows, embers, blood drops), and spine-chilling descriptions that unfold the mystery of the haunted house at 1247 Elm Street
- **Votes on story directions** with live vote counts and real-time updates showing how the collective narrative is being shaped through animated progress bars and percentage tracking
- **Experiences branching narratives** where community decisions lead to multiple story paths and different horror endings (good, bad, neutral, or twist) including "The Digital Guardian," "Forever Online," "The Ultimate Upload," and "The New Network"
- **Tracks story progression** through visual progress indicators showing completed chapters, narrative paths taken, and overall completion percentage with dot-based navigation

Built as a React-based Devvit Web application, The Haunted Thread runs directly within Reddit posts, allowing seamless community participation without leaving the platform. The game features sophisticated real-time synchronization via WebSocket connections, optimistic UI updates, and comprehensive error handling to ensure a smooth collaborative experience even with hundreds of simultaneous participants.

## 🌟 What Makes This Game Innovative & Unique

### 🏛️ True Democratic Storytelling

Unlike traditional choose-your-own-adventure games where one person makes decisions, **The Haunted Thread** creates stories through genuine community consensus. Every narrative direction is determined by collective voting with Redis-based transaction-safe vote storage, making each story truly representative of the community's choices and creating a unique democratic storytelling experience where:

- **Every vote matters**: The community collectively decides the story's direction through secure voting with duplicate prevention via Redis transactions
- **No single player controls the narrative**: The story unfolds based on majority consensus with real-time percentage tracking showing the community's collective will
- **Shared ownership**: Everyone contributes to creating a unique horror tale together, with all decisions tracked and stored in Redis with 24-hour TTL
- **Meta-narrative horror**: The story itself is about a haunted Reddit thread, creating a unique blend of digital horror and community storytelling that breaks the fourth wall

### ⚡ Real-Time Collaborative Experience

- **Live Vote Tracking**: Watch vote counts change in real-time as community members cast their votes via `RealtimeManager.broadcastVoteUpdate`, with animated progress bars (`vote-progress-fill` CSS class) showing the current consensus
- **Optimistic Updates**: Your vote appears instantly with visual confirmation and glowing animations (`glow-animation` CSS class), even before server confirmation through `applyOptimisticUpdate` function
- **Synchronized State Management**: Advanced state synchronization using custom React hooks (`useSynchronizedState` with `mergeOptimisticWithServer`, `useRealtime` with WebSocket connections) ensures all players see the same story progression simultaneously
- **Fallback Polling**: Automatic switching to polling mode (3-second intervals via `refreshVoteCounts`) when real-time connections fail (detected by `connectionStatus` state), ensuring the game remains playable even with network issues
- **Concurrent Interaction Management**: Queue system (`useConcurrentInteractions` hook with `queueAction`) handles multiple simultaneous votes without conflicts or race conditions using action queuing and rollback mechanisms

### 🎭 Immersive Horror Atmosphere

- **Dynamic Visual Effects**: Atmospheric particle systems (`ParticleEffects` component with `particle-fog`, `particle-embers`, `particle-shadows`, `particle-blood-drops` CSS classes) create fog, shadows, embers, and blood drops that respond to story intensity levels
- **Horror-Themed UI**: Flickering animations (`flicker-animation` keyframes with 10-step opacity variations), eerie typography (Creepster for titles via `--horror-font-primary`, Nosifer for subtitles via `--horror-font-secondary`, Crimson Text for body), and dark color schemes (dark red `--horror-red: #8B0000`, almost black `--horror-black: #0D0D0D`) create genuine atmospheric tension
- **Responsive Visual Elements**: Visual effects adapt to story progression with different intensity levels (low: 0.3 opacity, medium: 0.6 opacity, high: 0.9 opacity) based on narrative tension through `VisualEffects` component
- **Mobile-Optimized Horror**: Full responsive design with touch-friendly voting buttons (44px minimum size via `.horror-button` class), optimized animations (disabled particles on mobile for performance), and safe area padding (`safe-area-padding` utility class with `env(safe-area-inset-*)`) maintains the horror atmosphere across all devices

### 🌿 Sophisticated Branching Narratives

- **Multiple Story Paths**: Complex branching system with 10+ unique story branches including:
  - **Opening**: "The Haunted Thread" - Discovery of the impossible Reddit thread
  - **Investigation Path**: "Down the Digital Rabbit Hole" - Uncovering the house's secrets
  - **Escape Attempt**: "No Escape" - Trying to break free from the digital trap
  - **Engagement Path**: "Joining the Conversation" - Becoming part of the story
  - **House Arrival**: "The House on Elm Street" - Confronting the source
  - **House Interior**: "Inside the Impossible" - Exploring the reality-defying house
  - **Revelation Path**: "The Truth Unveiled" - Learning the house's true nature
  - **Cycle Breaking**: "Breaking the Chain" - Attempting to free all trapped souls
  - **Final Battle**: "The Last Stand" - The ultimate confrontation
- **Seven Unique Endings**: Multiple conclusion types including:
  - **Good Endings**: "The Ultimate Upload" (heroic sacrifice freeing all), "The New Network" (transforming horror into healing)
  - **Bad Endings**: "The Futile Flight" (failed escape attempt), "Forever Online" (eternal digital imprisonment)
  - **Neutral Endings**: "The Digital Guardian" (accepting the caretaker role), "The Lone Wolf's Gambit" (partial success with sacrifice)
  - **Twist Ending**: "Digital Apocalypse" (destroying the internet to break free)
- **Contextual Storytelling**: Each chapter builds on previous community choices, creating coherent narrative continuity with decisions affecting available paths and endings
- **Path Tracking**: Visual progress indicators show the journey through the story with completed (orange), current (red with glow), and upcoming (gray) narrative branches
- **Story Replay System**: Allows exploring alternative narrative paths and seeing how different choices affect outcomes, with completed paths tracked for replay value
- **History Tracking**: Complete decision timeline showing all previous chapters and community voting results with timestamps

### 🛡️ Advanced Technical Architecture

- **Concurrent Interaction Management**: `useConcurrentInteractions` hook with `queueAction` method handles hundreds of simultaneous votes without conflicts using action queuing with FIFO processing and automatic retry on failure
- **Comprehensive Error Recovery**: `ErrorBoundary` components with `componentDidCatch` lifecycle and graceful degradation via `ErrorRecovery.withRetry` (max 3 retries with exponential backoff) ensure the game remains playable even during network issues
- **Performance Optimization**: Redis caching (`RedisOptimizer` with `MemoryCache` class, 1-minute default TTL), message throttling (`MessageThrottler` with 1-second vote throttle), and optimized state management via `useSynchronizedState` for smooth performance
- **Content Moderation**: Built-in reporting system (`ContentModerator.reportContent` with reason tracking) and administrative controls (`AdminInterface` with admin key validation) for community safety
- **Optimistic UI Updates**: Instant visual feedback with automatic rollback on conflicts using `applyOptimisticUpdate` (stores rollback functions) and `rollbackOptimisticUpdate` (executes stored rollback), with conflict detection via `mergeOptimisticWithServer`

### 📱 Seamless Reddit Integration

- **Native Reddit Experience**: Runs directly within Reddit posts using Devvit Web (`@devvit/web/client` and `@devvit/web/server`) without external navigation, with full-screen webview mode
- **Automatic Authentication**: Uses Reddit's authentication system via `reddit.getCurrentUsername()` in server endpoints - no separate accounts needed, with automatic user ID extraction for vote tracking
- **Community-Driven**: Designed specifically for Reddit's collaborative culture with features like user vote tracking (`hasUserVoted` checks), community consensus visualization (real-time vote percentages), and post-specific story instances
- **Cross-Platform Compatibility**: Works seamlessly on Reddit's mobile app, desktop site, and mobile web with responsive design (Tailwind CSS with mobile-first approach), touch-optimized controls (44px minimum touch targets), and safe area padding for notched devices

## 🎯 How to Play The Haunted Thread

### 🚀 Getting Started

1. **🎮 Launch the Game**:

   - Find The Haunted Thread post in your Reddit feed
   - Click the "Play" button to open the game in full-screen mode within Reddit's webview
   - The game loads with atmospheric horror styling featuring:
     - Flickering title: "The Haunted Thread"
     - Dynamic particle effects (fog and shadows drifting across the screen)
     - Dark, ominous color scheme with blood-red accents
     - Eerie typography designed to enhance the horror atmosphere

2. **📖 Read the Current Chapter**:

   - Each story chapter presents a new part of the haunting narrative:
     - **Opening Chapter**: You discover an impossible Reddit thread posted 50 years before Reddit existed, with your username appearing in conversations you never had
     - **Flickering Titles**: Chapter titles flicker like a dying light bulb, creating an unsettling atmosphere
     - **Rich Narrative**: Immersive horror descriptions split into readable paragraphs that draw you deeper into the mystery
     - **Visual Effects**: Atmospheric elements like fog, shadows, and other effects that intensify as the story progresses
     - **Horror Typography**: Custom creepy fonts that enhance the spooky mood

3. **📊 Track Your Progress**:
   - Visual indicators show your journey through the branching narrative:
     - **Progress Bar**: Animated bar showing your completion percentage through the story
     - **Chapter Dots**: Interactive dots showing completed chapters (orange), current chapter (glowing red), and upcoming chapters (gray)
     - **Path Information**: See which narrative paths you've taken and which branches are still available
     - **Chapter Counter**: Current chapter number out of total chapters (e.g., "Chapter 3 of 10")

### 🗳️ Making Your Choice

4. **👀 Review Your Options**:

   - Each chapter presents multiple story choices (typically 2-4 options) with detailed information:
     - **Choice Text**: The main action or decision (e.g., "Continue reading the thread," "Close the browser immediately," "Post a reply to the thread")
     - **Description**: Additional context about what this choice means (e.g., "Dive deeper into the mysterious posts")
     - **Consequences**: Hints about potential story outcomes (e.g., "May uncover disturbing truths")
     - **Live Vote Counts**: Real-time vote tallies showing how many people chose each option
     - **Vote Percentages**: Animated progress bars showing the percentage of votes for each choice
     - **Total Votes**: Community participation counter showing total votes across all choices

5. **🎯 Cast Your Vote**:

   - Click on a choice button to vote for how you want the story to continue
   - **Interactive Buttons**: Large, touch-friendly buttons with hover effects and horror-themed styling
   - **Real-Time Feedback**: Your vote appears instantly with visual confirmation (glowing red border)
   - **Vote Validation**: The system prevents duplicate voting - you can only vote once per chapter
   - **Clear Status**: See "You have cast your vote. Waiting for others..." message after voting
   - **Loading States**: Horror-themed loading spinner appears while your vote is being processed

6. **✅ Confirm Your Selection**:
   - Your chosen option immediately highlights with a glowing red animation
   - The system provides instant visual feedback before server confirmation
   - Vote counts update in real-time as other community members cast their votes
   - If there's a network issue, the system automatically retries with error recovery
   - Once voting is complete, the winning choice is highlighted and the story advances

### 📊 Following the Story

7. **📈 Watch Real-Time Updates**:

   - Observe live vote counts and percentages as other Reddit users make their choices:
     - **Live Vote Counts**: See exact vote numbers for each choice update in real-time
     - **Animated Progress Bars**: Visual representation of community consensus with smooth animations
     - **Percentage Tracking**: Real-time calculation of vote distribution (e.g., "45.2%")
     - **Connection Status**: See if you're connected to live updates or using polling mode
     - **Fallback Polling**: If real-time connection fails, the system automatically polls every 3 seconds to keep you updated

8. **🔄 Experience Story Transitions**:

   - When voting concludes, experience smooth transitions to the next chapter:
     - **Winner Announcement**: The choice with the highest vote count is highlighted
     - **Smooth Animations**: Horror-themed transitions with fading, scaling, and filter effects
     - **Story Continuation**: Automatic progression to the next chapter based on the community's decision
     - **New Choices**: Each new chapter presents fresh decisions based on the path taken
     - **Branching Paths**: Your collective choices determine which story branches you explore

9. **📚 View Story History**:
   - Access the expandable Story History sidebar (toggle button in top-right) to see:
     - **Complete Chapter History**: All previous chapters with full content
     - **Decision Timeline**: Community voting results for each chapter showing winning choices
     - **Narrative Path Analysis**: Visual representation of how choices led to the current story state
     - **Vote Statistics**: Detailed vote counts and participation data for each decision point

### 🎭 Advanced Features

10. **⚡ Instant Feedback System**:

    - **Optimistic Updates**: Your votes appear instantly with visual confirmation before server response
    - **Conflict Resolution**: Automatic rollback if server conflicts occur, restoring previous state seamlessly
    - **Loading States**: Clear feedback during processing with horror-themed loading spinners
    - **Progress Tracking**: Progress bars show operation completion percentage with smooth animations

11. **🔄 Connection Management**:

    - **Connection Status Indicators**: Real-time connection status display:
      - 🟢 **Connected**: Live updates active
      - 🟡 **Connecting**: Establishing connection
      - 🟠 **Disconnected**: Using polling mode (updates every 3 seconds)
      - 🔴 **Error**: Connection failed
    - **Automatic Reconnection**: System automatically attempts to reconnect with exponential backoff
    - **Fallback Polling**: Automatic switch to polling mode when real-time connection fails
    - **Manual Reconnect**: "Retry Live Updates" button to manually reconnect
    - **Network Monitoring**: Tracks online/offline status and notifies you of connection changes

12. **🛡️ Error Recovery**:
    - **Graceful Degradation**: Game remains playable even with network issues
    - **Clear Error Messages**: User-friendly error descriptions with helpful context
    - **Automatic Retries**: Failed operations automatically retry with exponential backoff
    - **Timeout Handling**: 10-second timeout for operations with clear timeout messages
    - **Error Boundaries**: Comprehensive error catching prevents the entire app from crashing

### 🎬 Story Completion & Exploration

13. **🎭 Experience Multiple Endings**:

    - The branching narrative system leads to seven unique conclusions:
      - **Good Endings**:
        - "The Ultimate Upload" - Sacrifice yourself to free all trapped souls, becoming the internet itself
        - "The New Network" - Transform the haunted house into a healing sanctuary for lost digital souls
      - **Bad Endings**:
        - "The Futile Flight" - Your escape attempt fails, trapping you in the digital void forever
        - "Forever Online" - Become another voice in the eternal Reddit thread, warning future victims
      - **Neutral Endings**:
        - "The Digital Guardian" - Accept your role as caretaker, finding purpose in the impossible
        - "The Lone Wolf's Gambit" - Scatter your consciousness across the internet as a guardian angel
      - **Twist Ending**:
        - "Digital Apocalypse" - Destroy the house but accidentally end the internet itself
    - Endings are determined by the community's collective decision path throughout the story

14. **🌿 Explore Different Paths**:

    - **Story Reset Functionality**: Admins can reset the story to explore alternative narratives
    - **Path Comparison**: View how different choice combinations affect outcomes
    - **Branch Exploration**: Discover alternative narrative routes and see what could have been
    - **Completed Path Tracking**: System tracks completed paths for replay value
    - **Administrative Controls**: Admins can reset stories via the "🔄 Reset Story" button (requires admin key)

15. **🏆 Share the Experience**:
    - Completed stories become permanent Reddit community artifacts:
    - **Story Persistence**: Full narrative history stored with 24-hour TTL (7 days for completed paths)
    - **Community Discussion**: Stories can be shared and discussed within Reddit comments
    - **Replay Value**: Previous stories can be revisited to see different outcomes
    - **Statistics Tracking**: View story stats including total chapters, participation rates, and engagement metrics

### 🛡️ Community Features

16. **📝 Content Moderation**:

    - **Report Content**: One-click reporting button for inappropriate material
    - **Community Safety**: Content validation and report tracking with status updates (pending, reviewing, resolved, dismissed)
    - **Administrative Controls**: Comprehensive management tools for moderators with admin key validation
    - **Content Validation**: Automatic content filtering before posting

17. **👑 Administrative Features** (for moderators):
    - **Story Management**: Manual story advancement and reset capabilities (requires admin key)
    - **Performance Monitoring**: Real-time system performance metrics for server, Redis, and realtime connections
    - **User Management**: Administrative oversight of user interactions and voting patterns
    - **Moderation Queue**: Review reported content with status tracking and moderator notes
    - **Admin Logs**: Track all administrative actions with timestamped log entries
    - **Statistics Dashboard**: View comprehensive story statistics including vote counts, participation rates, and engagement metrics

### 💡 Pro Tips for Best Experience

- **📱 Mobile Optimized**: Works seamlessly on both desktop and mobile devices with touch-friendly voting buttons, responsive design, and optimized performance. Particle effects are automatically disabled on mobile for better performance.
- **🔄 Real-Time Sync**: Experience live updates without page refreshes. You'll see other votes appearing in real-time as the community makes decisions. If real-time connection fails, the system automatically switches to polling mode (updates every 3 seconds).
- **🎨 Visual Immersion**: Pay attention to the atmospheric effects - they dynamically respond to story intensity levels and help create an immersive horror experience with fog, shadows, embers, and blood drops that intensify as the story progresses.
- **📖 Read Carefully**: Each chapter builds on previous community choices, so understanding the narrative context enhances your participation in the collaborative storytelling. Use the Story History sidebar to review the complete decision timeline.
- **🤝 Community Engagement**: Remember that this is truly collaborative storytelling - every vote matters and contributes to shaping a unique narrative experience for the entire community. The system prevents duplicate voting, so choose wisely!
- **🎭 Horror Atmosphere**: Immerse yourself in the carefully crafted horror atmosphere with:
  - **Flickering animations**: Text and elements that create an eerie feeling
  - **Horror typography**: Specially chosen creepy fonts (Creepster for titles, Crimson Text for body text)
  - **Dynamic particle effects**: Visual elements that respond to the story's intensity
  - **Color schemes**: Dark themes with strategic use of blood red, dark gray, and ominous shadows
- **🕐 Timing**: Vote early to see your choice reflected in the community consensus. Late votes still count but may not change the outcome if one choice has a commanding lead.
- **💬 Discuss**: Use Reddit comments to discuss the story with other players, share theories about what might happen next, and debate the best choices.
- **🔄 Replay**: If you want to explore different story paths, ask an admin to reset the story (requires admin key). This lets the community experience alternative branches and endings.

### 🎮 Core Game Components

The game is built with several key React components that work together to create the immersive experience:

- **App** (`src/client/App.tsx`): Main application component that orchestrates all game features, manages state through custom hooks (`useStory`, `useVoting`, `useRealtime`, `useSynchronizedState`), and provides context providers (`LoadingProvider`, `ModerationProvider`)
- **StoryChapter** (`src/client/components/StoryChapter.tsx`): Renders atmospheric horror chapters with the `VisualEffects` component, flickering title animations, and automatically formatted paragraph content
- **VotingInterface** (`src/client/components/VotingInterface.tsx`): Handles democratic voting with real-time vote counts, animated progress bars, choice selection with hover effects, and vote validation to prevent duplicate voting
- **StoryProgress** (`src/client/components/StoryProgress.tsx`): Shows visual progress through the story with dot-based chapter navigation (completed, current, upcoming), animated progress bars, and narrative path tracking
- **LoadingSpinner** (`src/client/components/LoadingSpinner.tsx`): Provides user feedback during vote casting and story transitions with horror-themed animations, progress tracking, elapsed time display, and timeout warnings
- **ParticleEffects** (`src/client/components/ParticleEffects.tsx`): Creates atmospheric visual effects (fog, shadows, embers, blood drops) that respond to story intensity levels with different opacity and animation speeds
- **ErrorBoundary** (`src/client/components/ErrorBoundary.tsx`): Ensures graceful error handling to keep the game playable even when issues occur, with detailed error information and recovery options
- **StoryHistory** (`src/client/components/StoryHistory.tsx`): Expandable sidebar showing complete chapter history, decision timeline, and narrative path analysis
- **AdminInterface** (`src/client/components/AdminInterface.tsx`): Comprehensive administrative dashboard for story management, performance monitoring, and content moderation
- **LoadingOverlay** (`src/client/components/LoadingOverlay.tsx`): Global loading state display with connection status indicators and inline loading indicators

### 🔧 Custom React Hooks

The game uses sophisticated custom hooks for state management and real-time synchronization:

- **useStory** (`src/client/hooks/useStory.ts`): Manages story state including current chapter, context, progression, and voting status. Fetches story data from `/api/story/current` with automatic retries and error handling.
- **useVoting** (`src/client/hooks/useVoting.ts`): Handles vote casting, vote count retrieval, and user vote status tracking. Implements optimistic updates with rollback on errors and automatic vote count refreshing.
- **useRealtime** (`src/client/hooks/useRealtime.ts`): Manages WebSocket connections for real-time updates with automatic reconnection (max 3 attempts), exponential backoff, and graceful degradation to polling mode when connections fail.
- **useSynchronizedState** (`src/client/hooks/useSynchronizedState.ts`): Advanced state synchronization that merges optimistic updates with server data, handles vote updates, chapter transitions, and story resets with conflict resolution.
- **useConcurrentInteractions** (`src/client/hooks/useConcurrentInteractions.ts`): Manages concurrent user interactions with action queuing to prevent race conditions and ensure consistent state updates.
- **useLoading** (`src/client/contexts/LoadingContext.tsx`): Provides loading state management with progress tracking, timeout handling, and user feedback for all asynchronous operations.

### 🎭 Core Gameplay Experience

Players participate in a **living horror story** that unfolds in real-time through community voting:

1. **📖 Read Atmospheric Chapters**: Each story chapter displays with horror-themed styling, flickering title animations, and immersive content enhanced by dynamic visual effects including fog, shadows, embers, and atmospheric particle systems
2. **🗳️ Vote on Story Direction**: The voting interface presents multiple story choices with detailed descriptions, potential consequences, and real-time vote tracking with animated progress bars
3. **📊 Watch Democracy in Action**: See live vote counts, percentages, and visual feedback showing community consensus as votes are cast, with optimistic updates providing instant feedback
4. **🌿 Experience Branching Narratives**: Your collective choices create unique story paths through a sophisticated branching narrative system leading to different horror endings based on community decisions
5. **📚 Track Your Journey**: Visual progress indicators show story advancement through chapters, with complete decision history and voting statistics available through an expandable sidebar

## 🎮 Game Interface Elements Guide

- **🔄 Story Replay Button**: Access story management and replay different paths
- **⚙️ Admin Access**: Enter administrator mode (requires admin key) for story management
- **📚 History Toggle**: Open/close the story history sidebar
- **📡 Connection Status**: Shows your real-time connection status with automatic reconnection
- **📊 Vote Progress Bars**: Visual representation of vote percentages with animated fills
- **🎯 Choice Buttons**: Interactive voting options with hover effects and horror-themed styling
- **📈 Progress Indicators**: Dots showing chapter progression through the story

## 🎯 Step-by-Step Gameplay Instructions

### 🚀 Getting Started

1. **🎮 Launch the Game**: Click the "Play" button on the Reddit post to open The Haunted Thread in full-screen mode within Reddit's webview. The game loads with atmospheric horror styling and particle effects managed by the main `App` component
2. **📖 Read the Current Chapter**: The `StoryChapter` component displays the current story chapter with horror-themed styling, including:
   - **Chapter Title**: Displayed with flickering horror animations using CSS classes like `flicker-animation`
   - **Story Content**: Rich narrative text with atmospheric descriptions, automatically split into readable paragraphs
   - **Visual Effects**: Dynamic particle systems managed by the `VisualEffects` component that respond to story intensity
3. **📊 Track Your Progress**: The `StoryProgress` component shows your journey through the story with:
   - **Progress Bar**: Visual percentage completion with animated fills
   - **Chapter Dots**: Dot-based navigation showing completed, current, and upcoming chapters
   - **Path Information**: Display of narrative paths taken and available branches

### 🗳️ Making Your Choice

4. **👀 Review Your Options**: The `VotingInterface` component presents multiple story choices with detailed information:
   - **Choice Text**: The main action or decision with horror-themed styling
   - **Description**: Additional context about the choice's implications (if provided)
   - **Consequences**: Hints about potential story outcomes in italicized text (if provided)
   - **Live Vote Counts**: Real-time vote tallies and percentages with animated progress bars
5. **🎯 Select Your Path**: Click on a choice button to vote for how you want the story to continue. The interface provides:
   - **Interactive Choice Buttons**: Touch-friendly buttons with hover effects and horror-themed styling
   - **Vote Progress Bars**: Visual representation of vote percentages with animated fills using the `vote-progress-bar` CSS class
   - **Real-Time Feedback**: Instant visual confirmation when you cast your vote through optimistic updates
6. **✅ Confirm Your Vote**: Your selection immediately highlights with glowing animations and is marked as your official vote. The system provides:
   - **Optimistic Updates**: Instant visual feedback before server confirmation using the `useSynchronizedState` hook
   - **Vote Validation**: Prevention of duplicate voting with clear user feedback
   - **Error Recovery**: Graceful handling of network issues with retry mechanisms through the `useVoting` hook

### 📊 Following the Story

7. **📈 Watch Real-Time Updates**: Observe live vote counts and percentages as other Reddit users make their choices through the `useRealtime` hook:
   - **Live Vote Counts**: See exact vote numbers for each choice updated in real-time
   - **Animated Progress Bars**: Visual representation of community consensus with smooth animations
   - **Percentage Tracking**: Real-time calculation of vote distribution with automatic updates
8. **🔄 Experience Story Transitions**: When voting concludes, experience smooth transitions managed by the `Transition` component:
   - **Chapter Transitions**: Smooth animations between story segments using the `ChapterTransition` component
   - **Winner Announcement**: Clear indication of the winning choice through the voting interface
   - **Story Continuation**: Automatic progression to the next chapter based on community decision
9. **📚 View Story History**: Access the expandable story history sidebar through the `StoryHistory` component to see:
   - **Complete Chapter History**: All previous chapters with full content
   - **Decision Timeline**: Community voting results for each chapter
   - **Narrative Path Analysis**: How choices led to the current story state
   - **Voting Statistics**: Detailed vote counts and participation data

### 🔧 Advanced Features You'll Experience

10. **⚡ Instant Feedback**: The game uses sophisticated state management for immediate responsiveness:
    - **Optimistic Updates**: Votes appear instantly with visual confirmation through the `useSynchronizedState` hook
    - **Conflict Resolution**: Automatic rollback if server conflicts occur
    - **Loading States**: Clear feedback during processing with the `LoadingSpinner` component and `LoadingContext`
11. **🔄 Connection Management**: The `useRealtime` hook provides robust connection handling:
    - **Connection Status Indicators**: Visual indicators showing real-time connection status through the `ConnectionStatusIndicator`
    - **Automatic Reconnection**: Exponential backoff retry logic for failed connections (reduced to 2-second delays for faster recovery)
    - **Fallback Polling**: Automatic switch to polling mode when real-time fails, with 3-second intervals
    - **Manual Reconnect**: User-initiated reconnection attempts through connection status buttons
12. **🛡️ Error Recovery**: Comprehensive error handling through `ErrorBoundary` components:
    - **Graceful Degradation**: Game remains playable even with network issues
    - **Clear Error Messages**: User-friendly error descriptions and recovery options
    - **Retry Mechanisms**: Automatic and manual retry options for failed operations through the `ApiClient`
13. **🌫️ Atmospheric Effects**: The `ParticleEffects` component creates dynamic immersion:
    - **Fog Particles**: Drifting fog effects for mysterious atmosphere using the `particle-fog` CSS class
    - **Ember Effects**: Rising embers during intense story moments with the `particle-embers` class
    - **Shadow Animations**: Shifting shadows that create unease through the `particle-shadows` class
    - **Blood Drops**: Atmospheric blood drop effects for dark scenes using the `particle-blood-drops` class
    - **Intensity Scaling**: Effects respond to story intensity levels with different opacity and animation speeds

### 🎭 Story Completion & Exploration

14. **🎬 Experience Multiple Endings**: The branching narrative system leads to various conclusions:
    - **Good Ending**: Community choices lead to positive story resolution
    - **Bad Ending**: Dark decisions result in tragic or horrifying outcomes
    - **Neutral Ending**: Balanced choices create ambiguous conclusions
    - **Twist Ending**: Unexpected revelations that completely reframe the story
15. **🌿 Explore Different Paths**: The `StoryReplay` component allows exploration of alternative narratives:
    - **Story Reset Functionality**: Administrative controls to restart stories
    - **Path Comparison**: View how different choice combinations affect outcomes
    - **Branch Exploration**: Discover alternative narrative routes
16. **🏆 Share the Experience**: Completed stories become permanent Reddit community artifacts:
    - **Story Persistence**: Full narrative history stored in Redis through the server's data management system
    - **Community Discussion**: Stories can be shared and discussed within Reddit
    - **Replay Value**: Previous stories can be revisited and analyzed

### 🛡️ Content Moderation Features

17. **📝 Report Content**: The `ContentReportButton` component enables community moderation:
    - **Easy Reporting**: One-click content reporting for inappropriate material
    - **Report Tracking**: Status updates on submitted reports
    - **Community Safety**: Collaborative content moderation system
18. **👑 Admin Controls**: The `AdminInterface` component provides comprehensive management:
    - **Story Management**: Manual story advancement and reset capabilities
    - **Content Moderation**: Review and respond to community reports
    - **Performance Monitoring**: Real-time system performance metrics
    - **User Management**: Administrative oversight of user interactions

### 💡 Pro Tips for Best Experience

- **📱 Mobile Optimized**: The game works seamlessly on both desktop and mobile devices with touch-friendly voting buttons (44px minimum size), responsive design, and optimized performance for mobile browsers
- **🔄 Real-Time Sync**: Experience live updates across all players without page refreshes. You'll see other votes appearing in real-time as the community makes decisions
- **🎨 Visual Immersion**: Pay attention to the atmospheric effects and animations - they dynamically respond to story intensity and help create an immersive horror experience
- **📖 Read Carefully**: Each chapter builds on previous community choices, so understanding the narrative context enhances your participation in the collaborative storytelling
- **🤝 Community Engagement**: Remember that this is truly collaborative storytelling - every vote matters and contributes to shaping a unique narrative experience for the entire community
- **🎭 Horror Atmosphere**: Immerse yourself in the carefully crafted horror atmosphere with:
  - **Flickering animations**: Text and elements that create an eerie feeling using CSS classes like `flicker-animation`
  - **Horror typography**: Specially chosen fonts that enhance the spooky mood through CSS variables like `--horror-font-primary`
  - **Dynamic particle effects**: Visual elements that respond to the story's intensity
  - **Color schemes**: Dark themes with strategic use of red, orange, and shadow colors defined in CSS variables

### 🎮 Interface Elements Guide

- **🔄 Story Replay Button**: Access story management and replay different paths through the `StoryReplay` component
- **⚙️ Admin Access**: Enter administrator mode (requires admin key) through the `AdminInterface`
- **📚 History Toggle**: Open/close the story history sidebar using the `StoryHistory` component
- **📡 Connection Status**: Shows your real-time connection status through the `ConnectionStatusIndicator`
- **📊 Vote Progress Bars**: Visual representation of vote percentages with animated fills
- **🎯 Choice Buttons**: Interactive voting options with hover effects and horror-themed styling
- **📈 Progress Indicators**: Dots showing chapter progression through the story using the `StoryProgress` component

ive

### 🔧 Advanced Technical Features

- \*\*⚡ Optimistic Updates with Conf

- **📡 Real-Time State Synchronization**: Live updates across all players using Devvit's realtime channels with automatic reconnection, message throttling, and seamless state merging. See other players' votes appear in real-time without page refreshes
- **🛡️ Comprehensive Error Recovery**: Sophisticated error handling that keeps the game playable even when network issues occur, with graceful degradation, retry mechanisms, and clear user feedback about connection status
- **🎯 Advanced State Management**: Custom React hooks (`useStory`, `useVoting`, `useRealtime`, `useSynchronizedState`) manage synchronized state, concurrent interactions, and optimistic updates with rollback capabilities, ensuring consistent game stas

### 🎨 Immersive Horror Design

- \*\*🌫️ Dynamic Particle Effecere

- **🎭 Responsive Visual Elements**: Visual effects that adapt to story progression, with different particle intensities and color schemes based on narrative tension
- **📱 Mobile-Optimized Horror**: Full responsive design with touch-friendly voting buttons, optimized animations for mobile performance, and horror styling thices

### 🎮 Unique Gameplay Mechanics

- \*\*🏛️ Democratic Horror Directg
  nes
- **🎭 Multiple Horror Endings**: Different voting patterns lead to various story conclusions (good, bad, neutral, twist endings) based on the cumulative choices made by the community throughout the story
- **🌫️ Atmospheric Immersion**: Dynamic particle effects (fog drifting across the screen, glowing embers rising, shifting shadows, blood drops) that respond to story intensity and create an immersive horror atmosphere
- **⏱️ Real-Time Voting Sessions**: Each chapter has live voting periods where the community decides the next direction, creating suspense as you watch vote counts change and consensus form in real-time
- **🎨 Interactive Story Components**: Each chapter includes rich visual elements, atmospheric effects, horror-themed typography, and animations that enhance the storytelling experience

### 👥 Community Features

- \*\*📜 Interactive Story rs

- **📱 Mobile-Optimized Experience**: Fully responsive design with touch-friendly voting buttons, optimized animations for mobile performance, and safe area padding for devices with notches or rounded corners
- **🔗 Seamless Reddit Integration**: Native integration with Reddit's authentication system, automatic user identification, and embedded gameplay within Reddit posts. No separate accounts or logins required
- **🛡️ Content Moderation System**: Built-in content reporting, administrative controls for story management, and validation systems to maintain appropriate horror themes while preventing abuse

### 🔬 Technical Architecture Highlights

- \*\*⚡ Optimistic on
  n logic
- **📡 Real-Time Synchronization**: Live state updates across all players using `useRealtions fail
- **🌫️ Atmospheric Effects**: Dynamic particle systems anices
- **🛡️ Comprehensive Error Recovery**: Robust error handditions
- **🗄️ Redis Data Persistence**: Sophisticated data management with Redis-based storage, caching through `RedisOptimizty

## 🛠️ Tech Stack

ffects

- **Backend**: Expres
  ls
- **Story Engine**:r`)
  ution
- **Data Storage**: Redis for story state, voting history, and user tracking
- **State Management**: Custom React hooks for synchronized state and concurrent interactions

## 📖 Story Mechanics

### Story Structue

- **Chapter-Based Narrative**: Each story unfolds through atmospheric horror chapters with rich descriptions and ent
- **Choice-Driven Progression**: Every chapter presents 2-4 carefully crafted choices that determine the sn
- **Branching Paths**: Different voting outcomes create unique narrative branches leading to difes
- **Multiple Endings**: Stories conclude with various horror endings (good, bad, neutral, or twist) based on the path taken

### Voting System

- **Democratic Choice Selection**: Community votes determine which story choice becomes the official path forward
- **Real-time Vote Tracking**: Live vote counts and percentages show community preferencesp
- **One Vote Per User**: Each Reddit user can cast one vote per chapter, preventing manipulation
- **Visual Feedback**: Voting interface shows your choice, vote counts, and community cons

### Story Progression

- \*\*Visual Progress Trled
  e
- **Narrative Continuity**: Each chapter builds on previous choices, creating contextual storytelling
- **Ending Detection**: System recognizes when story paths reach their natural conclusions

## 🔧 Development

### Getting Started

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development server
   wser

ommands

- `npm run dev`: Start development server with hot reloading
- `npm run build`: Build for production deployment
- `npm run deploy`: Deploy to Reddit's infrastructure
- `npm run launch`: Publish for community review
- `npm run check`: Run code quality checks and tests

### Project Structure

```
src/
├── client/                    # React frontend application
oint
│   ├── App.tsx           e logic

│   │   ├── StoryChapter.tsx  # Story chapter rendering with visual effects
│   │   ├── VotingInterface.tsx # Voting controls with real-time updates
│   │   ├── StoryProgress.tsx # Progress tracking and visualization
│   │   ├── StoryHistory.tsx  # Story progression and history sidebar
│   │   ├── LoadingSpinner.tsx # Loading states and feedback
│   │   ├── ErrorBoundary.tsx # Error handling and recovery
│   │   └── index.ts         # Component exports
│   ├── hooks/                # Custom React hooks
│   │   ├── useStory.ts      # Story state management
│   │   ├── useVoting.ts     # Voting system integration
│   │   ├── useRealtime.ts   # Real-time synchronization
│   │   └── useSynchronizedState.ts # Advanced state management
│   ├── contexts/            # React contexts
│   │   ├── LoadingContext.tsx # Loading state management
ration
│   ├── utils/               # Client utiles
ring
│   └── index.css            # Horror-themed styling with animations
├── server/                   # Express backend
│   ├── index.ts             # API endpoints and Reddit integration
│   ├── core/                # Business logic modules
│   │   ├── voting-manager.ts # Vote processing and aggregation
│   │   ├── realtime-manager.ts # Real-time message broadcasting
│   │   └── story-state-manager.ts # Story progression management
│   └── utils/               # Server utilities
│       ├── error-handler.ts # Server-side error handling
│       ├── redis-error-handler.ts # Redis operations with error handling
│       └── redis-optimizer.ts # Performance optimization
└── shared/                  # Shared TypeScript definitions
    └── types/               # Type definitions
        ├── story.ts         # Story data structures and validation
        ├── voting.ts        # Voting system types
        └── api.ts           # Client-server communication contracts
```
