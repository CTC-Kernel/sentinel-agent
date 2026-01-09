import React, { useState, useCallback } from 'react';
import { ErrorLogger } from '../../services/errorLogger';
import { buttonVariants } from './button-variants';
import { type VariantProps } from "class-variance-authority";
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

/**
 * Composant Button avec protection double-submit intégrée
 */
export interface ProtectedButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    isSubmitting?: boolean;
    loadingText?: string;
    children: React.ReactNode;
}

export const ProtectedButton: React.FC<ProtectedButtonProps> = ({
    isSubmitting = false,
    loadingText = 'Chargement...',
    children,
    disabled,
    className,
    variant,
    size,
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
            className={cn(buttonVariants({ variant, size, className }))}
            aria-busy={isSubmitting}
            aria-disabled={disabled || isSubmitting}
        >
            {isSubmitting ? (
                <>
                    <Spinner className="mr-2 h-4 w-4" size="sm" />
                    {loadingText}
                </>
            ) : (
                children
            )}
        </button>
    );
};
