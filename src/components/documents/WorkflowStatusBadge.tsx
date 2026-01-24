import React from 'react';
import { Document } from '../../types';

interface WorkflowStatusBadgeProps {
    status: Document['status'];
    workflowStatus?: Document['workflowStatus'];
}

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({ status, workflowStatus }) => {
    const getStyles = () => {
        // Priority to workflow status for granular view
        if (workflowStatus === 'Review') return 'bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-900/30 dark:text-warning-400 dark:border-warning-900/50';
        if (workflowStatus === 'Approved') return 'bg-success-100 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-400 dark:border-success-900/50';
        if (workflowStatus === 'Rejected') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';

        // Fallback to legacy status
        switch (status) {
            case 'Publié': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50';
            case 'Approuvé': return 'bg-success-100 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-400 dark:border-success-900/50';
            case 'En revue': return 'bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-900/30 dark:text-warning-400 dark:border-warning-900/50';
            case 'Rejeté': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';
            case 'Obsolète': return 'bg-slate-100 dark:bg-slate-800 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            case 'Archivé': return 'bg-slate-100 dark:bg-slate-800 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
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
