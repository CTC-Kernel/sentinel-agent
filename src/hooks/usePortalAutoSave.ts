/**
 * Portal Auto-Save Hook
 * Debounced auto-save for vendor portal questionnaire answers
 * Story 37-2: Vendor Self-Service Portal
 *
 * RELIABILITY FIX: Uses navigator.sendBeacon() for page unload to prevent data loss
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { VendorPortalService } from '../services/VendorPortalService';
import { QuestionAnswer, SaveStatus } from '../types/vendorPortal';
import { ErrorLogger } from '../services/errorLogger';

const DEBOUNCE_DELAY = 2000; // 2 seconds

// API endpoint for beacon saves (must be configured on backend)
const BEACON_SAVE_ENDPOINT = '/api/portal/save-answers';

interface UsePortalAutoSaveReturn {
  saveStatus: SaveStatus;
  saveAnswer: (questionId: string, answer: QuestionAnswer) => void;
  saveAllPending: () => Promise<void>;
  lastSavedAt?: string;
  pendingCount: number;
}

export function usePortalAutoSave(
  accessId: string,
  isReadOnly: boolean = false
): UsePortalAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState(0);

  // Track pending saves
  const pendingSaves = useRef<Map<string, QuestionAnswer>>(new Map());
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isSaving = useRef(false);

  // Flush pending saves
  const flushSaves = useCallback(async () => {
    if (isReadOnly || pendingSaves.current.size === 0 || isSaving.current) {
      return;
    }

    isSaving.current = true;
    setSaveStatus('saving');

    // Get all pending saves
    const savesToProcess = new Map(pendingSaves.current);
    pendingSaves.current.clear();
    setPendingCount(0);

    try {
      // Save each answer
      const savePromises = Array.from(savesToProcess.entries()).map(
        async ([questionId, answer]) => {
          await VendorPortalService.savePortalAnswer(accessId, questionId, answer);
        }
      );

      await Promise.all(savePromises);

      setSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());

      // Reset status after 3 seconds
      setTimeout(() => {
        setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
      }, 3000);
    } catch (error) {
      ErrorLogger.error(error, 'usePortalAutoSave.flushSaves');
      setSaveStatus('error');

      // Re-queue failed saves
      savesToProcess.forEach((answer, questionId) => {
        pendingSaves.current.set(questionId, answer);
      });
      setPendingCount(pendingSaves.current.size);

      // Retry after 5 seconds
      setTimeout(() => {
        flushSaves();
      }, 5000);
    } finally {
      isSaving.current = false;
    }
  }, [accessId, isReadOnly]);

  // Sync any pending saves from localStorage (from previous session crash/unload)
  useEffect(() => {
    if (isReadOnly) return;

    const storageKey = `portal_pending_saves_${accessId}`;
    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const pendingFromStorage = JSON.parse(savedData) as Array<{ questionId: string; answer: QuestionAnswer }>;
        if (pendingFromStorage.length > 0) {
          // Queue these saves
          pendingFromStorage.forEach(({ questionId, answer }) => {
            pendingSaves.current.set(questionId, answer);
          });
          setPendingCount(pendingSaves.current.size);

          // Clear localStorage and trigger save
          localStorage.removeItem(storageKey);
          flushSaves();
        }
      }
    } catch (error) {
      ErrorLogger.warn('Failed to restore pending saves from localStorage', 'usePortalAutoSave.restorePending', { metadata: { error } });
    }
  }, [accessId, isReadOnly, flushSaves]);

  // Save answer (debounced)
  const saveAnswer = useCallback(
    (questionId: string, answer: QuestionAnswer) => {
      if (isReadOnly) return;

      // Add to pending
      pendingSaves.current.set(questionId, answer);
      setPendingCount(pendingSaves.current.size);
      setSaveStatus('idle');

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new timer
      debounceTimer.current = setTimeout(() => {
        flushSaves();
      }, DEBOUNCE_DELAY);
    },
    [isReadOnly, flushSaves]
  );

  // Force save all pending
  const saveAllPending = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    await flushSaves();
  }, [flushSaves]);

  /**
   * Synchronous save using sendBeacon for page unload scenarios
   * sendBeacon guarantees the request will be sent even if the page is closing
   */
  const syncSaveWithBeacon = useCallback(() => {
    if (isReadOnly || pendingSaves.current.size === 0) {
      return;
    }

    const savesToProcess = Array.from(pendingSaves.current.entries()).map(
      ([questionId, answer]) => ({ questionId, answer })
    );

    // sendBeacon is synchronous and browser guarantees delivery
    const payload = JSON.stringify({
      accessId,
      answers: savesToProcess,
      timestamp: new Date().toISOString(),
    });

    const success = navigator.sendBeacon(BEACON_SAVE_ENDPOINT, payload);

    if (success) {
      pendingSaves.current.clear();
    } else {
      // Fallback: try localStorage for later sync
      try {
        const storageKey = `portal_pending_saves_${accessId}`;
        const existingData = localStorage.getItem(storageKey);
        const existing = existingData ? JSON.parse(existingData) : [];
        localStorage.setItem(storageKey, JSON.stringify([...existing, ...savesToProcess]));
        ErrorLogger.warn('sendBeacon failed, saved to localStorage for later sync', 'usePortalAutoSave.syncSaveWithBeacon');
      } catch (storageError) {
        ErrorLogger.error(storageError, 'usePortalAutoSave.syncSaveWithBeacon.localStorage');
      }
    }
  }, [accessId, isReadOnly]);

  // Cleanup on unmount - attempt async save with timeout
  useEffect(() => {
    const currentDebounceTimer = debounceTimer.current;
    const currentPendingSaves = pendingSaves.current;

    return () => {
      if (currentDebounceTimer) {
        clearTimeout(currentDebounceTimer);
      }

      // Attempt to save pending changes on unmount
      // Note: This is fire-and-forget since cleanup can't be async
      if (currentPendingSaves.size > 0 && !isReadOnly) {
        // Use sendBeacon as fallback since it's synchronous
        syncSaveWithBeacon();
      }
    };
  }, [syncSaveWithBeacon, isReadOnly]);

  // Save before page unload using sendBeacon (guaranteed delivery)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaves.current.size > 0 && !isReadOnly) {
        // Show confirmation dialog
        e.preventDefault();
        e.returnValue = '';

        // Use sendBeacon for guaranteed delivery
        syncSaveWithBeacon();
      }
    };

    // Also handle visibilitychange for mobile browsers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingSaves.current.size > 0 && !isReadOnly) {
        syncSaveWithBeacon();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncSaveWithBeacon, isReadOnly]);

  return {
    saveStatus,
    saveAnswer,
    saveAllPending,
    lastSavedAt,
    pendingCount,
  };
}

export default usePortalAutoSave;
