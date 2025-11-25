import React, { useState } from 'react';

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    icon?: React.ElementType;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
    label,
    error,
    icon: Icon,
    className = '',
    value,
    onFocus,
    onBlur,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value !== undefined && value !== '';

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        onBlur?.(e);
    };

    return (
        <div className={`relative ${className}`}>
            <div className={`
                relative flex items-center w-full rounded-2xl border transition-all duration-200
                ${error
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                    : isFocused
                        ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-black/20'
                        : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 hover:border-gray-300 dark:hover:border-white/20'
                }
            `}>
                {Icon && (
                    <div className={`pl-4 ${error ? 'text-red-500' : isFocused ? 'text-brand-500' : 'text-slate-400'}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}

                <input
                    {...props}
                    value={value}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className={`
                        w-full px-4 py-3.5 bg-transparent outline-none font-medium text-slate-900 dark:text-white
                        placeholder-transparent rounded-2xl
                        ${Icon ? 'pl-2' : ''}
                    `}
                    placeholder={label}
                />

                <label
                    className={`
                        absolute left-4 transition-all duration-200 pointer-events-none
                        ${(isFocused || hasValue)
                            ? '-top-2.5 text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-900 px-1 rounded'
                            : 'top-3.5 text-sm font-medium'
                        }
                        ${error
                            ? 'text-red-500'
                            : isFocused
                                ? 'text-brand-600'
                                : 'text-slate-500'
                        }
                        ${Icon && !(isFocused || hasValue) ? 'ml-7' : ''}
                    `}
                >
                    {label}
                </label>
            </div>

            {error && (
                <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
};
