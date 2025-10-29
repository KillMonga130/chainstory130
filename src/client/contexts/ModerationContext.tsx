/**
 * Moderation context for The Haunted Thread
 * Provides moderation state and functions across the application
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useContentValidation } from '../hooks/useContentValidation';

interface ModerationContextType {
  // Content validation
  validateContent: (
    content: string,
    contentType: 'chapter' | 'choice' | 'story'
  ) => Promise<{
    isValid: boolean;
    filteredContent?: string;
    violations: string[];
    requiresApproval: boolean;
  }>;
  isValidating: boolean;

  // Content reporting
  reportContent: (
    contentType: 'chapter' | 'choice' | 'story',
    contentId: string,
    reason: string,
    description?: string
  ) => Promise<{ success: boolean; reportId?: string; error?: string }>;
  isReporting: boolean;

  // Admin interface
  showAdminInterface: boolean;
  setShowAdminInterface: (show: boolean) => void;
  adminKey: string;
  setAdminKey: (key: string) => void;

  // Moderation state
  moderationEnabled: boolean;
  setModerationEnabled: (enabled: boolean) => void;
}

const ModerationContext = createContext<ModerationContextType | undefined>(undefined);

interface ModerationProviderProps {
  children: ReactNode;
}

export const ModerationProvider: React.FC<ModerationProviderProps> = ({ children }) => {
  const { validateContent, isValidating } = useContentValidation();
  const [isReporting, setIsReporting] = useState(false);
  const [showAdminInterface, setShowAdminInterface] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [moderationEnabled, setModerationEnabled] = useState(true);

  const reportContent = useCallback(
    async (
      contentType: 'chapter' | 'choice' | 'story',
      contentId: string,
      reason: string,
      description?: string
    ): Promise<{ success: boolean; reportId?: string; error?: string }> => {
      setIsReporting(true);

      try {
        const response = await fetch('/api/moderation/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contentType,
            contentId,
            reason,
            description,
          }),
        });

        const data = await response.json();

        if (data.success) {
          return {
            success: true,
            reportId: data.data?.reportId,
          };
        } else {
          return {
            success: false,
            error: data.error || 'Failed to submit report',
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Network error occurred',
        };
      } finally {
        setIsReporting(false);
      }
    },
    []
  );

  const contextValue: ModerationContextType = {
    validateContent,
    isValidating,
    reportContent,
    isReporting,
    showAdminInterface,
    setShowAdminInterface,
    adminKey,
    setAdminKey,
    moderationEnabled,
    setModerationEnabled,
  };

  return <ModerationContext.Provider value={contextValue}>{children}</ModerationContext.Provider>;
};

export const useModeration = (): ModerationContextType => {
  const context = useContext(ModerationContext);
  if (context === undefined) {
    throw new Error('useModeration must be used within a ModerationProvider');
  }
  return context;
};
