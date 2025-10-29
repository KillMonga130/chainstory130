/**
 * Content validation hook for The Haunted Thread
 * Provides client-side content validation and filtering
 */

import { useState, useCallback } from 'react';

interface ValidationResult {
  isValid: boolean;
  filteredContent?: string;
  violations: string[];
  requiresApproval: boolean;
}

interface UseContentValidationReturn {
  validateContent: (content: string, contentType: 'chapter' | 'choice' | 'story') => Promise<ValidationResult>;
  isValidating: boolean;
  lastValidation: ValidationResult | null;
  error: string | null;
}

export const useContentValidation = (): UseContentValidationReturn => {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateContent = useCallback(async (
    content: string,
    contentType: 'chapter' | 'choice' | 'story'
  ): Promise<ValidationResult> => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/moderation/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          contentType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }

      const result: ValidationResult = {
        isValid: data.data.isValid,
        filteredContent: data.data.filteredContent,
        violations: data.data.violations || [],
        requiresApproval: data.data.requiresApproval || false
      };

      setLastValidation(result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Content validation failed';
      setError(errorMessage);
      
      // Return a safe default result
      const fallbackResult: ValidationResult = {
        isValid: false,
        violations: [errorMessage],
        requiresApproval: true
      };
      
      setLastValidation(fallbackResult);
      return fallbackResult;

    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validateContent,
    isValidating,
    lastValidation,
    error
  };
};
