import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    width?: string; // e.g., 'max-w-2xl', 'max-w-4xl'
}

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    actions,
    children,
    width = 'max-w-2xl'
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300); // Wait for animation
            document.body.style.overflow = 'unset';
            return () => {
                clearTimeout(timer);
                window.removeEventListener('keydown', handleEscape);
            };
        }
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isVisible && !isOpen) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] overflow-hidden ${!isOpen ? 'pointer-events-none' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
        >
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer Panel */}
            <div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none">
                <div className={`w-screen ${width} pointer-events-auto transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5">

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5 shrink-0">
                            <div className="flex-1 min-w-0 mr-4">
                                {title && <h2 id="drawer-title" className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight truncate">{title}</h2>}
                                {subtitle && <div className="text-sm font-medium text-slate-500 mt-1">{subtitle}</div>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {actions}
                                <button
                                    onClick={onClose}
                                    className="p-2.5 text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                                    aria-label="Fermer"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-transparent custom-scrollbar relative">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
