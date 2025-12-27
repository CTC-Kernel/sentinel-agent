import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from './Icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
    initialFocus?: React.MutableRefObject<HTMLElement | null>;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-4xl',
    initialFocus
}) => {
    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" initialFocus={initialFocus} onClose={onClose}>
                {/* FocusTrap and keyboard navigation are handled internally by Headless UI */}
                <Transition.Child
                    as={Fragment}
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
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className={`relative transform overflow-hidden rounded-[2rem] bg-white dark:bg-slate-900 text-left shadow-xl transition-all w-full border border-white/60 dark:border-white/5 glass-panel ${maxWidth}`}>
                                {title && (
                                    <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-white/5 shrink-0 transition-colors">
                                        <Dialog.Title as="h3" className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                            {title}
                                        </Dialog.Title>
                                        <button
                                            onClick={onClose}
                                            className="p-2 rounded-full hover:bg-slate-500/10 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                                            aria-label="Fermer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                                <div className="p-0 overflow-y-auto custom-scrollbar max-h-[calc(90vh-80px)]">
                                    {children}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
};
