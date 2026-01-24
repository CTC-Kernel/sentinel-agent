import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FloatingLabelTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
}

export const FloatingLabelTextarea = React.forwardRef<HTMLTextAreaElement, FloatingLabelTextareaProps>(({
    label,
    error,
    className = '',
    value,
    onFocus,
    onBlur,
    onChange,
    ...props
}, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasContent, setHasContent] = useState(false);
    const hasValue = (value !== undefined && value !== '') || hasContent;

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(false);
        onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setHasContent(e.target.value !== '');
        onChange?.(e);
    };

    const autoId = React.useId();
    const fieldId = props.id || `floating-textarea-${autoId}`;
    const errorId = `${fieldId}-error`;
    const describedBy = [props['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined;

    return (
        <div className={`relative ${className}`}>
            <div className={`
                relative w-full rounded-2xl border transition-all duration-200 backdrop-blur-sm
                ${error
                    ? 'border-red-500/60 bg-red-500/5 dark:bg-red-500/10'
                    : isFocused
                        ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white/80 dark:bg-white/5 shadow-glow'
                        : 'border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-brand-500/30 dark:hover:border-white/20'
                }
            `}>
                <textarea
                    ref={ref}
                    {...props}
                    id={fieldId}
                    value={value}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    aria-invalid={!!error}
                    aria-describedby={describedBy}
                    className={`
                        w-full px-4 py-3.5 bg-transparent outline-none font-medium text-slate-900 dark:text-white
                        placeholder-transparent rounded-2xl resize-none
                    `}
                    placeholder={label}
                />

                <label
                    htmlFor={fieldId}
                    className={`
                        absolute left-4 transition-all duration-200 pointer-events-none
                        ${(isFocused || hasValue)
                            ? '-top-2.5 text-[10px] font-bold uppercase tracking-widest bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-1.5 rounded-md'
                            : 'top-3.5 text-sm font-medium'
                        }
                        ${error
                            ? 'text-red-500'
                            : isFocused
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-slate-500 dark:text-slate-400'
                        }
                    `}
                >
                    {label}
                </label>
            </div>


            <AnimatePresence>
                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: -5, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -5, height: 0 }}
                        transition={{ duration: 0.2 }}
                        id={errorId}
                        className="text-red-500 text-xs mt-1.5 ml-1 font-medium overflow-hidden"
                    >
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
});

FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';
