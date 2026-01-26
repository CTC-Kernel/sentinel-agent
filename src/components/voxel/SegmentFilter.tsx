/**
 * Story 36-3: IT/OT Voxel Mapping - Segment Filter UI
 *
 * Filter controls for network segment visibility:
 * - Toggle buttons for IT/OT/DMZ visibility
 * - Quick filter presets (OT Only, IT-OT Boundary)
 * - Smooth visibility transitions
 * - Integration with Voxel store
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Filter, Server, Factory, Shield, Eye, EyeOff, ChevronDown } from '../ui/Icons';
import type { NetworkSegment } from '../../types/voxel';
import { SEGMENT_COLORS } from './voxelConstants';
import {
  type SegmentVisibility,
  type SegmentFilterPreset,
  PRESET_CONFIGS
} from './useSegmentFilter';

// ============================================================================
// Types
// ============================================================================

export interface SegmentFilterProps {
  /** Current visibility state */
  visibility: SegmentVisibility;
  /** Callback when visibility changes */
  onVisibilityChange: (visibility: SegmentVisibility) => void;
  /** Show cross-segment connections only */
  showCrossSegmentOnly?: boolean;
  /** Callback for cross-segment toggle */
  onCrossSegmentChange?: (show: boolean) => void;
  /** Node counts per segment */
  nodeCounts?: Record<NetworkSegment, number>;
  /** Additional class name */
  className?: string;
  /** Compact mode for toolbar */
  compact?: boolean;
}

// Re-export types for convenience
export type { SegmentVisibility, SegmentFilterPreset };

// ============================================================================
// Constants
// ============================================================================

const SEGMENT_ICONS: Record<NetworkSegment, React.ReactNode> = {
  IT: <Server className="h-4 w-4" />,
  OT: <Factory className="h-4 w-4" />,
  DMZ: <Shield className="h-4 w-4" />,
};

const SEGMENT_LABELS: Record<NetworkSegment, string> = {
  IT: 'IT',
  OT: 'OT',
  DMZ: 'DMZ',
};

// ============================================================================
// Segment Toggle Button
// ============================================================================

interface SegmentToggleProps {
  segment: NetworkSegment;
  isActive: boolean;
  nodeCount?: number;
  onClick: () => void;
  compact?: boolean;
}

const SegmentToggle: React.FC<SegmentToggleProps> = React.memo(
  ({ segment, isActive, nodeCount, onClick, compact }) => {
    const color = SEGMENT_COLORS[segment];

    return (
      <button
        onClick={onClick}
        className={cn(
          'relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
          'border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isActive
            ? 'bg-opacity-20 border-opacity-50'
            : 'bg-slate-800/50 border-slate-700/50 opacity-50 hover:opacity-75',
          compact && 'px-2 py-1.5'
        )}
        style={{
          backgroundColor: isActive ? `${color}20` : undefined,
          borderColor: isActive ? `${color}80` : undefined,
        }}
        aria-pressed={isActive}
        aria-label={`Toggle ${SEGMENT_LABELS[segment]} visibility`}
      >
        {/* Icon */}
        <span
          className={cn('transition-colors', isActive ? 'text-white' : 'text-slate-500')}
          style={{ color: isActive ? color : undefined }}
        >
          {SEGMENT_ICONS[segment]}
        </span>

        {/* Label */}
        {!compact && (
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              isActive ? 'text-white' : 'text-slate-500'
            )}
          >
            {SEGMENT_LABELS[segment]}
          </span>
        )}

        {/* Node count badge */}
        {nodeCount !== undefined && nodeCount > 0 && (
          <span
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-medium rounded-full transition-colors',
              isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
            )}
          >
            {nodeCount}
          </span>
        )}

        {/* Active indicator dot */}
        {isActive && (
          <span
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
        )}
      </button>
    );
  }
);

// ============================================================================
// Preset Dropdown
// ============================================================================

interface PresetDropdownProps {
  currentPreset: SegmentFilterPreset;
  onPresetChange: (preset: SegmentFilterPreset) => void;
}

const PresetDropdown: React.FC<PresetDropdownProps> = React.memo(
  ({ currentPreset, onPresetChange }) => {
    const { t } = useTranslation();

    const presets: Array<{ key: SegmentFilterPreset; label: string; description: string }> = [
      {
        key: 'all',
        label: t('voxelOT.filter.presets.all', 'Tous les segments'),
        description: t('voxelOT.filter.presets.allDesc', 'Afficher IT, OT et DMZ'),
      },
      {
        key: 'ot-only',
        label: t('voxelOT.filter.presets.otOnly', 'OT uniquement'),
        description: t('voxelOT.filter.presets.otOnlyDesc', 'Focus sur les actifs industriels'),
      },
      {
        key: 'it-only',
        label: t('voxelOT.filter.presets.itOnly', 'IT uniquement'),
        description: t('voxelOT.filter.presets.itOnlyDesc', 'Focus sur le réseau corporate'),
      },
      {
        key: 'it-ot-boundary',
        label: t('voxelOT.filter.presets.boundary', 'Frontière IT-OT'),
        description: t('voxelOT.filter.presets.boundaryDesc', 'Connexions inter-segments'),
      },
      {
        key: 'dmz-focus',
        label: t('voxelOT.filter.presets.dmz', 'Focus DMZ'),
        description: t('voxelOT.filter.presets.dmzDesc', 'Zone démilitarisée'),
      },
    ];

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">
              {presets.find((p) => p.key === currentPreset)?.label || 'Filtre'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            {t('voxelOT.filter.title', 'Filtrer par segment')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {presets.map((preset) => (
              <DropdownMenuItem
                key={preset.key}
                onClick={() => onPresetChange(preset.key)}
                className="gap-3 cursor-pointer py-2"
              >
                <div className="flex-1">
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                </div>
                {currentPreset === preset.key && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

// ============================================================================
// Main SegmentFilter Component
// ============================================================================

export const SegmentFilter: React.FC<SegmentFilterProps> = React.memo(
  ({
    visibility,
    onVisibilityChange,
    showCrossSegmentOnly = false,
    onCrossSegmentChange,
    nodeCounts,
    className,
    compact = false,
  }) => {
    const { t } = useTranslation();

    // Determine current preset from visibility state
    const currentPreset = useMemo<SegmentFilterPreset>(() => {
      const { IT, OT, DMZ } = visibility;
      if (IT && OT && DMZ) return 'all';
      if (!IT && OT && !DMZ) return 'ot-only';
      if (IT && !OT && !DMZ) return 'it-only';
      if (!IT && !OT && DMZ) return 'dmz-focus';
      if (IT && OT && DMZ && showCrossSegmentOnly) return 'it-ot-boundary';
      return 'all';
    }, [visibility, showCrossSegmentOnly]);

    // Toggle individual segment
    const handleToggleSegment = useCallback(
      (segment: NetworkSegment) => {
        onVisibilityChange({
          ...visibility,
          [segment]: !visibility[segment],
        });
      },
      [visibility, onVisibilityChange]
    );

    // Apply preset
    const handlePresetChange = useCallback(
      (preset: SegmentFilterPreset) => {
        onVisibilityChange(PRESET_CONFIGS[preset]);

        // Handle cross-segment mode for boundary preset
        if (onCrossSegmentChange) {
          onCrossSegmentChange(preset === 'it-ot-boundary');
        }
      },
      [onVisibilityChange, onCrossSegmentChange]
    );

    // Toggle all visibility
    const handleToggleAll = useCallback(() => {
      const allVisible = visibility.IT && visibility.OT && visibility.DMZ;
      onVisibilityChange({
        IT: !allVisible,
        OT: !allVisible,
        DMZ: !allVisible,
      });
    }, [visibility, onVisibilityChange]);

    const allVisible = visibility.IT && visibility.OT && visibility.DMZ;
    const anyVisible = visibility.IT || visibility.OT || visibility.DMZ;

    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Segment toggles */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/50 backdrop-blur-sm border border-slate-800">
          {(['IT', 'OT', 'DMZ'] as NetworkSegment[]).map((segment) => (
            <SegmentToggle
              key={segment}
              segment={segment}
              isActive={visibility[segment]}
              nodeCount={nodeCounts?.[segment]}
              onClick={() => handleToggleSegment(segment)}
              compact={compact}
            />
          ))}
        </div>

        {/* Toggle all button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleAll}
          className="gap-1.5"
          title={allVisible ? t('voxelOT.filter.hideAll', 'Masquer tout') : t('voxelOT.filter.showAll', 'Afficher tout')}
        >
          {anyVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {!compact && (
            <span className="hidden sm:inline text-xs">
              {allVisible ? t('voxelOT.filter.hideAll', 'Masquer') : t('voxelOT.filter.showAll', 'Afficher')}
            </span>
          )}
        </Button>

        {/* Preset dropdown */}
        {!compact && (
          <PresetDropdown currentPreset={currentPreset} onPresetChange={handlePresetChange} />
        )}

        {/* Cross-segment toggle */}
        {onCrossSegmentChange && !compact && (
          <Button
            variant={showCrossSegmentOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCrossSegmentChange(!showCrossSegmentOnly)}
            className="gap-1.5"
            title={t('voxelOT.filter.crossSegment', 'Connexions inter-segments')}
          >
            <span className="text-xs">IT↔OT</span>
          </Button>
        )}
      </div>
    );
  }
);

SegmentFilter.displayName = 'SegmentFilter';

// Re-export hook and types from utility file for backward compatibility
/* eslint-disable react-refresh/only-export-components */
export {
  useSegmentFilter,
  type UseSegmentFilterOptions,
  type UseSegmentFilterResult
} from './useSegmentFilter';
/* eslint-enable react-refresh/only-export-components */

export default SegmentFilter;
