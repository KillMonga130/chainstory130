/**
 * Story branching logic and decision tree navigation for The Haunted Thread
 */

import { 
  StoryChapter, 
  StoryPath, 
  StoryContext, 
  StoryEnding, 
  ValidationResult,
  StoryProgression 
} from './story.js';

/**
 * Story branching and navigation engine
 */
export class StoryBranchingEngine {
  private storyPaths: Map<string, StoryPath> = new Map();
  private chapterGraph: Map<string, string[]> = new Map(); // chapter -> possible next chapters
  private endings: Map<string, StoryEnding> = new Map();

  /**
   * Tracks the current story path and validates transitions
   */
  trackStoryPath(context: StoryContext, newChoice: string): ValidationResult {
    const errors: string[] = [];

    // Validate that the choice exists for the current chapter
    if (!this.isValidTransition(context.currentChapter, newChoice)) {
      errors.push(`Invalid choice "${newChoice}" for chapter "${context.currentChapter}"`);
    }

    // Check if user has already made this choice
    if (context.userVotes[context.currentChapter]) {
      errors.push('User has already voted for this chapter');
    }

    // Validate path consistency
    const pathValidation = this.validatePathConsistency(context.pathTaken, newChoice);
    if (!pathValidation.isValid) {
      errors.push(...pathValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Determines valid story transitions from current chapter
   */
  getValidTransitions(chapterId: string): string[] {
    return this.chapterGraph.get(chapterId) || [];
  }

  /**
   * Checks if a transition from one chapter to another is valid
   */
  isValidTransition(fromChapter: string, choiceId: string): boolean {
    const validTransitions = this.getValidTransitions(fromChapter);
    return validTransitions.includes(choiceId);
  }

  /**
   * Determines the next chapter based on winning choice
   */
  determineNextChapter(currentChapter: string, winningChoice: string, context: StoryContext): string | null {
    // Check if this choice leads to an ending
    const ending = this.checkForEnding(context.pathTaken, winningChoice);
    if (ending) {
      return null; // Story ends
    }

    // Generate next chapter ID based on current chapter and choice
    return this.generateNextChapterId(currentChapter, winningChoice);
  }

  /**
   * Checks if the current path and choice combination leads to an ending
   */
  checkForEnding(pathTaken: string[], newChoice: string): StoryEnding | null {
    const fullPath = [...pathTaken, newChoice];
    
    // Check each ending to see if path requirements are met
    for (const [, ending] of this.endings) {
      if (this.pathMeetsRequirements(fullPath, ending.pathRequirements)) {
        return ending;
      }
    }

    return null;
  }

  /**
   * Detects if story has reached a conclusion
   */
  detectStoryConclusion(context: StoryContext): { hasEnded: boolean; ending?: StoryEnding } {
    // Check if current path leads to any ending
    const ending = this.checkForEnding(context.pathTaken, '');
    
    if (ending) {
      return { hasEnded: true, ending };
    }

    // Check if we've reached maximum story length
    const maxChapters = this.getMaxStoryLength();
    if (context.pathTaken.length >= maxChapters) {
      return { 
        hasEnded: true, 
        ending: this.getDefaultEnding(context.pathTaken) 
      };
    }

    return { hasEnded: false };
  }

  /**
   * Calculates story progression based on current path
   */
  calculateProgression(context: StoryContext): StoryProgression {
    const totalPossibleChapters = this.getTotalChapters();
    const currentPosition = context.pathTaken.length;
    const completedPaths = this.getCompletedPaths(context);
    const availablePaths = this.getAvailablePaths(context.currentChapter);

    return {
      totalChapters: totalPossibleChapters,
      currentPosition,
      completedPaths,
      availablePaths,
      progressPercentage: Math.round((currentPosition / totalPossibleChapters) * 100)
    };
  }

  /**
   * Registers a new story path in the branching system
   */
  registerStoryPath(pathId: string, path: StoryPath): void {
    this.storyPaths.set(pathId, path);
    this.updateChapterGraph(path);
  }

  /**
   * Registers a story ending
   */
  registerEnding(ending: StoryEnding): void {
    this.endings.set(ending.id, ending);
  }

  /**
   * Gets all possible story branches from current position
   */
  getStoryBranches(currentChapter: string): StoryBranch[] {
    const branches: StoryBranch[] = [];
    const validTransitions = this.getValidTransitions(currentChapter);

    validTransitions.forEach(choiceId => {
      const nextChapter = this.generateNextChapterId(currentChapter, choiceId);
      const branch: StoryBranch = {
        choiceId,
        nextChapter,
        branchType: this.determineBranchType(currentChapter, choiceId),
        difficulty: this.calculateBranchDifficulty(currentChapter, choiceId),
        estimatedLength: this.estimateBranchLength(currentChapter, choiceId)
      };
      branches.push(branch);
    });

    return branches;
  }

  /**
   * Validates path consistency and logic
   */
  private validatePathConsistency(pathTaken: string[], newChoice: string): ValidationResult {
    const errors: string[] = [];

    // Check for circular paths (prevent infinite loops)
    if (pathTaken.includes(newChoice)) {
      errors.push('Choice would create circular path');
    }

    // Validate path length doesn't exceed maximum
    const maxLength = this.getMaxStoryLength();
    if (pathTaken.length >= maxLength) {
      errors.push('Story path has reached maximum length');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if a path meets the requirements for a specific ending
   */
  private pathMeetsRequirements(path: string[], requirements: string[]): boolean {
    return requirements.every(requirement => {
      // Check if requirement is a specific choice that must be in path
      if (requirement.startsWith('choice:')) {
        const requiredChoice = requirement.substring(7);
        return path.includes(requiredChoice);
      }

      // Check if requirement is a path length
      if (requirement.startsWith('length:')) {
        const requiredLength = parseInt(requirement.substring(7));
        return path.length >= requiredLength;
      }

      // Check if requirement is avoiding certain choices
      if (requirement.startsWith('avoid:')) {
        const avoidChoice = requirement.substring(6);
        return !path.includes(avoidChoice);
      }

      return false;
    });
  }

  /**
   * Updates the chapter graph with new path information
   */
  private updateChapterGraph(path: StoryPath): void {
    for (let i = 0; i < path.chapters.length - 1; i++) {
      const currentChapter = path.chapters[i];
      const nextChapter = path.chapters[i + 1];
      
      if (!currentChapter || !nextChapter) continue;
      
      if (!this.chapterGraph.has(currentChapter)) {
        this.chapterGraph.set(currentChapter, []);
      }
      
      const transitions = this.chapterGraph.get(currentChapter)!;
      if (!transitions.includes(nextChapter)) {
        transitions.push(nextChapter);
      }
    }
  }

  /**
   * Generates next chapter ID based on current chapter and choice
   */
  private generateNextChapterId(currentChapter: string, choice: string): string {
    return `${currentChapter}_${choice}_next`;
  }

  /**
   * Gets the maximum allowed story length
   */
  private getMaxStoryLength(): number {
    return 20; // Maximum 20 chapters per story
  }

  /**
   * Gets total number of possible chapters
   */
  private getTotalChapters(): number {
    return Array.from(this.chapterGraph.keys()).length;
  }

  /**
   * Gets completed story paths for a given context
   */
  private getCompletedPaths(context: StoryContext): string[] {
    const completed: string[] = [];
    
    for (const [pathId, path] of this.storyPaths) {
      if (path.ending && this.pathMeetsRequirements(context.pathTaken, path.ending.pathRequirements)) {
        completed.push(pathId);
      }
    }

    return completed;
  }

  /**
   * Gets available paths from current chapter
   */
  private getAvailablePaths(currentChapter: string): string[] {
    return this.getValidTransitions(currentChapter);
  }

  /**
   * Gets default ending when story reaches maximum length
   */
  private getDefaultEnding(_pathTaken: string[]): StoryEnding {
    return {
      id: 'default_ending',
      title: 'The Mystery Continues...',
      content: 'Your journey through the haunted thread has led you deep into the mystery, but some secrets are meant to remain hidden. The story continues in the shadows...',
      type: 'neutral',
      pathRequirements: []
    };
  }

  /**
   * Determines the type of branch (main story, side quest, etc.)
   */
  private determineBranchType(_currentChapter: string, choiceId: string): BranchType {
    // Simple logic - can be enhanced based on story design
    if (choiceId.includes('main')) return 'main';
    if (choiceId.includes('side')) return 'side';
    if (choiceId.includes('danger')) return 'dangerous';
    return 'neutral';
  }

  /**
   * Calculates difficulty of a story branch
   */
  private calculateBranchDifficulty(_currentChapter: string, choiceId: string): BranchDifficulty {
    // Simple logic based on choice keywords
    if (choiceId.includes('easy') || choiceId.includes('safe')) return 'easy';
    if (choiceId.includes('hard') || choiceId.includes('danger')) return 'hard';
    return 'medium';
  }

  /**
   * Estimates the length of a story branch
   */
  private estimateBranchLength(_currentChapter: string, _choiceId: string): number {
    // Simple estimation - can be enhanced with actual path analysis
    return Math.floor(Math.random() * 5) + 3; // 3-7 chapters
  }
}

/**
 * Story branch information
 */
export interface StoryBranch {
  choiceId: string;
  nextChapter: string;
  branchType: BranchType;
  difficulty: BranchDifficulty;
  estimatedLength: number;
}

export type BranchType = 'main' | 'side' | 'dangerous' | 'neutral';
export type BranchDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Decision tree navigator for complex story structures
 */
export class DecisionTreeNavigator {
  private decisionTree: Map<string, DecisionNode> = new Map();

  /**
   * Builds decision tree from story chapters and choices
   */
  buildDecisionTree(chapters: StoryChapter[]): void {
    chapters.forEach(chapter => {
      const node: DecisionNode = {
        chapterId: chapter.id,
        choices: chapter.choices.map(choice => ({
          choiceId: choice.id,
          text: choice.text,
          nextNode: null, // Will be populated when connections are made
          weight: choice.voteCount || 0
        })),
        isEndNode: chapter.choices.length === 0
      };

      this.decisionTree.set(chapter.id, node);
    });

    // Connect nodes based on story logic
    this.connectDecisionNodes();
  }

  /**
   * Navigates to next node based on choice
   */
  navigateToNext(currentNodeId: string, choiceId: string): string | null {
    const currentNode = this.decisionTree.get(currentNodeId);
    if (!currentNode) return null;

    const choice = currentNode.choices.find(c => c.choiceId === choiceId);
    return choice?.nextNode || null;
  }

  /**
   * Gets all possible paths from current node
   */
  getAllPaths(startNodeId: string): string[][] {
    const paths: string[][] = [];
    this.findAllPaths(startNodeId, [], paths);
    return paths;
  }

  /**
   * Finds the shortest path to any ending
   */
  findShortestPathToEnd(startNodeId: string): string[] | null {
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startNodeId, path: [startNodeId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = this.decisionTree.get(nodeId);
      if (!node) continue;

      if (node.isEndNode) {
        return path;
      }

      node.choices.forEach(choice => {
        const nextNode = choice.nextNode;
        if (nextNode && !visited.has(nextNode)) {
          queue.push({
            nodeId: nextNode,
            path: [...path, nextNode]
          });
        }
      });
    }

    return null;
  }

  /**
   * Connects decision nodes based on story logic
   */
  private connectDecisionNodes(): void {
    // This would be implemented based on specific story structure
    // For now, we'll use a simple naming convention
    for (const [nodeId, node] of this.decisionTree) {
      node.choices.forEach(choice => {
        // Simple logic: next node is based on choice ID
        const nextNodeId = `${nodeId}_${choice.choiceId}_next`;
        if (this.decisionTree.has(nextNodeId)) {
          choice.nextNode = nextNodeId;
        }
      });
    }
  }

  /**
   * Recursively finds all paths from a starting node
   */
  private findAllPaths(nodeId: string, currentPath: string[], allPaths: string[][]): void {
    const node = this.decisionTree.get(nodeId);
    if (!node) return;

    const newPath = [...currentPath, nodeId];

    if (node.isEndNode) {
      allPaths.push(newPath);
      return;
    }

    node.choices.forEach(choice => {
      const nextNode = choice.nextNode;
      if (nextNode && !currentPath.includes(nextNode)) {
        this.findAllPaths(nextNode, newPath, allPaths);
      }
    });
  }
}

/**
 * Decision tree node structure
 */
export interface DecisionNode {
  chapterId: string;
  choices: DecisionChoice[];
  isEndNode: boolean;
}

export interface DecisionChoice {
  choiceId: string;
  text: string;
  nextNode: string | null;
  weight: number;
}
