import React, { useState, useCallback } from 'react';
import { ErrorLogger } from '../../services/errorLogger';
import { buttonVariants } from './button-variants';
import { type VariantProps } from "class-variance-authority";

import { Button } from './button';

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
 <Button
 {...props}
 onClick={handleClick}
 disabled={disabled}
 isLoading={isSubmitting}
 loadingText={loadingText}
 variant={variant}
 size={size}
 className={className}
 >
 {children}
 </Button>
 );
};
