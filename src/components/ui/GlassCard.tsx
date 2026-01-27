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
                "group relative rounded-4xl p-6 overflow-hidden transition-all duration-300",
                "backdrop-blur-xl saturate-150",
                // Use CSS variables with fallbacks for consistent theming
                "bg-[var(--glass-bg,rgba(255,255,255,0.85))]",
                "border border-[var(--glass-border,rgba(28,32,48,0.12))]",
                "shadow-[var(--glass-shadow,0_4px_20px_-2px_rgba(28,32,48,0.08))]",
                // Hover state - enhanced lift, shadow and border accent
                hoverEffect && [
                    "hover:-translate-y-1",
                    "hover:shadow-apple-xl",
                    "hover:border-primary/20",
                    "hover:brightness-[1.02]",
                    "cursor-pointer"
                ],
                className
            )}
            {...props}
        >
            {gradientOverlay && (
                <>
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60 dark:via-white/15" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent dark:from-white/8 pointer-events-none opacity-60 group-hover:opacity-70 transition-opacity duration-500" />
                </>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};
