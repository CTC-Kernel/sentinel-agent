/**
 * Story 31.5 - URL State Sharing
 *
 * Hook for serializing Voxel view state to URL parameters.
 * Enables deep linking and shareable view configurations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useVoxelStore, useCurrentPreset } from '@/stores/voxelStore';
import {
  VIEW_PRESETS,
  isValidPreset,
  serializePresetToUrl,
  deserializePresetFromUrl,
  type ExtendedViewPresetConfig,
} from '@/stores/viewPresets';
import type { ViewPreset, VoxelNodeType } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelUrlState {
  /** Active preset name */
  preset?: ViewPreset;
  /** Custom configuration (encoded) */
  config?: string;
  /** Selected node ID */
  selectedNode?: string;
  /** Camera position (encoded) */
  camera?: string;
  /** Visible layers */
  layers?: VoxelNodeType[];
  /** Layout type */
  layout?: string;
  /** Historical snapshot date (YYYY-MM-DD) */
  snapshot?: string;
}

export interface UseVoxelUrlStateOptions {
  /** Whether to automatically sync state to URL */
  autoSync?: boolean;
  /** Debounce delay for URL updates (ms) */
  debounceMs?: number;
  /** Base path for the voxel view */
  basePath?: string;
}

export interface UseVoxelUrlStateReturn {
  /** Current URL state */
  urlState: VoxelUrlState;
  /** Update URL with current view state */
  syncToUrl: () => void;
  /** Apply URL state to the view */
  applyFromUrl: () => boolean;
  /** Generate a shareable URL for current state */
  getShareableUrl: () => string;
  /** Copy shareable URL to clipboard */
  copyLinkToClipboard: () => Promise<boolean>;
  /** Clear all URL parameters */
  clearUrlState: () => void;
  /** Whether URL state has been applied */
  hasAppliedUrlState: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const URL_PARAMS = {
  PRESET: 'preset',
  CONFIG: 'config',
  NODE: 'node',
  CAMERA: 'cam',
  LAYERS: 'layers',
  LAYOUT: 'layout',
  SNAPSHOT: 'snapshot',
} as const;

const DEFAULT_OPTIONS: Required<UseVoxelUrlStateOptions> = {
  autoSync: false,
  debounceMs: 500,
  basePath: '/voxel',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Encode camera position to URL-safe string
 */
function encodeCameraPosition(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): string {
  const p = [
    Math.round(position.x * 10) / 10,
    Math.round(position.y * 10) / 10,
    Math.round(position.z * 10) / 10,
  ];
  const t = [
    Math.round(target.x * 10) / 10,
    Math.round(target.y * 10) / 10,
    Math.round(target.z * 10) / 10,
  ];
  return btoa(`${p.join(',')};${t.join(',')}`);
}

/**
 * Decode camera position from URL string
 */
function decodeCameraPosition(encoded: string): {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
} | null {
  try {
    const decoded = atob(encoded);
    const [posStr, targetStr] = decoded.split(';');
    const [px, py, pz] = posStr.split(',').map(Number);
    const [tx, ty, tz] = targetStr.split(',').map(Number);

    if ([px, py, pz, tx, ty, tz].some(isNaN)) return null;

    return {
      position: { x: px, y: py, z: pz },
      target: { x: tx, y: ty, z: tz },
    };
  } catch {
    return null;
  }
}

/**
 * Encode layers to URL-safe string
 */
function encodeLayers(layers: VoxelNodeType[]): string {
  const shorthand: Record<VoxelNodeType, string> = {
    asset: 'a',
    risk: 'r',
    control: 'c',
    incident: 'i',
    supplier: 's',
    project: 'p',
    audit: 'u',
  };
  return layers.map(l => shorthand[l]).join('');
}

/**
 * Decode layers from URL string
 */
function decodeLayers(encoded: string): VoxelNodeType[] {
  const expansion: Record<string, VoxelNodeType> = {
    a: 'asset',
    r: 'risk',
    c: 'control',
    i: 'incident',
    s: 'supplier',
    p: 'project',
    u: 'audit',
  };
  return encoded.split('').map(c => expansion[c]).filter(Boolean);
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVoxelUrlState(
  options?: UseVoxelUrlStateOptions
): UseVoxelUrlStateReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Store state
  const currentPreset = useCurrentPreset();
  const ui = useVoxelStore((s) => s.ui);
  const filters = useVoxelStore((s) => s.filters);
  const applyPreset = useVoxelStore((s) => s.applyPreset);
  const selectNode = useVoxelStore((s) => s.selectNode);
  const setCameraPosition = useVoxelStore((s) => s.setCameraPosition);
  const setCameraTarget = useVoxelStore((s) => s.setCameraTarget);
  const setLayoutType = useVoxelStore((s) => s.setLayoutType);
  const setNodeTypeFilter = useVoxelStore((s) => s.setNodeTypeFilter);

  // Track whether URL state has been applied
  const [hasAppliedUrlState, setHasAppliedUrlState] = useState(false);
  const initialLoadRef = useRef(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Parse current URL state
   */
  const parseUrlState = useCallback((): VoxelUrlState => {
    const preset = searchParams.get(URL_PARAMS.PRESET) as ViewPreset | null;
    const config = searchParams.get(URL_PARAMS.CONFIG);
    const node = searchParams.get(URL_PARAMS.NODE);
    const camera = searchParams.get(URL_PARAMS.CAMERA);
    const layersParam = searchParams.get(URL_PARAMS.LAYERS);
    const layout = searchParams.get(URL_PARAMS.LAYOUT);
    const snapshot = searchParams.get(URL_PARAMS.SNAPSHOT);

    return {
      preset: preset && isValidPreset(preset) ? preset : undefined,
      config: config || undefined,
      selectedNode: node || undefined,
      camera: camera || undefined,
      layers: layersParam ? decodeLayers(layersParam) : undefined,
      layout: layout || undefined,
      snapshot: snapshot || undefined,
    };
  }, [searchParams]);

  /**
   * Apply URL state to the Voxel view
   */
  const applyFromUrl = useCallback((): boolean => {
    const state = parseUrlState();
    let applied = false;

    // Apply preset
    if (state.preset) {
      applyPreset(state.preset);
      applied = true;
    }

    // Apply custom config
    if (state.config) {
      const config = deserializePresetFromUrl(state.config);
      if (config) {
        if (config.camera) {
          setCameraPosition(config.camera.position);
          setCameraTarget(config.camera.target);
        }
        if (config.layers) {
          setNodeTypeFilter(config.layers);
        }
        if (config.layout) {
          setLayoutType(config.layout);
        }
        applied = true;
      }
    }

    // Apply camera
    if (state.camera) {
      const camera = decodeCameraPosition(state.camera);
      if (camera) {
        setCameraPosition(camera.position);
        setCameraTarget(camera.target);
        applied = true;
      }
    }

    // Apply layers
    if (state.layers && state.layers.length > 0) {
      setNodeTypeFilter(state.layers);
      applied = true;
    }

    // Apply layout
    if (state.layout) {
      const validLayouts = ['force', 'hierarchical', 'radial', 'timeline'];
      if (validLayouts.includes(state.layout)) {
        setLayoutType(state.layout as typeof ui.layoutType);
        applied = true;
      }
    }

    // Apply selected node
    if (state.selectedNode) {
      selectNode(state.selectedNode);
      applied = true;
    }

    setHasAppliedUrlState(applied);
    return applied;
  }, [
    parseUrlState,
    applyPreset,
    setCameraPosition,
    setCameraTarget,
    setNodeTypeFilter,
    setLayoutType,
    selectNode,
    ui.layoutType,
  ]);

  /**
   * Sync current view state to URL
   */
  const syncToUrl = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);

    // Clear existing voxel params
    Object.values(URL_PARAMS).forEach(param => newParams.delete(param));

    // Add preset if not custom
    if (currentPreset !== 'custom') {
      newParams.set(URL_PARAMS.PRESET, currentPreset);
    } else {
      // Encode custom configuration
      const config = serializePresetToUrl({
        layers: filters.nodeTypes,
        layout: ui.layoutType,
        camera: {
          position: ui.cameraPosition,
          target: ui.cameraTarget,
        },
        description: '',
        icon: '',
        colorScheme: 'default',
      });
      newParams.set(URL_PARAMS.CONFIG, config);
    }

    // Add selected node
    if (ui.selectedNodeId) {
      newParams.set(URL_PARAMS.NODE, ui.selectedNodeId);
    }

    setSearchParams(newParams, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    currentPreset,
    filters.nodeTypes,
    ui.layoutType,
    ui.cameraPosition,
    ui.cameraTarget,
    ui.selectedNodeId,
  ]);

  /**
   * Generate a shareable URL
   */
  const getShareableUrl = useCallback((): string => {
    const base = window.location.origin + opts.basePath;
    const params = new URLSearchParams();

    // Add preset or config
    if (currentPreset !== 'custom') {
      params.set(URL_PARAMS.PRESET, currentPreset);
    } else {
      const config = serializePresetToUrl({
        layers: filters.nodeTypes,
        layout: ui.layoutType,
        camera: {
          position: ui.cameraPosition,
          target: ui.cameraTarget,
        },
        description: '',
        icon: '',
        colorScheme: 'default',
      });
      params.set(URL_PARAMS.CONFIG, config);
    }

    // Add selected node
    if (ui.selectedNodeId) {
      params.set(URL_PARAMS.NODE, ui.selectedNodeId);
    }

    return `${base}?${params.toString()}`;
  }, [
    opts.basePath,
    currentPreset,
    filters.nodeTypes,
    ui.layoutType,
    ui.cameraPosition,
    ui.cameraTarget,
    ui.selectedNodeId,
  ]);

  /**
   * Copy shareable URL to clipboard
   */
  const copyLinkToClipboard = useCallback(async (): Promise<boolean> => {
    try {
      const url = getShareableUrl();
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.error('Failed to copy URL to clipboard:', error);
      return false;
    }
  }, [getShareableUrl]);

  /**
   * Clear all URL state
   */
  const clearUrlState = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    Object.values(URL_PARAMS).forEach(param => newParams.delete(param));
    setSearchParams(newParams, { replace: true });
    setHasAppliedUrlState(false);
  }, [searchParams, setSearchParams]);

  // Apply URL state on initial load
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      const hasState = Object.values(URL_PARAMS).some(p => searchParams.has(p));
      if (hasState) {
        applyFromUrl();
      }
    }
  }, [applyFromUrl, searchParams]);

  // Auto-sync to URL (debounced)
  useEffect(() => {
    if (!opts.autoSync || initialLoadRef.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      syncToUrl();
    }, opts.debounceMs);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [
    opts.autoSync,
    opts.debounceMs,
    syncToUrl,
    currentPreset,
    ui.cameraPosition,
    ui.selectedNodeId,
    filters.nodeTypes,
  ]);

  return {
    urlState: parseUrlState(),
    syncToUrl,
    applyFromUrl,
    getShareableUrl,
    copyLinkToClipboard,
    clearUrlState,
    hasAppliedUrlState,
  };
}

export default useVoxelUrlState;
