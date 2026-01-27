import React from 'react';
import { motion } from 'framer-motion';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled = false, className = '' }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2
                ${checked ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${className}
            `}
        >
            <motion.span
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className={`
                    inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0
                    ${checked ? 'translate-x-6' : 'translate-x-1'}
                `}
            />
        </button>
    );
};
