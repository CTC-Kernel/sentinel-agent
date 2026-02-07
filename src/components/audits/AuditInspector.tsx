import React, { useState, useEffect } from 'react';
import { Audit, Control, Document as GRCDocument, Asset, Risk, Project, UserProfile } from '../../types';
import { useAuditDetails } from '../../hooks/audits/useAuditDetails';
import { InspectorLayout } from '../ui/InspectorLayout';
import { AlertOctagon, ClipboardCheck, FileText, Target, Trash2, CheckCheck, Loader2, History, ShieldCheck, Download, Link, Play, CheckCircle2 } from '../ui/Icons';
import { ResourceHistory } from '../shared/ResourceHistory';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { SingleAuditStats } from './SingleAuditStats';
import { useStore } from '../../store';
import { canDeleteResource } from '../../utils/permissions';
import { AuditForm } from './AuditForm';
import { ShareAuditDrawer } from './ShareAuditDrawer';
import { AssignPartnerDrawer } from './AssignPartnerDrawer';
import { toast } from '@/lib/toast';

// Sub-components
import { AuditFindings } from './inspector/AuditFindings';
import { AuditChecklist } from './inspector/AuditChecklist';
import { AuditCertification } from './inspector/AuditCertification';
import { AuditLinkedItems } from './inspector/AuditLinkedItems';

interface AuditInspectorProps {
 audit: Audit;
 onClose: () => void;
 controls: Control[];
 documents: GRCDocument[];
 assets: Asset[];
 risks: Risk[];
 projects: Project[];
 usersList: UserProfile[];
 refreshAudits: () => void;
 canEdit: boolean;
 onDelete: (id: string, name: string) => void;
}

export const AuditInspector: React.FC<AuditInspectorProps> = ({
 audit, onClose, controls, documents, assets, risks, projects, usersList,
 refreshAudits, canEdit, onDelete
}) => {
 const { user, t } = useStore();
 const {
 findings, checklist, fetchDetails,
 handleAddFinding, handleDeleteFinding,
 generateChecklist, handleChecklistAnswer,
 validateAudit, changeAuditStatus, generateAuditReport, handleExportPack,
 handleEvidenceUploadForFinding, updateAuditDetails,
 isGeneratingReport, isValidating
 } = useAuditDetails(audit, controls, documents, refreshAudits);

 const [activeTab, setActiveTab] = useState('details');
 const [isShareModalOpen, setIsShareModalOpen] = useState(false);
 const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
 const [isFormDirty, setIsFormDirty] = useState(false);

 useEffect(() => {
 fetchDetails();
 }, [fetchDetails]);

 const tabs = [
 { id: 'details', label: t('audits.tabs.details'), icon: FileText },
 { id: 'findings', label: t('audits.tabs.findings'), icon: AlertOctagon },
 { id: 'checklist', label: t('audits.tabs.checklist'), icon: ClipboardCheck },
 { id: 'linked', label: t('audits.tabs.linked'), icon: Link },
 { id: 'dashboard', label: t('audits.tabs.dashboard'), icon: Target },
 { id: 'certification', label: 'Certification / Externe', icon: ShieldCheck },
 { id: 'history', label: t('audits.tabs.history'), icon: History },
 ];

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <InspectorLayout
 isOpen={true}
 onClose={onClose}
 title={audit.name}
 subtitle={`${audit.type} • ${audit.status}`}
 width="max-w-6xl"
 actions={
 <div className="flex items-center gap-2">
  {canDeleteResource(user, 'Audit') && (
  <CustomTooltip content={t('audits.inspector.deleteConfirm')}>
  <button type="button" onClick={() => onDelete(audit.id, audit.name)} aria-label={t('audits.inspector.deleteConfirm')} className="p-2 text-muted-foreground hover:text-red-600 dark:hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  <Trash2 className="h-5 w-5" />
  </button>
  </CustomTooltip>
  )}
  <div className="h-6 w-px bg-muted dark:bg-white/10 mx-2" />

  {audit.status === 'Planifié' && canEdit && (
  <button
  type="button"
  onClick={() => changeAuditStatus('En cours')}
  disabled={isValidating}
  aria-label="Démarrer l'audit"
  className={`px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl font-bold text-sm transition-colors shadow-lg shadow-primary/20 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isValidating ? 'opacity-75 cursor-wait' : ''}`}
  >
  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
  <span className="hidden sm:inline">{t('audits.inspector.start', { defaultValue: 'Démarrer' })}</span>
  </button>
  )}

  {audit.status === 'En cours' && canEdit && (
  <button
  type="button"
  onClick={() => changeAuditStatus('Terminé')}
  disabled={isValidating}
  aria-label="Terminer l'audit"
  className={`px-4 py-2 bg-success hover:bg-success/90 text-success-foreground rounded-3xl font-bold text-sm transition-colors shadow-lg shadow-success/20 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isValidating ? 'opacity-75 cursor-wait' : ''}`}
  >
  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
  <span className="hidden sm:inline">{t('audits.inspector.finish', { defaultValue: 'Terminer' })}</span>
  </button>
  )}

  {audit.status === 'Terminé' && canEdit && (
  <button
  type="button"
  onClick={validateAudit}
  disabled={isValidating}
  aria-label={t('audits.inspector.validate')}
  className={`px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl font-bold text-sm transition-colors shadow-lg shadow-primary/20 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isValidating ? 'opacity-75 cursor-wait' : ''}`}
  >
  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
  <span className="hidden sm:inline">{t('audits.inspector.validate')}</span>
  </button>
  )}

  <CustomTooltip content={isGeneratingReport ? t('audits.inspector.generatingReport', { defaultValue: 'Génération en cours...' }) : t('audits.inspector.generateReport')}>
  <button type="button" onClick={() => generateAuditReport([])} disabled={isGeneratingReport} aria-label={isGeneratingReport ? t('audits.inspector.generatingReport', { defaultValue: 'Génération en cours...' }) : t('audits.inspector.generateReport', { defaultValue: 'Générer le rapport' })} className="p-2.5 hover:bg-muted rounded-3xl transition-colors text-muted-foreground hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  {isGeneratingReport ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
  </button>
  </CustomTooltip>
  <CustomTooltip content={t('audits.inspector.exportPack')}>
  <button type="button" onClick={handleExportPack} aria-label={t('audits.inspector.exportPack')} className="p-2.5 hover:bg-muted rounded-3xl transition-colors text-muted-foreground hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  <Download className="h-5 w-5" />
  </button>
  </CustomTooltip>
 </div>
 }
 tabs={tabs}
 activeTab={activeTab}
 onTabChange={setActiveTab}
 hasUnsavedChanges={isFormDirty}
 >
 {activeTab === 'details' && (
 <div className="p-6">
  <AuditForm
  existingAudit={audit}
  onSubmit={async (data) => {
  await updateAuditDetails(data);
  setIsFormDirty(false);
  }}
  onCancel={onClose}
  assets={assets}
  risks={risks}
  controls={controls}
  projects={projects}
  usersList={usersList}
  readOnly={!canEdit}
  onDirtyChange={setIsFormDirty}
  />
 </div>
 )}
 <div className="space-y-6 max-w-7xl mx-auto">
 {activeTab === 'findings' && (
  <AuditFindings
  audit={audit}
  controls={controls}
  findings={findings}
  canEdit={canEdit}
  onAddFinding={handleAddFinding}
  onDeleteFinding={handleDeleteFinding}
  onUploadEvidence={handleEvidenceUploadForFinding}
  />
 )}

 {activeTab === 'checklist' && (
  <AuditChecklist
  checklist={checklist}
  canEdit={canEdit}
  onGenerate={generateChecklist}
  onAnswer={handleChecklistAnswer}
  />
 )}

 {activeTab === 'linked' && (
  <AuditLinkedItems
  audit={audit}
  controls={controls}
  risks={risks}
  assets={assets}
  projects={projects}
  />
 )}

 {activeTab === 'dashboard' && (
  <SingleAuditStats audit={audit} findings={findings} />
 )}

 {activeTab === 'certification' && (
  <AuditCertification
  canEdit={canEdit}
  onOpenShareModal={() => setIsShareModalOpen(true)}
  onOpenAssignModal={() => setIsAssignModalOpen(true)}
  />
 )}

 {activeTab === 'history' && (
  <ResourceHistory resourceId={audit.id} resourceType="Audit" />
 )}
 </div>

 <ShareAuditDrawer
 isOpen={isShareModalOpen}
 onClose={() => setIsShareModalOpen(false)}
 auditId={audit.id}
 auditName={audit.name}
 />

 <AssignPartnerDrawer
 isOpen={isAssignModalOpen}
 onClose={() => setIsAssignModalOpen(false)}
 auditId={audit.id}
 auditName={audit.name}
 onAssigned={() => {
  toast.success(t('audits.inspector.partnerAssigned', { defaultValue: 'Partenaire assigné avec succès' }));
 }}
 />
 </InspectorLayout>
 );
};
