/**
 * Administrative controls and moderation features for The Haunted Thread
 * Handles story management, content moderation, and engagement tracking
 */

import { redis } from '@devvit/web/server';
import { StoryStateManager } from './story-state-manager.js';
import { VotingManager } from './voting-manager.js';
import { StoryProgressionEngine } from './story-progression-engine.js';
import { RealtimeManager } from './realtime-manager.js';
import { StoryChapter } from '../../shared/types/story.js';
import { VotingStats } from '../../shared/types/voting.js';

export interface AdminStats {
  totalChapters: number;
  totalVotes: number;
  uniqueParticipants: number;
  averageVotesPerChapter: number;
  storyDuration: number;
  currentEngagement: number;
  storyStartTime?: Date;
  currentChapter?: string;
  votingActive: boolean;
}

export interface ModerationReport {
  id: string;
  type: 'chapter' | 'choice' | 'story';
  targetId: string;
  reason: string;
  reportedAt: Date;
  status: 'pending' | 'resolved' | 'dismissed';
  moderatedBy?: string;
  moderatedAt?: Date;
}

export class AdminManager {
  private static readonly ADMIN_PREFIX = 'haunted_thread:admin';
  private static readonly MODERATION_PREFIX = 'haunted_thread:moderation';

  
  // Simple admin key validation (in production, use proper authentication)
  private static readonly ADMIN_KEY = process.env.HAUNTED_THREAD_ADMIN_KEY || 'dev-admin-key';

  /**
   * Validates admin authentication
   */
  static validateAdminKey(providedKey: string): boolean {
    return providedKey === this.ADMIN_KEY;
  }

  /**
   * Manually advances story to next chapter
   */
  static async advanceStory(
    postId: string,
    adminKey: string,
    forceChoice?: string,
    reason?: string
  ): Promise<{
    success: boolean;
    newChapter?: StoryChapter;
    previousStats?: VotingStats;
    error?: string;
  }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      const currentChapter = await StoryStateManager.getCurrentChapter(postId);
      if (!currentChapter) {
        return { success: false, error: 'No current chapter found' };
      }

      // Get voting stats before advancing
      const previousStats = await VotingManager.getVotingStats(postId, currentChapter.id);

      // Determine winning choice
      let winningChoice: string;
      if (forceChoice) {
        // Validate forced choice exists
        const validChoice = currentChapter.choices.find(c => c.id === forceChoice);
        if (!validChoice) {
          return { success: false, error: 'Invalid forced choice ID' };
        }
        winningChoice = forceChoice;
      } else {
        // Get winning choice from votes
        const winner = await VotingManager.getWinningChoice(postId, currentChapter.id);
        if (!winner) {
          return { success: false, error: 'No votes found to determine winner' };
        }
        winningChoice = winner;
      }

      // Generate next chapter
      const progressionEngine = new StoryProgressionEngine();
      const progressionResult = await progressionEngine.advanceStory(
        postId,
        currentChapter.id,
        winningChoice
      );

      if (!progressionResult.success || !progressionResult.newChapter) {
        return { success: false, error: progressionResult.error || 'Failed to generate next chapter' };
      }

      const nextChapter = progressionResult.newChapter;

      // End current voting session
      await VotingManager.endVotingSession(postId, currentChapter.id);

      // Update story state
      await StoryStateManager.storeChapter(postId, nextChapter);
      await StoryStateManager.setCurrentChapter(postId, nextChapter.id);
      await StoryStateManager.addToHistory(postId, currentChapter.id, winningChoice);

      // Update story context
      await StoryStateManager.updateStoryContext(postId, nextChapter.id, winningChoice);

      // Create voting session for new chapter
      const choices = nextChapter.choices.map((choice: any) => ({
        choiceId: choice.id,
        text: choice.text
      }));
      await VotingManager.createVotingSession(postId, nextChapter.id, choices);

      // Log admin action
      await this.logAdminAction(postId, 'advance_story', {
        previousChapter: currentChapter.id,
        newChapter: nextChapter.id,
        winningChoice,
        forceChoice: !!forceChoice,
        reason: reason || 'Manual advancement'
      });

      // Broadcast chapter transition
      const statsToUse = previousStats || { 
        totalVotes: 0, 
        uniqueVoters: 0, 
        votingDuration: 0,
        winningChoice: winningChoice,
        winningPercentage: 0
      };
      await RealtimeManager.broadcastChapterTransition(
        postId,
        nextChapter,
        winningChoice,
        statsToUse
      );

      const returnResult: {
        success: boolean;
        newChapter?: StoryChapter;
        previousStats?: VotingStats;
        error?: string;
      } = {
        success: true,
        newChapter: nextChapter
      };
      
      if (previousStats) {
        returnResult.previousStats = previousStats;
      }
      
      return returnResult;

    } catch (error) {
      console.error('Error advancing story:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resets story to beginning
   */
  static async resetStory(
    postId: string,
    adminKey: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      // Clear all story data
      await StoryStateManager.resetStory(postId);
      await VotingManager.clearStoryVotes(postId);

      // Initialize with first chapter
      const initialChapter: StoryChapter = {
        id: 'chapter-1',
        title: 'The Haunted Thread Begins',
        content: `Welcome to The Haunted Thread, a community-driven horror experience where your choices shape the nightmare...

You find yourself standing at the entrance of an abandoned mansion on a moonless night. The wind howls through the bare trees, and shadows dance in the corners of your vision. The front door creaks open slightly, as if inviting you inside.

What do you choose to do?`,
        choices: [
          {
            id: 'choice-1',
            text: 'Enter the mansion through the front door',
            description: 'Walk boldly through the main entrance',
            voteCount: 0
          },
          {
            id: 'choice-2', 
            text: 'Sneak around to find a back entrance',
            description: 'Look for a more discreet way inside',
            voteCount: 0
          },
          {
            id: 'choice-3',
            text: 'Turn around and leave immediately',
            description: 'This place gives you a bad feeling',
            voteCount: 0
          }
        ],
        visualElements: {
          atmosphericEffects: ['fog', 'shadows'],
          colorScheme: {
            primary: '#8B0000',
            secondary: '#2F2F2F',
            background: '#0D0D0D',
            text: '#E0E0E0',
            accent: '#FF6B6B',
            danger: '#FF0000'
          },
          typography: {
            fontFamily: 'serif',
            headingFont: 'Georgia, serif',
            bodyFont: 'Times New Roman, serif',
            fontSize: {
              small: '0.875rem',
              medium: '1rem',
              large: '1.25rem',
              xlarge: '1.5rem'
            }
          },
          animations: []
        },
        metadata: {
          createdAt: new Date(),
          votingStartTime: new Date(),
          totalVotes: 0,
          status: 'active' as const,
          pathPosition: 0
        }
      };

      await StoryStateManager.initializeStory(postId, initialChapter);

      // Create initial voting session
      const choices = initialChapter.choices.map(choice => ({
        choiceId: choice.id,
        text: choice.text
      }));
      await VotingManager.createVotingSession(postId, initialChapter.id, choices);

      // Log admin action
      await this.logAdminAction(postId, 'reset_story', {
        reason: reason || 'Manual reset'
      });

      // Broadcast story reset
      await RealtimeManager.broadcastStoryReset(postId, reason || 'Story reset by administrator', initialChapter);

      return { success: true };

    } catch (error) {
      console.error('Error resetting story:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets comprehensive story statistics
   */
  static async getStoryStats(postId: string, adminKey: string): Promise<{
    success: boolean;
    stats?: AdminStats;
    error?: string;
  }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      const [storyStats, context, currentChapter] = await Promise.all([
        StoryStateManager.getStoryStats(postId),
        StoryStateManager.getStoryContext(postId),
        StoryStateManager.getCurrentChapter(postId)
      ]);

      // Get voting statistics for current chapter
      let currentVotingStats = null;
      let votingActive = false;
      if (currentChapter) {
        currentVotingStats = await VotingManager.getVotingStats(postId, currentChapter.id);
        const session = await VotingManager.getVotingSession(postId, currentChapter.id);
        votingActive = session?.status === 'active';
      }

      // Calculate engagement metrics
      const currentEngagement = currentVotingStats?.totalVotes || 0;
      const averageVotesPerChapter = storyStats.totalChapters > 0 
        ? Math.round(currentEngagement / storyStats.totalChapters) 
        : 0;

      const stats: AdminStats = {
        totalChapters: storyStats.totalChapters,
        totalVotes: currentVotingStats?.totalVotes || 0,
        uniqueParticipants: currentVotingStats?.uniqueVoters || 0,
        averageVotesPerChapter,
        storyDuration: storyStats.storyAge,
        currentEngagement,
        ...(context?.storyStartTime && { storyStartTime: context.storyStartTime }),
        ...(storyStats.currentChapter && { currentChapter: storyStats.currentChapter }),
        votingActive
      };

      return { success: true, stats };

    } catch (error) {
      console.error('Error getting story stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Flags content for moderation
   */
  static async flagContent(
    postId: string,
    adminKey: string,
    targetType: 'chapter' | 'choice' | 'story',
    targetId: string,
    reason: string
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const report: ModerationReport = {
        id: reportId,
        type: targetType,
        targetId,
        reason,
        reportedAt: new Date(),
        status: 'pending'
      };

      const reportKey = `${this.MODERATION_PREFIX}:${postId}:reports:${reportId}`;
      await redis.set(reportKey, JSON.stringify({
        ...report,
        reportedAt: report.reportedAt.toISOString()
      }));
      await redis.expire(reportKey, 86400 * 7); // 7 days TTL

      // Add to reports index
      const reportsIndexKey = `${this.MODERATION_PREFIX}:${postId}:reports_index`;
      await redis.hSet(reportsIndexKey, { [reportId]: targetType });
      await redis.expire(reportsIndexKey, 86400 * 7);

      // Log admin action
      await this.logAdminAction(postId, 'flag_content', {
        reportId,
        targetType,
        targetId,
        reason
      });

      return { success: true, reportId };

    } catch (error) {
      console.error('Error flagging content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resolves a moderation report
   */
  static async resolveReport(
    postId: string,
    adminKey: string,
    reportId: string,
    action: 'approve' | 'remove' | 'dismiss',
    moderatorId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      const reportKey = `${this.MODERATION_PREFIX}:${postId}:reports:${reportId}`;
      const reportData = await redis.get(reportKey);
      
      if (!reportData) {
        return { success: false, error: 'Report not found' };
      }

      const report = JSON.parse(reportData);
      const updatedReport: ModerationReport = {
        ...report,
        reportedAt: new Date(report.reportedAt),
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        moderatedBy: moderatorId,
        moderatedAt: new Date()
      };

      await redis.set(reportKey, JSON.stringify({
        ...updatedReport,
        reportedAt: updatedReport.reportedAt.toISOString(),
        moderatedAt: updatedReport.moderatedAt?.toISOString()
      }));

      // Log admin action
      await this.logAdminAction(postId, 'resolve_report', {
        reportId,
        action,
        moderatorId
      });

      return { success: true };

    } catch (error) {
      console.error('Error resolving report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets moderation statistics
   */
  static async getModerationStats(postId: string, adminKey: string): Promise<{
    success: boolean;
    stats?: {
      totalReports: number;
      pendingReports: number;
      resolvedReports: number;
      flaggedContent: ModerationReport[];
    };
    error?: string;
  }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      const reportsIndexKey = `${this.MODERATION_PREFIX}:${postId}:reports_index`;
      const reportsIndex = await redis.hGetAll(reportsIndexKey);
      const reportIds = Object.keys(reportsIndex);

      const reports: ModerationReport[] = [];
      let pendingCount = 0;
      let resolvedCount = 0;

      for (const reportId of reportIds) {
        const reportKey = `${this.MODERATION_PREFIX}:${postId}:reports:${reportId}`;
        const reportData = await redis.get(reportKey);
        
        if (reportData) {
          try {
            const report = JSON.parse(reportData);
            const parsedReport: ModerationReport = {
              ...report,
              reportedAt: new Date(report.reportedAt),
              moderatedAt: report.moderatedAt ? new Date(report.moderatedAt) : undefined
            };
            
            reports.push(parsedReport);
            
            if (parsedReport.status === 'pending') {
              pendingCount++;
            } else {
              resolvedCount++;
            }
          } catch (error) {
            console.error('Error parsing report data:', error);
          }
        }
      }

      return {
        success: true,
        stats: {
          totalReports: reports.length,
          pendingReports: pendingCount,
          resolvedReports: resolvedCount,
          flaggedContent: reports.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())
        }
      };

    } catch (error) {
      console.error('Error getting moderation stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Logs administrative actions for audit trail
   */
  private static async logAdminAction(
    postId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const logKey = `${this.ADMIN_PREFIX}:${postId}:actions`;
      const timestamp = Date.now().toString();
      
      const logEntry = {
        action,
        timestamp: new Date().toISOString(),
        details
      };

      await redis.hSet(logKey, { [timestamp]: JSON.stringify(logEntry) });
      await redis.expire(logKey, 86400 * 30); // 30 days TTL
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }

  /**
   * Gets admin action logs
   */
  static async getAdminLogs(postId: string, adminKey: string): Promise<{
    success: boolean;
    logs?: Array<{
      action: string;
      timestamp: Date;
      details: Record<string, any>;
    }>;
    error?: string;
  }> {
    if (!this.validateAdminKey(adminKey)) {
      return { success: false, error: 'Invalid admin credentials' };
    }

    try {
      const logKey = `${this.ADMIN_PREFIX}:${postId}:actions`;
      const logsData = await redis.hGetAll(logKey);
      
      const logs = Object.entries(logsData)
        .map(([, logJson]) => {
          try {
            const log = JSON.parse(logJson);
            return {
              ...log,
              timestamp: new Date(log.timestamp)
            };
          } catch (error) {
            console.error('Error parsing log entry:', error);
            return null;
          }
        })
        .filter(log => log !== null)
        .sort((a, b) => b!.timestamp.getTime() - a!.timestamp.getTime());

      return { success: true, logs };

    } catch (error) {
      console.error('Error getting admin logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
