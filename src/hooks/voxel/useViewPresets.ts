/**
 * Story 31.1 - View Presets Hook
 *
 * React hook for managing Voxel view presets.
 * Provides preset selection, custom view management, and persistence.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useVoxelStore, useCurrentPreset } from '@/stores/voxelStore';
import {

  getAvailablePresets,
  getPresetConfig,
  isValidPreset,
  validatePresetConfig,
  createDefaultCustomView,
  type ExtendedViewPresetConfig,
  type CustomViewConfig,
} from '@/stores/viewPresets';
import type { ViewPreset } from '@/types/voxel';
import { useAuth } from '@/hooks/useAuth';
import { doc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export interface UseViewPresetsReturn {
  /** Current active preset */
  currentPreset: ViewPreset;
  /** Current preset configuration */
  currentConfig: ExtendedViewPresetConfig;
  /** All available built-in presets */
  builtInPresets: { key: ViewPreset; config: ExtendedViewPresetConfig }[];
  /** User's custom saved views */
  customViews: CustomViewConfig[];
  /** Loading state for custom views */
  isLoadingCustomViews: boolean;
  /** Apply a built-in preset */
  applyPreset: (preset: ViewPreset) => void;
  /** Apply a custom view */
  applyCustomView: (customView: CustomViewConfig) => void;
  /** Save current view as custom */
  saveCurrentAsCustom: (name: string, description?: string) => Promise<CustomViewConfig | null>;
  /** Update an existing custom view */
  updateCustomView: (id: string, updates: Partial<CustomViewConfig>) => Promise<boolean>;
  /** Delete a custom view */
  deleteCustomView: (id: string) => Promise<boolean>;
  /** Refresh custom views from Firestore */
  refreshCustomViews: () => Promise<void>;
  /** Check if preset is valid */
  isValidPreset: (preset: string) => boolean;
  /** Get preset keyboard shortcut */
  getPresetShortcut: (preset: ViewPreset) => string | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const KEYBOARD_SHORTCUTS: Record<ViewPreset, string> = {
  executive: '1',
  rssi: '2',
  auditor: '3',
  soc: '4',
  compliance: '5',
  custom: '0',
};

const CUSTOM_VIEWS_COLLECTION = 'voxel_custom_views';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useViewPresets(): UseViewPresetsReturn {
  const { user } = useAuth();
  const currentPreset = useCurrentPreset();
  const applyPresetAction = useVoxelStore((s) => s.applyPreset);
  const setCameraPosition = useVoxelStore((s) => s.setCameraPosition);
  const setCameraTarget = useVoxelStore((s) => s.setCameraTarget);
  const setLayoutType = useVoxelStore((s) => s.setLayoutType);
  const setNodeTypeFilter = useVoxelStore((s) => s.setNodeTypeFilter);
  const setShowAnomaliesOnly = useVoxelStore((s) => s.setShowAnomaliesOnly);
  const setStatusFilter = useVoxelStore((s) => s.setStatusFilter);
  const filters = useVoxelStore((s) => s.filters);
  const ui = useVoxelStore((s) => s.ui);

  const [customViews, setCustomViews] = useState<CustomViewConfig[]>([]);
  const [isLoadingCustomViews, setIsLoadingCustomViews] = useState(false);

  // Get built-in presets
  const builtInPresets = useMemo(() => getAvailablePresets(), []);

  // Get current config
  const currentConfig = useMemo(() => getPresetConfig(currentPreset), [currentPreset]);

  // Load custom views from Firestore
  const refreshCustomViews = useCallback(async () => {
    if (!user?.uid) {
      setCustomViews([]);
      return;
    }

    setIsLoadingCustomViews(true);
    try {
      const q = query(
        collection(db, CUSTOM_VIEWS_COLLECTION),
        where('createdBy', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const views: CustomViewConfig[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        views.push({
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        } as CustomViewConfig);
      });

      // Sort by updatedAt descending
      views.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      setCustomViews(views);
    } catch (error) {
      ErrorLogger.error(error, 'useViewPresets.refreshCustomViews');
    } finally {
      setIsLoadingCustomViews(false);
    }
  }, [user?.uid]);

  // Load custom views on mount and when user changes
  useEffect(() => {
    refreshCustomViews();
  }, [refreshCustomViews]);

  // Apply a built-in preset
  const applyPreset = useCallback((preset: ViewPreset) => {
    applyPresetAction(preset);
  }, [applyPresetAction]);

  // Apply a custom view
  const applyCustomView = useCallback((customView: CustomViewConfig) => {
    // Apply camera position
    setCameraPosition(customView.camera.position);
    setCameraTarget(customView.camera.target);

    // Apply layout
    setLayoutType(customView.layout);

    // Apply filters
    setNodeTypeFilter(customView.layers);
    if (customView.filters?.showAnomaliesOnly !== undefined) {
      setShowAnomaliesOnly(customView.filters.showAnomaliesOnly);
    }
    if (customView.filters?.statusFilter) {
      setStatusFilter(customView.filters.statusFilter);
    }
  }, [setCameraPosition, setCameraTarget, setLayoutType, setNodeTypeFilter, setShowAnomaliesOnly, setStatusFilter]);

  // Save current view as custom
  const saveCurrentAsCustom = useCallback(async (
    name: string,
    description?: string
  ): Promise<CustomViewConfig | null> => {
    if (!user?.uid) return null;

    const currentState: Partial<ExtendedViewPresetConfig> = {
      layers: filters.nodeTypes,
      layout: ui.layoutType,
      camera: {
        position: ui.cameraPosition,
        target: ui.cameraTarget,
      },
      colorScheme: 'default',
      filters: {
        showAnomaliesOnly: filters.showAnomaliesOnly,
        statusFilter: filters.statuses,
      },
    };

    const customView = createDefaultCustomView(name, currentState, user.uid);
    if (description) {
      customView.description = description;
    }

    // Validate before saving
    const validation = validatePresetConfig(customView);
    if (!validation.success) {
      ErrorLogger.error(validation.error, 'useViewPresets.saveCurrentAsCustom.validation');
      return null;
    }

    try {
      const docRef = doc(collection(db, CUSTOM_VIEWS_COLLECTION), customView.id);
      await setDoc(docRef, {
        ...customView,
        createdAt: customView.createdAt.toISOString(),
        updatedAt: customView.updatedAt.toISOString(),
      });

      setCustomViews(prev => [customView, ...prev]);
      return customView;
    } catch (error) {
      ErrorLogger.error(error, 'useViewPresets.saveCurrentAsCustom');
      return null;
    }
  }, [user?.uid, filters, ui]);

  // Update an existing custom view
  const updateCustomView = useCallback(async (
    id: string,
    updates: Partial<CustomViewConfig>
  ): Promise<boolean> => {
    if (!user?.uid) return false;

    const existing = customViews.find(v => v.id === id);
    if (!existing || existing.createdBy !== user.uid) return false;

    try {
      const docRef = doc(db, CUSTOM_VIEWS_COLLECTION, id);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(docRef, updateData);

      setCustomViews(prev => prev.map(v =>
        v.id === id ? { ...v, ...updates, updatedAt: new Date() } : v
      ));
      return true;
    } catch (error) {
      ErrorLogger.error(error, 'useViewPresets.updateCustomView');
      return false;
    }
  }, [user?.uid, customViews]);

  // Delete a custom view
  const deleteCustomView = useCallback(async (id: string): Promise<boolean> => {
    if (!user?.uid) return false;

    const existing = customViews.find(v => v.id === id);
    if (!existing || existing.createdBy !== user.uid) return false;

    try {
      const docRef = doc(db, CUSTOM_VIEWS_COLLECTION, id);
      await deleteDoc(docRef);
      setCustomViews(prev => prev.filter(v => v.id !== id));
      return true;
    } catch (error) {
      ErrorLogger.error(error, 'useViewPresets.deleteCustomView');
      return false;
    }
  }, [user?.uid, customViews]);

  // Get preset shortcut
  const getPresetShortcut = useCallback((preset: ViewPreset): string | undefined => {
    return KEYBOARD_SHORTCUTS[preset];
  }, []);

  return {
    currentPreset,
    currentConfig,
    builtInPresets,
    customViews,
    isLoadingCustomViews,
    applyPreset,
    applyCustomView,
    saveCurrentAsCustom,
    updateCustomView,
    deleteCustomView,
    refreshCustomViews,
    isValidPreset,
    getPresetShortcut,
  };
}

export default useViewPresets;
