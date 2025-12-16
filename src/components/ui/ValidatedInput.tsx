import React from 'react';

// Input component with validation
interface ValidatedInputProps {
    label: string;
    field: string;
    value: string | number | null | undefined;
    error?: string;
    touched?: boolean;
    onChange: (value: string | number) => void;
    onBlur: () => void;
    type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
    placeholder?: string;
    required?: boolean;
    className?: string;
    disabled?: boolean;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
    label,
    field,
    value,
    error,
    touched,
    onChange,
    onBlur,
    type = 'text',
    placeholder,
    required,
    className = '',
    disabled = false
}) => {
    const hasError = touched && error;

    return (
        <div className={className}>
            <label htmlFor={field} className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                id={field}
                type={type}
                value={value ?? ''}
                onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full px-4 py-3.5 rounded-2xl border ${hasError
                    ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10'
                    : 'border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-[#0B1120]/40 hover:bg-white/80 dark:hover:bg-[#0B1120]/60 backdrop-blur-sm shadow-sm'
                    } text-slate-900 dark:text-white focus:ring-2 ${hasError ? 'focus:ring-red-500' : 'focus:ring-brand-500/20 focus:border-brand-500'
                    } outline-none font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            {hasError && (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </p>
            )}
        </div>
    );
};
