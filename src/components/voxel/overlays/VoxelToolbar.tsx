/**
 * VoxelToolbar - Main toolbar for the 3D visualization
 *
 * Provides quick access to common actions like reset view, toggle labels,
 * toggle edges, and layout selection. Positioned at the top of the canvas.
 *
 * @see Story VOX-5.1: Filter by Entity Type
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useCallback } from 'react';
import {
  Home,
  Tag,
  GitBranch,
  Maximize2,
  Grid3X3,
  CircleDot,
  Clock,
  Network,
} from 'lucide-react';
import { useVoxelStore } from '@/stores/voxelStore';
import type { VoxelUIState } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelToolbarProps {
  /** Called when reset view is requested */
  onResetView?: () => void;
  /** Called when fit all is requested */
  onFitAll?: () => void;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const LAYOUT_OPTIONS: { value: VoxelUIState['layoutType']; label: string; icon: React.ReactNode }[] = [
  { value: 'force', label: 'Force', icon: <Network className="w-4 h-4" /> },
  { value: 'hierarchical', label: 'Hierarchy', icon: <Grid3X3 className="w-4 h-4" /> },
  { value: 'radial', label: 'Radial', icon: <CircleDot className="w-4 h-4" /> },
  { value: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
];

// ============================================================================
// Sub-components
// ============================================================================

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded-lg transition-colors ${active
        ? 'bg-blue-500/20 text-blue-400'
        : 'text-muted-foreground hover:text-slate-200 hover:bg-slate-700/50'
      } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    title={label}
    aria-label={label}
  >
    {icon}
  </button>
);

type ToolbarDividerProps = Record<string, never>;

const ToolbarDivider: React.FC<ToolbarDividerProps> = () => (
  <div className="w-px h-6 bg-slate-700/50" />
);

// ============================================================================
// Component
// ============================================================================

export const VoxelToolbar: React.FC<VoxelToolbarProps> = ({
  onResetView,
  onFitAll,
  className = '',
}) => {
  // Store state
  const showLabels = useVoxelStore((state) => state.ui.showLabels);
  const showEdges = useVoxelStore((state) => state.ui.showEdges);
  const layoutType = useVoxelStore((state) => state.ui.layoutType);
  const toggleLabels = useVoxelStore((state) => state.toggleLabels);
  const toggleEdges = useVoxelStore((state) => state.toggleEdges);
  const setLayoutType = useVoxelStore((state) => state.setLayoutType);

  // Handlers
  const handleResetView = useCallback(() => {
    onResetView?.();
  }, [onResetView]);

  const handleFitAll = useCallback(() => {
    onFitAll?.();
  }, [onFitAll]);

  const handleLayoutChange = useCallback(
    (layout: VoxelUIState['layoutType']) => {
      setLayoutType(layout);
    },
    [setLayoutType]
  );

  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-voxel-ui ${className}`}
    >
      <div
        className="flex items-center gap-1 p-1.5 rounded-2xl"
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Navigation Controls */}
        <ToolbarButton
          icon={<Home className="w-4 h-4" />}
          label="Reset View"
          onClick={handleResetView}
        />
        <ToolbarButton
          icon={<Maximize2 className="w-4 h-4" />}
          label="Fit All"
          onClick={handleFitAll}
        />

        <ToolbarDivider />

        {/* Visibility Toggles */}
        <ToolbarButton
          icon={<Tag className="w-4 h-4" />}
          label={showLabels ? 'Hide Labels' : 'Show Labels'}
          onClick={toggleLabels}
          active={showLabels}
        />
        <ToolbarButton
          icon={showEdges ? <GitBranch className="w-4 h-4" /> : <GitBranch className="w-4 h-4 opacity-60" />}
          label={showEdges ? 'Hide Edges' : 'Show Edges'}
          onClick={toggleEdges}
          active={showEdges}
        />

        <ToolbarDivider />

        {/* Layout Selection */}
        <div className="flex items-center gap-0.5">
          {LAYOUT_OPTIONS.map((option) => (
            <ToolbarButton
              key={option.value || 'unknown'}
              icon={option.icon}
              label={`${option.label} Layout`}
              onClick={() => handleLayoutChange(option.value)}
              active={layoutType === option.value}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoxelToolbar;
