import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    color?: 'slate' | 'blue' | 'indigo' | 'rose' | 'amber' | 'emerald';
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, actionLabel, onAction, color = 'slate' }) => {
    const colorStyles = {
        slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyles[color]}`}>
                <Icon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed font-medium">{description}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm shadow-xl shadow-slate-900/20 dark:shadow-none hover:scale-105 transition-all"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
