import React from 'react';
import { UserProfile } from '../../types';
import { Check } from '../ui/Icons';

interface MemberSelectorProps {
    users: UserProfile[];
    selectedMembers: string[];
    onToggle: (uid: string) => void;
}

export const MemberSelector: React.FC<MemberSelectorProps> = React.memo(({ users, selectedMembers, onToggle }) => {
    // Safe array access
    const safeUsers = users ?? [];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
            {safeUsers.filter(u => !u.isPending).map(u => {
                const isSelected = selectedMembers.includes(u.uid);
                return (
                    <div
                        key={u.uid || 'unknown'}
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggle(u.uid)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onToggle(u.uid);
                            }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-3xl border cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isSelected
                            ? 'bg-brand-50 dark:bg-brand-800 border-brand-200 dark:border-brand-800'
                            : 'bg-white dark:bg-slate-800 border-border/40 dark:border-white/5 hover:border-brand-300'
                            }`}
                    >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'border-border/40 dark:border-slate-600'
                            }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.displayName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{u.email}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

MemberSelector.displayName = 'MemberSelector';
