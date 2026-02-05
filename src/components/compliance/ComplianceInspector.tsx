import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Control, UserProfile, Asset, Supplier, Risk, Project, Document, Finding, Framework } from '../../types';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { Skeleton } from '../../components/ui/Skeleton';
import { Loader2, Link, FileText, Paperclip, MessageSquare, ChevronRight } from '../../components/ui/Icons';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { TimelineView } from '../shared/TimelineView';
import { ComplianceDetails } from './inspector/ComplianceDetails';
import { ComplianceEvidence } from './inspector/ComplianceEvidence';
import { ComplianceLinkedItems } from './inspector/ComplianceLinkedItems';
import { AgentEvidencePanel } from './AgentEvidencePanel';
import { useLocale } from '@/hooks/useLocale';

interface ComplianceInspectorProps {
 control: Control;
 canEdit: boolean;
 usersList: UserProfile[];
 assets: Asset[];
 suppliers: Supplier[];
 documents: Document[];
 risks: Risk[];
 projects: Project[];
 findings: Finding[];
 linkingToProjectId?: string | null;
 linkingToProjectName?: string | null;
 enabledFrameworks?: Framework[];
 handlers: {
 updating: boolean;
 handleStatusChange: (c: Control, s: Control['status']) => Promise<void>;
 handleAssign: (c: Control, uid: string) => Promise<void>;
 handleLinkAsset: (c: Control, aid: string) => Promise<void>;
 handleUnlinkAsset: (c: Control, aid: string) => Promise<void>;
 handleLinkSupplier: (c: Control, sid: string) => Promise<void>;
 handleUnlinkSupplier: (c: Control, sid: string) => Promise<void>;
 handleLinkProject: (c: Control, pid: string) => Promise<void>;
 handleUnlinkProject: (c: Control, pid: string) => Promise<void>;
 handleLinkDocument: (c: Control, did: string) => Promise<void>;
 handleUnlinkDocument: (c: Control, did: string) => Promise<void>;
 updateJustification: (c: Control, text: string) => Promise<void>;
 onUploadEvidence: (c: Control) => void;
 handleMapFramework?: (c: Control, f: Framework) => Promise<void>;
 handleUnmapFramework?: (c: Control, f: Framework) => Promise<void>;
 onValidateEvidence?: (did: string, action: 'approuver' | 'rejeter') => Promise<boolean>;
 };
 onDirtyChange?: (isDirty: boolean) => void;
}

export const ComplianceInspector: React.FC<ComplianceInspectorProps> = ({
 control,
 canEdit,
 usersList,
 assets,
 suppliers,
 documents,
 risks,
 projects,
 findings,
 linkingToProjectId,
 linkingToProjectName,
 enabledFrameworks,
 handlers,
 onDirtyChange
}) => {
 const { t } = useLocale();
 type InspectorTabId = 'details' | 'evidence' | 'comments' | 'history' | 'linkedItems';
 const [activeTab, setActiveTab] = useState<InspectorTabId>('details');

 const { updating, handleLinkProject } = handlers;

 const isLinkedItemsLoading = handlers.updating;

 return (
 <div className="h-full flex flex-col bg-muted/50">
 {/* Breadcrumb Context */}
 <div className="px-4 sm:px-6 py-2 text-xs text-muted-foreground flex items-center gap-1 border-b border-border/40 dark:border-white/5 bg-white/30 dark:bg-white/5">
 <span>{control.framework || 'ISO27001'}</span>
 <ChevronRight className="h-3 w-3" />
 <span className="font-medium text-foreground">{control.code}</span>
 <ChevronRight className="h-3 w-3" />
 <span className="truncate max-w-[200px]">{control.name}</span>
 </div>

 {/* Tabs Header */}
 <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10 border-b border-border/40 dark:border-white/5">
 {linkingToProjectId && canEdit && (
  <div className="bg-primary/10 px-6 py-3 border-b border-primary/20 dark:border-primary/90 flex items-center justify-between animate-fade-in">
  <div className="flex items-center text-sm text-primary dark:text-primary/50">
  <Link className="h-4 w-4 mr-2" />
  <span className="font-medium">{t('compliance.linkControlToProject', { defaultValue: 'Lier ce contrôle au projet' })} <strong>{linkingToProjectName}</strong> ?</span>
  </div>
  <Button
  aria-label={t('compliance.linkControlToProjectAria', { defaultValue: 'Lier le contrôle au projet', project: linkingToProjectName })}
  onClick={() => handleLinkProject(control, linkingToProjectId)}
  disabled={updating || (Array.isArray(control.relatedProjectIds) ? control.relatedProjectIds : []).includes(linkingToProjectId)}
  size="sm"
  className="text-xs font-bold shadow-sm"
  >
  {updating ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Link className="h-3 w-3 mr-1.5" />}
  {(Array.isArray(control.relatedProjectIds) ? control.relatedProjectIds : []).includes(linkingToProjectId) ? t('compliance.alreadyLinked', { defaultValue: 'Déjà lié' }) : t('compliance.linkNow', { defaultValue: 'Lier maintenant' })}
  </Button>
  </div>
 )}

 <ScrollableTabs
  tabs={[
  { id: 'details', label: t('compliance.tabs.details', { defaultValue: 'Détails' }), icon: FileText },
  { id: 'evidence', label: `${t('compliance.tabs.evidence', { defaultValue: 'Preuves' })} (${control.evidenceIds?.length || 0})`, icon: Paperclip },
  { id: 'linkedItems', label: t('compliance.tabs.linkedItems', { defaultValue: 'Éléments Liés' }), icon: Link },
  { id: 'comments', label: t('compliance.tabs.discussion', { defaultValue: 'Discussion' }), icon: MessageSquare },
  { id: 'history', label: t('compliance.tabs.history', { defaultValue: 'Historique' }), icon: FileText },
  ]}
  activeTab={activeTab}
  onTabChange={(id) => setActiveTab(id as InspectorTabId)}
 />
 </div>

 <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
 {activeTab === 'details' && (
  <ComplianceDetails
  control={control}
  canEdit={canEdit}
  usersList={usersList}
  enabledFrameworks={enabledFrameworks}
  handlers={handlers}
  onDirtyChange={onDirtyChange}
  />
 )}

 {activeTab === 'evidence' && (
  <>
  <ComplianceEvidence
  control={control}
  canEdit={canEdit}
  documents={documents}
  handlers={handlers}
  />
  <div className="mt-6">
  <AgentEvidencePanel
  controlId={control.id}
  controlCode={control.code}
  controlName={control.name}
  />
  </div>
  </>
 )}

 {activeTab === 'linkedItems' && (
  isLinkedItemsLoading ? (
  <div className="space-y-4 max-w-3xl mx-auto">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <Skeleton className="h-48 rounded-3xl" />
  <Skeleton className="h-48 rounded-3xl" />
  </div>
  <Skeleton className="h-32 rounded-3xl" />
  </div>
  ) : (
  <ComplianceLinkedItems
  control={control}
  canEdit={canEdit}
  assets={assets}
  suppliers={suppliers}
  projects={projects}
  risks={risks}
  findings={findings}
  handlers={handlers}
  />
  )
 )}

 {activeTab === 'comments' && (
  <div className="max-w-3xl mx-auto">
  <DiscussionPanel
  collectionName="controls"
  documentId={control.id}
  title={`${t('compliance.discussion', { defaultValue: 'Discussion' })} - ${control.code} ${control.name}`}
  enableSearch={true}
  enableFilters={true}
  enableExport={true}
  enableNotifications={true}
  />
  </div>
 )}

 {activeTab === 'history' && (
  <div className="max-w-3xl mx-auto">
  <TimelineView resourceId={control.id} resourceType="Control" />
  </div>
 )}
 </div>
 </div>
 );
};

