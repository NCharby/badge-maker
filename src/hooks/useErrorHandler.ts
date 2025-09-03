'use client';

import { useState, useCallback } from 'react';

interface ErrorState {
  hasError: boolean;
  error: Error | string | null;
  errorId: string;
}

export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorId: ''
  });

  const generateErrorId = useCallback(() => {
    return `hook_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const setError = useCallback((error: Error | string) => {
    const errorId = generateErrorId();
    setErrorState({
      hasError: true,
      error,
      errorId
    });

    // Log error to console for debugging
    console.error('useErrorHandler caught an error:', error);
    
    // Optionally log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // Could send to Sentry, LogRocket, etc.
      console.log('Error logged with ID:', errorId);
    }
  }, [generateErrorId]);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      errorId: ''
    });
  }, []);

  const getErrorDetails = useCallback(() => {
    const { error, errorId } = errorState;
    
    return `Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${typeof window !== 'undefined' ? window.location.href : 'Unknown'}
User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}

Error: ${error instanceof Error ? error.message : error}
${error instanceof Error && error.stack ? `Stack: ${error.stack}` : ''}

Please include this information when contacting support.`;
  }, [errorState]);

  const copyErrorDetails = useCallback(async () => {
    try {
      const details = getErrorDetails();
      await navigator.clipboard.writeText(details);
      return true;
    } catch (err) {
      console.error('Failed to copy error details:', err);
      return false;
    }
  }, [getErrorDetails]);

  const contactSupport = useCallback(() => {
    const { error, errorId } = errorState;
    const subject = `Error Report - ${errorId}`;
    const body = getErrorDetails();
    
    window.open(`mailto:hello@shinydogproductions.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }, [errorState, getErrorDetails]);

  return {
    ...errorState,
    setError,
    clearError,
    getErrorDetails,
    copyErrorDetails,
    contactSupport
  };
}
