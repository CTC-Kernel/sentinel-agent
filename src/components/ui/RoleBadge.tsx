import React from 'react';

interface RoleBadgeProps {
    role: string;
    className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
    switch (role) {
        case 'admin':
            return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800 ${className}`}>Admin</span>;
        case 'rssi':
            return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 ${className}`}>RSSI</span>;
        case 'auditor':
            return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-slate-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 ${className}`}>Auditeur</span>;
        case 'project_manager':
            return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 ${className}`}>Chef Projet</span>;
        case 'direction':
            return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 ${className}`}>Direction</span>;
        default:
            return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-gray-200 dark:border-slate-700 ${className}`}>Utilisateur</span>;
    }
};
