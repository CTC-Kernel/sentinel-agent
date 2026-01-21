/**
 * Portal Auto-Save Hook
 * Debounced auto-save for vendor portal questionnaire answers
 * Story 37-2: Vendor Self-Service Portal
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { VendorPortalService } from '../services/VendorPortalService';
import { QuestionAnswer, SaveStatus } from '../types/vendorPortal';
import { ErrorLogger } from '../services/errorLogger';

const DEBOUNCE_DELAY = 2000; // 2 seconds

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

  // Cleanup on unmount
  useEffect(() => {
    const currentPendingSaves = pendingSaves.current;
    const currentDebounceTimer = debounceTimer.current;

    return () => {
      if (currentDebounceTimer) {
        clearTimeout(currentDebounceTimer);
      }
      // Save any pending on unmount
      if (currentPendingSaves.size > 0 && !isReadOnly) {
        flushSaves();
      }
    };
  }, [flushSaves, isReadOnly]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaves.current.size > 0 && !isReadOnly) {
        e.preventDefault();
        e.returnValue = '';
        flushSaves();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSaves, isReadOnly]);

  return {
    saveStatus,
    saveAnswer,
    saveAllPending,
    lastSavedAt,
    pendingCount,
  };
}

export default usePortalAutoSave;
