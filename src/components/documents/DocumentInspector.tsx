import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Document, Control, UserProfile } from '../../types';
import { Drawer } from '../ui/Drawer';
import { useLocale } from '../../hooks/useLocale';
import { ScrollableTabs } from '../ui/ScrollableTabs';
import { FileText, History, MessageSquare, Eye, ShieldCheck, List, Edit, Trash2 } from '../ui/Icons';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';
import { ApprovalFlow } from './ApprovalFlow';
import { DocumentVersionHistory } from './DocumentVersionHistory';
import { CommentSection } from '../collaboration/CommentSection';
import { TimelineView } from '../shared/TimelineView';
import { DocumentDetails } from './inspector/DocumentDetails';
import { useDocumentVersions } from '../../hooks/documents/useDocumentVersions';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
// FilePreview is imported but intentionally not used via the component tag to avoid auto-modal. 
// However, we should remove the import if we are not using it at all.
// Wait, we replaced the usage with a button.
// BUT, if we want to "Open" the preview, we need to pass a callback or something?
// Current implementation passes 'onSecureView' to Inspector. SecureView opens a Global Viewer or something?
// In `useDocumentWorkflow.ts`, handleSecureView likely sets some state to open the preview?
// If so, we don't need FilePreview directly in Inspector.
// DocumentInspector is independent.

interface DocumentInspectorProps {
 isOpen: boolean;
 onClose: () => void;
 document: Document | null;
 controls: Control[];
 canEdit: boolean;
 users: UserProfile[];
 onEdit: () => void;
 onDelete: () => void;
 onWorkflowAction: (action: 'submit' | 'approve' | 'reject' | 'sign') => void;
 onSecureView: (doc: Document) => void;
}

export const DocumentInspector: React.FC<DocumentInspectorProps> = ({
 isOpen,
 onClose,
 document: selectedDocument,
 controls,
 canEdit,
 users,
 onEdit,
 onDelete,
 onWorkflowAction,
 onSecureView
}) => {
 const { t } = useLocale();
 const [activeTab, setActiveTab] = useState<'details' | 'versions' | 'history' | 'comments'>('details');
 const [isDeleting, setIsDeleting] = useState(false);
 const { versions } = useDocumentVersions(selectedDocument?.id || null, isOpen);

 const handleDelete = async () => {
 if (isDeleting) return;
 setIsDeleting(true);
 try {
 await onDelete();
 } finally {
 setIsDeleting(false);
 }
 };

 useEffect(() => {
 if (!isOpen || !selectedDocument) {
 setActiveTab('details');
 }
 }, [isOpen, selectedDocument]);

 if (!selectedDocument) return null;

 const linkedControls = controls.filter(c => Array.isArray(c.evidenceIds) && c.evidenceIds.includes(selectedDocument.id));

 const ownerUser = users.find(u => u.displayName === selectedDocument.owner);

 return (
 <Drawer
 isOpen={isOpen}
 onClose={onClose}
 title={selectedDocument.title}
 width="max-w-[95vw] md:max-w-6xl"
 actions={
 <div className="flex gap-2">
  {canEdit && (
  <>
  <Button
  onClick={onEdit}
  variant="ghost"
  size="icon"
  aria-label={t('documents.inspector.editDocument', { defaultValue: 'Modifier le document' })}
  className="text-muted-foreground hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/30"
  title={t('documents.inspector.edit', { defaultValue: 'Modifier' })}
  >
  <Edit className="h-5 w-5" />
  </Button>
  <Button
  onClick={handleDelete}
  disabled={isDeleting}
  variant="ghost"
  size="icon"
  className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:bg-muted disabled:text-muted-foreground"
  title={isDeleting ? t('documents.inspector.deleting', { defaultValue: 'Suppression...' }) : t('documents.inspector.delete', { defaultValue: 'Supprimer' })}
  aria-label={t('documents.inspector.deleteDocument', { defaultValue: 'Supprimer le document' })}
  >
  <Trash2 className="h-5 w-5" />
  </Button>
  </>
  )}
 </div>
 }
 >
 <div className="p-6 space-y-6 sm:space-y-8">
 {/* Meta Header */}
 <div className="flex flex-wrap items-start justify-between gap-4">
  <div className="space-y-1">
  <div className="flex items-center gap-2">
  <WorkflowStatusBadge status={selectedDocument.status} />
  {selectedDocument.isSecure && (
  <span className="bg-success-100 text-success-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-success-200 dark:bg-success-900/30 dark:text-success-400 dark:border-success-800">
   <ShieldCheck className="h-3 w-3" /> {t('documents.inspector.digitalSafe', { defaultValue: 'Coffre-fort' })}
  </span>
  )}
  <span className="text-sm text-muted-foreground px-2 py-0.5 bg-muted rounded-lg border border-border/40">
  v{selectedDocument.version}
  </span>
  </div>
  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
  <span className="mr-1">{t('documents.inspector.owner', { defaultValue: 'Propriétaire:' })}</span>
  <img
  src={getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role)}
  alt={selectedDocument.owner}
  className="w-4 h-4 rounded-full object-cover bg-muted"
  onError={(e) => {
   const target = e.target as HTMLImageElement;
   target.src = getUserAvatarUrl(null, ownerUser?.role);
  }}
  role="presentation"
  />
  <span>{ownerUser?.displayName || selectedDocument.owner}</span>
  </div>
  </div>
  {/* Action Buttons */}
  <div className="flex gap-2">
  {selectedDocument.url && (
  <Button
  onClick={() => onSecureView(selectedDocument)}
  className="flex items-center gap-2 bg-card text-white hover:bg-muted shadow-sm font-medium"
  >
  <Eye className="w-4 h-4" />
  {selectedDocument.isSecure ? t('documents.inspector.secureView', { defaultValue: 'Consultation Sécurisée' }) : t('documents.inspector.view', { defaultValue: 'Visualiser' })}
  </Button>
  )}
  </div>
 </div>

 <ApprovalFlow
  document={selectedDocument}
  users={users} // Removed currentUser
  onPublish={() => onWorkflowAction('submit')} // Or adapt? onWorkflowAction takes 'submit'|'approve'... 
 // ApprovalFlow calls submitForReview or publishDocument internally hook. 
 // But here we are passing onAction prop to DocumentInspector which is expected to call handleWorkflowAction from hook.
 // ApprovalFlow implementation uses useDocumentWorkflow internally too (lines 16).
 // So actually DocumentInspector's onWorkflowAction prop might be redundant if ApprovalFlow does it?
 // But DocumentInspector interface wants onWorkflowAction.
 // Let's check ApprovalFlow definition again.
 // It has onPublish prop optional. But it handles actions itself. 
 // DocumentInspector parent (Documenst.tsx) passes handleWorkflowAction.
 // If ApprovalFlow handles it, maybe we don't need to pass anything?
 // But wait, the ApprovalFlow component I verified earlier imported useDocumentWorkflow internally.
 // So it does the logic.
 // However, we can simply not pass anything to ApprovalFlow if not needed, or pass users.
 />

 <ScrollableTabs
  tabs={[
  { id: 'details', label: t('documents.inspector.tabDetails', { defaultValue: 'Détails' }), icon: FileText },
  { id: 'versions', label: t('documents.inspector.tabVersions', { defaultValue: 'Versions' }), icon: List },
  { id: 'history', label: t('documents.inspector.tabHistory', { defaultValue: 'Historique' }), icon: History },
  { id: 'comments', label: t('documents.inspector.tabComments', { defaultValue: 'Commentaires' }), icon: MessageSquare }
  ]}
  activeTab={activeTab}
  onTabChange={(id) => setActiveTab(id as 'details' | 'versions' | 'history' | 'comments')}
 />

 <div className="mt-6">
  {activeTab === 'details' && (
  <DocumentDetails
  document={selectedDocument}
  controls={linkedControls}
  onSecureView={onSecureView}
  />
  )}

  {activeTab === 'versions' && (
  <DocumentVersionHistory versions={versions} />
  )}

  {activeTab === 'history' && selectedDocument && (
  <TimelineView
  resourceId={selectedDocument.id}
  resourceType="Document"
  />
  )}

  {activeTab === 'comments' && selectedDocument && (
  <CommentSection
  documentId={selectedDocument.id}
  collectionName="documents"
  />
  )}
 </div>
 </div>
 </Drawer>
 );
};

// Headless UI handles FocusTrap and keyboard navigation
