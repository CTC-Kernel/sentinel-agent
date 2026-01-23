import React from 'react';

type BadgeIconComponent = React.ElementType<{ className?: string }>;

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'soft' | 'glass';
    status?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';
    size?: 'sm' | 'md';
    className?: string;
    icon?: BadgeIconComponent;
    onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = React.memo(({
    children,
    variant = 'soft',
    status = 'neutral',
    size = 'sm',
    className = '',
    icon: Icon,
    onClick,
    ...props
}) => {
    // Base styles
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 animate-badge-in";

    // Size styles
    const sizeStyles = {
        sm: "px-2.5 py-0.5 text-[10px] rounded-lg gap-1 uppercase tracking-wider",
        md: "px-3 py-1 text-xs rounded-xl gap-1.5 uppercase tracking-wide"
    };

    // Status & Variant styles
    const getStatusStyles = () => {
        switch (status) {
            case 'success':
                if (variant === 'outline') return "border border-success-border text-success-text";
                if (variant === 'glass') return "bg-success-bg/10 backdrop-blur-md text-success-text border-success-border/20 shadow-sm";
                if (variant === 'soft') return "bg-success-bg text-success-text border border-success-border/50";
                return "bg-success-text text-white shadow-sm shadow-success-text/25";

            case 'warning':
                if (variant === 'outline') return "border border-warning-border text-warning-text";
                if (variant === 'glass') return "bg-warning-bg/10 backdrop-blur-md text-warning-text border-warning-border/20 shadow-sm";
                if (variant === 'soft') return "bg-warning-bg text-warning-text border border-warning-border/50";
                return "bg-warning-text text-white shadow-sm shadow-warning-text/25";

            case 'error':
                if (variant === 'outline') return "border border-error-border text-error-text";
                if (variant === 'glass') return "bg-error-bg/10 backdrop-blur-md text-error-text border-error-border/20 shadow-sm";
                if (variant === 'soft') return "bg-error-bg text-error-text border border-error-border/50";
                return "bg-error-text text-white shadow-sm shadow-error-text/25";

            case 'info':
                if (variant === 'outline') return "border border-info-border text-info-text";
                if (variant === 'glass') return "bg-info-bg/10 backdrop-blur-md text-info-text border-info-border/20 shadow-sm";
                if (variant === 'soft') return "bg-info-bg text-info-text border border-info-border/50";
                return "bg-info-text text-white shadow-sm shadow-info-text/25";

            case 'brand':
                if (variant === 'outline') return "border border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400";
                if (variant === 'glass') return "bg-brand-500/10 backdrop-blur-md text-brand-700 dark:text-brand-300 border border-brand-500/20 shadow-sm";
                if (variant === 'soft') return "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800";
                return "bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-sm shadow-brand-500/25";

            case 'neutral':
            default:
                if (variant === 'outline') return "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300";
                if (variant === 'glass') return "bg-slate-500/10 backdrop-blur-md text-slate-700 dark:text-slate-300 border border-slate-500/20 shadow-sm";
                if (variant === 'soft') return "bg-slate-500/10 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/10";
                return "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm";
        }
    };

    return (
        <span
            className={`${baseStyles} ${sizeStyles[size]} ${getStatusStyles()} ${className} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            {...props}
        >
            {Icon && <Icon className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />}
            {children}
        </span>
    );
});

Badge.displayName = 'Badge';
