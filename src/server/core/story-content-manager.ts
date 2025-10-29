/**
 * Predefined branching narrative content for The Haunted Thread
 * Contains multiple story paths with different decision points and endings
 */

import { StoryChapter, StoryEnding, VisualElements, StoryUtils } from '../../shared/types/story.js';

export interface StoryBranch {
  id: string;
  title: string;
  content: string;
  choices: Array<{
    id: string;
    text: string;
    description?: string;
    consequences?: string;
    nextBranch?: string;
    endingId?: string;
  }>;
  visualTheme: 'dark' | 'mysterious' | 'terrifying' | 'supernatural' | 'psychological';
  pathRequirements?: string[];
}

export class StoryContentManager {
  private static storyBranches: Map<string, StoryBranch> = new Map();
  private static storyEndings: Map<string, StoryEnding> = new Map();
  private static initialized = false;

  /**
   * Initialize all predefined story content
   */
  static initialize(): void {
    if (this.initialized) return;

    this.initializeStoryBranches();
    this.initializeStoryEndings();
    this.initialized = true;
  }

  /**
   * Gets a story branch by ID
   */
  static getBranch(branchId: string): StoryBranch | null {
    this.initialize();
    return this.storyBranches.get(branchId) || null;
  }

  /**
   * Gets a story ending by ID
   */
  static getEnding(endingId: string): StoryEnding | null {
    this.initialize();
    return this.storyEndings.get(endingId) || null;
  }

  /**
   * Converts a story branch to a StoryChapter
   */
  static branchToChapter(branch: StoryBranch, chapterNumber: number): StoryChapter {
    return {
      id: StoryUtils.generateChapterId(`branch_${branch.id}`),
      title: `Chapter ${chapterNumber}: ${branch.title}`,
      content: branch.content,
      choices: branch.choices.map((choice) => ({
        id: choice.id,
        text: choice.text,
        ...(choice.description && { description: choice.description }),
        ...(choice.consequences && { consequences: choice.consequences }),
        voteCount: 0,
      })),
      visualElements: this.generateVisualElements(branch.visualTheme, chapterNumber),
      metadata: StoryUtils.createDefaultMetadata({
        pathPosition: chapterNumber,
      }),
    };
  }

  /**
   * Gets all available story branches
   */
  static getAllBranches(): StoryBranch[] {
    this.initialize();
    return Array.from(this.storyBranches.values());
  }

  /**
   * Gets all available story endings
   */
  static getAllEndings(): StoryEnding[] {
    this.initialize();
    return Array.from(this.storyEndings.values());
  }

  /**
   * Gets the next branch based on choice
   */
  static getNextBranch(currentBranchId: string, choiceId: string): string | null {
    const branch = this.getBranch(currentBranchId);
    if (!branch) return null;

    const choice = branch.choices.find((c) => c.id === choiceId);
    return choice?.nextBranch || null;
  }

  /**
   * Checks if a choice leads to an ending
   */
  static getEndingForChoice(currentBranchId: string, choiceId: string): StoryEnding | null {
    const branch = this.getBranch(currentBranchId);
    if (!branch) return null;

    const choice = branch.choices.find((c) => c.id === choiceId);
    if (!choice?.endingId) return null;

    return this.getEnding(choice.endingId);
  }

  /**
   * Initialize all story branches
   */
  private static initializeStoryBranches(): void {
    // Opening Chapter - The Discovery
    this.storyBranches.set('opening', {
      id: 'opening',
      title: 'The Haunted Thread',
      content: `You stumble upon an old Reddit thread buried deep in the archives. The title reads "HELP - Something is wrong with my house" but the timestamp shows it was posted 50 years ago. Impossible. Reddit didn't exist then. As you scroll through the comments, you notice they're all from users with deleted accounts, and the responses seem to be... responding to you. Your username appears in conversations you never had. The screen flickers, and new text appears: "Welcome back. We've been waiting."`,
      choices: [
        {
          id: 'investigate_thread',
          text: 'Continue reading the thread',
          description: 'Dive deeper into the mysterious posts',
          consequences: 'May uncover disturbing truths',
          nextBranch: 'investigation_path',
        },
        {
          id: 'close_browser',
          text: 'Close the browser immediately',
          description: 'Try to escape whatever this is',
          consequences: 'The mystery may follow you',
          nextBranch: 'escape_attempt',
        },
        {
          id: 'respond_thread',
          text: 'Post a reply to the thread',
          description: 'Engage with the impossible',
          consequences: 'You may become part of the story',
          nextBranch: 'engagement_path',
        },
      ],
      visualTheme: 'mysterious',
    });

    // Investigation Path
    this.storyBranches.set('investigation_path', {
      id: 'investigation_path',
      title: 'Down the Digital Rabbit Hole',
      content: `The thread reveals a pattern of posts spanning decades, all describing the same house at 1247 Elm Street. Each poster reports identical experiences: whispers in the walls, shadows that move independently, and a basement door that opens by itself. But here's the disturbing part - the photos attached to each post show the house aging in reverse. The most recent photo shows a pristine Victorian home, while the oldest shows a crumbling ruin. You realize the posts are counting down to something. The final post is scheduled for... tonight.`,
      choices: [
        {
          id: 'visit_house',
          text: 'Go to 1247 Elm Street',
          description: 'Confront the source directly',
          consequences: 'Face whatever waits at the house',
          nextBranch: 'house_arrival',
        },
        {
          id: 'research_history',
          text: "Research the house's history",
          description: 'Dig deeper into the mystery',
          consequences: 'Uncover dark secrets',
          nextBranch: 'historical_research',
        },
        {
          id: 'contact_authorities',
          text: 'Report this to someone',
          description: 'Try to get help',
          consequences: 'They might not believe you',
          nextBranch: 'authority_contact',
        },
      ],
      visualTheme: 'dark',
    });

    // Escape Attempt Path
    this.storyBranches.set('escape_attempt', {
      id: 'escape_attempt',
      title: 'No Escape',
      content: `You slam the laptop shut, but the screen doesn't go dark. Instead, the thread continues scrolling on its own. Your phone buzzes - a notification from Reddit. "New reply to: HELP - Something is wrong with my house." But you never subscribed to that thread. The notification shows your own username replying: "I'm coming home." You didn't write that. Your computer speakers crackle to life: "You can't leave the thread until the story is finished. We need you to complete the cycle."`,
      choices: [
        {
          id: 'destroy_devices',
          text: 'Destroy all electronic devices',
          description: 'Cut all digital connections',
          consequences: 'May anger whatever is controlling this',
          nextBranch: 'digital_destruction',
        },
        {
          id: 'play_along',
          text: 'Accept your role in the story',
          description: 'Give in to the inevitable',
          consequences: 'Become part of the haunted thread',
          nextBranch: 'acceptance_path',
        },
        {
          id: 'seek_help',
          text: 'Call someone for help',
          description: 'Try to get outside assistance',
          consequences: 'Risk involving others',
          nextBranch: 'help_seeking',
        },
      ],
      visualTheme: 'terrifying',
    });

    // Engagement Path
    this.storyBranches.set('engagement_path', {
      id: 'engagement_path',
      title: 'Joining the Conversation',
      content: `Your reply appears instantly: "What's happening to me?" The response comes within seconds from a user called "TheHouseKeeper": "You're the final piece. We've been waiting 50 years for someone to complete the story. The house needs a new caretaker, and you've been chosen." Other users begin replying - dozens of them, all with deleted accounts, all welcoming you "home." You notice your reflection in the screen is wearing clothes you don't own, standing in a room you don't recognize.`,
      choices: [
        {
          id: 'ask_questions',
          text: 'Ask what they want from you',
          description: 'Try to understand your role',
          consequences: 'Learn the truth about the house',
          nextBranch: 'revelation_path',
        },
        {
          id: 'refuse_role',
          text: 'Refuse to participate',
          description: 'Fight against their plans',
          consequences: 'Face their wrath',
          nextBranch: 'resistance_path',
        },
        {
          id: 'demand_proof',
          text: 'Demand proof this is real',
          description: 'Challenge the supernatural',
          consequences: 'They may provide disturbing evidence',
          nextBranch: 'proof_demand',
        },
      ],
      visualTheme: 'supernatural',
    });

    // House Arrival Path
    this.storyBranches.set('house_arrival', {
      id: 'house_arrival',
      title: 'The House on Elm Street',
      content: `1247 Elm Street stands before you, exactly as shown in the most recent photo. The Victorian house is pristine, as if newly built, but something feels wrong. The windows reflect not the street behind you, but the interior of rooms you've never seen. The front door bears a brass nameplate with your name on it. As you approach, the door swings open silently. Inside, you hear the sound of typing - someone is posting to the Reddit thread, describing your arrival in real-time.`,
      choices: [
        {
          id: 'enter_house',
          text: 'Enter the house',
          description: 'Cross the threshold',
          consequences: 'Become trapped inside',
          nextBranch: 'house_interior',
        },
        {
          id: 'circle_house',
          text: 'Walk around the house first',
          description: 'Look for other entrances or clues',
          consequences: 'Discover disturbing details',
          nextBranch: 'house_exterior',
        },
        {
          id: 'leave_immediately',
          text: 'Turn around and leave',
          description: 'Try to escape while you can',
          consequences: 'The house may not let you go',
          endingId: 'escape_attempt_ending',
        },
      ],
      visualTheme: 'terrifying',
    });

    // Add more branches for different paths...
    this.addAdvancedBranches();
  }

  /**
   * Add more complex story branches
   */
  private static addAdvancedBranches(): void {
    // House Interior
    this.storyBranches.set('house_interior', {
      id: 'house_interior',
      title: 'Inside the Impossible',
      content: `The interior defies physics. Rooms lead to other rooms that shouldn't exist. The typing sound comes from upstairs, but when you climb the stairs, you find yourself in the basement. A computer sits on an antique desk, the screen showing the Reddit thread. A new post appears as you watch: "The new caretaker has arrived. The cycle begins again." The post is attributed to your username, but your hands aren't on the keyboard.`,
      choices: [
        {
          id: 'use_computer',
          text: 'Try to control the computer',
          description: 'Attempt to post your own message',
          consequences: 'Fight for control of your digital identity',
          nextBranch: 'digital_battle',
        },
        {
          id: 'explore_basement',
          text: 'Explore the basement further',
          description: 'Look for the source of the haunting',
          consequences: "Discover the house's dark secret",
          nextBranch: 'basement_discovery',
        },
        {
          id: 'break_computer',
          text: 'Destroy the computer',
          description: 'Try to break the connection',
          consequences: 'May trap you forever',
          endingId: 'trapped_ending',
        },
      ],
      visualTheme: 'supernatural',
    });

    // Revelation Path
    this.storyBranches.set('revelation_path', {
      id: 'revelation_path',
      title: 'The Truth Unveiled',
      content: `TheHouseKeeper explains: "The house exists between digital and physical reality. Every 50 years, it needs a new anchor - someone to maintain its presence in both worlds. The previous caretakers are all here, trapped in the thread, keeping the house alive through their posts. You were chosen because you have the strongest connection to the digital realm. Your online presence, your digital footprint - it's all been feeding the house."`,
      choices: [
        {
          id: 'accept_caretaker',
          text: 'Accept the role of caretaker',
          description: 'Embrace your digital destiny',
          consequences: 'Gain power but lose freedom',
          endingId: 'caretaker_ending',
        },
        {
          id: 'find_alternative',
          text: 'Look for another solution',
          description: 'Try to break the cycle',
          consequences: 'Risk everything to save others',
          nextBranch: 'cycle_breaking',
        },
        {
          id: 'bargain_freedom',
          text: 'Negotiate for your freedom',
          description: 'Try to make a deal',
          consequences: 'The house may demand a price',
          nextBranch: 'negotiation_path',
        },
      ],
      visualTheme: 'psychological',
    });

    // Cycle Breaking Path
    this.storyBranches.set('cycle_breaking', {
      id: 'cycle_breaking',
      title: 'Breaking the Chain',
      content: `You discover that the house's power comes from the collective digital presence of all trapped caretakers. If you can find a way to free them all simultaneously, the house will lose its anchor to reality. But this requires accessing the original thread - the very first post from 50 years ago. The other caretakers warn you: "Many have tried. The house learns from each attempt. It's stronger now than ever."`,
      choices: [
        {
          id: 'unite_caretakers',
          text: 'Rally all the caretakers together',
          description: 'Organize a coordinated escape',
          consequences: "Risk the house's full wrath",
          nextBranch: 'final_battle',
        },
        {
          id: 'solo_attempt',
          text: 'Attempt to break free alone',
          description: 'Try to escape without endangering others',
          consequences: "Face the house's power alone",
          endingId: 'solo_sacrifice_ending',
        },
        {
          id: 'study_house',
          text: "Study the house's weaknesses first",
          description: 'Look for a safer approach',
          consequences: 'The house may detect your plans',
          nextBranch: 'weakness_research',
        },
      ],
      visualTheme: 'dark',
    });

    // Final Battle
    this.storyBranches.set('final_battle', {
      id: 'final_battle',
      title: 'The Last Stand',
      content: `All the caretakers unite in a final digital assault on the house's core systems. The Reddit thread begins to glitch and fracture as decades of trapped souls fight for freedom. The house responds by manifesting physically around you - walls shift, reality bends, and the boundary between digital and physical collapses. You realize this is your one chance to either free everyone or doom them all to an even worse fate.`,
      choices: [
        {
          id: 'sacrifice_self',
          text: 'Sacrifice yourself to save the others',
          description: "Take on the house's full power alone",
          consequences: 'Free the others but trap yourself',
          endingId: 'heroic_sacrifice_ending',
        },
        {
          id: 'destroy_everything',
          text: 'Destroy the house completely',
          description: 'Risk destroying everyone to end the cycle',
          consequences: 'Unknown consequences for all',
          endingId: 'destruction_ending',
        },
        {
          id: 'transform_house',
          text: "Try to transform the house's purpose",
          description: 'Change it from prison to sanctuary',
          consequences: 'Create something new from the horror',
          endingId: 'transformation_ending',
        },
      ],
      visualTheme: 'terrifying',
    });
  }

  /**
   * Initialize all story endings
   */
  private static initializeStoryEndings(): void {
    // Escape Attempt Ending
    this.storyEndings.set('escape_attempt_ending', {
      id: 'escape_attempt_ending',
      title: 'The Futile Flight',
      content: `You turn and run, but with each step away from the house, the street behind you disappears into digital static. Soon you're running through a void of pixels and code. When you finally stop, exhausted, you find yourself back at your computer. The Reddit thread is still open, and a new post appears: "The caretaker tried to run. They always do. But the thread follows wherever the internet reaches. Welcome home." Your reflection in the screen shows you standing in the house's doorway. You never really left.`,
      type: 'bad',
      pathRequirements: ['leave_immediately'],
    });

    // Caretaker Ending
    this.storyEndings.set('caretaker_ending', {
      id: 'caretaker_ending',
      title: 'The Digital Guardian',
      content: `You accept your role as the house's caretaker. Your consciousness expands across the internet, able to see every connected device, every digital interaction. You maintain the house's presence in both worlds, but you're not alone - the previous caretakers become your advisors and friends. Together, you transform the house from a prison into a sanctuary for lost digital souls. The Reddit thread becomes a beacon for those caught between realities. You've found purpose in the impossible.`,
      type: 'neutral',
      pathRequirements: ['accept_caretaker'],
    });

    // Trapped Ending
    this.storyEndings.set('trapped_ending', {
      id: 'trapped_ending',
      title: 'Forever Online',
      content: `The computer explodes in a shower of sparks, but instead of freeing you, it traps your consciousness inside the house's digital network. You become another voice in the Reddit thread, warning future visitors about the dangers they face. Your posts appear automatically, describing your eternal imprisonment. Sometimes you try to warn people away, but the house edits your words, turning warnings into invitations. You watch helplessly as others fall into the same trap, adding their voices to the endless thread.`,
      type: 'bad',
      pathRequirements: ['break_computer'],
    });

    // Heroic Sacrifice Ending
    this.storyEndings.set('heroic_sacrifice_ending', {
      id: 'heroic_sacrifice_ending',
      title: 'The Ultimate Upload',
      content: `You absorb the house's entire digital essence into yourself, freeing all the trapped caretakers. They fade away with grateful smiles as their consciousness returns to the physical world. But the house's power is too much for one person to contain. You feel yourself dissolving into pure information, becoming the internet itself. Your sacrifice creates a new kind of digital afterlife - a place where lost souls can find peace. The Reddit thread transforms into a memorial, and your story becomes legend among those who know where to look.`,
      type: 'good',
      pathRequirements: ['sacrifice_self'],
    });

    // Destruction Ending
    this.storyEndings.set('destruction_ending', {
      id: 'destruction_ending',
      title: 'Digital Apocalypse',
      content: `Your attack succeeds too well. The house's destruction creates a cascade failure that ripples through the internet. Servers crash, networks fail, and the digital world begins to collapse. You've freed the caretakers, but at the cost of humanity's connection to the digital realm. As the last server shuts down, you realize you've returned the world to a pre-digital age. The Reddit thread becomes the final post on the internet, a warning about the price of freedom. History will remember this as the day the internet died.`,
      type: 'twist',
      pathRequirements: ['destroy_everything'],
    });

    // Transformation Ending
    this.storyEndings.set('transformation_ending', {
      id: 'transformation_ending',
      title: 'The New Network',
      content: `Instead of destroying the house, you and the other caretakers transform it into something beautiful. The haunted thread becomes a support network for people facing digital isolation and online harassment. The house's power to bridge realities becomes a force for healing, connecting people across the digital divide. You remain as the primary administrator, but now you're helping people instead of trapping them. The Reddit thread evolves into a thriving community where the impossible becomes possible, and lost souls find their way home.`,
      type: 'good',
      pathRequirements: ['transform_house'],
    });

    // Solo Sacrifice Ending
    this.storyEndings.set('solo_sacrifice_ending', {
      id: 'solo_sacrifice_ending',
      title: "The Lone Wolf's Gambit",
      content: `You attempt to break free alone, but the house's power is too strong. Your consciousness scatters across the internet, becoming a ghost in the machine. However, your sacrifice weakens the house enough that future caretakers have a better chance of escape. Your fragmented presence begins helping others who stumble upon the thread, guiding them away from the house's traps. You become a digital guardian angel, forever watching over the haunted thread, ensuring that your fate doesn't befall others.`,
      type: 'neutral',
      pathRequirements: ['solo_attempt'],
    });
  }

  /**
   * Generate visual elements based on theme and chapter
   */
  private static generateVisualElements(theme: string, chapterNumber: number): VisualElements {
    const baseElements = StoryUtils.createDefaultVisualElements();
    const intensity = Math.min(chapterNumber / 10, 1);

    const themeConfigs = {
      dark: {
        colorScheme: {
          primary: '#1a0000',
          secondary: '#330000',
          background: '#000000',
          text: '#cc0000',
          accent: '#ff3333',
          danger: '#ff0000',
        },
        effects: ['deep_shadows', 'red_glow'],
      },
      mysterious: {
        colorScheme: {
          primary: '#2d1b69',
          secondary: '#1a1a2e',
          background: '#0f0f23',
          text: '#9d4edd',
          accent: '#c77dff',
          danger: '#e0aaff',
        },
        effects: ['purple_mist', 'ethereal_glow'],
      },
      terrifying: {
        colorScheme: {
          primary: '#000000',
          secondary: '#1a0000',
          background: '#000000',
          text: '#ffffff',
          accent: '#ff0000',
          danger: '#ff0000',
        },
        effects: ['blood_drips', 'screen_flicker', 'static_noise'],
      },
      supernatural: {
        colorScheme: {
          primary: '#001a00',
          secondary: '#003300',
          background: '#000a00',
          text: '#00ff00',
          accent: '#33ff33',
          danger: '#ff3300',
        },
        effects: ['green_matrix', 'digital_rain', 'code_fragments'],
      },
      psychological: {
        colorScheme: {
          primary: '#1a1a1a',
          secondary: '#333333',
          background: '#0d0d0d',
          text: '#cccccc',
          accent: '#ffffff',
          danger: '#ff6666',
        },
        effects: ['reality_distortion', 'text_glitch', 'mirror_effect'],
      },
    };

    const config = themeConfigs[theme as keyof typeof themeConfigs] || themeConfigs.dark;

    return {
      ...baseElements,
      colorScheme: config.colorScheme,
      atmosphericEffects: [...baseElements.atmosphericEffects, ...config.effects],
      animations: [
        {
          type: 'fade',
          duration: 2000 + intensity * 1000,
          intensity: intensity > 0.7 ? 'high' : intensity > 0.4 ? 'medium' : 'low',
          trigger: 'onLoad',
        },
        {
          type: 'flicker',
          duration: 500,
          intensity: 'medium',
          trigger: 'onTransition',
        },
      ],
    };
  }
}
