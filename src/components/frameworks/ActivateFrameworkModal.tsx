/**
 * ActivateFrameworkModal Component
 *
 * Modal for activating a regulatory framework with optional target date and notes.
 *
 * @see Story EU-1.3: Créer le composant FrameworkSelector
 */

import React, { useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Shield, Calendar, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { appleEasing } from '../../utils/microInteractions';
import type { RegulatoryFramework } from '../../types/framework';

// ============================================================================
// Types
// ============================================================================

interface ActivateFrameworkModalProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: (targetDate?: string, notes?: string) => void;
 framework: RegulatoryFramework | null;
 isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ActivateFrameworkModal: React.FC<ActivateFrameworkModalProps> = ({
 isOpen,
 onClose,
 onConfirm,
 framework,
 isLoading = false,
}) => {
 const { t } = useTranslation();
 const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
 const [targetDate, setTargetDate] = useState('');
 const [notes, setNotes] = useState('');

 const handleConfirm = () => {
 onConfirm(targetDate || undefined, notes || undefined);
 };

 const handleClose = () => {
 setTargetDate('');
 setNotes('');
 onClose();
 };

 if (!framework) return null;

 return (
 <Transition.Root show={isOpen} as={React.Fragment}>
 <Dialog
 as="div"
 className="relative z-modal"
 initialFocus={cancelButtonRef}
 onClose={handleClose}
 >
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
 <Dialog.Panel className="relative transform overflow-hidden rounded-4xl bg-card text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-border/40 dark:border-white/5">
 <div className="p-6">
  {/* Icon */}
  <motion.div
  className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
  initial={{ scale: 0, rotate: -180 }}
  animate={{ scale: 1, rotate: 0 }}
  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
  >
  <Shield className="h-8 w-8" />
  </motion.div>

  {/* Title */}
  <motion.div
  className="text-center"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.15, duration: 0.3, ease: appleEasing }}
  >
  <Dialog.Title
  as="h3"
  className="text-xl font-bold font-display leading-6 text-foreground mb-2"
  >
  {t('frameworks.activateTitle', 'Activer {{code}}', { code: framework.code })}
  </Dialog.Title>
  <p className="text-sm text-muted-foreground font-medium">
  {t(
  'frameworks.activateDescription',
  'Ce framework sera ajouté à votre suivi de conformité.'
  )}
  </p>
  </motion.div>

  {/* Form */}
  <motion.div
  className="mt-6 space-y-4"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2, duration: 0.3, ease: appleEasing }}
  >
  {/* Target Date */}
  <div>
  <label
  htmlFor="targetDate"
  className="flex items-center gap-2 text-sm font-medium text-foreground mb-2"
  >
  <Calendar className="w-4 h-4" />
  {t('frameworks.targetComplianceDate', 'Date cible de conformité')}
  <span className="text-muted-foreground text-xs">
  ({t('common.optional', 'optionnel')})
  </span>
  </label>
  <input
  type="date"
  id="targetDate"
  value={targetDate}
  onChange={(e) => setTargetDate(e.target.value)}
  className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-muted/50 text-foreground focus-visible:ring-2 focus-visible:ring-emerald-500 focus:border-transparent transition-all"
  />
  </div>

  {/* Notes */}
  <div>
  <label
  htmlFor="notes"
  className="flex items-center gap-2 text-sm font-medium text-foreground mb-2"
  >
  <FileText className="w-4 h-4" />
  {t('frameworks.notes', 'Notes')}
  <span className="text-muted-foreground text-xs">
  ({t('common.optional', 'optionnel')})
  </span>
  </label>
  <textarea
  id="notes"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  rows={3}
  placeholder={t(
  'frameworks.notesPlaceholder',
  'Ajoutez des notes sur cette activation...'
  )}
  className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-muted/50 text-foreground focus-visible:ring-2 focus-visible:ring-emerald-500 focus:border-transparent transition-all resize-none"
  />
  </div>
  </motion.div>

  {/* Info Box */}
  <motion.div
  className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.25, duration: 0.3, ease: appleEasing }}
  >
  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
  {t(
  'frameworks.activateInfo',
  'Vous pourrez mapper vos contrôles existants aux exigences de ce framework et suivre votre score de conformité.'
  )}
  </p>
  </motion.div>
 </div>

 {/* Actions */}
 <div className="flex border-t border-border/40 dark:border-white/5">
  <Button
  type="button"
  variant="ghost"
  className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/50 transition-colors"
  onClick={handleClose}
  disabled={isLoading}
  ref={cancelButtonRef}
  >
  {t('common.cancel', 'Annuler')}
  </Button>
  <div className="w-px bg-muted dark:bg-white/5" />
  <Button
  type="button"
  variant="ghost"
  isLoading={isLoading}
  className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
  onClick={handleConfirm}
  >
  {t('frameworks.activate', 'Activer')}
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
