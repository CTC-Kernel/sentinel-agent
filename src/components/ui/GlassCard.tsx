import React from 'react';
import { cn } from '../../utils/cn';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    gradientOverlay?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className,
    hoverEffect = false,
    gradientOverlay = true,
    ...props
}) => {
    return (
        <div
            className={cn(
                "relative rounded-2xl p-6 overflow-hidden backdrop-blur-md transition-all duration-300",
                "bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-sm",
                hoverEffect && "hover:scale-[1.01] hover:shadow-md hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer",
                className
            )}
            {...props}
        >
            {gradientOverlay && (
                <>
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/5 pointer-events-none" />
                </>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};
