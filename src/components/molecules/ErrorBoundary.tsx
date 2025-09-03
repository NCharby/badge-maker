'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Mail, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId()
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private copyErrorDetails = () => {
    const errorDetails = this.getErrorDetails();
    navigator.clipboard.writeText(errorDetails);
  };

  private getErrorDetails(): string {
    const { error, errorInfo, errorId } = this.state;
    
    return `Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}

Component Stack: ${errorInfo?.componentStack || 'No component stack'}

Please include this information when contacting support.`;
  };

  private refreshPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Something went wrong
                </h1>
                <p className="text-gray-600">
                  We encountered an unexpected error. Don't worry, we've logged it and our team will investigate.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Error Details
                </h3>
                <button
                  onClick={this.copyErrorDetails}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Copy Details
                </button>
              </div>
              <div className="text-xs text-gray-600 font-mono bg-white p-3 rounded border overflow-x-auto">
                <div>Error ID: {this.state.errorId}</div>
                <div>Time: {new Date().toLocaleString()}</div>
                <div>Page: {window.location.pathname}</div>
                {this.state.error && (
                  <div className="mt-2 text-red-600">
                    {this.state.error.message}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.refreshPage}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </button>

              <a
                href={`mailto:hello@shinydogproductions.com?subject=Error Report - ${this.state.errorId}&body=${encodeURIComponent(this.getErrorDetails())}`}
                className="w-full flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>Contact Support</span>
              </a>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>
                If this problem persists, please contact us at{' '}
                <a
                  href="mailto:hello@shinydogproductions.com"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  hello@shinydogproductions.com
                </a>
              </p>
              <p className="mt-1">Include the Error ID above for faster resolution.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
