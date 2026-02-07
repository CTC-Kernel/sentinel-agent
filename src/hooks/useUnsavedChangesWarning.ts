/**
 * useUnsavedChangesWarning Hook (Story 1.4)
 *
 * Provides navigation blocking when there are unsaved changes.
 * Handles both browser navigation (beforeunload) and React Router navigation.
 *
 * @module useUnsavedChangesWarning
 */

import { useEffect, useCallback, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useLocale } from './useLocale';
import type { SupportedLocale } from '../config/localeConfig';

/**
 * Localized warning messages
 */
const warningMessages = {
 fr: 'Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter?',
 en: 'You have unsaved changes. Are you sure you want to leave?',
 de: 'Sie haben nicht gespeicherte Änderungen. Sind Sie sicher, dass Sie die Seite verlassen möchten?',
} as const;

// getUnsavedChangesWarning moved inline -- non-hook utility functions should not be exported from /hooks/
function getUnsavedChangesWarning(locale: SupportedLocale): string {
 return warningMessages[locale];
}

/**
 * Options for configuring unsaved changes warning behavior
 */
export interface UseUnsavedChangesWarningOptions {
 /** Whether there are currently unsaved changes */
 hasUnsavedChanges: boolean;
 /** Custom warning message (optional, uses localized default if not provided) */
 message?: string;
 /** Whether the warning is enabled (default: true) */
 enabled?: boolean;
}

/**
 * Return type for the useUnsavedChangesWarning hook
 */
export interface UseUnsavedChangesWarningReturn {
 /** Whether there are unsaved changes */
 hasUnsavedChanges: boolean;
 /** Whether the navigation is currently blocked */
 isBlocked: boolean;
 /** Proceed with navigation (unblock) */
 proceed: () => void;
 /** Cancel navigation (stay on page) */
 cancel: () => void;
 /** Reset the blocked state */
 reset: () => void;
 /** Programmatically bypass the warning (for save-then-navigate flows) */
 bypass: () => void;
}

/**
 * Hook to warn users about unsaved changes when navigating away.
 *
 * Implements ADR-002 requirement for confirmation before leaving with unsaved changes.
 * Handles:
 * - Browser close/refresh (beforeunload event)
 * - React Router navigation (useBlocker)
 *
 * @param options - Configuration options
 * @returns State and control functions for unsaved changes warning
 *
 * @example
 * ```tsx
 * function MyForm() {
 * const [isDirty, setIsDirty] = useState(false);
 *
 * const { isBlocked, proceed, cancel } = useUnsavedChangesWarning({
 * hasUnsavedChanges: isDirty,
 * });
 *
 * return (
 * <div>
 * <form onChange={() => setIsDirty(true)}>
 * {...}
 * </form>
 *
 * {isBlocked && (
 * <ConfirmDialog
 * title="Unsaved Changes"
 * message="You have unsaved changes. Are you sure you want to leave?"
 * onConfirm={proceed}
 * onCancel={cancel}
 * />
 * )}
 * </div>
 * );
 * }
 * ```
 */
export function useUnsavedChangesWarning({
 hasUnsavedChanges,
 message,
 enabled = true,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningReturn {
 const { locale } = useLocale();
 const [isBypassed, setIsBypassed] = useState(false);

 // Get the warning message
 const warningMessage = message ?? warningMessages[locale];

 // Effective enabled state (disabled if bypassed)
 const isEnabled = enabled && !isBypassed;

 // Handle browser beforeunload event (close/refresh)
 useEffect(() => {
 if (!isEnabled || !hasUnsavedChanges) {
 return;
 }

 const handleBeforeUnload = (event: BeforeUnloadEvent) => {
 // Standard way to trigger browser confirmation dialog
 event.preventDefault();
 // For older browsers, set returnValue
 event.returnValue = warningMessage;
 return warningMessage;
 };

 window.addEventListener('beforeunload', handleBeforeUnload);

 return () => {
 window.removeEventListener('beforeunload', handleBeforeUnload);
 };
 }, [isEnabled, hasUnsavedChanges, warningMessage]);

 // Handle React Router navigation with useBlocker
 const blocker = useBlocker(
 ({ currentLocation, nextLocation }) =>
 isEnabled &&
 hasUnsavedChanges &&
 currentLocation.pathname !== nextLocation.pathname
 );

 // Proceed with navigation
 const proceed = useCallback(() => {
 if (blocker.state === 'blocked') {
 blocker.proceed();
 }
 }, [blocker]);

 // Cancel navigation
 const cancel = useCallback(() => {
 if (blocker.state === 'blocked') {
 blocker.reset();
 }
 }, [blocker]);

 // Reset blocked state
 const reset = useCallback(() => {
 if (blocker.state === 'blocked') {
 blocker.reset();
 }
 setIsBypassed(false);
 }, [blocker]);

 // Bypass the warning (for programmatic navigation after save)
 const bypass = useCallback(() => {
 setIsBypassed(true);
 }, []);

 // Note: bypass flag resets automatically via the reset() function
 // which should be called after a successful save operation.
 // The bypass is a one-shot mechanism - call bypass(), navigate, then
 // the component unmounts. On next mount, isBypassed starts as false.

 return {
 hasUnsavedChanges,
 isBlocked: blocker.state === 'blocked',
 proceed,
 cancel,
 reset,
 bypass,
 };
}

export default useUnsavedChangesWarning;
