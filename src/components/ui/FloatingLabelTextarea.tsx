import React, { useState } from 'react';

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
                relative w-full rounded-2xl border transition-all duration-200
                ${error
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                    : isFocused
                        ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-black/20'
                        : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 hover:border-gray-300 dark:hover:border-white/20'
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
                            ? '-top-2.5 text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-900 px-1 rounded'
                            : 'top-3.5 text-sm font-medium'
                        }
                        ${error
                            ? 'text-red-500'
                            : isFocused
                                ? 'text-brand-600'
                                : 'text-slate-600'
                        }
                    `}
                >
                    {label}
                </label>
            </div>

            {error && (
                <p id={errorId} className="text-red-500 text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
});

FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';
