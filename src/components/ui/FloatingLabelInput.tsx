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
                    : 'glass-input shadow-sm group-focus-within:ring-2 group-focus-within:ring-brand-500/20 group-focus-within:border-brand-500/50 group-focus-within:shadow-glow'
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
                    <input
                        ref={ref as React.Ref<HTMLInputElement>}
                        {...props}
                        id={fieldId}
                        value={value}
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
                        peer-focus:-top-2.5 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:bg-white dark:peer-focus:bg-[#0B1120] peer-focus:px-1 peer-focus:rounded
                        peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:bg-white dark:peer-[:not(:placeholder-shown)]:bg-[#0B1120] peer-[:not(:placeholder-shown)]:px-1 peer-[:not(:placeholder-shown)]:rounded
                        top-3.5 text-sm font-medium
                        ${error
                            ? 'text-red-500'
                            : 'text-slate-500 dark:text-slate-400 peer-focus:text-brand-600 dark:peer-focus:text-brand-400'
                        }
                        ${Icon ? 'ml-7 peer-focus:ml-0 peer-[:not(:placeholder-shown)]:ml-0' : ''}
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
