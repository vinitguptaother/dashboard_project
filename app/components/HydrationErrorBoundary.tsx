'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  isHydrationError: boolean;
}

/**
 * Error boundary specifically for handling hydration errors
 * caused by browser extensions or SSR mismatches
 */
export default class HydrationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isHydrationError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a hydration error
    const isHydrationError = 
      error.message?.includes('Hydration') ||
      error.message?.includes('did not match') ||
      error.message?.includes('server rendered HTML');

    return { 
      hasError: true, 
      isHydrationError 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only log non-hydration errors in development
    if (!this.state.isHydrationError || process.env.NODE_ENV === 'production') {
      console.error('Error caught by HydrationErrorBoundary:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isHydrationError) {
        // For hydration errors, just render the children anyway
        // The browser will eventually reconcile the differences
        return this.props.children;
      }

      // For other errors, show the fallback
      return this.props.fallback || (
        <div className="flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-500 mb-2">⚠️ Something went wrong</div>
            <button 
              onClick={() => this.setState({ hasError: false, isHydrationError: false })}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}