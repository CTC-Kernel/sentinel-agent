import React from 'react';

type BadgeIconComponent = React.ElementType<{ className?: string }>;

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'soft' | 'glass';
    status?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';
    size?: 'sm' | 'md';
    className?: string;
    icon?: BadgeIconComponent;
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
                if (variant === 'outline') return "border border-emerald-500 text-emerald-600 dark:text-emerald-400";
                if (variant === 'glass') return "bg-emerald-500/10 backdrop-blur-md text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-sm";
                if (variant === 'soft') return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30";
                return "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25";

            case 'warning':
                if (variant === 'outline') return "border border-amber-500 text-amber-600 dark:text-amber-400";
                if (variant === 'glass') return "bg-amber-500/10 backdrop-blur-md text-amber-700 dark:text-amber-300 border border-amber-500/20 shadow-sm";
                if (variant === 'soft') return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30";
                return "bg-amber-500 text-white shadow-sm shadow-amber-500/25";

            case 'error':
                if (variant === 'outline') return "border border-rose-500 text-rose-600 dark:text-rose-400";
                if (variant === 'glass') return "bg-rose-500/10 backdrop-blur-md text-rose-700 dark:text-rose-300 border border-rose-500/20 shadow-sm";
                if (variant === 'soft') return "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30";
                return "bg-rose-500 text-white shadow-sm shadow-rose-500/25";

            case 'info':
                if (variant === 'outline') return "border border-sky-500 text-sky-600 dark:text-sky-400";
                if (variant === 'glass') return "bg-sky-500/10 backdrop-blur-md text-sky-700 dark:text-sky-300 border border-sky-500/20 shadow-sm";
                if (variant === 'soft') return "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/30";
                return "bg-sky-500 text-white shadow-sm shadow-sky-500/25";

            case 'brand':
                if (variant === 'outline') return "border border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400";
                if (variant === 'glass') return "bg-brand-500/10 backdrop-blur-md text-brand-700 dark:text-brand-300 border border-brand-500/20 shadow-sm";
                if (variant === 'soft') return "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800";
                return "bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-sm shadow-brand-500/25";

            case 'neutral':
            default:
                if (variant === 'outline') return "border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400";
                if (variant === 'glass') return "bg-slate-500/10 backdrop-blur-md text-slate-700 dark:text-slate-300 border border-slate-500/20 shadow-sm";
                if (variant === 'soft') return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
                return "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm";
        }
    };

    return (
        <span className={`${baseStyles} ${sizeStyles[size]} ${getStatusStyles()} ${className}`}>
            {Icon && <Icon className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />}
            {children}
        </span>
    );
};
