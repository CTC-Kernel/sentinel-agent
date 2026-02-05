import React from 'react';
import { cn } from '../../lib/utils';

interface TechCornerProps {
 className?: string;
 position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const TechCorner: React.FC<TechCornerProps> = ({ className, position }) => {
 const getRotation = () => {
 switch (position) {
 case 'top-left': return 'rotate-0';
 case 'top-right': return 'rotate-90';
 case 'bottom-right': return 'rotate-180';
 case 'bottom-left': return '-rotate-90';
 }
 };

 return (
 <svg
 className={cn(
 "absolute w-4 h-4 text-muted-foreground/50 dark:text-white/20 z-20 pointer-events-none transition-all duration-300",
 getRotation(),
 position === 'top-left' && "top-3 left-3",
 position === 'top-right' && "top-3 right-3",
 position === 'bottom-left' && "bottom-3 left-3",
 position === 'bottom-right' && "bottom-3 right-3",
 className
 )}
 viewBox="0 0 24 24"
 >
 <path fill="currentColor" d="M2 2h6v2H2z" />
 <path fill="currentColor" d="M2 2v6h2V2z" />
 </svg>
 );
};
