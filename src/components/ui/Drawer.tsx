
import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from './Icons';

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
}

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    actions,
    children,
    width = 'max-w-2xl',
    disableScroll = false
}) => {
    return (
        <Transition.Root show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-in-out duration-500"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                            <Transition.Child
                                as={React.Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className={`pointer-events-auto w-screen ${width}`}>
                                    <div className="flex h-full flex-col glass-panel border-t-0 border-b-0 border-r-0 rounded-l-2xl shadow-xl">
                                        {/* Header */}
                                        <div className="px-6 py-5 border-b border-slate-200/60 dark:border-white/5 flex flex-wrap items-start justify-between gap-y-4 shrink-0 transition-colors duration-300">
                                            <div className="flex-1 min-w-0 mr-4">
                                                {title && <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight truncate filter drop-shadow-sm">{title}</Dialog.Title>}
                                                {subtitle && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{subtitle}</div>}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {actions}
                                                <button
                                                    onClick={onClose}
                                                    className="p-2 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                                                    aria-label="Fermer"
                                                >
                                                    <X className="h-5 w-5" />
                                                </button>
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
    );
};
