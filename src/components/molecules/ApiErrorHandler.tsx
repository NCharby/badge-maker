'use client';

import React from 'react';
import { AlertTriangle, Mail, RefreshCw } from 'lucide-react';

interface ApiErrorHandlerProps {
  error: Error | string | null;
  onRetry?: () => void;
  className?: string;
  showDetails?: boolean;
}

export function ApiErrorHandler({ 
  error, 
  onRetry, 
  className = '',
  showDetails = false 
}: ApiErrorHandlerProps) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? null : error.stack;
  const errorId = `api_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const copyErrorDetails = () => {
    const details = `Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
Error: ${errorMessage}
${errorStack ? `Stack: ${errorStack}` : ''}

Please include this information when contacting support.`;
    
    navigator.clipboard.writeText(details);
  };

  const contactSupport = () => {
    const subject = `API Error Report - ${errorId}`;
    const body = `Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
Error: ${errorMessage}
${errorStack ? `Stack: ${errorStack}` : ''}

Please investigate this issue.`;
    
    window.open(`mailto:hello@shinydogproductions.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800">
            Something went wrong
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {errorMessage}
          </p>
          
          {showDetails && errorStack && (
            <details className="mt-3">
              <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                Technical Details
              </summary>
              <div className="mt-2 text-xs text-red-600 font-mono bg-red-100 p-2 rounded border overflow-x-auto">
                <div>Error ID: {errorId}</div>
                <div className="mt-1">{errorStack}</div>
              </div>
            </details>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center space-x-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Try Again</span>
              </button>
            )}
            
            <button
              onClick={copyErrorDetails}
              className="inline-flex items-center space-x-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
            >
              <span>Copy Details</span>
            </button>
            
            <button
              onClick={contactSupport}
              className="inline-flex items-center space-x-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
            >
              <Mail className="h-3 w-3" />
              <span>Contact Support</span>
            </button>
          </div>

          <div className="mt-3 text-xs text-red-600">
            <p>
              If this problem persists, contact us at{' '}
              <a
                href="mailto:hello@shinydogproductions.com"
                className="underline hover:text-red-800"
              >
                hello@shinydogproductions.com
              </a>
              {' '}with Error ID: <code className="bg-red-100 px-1 rounded">{errorId}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
