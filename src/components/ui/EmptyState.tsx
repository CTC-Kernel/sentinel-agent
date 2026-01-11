import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    color?: 'slate' | 'blue' | 'indigo' | 'rose' | 'amber' | 'emerald';
    compact?: boolean;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, actionLabel, onAction, color = 'slate', compact = false, className = '' }) => {
    const colorStyles = {
        slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };

    if (compact) {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-50 duration-500">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyles[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1 tracking-tight">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">{description}</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-50 duration-500 ${className}`}>
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyles[color]}`}>
                <Icon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">{title}</h3>
            <p className="text-muted-foreground max-w-md mb-8 leading-relaxed font-medium">{description}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:scale-105 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
