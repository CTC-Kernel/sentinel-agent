/**
 * useRiskDraftPersistence - Local storage draft persistence for risk forms (Story 3.1)
 *
 * Provides local storage backup for risk form data to prevent data loss.
 * Drafts are keyed by organization and risk ID.
 *
 * @module useRiskDraftPersistence
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ErrorLogger } from '../../services/errorLogger';
import { RiskFormData } from '../../schemas/riskSchema';
import { canSaveRiskAsDraft } from '../../utils/riskDraftSchema';

/**
 * Storage key prefix for risk drafts
 */
const STORAGE_KEY_PREFIX = 'sentinel_risk_draft';

/**
 * Options for the risk draft persistence hook
 */
export interface UseRiskDraftPersistenceOptions {
  /** Organization ID for the storage key */
  organizationId: string;
  /** Risk ID or 'new' for new risks */
  riskId?: string;
  /** Whether persistence is enabled */
  enabled?: boolean;
  /** Debounce delay for saving to localStorage (ms) */
  debounceMs?: number;
}

/**
 * Return type for the risk draft persistence hook
 */
export interface UseRiskDraftPersistenceReturn {
  /** Saved draft data from localStorage, null if none exists */
  savedDraft: Partial<RiskFormData> | null;
  /** Save form data to localStorage */
  saveDraft: (data: Partial<RiskFormData>) => void;
  /** Clear the saved draft from localStorage */
  clearDraft: () => void;
  /** Check if there's a saved draft available */
  hasDraft: boolean;
  /** Timestamp of last save */
  lastSavedAt: Date | null;
}

/**
 * Generates a storage key for risk draft data.
 */
export function getRiskDraftStorageKey(organizationId: string, riskId?: string): string {
  const id = riskId || 'new';
  return `${STORAGE_KEY_PREFIX}_${organizationId}_${id}`;
}

/**
 * Hook for persisting risk form drafts to localStorage.
 *
 * Provides automatic backup of form data to prevent data loss from
 * accidental navigation or browser issues.
 *
 * @param options - Configuration options
 * @returns Draft persistence state and controls
 *
 * @example
 * ```tsx
 * const { savedDraft, saveDraft, clearDraft, hasDraft } = useRiskDraftPersistence({
 *   organizationId: user.organizationId,
 *   riskId: existingRisk?.id,
 *   enabled: true,
 * });
 *
 * // On form mount, restore saved draft if available
 * useEffect(() => {
 *   if (hasDraft && savedDraft) {
 *     form.reset(savedDraft);
 *   }
 * }, []);
 *
 * // On form change, persist to localStorage
 * useEffect(() => {
 *   saveDraft(formData);
 * }, [formData]);
 *
 * // On successful save, clear the draft
 * const handleSubmit = async (data) => {
 *   await saveRisk(data);
 *   clearDraft();
 * };
 * ```
 */
/**
 * Helper to load draft from localStorage
 */
function loadDraftFromStorage(
  storageKey: string,
  enabled: boolean,
  organizationId: string
): { draft: Partial<RiskFormData> | null; savedAt: Date | null } {
  if (!enabled || !organizationId) {
    return { draft: null, savedAt: null };
  }

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        const { canSave } = canSaveRiskAsDraft(parsed.data || {});
        if (canSave || parsed.data?.threat) {
          return {
            draft: parsed.data,
            savedAt: parsed.savedAt ? new Date(parsed.savedAt) : null
          };
        }
      }
    }
  } catch (error) {
    ErrorLogger.warn('Error loading risk draft from localStorage', 'useRiskDraftPersistence', {
      metadata: { error, key: storageKey }
    });
  }

  return { draft: null, savedAt: null };
}

export function useRiskDraftPersistence({
  organizationId,
  riskId,
  enabled = true,
  debounceMs = 1000,
}: UseRiskDraftPersistenceOptions): UseRiskDraftPersistenceReturn {
  const storageKey = getRiskDraftStorageKey(organizationId, riskId);

  // Use lazy initialization to load from localStorage synchronously on mount
  const [savedDraft, setSavedDraft] = useState<Partial<RiskFormData> | null>(() => {
    return loadDraftFromStorage(storageKey, enabled, organizationId).draft;
  });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => {
    return loadDraftFromStorage(storageKey, enabled, organizationId).savedAt;
  });
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Save form data to localStorage (debounced)
   */
  const saveDraft = useCallback((data: Partial<RiskFormData>) => {
    if (!enabled || !organizationId) return;

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Debounce the save
    debounceTimeout.current = setTimeout(() => {
      try {
        // Only persist if there's meaningful data (threat must exist)
        const { canSave } = canSaveRiskAsDraft(data as Record<string, unknown>);
        if (!canSave && !data.threat) {
          return;
        }

        const payload = {
          data,
          savedAt: new Date().toISOString(),
          version: 1,
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setSavedDraft(data);
        setLastSavedAt(new Date());
      } catch (error) {
        ErrorLogger.warn('Error saving risk draft to localStorage', 'useRiskDraftPersistence', {
          metadata: { error, key: storageKey }
        });
      }
    }, debounceMs);
  }, [storageKey, enabled, organizationId, debounceMs]);

  /**
   * Clear the saved draft from localStorage
   */
  const clearDraft = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    try {
      localStorage.removeItem(storageKey);
      setSavedDraft(null);
      setLastSavedAt(null);
    } catch (error) {
      ErrorLogger.warn('Error clearing risk draft from localStorage', 'useRiskDraftPersistence', {
        metadata: { error, key: storageKey }
      });
    }
  }, [storageKey]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return {
    savedDraft,
    saveDraft,
    clearDraft,
    hasDraft: savedDraft !== null,
    lastSavedAt,
  };
}

/**
 * Utility function to clear all risk drafts for an organization.
 * Useful for cleanup when user logs out.
 */
export function clearAllRiskDrafts(organizationId: string): void {
  try {
    const prefix = `${STORAGE_KEY_PREFIX}_${organizationId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    ErrorLogger.warn('Error clearing all risk drafts from localStorage', 'clearAllRiskDrafts', {
      metadata: { error, organizationId }
    });
  }
}

export default useRiskDraftPersistence;
