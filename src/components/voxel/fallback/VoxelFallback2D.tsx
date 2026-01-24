/**
 * VoxelFallback2D - 2D Fallback view for non-WebGL environments
 *
 * Displayed when:
 * - WebGL is not supported by the browser
 * - User is on a mobile device (<768px)
 * - WebGL context creation fails
 *
 * Provides link to classic dashboard view.
 *
 * @see Story VOX-1.4: WebGL Capability Detection
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React from 'react';
import { useStore } from '@/store';

export type FallbackReason = 'no-webgl' | 'mobile' | 'error' | 'webgl1-degraded';

export interface VoxelFallback2DProps {
  /** Reason for showing fallback */
  reason?: FallbackReason;
  /** Custom message to display */
  message?: string;
  /** Show link to alternative view */
  showAlternativeLink?: boolean;
  /** Alternative view URL */
  alternativeUrl?: string;
}

/**
 * Get localized message based on fallback reason
 */
function getReasonMessage(reason: FallbackReason, t: (key: string) => string): {
  title: string;
  description: string;
  icon: 'mobile' | 'gpu' | 'error';
} {
  switch (reason) {
    case 'mobile':
      return {
        title: t('voxel.fallback.mobileTitle'),
        description: t('voxel.fallback.mobileDescription'),
        icon: 'mobile',
      };
    case 'no-webgl':
      return {
        title: t('voxel.fallback.noWebGLTitle'),
        description: t('voxel.fallback.noWebGLDescription'),
        icon: 'gpu',
      };
    case 'webgl1-degraded':
      return {
        title: t('voxel.fallback.degradedTitle'),
        description: t('voxel.fallback.degradedDescription'),
        icon: 'gpu',
      };
    case 'error':
    default:
      return {
        title: t('voxel.fallback.errorTitle'),
        description: t('voxel.fallback.errorDescription'),
        icon: 'error',
      };
  }
}

/**
 * Icon components for different fallback reasons
 */
const MobileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  </svg>
);

const GpuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
    />
  </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const IconMap = {
  mobile: MobileIcon,
  gpu: GpuIcon,
  error: ErrorIcon,
};

export const VoxelFallback2D: React.FC<VoxelFallback2DProps> = ({
  reason = 'no-webgl',
  message,
  showAlternativeLink = true,
  alternativeUrl = '/ctc-engine',
}) => {
  const { t } = useStore();
  const { title, description, icon } = getReasonMessage(reason, t);
  const Icon = IconMap[icon];

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white"
      style={{ minHeight: 'calc(100vh - 48px)' }}
      data-testid="voxel-fallback-2d"
      role="region"
      aria-label={t('voxel.fallback.ariaLabel')}
    >
      {/* Icon */}
      <div className="w-24 h-24 mb-6 flex items-center justify-center rounded-full bg-blue-500/10 border-2 border-blue-500/30">
        <Icon className="w-12 h-12 text-blue-400" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-semibold mb-3 text-center px-4">
        {message ? message : title}
      </h2>

      {/* Description */}
      <p className="text-slate-400 text-center max-w-md mb-8 px-6">
        {description}
      </p>

      {/* Browser requirements info for WebGL issues */}
      {(reason === 'no-webgl' || reason === 'webgl1-degraded') && (
        <div className="mb-8 p-4 bg-slate-800/50 rounded-lg max-w-md mx-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">
            {t('voxel.fallback.requirementsTitle')}
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Chrome 90+ / Firefox 88+ / Safari 14+ / Edge 90+</li>
            <li>• {t('voxel.fallback.requirementsGPU')}</li>
            <li>• {t('voxel.fallback.requirementsDrivers')}</li>
          </ul>
        </div>
      )}

      {/* Alternative view link */}
      {showAlternativeLink && (
        <a
          href={alternativeUrl}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
          {t('voxel.fallback.useAlternative')}
        </a>
      )}

      {/* Mobile-specific message */}
      {reason === 'mobile' && (
        <p className="mt-6 text-sm text-slate-500 text-center px-4">
          {t('voxel.fallback.mobileHint')}
        </p>
      )}
    </div>
  );
};

export default VoxelFallback2D;
