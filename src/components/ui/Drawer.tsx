import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { Dialog, Transition } from '@headlessui/react';
import { X, AlertTriangle } from './Icons';

// Apple-style cubic-bezier for smooth, spring-like animations
const APPLE_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    width?: string; // e.g., 'max-w-2xl', 'max-w-4xl'
    breadcrumbs?: { label: string; onClick?: () => void }[];
    disableFocusTrap?: boolean; // Headless UI handles this, but keeping prop for compat if needed (though ignored)
    disableScroll?: boolean;
    /** If true, shows a confirmation dialog before closing */
    hasUnsavedChanges?: boolean;
    /** Custom message for unsaved changes dialog */
    unsavedChangesMessage?: string;
    /** Callback before close - return false to prevent close */
    beforeClose?: () => boolean | void;
}

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    actions,
    children,
    width = 'max-w-2xl',
    disableScroll = false,
    hasUnsavedChanges = false,
    unsavedChangesMessage = 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?',
    beforeClose
}) => {
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const handleClose = useCallback(() => {
        // Check beforeClose callback first
        if (beforeClose) {
            const canClose = beforeClose();
            if (canClose === false) return;
        }

        // If there are unsaved changes, show confirmation dialog
        if (hasUnsavedChanges) {
            setShowConfirmDialog(true);
            return;
        }

        onClose();
    }, [beforeClose, hasUnsavedChanges, onClose]);

    const handleConfirmClose = useCallback(() => {
        setShowConfirmDialog(false);
        onClose();
    }, [onClose]);

    const handleCancelClose = useCallback(() => {
        setShowConfirmDialog(false);
    }, []);

    return createPortal(
        <Transition.Root show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={handleClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="duration-400"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                        style={{ transition: `opacity 400ms ${APPLE_EASING}` }}
                    />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
                            <Transition.Child
                                as={React.Fragment}
                                enter="transform duration-500"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform duration-400"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel
                                    className={`pointer-events-auto w-screen ${width}`}
                                    style={{ transition: `transform 500ms ${APPLE_EASING}` }}
                                >
                                    <div className="flex h-full flex-col glass-premium border-t-0 border-b-0 border-r-0 rounded-l-2xl shadow-xl">
                                        {/* Header */}
                                        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200/60 dark:border-white/5 flex flex-wrap items-start justify-between gap-y-4 shrink-0 transition-colors duration-300">
                                            <div className="flex-1 min-w-0 mr-4">
                                                {title && <Dialog.Title className="text-xl font-bold font-display text-slate-900 dark:text-white leading-tight tracking-tight truncate filter drop-shadow-sm">{title}</Dialog.Title>}
                                                {subtitle && <div className="text-sm text-slate-500 dark:text-muted-foreground mt-1.5">{subtitle}</div>}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {actions}
                                                <Button
                                                    onClick={handleClose}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full text-muted-foreground hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                                                    aria-label="Fermer"
                                                >
                                                    <X className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className={`flex-1 min-w-0 relative ${disableScroll ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
                                            {children}
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>

        {/* Unsaved Changes Confirmation Dialog */}
        <Transition.Root show={showConfirmDialog} as={React.Fragment}>
            <Dialog as="div" className="relative z-[110]" onClose={handleCancelClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl glass-premium p-6 text-left shadow-xl transition-all sm:max-w-md w-full">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center">
                                        <AlertTriangle className="h-5 w-5 text-warning-text" />
                                    </div>
                                    <div className="flex-1">
                                        <Dialog.Title className="text-lg font-semibold text-foreground">
                                            Modifications non sauvegardées
                                        </Dialog.Title>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {unsavedChangesMessage}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={handleCancelClose}
                                    >
                                        Continuer l'édition
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleConfirmClose}
                                    >
                                        Quitter sans sauvegarder
                                    </Button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>,
        document.body
    );
};
