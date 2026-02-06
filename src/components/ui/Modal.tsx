import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from './Icons';
import { Button } from './button';
import { useTranslation } from 'react-i18next';

interface ModalProps {
 isOpen: boolean;
 onClose: () => void;
 title?: string;
 children: React.ReactNode;
 maxWidth?: string;
 initialFocus?: React.MutableRefObject<HTMLElement | null>;
 /** If true, shows a confirmation dialog before closing */
 hasUnsavedChanges?: boolean;
 /** Custom message for unsaved changes dialog */
 unsavedChangesMessage?: string;
 /** If true, the modal content will scroll internally. Set to false for custom scrolling layouts. */
 scrollable?: boolean;
 /** Optional ID of an element that labels the modal (for accessibility) */
 ariaLabelledBy?: string;
}

export const Modal: React.FC<ModalProps> = ({
 isOpen,
 onClose,
 title,
 children,
 maxWidth = 'max-w-4xl',
 initialFocus,
 hasUnsavedChanges = false,
 unsavedChangesMessage,
 scrollable = true,
 ...props
}) => {
 const { t } = useTranslation();
 const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

 const handleClose = React.useCallback(() => {
 if (hasUnsavedChanges) {
 setShowConfirmDialog(true);
 return;
 }
 onClose();
 }, [hasUnsavedChanges, onClose]);

 const handleConfirmClose = React.useCallback(() => {
 setShowConfirmDialog(false);
 onClose();
 }, [onClose]);

 const handleCancelClose = React.useCallback(() => {
 setShowConfirmDialog(false);
 }, []);

 return (
 <>
 <Transition.Root show={isOpen} as={Fragment}>
 <Dialog as="div" className="relative z-modal" initialFocus={initialFocus} onClose={handleClose} aria-labelledby={props.ariaLabelledBy}>
  {/* FocusTrap and keyboard navigation are handled internally by Headless UI */}
  <Transition.Child
  as={Fragment}
  enter="ease-out duration-normal"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="ease-in duration-fast"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
  >
  <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] transition-opacity" />
  </Transition.Child>

  <div className="fixed inset-0 z-decorator w-screen overflow-y-auto">
  <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
  <Transition.Child
  as={Fragment}
  enter="ease-apple duration-normal"
  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
  enterTo="opacity-100 translate-y-0 sm:scale-100"
  leave="ease-in duration-fast"
  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
  >
  <Dialog.Panel className={`relative transform overflow-hidden rounded-xl bg-[var(--modal-bg)] text-left shadow-modal transition-all will-change-transform w-full border border-border/30 ${maxWidth}`}>
   {title && (
   <div className="flex items-center justify-between p-6 border-b border-border/40 shrink-0 transition-colors">
   <Dialog.Title as="h3" className="text-xl font-bold font-display text-foreground tracking-tight">
   {title}
   </Dialog.Title>
   <Button
   onClick={handleClose}
   variant="ghost"
   size="icon"
   className="rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
   aria-label={t('common.close', { defaultValue: 'Fermer' })}
   >
   <X className="w-5 h-5" aria-hidden="true" />
   </Button>
   </div>
   )}
   <div className={scrollable ? "p-0 overflow-y-auto custom-scrollbar max-h-[calc(90vh-80px)]" : ""}>
   {children}
   </div>
  </Dialog.Panel>
  </Transition.Child>
  </div>
  </div>
 </Dialog>
 </Transition.Root>

 {/* Unsaved Changes Confirmation Dialog */}
 <Transition.Root show={showConfirmDialog} as={Fragment}>
 <Dialog as="div" className="relative z-dropdown" onClose={handleCancelClose}>
  <Transition.Child
  as={Fragment}
  enter="ease-out duration-300"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
  >
  <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]" />
  </Transition.Child>

  <div className="fixed inset-0 z-decorator overflow-y-auto">
  <div className="flex min-h-full items-center justify-center p-4">
  <Transition.Child
  as={Fragment}
  enter="ease-out duration-300"
  enterFrom="opacity-0 scale-95"
  enterTo="opacity-100 scale-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100 scale-100"
  leaveTo="opacity-0 scale-95"
  >
  <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-[var(--modal-bg)] p-6 text-left shadow-xl transition-all sm:max-w-md w-full border border-border/30">
   <div className="flex items-start gap-4">
   <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center">
   <svg className="h-5 w-5 text-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
   </svg>
   </div>
   <div className="flex-1">
   <Dialog.Title className="text-lg font-semibold text-foreground">
   {t('common.unsavedChanges', { defaultValue: 'Modifications non sauvegardées' })}
   </Dialog.Title>
   <p className="mt-2 text-sm text-muted-foreground">
   {unsavedChangesMessage || t('common.unsavedChangesMessage', { defaultValue: 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?' })}
   </p>
   </div>
   </div>
   <div className="mt-6 flex justify-end gap-3">
   <Button
   variant="ghost"
   onClick={handleCancelClose}
   >
   {t('common.continueEditing', { defaultValue: "Continuer l'édition" })}
   </Button>
   <Button
   variant="destructive"
   onClick={handleConfirmClose}
   >
   {t('common.leaveWithoutSaving', { defaultValue: 'Quitter sans sauvegarder' })}
   </Button>
   </div>
  </Dialog.Panel>
  </Transition.Child>
  </div>
  </div>
 </Dialog>
 </Transition.Root>
 </>
 );
};
