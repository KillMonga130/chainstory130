/**
 * Content moderation and filtering system for The Haunted Thread
 * Implements basic content filtering, inappropriate content detection, and moderation workflows
 */

import { redis } from '@devvit/web/server';
import { StoryChapter, StoryChoice } from '../../shared/types/story.js';

export interface ContentFilter {
  type: 'profanity' | 'violence' | 'sexual' | 'harassment' | 'spam' | 'custom';
  pattern: string | RegExp;
  severity: 'low' | 'medium' | 'high';
  action: 'flag' | 'block' | 'replace';
  replacement?: string;
}

export interface ModerationResult {
  isClean: boolean;
  violations: Array<{
    type: string;
    severity: string;
    match: string;
    action: string;
    position?: number;
  }>;
  filteredContent?: string | undefined;
  requiresReview: boolean;
}

export interface ContentReport {
  id: string;
  contentType: 'chapter' | 'choice' | 'story';
  contentId: string;
  reportedBy: string;
  reason: string;
  description?: string | undefined;
  reportedAt: Date;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  moderatorNotes?: string | undefined;
  resolvedAt?: Date | undefined;
  resolvedBy?: string | undefined;
}

export class ContentModerator {
  private static readonly MODERATION_PREFIX = 'haunted_thread:moderation';
  private static readonly FILTER_PREFIX = 'haunted_thread:filters';
  private static readonly REPORT_PREFIX = 'haunted_thread:reports';

  // Basic content filters for horror-themed content
  private static readonly DEFAULT_FILTERS: ContentFilter[] = [
    // Profanity filters
    {
      type: 'profanity',
      pattern: /\b(fuck|shit|damn|hell|ass|bitch|bastard)\b/gi,
      severity: 'low',
      action: 'replace',
      replacement: '[censored]'
    },
    {
      type: 'profanity',
      pattern: /\b(motherfucker|cocksucker|asshole|dickhead)\b/gi,
      severity: 'medium',
      action: 'flag'
    },
    
    // Excessive violence (beyond horror theme)
    {
      type: 'violence',
      pattern: /\b(torture|mutilate|dismember|eviscerate|disembowel)\b/gi,
      severity: 'high',
      action: 'flag'
    },
    {
      type: 'violence',
      pattern: /\b(graphic violence|extreme gore|brutal murder)\b/gi,
      severity: 'high',
      action: 'block'
    },
    
    // Sexual content (not appropriate for horror story)
    {
      type: 'sexual',
      pattern: /\b(porn|sex|nude|naked|erotic|sexual)\b/gi,
      severity: 'medium',
      action: 'flag'
    },
    {
      type: 'sexual',
      pattern: /\b(explicit sexual|graphic sexual|sexual violence)\b/gi,
      severity: 'high',
      action: 'block'
    },
    
    // Harassment and hate speech
    {
      type: 'harassment',
      pattern: /\b(kill yourself|kys|die|hate you)\b/gi,
      severity: 'high',
      action: 'block'
    },
    
    // Spam patterns
    {
      type: 'spam',
      pattern: /\b(buy now|click here|visit our|www\.|http|\.com)\b/gi,
      severity: 'medium',
      action: 'flag'
    },
    {
      type: 'spam',
      pattern: /(.)\1{10,}/g, // Repeated characters (10+ times)
      severity: 'low',
      action: 'flag'
    }
  ];

  /**
   * Moderates story chapter content
   */
  static async moderateChapter(chapter: StoryChapter): Promise<ModerationResult> {
    const contentToCheck = `${chapter.title} ${chapter.content}`;
    const result = await this.moderateText(contentToCheck);
    
    // Check choices as well
    for (const choice of chapter.choices) {
      const choiceResult = await this.moderateChoice(choice);
      if (!choiceResult.isClean) {
        result.isClean = false;
        result.violations.push(...choiceResult.violations);
        result.requiresReview = result.requiresReview || choiceResult.requiresReview;
      }
    }
    
    return result;
  }

  /**
   * Moderates story choice content
   */
  static async moderateChoice(choice: StoryChoice): Promise<ModerationResult> {
    const contentToCheck = `${choice.text} ${choice.description || ''}`;
    return this.moderateText(contentToCheck);
  }

  /**
   * Moderates arbitrary text content
   */
  static async moderateText(text: string): Promise<ModerationResult> {
    const violations: ModerationResult['violations'] = [];
    let filteredContent = text;
    let requiresReview = false;

    // Get custom filters from Redis
    const customFilters = await this.getCustomFilters();
    const allFilters = [...this.DEFAULT_FILTERS, ...customFilters];

    for (const filter of allFilters) {
      const pattern = typeof filter.pattern === 'string' 
        ? new RegExp(filter.pattern, 'gi') 
        : filter.pattern;

      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: filter.type,
            severity: filter.severity,
            match: match,
            action: filter.action,
            position: text.indexOf(match)
          });

          // Apply filter action
          switch (filter.action) {
            case 'replace':
              if (filter.replacement) {
                filteredContent = filteredContent.replace(pattern, filter.replacement);
              }
              break;
            case 'flag':
              requiresReview = true;
              break;
            case 'block':
              requiresReview = true;
              break;
          }
        }
      }
    }

    // Determine if content should be blocked entirely
    const hasHighSeverityViolations = violations.some(v => v.severity === 'high');
    const hasBlockingViolations = violations.some(v => v.action === 'block');

    return {
      isClean: violations.length === 0,
      violations,
      filteredContent: violations.length > 0 ? filteredContent : undefined,
      requiresReview: requiresReview || hasHighSeverityViolations || hasBlockingViolations
    };
  }

  /**
   * Reports inappropriate content
   */
  static async reportContent(
    postId: string,
    contentType: 'chapter' | 'choice' | 'story',
    contentId: string,
    reportedBy: string,
    reason: string,
    description?: string
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const report: ContentReport = {
        id: reportId,
        contentType,
        contentId,
        reportedBy,
        reason,
        description,
        reportedAt: new Date(),
        status: 'pending'
      };

      const reportKey = `${this.REPORT_PREFIX}:${postId}:${reportId}`;
      await redis.set(reportKey, JSON.stringify({
        ...report,
        reportedAt: report.reportedAt.toISOString()
      }));
      await redis.expire(reportKey, 86400 * 30); // 30 days TTL

      // Add to reports index for easy retrieval
      const reportsIndexKey = `${this.REPORT_PREFIX}:${postId}:index`;
      await redis.hSet(reportsIndexKey, { [reportId]: contentType });
      await redis.expire(reportsIndexKey, 86400 * 30);

      // Track report statistics
      await this.updateReportStats(postId, 'new_report', contentType);

      return { success: true, reportId };

    } catch (error) {
      console.error('Error reporting content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets all content reports for a post
   */
  static async getContentReports(postId: string): Promise<ContentReport[]> {
    try {
      const reportsIndexKey = `${this.REPORT_PREFIX}:${postId}:index`;
      const reportsIndex = await redis.hGetAll(reportsIndexKey);
      const reportIds = Object.keys(reportsIndex);

      const reports: ContentReport[] = [];

      for (const reportId of reportIds) {
        const reportKey = `${this.REPORT_PREFIX}:${postId}:${reportId}`;
        const reportData = await redis.get(reportKey);
        
        if (reportData) {
          try {
            const report = JSON.parse(reportData);
            reports.push({
              ...report,
              reportedAt: new Date(report.reportedAt),
              resolvedAt: report.resolvedAt ? new Date(report.resolvedAt) : undefined
            });
          } catch (error) {
            console.error('Error parsing report data:', error);
          }
        }
      }

      // Sort by report date (newest first)
      return reports.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());

    } catch (error) {
      console.error('Error getting content reports:', error);
      return [];
    }
  }

  /**
   * Updates the status of a content report
   */
  static async updateReportStatus(
    postId: string,
    reportId: string,
    status: ContentReport['status'],
    moderatorId: string,
    moderatorNotes?: string | undefined
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const reportKey = `${this.REPORT_PREFIX}:${postId}:${reportId}`;
      const reportData = await redis.get(reportKey);
      
      if (!reportData) {
        return { success: false, error: 'Report not found' };
      }

      const report = JSON.parse(reportData);
      const updatedReport: ContentReport = {
        ...report,
        reportedAt: new Date(report.reportedAt),
        status,
        moderatorNotes,
        resolvedAt: status === 'resolved' || status === 'dismissed' ? new Date() : undefined,
        resolvedBy: moderatorId
      };

      await redis.set(reportKey, JSON.stringify({
        ...updatedReport,
        reportedAt: updatedReport.reportedAt.toISOString(),
        resolvedAt: updatedReport.resolvedAt?.toISOString()
      }));

      // Update report statistics
      await this.updateReportStats(postId, 'status_change', report.contentType, status);

      return { success: true };

    } catch (error) {
      console.error('Error updating report status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Adds a custom content filter
   */
  static async addCustomFilter(
    postId: string,
    filter: Omit<ContentFilter, 'type'> & { type?: ContentFilter['type'] }
  ): Promise<{ success: boolean; filterId?: string; error?: string }> {
    try {
      const filterId = `filter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const customFilter: ContentFilter = {
        type: filter.type || 'custom',
        pattern: filter.pattern,
        severity: filter.severity,
        action: filter.action,
        ...(filter.replacement && { replacement: filter.replacement })
      };

      const filterKey = `${this.FILTER_PREFIX}:${postId}:${filterId}`;
      await redis.set(filterKey, JSON.stringify({
        ...customFilter,
        pattern: customFilter.pattern.toString() // Convert RegExp to string for storage
      }));
      await redis.expire(filterKey, 86400 * 30); // 30 days TTL

      // Add to filters index
      const filtersIndexKey = `${this.FILTER_PREFIX}:${postId}:index`;
      await redis.hSet(filtersIndexKey, { [filterId]: customFilter.type });
      await redis.expire(filtersIndexKey, 86400 * 30);

      return { success: true, filterId };

    } catch (error) {
      console.error('Error adding custom filter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets custom content filters for a post
   */
  static async getCustomFilters(postId?: string): Promise<ContentFilter[]> {
    if (!postId) return [];

    try {
      const filtersIndexKey = `${this.FILTER_PREFIX}:${postId}:index`;
      const filtersIndex = await redis.hGetAll(filtersIndexKey);
      const filterIds = Object.keys(filtersIndex);

      const filters: ContentFilter[] = [];

      for (const filterId of filterIds) {
        const filterKey = `${this.FILTER_PREFIX}:${postId}:${filterId}`;
        const filterData = await redis.get(filterKey);
        
        if (filterData) {
          try {
            const filter = JSON.parse(filterData);
            // Convert string pattern back to RegExp if needed
            if (typeof filter.pattern === 'string' && filter.pattern.startsWith('/')) {
              const match = filter.pattern.match(/^\/(.+)\/([gimuy]*)$/);
              if (match) {
                filter.pattern = new RegExp(match[1], match[2]);
              }
            }
            filters.push(filter);
          } catch (error) {
            console.error('Error parsing filter data:', error);
          }
        }
      }

      return filters;

    } catch (error) {
      console.error('Error getting custom filters:', error);
      return [];
    }
  }

  /**
   * Removes a custom content filter
   */
  static async removeCustomFilter(
    postId: string,
    filterId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const filterKey = `${this.FILTER_PREFIX}:${postId}:${filterId}`;
      const filtersIndexKey = `${this.FILTER_PREFIX}:${postId}:index`;

      await redis.del(filterKey);
      await redis.hDel(filtersIndexKey, [filterId]);

      return { success: true };

    } catch (error) {
      console.error('Error removing custom filter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets moderation statistics
   */
  static async getModerationStats(postId: string): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    dismissedReports: number;
    reportsByType: Record<string, number>;
    reportsByStatus: Record<string, number>;
  }> {
    try {
      const reports = await this.getContentReports(postId);
      
      const stats = {
        totalReports: reports.length,
        pendingReports: 0,
        resolvedReports: 0,
        dismissedReports: 0,
        reportsByType: {} as Record<string, number>,
        reportsByStatus: {} as Record<string, number>
      };

      for (const report of reports) {
        // Count by status
        switch (report.status) {
          case 'pending':
          case 'reviewing':
            stats.pendingReports++;
            break;
          case 'resolved':
            stats.resolvedReports++;
            break;
          case 'dismissed':
            stats.dismissedReports++;
            break;
        }

        // Count by type
        stats.reportsByType[report.contentType] = (stats.reportsByType[report.contentType] || 0) + 1;
        
        // Count by status
        stats.reportsByStatus[report.status] = (stats.reportsByStatus[report.status] || 0) + 1;
      }

      return stats;

    } catch (error) {
      console.error('Error getting moderation stats:', error);
      return {
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        dismissedReports: 0,
        reportsByType: {},
        reportsByStatus: {}
      };
    }
  }

  /**
   * Updates report statistics
   */
  private static async updateReportStats(
    postId: string,
    action: string,
    contentType: string,
    status?: string
  ): Promise<void> {
    try {
      const statsKey = `${this.MODERATION_PREFIX}:${postId}:stats`;
      const timestamp = new Date().toISOString();
      
      const statEntry = {
        action,
        contentType,
        status,
        timestamp
      };

      // Use hash to store stats entries
      const entryKey = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      await redis.hSet(statsKey, { [entryKey]: JSON.stringify(statEntry) });
      await redis.expire(statsKey, 86400 * 30); // 30 days TTL

    } catch (error) {
      console.error('Error updating report stats:', error);
    }
  }

  /**
   * Validates content before allowing it to be posted
   */
  static async validateContent(
    content: string,
    _contentType: 'chapter' | 'choice' | 'story'
  ): Promise<{
    isValid: boolean;
    filteredContent?: string;
    violations: string[];
    requiresApproval: boolean;
  }> {
    const moderationResult = await this.moderateText(content);
    
    const violations = moderationResult.violations.map(v => 
      `${v.type} (${v.severity}): "${v.match}"`
    );

    const hasBlockingViolations = moderationResult.violations.some(v => v.action === 'block');
    const requiresApproval = moderationResult.requiresReview;

    return {
      isValid: !hasBlockingViolations,
      ...(moderationResult.filteredContent && { filteredContent: moderationResult.filteredContent }),
      violations,
      requiresApproval
    };
  }

  /**
   * Gets content that requires moderation review
   */
  static async getContentAwaitingReview(postId: string): Promise<Array<{
    id: string;
    type: 'chapter' | 'choice' | 'story';
    content: string;
    violations: string[];
    reportedAt: Date;
  }>> {
    try {
      const reports = await this.getContentReports(postId);
      const pendingReports = reports.filter(r => r.status === 'pending' || r.status === 'reviewing');

      return pendingReports.map(report => ({
        id: report.contentId,
        type: report.contentType,
        content: report.description || 'No content description available',
        violations: [report.reason],
        reportedAt: report.reportedAt
      }));

    } catch (error) {
      console.error('Error getting content awaiting review:', error);
      return [];
    }
  }
}
