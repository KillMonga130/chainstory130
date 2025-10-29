/**
 * Story history and progress tracking for The Haunted Thread
 * Handles displaying story progression indicators, history viewing, and narrative branch tracking
 */

import { StoryChapter, StoryContext } from '../../shared/types/story.js';
import { VotingStats } from '../../shared/types/voting.js';
import { StoryStateManager } from './story-state-manager.js';
import { VotingManager } from './voting-manager.js';

export interface StoryHistoryEntry {
  chapterId: string;
  chapterTitle: string;
  winningChoice: string;
  choiceText: string;
  voteStats: VotingStats;
  timestamp: Date;
  pathPosition: number;
}

export interface ProgressIndicator {
  currentChapter: number;
  totalChapters: number;
  progressPercentage: number;
  pathTaken: string[];
  branchesExplored: string[];
  estimatedTimeRemaining: number;
}

export interface BranchPath {
  pathId: string;
  pathName: string;
  chapters: string[];
  decisions: string[];
  isCompleted: boolean;
  completionPercentage: number;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedLength: number;
}

export class StoryHistoryTracker {
  /**
   * Gets comprehensive story history with voting statistics
   */
  static async getStoryHistory(postId: string): Promise<StoryHistoryEntry[]> {
    try {
      const [rawHistory, allChapters] = await Promise.all([
        StoryStateManager.getStoryHistory(postId),
        StoryStateManager.getAllChapters(postId),
      ]);

      const historyEntries: StoryHistoryEntry[] = [];

      // Create a map of chapters for quick lookup
      const chapterMap = new Map(allChapters.map((ch) => [ch.id, ch]));

      for (const entry of rawHistory) {
        const chapter = chapterMap.get(entry.chapterId);
        if (!chapter) continue;

        // Get voting stats for this chapter
        const voteStats = await VotingManager.getVotingStats(postId, entry.chapterId);
        if (!voteStats) continue;

        // Find the choice text
        const choice = chapter.choices.find((c) => c.id === entry.winningChoice);
        const choiceText = choice?.text || 'Unknown choice';

        historyEntries.push({
          chapterId: entry.chapterId,
          chapterTitle: chapter.title,
          winningChoice: entry.winningChoice,
          choiceText,
          voteStats,
          timestamp: entry.timestamp,
          pathPosition: chapter.metadata.pathPosition,
        });
      }

      // Sort by path position (chronological order)
      return historyEntries.sort((a, b) => a.pathPosition - b.pathPosition);
    } catch (error) {
      console.error('Error getting story history:', error);
      return [];
    }
  }

  /**
   * Gets current story progression indicators
   */
  static async getProgressIndicator(postId: string): Promise<ProgressIndicator | null> {
    try {
      const [context, progression] = await Promise.all([
        StoryStateManager.getStoryContext(postId),
        StoryStateManager.getProgression(postId),
      ]);

      if (!context || !progression) return null;

      // Calculate estimated time remaining based on average chapter duration
      const history = await this.getStoryHistory(postId);
      const averageChapterDuration = this.calculateAverageChapterDuration(history);
      const remainingChapters = Math.max(
        0,
        progression.totalChapters - progression.currentPosition
      );
      const estimatedTimeRemaining = remainingChapters * averageChapterDuration;

      return {
        currentChapter: progression.currentPosition,
        totalChapters: progression.totalChapters,
        progressPercentage: progression.progressPercentage,
        pathTaken: context.pathTaken,
        branchesExplored: progression.completedPaths,
        estimatedTimeRemaining,
      };
    } catch (error) {
      console.error('Error getting progress indicator:', error);
      return null;
    }
  }

  /**
   * Gets all narrative branch paths and their completion status
   */
  static async getNarrativeBranches(postId: string): Promise<BranchPath[]> {
    try {
      const [context, history] = await Promise.all([
        StoryStateManager.getStoryContext(postId),
        this.getStoryHistory(postId),
      ]);

      if (!context) return [];

      // Analyze the current path and identify branches
      const branches = this.analyzeBranchPaths(context, history);

      return branches;
    } catch (error) {
      console.error('Error getting narrative branches:', error);
      return [];
    }
  }

  /**
   * Tracks a new decision in the story path
   */
  static async trackDecision(
    postId: string,
    chapterId: string,
    winningChoice: string,
    _voteStats: VotingStats
  ): Promise<void> {
    try {
      // Add to history (this is already handled by StoryStateManager.addToHistory)
      await StoryStateManager.addToHistory(postId, chapterId, winningChoice);

      // Update progression tracking
      await this.updateProgressionTracking(postId, chapterId, winningChoice);

      // Update branch tracking
      await this.updateBranchTracking(postId, chapterId, winningChoice);
    } catch (error) {
      console.error('Error tracking decision:', error);
    }
  }

  /**
   * Gets story statistics for display
   */
  static async getStoryStatistics(postId: string): Promise<{
    totalDecisions: number;
    totalVotes: number;
    averageVotesPerDecision: number;
    storyDuration: number;
    participationRate: number;
    mostPopularChoice: string;
    branchDiversity: number;
  } | null> {
    try {
      const [history, context, stats] = await Promise.all([
        this.getStoryHistory(postId),
        StoryStateManager.getStoryContext(postId),
        StoryStateManager.getStoryStats(postId),
      ]);

      if (!context || history.length === 0) return null;

      // Calculate statistics
      const totalVotes = history.reduce((sum, entry) => sum + entry.voteStats.totalVotes, 0);
      const averageVotesPerDecision = totalVotes / history.length;

      // Find most popular choice type
      const choiceTypes = history.map((entry) => this.categorizeChoice(entry.choiceText));
      const choiceTypeCounts = choiceTypes.reduce(
        (acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const mostPopularChoiceEntry = Object.entries(choiceTypeCounts).sort(
        ([, a], [, b]) => b - a
      )[0];
      const mostPopularChoice = mostPopularChoiceEntry?.[0] || 'unknown';

      // Calculate branch diversity (unique choice patterns)
      const uniquePatterns = new Set(
        context.pathTaken.map((choice) => this.categorizeChoice(choice))
      );
      const branchDiversity = uniquePatterns.size / Math.max(context.pathTaken.length, 1);

      // Calculate participation rate (average voters per chapter)
      const averageUniqueVoters =
        history.reduce((sum, entry) => sum + entry.voteStats.uniqueVoters, 0) / history.length;
      const participationRate = averageUniqueVoters / Math.max(totalVotes / history.length, 1);

      return {
        totalDecisions: history.length,
        totalVotes,
        averageVotesPerDecision: Math.round(averageVotesPerDecision * 100) / 100,
        storyDuration: stats.storyAge,
        participationRate: Math.round(participationRate * 100) / 100,
        mostPopularChoice,
        branchDiversity: Math.round(branchDiversity * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting story statistics:', error);
      return null;
    }
  }

  /**
   * Gets previous chapters and decisions for review
   */
  static async getPreviousChapters(
    postId: string,
    limit: number = 5
  ): Promise<
    Array<{
      chapter: StoryChapter;
      winningChoice: string;
      choiceText: string;
      voteStats: VotingStats;
    }>
  > {
    try {
      const history = await this.getStoryHistory(postId);
      const recentHistory = history.slice(-limit);

      const chapters = await StoryStateManager.getAllChapters(postId);
      const chapterMap = new Map(chapters.map((ch) => [ch.id, ch]));

      const previousChapters = [];

      for (const entry of recentHistory) {
        const chapter = chapterMap.get(entry.chapterId);
        if (chapter) {
          previousChapters.push({
            chapter,
            winningChoice: entry.winningChoice,
            choiceText: entry.choiceText,
            voteStats: entry.voteStats,
          });
        }
      }

      return previousChapters;
    } catch (error) {
      console.error('Error getting previous chapters:', error);
      return [];
    }
  }

  /**
   * Generates a story path summary
   */
  static async generatePathSummary(postId: string): Promise<{
    pathDescription: string;
    keyDecisions: string[];
    pathType: 'cautious' | 'bold' | 'investigative' | 'mixed';
    completionStatus: 'beginning' | 'middle' | 'advanced' | 'near_end';
  } | null> {
    try {
      const [context, history] = await Promise.all([
        StoryStateManager.getStoryContext(postId),
        this.getStoryHistory(postId),
      ]);

      if (!context || history.length === 0) return null;

      // Analyze path characteristics
      const choiceTypes = history.map((entry) => this.categorizeChoice(entry.choiceText));
      const pathType = this.determinePathType(choiceTypes);

      // Determine completion status
      const completionStatus = this.determineCompletionStatus(history.length);

      // Generate key decisions
      const keyDecisions = history
        .filter((entry) => entry.voteStats.totalVotes > 0)
        .sort((a, b) => b.voteStats.totalVotes - a.voteStats.totalVotes)
        .slice(0, 3)
        .map((entry) => entry.choiceText);

      // Generate path description
      const pathDescription = this.generatePathDescription(pathType, history.length, keyDecisions);

      return {
        pathDescription,
        keyDecisions,
        pathType,
        completionStatus,
      };
    } catch (error) {
      console.error('Error generating path summary:', error);
      return null;
    }
  }

  /**
   * Calculates average chapter duration from history
   */
  private static calculateAverageChapterDuration(history: StoryHistoryEntry[]): number {
    if (history.length < 2) return 30 * 60 * 1000; // Default 30 minutes

    const durations = [];
    for (let i = 1; i < history.length; i++) {
      const currentEntry = history[i];
      const previousEntry = history[i - 1];
      if (currentEntry && previousEntry) {
        const duration = currentEntry.timestamp.getTime() - previousEntry.timestamp.getTime();
        durations.push(duration);
      }
    }

    const averageDuration =
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : 30 * 60 * 1000;
    return Math.max(averageDuration, 5 * 60 * 1000); // Minimum 5 minutes
  }

  /**
   * Analyzes branch paths from context and history
   */
  private static analyzeBranchPaths(
    context: StoryContext,
    history: StoryHistoryEntry[]
  ): BranchPath[] {
    const branches: BranchPath[] = [];

    // Current main path
    const mainPath: BranchPath = {
      pathId: 'main_path',
      pathName: 'Main Story Path',
      chapters: [context.currentChapter],
      decisions: context.pathTaken,
      isCompleted: false,
      completionPercentage: Math.round((history.length / 10) * 100), // Assume 10 chapters max
      difficulty: this.calculatePathDifficulty(context.pathTaken),
      estimatedLength: 10, // Estimated total chapters
    };

    branches.push(mainPath);

    // Analyze potential alternative branches
    const alternativeBranches = this.identifyAlternativeBranches(history);
    branches.push(...alternativeBranches);

    return branches;
  }

  /**
   * Identifies alternative story branches
   */
  private static identifyAlternativeBranches(history: StoryHistoryEntry[]): BranchPath[] {
    const branches: BranchPath[] = [];

    // Look for decision points where other choices had significant votes
    for (const entry of history) {
      if (entry.voteStats.winningPercentage < 60) {
        // Close decision
        const alternativeBranch: BranchPath = {
          pathId: `alt_${entry.chapterId}`,
          pathName: `Alternative from ${entry.chapterTitle}`,
          chapters: [entry.chapterId],
          decisions: [],
          isCompleted: false,
          completionPercentage: 0,
          difficulty: 'medium',
          estimatedLength: 5,
        };
        branches.push(alternativeBranch);
      }
    }

    return branches;
  }

  /**
   * Updates progression tracking
   */
  private static async updateProgressionTracking(
    postId: string,
    _chapterId: string,
    _winningChoice: string
  ): Promise<void> {
    try {
      const progression = await StoryStateManager.getProgression(postId);
      if (!progression) return;

      // Update progression with new information
      const updatedProgression = {
        ...progression,
        currentPosition: progression.currentPosition + 1,
        progressPercentage: Math.round(
          ((progression.currentPosition + 1) / progression.totalChapters) * 100
        ),
      };

      await StoryStateManager.storeProgression(postId, updatedProgression);
    } catch (error) {
      console.error('Error updating progression tracking:', error);
    }
  }

  /**
   * Updates branch tracking
   */
  private static async updateBranchTracking(
    _postId: string,
    chapterId: string,
    winningChoice: string
  ): Promise<void> {
    try {
      // This could be enhanced to track specific branch information
      // For now, we'll use the existing progression system
      console.log(`Branch tracking updated for chapter ${chapterId} with choice ${winningChoice}`);
    } catch (error) {
      console.error('Error updating branch tracking:', error);
    }
  }

  /**
   * Categorizes a choice into a type
   */
  private static categorizeChoice(choiceText: string): string {
    const text = choiceText.toLowerCase();

    if (text.includes('investigate') || text.includes('explore') || text.includes('examine')) {
      return 'investigative';
    }
    if (text.includes('hide') || text.includes('wait') || text.includes('observe')) {
      return 'cautious';
    }
    if (text.includes('escape') || text.includes('run') || text.includes('flee')) {
      return 'escape';
    }
    if (text.includes('confront') || text.includes('attack') || text.includes('challenge')) {
      return 'bold';
    }

    return 'neutral';
  }

  /**
   * Determines overall path type from choice types
   */
  private static determinePathType(
    choiceTypes: string[]
  ): 'cautious' | 'bold' | 'investigative' | 'mixed' {
    if (choiceTypes.length === 0) return 'mixed';

    const counts = choiceTypes.reduce(
      (acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const dominantEntry = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
    if (!dominantEntry) return 'mixed';

    const dominantPercentage = dominantEntry[1] / choiceTypes.length;

    if (dominantPercentage > 0.6) {
      return dominantEntry[0] as 'cautious' | 'bold' | 'investigative';
    }

    return 'mixed';
  }

  /**
   * Determines completion status based on chapter count
   */
  private static determineCompletionStatus(
    chapterCount: number
  ): 'beginning' | 'middle' | 'advanced' | 'near_end' {
    if (chapterCount <= 2) return 'beginning';
    if (chapterCount <= 5) return 'middle';
    if (chapterCount <= 8) return 'advanced';
    return 'near_end';
  }

  /**
   * Calculates path difficulty based on choices
   */
  private static calculatePathDifficulty(pathTaken: string[]): 'easy' | 'medium' | 'hard' {
    const riskChoices = pathTaken.filter(
      (choice) =>
        choice.includes('investigate') || choice.includes('confront') || choice.includes('bold')
    );

    const riskPercentage = riskChoices.length / Math.max(pathTaken.length, 1);

    if (riskPercentage > 0.6) return 'hard';
    if (riskPercentage > 0.3) return 'medium';
    return 'easy';
  }

  /**
   * Generates a descriptive path summary
   */
  private static generatePathDescription(
    pathType: string,
    chapterCount: number,
    keyDecisions: string[]
  ): string {
    const typeDescriptions = {
      cautious: "You've taken a careful, observant approach to the mystery",
      bold: "You've chosen a direct, confrontational path through the story",
      investigative: "You've pursued knowledge and exploration at every turn",
      mixed: "You've balanced different approaches as the story unfolded",
    };

    const baseDescription =
      typeDescriptions[pathType as keyof typeof typeDescriptions] || typeDescriptions.mixed;

    let description = `${baseDescription}. Over ${chapterCount} chapters, `;

    if (keyDecisions.length > 0) {
      description += `your most significant decisions included: ${keyDecisions.join(', ')}.`;
    } else {
      description += "you've navigated the haunted thread with determination.";
    }

    return description;
  }
}
