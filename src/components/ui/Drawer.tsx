import React, { useEffect, useRef, useState } from 'react';
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
    breadcrumbs?: { label: string; onClick?: () => void }[];
}

export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    actions,
    children,
    width = 'max-w-2xl',
    breadcrumbs
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (!isVisible) setIsVisible(true);
            previousFocusRef.current = document.activeElement as HTMLElement | null;
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);

            const t = window.setTimeout(() => {
                closeButtonRef.current?.focus();
            }, 0);

            return () => {
                window.clearTimeout(t);
            };
        }

        let timer: ReturnType<typeof setTimeout>;
        if (!isOpen) {
            timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = 'unset';
        }

        return () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener('keydown', handleEscape);
            // Ensure we reset overflow if unmounting while open
            if (isOpen) document.body.style.overflow = 'unset';
            if (!isOpen) previousFocusRef.current?.focus();
        };
    }, [isOpen, onClose, isVisible]);

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
            <div className="absolute inset-y-0 right-0 left-0 sm:left-auto sm:pl-10 max-w-full flex pointer-events-none min-w-0">
                <div className={`w-full ${width} pointer-events-auto transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="h-full flex flex-col bg-background/80 dark:bg-slate-900/90 backdrop-blur-2xl shadow-apple-xl border-l border-white/20 dark:border-white/10">

                        {/* Header */}
                        <div className="px-4 sm:px-8 py-6 border-b border-border flex flex-wrap items-start justify-between gap-y-4 bg-background/50 shrink-0">
                            <div className="flex-1 min-w-0 mr-4">
                                {breadcrumbs && breadcrumbs.length > 0 && (
                                    <nav className="flex items-center text-xs font-medium text-slate-600 mb-2" aria-label="Breadcrumb">
                                        <ol className="flex items-center space-x-2">
                                            {breadcrumbs.map((crumb, index) => (
                                                <li key={index} className="flex items-center">
                                                    {index > 0 && <span className="mx-2 text-slate-300">/</span>}
                                                    {crumb.onClick ? (
                                                        <button onClick={crumb.onClick} className="hover:text-brand-600 transition-colors">
                                                            {crumb.label}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-900 dark:text-white font-bold">{crumb.label}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </nav>
                                )}
                                {title && <h2 id="drawer-title" className="text-2xl font-bold text-foreground leading-tight tracking-tight truncate">{title}</h2>}
                                {subtitle && <div className="text-sm font-medium text-muted-foreground mt-1">{subtitle}</div>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {actions}
                                <button
                                    ref={closeButtonRef}
                                    onClick={onClose}
                                    className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                                    aria-label="Fermer"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 overflow-y-auto bg-background/40 custom-scrollbar relative">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
