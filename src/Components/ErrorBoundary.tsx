import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional fallback UI. If not provided, a default message is shown. */
    fallback?: ReactNode;
    /** Called when an error is caught, for logging or reporting. */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Catches JavaScript errors in child components and renders a fallback UI
 * instead of crashing the entire application.
 *
 * Usage:
 *   <ErrorBoundary>
 *       <Settings ... />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *       <WriteNotePage ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <p className="text-sm font-medium text-primary mb-1">Something went wrong</p>
                    <p className="text-xs text-tertiary mb-4">
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        className="px-4 py-2 text-xs font-medium text-white bg-themeblue2 rounded-md active:scale-95 transition-all"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
