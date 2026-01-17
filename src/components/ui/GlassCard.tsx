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
                "relative rounded-2xl p-6 overflow-hidden transition-all duration-300",
                "backdrop-blur-xl saturate-150",
                // Use CSS variables for consistent theming
                "bg-[var(--glass-bg)] border-[var(--glass-border)] shadow-[var(--glass-shadow)]",
                // Hover state - subtle lift and brightness increase
                hoverEffect && "hover:-translate-y-1 hover:brightness-[1.02] cursor-pointer",
                className
            )}
            style={{
                // Explicitly set these variables if they aren't inherited correctly or need override
                '--glass-border': 'var(--glass-border)',
                '--glass-shadow': 'var(--glass-shadow)'
            } as React.CSSProperties}
            {...props}
        >
            {gradientOverlay && (
                <>
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 dark:via-white/10" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 pointer-events-none opacity-50" />
                </>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};
