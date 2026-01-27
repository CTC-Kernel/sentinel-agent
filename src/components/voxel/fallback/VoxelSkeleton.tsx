/**
 * VoxelSkeleton - Loading skeleton for VoxelCanvas
 *
 * Displayed while the 3D canvas is initializing or lazy-loading.
 * Provides visual feedback with a pulsing animation.
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 */

import React from 'react';
import { useStore } from '@/store';

export interface VoxelSkeletonProps {
  /** Custom loading message */
  message?: string;
}

export const VoxelSkeleton: React.FC<VoxelSkeletonProps> = ({ message }) => {
  const { t } = useStore();

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-slate-900"
      style={{ minHeight: 'calc(100vh - 48px)' }}
      data-testid="voxel-skeleton"
      role="progressbar"
      aria-label={message || t('voxel.loading')}
    >
      {/* Animated 3D cube placeholder */}
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-2 border-blue-500/30 rounded-lg animate-pulse" />
        <div
          className="absolute inset-2 border-2 border-blue-2000 rounded-lg animate-pulse"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="absolute inset-4 border-2 border-blue-500/70 rounded-lg animate-pulse"
          style={{ animationDelay: '300ms' }}
        />
        <div
          className="absolute inset-6 bg-blue-500/20 rounded-lg animate-pulse"
          style={{ animationDelay: '450ms' }}
        />
      </div>

      {/* Loading text */}
      <div className="text-center">
        <p className="text-lg font-medium text-slate-300 mb-2">
          {message || t('voxel.loading')}
        </p>
        <div className="flex items-center justify-center gap-1">
          <span
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
};

export default VoxelSkeleton;
