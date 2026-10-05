import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog shell shared by the launch form and the search palette.
 *
 * - `role="dialog"` and `aria-modal`, named by `labelledBy` or `label`;
 * - focus moves in on open (to `[data-autofocus]`, else the first control),
 *   stays inside while open and returns to the opener on close;
 * - Escape closes it without also closing the assistant behind it;
 * - the backdrop closes it only when a click starts and ends on it, so a
 *   text selection dragged out of a field no longer dismisses the form.
 */
export function Dialog({ label, labelledBy, className, backdropClassName = "", onClose, children }: {
  label?: string;
  labelledBy?: string;
  className: string;
  backdropClassName?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = panel.current;
    if (node && !node.contains(document.activeElement)) {
      (node.querySelector<HTMLElement>("[data-autofocus]") ?? node.querySelector<HTMLElement>(FOCUSABLE) ?? node).focus();
    }
    const keepFocusInside = (event: FocusEvent) => {
      if (node && event.target instanceof Node && !node.contains(event.target)) node.focus();
    };
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const controls = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((control) => control.tabIndex >= 0 && control.getClientRects().length > 0);
    if (controls.length === 0) { event.preventDefault(); return; }
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  };

  return <div
    className={`modal-backdrop ${backdropClassName}`}
    onMouseDown={(event) => { pressedOnBackdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => {
      if (pressedOnBackdrop.current && event.target === event.currentTarget) onClose();
      pressedOnBackdrop.current = false;
    }}
  >
    <div ref={panel} className={className} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} tabIndex={-1} onKeyDown={onKeyDown}>
      {children}
    </div>
  </div>;
}
