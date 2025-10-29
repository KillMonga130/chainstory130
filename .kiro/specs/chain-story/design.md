# Chain Story Design Document

## Overview

Chain Story is a collaborative storytelling game built on Reddit's Devvit platform that enables community members to create stories together through hourly voting cycles. The system combines React frontend components, Node.js backend services, Redis data persistence, and Reddit's native commenting and voting systems to create an engaging real-time collaborative experience.

The game operates on a simple but powerful loop: users submit sentences as Reddit comments, the community votes using upvotes, and every hour the highest-voted sentence automatically becomes the official story continuation. Stories complete at 100 sentences and are archived permanently, creating a competitive leaderboard of the best community creations.

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│            Devvit Web Frontend (React)              │
│  - Story display component                          │
│  - Sentence submission form                         │
│  - Leaderboard viewer                               │
│  - Archive browser                                  │
│  - Real-time update handling                        │
└──────────────┬──────────────────────────────────────┘
               │ HTTP API calls (/api/*)
┌──────────────┴──────────────────────────────────────┐
│         Devvit Real-Time Channel                    │
│  - Single global channel: "story-updates"           │
│  - Message types: story-update, new-round, complete │
│  - Broadcasts to all connected clients               │
└──────────────┬──────────────────────────────────────┘
               │ WebSocket connection
┌──────────────┴──────────────────────────────────────┐
│    Devvit Server Logic (Node.js + TypeScript)       │
│  - Express API endpoints                            │
│  - Scheduled jobs (hourly + daily)                 │
│  - Reddit API integration                           │
│  - Real-time message broadcasting                   │
└──────────────┬──────────────────────────────────────┘
               │ Redis operations
┌──────────────┴──────────────────────────────────────┐
│         Redis Key-Value Store                       │
│  - stories:current → active story state             │
│  - stories:archive → completed stories              │
│  - rounds:hourly → round tracking data              │
│  - users:submissions → user contribution tracking   │
│  - leaderboard:top → cached rankings                │
└──────────────┬──────────────────────────────────────┘
               │ API calls (100 QPM limit)
┌──────────────┴──────────────────────────────────────┐
│         Reddit API                                  │
│  - Comment fetching and posting                     │
│  - Vote score retrieval                             │
│  - User authentication                              │
│  - Post management                                  │
└─────────────────────────────────────────────────────┘
```

### Technology Stack Rationale

| Layer                 | Technology                     | Justification                                                                     |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| **Frontend**          | React + Devvit Web             | Hot reload development, component reusability, fast iteration cycles              |
| **State Management**  | React hooks + Real-time sync   | Simple state management with automatic synchronization                            |
| **Backend**           | Node.js + Express + TypeScript | Native Devvit support, familiar web patterns, type safety                         |
| **Scheduling**        | Devvit Scheduler               | Built-in cron job support, reliable execution at scale                            |
| **Data Persistence**  | Redis                          | Sub-millisecond lookups, perfect for hourly aggregations, built-in Devvit support |
| **Real-time Updates** | Devvit Real-time Channels      | Native platform integration, handles connection management                        |
| **Authentication**    | Reddit OAuth (via Devvit)      | Automatic user authentication, no custom auth needed                              |

## Components and Interfaces

### Frontend Components

#### App Component (`src/client/components/App.tsx`)

- **Purpose**: Main application shell with tab navigation
- **State Management**: Manages active tab (story/leaderboard/archive) and current story state
- **Real-time Integration**: Subscribes to story-updates channel for live updates
- **Props**: None (root component)
- **Key Methods**:
  - `loadCurrentStory()`: Fetches active story from API
  - `handleRealtimeUpdate()`: Processes incoming real-time messages
  - `switchTab()`: Manages tab navigation state

#### StoryDisplay Component (`src/client/components/StoryDisplay.tsx`)

- **Purpose**: Renders the current story with all sentences and metadata
- **Props**: `{ story: StoryObject }`
- **Features**:
  - Numbered sentence display with visual formatting
  - Story statistics (sentences, votes, contributors, round)
  - Next round countdown timer
  - Story completion banner when applicable
- **Styling**: Responsive layout with mobile-first design

#### SubmissionForm Component (`src/client/components/SubmissionForm.tsx`)

- **Purpose**: Handles sentence submission with validation
- **Props**: `{ storyId: string, roundNumber: number }`
- **Features**:
  - Character count validation (10-150 characters)
  - Real-time character counter with warnings
  - Form submission with loading states
  - Success/error message display
- **Validation**: Client-side validation with server-side verification

#### Leaderboard Component (`src/client/components/Leaderboard.tsx`)

- **Purpose**: Displays top 10 completed stories ranked by votes
- **State**: Manages leaderboard data and loading states
- **Features**:
  - Sortable table with rank, creator, sentences, votes
  - Click-to-expand story preview
  - Auto-refresh when new stories complete
- **Data Source**: `/api/leaderboard/top-10` endpoint

#### Archive Component (`src/client/components/Archive.tsx`)

- **Purpose**: Paginated browser for all completed stories
- **State**: Manages pagination, sorting, and story data
- **Features**:
  - 10 stories per page with prev/next navigation
  - Sort by date or popularity
  - Story preview with click-to-expand
  - Search functionality (future enhancement)
- **Data Source**: `/api/archive/stories` endpoint with pagination

### Backend API Endpoints

#### Story Management APIs

**GET `/api/story/current`**

- **Purpose**: Retrieve the active story with all sentences
- **Response**: `{ story: StoryObject, roundTimeRemaining: number }`
- **Caching**: Redis lookup with 1-second TTL
- **Error Handling**: Returns empty story if none exists

**POST `/api/submit-sentence`**

- **Purpose**: Submit a new sentence for the current round
- **Body**: `{ storyId: string, roundNumber: number, sentence: string }`
- **Process**:
  1. Validate sentence length (10-150 characters)
  2. Post as Reddit comment with format "[Round N] sentence"
  3. Store comment ID in Redis for round resolution
  4. Return success confirmation
- **Rate Limiting**: One submission per user per round

**GET `/api/leaderboard/top-10`**

- **Purpose**: Retrieve top 10 completed stories by votes
- **Response**: `{ stories: LeaderboardEntry[] }`
- **Caching**: Redis cache with 10-minute TTL
- **Sorting**: Total votes DESC, then creation date ASC

**GET `/api/archive/stories`**

- **Purpose**: Paginated access to all completed stories
- **Query Params**: `page: number, sort: 'date'|'votes', limit: number`
- **Response**: `{ stories: StoryObject[], totalPages: number, currentPage: number }`
- **Default**: 10 stories per page, sorted by completion date DESC

#### Scheduled Job Handlers

**Hourly Round Resolution Job**

- **Schedule**: Every hour at :00 UTC (`0 * * * *`)
- **Process**:
  1. Fetch all Reddit comments from past hour
  2. Filter comments matching current round format
  3. Find comment with highest upvote score
  4. Validate winning sentence (10-150 chars)
  5. Append to story sentences array
  6. Increment round number and update vote totals
  7. Check for story completion (100 sentences)
  8. Broadcast update via real-time channel
  9. Archive completed story and create new one if needed
- **Fallback**: Use "The silence grew..." if no submissions
- **Error Handling**: Log failures and retry once

**Daily Archival Job**

- **Schedule**: Every day at 00:00 UTC (`0 0 * * *`)
- **Process**:
  1. Check current story status
  2. Update leaderboard rankings
  3. Clean up old Redis temporary data
  4. Log daily statistics
  5. Ensure new story exists for next day
- **Maintenance**: Removes expired round data, optimizes Redis memory

## Data Models

### Core Data Structures

```typescript
interface Story {
  id: string; // Unique identifier (story_timestamp)
  created: number; // Unix timestamp of creation
  sentences: string[]; // Array of story sentences [0] to [99]
  roundNumber: number; // Current round (1-100)
  totalVotes: number; // Sum of all winning sentence upvotes
  status: 'active' | 'completed' | 'archived';
  contributors: string[]; // Unique Reddit usernames who contributed
  completedAt?: number; // Unix timestamp when story reached 100 sentences
}

interface Round {
  storyId: string; // Associated story ID
  roundNumber: number; // Round number (1-100)
  startTime: number; // Unix timestamp when round started
  endTime: number; // Unix timestamp when round ended
  submissions: Submission[]; // All sentences submitted this round
  winner?: {
    // Winning submission (highest votes)
    commentId: string;
    sentence: string;
    upvotes: number;
    userId: string;
  };
}

interface Submission {
  commentId: string; // Reddit comment ID
  sentence: string; // Submitted sentence text
  upvotes: number; // Current upvote count
  userId: string; // Reddit username of submitter
  timestamp: number; // Unix timestamp of submission
}

interface LeaderboardEntry {
  rank: number; // Position in leaderboard (1-10)
  storyId: string; // Story identifier
  sentenceCount: number; // Total sentences in story (should be 100)
  totalVotes: number; // Sum of all sentence upvotes
  creator: string; // Username who submitted first sentence
  completedAt: number; // When story was completed
  preview: string; // First 100 characters of story
}

interface UserContribution {
  userId: string; // Reddit username
  submissions: {
    // All sentences submitted by user
    storyId: string;
    roundNumber: number;
    sentence: string;
    upvotes: number;
    wasWinner: boolean;
  }[];
  totalSubmissions: number; // Count of all submissions
  totalWins: number; // Count of winning submissions
  totalUpvotes: number; // Sum of upvotes across all submissions
}
```

### Redis Schema Design

```typescript
// Redis Key Patterns and Data Structures

// Current active story
"stories:current" → JSON.stringify(Story)

// Archived completed stories
"stories:archive:{storyId}" → JSON.stringify(Story)

// Round tracking data
"rounds:current" → JSON.stringify(Round)
"rounds:history:{storyId}:{roundNumber}" → JSON.stringify(Round)

// User contribution tracking
"users:submissions:{userId}" → JSON.stringify(UserContribution)

// Leaderboard cache (updated when stories complete)
"leaderboard:top" → JSON.stringify(LeaderboardEntry[])

// Temporary round data (cleared after resolution)
"temp:round:{roundNumber}:submissions" → JSON.stringify(Submission[])

// System statistics
"stats:daily:{date}" → JSON.stringify({
  storiesCompleted: number,
  totalSubmissions: number,
  uniqueContributors: number,
  totalUpvotes: number
})
```

### Reddit Integration Schema

```typescript
// Reddit Comment Format for Submissions
interface RedditComment {
  body: string; // "[Round N] User's sentence text"
  id: string; // Reddit comment ID (t1_abc123)
  score: number; // Current upvote score
  created_utc: number; // Unix timestamp
  author: string; // Reddit username
  parent_id: string; // Parent post ID
}

// Reddit API Rate Limiting
interface RateLimitStrategy {
  maxRequestsPerMinute: 100; // Reddit API limit
  ourUsagePerHour: 3; // Hourly job + occasional fetches
  bufferMultiplier: 30; // 3000% safety margin
  retryStrategy: 'exponential'; // Backoff on rate limit hits
}
```

## Error Handling

### Client-Side Error Handling

**Network Failures**

- **Strategy**: Retry with exponential backoff (1s, 2s, 4s, 8s)
- **User Feedback**: Show "Connection lost, retrying..." message
- **Fallback**: Allow offline viewing of cached story content
- **Recovery**: Auto-reconnect when network restored

**Form Validation Errors**

- **Character Count**: Real-time validation with visual feedback
- **Submission Failures**: Clear error messages with retry options
- **Rate Limiting**: "Please wait before submitting again" with countdown
- **Invalid Input**: Specific guidance on what needs to be fixed

**Real-time Connection Issues**

- **Detection**: Monitor WebSocket connection status
- **Fallback**: Graceful degradation to manual refresh
- **Recovery**: Automatic reconnection with exponential backoff
- **User Notification**: Subtle indicator of connection status

### Server-Side Error Handling

**Reddit API Failures**

- **Rate Limiting**: Implement exponential backoff with jitter
- **Authentication**: Handle token refresh automatically
- **Service Outages**: Log errors and continue with cached data
- **Malformed Responses**: Validate API responses before processing

**Redis Connection Issues**

- **Connection Loss**: Implement automatic reconnection
- **Data Corruption**: Validate data structure before parsing
- **Memory Limits**: Implement data cleanup and archival
- **Performance**: Monitor query times and optimize slow operations

**Scheduled Job Failures**

- **Missed Executions**: Detect and handle missed hourly rounds
- **Partial Failures**: Implement transaction-like operations
- **Data Consistency**: Verify story state after each operation
- **Recovery**: Implement manual recovery procedures for critical failures

### Error Monitoring and Logging

```typescript
interface ErrorLogging {
  levels: ['error', 'warn', 'info', 'debug'];
  destinations: ['console', 'redis', 'devvit-logs'];
  errorTypes: {
    'reddit-api-failure': { severity: 'error'; retry: true };
    'redis-connection-lost': { severity: 'error'; retry: true };
    'invalid-sentence-submission': { severity: 'warn'; retry: false };
    'round-resolution-failure': { severity: 'error'; retry: true };
    'real-time-broadcast-failure': { severity: 'warn'; retry: true };
  };
}
```

## Testing Strategy

### Unit Testing Approach

**Frontend Component Tests**

- **Framework**: React Testing Library + Jest
- **Coverage**: All components with props/state variations
- **Focus Areas**:
  - Form validation logic
  - Real-time update handling
  - Error state rendering
  - Mobile responsive behavior

**Backend API Tests**

- **Framework**: Jest + Supertest
- **Coverage**: All API endpoints with success/failure cases
- **Focus Areas**:
  - Input validation
  - Redis operations
  - Reddit API integration
  - Scheduled job logic

**Data Model Tests**

- **Framework**: Jest
- **Coverage**: All data transformation and validation functions
- **Focus Areas**:
  - Story state transitions
  - Round resolution logic
  - Leaderboard ranking calculations
  - User contribution tracking

### Integration Testing Strategy

**End-to-End Game Flow**

- **Scenario**: Complete story creation cycle (1-100 sentences)
- **Tools**: Playwright for browser automation
- **Validation Points**:
  - Story initialization
  - Sentence submission and voting
  - Hourly round resolution
  - Story completion and archival
  - Leaderboard updates

**Real-time Synchronization**

- **Scenario**: Multiple users submitting simultaneously
- **Validation**: All users see consistent story state
- **Edge Cases**: Network disconnections, reconnections, message ordering

**Reddit Integration**

- **Scenario**: Comment posting and vote retrieval
- **Mocking**: Reddit API responses for consistent testing
- **Validation**: Proper comment formatting, vote counting accuracy

### Performance Testing

**Load Testing Scenarios**

- **Concurrent Users**: 50+ simultaneous players
- **Submission Bursts**: Multiple submissions at round boundaries
- **Database Load**: Redis performance under high query volume
- **Memory Usage**: Long-running process memory stability

**Performance Benchmarks**

- **Page Load**: < 2 seconds initial load
- **API Response**: < 1 second for all endpoints
- **Real-time Updates**: < 500ms message delivery
- **Database Queries**: < 10ms Redis operations

### Testing Data Management

```typescript
interface TestDataStrategy {
  fixtures: {
    sampleStories: Story[]; // Various story states for testing
    mockComments: RedditComment[]; // Simulated Reddit API responses
    userSubmissions: Submission[]; // Test submission data
  };
  cleanup: {
    redisKeys: string[]; // Keys to clean between tests
    testUsers: string[]; // Test user accounts to reset
  };
  mocking: {
    redditAPI: 'mock-server'; // Controlled Reddit API responses
    realTime: 'in-memory'; // In-memory real-time channel simulation
    scheduler: 'manual-trigger'; // Manual job execution for testing
  };
}
```

This comprehensive design provides a solid foundation for implementing the Chain Story collaborative storytelling game, with clear architecture, well-defined components, robust error handling, and thorough testing strategies.
