/**
 * SearchInput Component
 * Simple search input with icon and clear functionality
 */

import React, { useState, useCallback } from 'react';
import { Search, X } from './Icons';
import { cn } from '../../lib/utils';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    className,
    debounceMs = 0
}) => {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        if (debounceMs > 0) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                onChange(newValue);
            }, debounceMs);
        } else {
            onChange(newValue);
        }
    }, [onChange, debounceMs]);

    const handleClear = useCallback(() => {
        setLocalValue('');
        onChange('');
    }, [onChange]);

    // Sync local value with external value when it changes
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={cn('relative', className)}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={cn(
                    'block w-full pl-10 pr-10 py-2.5',
                    'bg-white dark:bg-slate-800',
                    'border border-slate-200 dark:border-slate-700',
                    'rounded-xl',
                    'text-sm text-slate-900 dark:text-white',
                    'placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                    'transition-all duration-200'
                )}
            />
            {localValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                    <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
                </button>
            )}
        </div>
    );
};
