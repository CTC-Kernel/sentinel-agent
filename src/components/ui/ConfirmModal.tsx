import React, { useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { AlertTriangle, Info } from './Icons';
import { Button } from './button';
import { appleEasing } from '../../utils/microInteractions';

interface AffectedItem {
 type: string;
 name: string;
 count?: number;
}

interface ConfirmModalProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string;
 type?: 'danger' | 'warning' | 'info';
 details?: string; // Additional impact information
 /** List of items that will be affected by this action */
 affectedItems?: AffectedItem[];
 /** Maximum number of affected items to show (rest will be collapsed) */
 maxAffectedItemsShown?: number;
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
 affectedItems,
 maxAffectedItemsShown = 5,
 confirmText = 'Confirmer',
 cancelText = 'Annuler',
 loading = false,
 closeOnConfirm = true
}) => {
 const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

 const Icon = type === 'info' ? Info : AlertTriangle;
 const colorClass = type === 'danger' ? 'bg-error-bg text-error-text' :
 type === 'warning' ? 'bg-warning-bg text-warning-text' :
 'bg-info-bg text-info-text';

 const buttonClass = type === 'danger' ? 'text-error-text hover:bg-error-bg' :
 type === 'warning' ? 'text-warning-text hover:bg-warning-bg' :
 'text-info-text hover:bg-info-bg';

 return (
 <Transition.Root show={isOpen} as={React.Fragment}>
 <Dialog as="div" className="relative z-modal" initialFocus={cancelButtonRef} onClose={onClose}>
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
 <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] transition-opacity" />
 </Transition.Child>

 <div className="fixed inset-0 z-decorator w-screen overflow-y-auto">
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
 <Dialog.Panel className="relative transform overflow-hidden rounded-4xl glass-premium text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-border/40">
 <div className="p-6 text-center">
  <motion.div
  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl mb-4 ${colorClass}`}
  initial={{ scale: 0, rotate: -180 }}
  animate={{ scale: 1, rotate: 0 }}
  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
  >
  <motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ delay: 0.2, duration: 0.3, ease: appleEasing }}
  >
  <Icon className="h-8 w-8" aria-hidden="true" />
  </motion.div>
  </motion.div>
  <motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.15, duration: 0.3, ease: appleEasing }}
  >
  <Dialog.Title as="h3" className="text-xl font-bold font-display leading-6 text-foreground mb-2">
  {title}
  </Dialog.Title>
  </motion.div>
  <motion.div
  className="mt-2 text-center"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2, duration: 0.3, ease: appleEasing }}
  >
  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
  {message}
  </p>
  {details && (
  <motion.div
  className="mt-4 p-3 bg-muted rounded-3xl border border-border/40 text-left"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.25, duration: 0.3, ease: appleEasing }}
  >
  <p className="text-xs text-muted-foreground font-medium">{details}</p>
  </motion.div>
  )}

  {/* Affected Items List */}
  {affectedItems && affectedItems.length > 0 && (
  <motion.div
  className="mt-4 p-3 bg-muted rounded-3xl border border-border/40 text-left"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.3, duration: 0.3, ease: appleEasing }}
  >
  <p className="text-xs font-semibold text-foreground mb-2">
  Éléments liés qui seront affectés :
  </p>
  <ul className="space-y-1">
  {affectedItems.slice(0, maxAffectedItemsShown).map((item, index) => (
  <li key={index || 'unknown'} className="text-xs text-muted-foreground flex items-center gap-2">
  <span className="w-1.5 h-1.5 rounded-full bg-border" />
  <span className="font-medium">{item.type}:</span>
  <span className="truncate">{item.name}</span>
  {item.count && item.count > 1 && (
  <span className="text-muted-foreground/70">({item.count})</span>
  )}
  </li>
  ))}
  </ul>
  {affectedItems.length > maxAffectedItemsShown && (
  <p className="text-xs text-muted-foreground/70 mt-2 italic">
  ... et {affectedItems.length - maxAffectedItemsShown} autre(s)
  </p>
  )}
  </motion.div>
  )}
  </motion.div>
 </div>
 <div className="flex border-t border-border/40 overflow-hidden rounded-b-4xl">
  <Button
  type="button"
  variant="ghost"
  className="flex-1 py-4 h-auto rounded-none rounded-bl-4xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors disabled:bg-muted disabled:text-muted-foreground"
  onClick={onClose}
  disabled={loading}
  ref={cancelButtonRef}
  >
  {cancelText}
  </Button>
  <div className="w-px bg-border/40"></div>
  <Button
  type="button"
  variant="ghost"
  isLoading={loading}
  className={`flex-1 py-4 h-auto rounded-none rounded-br-4xl text-sm font-bold ${buttonClass} transition-colors disabled:bg-muted disabled:text-muted-foreground flex items-center justify-center gap-2`}
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
