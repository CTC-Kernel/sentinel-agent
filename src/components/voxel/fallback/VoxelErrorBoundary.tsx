/**
 * VoxelErrorBoundary - Error boundary for VoxelCanvas
 *
 * Catches errors in the 3D canvas and provides a fallback UI.
 * Logs errors to ErrorLogger for monitoring.
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLogger } from '@/services/errorLogger';

export interface VoxelErrorBoundaryProps {
  /** Content to render when no error */
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface VoxelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class VoxelErrorBoundary extends Component<
  VoxelErrorBoundaryProps,
  VoxelErrorBoundaryState
> {
  constructor(props: VoxelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): VoxelErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to ErrorLogger service
    ErrorLogger.error(error, 'VoxelErrorBoundary');

    // Log component stack separately in development
    if (import.meta.env.DEV && errorInfo.componentStack) {
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <VoxelErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/** Default error fallback component */
interface VoxelErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

const VoxelErrorFallback: React.FC<VoxelErrorFallbackProps> = ({
  error,
  onRetry,
}) => {
  const isWebGLError =
    error?.message?.toLowerCase().includes('webgl') ||
    error?.message?.toLowerCase().includes('context');

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white"
      style={{ minHeight: 'calc(100vh - 48px)' }}
      data-testid="voxel-error-fallback"
      role="alert"
    >
      {/* Error icon */}
      <div className="w-20 h-20 mb-6 flex items-center justify-center rounded-full bg-red-500/20 border-2 border-red-2000">
        <svg
          className="w-10 h-10 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Error message */}
      <h2 className="text-xl font-semibold mb-2">
        {isWebGLError ? 'WebGL non supporté' : 'Erreur de visualisation 3D'}
      </h2>
      <p className="text-slate-400 text-center max-w-md mb-6 px-4">
        {isWebGLError
          ? 'Votre navigateur ne prend pas en charge WebGL, nécessaire pour la visualisation 3D.'
          : 'Une erreur est survenue lors du chargement de la visualisation 3D. Veuillez réessayer.'}
      </p>

      {/* Error details (dev mode only) */}
      {import.meta.env.DEV && error && (
        <details className="mb-6 max-w-lg">
          <summary className="text-sm text-slate-500 dark:text-slate-300 cursor-pointer hover:text-muted-foreground">
            Détails de l'erreur
          </summary>
          <pre className="mt-2 p-3 bg-slate-800 rounded text-xs text-red-400 overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>
      )}

      {/* Retry button */}
      {!isWebGLError && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Réessayer
        </button>
      )}

      {/* Fallback link for WebGL issues */}
      {isWebGLError && (
        <a
          href="/ctc-engine"
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
        >
          Utiliser la vue alternative
        </a>
      )}
    </div>
  );
};

export default VoxelErrorBoundary;
