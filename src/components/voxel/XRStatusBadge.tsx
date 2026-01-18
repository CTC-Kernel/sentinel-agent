/**
 * Story 34.1 - XR Status Badge Component
 *
 * Displays VR/AR availability status with icons and provides
 * quick access buttons to enter immersive experiences.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { useWebXR } from '@/hooks/voxel/useWebXR';

// ============================================================================
// Types
// ============================================================================

export interface XRStatusBadgeProps {
  /** Callback when VR mode is requested */
  onEnterVR?: () => void;
  /** Callback when AR mode is requested */
  onEnterAR?: () => void;
  /** Callback when session ends */
  onExitXR?: () => void;
  /** Show compact version */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Position for the badge */
  position?: 'inline' | 'fixed-bottom-right' | 'fixed-bottom-left';
}

// ============================================================================
// Icons
// ============================================================================

const VRHeadsetIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 10a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-3l-2 2h-6l-2-2H4a2 2 0 01-2-2v-4z" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="12" r="2" />
  </svg>
);

const ARPhoneIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
    {/* AR crosshair overlay */}
    <circle cx="12" cy="10" r="3" strokeDasharray="2,2" />
    <line x1="12" y1="5" x2="12" y2="7" />
    <line x1="12" y1="13" x2="12" y2="15" />
    <line x1="7" y1="10" x2="9" y2="10" />
    <line x1="15" y1="10" x2="17" y2="10" />
  </svg>
);

const ExitIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
  </svg>
);

// ============================================================================
// Status Indicator Component
// ============================================================================

interface StatusIndicatorProps {
  supported: boolean;
  label: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ supported, label }) => (
  <div className="flex items-center gap-1.5">
    <div
      className={`
        w-4 h-4 rounded-full flex items-center justify-center
        ${supported ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'}
      `}
    >
      {supported ? <CheckIcon className="w-2.5 h-2.5" /> : <XIcon className="w-2.5 h-2.5" />}
    </div>
    <span className={`text-xs ${supported ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
  </div>
);

// ============================================================================
// Tooltip Component
// ============================================================================

interface TooltipProps {
  visible: boolean;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ visible, children }) => {
  if (!visible) return null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
      <div className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 shadow-xl min-w-[200px]">
        {children}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const XRStatusBadge: React.FC<XRStatusBadgeProps> = ({
  onEnterVR,
  onEnterAR,
  onExitXR,
  compact = false,
  className = '',
  position = 'inline',
}) => {
  const {
    status,
    requestVRSession,
    requestARSession,
    endSession,
    isVRActive,
    isARActive,
    deviceInfo,
  } = useWebXR();

  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Handle VR button click
  const handleEnterVR = useCallback(async () => {
    if (isVRActive) {
      await endSession();
      onExitXR?.();
    } else {
      setIsLoading(true);
      try {
        const session = await requestVRSession();
        if (session) {
          onEnterVR?.();
        }
      } finally {
        setIsLoading(false);
      }
    }
  }, [isVRActive, endSession, requestVRSession, onEnterVR, onExitXR]);

  // Handle AR button click
  const handleEnterAR = useCallback(async () => {
    if (isARActive) {
      await endSession();
      onExitXR?.();
    } else {
      setIsLoading(true);
      try {
        const session = await requestARSession();
        if (session) {
          onEnterAR?.();
        }
      } finally {
        setIsLoading(false);
      }
    }
  }, [isARActive, endSession, requestARSession, onEnterAR, onExitXR]);

  // Position classes
  const positionClasses = useMemo(() => {
    switch (position) {
      case 'fixed-bottom-right':
        return 'fixed bottom-4 right-4 z-50';
      case 'fixed-bottom-left':
        return 'fixed bottom-4 left-4 z-50';
      default:
        return '';
    }
  }, [position]);

  // Status color
  const statusColor = useMemo(() => {
    if (status.isDetecting) return 'bg-amber-500/20 text-amber-400';
    if (status.error) return 'bg-red-500/20 text-red-400';
    if (status.vrSupported || status.arSupported) return 'bg-green-500/20 text-green-400';
    return 'bg-gray-500/20 text-gray-400';
  }, [status]);

  // If not available, show minimal indicator
  if (!status.webXRAvailable && !status.isDetecting) {
    if (compact) return null;

    return (
      <div
        className={`
          inline-flex items-center gap-2 px-3 py-1.5
          bg-slate-800/80 backdrop-blur-sm border border-white/5 rounded-lg
          text-gray-400 text-xs
          ${positionClasses} ${className}
        `}
      >
        <VRHeadsetIcon className="w-4 h-4 opacity-50" />
        <span>XR not available</span>
      </div>
    );
  }

  // Compact mode - just show icons with status
  if (compact) {
    return (
      <div
        className={`
          inline-flex items-center gap-1
          ${positionClasses} ${className}
        `}
      >
        {status.vrSupported && (
          <button
            onClick={handleEnterVR}
            disabled={isLoading || isARActive}
            className={`
              p-2 rounded-lg transition-all
              ${isVRActive
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800/80 backdrop-blur-sm border border-white/10 text-gray-300 hover:bg-slate-700/80'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={isVRActive ? 'Exit VR' : 'Enter VR'}
          >
            <VRHeadsetIcon className="w-5 h-5" />
          </button>
        )}
        {status.arSupported && (
          <button
            onClick={handleEnterAR}
            disabled={isLoading || isVRActive}
            className={`
              p-2 rounded-lg transition-all
              ${isARActive
                ? 'bg-purple-500 text-white'
                : 'bg-slate-800/80 backdrop-blur-sm border border-white/10 text-gray-300 hover:bg-slate-700/80'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={isARActive ? 'Exit AR' : 'Enter AR'}
          >
            <ARPhoneIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Full badge with status and buttons
  return (
    <div
      className={`
        relative inline-flex items-center gap-2
        bg-slate-800/90 backdrop-blur-sm border border-white/10 rounded-xl
        ${positionClasses} ${className}
      `}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Status indicator */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-l-xl
          ${statusColor}
        `}
      >
        <div
          className={`
            w-2 h-2 rounded-full
            ${status.isDetecting ? 'animate-pulse bg-amber-400' : ''}
            ${status.vrSupported || status.arSupported ? 'bg-green-400' : ''}
            ${!status.vrSupported && !status.arSupported && !status.isDetecting ? 'bg-gray-500' : ''}
          `}
        />
        <span className="text-xs font-medium">
          {status.isDetecting ? 'Detecting...' : 'XR Ready'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 pr-2">
        {/* VR Button */}
        {status.vrSupported && (
          <button
            onClick={handleEnterVR}
            disabled={isLoading || isARActive}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              transition-all duration-200
              ${isVRActive
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isVRActive ? (
              <>
                <ExitIcon className="w-4 h-4" />
                <span>Exit VR</span>
              </>
            ) : (
              <>
                <VRHeadsetIcon className="w-4 h-4" />
                <span>Enter VR</span>
              </>
            )}
          </button>
        )}

        {/* AR Button */}
        {status.arSupported && (
          <button
            onClick={handleEnterAR}
            disabled={isLoading || isVRActive}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              transition-all duration-200
              ${isARActive
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isARActive ? (
              <>
                <ExitIcon className="w-4 h-4" />
                <span>Exit AR</span>
              </>
            ) : (
              <>
                <ARPhoneIcon className="w-4 h-4" />
                <span>Enter AR</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Tooltip with detailed info */}
      <Tooltip visible={showTooltip && !status.isDetecting}>
        <div className="space-y-2">
          <div className="text-xs font-medium text-white mb-2">XR Device Status</div>
          <div className="space-y-1">
            <StatusIndicator supported={status.vrSupported} label="VR Mode (Headset)" />
            <StatusIndicator supported={status.arSupported} label="AR Mode (Mobile)" />
          </div>
          {(status.vrSupported || status.arSupported) && (
            <div className="pt-2 mt-2 border-t border-white/10">
              <div className="text-xs text-gray-400 mb-1">Features:</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                {status.capabilities.handTracking && <span>Hand Tracking</span>}
                {status.capabilities.hitTest && <span>Surface Detection</span>}
                {status.capabilities.planeDetection && <span>Plane Detection</span>}
                {status.capabilities.localFloor && <span>Floor Tracking</span>}
              </div>
            </div>
          )}
          <div className="text-xs text-gray-500 pt-1">{deviceInfo}</div>
        </div>
      </Tooltip>
    </div>
  );
};

// ============================================================================
// Mini Status Component
// ============================================================================

export interface XRMiniStatusProps {
  onClick?: () => void;
  className?: string;
}

export const XRMiniStatus: React.FC<XRMiniStatusProps> = ({ onClick, className = '' }) => {
  const { status, isVRActive, isARActive } = useWebXR();

  // Color based on status
  const dotColor = useMemo(() => {
    if (isVRActive || isARActive) return 'bg-blue-400';
    if (status.vrSupported || status.arSupported) return 'bg-green-400';
    return 'bg-gray-500';
  }, [status.vrSupported, status.arSupported, isVRActive, isARActive]);

  const label = useMemo(() => {
    if (isVRActive) return 'VR Active';
    if (isARActive) return 'AR Active';
    if (status.vrSupported && status.arSupported) return 'VR/AR';
    if (status.vrSupported) return 'VR';
    if (status.arSupported) return 'AR';
    return 'No XR';
  }, [status.vrSupported, status.arSupported, isVRActive, isARActive]);

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2 py-1
        bg-slate-800/60 backdrop-blur-sm rounded-md
        text-xs text-gray-400 hover:text-gray-200
        transition-colors
        ${className}
      `}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </button>
  );
};

export default XRStatusBadge;
