/**
 * Core story data structures for The Haunted Thread
 */

export interface StoryChapter {
  id: string;
  title: string;
  content: string;
  choices: StoryChoice[];
  visualElements: VisualElements;
  metadata: ChapterMetadata;
}

export interface StoryChoice {
  id: string;
  text: string;
  description?: string;
  consequences?: string;
  voteCount: number;
}

export interface StoryPath {
  chapters: string[];
  decisions: string[];
  ending?: StoryEnding;
}

export interface VisualElements {
  backgroundImage?: string;
  atmosphericEffects: string[];
  colorScheme: HorrorColorScheme;
  typography: HorrorTypography;
  animations: AnimationEffect[];
}

export interface ChapterMetadata {
  createdAt: Date;
  votingStartTime: Date;
  votingEndTime?: Date;
  totalVotes: number;
  status: 'active' | 'completed' | 'expired';
  pathPosition: number;
}

export interface StoryEnding {
  id: string;
  title: string;
  content: string;
  type: 'good' | 'bad' | 'neutral' | 'twist';
  pathRequirements: string[];
}

export interface HorrorColorScheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  danger: string;
}

export interface HorrorTypography {
  fontFamily: string;
  headingFont: string;
  bodyFont: string;
  fontSize: {
    small: string;
    medium: string;
    large: string;
    xlarge: string;
  };
}

export interface AnimationEffect {
  type: 'fade' | 'slide' | 'flicker' | 'shake' | 'glow';
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  trigger: 'onLoad' | 'onHover' | 'onVote' | 'onTransition';
}

export interface StoryContext {
  currentChapter: string;
  previousChoices: string[];
  pathTaken: string[];
  userVotes: Record<string, string>;
  storyStartTime: Date;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface StoryValidationOptions {
  requireChoices?: boolean;
  minChoices?: number;
  maxChoices?: number;
  requireVisualElements?: boolean;
  validateMetadata?: boolean;
}

// Story progression types
export interface StoryProgression {
  totalChapters: number;
  currentPosition: number;
  completedPaths: string[];
  availablePaths: string[];
  progressPercentage: number;
}

// Vote tracking types
export interface VoteSession {
  chapterId: string;
  userId: string;
  choiceId: string;
  timestamp: Date;
  isValid: boolean;
}

export interface VotingStatus {
  isActive: boolean;
  totalVotes: number;
  votesPerChoice: Record<string, number>;
  timeRemaining?: number;
  winningChoice?: string;
}

/**
 * Validation functions for story data integrity
 */

export class StoryValidator {
  /**
   * Validates a story chapter for completeness and integrity
   */
  static validateChapter(
    chapter: StoryChapter,
    options: StoryValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic required fields
    if (!chapter.id || chapter.id.trim() === '') {
      errors.push('Chapter ID is required');
    }

    if (!chapter.title || chapter.title.trim() === '') {
      errors.push('Chapter title is required');
    }

    if (!chapter.content || chapter.content.trim() === '') {
      errors.push('Chapter content is required');
    }

    // Validate choices
    if (options.requireChoices !== false) {
      if (!chapter.choices || chapter.choices.length === 0) {
        errors.push('Chapter must have at least one choice');
      } else {
        const minChoices = options.minChoices || 2;
        const maxChoices = options.maxChoices || 4;

        if (chapter.choices.length < minChoices) {
          errors.push(`Chapter must have at least ${minChoices} choices`);
        }

        if (chapter.choices.length > maxChoices) {
          warnings.push(
            `Chapter has ${chapter.choices.length} choices, consider reducing to ${maxChoices} or fewer`
          );
        }

        // Validate each choice
        chapter.choices.forEach((choice, index) => {
          const choiceErrors = this.validateChoice(choice);
          if (!choiceErrors.isValid) {
            errors.push(...choiceErrors.errors.map((err) => `Choice ${index + 1}: ${err}`));
          }
        });
      }
    }

    // Validate visual elements
    if (options.requireVisualElements && !chapter.visualElements) {
      errors.push('Visual elements are required');
    } else if (chapter.visualElements) {
      const visualErrors = this.validateVisualElements(chapter.visualElements);
      if (!visualErrors.isValid) {
        errors.push(...visualErrors.errors);
      }
    }

    // Validate metadata
    if (options.validateMetadata !== false && chapter.metadata) {
      const metadataErrors = this.validateMetadata(chapter.metadata);
      if (!metadataErrors.isValid) {
        errors.push(...metadataErrors.errors);
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Validates a story choice
   */
  static validateChoice(choice: StoryChoice): ValidationResult {
    const errors: string[] = [];

    if (!choice.id || choice.id.trim() === '') {
      errors.push('Choice ID is required');
    }

    if (!choice.text || choice.text.trim() === '') {
      errors.push('Choice text is required');
    }

    if (choice.voteCount < 0) {
      errors.push('Vote count cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates visual elements
   */
  static validateVisualElements(elements: VisualElements): ValidationResult {
    const errors: string[] = [];

    if (!elements.colorScheme) {
      errors.push('Color scheme is required');
    } else {
      const colorErrors = this.validateColorScheme(elements.colorScheme);
      if (!colorErrors.isValid) {
        errors.push(...colorErrors.errors);
      }
    }

    if (!elements.typography) {
      errors.push('Typography settings are required');
    }

    if (!elements.atmosphericEffects || elements.atmosphericEffects.length === 0) {
      errors.push('At least one atmospheric effect is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates color scheme
   */
  static validateColorScheme(scheme: HorrorColorScheme): ValidationResult {
    const errors: string[] = [];
    const requiredColors = ['primary', 'secondary', 'background', 'text', 'accent', 'danger'];

    requiredColors.forEach((color) => {
      const colorValue = scheme[color as keyof HorrorColorScheme];
      if (!colorValue || typeof colorValue !== 'string') {
        errors.push(`${color} color is required`);
      } else if (!this.isValidColor(colorValue)) {
        errors.push(`${color} color "${colorValue}" is not a valid color format`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates chapter metadata
   */
  static validateMetadata(metadata: ChapterMetadata): ValidationResult {
    const errors: string[] = [];

    if (!metadata.createdAt) {
      errors.push('Created date is required');
    }

    if (!metadata.votingStartTime) {
      errors.push('Voting start time is required');
    }

    if (metadata.votingEndTime && metadata.votingEndTime <= metadata.votingStartTime) {
      errors.push('Voting end time must be after start time');
    }

    if (metadata.totalVotes < 0) {
      errors.push('Total votes cannot be negative');
    }

    if (!['active', 'completed', 'expired'].includes(metadata.status)) {
      errors.push('Status must be active, completed, or expired');
    }

    if (metadata.pathPosition < 0) {
      errors.push('Path position cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates a story path
   */
  static validateStoryPath(path: StoryPath): ValidationResult {
    const errors: string[] = [];

    if (!path.chapters || path.chapters.length === 0) {
      errors.push('Story path must contain at least one chapter');
    }

    if (!path.decisions || path.decisions.length === 0) {
      errors.push('Story path must contain at least one decision');
    }

    if (path.chapters && path.decisions && path.chapters.length !== path.decisions.length + 1) {
      errors.push('Story path should have one more chapter than decisions');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates story progression data
   */
  static validateProgression(progression: StoryProgression): ValidationResult {
    const errors: string[] = [];

    if (progression.totalChapters <= 0) {
      errors.push('Total chapters must be greater than 0');
    }

    if (
      progression.currentPosition < 0 ||
      progression.currentPosition > progression.totalChapters
    ) {
      errors.push('Current position must be between 0 and total chapters');
    }

    if (progression.progressPercentage < 0 || progression.progressPercentage > 100) {
      errors.push('Progress percentage must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper function to validate color format (hex, rgb, rgba, named colors)
   */
  private static isValidColor(color: string): boolean {
    // Basic validation for common color formats
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/;
    const namedColors = [
      'black',
      'white',
      'red',
      'green',
      'blue',
      'yellow',
      'purple',
      'orange',
      'gray',
      'grey',
    ];

    return (
      hexPattern.test(color) ||
      rgbPattern.test(color) ||
      rgbaPattern.test(color) ||
      namedColors.includes(color.toLowerCase())
    );
  }
}

/**
 * Utility functions for story data manipulation
 */
export class StoryUtils {
  /**
   * Creates a default chapter metadata object
   */
  static createDefaultMetadata(overrides: Partial<ChapterMetadata> = {}): ChapterMetadata {
    const now = new Date();
    const defaultMetadata: ChapterMetadata = {
      createdAt: now,
      votingStartTime: now,
      totalVotes: 0,
      status: 'active',
      pathPosition: 0,
    };

    return { ...defaultMetadata, ...overrides };
  }

  /**
   * Creates a default visual elements object with horror theme
   */
  static createDefaultVisualElements(overrides: Partial<VisualElements> = {}): VisualElements {
    const defaultElements: VisualElements = {
      atmosphericEffects: ['fog', 'shadows'],
      colorScheme: {
        primary: '#8B0000', // Dark red
        secondary: '#2F2F2F', // Dark gray
        background: '#0D0D0D', // Almost black
        text: '#E0E0E0', // Light gray
        accent: '#FF6B6B', // Bright red
        danger: '#FF0000', // Pure red
      },
      typography: {
        fontFamily: 'serif',
        headingFont: 'Georgia, serif',
        bodyFont: 'Times New Roman, serif',
        fontSize: {
          small: '0.875rem',
          medium: '1rem',
          large: '1.25rem',
          xlarge: '1.5rem',
        },
      },
      animations: [],
    };

    return { ...defaultElements, ...overrides };
  }

  /**
   * Calculates story progression percentage
   */
  static calculateProgress(currentPosition: number, totalChapters: number): number {
    if (totalChapters <= 0) return 0;
    return Math.round((currentPosition / totalChapters) * 100);
  }

  /**
   * Generates a unique chapter ID
   */
  static generateChapterId(prefix: string = 'chapter'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Generates a unique choice ID
   */
  static generateChoiceId(chapterId: string, index: number): string {
    return `${chapterId}_choice_${index}`;
  }
}
