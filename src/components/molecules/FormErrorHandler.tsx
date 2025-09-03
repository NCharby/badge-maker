'use client';

import React from 'react';
import { AlertCircle, Mail } from 'lucide-react';

interface FormErrorHandlerProps {
  errors: Record<string, any> | null;
  className?: string;
}

export function FormErrorHandler({ errors, className = '' }: FormErrorHandlerProps) {
  if (!errors || Object.keys(errors).length === 0) return null;

  const errorId = `form_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const copyErrorDetails = () => {
    const details = `Form Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
Errors: ${JSON.stringify(errors, null, 2)}

Please include this information when contacting support.`;
    
    navigator.clipboard.writeText(details);
  };

  const contactSupport = () => {
    const subject = `Form Error Report - ${errorId}`;
    const body = `Form Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
Errors: ${JSON.stringify(errors, null, 2)}

Please investigate this form validation issue.`;
    
    window.open(`mailto:hello@shinydogproductions.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-800">
            Please fix the following issues
          </h3>
          
          <div className="mt-2 space-y-1">
            {Object.entries(errors).map(([field, error]) => (
              <div key={field} className="text-sm text-amber-700">
                <span className="font-medium capitalize">
                  {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                </span>{' '}
                {error?.message || error}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={copyErrorDetails}
              className="inline-flex items-center space-x-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
            >
              <span>Copy Details</span>
            </button>
            
            <button
              onClick={contactSupport}
              className="inline-flex items-center space-x-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
            >
              <Mail className="h-3 w-3" />
              <span>Contact Support</span>
            </button>
          </div>

          <div className="mt-3 text-xs text-amber-600">
            <p>
              If you need help, contact us at{' '}
              <a
                href="mailto:hello@shinydogproductions.com"
                className="underline hover:text-amber-800"
              >
                hello@shinydogproductions.com
              </a>
              {' '}with Error ID: <code className="bg-amber-100 px-1 rounded">{errorId}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
