import React from 'react';
import { cn } from '../../utils/cn';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
    children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    className,
    hoverEffect = false,
    children,
    ...props
}) => {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm transition-all duration-300",
                hoverEffect && "hover:shadow-md hover:scale-[1.01] hover:bg-white/80 dark:hover:bg-slate-900/80 cursor-pointer",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
