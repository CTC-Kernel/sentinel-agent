
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
            <div role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} className={`glass-panel rounded-[2rem] shadow-2xl w-full ${maxWidth} border border-glass-border overflow-hidden animate-scale-in mx-4 sm:mx-0 relative my-8 text-left`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
                    <h3 id={titleId} className="text-xl font-bold text-foreground">{title}</h3>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
                        aria-label="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
