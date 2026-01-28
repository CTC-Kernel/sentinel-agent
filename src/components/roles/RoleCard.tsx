import React from 'react';
import { Role, getRoleName, getRoleDescription } from '../../utils/permissions';

interface RoleCardProps {
    role: Role;
    count: number;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, count }) => {
    return (
        <div className="glass-premium p-4 rounded-2xl border border-border/40">
            <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {getRoleName(role)}
                </h3>
                <span className="px-2 py-0.5 bg-brand-500 text-white rounded-full text-[11px] font-bold">
                    {count}
                </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">
                {getRoleDescription(role)}
            </p>
        </div>
    );
};
