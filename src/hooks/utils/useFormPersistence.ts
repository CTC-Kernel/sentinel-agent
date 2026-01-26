import { useEffect, useState, useCallback } from 'react';
import { UseFormReturn, FieldValues } from 'react-hook-form';

/**
 * Hook to persist form state to localStorage and restore it on mount.
 */
export function useFormPersistence<T extends FieldValues>(
    key: string,
    formMethods: Pick<UseFormReturn<T>, 'watch' | 'reset'>,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled, reset]);

    // Save draft on change
    useEffect(() => {
        if (!enabled) return;

        const subscription = watch((value) => {
            const dataToSave = { ...value };
            excludeFields.forEach((f) => {
                // Safe delete with type assertion that is not 'any'
                delete dataToSave[f as keyof typeof dataToSave];
            });

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
