# Design Document

## Overview

"The Haunted Thread" is a community-driven narrative horror experience built as a Devvit Web application for Reddit. The application creates an immersive, interactive story where users collectively make decisions that shape a branching horror narrative. The system leverages Reddit's community dynamics, Devvit's realtime capabilities, and Redis for persistent state management to deliver a synchronized, atmospheric gaming experience.

The application follows a chapter-based structure where each story segment presents multiple action choices. Community voting determines the narrative direction, with real-time updates ensuring all participants see the collective decision-making process unfold. Dynamic visual generation and horror-themed styling create an engaging atmospheric experience that capitalizes on the Halloween seasonal theme.

## Architecture

### System Architecture

The application follows Devvit Web's standard three-tier architecture:

**Client Layer (`src/client/`)**

- React-based horror-themed UI with atmospheric styling
- Real-time voting interface with live vote count updates
- Dynamic story content rendering with visual transitions
- Responsive design optimized for both mobile and desktop Reddit users

**Server Layer (`src/server/`)**

- Express.js API endpoints for story management and voting operations
- Redis integration for persistent story state and vote tracking
- Realtime message broadcasting for synchronized community experience
- Story generation logic with branching narrative paths

**Shared Layer (`src/shared/`)**

- TypeScript interfaces for story data structures
- API contract definitions for client-server communication
- Common types for voting, story progression, and user interactions

### Data Flow Architecture

```
User Vote → Client UI → API Endpoint → Redis Transaction → Realtime Broadcast → All Clients Update
```

### Realtime Architecture

The application uses Devvit's realtime capabilities to ensure synchronized community experience:

- **Channel**: `haunted-thread-{postId}` for post-specific story updates
- **Message Types**: Vote updates, chapter transitions, story progression
- **Synchronization**: All active users see vote counts and story changes in real-time

## Components and Interfaces

### Core Components

#### StoryEngine

Manages narrative progression and branching logic:

```typescript
interface StoryEngine {
  getCurrentChapter(): Promise<StoryChapter>;
  processVoteResult(winningChoice: string): Promise<StoryChapter>;
  generateNextChapter(previousChoice: string, context: StoryContext): StoryChapter;
  checkForEnding(currentPath: string[]): boolean;
}
```

#### VotingSystem

Handles community decision-making:

```typescript
interface VotingSystem {
  castVote(userId: string, chapterId: string, choice: string): Promise<VoteResult>;
  getVoteCounts(chapterId: string): Promise<VoteCount[]>;
  determineWinner(chapterId: string): Promise<string>;
  hasUserVoted(userId: string, chapterId: string): Promise<boolean>;
}
```

#### AtmosphereRenderer

Generates dynamic horror-themed visuals:

```typescript
interface AtmosphereRenderer {
  generateSceneVisuals(chapter: StoryChapter): VisualElements;
  createTransitionEffect(fromChapter: string, toChapter: string): TransitionEffect;
  applyHorrorStyling(content: string): StyledContent;
}
```

### API Endpoints

#### Story Management

- `GET /api/story/current` - Retrieve current chapter and voting status
- `GET /api/story/history` - Get story progression history
- `POST /api/story/reset` - Reset story to beginning (admin only)

#### Voting Operations

- `POST /api/vote` - Cast vote for story choice
- `GET /api/vote/counts/:chapterId` - Get current vote tallies
- `GET /api/vote/status/:userId/:chapterId` - Check if user has voted

#### Administrative

- `POST /api/admin/advance` - Manually advance to next chapter
- `GET /api/admin/stats` - Get story engagement statistics

## Data Models

### Story Structure

```typescript
interface StoryChapter {
  id: string;
  title: string;
  content: string;
  choices: StoryChoice[];
  visualElements: VisualElements;
  metadata: ChapterMetadata;
}

interface StoryChoice {
  id: string;
  text: string;
  description?: string;
  consequences?: string;
  voteCount: number;
}

interface StoryPath {
  chapters: string[];
  decisions: string[];
  ending?: StoryEnding;
}
```

### Voting Data

```typescript
interface Vote {
  userId: string;
  chapterId: string;
  choiceId: string;
  timestamp: Date;
}

interface VotingSession {
  chapterId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'expired';
  totalVotes: number;
}
```

### Visual Elements

```typescript
interface VisualElements {
  backgroundImage?: string;
  atmosphericEffects: string[];
  colorScheme: HorrorColorScheme;
  typography: HorrorTypography;
  animations: AnimationEffect[];
}
```

## Error Handling

### Client-Side Error Handling

- **Network Failures**: Graceful degradation with offline indicators
- **Invalid Votes**: Clear error messages for duplicate or invalid voting attempts
- **Connection Loss**: Automatic reconnection with state synchronization

### Server-Side Error Handling

- **Redis Failures**: Fallback to in-memory state with warning notifications
- **Concurrent Voting**: Transaction-based vote processing to prevent race conditions
- **Story Generation Errors**: Fallback to predefined story branches

### Data Consistency

- **Vote Integrity**: Redis transactions ensure atomic vote counting
- **Story State**: Optimistic updates with server-side validation
- **User Session**: Persistent vote tracking across browser sessions

## Testing Strategy

### Unit Testing

- Story generation logic validation
- Vote counting accuracy verification
- Visual element generation testing
- API endpoint response validation

### Integration Testing

- Client-server communication flow
- Redis data persistence verification
- Realtime message broadcasting
- Story progression end-to-end testing

### User Experience Testing

- Mobile responsiveness validation
- Horror atmosphere effectiveness
- Community voting flow usability
- Performance under concurrent user load

### Content Testing

- Story branch completeness verification
- Narrative coherence across paths
- Appropriate horror content rating
- Community guidelines compliance

## Performance Considerations

### Scalability

- Redis-based state management supports concurrent users
- Realtime channels scoped per post to prevent cross-contamination
- Efficient vote aggregation using Redis sorted sets

### Optimization

- Lazy loading of story content and visual assets
- Compressed image assets for atmospheric elements
- Minimal DOM updates for smooth real-time experience
- Caching of frequently accessed story data

### Mobile Performance

- Touch-optimized voting interface
- Reduced visual effects on mobile devices
- Efficient battery usage for long story sessions
- Progressive loading of story content
