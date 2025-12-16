
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-4xl'
}) => {
    const titleId = useId();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);

        const t = window.setTimeout(() => {
            closeButtonRef.current?.focus();
        }, 0);

        return () => {
            window.clearTimeout(t);
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-max flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-fade-in"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                className={`relative w-full ${maxWidth} glass-panel rounded-[2rem] overflow-hidden animate-scale-in flex flex-col max-h-[90vh]`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-white/5 shrink-0 transition-colors">
                    <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                        aria-label="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto custom-scrollbar p-0">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
