import { useState } from 'react';
import { FormError } from './ErrorStates';

interface SubmissionFormProps {
  storyId: string;
  roundNumber: number;
  submitting: boolean;
  lastSubmissionMessage: string | null;
  onSubmit: (sentence: string) => Promise<{ success: boolean; message: string }>;
}

export const SubmissionForm = ({
  storyId: _storyId,
  roundNumber: _roundNumber,
  submitting,
  lastSubmissionMessage,
  onSubmit,
}: SubmissionFormProps) => {
  const [sentence, setSentence] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateSentence = (text: string): string[] => {
    const errors: string[] = [];
    const trimmed = text.trim();
    
    if (trimmed.length === 0) {
      errors.push('Sentence cannot be empty');
    } else if (trimmed.length < 10) {
      errors.push('Sentence must be at least 10 characters long');
    } else if (trimmed.length > 150) {
      errors.push('Sentence must be no more than 150 characters long');
    }
    
    // Check for basic sentence structure
    if (trimmed.length > 0 && !trimmed.match(/[.!?]$/)) {
      errors.push('Sentence should end with proper punctuation (. ! ?)');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous validation errors
    setValidationErrors([]);
    
    if (submitting) return;

    // Validate sentence
    const errors = validateSentence(sentence);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const result = await onSubmit(sentence);
    if (result.success) {
      setSentence(''); // Clear form on success
      setValidationErrors([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setSentence(newValue);
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const getCharacterCountColor = () => {
    if (sentence.length < 10) return 'text-red-500';
    if (sentence.length > 150) return 'text-red-500';
    if (sentence.length > 130) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getCharacterCountMessage = () => {
    if (sentence.length < 10) return ` (minimum 10 required)`;
    if (sentence.length > 150) return ` (maximum 150 exceeded)`;
    if (sentence.length > 130) return ` (approaching limit)`;
    return '';
  };

  const isValidLength = sentence.trim().length >= 10 && sentence.trim().length <= 150;

  return (
    <div className="mobile-card bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg font-semibold mb-3 sm:mb-4">Add Your Sentence</h3>
      <p className="text-sm text-gray-600 mb-3 sm:mb-4">
        Continue the story with your sentence. The community will vote, and the highest-voted 
        sentence will be added to the story at the end of this round.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={sentence}
            onChange={handleInputChange}
            placeholder="Continue the story with your sentence (10-150 characters)..."
            className={`mobile-input w-full p-3 border rounded-lg resize-none focus:ring-2 focus:border-transparent transition-colors text-base ${
              validationErrors.length > 0 
                ? 'border-red-300 focus:ring-red-500' 
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            rows={3}
            disabled={submitting}
            maxLength={200} // Allow typing beyond 150 to show error
            aria-describedby={validationErrors.length > 0 ? 'sentence-errors' : undefined}
          />
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 gap-1 text-xs sm:text-sm">
            <span className={getCharacterCountColor()}>
              {sentence.length}/150 characters{getCharacterCountMessage()}
            </span>
            {sentence.length > 0 && (
              <span className="text-gray-500">
                Words: {sentence.trim().split(/\s+/).filter(word => word.length > 0).length}
              </span>
            )}
          </div>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <FormError errors={validationErrors} />
        )}

        <button
          type="submit"
          disabled={submitting || !isValidLength}
          className={`touch-button w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            submitting || !isValidLength
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit Sentence'
          )}
        </button>
      </form>

      {lastSubmissionMessage && (
        <div
          className={`mt-4 p-3 rounded-lg border ${
            lastSubmissionMessage.includes('Submitted!') || lastSubmissionMessage.includes('success')
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start">
            <span className="mr-2 mt-0.5 text-lg">
              {lastSubmissionMessage.includes('Submitted!') || lastSubmissionMessage.includes('success') ? '✅' : '❌'}
            </span>
            <div className="flex-1">
              <p className="font-medium text-sm sm:text-base">
                {lastSubmissionMessage.includes('Submitted!') || lastSubmissionMessage.includes('success') 
                  ? 'Success!' 
                  : 'Error'
                }
              </p>
              <p className="text-xs sm:text-sm mt-1">{lastSubmissionMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs sm:text-sm text-blue-800">
          <strong>How it works:</strong> Submit your sentence and it will be posted as a Reddit comment. 
          The community votes using upvotes, and the highest-voted sentence becomes part of the story 
          when the round ends.
        </p>
      </div>
    </div>
  );
};
