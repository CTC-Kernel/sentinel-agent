import React from 'react';
import { Document } from '../../types';

interface WorkflowStatusBadgeProps {
    status: Document['status'];
    workflowStatus?: Document['workflowStatus'];
}

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({ status, workflowStatus }) => {
    const getStyles = () => {
        // Priority to workflow status for granular view
        if (workflowStatus === 'Review') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50';
        if (workflowStatus === 'Approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50';
        if (workflowStatus === 'Rejected') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';

        // Fallback to legacy status
        switch (status) {
            case 'Publié': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50';
            case 'Approuvé': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50';
            case 'En revue': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50';
            case 'Rejeté': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';
            case 'Obsolète': return 'bg-gray-100 text-slate-700 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        }
    };

    const getLabel = () => {
        if (workflowStatus === 'Review') return 'En Revue Peer';
        if (workflowStatus === 'Approved') return 'Validé';
        if (workflowStatus === 'Rejected') return 'Rejeté';
        return status;
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyles()}`}>
            {getLabel()}
        </span>
    );
};
