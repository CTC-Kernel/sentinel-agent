import React, { useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
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

  const Icon = type === 'info' ? Info : AlertTriangle;
  const colorClass = type === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
    type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-blue-100 text-blue-600 dark:bg-slate-900/30 dark:text-blue-400';

  const buttonClass = type === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' :
    type === 'warning' ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' :
      'text-blue-600 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20';

  return (
    <Transition.Root show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-[200]" initialFocus={cancelButtonRef} onClose={onClose}>
        {/* Headless UI handles FocusTrap and keyboard navigation */}
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-[2rem] bg-white dark:bg-slate-950 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200 dark:border-white/5">
                <div className="p-6 text-center">
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-4 ${colorClass}`}>
                    <Icon className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-slate-900 dark:text-white mb-2">
                    {title}
                  </Dialog.Title>
                  <div className="mt-2 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {message}
                    </p>
                    {details && (
                      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5 text-left">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{details}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex border-t border-slate-200 dark:border-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    onClick={onClose}
                    disabled={loading}
                    ref={cancelButtonRef}
                  >
                    {cancelText}
                  </Button>
                  <div className="w-px bg-slate-200 dark:bg-white/5"></div>
                  <Button
                    type="button"
                    variant="ghost"
                    isLoading={loading}
                    className={`flex-1 py-4 h-auto rounded-none text-sm font-bold ${buttonClass} transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
                    onClick={() => { onConfirm(); if (closeOnConfirm) onClose(); }}
                  >
                    {confirmText}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};
