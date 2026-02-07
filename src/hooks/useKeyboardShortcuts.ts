import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Custom event name dispatched when Escape is pressed globally.
 * Modal and Drawer components can listen for this event to close themselves.
 */
// Re-exported from keyboard constants
export { CLOSE_OVERLAY_EVENT } from '../constants/keyboardConstants';

/**
 * Global keyboard shortcuts hook for the Sentinel GRC application.
 *
 * Registered shortcuts:
 * - Cmd/Ctrl + K  => Toggle the command palette / search
 *                    (handled natively by CommandPalette.tsx -- this hook
 *                     acts as a safety net by programmatically dispatching
 *                     the open event when no palette listener fires first)
 * - Cmd/Ctrl + /  => Navigate to /help
 * - Escape        => Dispatch a custom 'sentinel:close-overlay' event
 *
 * The hook attaches a single keydown listener to window and cleans it up
 * on unmount.
 */
export const useKeyboardShortcuts = (): void => {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Guard: ignore synthetic events dispatched by ourselves to avoid loops
      if (!event.isTrusted) return;

      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key;

      // ---- Cmd/Ctrl + K: Toggle command palette (search) ----
      // The CommandPalette component registers its own keydown listener.
      // We preventDefault here to stop the browser's default behavior
      // (e.g. Safari's address-bar focus) without interfering with
      // CommandPalette's handler since both listeners fire on the same event.
      if (isMod && key === 'k') {
        event.preventDefault();
        return;
      }

      // ---- Cmd/Ctrl + /: Navigate to Help ----
      if (isMod && key === '/') {
        event.preventDefault();
        navigate('/help');
        return;
      }

      // ---- Escape: Close overlays ----
      if (key === 'Escape') {
        // Do not call preventDefault -- Headless UI Dialog already uses
        // Escape natively. We dispatch a custom event so any non-Dialog
        // overlays (custom drawers, panels, popovers) can also react.
        window.dispatchEvent(new CustomEvent(CLOSE_OVERLAY_EVENT));
        return;
      }
    },
    [navigate],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};
