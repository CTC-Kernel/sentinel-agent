import React from 'react';

type FloatingLabelIconComponent = React.ElementType<{ className?: string }>;

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    icon?: FloatingLabelIconComponent;
    textarea?: boolean;
    rows?: number;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, FloatingLabelInputProps>(({
    label,
    error,
    icon: Icon,
    className = '',
    value,
    textarea,
    rows = 3,
    ...props
}, ref) => {
    const autoId = React.useId();
    const fieldId = props.id || `floating-input-${autoId}`;
    const errorId = `${fieldId}-error`;
    const describedBy = [props['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined;

    return (
        <div className={`relative ${className}`}>
            <div className={`
                relative flex items-center w-full rounded-2xl transition-all duration-300 group
                ${error
                    ? 'border border-red-500 bg-red-50/50 dark:bg-red-900/10'
                    : 'glass-input shadow-sm group-focus-within:border-brand-500/50 group-focus-within:shadow-glow'
                }
            `}>
                {Icon && (
                    <div className={`pl-4 transition-colors duration-200 ${error ? 'text-red-500' : 'text-slate-400 group-focus-within:text-brand-500'} ${textarea ? 'self-start mt-3.5' : ''}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}

                {textarea ? (
                    <textarea
                        ref={ref as React.Ref<HTMLTextAreaElement>}
                        {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>}
                        id={fieldId}
                        value={value}
                        aria-invalid={!!error}
                        aria-describedby={describedBy}
                        aria-required={props.required}
                        rows={rows}
                        className={`
                            peer w-full px-4 py-3.5 bg-transparent outline-none font-medium text-slate-900 dark:text-white
                            placeholder-transparent rounded-2xl resize-none
                            ${Icon ? 'pl-2' : ''}
                        `}
                        placeholder=" "
                    />
                ) : (
                    <input value={value}
                        ref={ref as React.Ref<HTMLInputElement>}
                        {...props}
                        id={fieldId}
                        aria-invalid={!!error}
                        aria-describedby={describedBy}
                        aria-required={props.required}
                        className={`
                            peer w-full px-4 py-3.5 bg-transparent outline-none font-medium text-slate-900 dark:text-white
                            placeholder-transparent rounded-2xl
                            ${Icon ? 'pl-2' : ''}
                        `}
                        placeholder=" "
                    />
                )}

                <label
                    htmlFor={fieldId}
                    className={`
                        absolute left-4 transition-all duration-200 pointer-events-none
                        -top-2.5 text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-950 px-1 rounded
                        peer-focus:text-brand-600 dark:peer-focus:text-brand-400
                        ${error
                            ? 'text-red-500'
                            : 'text-brand-600 dark:text-brand-400'
                        }
                        ${Icon ? 'ml-7' : ''}
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

FloatingLabelInput.displayName = 'FloatingLabelInput';

export const FloatingLabelTextarea = (props: FloatingLabelInputProps) => <FloatingLabelInput textarea {...props} />;
