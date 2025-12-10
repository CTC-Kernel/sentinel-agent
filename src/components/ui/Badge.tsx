import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'soft' | 'glass';
    status?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';
    size?: 'sm' | 'md';
    className?: string;
    icon?: any;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'soft',
    status = 'neutral',
    size = 'sm',
    className = '',
    icon: Icon
}) => {
    // Base styles
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 animate-badge-in";

    // Size styles
    const sizeStyles = {
        sm: "px-2 py-0.5 text-[10px] rounded-md gap-1",
        md: "px-2.5 py-1 text-xs rounded-lg gap-1.5"
    };

    // Status & Variant styles
    const getStatusStyles = () => {
        switch (status) {
            case 'success':
                if (variant === 'outline') return "border border-success-text text-success-text";
                if (variant === 'glass') return "bg-success-bg/80 backdrop-blur-sm text-success-text border border-success-border/50";
                return "bg-success-bg text-success-text border border-success-border/50";

            case 'warning':
                if (variant === 'outline') return "border border-warning-text text-warning-text";
                if (variant === 'glass') return "bg-warning-bg/80 backdrop-blur-sm text-warning-text border border-warning-border/50";
                return "bg-warning-bg text-warning-text border border-warning-border/50";

            case 'error':
                if (variant === 'outline') return "border border-error-text text-error-text";
                if (variant === 'glass') return "bg-error-bg/80 backdrop-blur-sm text-error-text border border-error-border/50";
                return "bg-error-bg text-error-text border border-error-border/50";

            case 'info':
                if (variant === 'outline') return "border border-info-text text-info-text";
                if (variant === 'glass') return "bg-info-bg/80 backdrop-blur-sm text-info-text border border-info-border/50";
                return "bg-info-bg text-info-text border border-info-border/50";

            case 'brand':
                if (variant === 'outline') return "border border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400";
                if (variant === 'glass') return "bg-brand-50/80 dark:bg-brand-900/20 backdrop-blur-sm text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800";
                return "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800";

            case 'neutral':
            default:
                if (variant === 'outline') return "border border-slate-500 text-slate-600 dark:text-slate-400";
                if (variant === 'glass') return "bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
                return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
        }
    };

    return (
        <span className={`${baseStyles} ${sizeStyles[size]} ${getStatusStyles()} ${className}`}>
            {Icon && <Icon className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />}
            {children}
        </span>
    );
};
