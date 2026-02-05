/**
 * Story 36-3: IT/OT Voxel Mapping - Segment Filter Hook
 *
 * Hook for managing segment visibility state.
 * Separated from SegmentFilter.tsx to fix fast refresh warnings.
 */

import React, { useCallback, useState } from 'react';
import type { NetworkSegment } from '../../types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface SegmentVisibility {
 IT: boolean;
 OT: boolean;
 DMZ: boolean;
}

export type SegmentFilterPreset = 'all' | 'it-only' | 'ot-only' | 'it-ot-boundary' | 'dmz-focus';

// ============================================================================
// Constants
// ============================================================================

export const PRESET_CONFIGS: Record<SegmentFilterPreset, SegmentVisibility> = {
 all: { IT: true, OT: true, DMZ: true },
 'it-only': { IT: true, OT: false, DMZ: false },
 'ot-only': { IT: false, OT: true, DMZ: false },
 'it-ot-boundary': { IT: true, OT: true, DMZ: true },
 'dmz-focus': { IT: false, OT: false, DMZ: true },
};

// ============================================================================
// Hook
// ============================================================================

export interface UseSegmentFilterOptions {
 /** Initial visibility state */
 initialVisibility?: SegmentVisibility;
 /** Callback when visibility changes */
 onChange?: (visibility: SegmentVisibility) => void;
}

export interface UseSegmentFilterResult {
 visibility: SegmentVisibility;
 setVisibility: React.Dispatch<React.SetStateAction<SegmentVisibility>>;
 toggleSegment: (segment: NetworkSegment) => void;
 showAll: () => void;
 hideAll: () => void;
 applyPreset: (preset: SegmentFilterPreset) => void;
 showCrossSegmentOnly: boolean;
 setShowCrossSegmentOnly: React.Dispatch<React.SetStateAction<boolean>>;
 isSegmentVisible: (segment?: NetworkSegment) => boolean;
}

export function useSegmentFilter(
 options: UseSegmentFilterOptions = {}
): UseSegmentFilterResult {
 const { initialVisibility = { IT: true, OT: true, DMZ: true }, onChange } = options;

 const [visibility, setVisibilityState] = useState<SegmentVisibility>(initialVisibility);
 const [showCrossSegmentOnly, setShowCrossSegmentOnly] = useState(false);

 // Wrapper for setVisibility that also calls onChange
 const setVisibility: React.Dispatch<React.SetStateAction<SegmentVisibility>> = useCallback(
 (action) => {
 setVisibilityState((prev) => {
 const next = typeof action === 'function' ? action(prev) : action;
 onChange?.(next);
 return next;
 });
 },
 [onChange]
 );

 const toggleSegment = useCallback(
 (segment: NetworkSegment) => {
 setVisibility((prev) => ({
 ...prev,
 [segment]: !prev[segment],
 }));
 },
 [setVisibility]
 );

 const showAll = useCallback(() => {
 setVisibility({ IT: true, OT: true, DMZ: true });
 }, [setVisibility]);

 const hideAll = useCallback(() => {
 setVisibility({ IT: false, OT: false, DMZ: false });
 }, [setVisibility]);

 const applyPreset = useCallback(
 (preset: SegmentFilterPreset) => {
 setVisibility(PRESET_CONFIGS[preset]);
 setShowCrossSegmentOnly(preset === 'it-ot-boundary');
 },
 [setVisibility]
 );

 const isSegmentVisible = useCallback(
 (segment?: NetworkSegment) => {
 if (!segment) return true;
 return visibility[segment];
 },
 [visibility]
 );

 return {
 visibility,
 setVisibility,
 toggleSegment,
 showAll,
 hideAll,
 applyPreset,
 showCrossSegmentOnly,
 setShowCrossSegmentOnly,
 isSegmentVisible,
 };
}

export default useSegmentFilter;
