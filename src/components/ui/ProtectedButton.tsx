import React, { useState, useCallback } from 'react';
import { ErrorLogger } from '../../services/errorLogger';

/**
 * Composant Button avec protection double-submit intégrée
 */
export interface ProtectedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isSubmitting?: boolean;
    loadingText?: string;
    children: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export const ProtectedButton: React.FC<ProtectedButtonProps> = ({
    isSubmitting = false,
    loadingText = 'Chargement...',
    children,
    disabled,
    className,
    onClick,
    ...props
}) => {
    const [clickCount, setClickCount] = useState(0);
    const [lastClickTime, setLastClickTime] = useState(0);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;

        // Ignorer les clics multiples rapides (< 500ms)
        if (timeSinceLastClick < 500 && clickCount > 0) {
            e.preventDefault();
            ErrorLogger.warn('Rapid multiple clicks prevented', 'ProtectedButton');
            return;
        }

        setClickCount(prev => prev + 1);
        setLastClickTime(now);

        // Réinitialiser le compteur après 2 secondes
        setTimeout(() => {
            setClickCount(0);
        }, 2000);

        onClick?.(e);
    }, [onClick, lastClickTime, clickCount]);

    return (
        <button
            {...props}
            onClick={handleClick}
            disabled={disabled || isSubmitting}
            className={className}
            aria-busy={isSubmitting}
            aria-disabled={disabled || isSubmitting}
        >
            {isSubmitting ? (
                <>
                    <span className="animate-spin mr-2">⟳</span>
                    {loadingText}
                </>
            ) : (
                children
            )}
        </button>
    );
};
