/**
 * useDashboardPreferences Hook
 * Manages dashboard layout preferences with Firestore persistence and localStorage fallback
 *
 * Story 2-6: Configurable Dashboard Widgets
 * Implements Task 3: Firestore persistence with cross-device sync
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import { getDefaultLayoutForRole } from '../config/dashboardDefaults';
import type { UserRole } from '../utils/roleUtils';

export interface WidgetLayout {
  id: string; // Unique instance ID
  widgetId: string; // Type of widget (e.g., 'stats-overview')
  colSpan?: number; // 1, 2, or 3 (out of 3 columns)
  isHidden?: boolean;
}

export interface DashboardPreferences {
  layout: WidgetLayout[];
  customized?: boolean;
}

interface FirestoreDashboardConfig {
  userId: string;
  role: string;
  layout: WidgetLayout[];
  customized: boolean;
  updatedAt: ReturnType<typeof serverTimestamp>;
  createdAt: ReturnType<typeof serverTimestamp>;
}

const STORAGE_KEY_PREFIX = 'sentinel_dashboard_prefs_v1_';
const DEBOUNCE_DELAY_MS = 1000;

/**
 * Queue for offline localStorage persistence
 */
interface OfflineQueueItem {
  userId: string;
  tenantId: string;
  role: string;
  layout: WidgetLayout[];
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'sentinel_dashboard_offline_queue';

function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToOfflineQueue(item: OfflineQueueItem): void {
  try {
    const queue = getOfflineQueue();
    // Keep only latest for each user/tenant
    const filtered = queue.filter(
      (q) => q.userId !== item.userId || q.tenantId !== item.tenantId
    );
    filtered.push(item);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore localStorage errors
  }
}

function clearOfflineQueueItem(userId: string, tenantId: string): void {
  try {
    const queue = getOfflineQueue();
    const filtered = queue.filter(
      (q) => q.userId !== userId || q.tenantId !== tenantId
    );
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get Firestore document path for dashboard config
 */
function getDashboardConfigPath(tenantId: string, userId: string): string {
  return `tenants/${tenantId}/dashboardConfigs/${userId}`;
}

/**
 * useDashboardPreferences hook with Firestore persistence
 *
 * @param userId - The user ID
 * @param tenantId - The tenant/organization ID
 * @param role - The user role for default layout
 * @param defaultLayout - Optional fallback default layout (overrides role defaults)
 *
 * @example
 * ```tsx
 * const { layout, updateLayout, resetLayout, hasLoaded, isCustomized } =
 *   useDashboardPreferences(userId, tenantId, 'rssi');
 * ```
 */
export const useDashboardPreferences = (
  userId: string | undefined,
  tenantId?: string | undefined,
  role: string = 'user',
  defaultLayout?: WidgetLayout[]
) => {
  // Calculate the effective default layout
  const effectiveDefaultLayout = useMemo(() => {
    return defaultLayout || getDefaultLayoutForRole(role as UserRole);
  }, [defaultLayout, role]);

  // Initialize state with localStorage data
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    if (!userId) return { layout: effectiveDefaultLayout, customized: false };

    const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.layout)) {
          const storedIds = new Set(parsed.layout.map((w: WidgetLayout) => w.widgetId));
          const newWidgets = effectiveDefaultLayout.filter(
            (w) => !storedIds.has(w.widgetId)
          );
          return {
            layout: [...parsed.layout, ...newWidgets],
            customized: parsed.customized ?? true,
          };
        }
      } catch (e) {
        ErrorLogger.warn('Failed to parse dashboard preferences', 'useDashboardPreferences.init', {
          metadata: { error: e },
        });
      }
    }
    return { layout: effectiveDefaultLayout, customized: false };
  });

  const [hasLoaded, setHasLoaded] = useState<boolean>(() => !userId);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  // Setup real-time Firestore listener
  useEffect(() => {
    if (!userId || !tenantId) {
      setHasLoaded(true);
      return;
    }

    const docPath = getDashboardConfigPath(tenantId, userId);
    const docRef = doc(db, docPath);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as FirestoreDashboardConfig;
          if (data.layout && Array.isArray(data.layout)) {
            // Merge with defaults for any new widgets
            const storedIds = new Set(data.layout.map((w) => w.widgetId));
            const newWidgets = effectiveDefaultLayout.filter(
              (w) => !storedIds.has(w.widgetId)
            );

            const mergedLayout =
              newWidgets.length > 0 ? [...data.layout, ...newWidgets] : data.layout;

            setPreferences({
              layout: mergedLayout,
              customized: data.customized ?? true,
            });

            // Sync to localStorage for offline access
            const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
            localStorage.setItem(key, JSON.stringify({ layout: mergedLayout, customized: data.customized ?? true }));

            // Clear any offline queue items for this user
            clearOfflineQueueItem(userId, tenantId);
          }
        } else {
          // Document doesn't exist yet - use defaults
          setPreferences({ layout: effectiveDefaultLayout, customized: false });
        }
        setHasLoaded(true);
      },
      (error) => {
        ErrorLogger.warn('Failed to listen to dashboard config', 'useDashboardPreferences.onSnapshot', {
          metadata: { error, userId, tenantId },
        });
        // Fall back to localStorage
        setHasLoaded(true);
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Check for offline queue items and sync them
    const offlineQueue = getOfflineQueue();
    const pendingItem = offlineQueue.find(
      (q) => q.userId === userId && q.tenantId === tenantId
    );
    if (pendingItem) {
      // Sync offline changes to Firestore
      saveToFirestore(tenantId, userId, role, pendingItem.layout, true);
    }

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [userId, tenantId, role, effectiveDefaultLayout]);

  /**
   * Save layout to Firestore with debouncing
   */
  const saveToFirestore = useCallback(
    async (
      targetTenantId: string,
      targetUserId: string,
      targetRole: string,
      layout: WidgetLayout[],
      customized: boolean
    ) => {
      if (!targetTenantId || !targetUserId) return;

      setIsSyncing(true);

      try {
        const docPath = getDashboardConfigPath(targetTenantId, targetUserId);
        const docRef = doc(db, docPath);

        await setDoc(
          docRef,
          {
            userId: targetUserId,
            role: targetRole,
            layout,
            customized,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Clear offline queue on successful save
        clearOfflineQueueItem(targetUserId, targetTenantId);
      } catch (error) {
        ErrorLogger.warn('Failed to save dashboard config to Firestore', 'useDashboardPreferences.saveToFirestore', {
          metadata: { error, userId: targetUserId, tenantId: targetTenantId },
        });

        // Add to offline queue for later sync
        addToOfflineQueue({
          userId: targetUserId,
          tenantId: targetTenantId,
          role: targetRole,
          layout,
          timestamp: Date.now(),
        });
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  /**
   * Update layout with debounced Firestore save
   */
  const updateLayout = useCallback(
    (newLayout: WidgetLayout[]) => {
      if (!userId) return;

      // Update local state immediately
      const newPrefs = { layout: newLayout, customized: true };
      setPreferences(newPrefs);

      // Save to localStorage immediately
      const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
      localStorage.setItem(key, JSON.stringify(newPrefs));

      // Debounce Firestore save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (tenantId) {
        saveTimeoutRef.current = setTimeout(() => {
          saveToFirestore(tenantId, userId, role, newLayout, true);
        }, DEBOUNCE_DELAY_MS);
      }
    },
    [userId, tenantId, role, saveToFirestore]
  );

  /**
   * Reset layout to role defaults
   */
  const resetLayout = useCallback(() => {
    if (!userId) return;

    const roleDefaults = getDefaultLayoutForRole(role as UserRole);
    const newPrefs = { layout: roleDefaults, customized: false };

    // Update local state
    setPreferences(newPrefs);

    // Clear localStorage
    const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
    localStorage.removeItem(key);

    // Clear from Firestore (delete or set customized: false)
    if (tenantId) {
      saveToFirestore(tenantId, userId, role, roleDefaults, false);
    }
  }, [userId, tenantId, role, saveToFirestore]);

  return {
    layout: preferences.layout,
    updateLayout,
    resetLayout,
    hasLoaded,
    isCustomized: preferences.customized ?? false,
    isSyncing,
  };
};

export default useDashboardPreferences;
