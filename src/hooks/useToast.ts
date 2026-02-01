/**
 * useToast Hook
 *
 * Provides a hook-based API for toast notifications.
 * Wraps the existing toast utility from @/lib/toast.
 */

import { toast as toastLib } from '../lib/toast';
import { useStore } from '../store';

interface ToastOptions {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
}

/**
 * Hook to access toast notifications with a consistent API.
 *
 * Usage:
 * const { toast } = useToast();
 * toast({ title: 'Success', description: 'Item saved' });
 * toast({ variant: 'destructive', title: 'Error', description: 'Failed to save' });
 */
export const useToast = () => {
    const t = useStore(s => s.t);
    const toast = (options: ToastOptions) => {
        const { title, description, variant } = options;
        const message = description || title || '';
        const displayTitle = title || (variant === 'destructive' ? t('common.error', { defaultValue: 'Erreur' }) : t('common.notification', { defaultValue: 'Notification' }));

        if (variant === 'destructive') {
            return toastLib.error(displayTitle, message);
        }
        return toastLib.success(displayTitle, message);
    };

    return { toast };
};

export default useToast;
