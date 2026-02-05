/**
 * DeactivateFrameworkModal Component
 *
 * Warning modal for deactivating a regulatory framework.
 *
 * @see Story EU-1.3: Créer le composant FrameworkSelector
 */

import React, { useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { appleEasing } from '../../utils/microInteractions';
import type { RegulatoryFramework } from '../../types/framework';

// ============================================================================
// Types
// ============================================================================

interface DeactivateFrameworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  framework: RegulatoryFramework | null;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const DeactivateFrameworkModal: React.FC<DeactivateFrameworkModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  framework,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  if (!framework) return null;

  return (
    <Transition.Root show={isOpen} as={React.Fragment}>
      <Dialog
        as="div"
        className="relative z-modal"
        initialFocus={cancelButtonRef}
        onClose={onClose}
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-4xl bg-white dark:bg-slate-950 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-border/40 dark:border-white/5">
                <div className="p-6 text-center">
                  {/* Warning Icon */}
                  <motion.div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-4 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, duration: 0.3, ease: appleEasing }}
                    >
                      <AlertTriangle className="h-8 w-8" />
                    </motion.div>
                  </motion.div>

                  {/* Title */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.3, ease: appleEasing }}
                  >
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-bold font-display leading-6 text-slate-900 dark:text-white mb-2"
                    >
                      {t('frameworks.deactivateTitle', 'Désactiver {{code}} ?', {
                        code: framework.code,
                      })}
                    </Dialog.Title>
                  </motion.div>

                  {/* Message */}
                  <motion.div
                    className="mt-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3, ease: appleEasing }}
                  >
                    <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium leading-relaxed">
                      {t(
                        'frameworks.deactivateDescription',
                        'Ce framework sera retiré de votre suivi de conformité.'
                      )}
                    </p>
                  </motion.div>

                  {/* Warning Details */}
                  <motion.div
                    className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/30 text-left"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25, duration: 0.3, ease: appleEasing }}
                  >
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                      {t('frameworks.deactivateWarningTitle', 'Attention')}
                    </h4>
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                        {t(
                          'frameworks.deactivateWarning1',
                          'Les mappings de contrôles vers ce framework seront supprimés'
                        )}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                        {t(
                          'frameworks.deactivateWarning2',
                          "Le score de conformité ne sera plus calculé pour ce framework"
                        )}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                        {t(
                          'frameworks.deactivateWarning3',
                          "Cette action est réversible - vous pourrez réactiver ce framework"
                        )}
                      </li>
                    </ul>
                  </motion.div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-border/40 dark:border-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    onClick={onClose}
                    disabled={isLoading}
                    ref={cancelButtonRef}
                  >
                    {t('common.cancel', 'Annuler')}
                  </Button>
                  <div className="w-px bg-slate-200 dark:bg-white/5" />
                  <Button
                    type="button"
                    variant="ghost"
                    isLoading={isLoading}
                    className="flex-1 py-4 h-auto rounded-none text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors"
                    onClick={onConfirm}
                  >
                    {t('frameworks.deactivate', 'Désactiver')}
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
