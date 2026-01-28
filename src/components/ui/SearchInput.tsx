/**
 * SearchInput Component
 * Simple search input with icon and clear functionality
 * Shows visual feedback during debounce waiting period
 */

import React, { useState, useCallback } from 'react';
import { Search, X, Loader2 } from './Icons';
import { cn } from '../../lib/utils';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    debounceMs?: number;
    /** Show loading state externally (e.g., when fetching results) */
    isLoading?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    className,
    debounceMs = 0,
    isLoading = false
}) => {
    const [localValue, setLocalValue] = useState(value);
    const [isDebouncing, setIsDebouncing] = useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        if (debounceMs > 0) {
            // Show debouncing indicator
            setIsDebouncing(true);

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                setIsDebouncing(false);
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

    const showLoading = isLoading || isDebouncing;

    return (
        <div className={cn('relative', className)}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {showLoading ? (
                    <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />
                ) : (
                    <Search className="h-4 w-4 text-slate-400" />
                )}
            </div>
            <input
                type="text"
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                aria-busy={showLoading}
                className={cn(
                    'block w-full pl-10 pr-10 py-2.5',
                    'bg-white dark:bg-slate-800',
                    'border border-border/40 dark:border-slate-700',
                    'rounded-3xl',
                    'text-sm text-slate-900 dark:text-white',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:border-brand-500',
                    'transition-all duration-200'
                )}
            />
            {localValue && !showLoading && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    aria-label="Effacer la recherche"
                >
                    <X className="h-4 w-4 text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
                </button>
            )}
        </div>
    );
};
