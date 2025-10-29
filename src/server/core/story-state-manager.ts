/**
 * Redis-based story state management for The Haunted Thread
 * Handles storing and retrieving story chapters, progression state, and history tracking
 */

import { redis } from '@devvit/web/server';
import { 
  StoryChapter, 
  StoryContext, 
  StoryProgression,
  ValidationResult 
} from '../../shared/types/story.js';

export class StoryStateManager {
  private static readonly STORY_PREFIX = 'haunted_thread:story';
  private static readonly CHAPTER_PREFIX = 'haunted_thread:chapter';
  private static readonly CONTEXT_PREFIX = 'haunted_thread:context';
  private static readonly HISTORY_PREFIX = 'haunted_thread:history';
  private static readonly PROGRESSION_PREFIX = 'haunted_thread:progression';

  /**
   * Stores a story chapter in Redis
   */
  static async storeChapter(postId: string, chapter: StoryChapter): Promise<void> {
    const key = `${this.CHAPTER_PREFIX}:${postId}:${chapter.id}`;
    const chapterSetKey = `${this.STORY_PREFIX}:${postId}:chapters`;
    
    const chapterData = {
      ...chapter,
      metadata: {
        ...chapter.metadata,
        createdAt: chapter.metadata.createdAt.toISOString(),
        votingStartTime: chapter.metadata.votingStartTime.toISOString(),
        votingEndTime: chapter.metadata.votingEndTime?.toISOString()
      }
    };

    await redis.set(key, JSON.stringify(chapterData));
    await redis.expire(key, 86400); // 24 hours TTL
    
    // Track chapter ID in a hash for easy retrieval
    await redis.hSet(chapterSetKey, { [chapter.id]: '1' });
    await redis.expire(chapterSetKey, 86400); // 24 hours TTL
  }

  /**
   * Retrieves a story chapter from Redis
   */
  static async getChapter(postId: string, chapterId: string): Promise<StoryChapter | null> {
    const key = `${this.CHAPTER_PREFIX}:${postId}:${chapterId}`;
    const data = await redis.get(key);
    
    if (!data) return null;

    try {
      const chapterData = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return {
        ...chapterData,
        metadata: {
          ...chapterData.metadata,
          createdAt: new Date(chapterData.metadata.createdAt),
          votingStartTime: new Date(chapterData.metadata.votingStartTime),
          votingEndTime: chapterData.metadata.votingEndTime 
            ? new Date(chapterData.metadata.votingEndTime) 
            : undefined
        }
      };
    } catch (error) {
      console.error('Error parsing chapter data:', error);
      return null;
    }
  }

  /**
   * Gets the current active chapter for a story
   */
  static async getCurrentChapter(postId: string): Promise<StoryChapter | null> {
    const currentChapterKey = `${this.STORY_PREFIX}:${postId}:current_chapter`;
    const currentChapterId = await redis.get(currentChapterKey);
    
    if (!currentChapterId) return null;
    
    return this.getChapter(postId, currentChapterId);
  }

  /**
   * Sets the current active chapter for a story
   */
  static async setCurrentChapter(postId: string, chapterId: string): Promise<void> {
    const currentChapterKey = `${this.STORY_PREFIX}:${postId}:current_chapter`;
    await redis.set(currentChapterKey, chapterId);
    await redis.expire(currentChapterKey, 86400); // 24 hours TTL
  }

  /**
   * Stores story context (user progression state)
   */
  static async storeStoryContext(postId: string, context: StoryContext): Promise<void> {
    const key = `${this.CONTEXT_PREFIX}:${postId}`;
    
    const contextData = {
      ...context,
      storyStartTime: context.storyStartTime.toISOString()
    };

    await redis.set(key, JSON.stringify(contextData));
    await redis.expire(key, 86400); // 24 hours TTL
  }

  /**
   * Retrieves story context
   */
  static async getStoryContext(postId: string): Promise<StoryContext | null> {
    const key = `${this.CONTEXT_PREFIX}:${postId}`;
    const data = await redis.get(key);
    
    if (!data) return null;

    try {
      const contextData = JSON.parse(data);
      
      return {
        ...contextData,
        storyStartTime: new Date(contextData.storyStartTime)
      };
    } catch (error) {
      console.error('Error parsing story context:', error);
      return null;
    }
  }

  /**
   * Updates story context with new choice
   */
  static async updateStoryContext(
    postId: string, 
    newChapterId: string, 
    choiceId: string
  ): Promise<StoryContext | null> {
    const context = await this.getStoryContext(postId);
    
    if (!context) {
      console.error('Story context not found for post:', postId);
      return null;
    }

    const updatedContext: StoryContext = {
      ...context,
      currentChapter: newChapterId,
      previousChoices: [...context.previousChoices, choiceId],
      pathTaken: [...context.pathTaken, choiceId]
    };

    await this.storeStoryContext(postId, updatedContext);
    return updatedContext;
  }

  /**
   * Adds a chapter to story history
   */
  static async addToHistory(
    postId: string, 
    chapterId: string, 
    winningChoice: string
  ): Promise<void> {
    const historyKey = `${this.HISTORY_PREFIX}:${postId}`;
    
    const historyEntry = {
      chapterId,
      winningChoice,
      timestamp: new Date().toISOString()
    };

    // Use hash to store history entries with timestamp as field
    const timestamp = Date.now().toString();
    await redis.hSet(historyKey, { [timestamp]: JSON.stringify(historyEntry) });
    
    // Set TTL on the history key
    await redis.expire(historyKey, 86400); // 24 hours
  }

  /**
   * Gets story history
   */
  static async getStoryHistory(postId: string): Promise<Array<{
    chapterId: string;
    winningChoice: string;
    timestamp: Date;
  }>> {
    const historyKey = `${this.HISTORY_PREFIX}:${postId}`;
    const historyData = await redis.hGetAll(historyKey);
    
    const entries: Array<{
      chapterId: string;
      winningChoice: string;
      timestamp: Date;
    }> = [];
    
    for (const [, entryJson] of Object.entries(historyData)) {
      try {
        const parsed = JSON.parse(entryJson);
        entries.push({
          ...parsed,
          timestamp: new Date(parsed.timestamp)
        });
      } catch (error) {
        console.error('Error parsing history entry:', error);
      }
    }
    
    // Sort by timestamp (most recent first)
    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Stores story progression data
   */
  static async storeProgression(postId: string, progression: StoryProgression): Promise<void> {
    const key = `${this.PROGRESSION_PREFIX}:${postId}`;
    await redis.set(key, JSON.stringify(progression));
    await redis.expire(key, 86400); // 24 hours TTL
  }

  /**
   * Gets story progression data
   */
  static async getProgression(postId: string): Promise<StoryProgression | null> {
    const key = `${this.PROGRESSION_PREFIX}:${postId}`;
    const data = await redis.get(key);
    
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing progression data:', error);
      return null;
    }
  }

  /**
   * Initializes a new story with first chapter
   */
  static async initializeStory(postId: string, firstChapter: StoryChapter): Promise<StoryContext> {
    // Store the first chapter
    await this.storeChapter(postId, firstChapter);
    
    // Set as current chapter
    await this.setCurrentChapter(postId, firstChapter.id);
    
    // Create initial story context
    const initialContext: StoryContext = {
      currentChapter: firstChapter.id,
      previousChoices: [],
      pathTaken: [],
      userVotes: {},
      storyStartTime: new Date()
    };
    
    // Store initial context
    await this.storeStoryContext(postId, initialContext);
    
    // Initialize progression
    const initialProgression: StoryProgression = {
      totalChapters: 1,
      currentPosition: 1,
      completedPaths: [],
      availablePaths: firstChapter.choices.map(choice => choice.id),
      progressPercentage: 0
    };
    
    await this.storeProgression(postId, initialProgression);
    
    return initialContext;
  }

  /**
   * Resets story state to beginning while preserving completed paths
   */
  static async resetStory(postId: string, preserveHistory: boolean = true): Promise<void> {
    // Store completed paths before reset if preserving history
    let completedPaths: string[] = [];
    if (preserveHistory) {
      const progression = await this.getProgression(postId);
      completedPaths = progression?.completedPaths || [];
    }

    // Delete specific keys we know about
    const keysToDelete = [
      `${this.CONTEXT_PREFIX}:${postId}`,
      `${this.PROGRESSION_PREFIX}:${postId}`,
      `${this.STORY_PREFIX}:${postId}:current_chapter`
    ];

    // Only delete history if not preserving it
    if (!preserveHistory) {
      keysToDelete.push(`${this.HISTORY_PREFIX}:${postId}`);
    }

    // Delete known keys
    for (const key of keysToDelete) {
      const exists = await redis.exists(key);
      if (exists) {
        await redis.del(key);
      }
    }

    // For chapter keys, we'll need to track them separately or use a different approach
    // Since we can't use pattern matching, we'll store chapter IDs in a hash
    const chapterSetKey = `${this.STORY_PREFIX}:${postId}:chapters`;
    const chapterData = await redis.hGetAll(chapterSetKey);
    const chapterIds = Object.keys(chapterData);
    
    for (const chapterId of chapterIds) {
      const chapterKey = `${this.CHAPTER_PREFIX}:${postId}:${chapterId}`;
      await redis.del(chapterKey);
    }
    
    // Delete the chapter hash itself
    await redis.del(chapterSetKey);

    // If preserving history, restore completed paths
    if (preserveHistory && completedPaths.length > 0) {
      await this.storeCompletedPaths(postId, completedPaths);
    }
  }

  /**
   * Stores completed story paths for replay tracking
   */
  static async storeCompletedPaths(postId: string, paths: string[]): Promise<void> {
    const key = `${this.STORY_PREFIX}:${postId}:completed_paths`;
    await redis.set(key, JSON.stringify(paths));
    await redis.expire(key, 86400 * 7); // 7 days TTL for completed paths
  }

  /**
   * Gets completed story paths
   */
  static async getCompletedPaths(postId: string): Promise<string[]> {
    const key = `${this.STORY_PREFIX}:${postId}:completed_paths`;
    const data = await redis.get(key);
    
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing completed paths:', error);
      return [];
    }
  }

  /**
   * Adds a completed path to the tracking
   */
  static async addCompletedPath(postId: string, pathId: string): Promise<void> {
    const completedPaths = await this.getCompletedPaths(postId);
    if (!completedPaths.includes(pathId)) {
      completedPaths.push(pathId);
      await this.storeCompletedPaths(postId, completedPaths);
    }
  }

  /**
   * Gets all chapters for a story (for history/debugging)
   */
  static async getAllChapters(postId: string): Promise<StoryChapter[]> {
    const chapterSetKey = `${this.STORY_PREFIX}:${postId}:chapters`;
    const chapterData = await redis.hGetAll(chapterSetKey);
    const chapterIds = Object.keys(chapterData);
    
    const chapters: StoryChapter[] = [];
    
    for (const chapterId of chapterIds) {
      const chapterKey = `${this.CHAPTER_PREFIX}:${postId}:${chapterId}`;
      const data = await redis.get(chapterKey);
      if (data) {
        try {
          const chapterData = JSON.parse(data);
          chapters.push({
            ...chapterData,
            metadata: {
              ...chapterData.metadata,
              createdAt: new Date(chapterData.metadata.createdAt),
              votingStartTime: new Date(chapterData.metadata.votingStartTime),
              votingEndTime: chapterData.metadata.votingEndTime 
                ? new Date(chapterData.metadata.votingEndTime) 
                : undefined
            }
          });
        } catch (error) {
          console.error('Error parsing chapter data:', error);
        }
      }
    }
    
    return chapters;
  }

  /**
   * Validates story state consistency
   */
  static async validateStoryState(postId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    
    try {
      // Check if current chapter exists
      const currentChapter = await this.getCurrentChapter(postId);
      if (!currentChapter) {
        errors.push('No current chapter found');
      }
      
      // Check if story context exists
      const context = await this.getStoryContext(postId);
      if (!context) {
        errors.push('No story context found');
      }
      
      // Validate context consistency
      if (currentChapter && context) {
        if (currentChapter.id !== context.currentChapter) {
          errors.push('Current chapter mismatch between chapter and context');
        }
      }
      
      // Check progression data
      const progression = await this.getProgression(postId);
      if (!progression) {
        errors.push('No progression data found');
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets alternative story branches from current position
   */
  static async getAlternativeBranches(postId: string): Promise<Array<{
    branchId: string;
    title: string;
    description: string;
    isCompleted: boolean;
    choices: Array<{
      id: string;
      text: string;
      description?: string;
    }>;
  }>> {
    const context = await this.getStoryContext(postId);
    const completedPaths = await this.getCompletedPaths(postId);
    
    if (!context) return [];

    // Import StoryContentManager dynamically to avoid circular imports
    const { StoryContentManager } = await import('./story-content-manager.js');
    
    const alternatives: Array<{
      branchId: string;
      title: string;
      description: string;
      isCompleted: boolean;
      choices: Array<{
        id: string;
        text: string;
        description?: string;
      }>;
    }> = [];

    // Get all available branches
    const allBranches = StoryContentManager.getAllBranches();
    
    for (const branch of allBranches) {
      const isCompleted = completedPaths.some(path => path.includes(branch.id));
      
      alternatives.push({
        branchId: branch.id,
        title: branch.title,
        description: `A ${branch.visualTheme} path through the haunted thread`,
        isCompleted,
        choices: branch.choices.map(choice => ({
          id: choice.id,
          text: choice.text,
          ...(choice.description && { description: choice.description })
        }))
      });
    }

    return alternatives;
  }

  /**
   * Gets story replay data for a specific path
   */
  static async getStoryReplay(postId: string, pathId: string): Promise<{
    pathId: string;
    chapters: StoryChapter[];
    decisions: string[];
    ending?: any;
  } | null> {
    const history = await this.getStoryHistory(postId);
    const completedPaths = await this.getCompletedPaths(postId);
    
    if (!completedPaths.includes(pathId)) {
      return null; // Path not completed
    }

    // Filter history for this specific path
    const pathHistory = history.filter(entry => 
      entry.chapterId.includes(pathId) || entry.winningChoice.includes(pathId)
    );

    const chapters: StoryChapter[] = [];
    const decisions: string[] = [];

    for (const entry of pathHistory) {
      const chapter = await this.getChapter(postId, entry.chapterId);
      if (chapter) {
        chapters.push(chapter);
        decisions.push(entry.winningChoice);
      }
    }

    return {
      pathId,
      chapters,
      decisions,
      ending: undefined // Could be populated with ending data
    };
  }

  /**
   * Gets story statistics
   */
  static async getStoryStats(postId: string): Promise<{
    totalChapters: number;
    historyLength: number;
    storyAge: number;
    currentChapter: string | null;
    completedPaths: number;
    availableBranches: number;
  }> {
    const [chapters, history, context, completedPaths, alternatives] = await Promise.all([
      this.getAllChapters(postId),
      this.getStoryHistory(postId),
      this.getStoryContext(postId),
      this.getCompletedPaths(postId),
      this.getAlternativeBranches(postId)
    ]);

    const storyAge = context 
      ? Date.now() - context.storyStartTime.getTime() 
      : 0;

    return {
      totalChapters: chapters.length,
      historyLength: history.length,
      storyAge,
      currentChapter: context?.currentChapter || null,
      completedPaths: completedPaths.length,
      availableBranches: alternatives.length
    };
  }
}
