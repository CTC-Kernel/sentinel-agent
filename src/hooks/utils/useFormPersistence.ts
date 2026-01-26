import { useEffect, useState, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';

/**
 * Hook to persist form state to localStorage and restore it on mount.
 * @param key Unique key for localStorage
 * @param formMethods react-hook-form methods object
 * @param options Configuration options
 */
export function useFormPersistence<T extends Object>(
    key: string,
    formMethods: UseFormReturn<any>,
    options: {
        enabled?: boolean;
        excludeFields?: string[];
        onRestore?: (data: T) => void;
    } = {}
) {
    const { watch, reset } = formMethods;
    const { enabled = true, excludeFields = [] } = options;
    const [isRestored, setIsRestored] = useState(false);

    // Load draft on mount
    useEffect(() => {
        if (!enabled) return;

        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (options.onRestore) {
                    options.onRestore(parsed);
                } else {
                    reset(parsed);
                }
                setIsRestored(true);
            }
        } catch (e) {
            console.error(`Failed to load form draft for key ${key}`, e);
        }
    }, [key, enabled, reset]); // eslint-disable-line react-hooks/exhaustive-deps

    // Save draft on change
    useEffect(() => {
        if (!enabled) return;

        const subscription = watch((value) => {
            // Filter out excluded fields if needed (omitted for performance unless deep clone needed)
            const dataToSave = { ...value };
            excludeFields.forEach(f => delete (dataToSave as any)[f]);

            try {
                localStorage.setItem(key, JSON.stringify(dataToSave));
            } catch (e) {
                console.error(`Failed to save draft for key ${key}`, e);
            }
        });

        return () => subscription.unsubscribe();
    }, [watch, key, enabled, excludeFields]);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(key);
    }, [key]);

    return { isRestored, clearDraft };
}
