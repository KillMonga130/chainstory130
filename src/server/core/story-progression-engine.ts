/**
 * Story progression engine for The Haunted Thread
 * Handles chapter transitions, winning vote determination, and narrative continuity
 */

import {
  StoryChapter,
  StoryContext,
  StoryEnding,
  VisualElements,
  StoryUtils,
} from '../../shared/types/story.js';
// import { StoryBranchingEngine } from '../../shared/types/story-engine.js';
import { VotingManager } from './voting-manager.js';
import { StoryStateManager } from './story-state-manager.js';
import { StoryContentManager } from './story-content-manager.js';

export class StoryProgressionEngine {
  // Note: These will be used in future enhancements
  // private readonly branchingEngine: StoryBranchingEngine;
  // private readonly predefinedStoryContent: Map<string, StoryChapter>;

  constructor() {
    // Note: These will be initialized in future enhancements
    // this.branchingEngine = new StoryBranchingEngine();
    // this.predefinedStoryContent = new Map();
    // this.initializePredefinedContent();

    // Initialize the story content manager
    StoryContentManager.initialize();
  }

  /**
   * Gets the initial story chapter
   */
  getInitialChapter(): StoryChapter {
    const openingBranch = StoryContentManager.getBranch('opening');
    if (!openingBranch) {
      throw new Error('Opening story branch not found');
    }

    return StoryContentManager.branchToChapter(openingBranch, 1);
  }

  /**
   * Determines the winning vote choice for a chapter
   */
  async determineWinningChoice(
    postId: string,
    chapterId: string
  ): Promise<{
    winningChoice: string | null;
    voteStats: any;
    isTie: boolean;
  }> {
    try {
      // Get vote counts for all choices
      const voteCounts = await VotingManager.getVoteCounts(postId, chapterId);

      if (voteCounts.length === 0) {
        return {
          winningChoice: null,
          voteStats: null,
          isTie: false,
        };
      }

      // Sort by vote count (highest first)
      const sortedCounts = voteCounts.sort((a, b) => b.count - a.count);

      // Check for tie between top choices
      const topChoice = sortedCounts[0];
      if (!topChoice) {
        return {
          winningChoice: null,
          voteStats: null,
          isTie: false,
        };
      }

      const secondChoice = sortedCounts[1];
      const isTie = secondChoice && topChoice.count === secondChoice.count && topChoice.count > 0;

      // Get voting statistics
      const voteStats = await VotingManager.getVotingStats(postId, chapterId);

      // If there's a tie, use tiebreaker logic
      let winningChoice = topChoice.choiceId;
      if (isTie) {
        winningChoice = this.resolveTie(sortedCounts.filter((c) => c.count === topChoice.count));
      }

      return {
        winningChoice: topChoice.count > 0 ? winningChoice : null,
        voteStats,
        isTie: isTie || false,
      };
    } catch (error) {
      console.error('Error determining winning choice:', error);
      return {
        winningChoice: null,
        voteStats: null,
        isTie: false,
      };
    }
  }

  /**
   * Advances the story based on community decision
   */
  async advanceStory(
    postId: string,
    currentChapterId: string,
    winningChoice?: string
  ): Promise<{
    success: boolean;
    newChapter?: StoryChapter;
    hasEnded?: boolean;
    ending?: StoryEnding;
    error?: string;
  }> {
    try {
      // Get current story context
      const context = await StoryStateManager.getStoryContext(postId);
      if (!context) {
        return {
          success: false,
          error: 'Story context not found',
        };
      }

      // Determine winning choice if not provided
      let finalWinningChoice = winningChoice;
      if (!finalWinningChoice) {
        const voteResult = await this.determineWinningChoice(postId, currentChapterId);
        finalWinningChoice = voteResult.winningChoice || undefined;
      }

      if (!finalWinningChoice) {
        return {
          success: false,
          error: 'No winning choice determined',
        };
      }

      // Check if this choice leads to an ending using the new content system
      const currentBranchId = this.getCurrentBranchId(context);
      const ending = StoryContentManager.getEndingForChoice(currentBranchId, finalWinningChoice);
      if (ending) {
        // Story has ended
        await this.handleStoryEnding(postId, context, finalWinningChoice, ending);
        return {
          success: true,
          hasEnded: true,
          ending,
        };
      }

      // Generate next chapter
      const nextChapter = await this.generateNextChapter(
        currentChapterId,
        finalWinningChoice,
        context
      );

      if (!nextChapter) {
        return {
          success: false,
          error: 'Failed to generate next chapter',
        };
      }

      // Update story state
      await this.updateStoryState(postId, nextChapter, finalWinningChoice, context);

      return {
        success: true,
        newChapter: nextChapter,
        hasEnded: false,
      };
    } catch (error) {
      console.error('Error advancing story:', error);
      return {
        success: false,
        error: `Failed to advance story: ${error}`,
      };
    }
  }

  /**
   * Generates the next chapter with contextual narrative continuity
   */
  async generateNextChapter(
    currentChapterId: string,
    winningChoice: string,
    context: StoryContext
  ): Promise<StoryChapter | null> {
    try {
      // Get current branch and determine next branch
      const currentBranchId = this.getCurrentBranchId(context);
      const nextBranchId = StoryContentManager.getNextBranch(currentBranchId, winningChoice);

      if (nextBranchId) {
        // Use predefined branching content
        const nextBranch = StoryContentManager.getBranch(nextBranchId);
        if (nextBranch) {
          const chapterNumber = context.pathTaken.length + 1;
          return StoryContentManager.branchToChapter(nextBranch, chapterNumber);
        }
      }

      // Fallback to dynamic generation if no predefined branch exists
      const nextChapterId = this.generateNextChapterId(currentChapterId, winningChoice);
      return this.generateDynamicChapter(nextChapterId, currentChapterId, winningChoice, context);
    } catch (error) {
      console.error('Error generating next chapter:', error);
      return null;
    }
  }

  /**
   * Handles story ending logic
   */
  private async handleStoryEnding(
    postId: string,
    context: StoryContext,
    finalChoice: string,
    ending: StoryEnding
  ): Promise<void> {
    try {
      // Update context with final choice
      const finalContext = {
        ...context,
        previousChoices: [...context.previousChoices, finalChoice],
        pathTaken: [...context.pathTaken, finalChoice],
      };

      // Store final context
      await StoryStateManager.storeStoryContext(postId, finalContext);

      // Add to history
      await StoryStateManager.addToHistory(postId, context.currentChapter, finalChoice);

      // Track completed path
      const pathId = this.generatePathId(finalContext.pathTaken);
      await StoryStateManager.addCompletedPath(postId, pathId);

      // Update progression to show completion
      const progression = await StoryStateManager.getProgression(postId);
      if (progression) {
        const completedProgression = {
          ...progression,
          progressPercentage: 100,
          completedPaths: [...progression.completedPaths, ending.id],
        };
        await StoryStateManager.storeProgression(postId, completedProgression);
      }
    } catch (error) {
      console.error('Error handling story ending:', error);
    }
  }

  /**
   * Generates a unique path ID based on choices taken
   */
  private generatePathId(pathTaken: string[]): string {
    return `path_${pathTaken.join('_')}`;
  }

  /**
   * Updates story state after chapter transition
   */
  private async updateStoryState(
    postId: string,
    newChapter: StoryChapter,
    winningChoice: string,
    oldContext: StoryContext
  ): Promise<void> {
    try {
      // Store new chapter
      await StoryStateManager.storeChapter(postId, newChapter);

      // Set as current chapter
      await StoryStateManager.setCurrentChapter(postId, newChapter.id);

      // Update context
      const updatedContext = await StoryStateManager.updateStoryContext(
        postId,
        newChapter.id,
        winningChoice
      );

      // Add to history
      await StoryStateManager.addToHistory(postId, oldContext.currentChapter, winningChoice);

      // Update progression
      const progression = await StoryStateManager.getProgression(postId);
      if (progression && updatedContext) {
        const newProgression = {
          ...progression,
          currentPosition: updatedContext.pathTaken.length,
          totalChapters: progression.totalChapters + 1,
          availablePaths: newChapter.choices.map((choice) => choice.id),
          progressPercentage: StoryUtils.calculateProgress(
            updatedContext.pathTaken.length,
            progression.totalChapters + 1
          ),
        };
        await StoryStateManager.storeProgression(postId, newProgression);
      }

      // Create voting session for new chapter
      await VotingManager.createVotingSession(
        postId,
        newChapter.id,
        newChapter.choices.map((choice) => ({
          choiceId: choice.id,
          text: choice.text,
        })),
        60 // 60 minutes voting duration
      );
    } catch (error) {
      console.error('Error updating story state:', error);
    }
  }

  /**
   * Resolves tie votes using tiebreaker logic
   */
  private resolveTie(tiedChoices: Array<{ choiceId: string; count: number }>): string {
    // Simple tiebreaker: random selection
    // Could be enhanced with more sophisticated logic
    if (tiedChoices.length === 0) return 'default_choice';
    const randomIndex = Math.floor(Math.random() * tiedChoices.length);
    const selectedChoice = tiedChoices[randomIndex];
    return selectedChoice?.choiceId || 'default_choice';
  }

  /**
   * Generates next chapter ID based on current chapter and choice
   */
  private generateNextChapterId(currentChapterId: string, choice: string): string {
    return `${currentChapterId}_${choice}_next`;
  }

  /**
   * Generates dynamic chapter content
   */
  private generateDynamicChapter(
    chapterId: string,
    _previousChapterId: string,
    winningChoice: string,
    context: StoryContext
  ): StoryChapter {
    const chapterNumber = context.pathTaken.length + 1;

    // Generate content based on story progression
    const content = this.generateChapterContent(chapterNumber, winningChoice, context);
    const choices = this.generateChapterChoices(chapterNumber, context);
    const visualElements = this.generateVisualElements(chapterNumber, winningChoice);

    return {
      id: chapterId,
      title: `Chapter ${chapterNumber}: ${this.generateChapterTitle(chapterNumber, winningChoice)}`,
      content,
      choices,
      visualElements,
      metadata: StoryUtils.createDefaultMetadata({
        pathPosition: chapterNumber,
      }),
    };
  }

  /**
   * Generates chapter content based on progression
   */
  private generateChapterContent(
    chapterNumber: number,
    previousChoice: string,
    context: StoryContext
  ): string {
    const templates = this.getContentTemplates();
    const template =
      templates[chapterNumber % templates.length] || templates[0] || 'Default chapter content.';

    // Replace placeholders with context-specific content
    return template
      .replace('{previousChoice}', this.getChoiceDescription(previousChoice))
      .replace('{pathContext}', this.getPathContext(context.pathTaken))
      .replace('{chapterNumber}', chapterNumber.toString());
  }

  /**
   * Generates chapter choices
   */
  private generateChapterChoices(
    chapterNumber: number,
    context: StoryContext
  ): Array<{
    id: string;
    text: string;
    description?: string;
    consequences?: string;
    voteCount: number;
  }> {
    const baseChoices = [
      {
        id: `choice_${chapterNumber}_1`,
        text: 'Investigate the mysterious sound',
        description: 'Move toward the unknown',
        consequences: 'May reveal secrets or dangers',
        voteCount: 0,
      },
      {
        id: `choice_${chapterNumber}_2`,
        text: 'Stay hidden and observe',
        description: 'Wait and watch carefully',
        consequences: 'Safer but may miss opportunities',
        voteCount: 0,
      },
      {
        id: `choice_${chapterNumber}_3`,
        text: 'Try to escape the area',
        description: 'Retreat to safety',
        consequences: 'Avoid immediate danger but story may end',
        voteCount: 0,
      },
    ];

    // Customize choices based on story context
    return baseChoices.map((choice) => ({
      ...choice,
      text: this.customizeChoiceText(choice.text, context),
    }));
  }

  /**
   * Generates visual elements for chapter
   */
  private generateVisualElements(chapterNumber: number, _previousChoice: string): VisualElements {
    const baseElements = StoryUtils.createDefaultVisualElements();

    // Customize based on chapter progression
    const intensity = Math.min(chapterNumber / 10, 1); // Increase intensity as story progresses

    return {
      ...baseElements,
      atmosphericEffects: [
        ...baseElements.atmosphericEffects,
        intensity > 0.5 ? 'heavy_fog' : 'light_mist',
        intensity > 0.7 ? 'eerie_sounds' : 'distant_whispers',
      ],
      animations: [
        {
          type: 'fade',
          duration: 2000,
          intensity: intensity > 0.5 ? 'high' : 'medium',
          trigger: 'onLoad',
        },
      ],
    };
  }

  /**
   * Adds contextual references to chapter content
   * Note: Currently unused but kept for future enhancements
   */
  // private addContextualReferences(content: string, pathTaken: string[]): string {
  //   if (pathTaken.length === 0) return content;

  //   const recentChoice = pathTaken[pathTaken.length - 1];
  //   if (!recentChoice) return content;

  //   const contextualPhrase = this.getContextualPhrase(recentChoice);

  //   return `${contextualPhrase} ${content}`;
  // }

  /**
   * Gets contextual phrase based on previous choice
   * Note: Currently unused but kept for future enhancements
   */
  // private getContextualPhrase(choice: string): string {
  //   const phrases = {
  //     'investigate': "Following your curiosity from before,",
  //     'hide': "Still cautious from your previous decision,",
  //     'escape': "Having tried to leave earlier,",
  //     'default': "Continuing your journey,"
  //   };

  //   for (const [key, phrase] of Object.entries(phrases)) {
  //     if (choice.includes(key)) {
  //       return phrase;
  //     }
  //   }

  //   return phrases.default;
  // }

  /**
   * Gets content templates for dynamic generation
   */
  private getContentTemplates(): string[] {
    return [
      'The shadows seem to move on their own as you {previousChoice}. The air grows colder, and you sense something watching from the darkness ahead.',
      'Your decision to {previousChoice} leads you deeper into the mystery. Strange symbols appear on the walls, glowing faintly in the dim light.',
      'As you {previousChoice}, the floorboards creak ominously beneath your feet. A door at the end of the hallway stands slightly ajar.',
      'The consequences of {previousChoice} become clear as whispers echo through the empty rooms. Something is definitely not right here.',
      'Having chosen to {previousChoice}, you find yourself in a room filled with old photographs. The eyes in the pictures seem to follow your movement.',
    ];
  }

  /**
   * Gets description for a choice
   */
  private getChoiceDescription(choice: string): string {
    const descriptions = {
      'investigate': 'investigate the unknown',
      'hide': 'remain hidden',
      'escape': 'seek an escape route',
      'default': 'make your choice',
    };

    for (const [key, desc] of Object.entries(descriptions)) {
      if (choice.includes(key)) {
        return desc;
      }
    }

    return descriptions.default;
  }

  /**
   * Gets path context summary
   */
  private getPathContext(pathTaken: string[]): string {
    if (pathTaken.length === 0) return 'beginning your journey';
    if (pathTaken.length < 3) return 'early in your exploration';
    if (pathTaken.length < 6) return 'deep into the mystery';
    return 'near the heart of the haunted thread';
  }

  /**
   * Customizes choice text based on context
   */
  private customizeChoiceText(text: string, _context: StoryContext): string {
    // Add context-specific modifications
    if (_context.pathTaken.length > 5) {
      return text.replace('mysterious', 'increasingly ominous');
    }
    return text;
  }

  /**
   * Generates chapter title
   */
  private generateChapterTitle(chapterNumber: number, _previousChoice: string): string {
    const titles = [
      'The First Step',
      'Deeper Into Darkness',
      'Whispers in the Void',
      'The Point of No Return',
      'Shadows Converge',
      'The Truth Emerges',
      'Final Confrontation',
    ];

    if (chapterNumber <= titles.length) {
      return titles[chapterNumber - 1] || `Chapter ${chapterNumber}`;
    }

    return `The Unknown Path ${chapterNumber}`;
  }

  /**
   * Gets the current branch ID based on story context
   */
  private getCurrentBranchId(context: StoryContext): string {
    // If this is the beginning of the story, start with opening branch
    if (context.pathTaken.length === 0) {
      return 'opening';
    }

    // Map path taken to branch IDs based on story structure
    const pathMapping = this.getPathToBranchMapping();
    const pathKey = context.pathTaken.join('->');

    return pathMapping.get(pathKey) || this.inferBranchFromPath(context.pathTaken);
  }

  /**
   * Creates mapping from path sequences to branch IDs
   */
  private getPathToBranchMapping(): Map<string, string> {
    const mapping = new Map<string, string>();

    // Map choice sequences to specific branches
    mapping.set('investigate_thread', 'investigation_path');
    mapping.set('close_browser', 'escape_attempt');
    mapping.set('respond_thread', 'engagement_path');
    mapping.set('investigate_thread->visit_house', 'house_arrival');
    mapping.set('investigate_thread->research_history', 'historical_research');
    mapping.set('engagement_path->ask_questions', 'revelation_path');
    mapping.set('engagement_path->refuse_role', 'resistance_path');
    mapping.set('house_arrival->enter_house', 'house_interior');
    mapping.set('revelation_path->find_alternative', 'cycle_breaking');
    mapping.set('cycle_breaking->unite_caretakers', 'final_battle');

    return mapping;
  }

  /**
   * Infers branch ID from path when no direct mapping exists
   */
  private inferBranchFromPath(pathTaken: string[]): string {
    const lastChoice = pathTaken[pathTaken.length - 1];

    // Use heuristics to determine branch based on recent choices
    if (lastChoice?.includes('house')) return 'house_interior';
    if (lastChoice?.includes('escape') || lastChoice?.includes('close')) return 'escape_attempt';
    if (lastChoice?.includes('investigate')) return 'investigation_path';
    if (lastChoice?.includes('engage') || lastChoice?.includes('respond')) return 'engagement_path';
    if (lastChoice?.includes('battle') || lastChoice?.includes('unite')) return 'final_battle';

    // Default fallback
    return 'investigation_path';
  }

  /**
   * Initializes predefined story content
   * Note: Currently unused but kept for future enhancements
   */
  // private initializePredefinedContent(): void {
  //   // This would be populated with actual story content
  //   // For now, we'll keep it empty and rely on dynamic generation
  //   console.log('Story progression engine initialized with dynamic content generation');
  // }
}
