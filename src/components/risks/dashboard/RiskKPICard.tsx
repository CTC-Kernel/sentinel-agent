import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from '../../ui/Icons';

interface RiskKPICardProps {
    title: string;
    value: string | number;
    subtext: string;
    icon: LucideIcon;
    color: 'red' | 'orange' | 'blue' | 'purple' | 'emerald';
    chip?: {
        label: string;
        color?: 'emerald' | 'red';
    };
    delay?: number;
}

export const RiskKPICard: React.FC<RiskKPICardProps> = ({

    value,
    subtext,
    icon: Icon,
    color,
    chip,
    delay = 0
}) => {
    const colorStyles = {
        red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
        orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
        purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="p-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${colorStyles[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {chip && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${chip.color === 'emerald' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : ''
                        }`}>
                        {chip.label}
                    </span>
                )}
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{subtext}</div>
        </motion.div>
    );
};
