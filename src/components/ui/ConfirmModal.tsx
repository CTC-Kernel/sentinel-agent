
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from './Icons';
import { Button } from './button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  details?: string; // Additional impact information
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  closeOnConfirm?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'danger',
  details,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  loading = false,
  closeOnConfirm = true
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    const t = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Icon = type === 'info' ? Info : AlertTriangle;
  const colorClass = type === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
    type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-blue-100 text-blue-600 dark:bg-slate-900/30 dark:text-blue-400';

  const buttonClass = type === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' :
    type === 'warning' ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' :
      'text-blue-600 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" className="bg-popover backdrop-blur-2xl rounded-[2rem] shadow-2xl w-full max-w-md border border-border overflow-hidden animate-scale-in mx-4 sm:mx-0">
        <div className="p-6 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${colorClass}`}>
            <Icon className="h-8 w-8" />
          </div>
          <h3 id="confirm-modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{message}</p>
          {details && (
            <div className="mt-4 p-3 bg-background/50 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground font-medium">{details}</p>
            </div>
          )}
        </div>
        <div className="flex border-t border-border">
          <Button
            onClick={onClose}
            disabled={loading}
            variant="ghost"
            ref={cancelButtonRef}
            className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-slate-600 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </Button>
          <div className="w-px bg-border"></div>
          <Button
            onClick={() => { onConfirm(); if (closeOnConfirm) onClose(); }}
            isLoading={loading}
            variant="ghost"
            className={`flex-1 py-4 h-auto rounded-none text-sm font-bold ${buttonClass} transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
