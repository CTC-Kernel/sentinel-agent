import { memo } from 'react';
import { ActionType } from '../../types';
import { Check } from '../ui/Icons';

interface PermissionCheckProps {
    resource: string;
    action: ActionType;
    isChecked: boolean;
    onToggle: (resource: string, action: ActionType) => void;
}

export const PermissionCheck = memo(({ resource, action, isChecked, onToggle }: PermissionCheckProps) => {
    return (
        <td className="px-4 py-3 text-center">
            <button
                type="button"
                onClick={() => onToggle(resource, action)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isChecked
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'border-border/40 dark:border-slate-600 hover:border-brand-500'
                    }`}
            >
                {isChecked && <Check className="h-3.5 w-3.5" />}
            </button>
        </td>
    );
});
