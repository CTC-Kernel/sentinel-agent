import React from 'react';
import { X } from './Icons';
import { motion } from 'framer-motion';

interface FilterPillProps {
    label: string;
    value: string;
    onRemove: () => void;
    color?: 'brand' | 'warning' | 'success' | 'error' | 'slate';
}

export const FilterPill: React.FC<FilterPillProps> = ({
    label,
    value,
    onRemove,
    color = 'brand'
}) => {
    const colorStyles = {
        brand: 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-800/50',
        warning: 'bg-warning-50 text-warning-700 border-warning-100 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800/50',
        success: 'bg-success-50 text-success-700 border-success-100 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800/50',
        error: 'bg-error-50 text-error-700 border-error-100 dark:bg-error-900/20 dark:text-error-400 dark:border-error-800/50',
        slate: 'bg-slate-50 dark:bg-slate-900 text-slate-700 border-slate-100 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all shadow-sm ${colorStyles[color]}`}
        >
            <span className="opacity-60 whitespace-nowrap">{label}:</span>
            <span className="whitespace-nowrap">{value}</span>
            <button
                onClick={onRemove}
                className="ml-0.5 p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                aria-label={`Supprimer le filtre ${label}`}
            >
                <X className="h-3 w-3" />
            </button>
        </motion.div>
    );
};
