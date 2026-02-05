import React from 'react';
import { Document } from '../../types';

interface WorkflowStatusBadgeProps {
 status: Document['status'];
 workflowStatus?: Document['workflowStatus'];
}

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({ status, workflowStatus }) => {
 const getStyles = () => {
 // Priority to workflow status for granular view
 if (workflowStatus === 'Review') return 'bg-warning-bg text-warning-text border-warning-border';
 if (workflowStatus === 'Approved') return 'bg-success-bg text-success-text border-success-border';
 if (workflowStatus === 'Rejected') return 'bg-error-bg text-error-text border-error-border';

 // Fallback to legacy status
 switch (status) {
 case 'Publié': return 'bg-success-bg text-success-text border-success-border';
 case 'Approuvé': return 'bg-success-bg text-success-text border-success-border';
 case 'En revue': return 'bg-warning-bg text-warning-text border-warning-border';
 case 'Rejeté': return 'bg-error-bg text-error-text border-error-border';
 case 'Obsolète': return 'bg-muted text-muted-foreground border-border';
 case 'Archivé': return 'bg-muted text-muted-foreground border-border';
 default: return 'bg-muted text-muted-foreground border-border';
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
