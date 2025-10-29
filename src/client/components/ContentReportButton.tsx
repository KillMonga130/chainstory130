/**
 * Content reporting button component for The Haunted Thread
 * Allows users to report inappropriate content
 */

import React, { useState } from 'react';

interface ContentReportButtonProps {
  contentType: 'chapter' | 'choice' | 'story';
  contentId: string;
  className?: string;
}

export const ContentReportButton: React.FC<ContentReportButtonProps> = ({
  contentType,
  contentId,
  className = ''
}) => {
  const [showReportForm, setShowReportForm] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportReasons = [
    'Inappropriate language',
    'Excessive violence',
    'Sexual content',
    'Harassment or hate speech',
    'Spam or advertising',
    'Off-topic content',
    'Other'
  ];

  const handleSubmitReport = async () => {
    if (!reason.trim()) {
      setError('Please select a reason for reporting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contentType,
          contentId,
          reason,
          description: description.trim() || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
        setTimeout(() => {
          setShowReportForm(false);
          setSubmitted(false);
          setReason('');
          setDescription('');
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to submit report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowReportForm(false);
    setReason('');
    setDescription('');
    setError(null);
  };

  if (submitted) {
    return (
      <div className="report-success">
        <span className="report-success-icon">✓</span>
        Report submitted successfully
      </div>
    );
  }

  return (
    <div className={`content-report ${className}`}>
      {!showReportForm ? (
        <button
          onClick={() => setShowReportForm(true)}
          className="report-button"
          title="Report inappropriate content"
        >
          <span className="report-icon">⚠</span>
          Report
        </button>
      ) : (
        <div className="report-form">
          <div className="report-form-header">
            <h4>Report Content</h4>
            <button onClick={handleCancel} className="report-close">×</button>
          </div>

          {error && (
            <div className="report-error">
              {error}
            </div>
          )}

          <div className="report-form-content">
            <div className="form-group">
              <label>Reason for reporting:</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              >
                <option value="">Select a reason...</option>
                {reportReasons.map((reasonOption) => (
                  <option key={reasonOption} value={reasonOption}>
                    {reasonOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Additional details (optional):</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide additional context about why you're reporting this content..."
                rows={3}
                disabled={loading}
                maxLength={500}
              />
              <div className="character-count">
                {description.length}/500
              </div>
            </div>

            <div className="report-form-actions">
              <button
                onClick={handleSubmitReport}
                disabled={loading || !reason.trim()}
                className="report-submit"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="report-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
