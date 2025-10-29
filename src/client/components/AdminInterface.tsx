/**
 * Administrative interface for The Haunted Thread
 * Provides content moderation, story management, and administrative controls
 */

import React, { useState, useEffect } from 'react';
import {
  GetStoryStatsResponse,
  GetModerationStatsResponse,
  ContentModerationRequest,
  ContentModerationResponse,
  AdvanceStoryRequest,
  AdvanceStoryResponse,
  ResetStoryRequest,
  ResetStoryResponse,
} from '../../shared/types/api';

interface ContentReport {
  id: string;
  type: 'chapter' | 'choice' | 'story';
  targetId: string;
  reason: string;
  reportedAt: Date;
  status: 'pending' | 'resolved' | 'dismissed';
  moderatedBy?: string;
  moderatedAt?: Date;
}

interface AdminStats {
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

interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  flaggedContent: ContentReport[];
}

interface AdminInterfaceProps {
  adminKey: string;
  onClose: () => void;
}

export const AdminInterface: React.FC<AdminInterfaceProps> = ({ adminKey, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'reports' | 'filters'>(
    'overview'
  );
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [moderationStats, setModerationStats] = useState<ModerationStats | null>(null);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [advanceReason, setAdvanceReason] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [forceChoice, setForceChoice] = useState('');
  const [newFilterPattern, setNewFilterPattern] = useState('');
  const [newFilterSeverity, setNewFilterSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [newFilterAction, setNewFilterAction] = useState<'flag' | 'block' | 'replace'>('flag');
  const [newFilterReplacement, setNewFilterReplacement] = useState('');

  useEffect(() => {
    loadAdminData();
  }, [adminKey]);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadStoryStats(), loadModerationStats(), loadReports()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadStoryStats = async () => {
    try {
      const response = await fetch(`/api/admin/stats?adminKey=${encodeURIComponent(adminKey)}`);
      const data: GetStoryStatsResponse = await response.json();

      if (data.success && data.data) {
        setAdminStats(data.data);
      } else {
        throw new Error(data.error || 'Failed to load story stats');
      }
    } catch (err) {
      console.error('Error loading story stats:', err);
      throw err;
    }
  };

  const loadModerationStats = async () => {
    try {
      const response = await fetch(
        `/api/admin/moderation?adminKey=${encodeURIComponent(adminKey)}`
      );
      const data: GetModerationStatsResponse = await response.json();

      if (data.success && data.data) {
        // Map the API response to match our interface
        const mappedStats: ModerationStats = {
          totalReports: data.data.totalReports,
          pendingReports: data.data.pendingReports,
          resolvedReports: data.data.resolvedReports,
          flaggedContent: data.data.flaggedContent.map((item: any) => ({
            id: item.id,
            type: item.type,
            targetId: item.targetId || item.id, // Use id as fallback for targetId
            reason: item.reason,
            reportedAt: new Date(item.reportedAt),
            status: item.status,
            moderatedBy: item.moderatedBy,
            ...(item.moderatedAt && { moderatedAt: new Date(item.moderatedAt) }),
          })),
        };
        setModerationStats(mappedStats);
      } else {
        throw new Error(data.error || 'Failed to load moderation stats');
      }
    } catch (err) {
      console.error('Error loading moderation stats:', err);
      throw err;
    }
  };

  const loadReports = async () => {
    try {
      const response = await fetch(`/api/admin/reports?adminKey=${encodeURIComponent(adminKey)}`);
      const data = await response.json();

      if (data.success && data.data) {
        setReports(data.data.reports || []);
      } else {
        throw new Error(data.error || 'Failed to load reports');
      }
    } catch (err) {
      console.error('Error loading reports:', err);
      throw err;
    }
  };

  const handleAdvanceStory = async () => {
    if (!adminKey) return;

    setLoading(true);
    setError(null);

    try {
      const request: AdvanceStoryRequest = {
        adminKey,
        ...(forceChoice && { forceChoice }),
        ...(advanceReason && { reason: advanceReason }),
      };

      const response = await fetch('/api/admin/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: AdvanceStoryResponse = await response.json();

      if (data.success) {
        setSuccessMessage('Story advanced successfully');
        setAdvanceReason('');
        setForceChoice('');
        await loadAdminData();
      } else {
        throw new Error(data.error || 'Failed to advance story');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance story');
    } finally {
      setLoading(false);
    }
  };

  const handleResetStory = async () => {
    if (!adminKey || !confirm('Are you sure you want to reset the story? This cannot be undone.'))
      return;

    setLoading(true);
    setError(null);

    try {
      const request: ResetStoryRequest = {
        adminKey,
        ...(resetReason && { reason: resetReason }),
      };

      const response = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: ResetStoryResponse = await response.json();

      if (data.success) {
        setSuccessMessage('Story reset successfully');
        setResetReason('');
        await loadAdminData();
      } else {
        throw new Error(data.message || 'Failed to reset story');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset story');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async (
    reportId: string,
    status: 'resolved' | 'dismissed',
    notes?: string
  ) => {
    if (!adminKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminKey,
          status,
          moderatorNotes: notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Report ${status} successfully`);
        await loadReports();
      } else {
        throw new Error(data.error || `Failed to ${status} report`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${status} report`);
    } finally {
      setLoading(false);
    }
  };

  const handleFlagContent = async (
    targetType: 'chapter' | 'choice' | 'story',
    targetId: string,
    reason: string
  ) => {
    if (!adminKey) return;

    setLoading(true);
    setError(null);

    try {
      const request: ContentModerationRequest = {
        adminKey,
        action: 'flag',
        targetType,
        targetId,
        reason,
      };

      const response = await fetch('/api/admin/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: ContentModerationResponse = await response.json();

      if (data.success) {
        setSuccessMessage('Content flagged successfully');
        await loadModerationStats();
      } else {
        throw new Error(data.error || 'Failed to flag content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flag content');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFilter = async () => {
    if (!adminKey || !newFilterPattern) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminKey,
          pattern: newFilterPattern,
          severity: newFilterSeverity,
          action: newFilterAction,
          ...(newFilterReplacement && { replacement: newFilterReplacement }),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Content filter added successfully');
        setNewFilterPattern('');
        setNewFilterReplacement('');
        await loadModerationStats();
      } else {
        throw new Error(data.error || 'Failed to add content filter');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add content filter');
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="admin-interface">
      <div className="admin-header">
        <h2>Administrative Interface</h2>
        <button onClick={onClose} className="close-button">
          ×
        </button>
      </div>

      {error && (
        <div className="admin-message error">
          {error}
          <button onClick={clearMessages} className="dismiss-button">
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="admin-message success">
          {successMessage}
          <button onClick={clearMessages} className="dismiss-button">
            ×
          </button>
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'moderation' ? 'active' : ''}`}
          onClick={() => setActiveTab('moderation')}
        >
          Moderation
        </button>
        <button
          className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports ({moderationStats?.pendingReports || 0})
        </button>
        <button
          className={`tab ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Content Filters
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Story Progress</h3>
                <div className="stat-value">{adminStats?.totalChapters || 0}</div>
                <div className="stat-label">Total Chapters</div>
              </div>
              <div className="stat-card">
                <h3>Community Engagement</h3>
                <div className="stat-value">{adminStats?.totalVotes || 0}</div>
                <div className="stat-label">Total Votes</div>
              </div>
              <div className="stat-card">
                <h3>Participants</h3>
                <div className="stat-value">{adminStats?.uniqueParticipants || 0}</div>
                <div className="stat-label">Unique Users</div>
              </div>
              <div className="stat-card">
                <h3>Current Status</h3>
                <div className="stat-value">{adminStats?.votingActive ? 'Active' : 'Inactive'}</div>
                <div className="stat-label">Voting Status</div>
              </div>
            </div>

            <div className="admin-actions">
              <div className="action-section">
                <h3>Story Management</h3>
                <div className="action-group">
                  <div className="form-group">
                    <label>Force Choice (Optional):</label>
                    <input
                      type="text"
                      value={forceChoice}
                      onChange={(e) => setForceChoice(e.target.value)}
                      placeholder="choice-id"
                    />
                  </div>
                  <div className="form-group">
                    <label>Reason:</label>
                    <input
                      type="text"
                      value={advanceReason}
                      onChange={(e) => setAdvanceReason(e.target.value)}
                      placeholder="Reason for manual advancement"
                    />
                  </div>
                  <button
                    onClick={handleAdvanceStory}
                    disabled={loading}
                    className="admin-button primary"
                  >
                    Advance Story
                  </button>
                </div>

                <div className="action-group">
                  <div className="form-group">
                    <label>Reset Reason:</label>
                    <input
                      type="text"
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                      placeholder="Reason for story reset"
                    />
                  </div>
                  <button
                    onClick={handleResetStory}
                    disabled={loading}
                    className="admin-button danger"
                  >
                    Reset Story
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="moderation-tab">
            <div className="moderation-stats">
              <h3>Moderation Overview</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{moderationStats?.totalReports || 0}</div>
                  <div className="stat-label">Total Reports</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{moderationStats?.pendingReports || 0}</div>
                  <div className="stat-label">Pending Reports</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{moderationStats?.resolvedReports || 0}</div>
                  <div className="stat-label">Resolved Reports</div>
                </div>
              </div>
            </div>

            <div className="content-flagging">
              <h3>Flag Content</h3>
              <div className="flag-form">
                <select
                  onChange={(e) => {
                    const [type, id] = e.target.value.split(':');
                    if (type && id) {
                      const reason = prompt('Enter reason for flagging:');
                      if (reason) {
                        handleFlagContent(type as any, id, reason);
                      }
                    }
                  }}
                >
                  <option value="">Select content to flag...</option>
                  <option value="chapter:current">Current Chapter</option>
                  <option value="story:main">Entire Story</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-tab">
            <h3>Content Reports</h3>
            <div className="reports-list">
              {reports.length === 0 ? (
                <div className="no-reports">No reports to review</div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className={`report-card ${report.status}`}>
                    <div className="report-header">
                      <span className="report-type">{report.type}</span>
                      <span className="report-status">{report.status}</span>
                      <span className="report-date">
                        {new Date(report.reportedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="report-content">
                      <div className="report-reason">{report.reason}</div>
                      <div className="report-target">Target: {report.targetId}</div>
                    </div>
                    {report.status === 'pending' && (
                      <div className="report-actions">
                        <button
                          onClick={() => handleResolveReport(report.id, 'resolved')}
                          className="admin-button small primary"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleResolveReport(report.id, 'dismissed')}
                          className="admin-button small secondary"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="filters-tab">
            <h3>Content Filters</h3>
            <div className="add-filter">
              <h4>Add New Filter</h4>
              <div className="filter-form">
                <div className="form-group">
                  <label>Pattern (regex):</label>
                  <input
                    type="text"
                    value={newFilterPattern}
                    onChange={(e) => setNewFilterPattern(e.target.value)}
                    placeholder="Enter regex pattern"
                  />
                </div>
                <div className="form-group">
                  <label>Severity:</label>
                  <select
                    value={newFilterSeverity}
                    onChange={(e) => setNewFilterSeverity(e.target.value as any)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Action:</label>
                  <select
                    value={newFilterAction}
                    onChange={(e) => setNewFilterAction(e.target.value as any)}
                  >
                    <option value="flag">Flag for Review</option>
                    <option value="block">Block Content</option>
                    <option value="replace">Replace Text</option>
                  </select>
                </div>
                {newFilterAction === 'replace' && (
                  <div className="form-group">
                    <label>Replacement Text:</label>
                    <input
                      type="text"
                      value={newFilterReplacement}
                      onChange={(e) => setNewFilterReplacement(e.target.value)}
                      placeholder="Text to replace with"
                    />
                  </div>
                )}
                <button
                  onClick={handleAddFilter}
                  disabled={loading || !newFilterPattern}
                  className="admin-button primary"
                >
                  Add Filter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <div>Processing...</div>
        </div>
      )}
    </div>
  );
};
