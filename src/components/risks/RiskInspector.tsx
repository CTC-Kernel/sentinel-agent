import React, { useState } from 'react';
import {
 ShieldAlert, CheckCircle2, LayoutDashboard, FolderKanban,
 History, MessageSquare, Network, Copy, Edit, Trash2,
 Server
} from '../ui/Icons';
import { useNavigate } from 'react-router-dom';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { RiskForm } from './RiskForm';
import { RiskDashboard } from './RiskDashboard';
import { RelationshipGraph } from '../RelationshipGraph';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';
import { TimelineView } from '../shared/TimelineView';
import { Risk, RiskTreatment, Asset, Control, Project, Audit, Supplier, MitreTechnique, UserProfile, BusinessProcess } from '../../types';
import { integrationService } from '../../services/integrationService';
import { toast } from '@/lib/toast';
import { Button } from '../ui/button';
import { ConfirmModal } from '../ui/ConfirmModal';

import { useInspector } from '../../hooks/useInspector';
import { useLocale } from '@/hooks/useLocale';

// Sub-components
import { RiskGeneralDetails } from './inspector/RiskGeneralDetails';
import { RiskLinkedControls } from './inspector/RiskLinkedControls';
import { RiskLinkedProjects } from './inspector/RiskLinkedProjects';
import { RiskLinkedAudits } from './inspector/RiskLinkedAudits';
import { RiskMitreThreats } from './inspector/RiskMitreThreats';

interface RiskInspectorProps {
 isOpen: boolean;
 onClose: () => void;
 risk: Risk | null;
 assets: Asset[];
 controls: Control[];
 projects: Project[];
 audits: Audit[];
 suppliers: Supplier[];
 usersList: UserProfile[];
 processes: BusinessProcess[];
 canEdit: boolean;
 demoMode: boolean;
 onUpdate: (id: string, data: Partial<Risk>) => Promise<boolean>;
 onDelete: (id: string, name: string) => void;
 onDuplicate: (risk: Risk) => void;
}

export const RiskInspector: React.FC<RiskInspectorProps> = ({
 isOpen, onClose, risk, assets, controls, projects, audits, suppliers, usersList, processes,
 canEdit, demoMode, onUpdate, onDelete, onDuplicate
}) => {
 const navigate = useNavigate();
 const { t } = useLocale();

 // Memoize tabs configuration early for use in hook
 const tabs = React.useMemo(() => [
 { id: 'details', label: t('common.details', { defaultValue: 'Détails' }), icon: ShieldAlert },
 { id: 'treatment', label: t('risks.tabs.treatment', { defaultValue: 'Traitement' }), icon: CheckCircle2 },
 { id: 'dashboard', label: t('common.overview', { defaultValue: 'Dashboard' }), icon: LayoutDashboard },
 { id: 'projects', label: t('common.projects', { defaultValue: 'Projets' }), icon: FolderKanban },
 { id: 'audits', label: t('common.audits', { defaultValue: 'Audits' }), icon: CheckCircle2 },
 { id: 'history', label: t('common.history', { defaultValue: 'Historique' }), icon: History },
 { id: 'comments', label: t('compliance.discussion', { defaultValue: 'Discussion' }), icon: MessageSquare },
 { id: 'graph', label: t('compliance.tabs.graph', { defaultValue: 'Graphe' }), icon: Network },
 { id: 'threats', label: t('risks.tabs.identification', { defaultValue: 'Menaces' }), icon: ShieldAlert }
 ], [t]);

 // Use standardized hook
 const {
 activeTab,
 setActiveTab,
 isEditing,
 enterEditMode,
 exitEditMode,
 saving: updating, // Map hook's saving to component's updating
 handleUpdate: handleHookUpdate
 } = useInspector({
 entity: risk,
 tabs,
 moduleName: 'Risk',
 actions: {
 onUpdate: async (id, data) => {
 const success = await onUpdate(id, data as Partial<Risk>);
 return success;
 },
 onDelete: async (id, name) => onDelete(id, name)
 },
 getEntityName: (r) => r.threat
 });

 // Internal State for specific UI logic not covered by hook
 const [mitreQuery, setMitreQuery] = useState('');
 const [mitreResults, setMitreResults] = useState<MitreTechnique[]>([]);
 const [confirmClose, setConfirmClose] = useState(false);
 const [pendingStatus, setPendingStatus] = useState<Risk['status'] | null>(null);
 const [isFormDirty, setIsFormDirty] = useState(false);

 // Reset state when risk changes
 const handleClose = React.useCallback(() => {
 setMitreQuery('');
 setMitreResults([]);
 setConfirmClose(false);
 setPendingStatus(null);
 if (isEditing) exitEditMode();
 setIsFormDirty(false);
 // Reset tab if needed or let logic persist
 setActiveTab('details');
 onClose();
 // Note: useInspector hook does not auto-reset on Close when controlled externally, 
 // so we manually reset tab/edit mode here.
 }, [onClose, isEditing, exitEditMode, setActiveTab]);

 const getAssetName = React.useCallback((id?: string) => assets.find(a => a.id === id)?.name || t('common.unknown', { defaultValue: 'Actif inconnu' }), [assets, t]);

 const getOwnerName = React.useCallback((ownerId?: string) => {
 if (!ownerId) return t('treatment.not_assigned', { defaultValue: 'Non assigné' });
 // If ownerId looks like a UID (long string), try to find user
 const user = usersList.find(u => u.uid === ownerId);
 return user ? (user.displayName || user.email) : ownerId;
 }, [usersList, t]);

 const handleLocalUpdate = React.useCallback(async (updates: Partial<Risk>) => {
 if (!risk) return;
 // setUpdating is handled by hook (mapped to saving)
 await handleHookUpdate(updates);
 if (isEditing) {
 exitEditMode();
 setIsFormDirty(false);
 }
 }, [risk, handleHookUpdate, isEditing, exitEditMode]);

 const handleStatusChangeRequest = (status: Risk['status']) => {
 if (status === 'Fermé') {
 setPendingStatus(status);
 setConfirmClose(true);
 } else {
 handleStatusChange(status);
 }
 };

 const handleConfirmStatusChange = async () => {
 if (pendingStatus) {
 await handleStatusChange(pendingStatus);
 setConfirmClose(false);
 setPendingStatus(null);
 }
 };

 const handleStatusChange = React.useCallback(async (newStatus: Risk['status']) => {
 if (!canEdit || !risk) return;

 const updates: Partial<Risk> = { status: newStatus };

 // If closing the risk, user might want to set completion date etc.
 // For simplicity, we just update status here as per original code logic
 await handleLocalUpdate(updates);

 toast.success(t('risks.toast.statusUpdated', { defaultValue: `Statut mis à jour : ${newStatus}`, status: newStatus }));
 }, [canEdit, risk, handleLocalUpdate, t]);

 const handleReview = React.useCallback(async () => {
 if (!canEdit) return;

 await handleLocalUpdate({ lastReviewDate: new Date().toISOString() });
 toast.success(t('risks.toast.reviewValidated', { defaultValue: "Revue validée pour aujourd'hui" }));
 }, [canEdit, handleLocalUpdate, t]);

 const linkedProjects = React.useMemo(() => !risk ? [] : projects.filter(p => p.relatedRiskIds?.includes(risk.id)), [projects, risk]);
 const linkedAudits = React.useMemo(() => !risk ? [] : audits.filter(a => a.relatedRiskIds?.includes(risk.id)), [audits, risk]);

 const handleTabChange = setActiveTab;
 const handleDuplicate = React.useCallback(() => risk && onDuplicate(risk), [onDuplicate, risk]);
 const handleEditStart = enterEditMode;
 const handleEditCancel = exitEditMode;
 const handleDeleteRisk = React.useCallback(() => risk && onDelete(risk.id, risk.threat), [onDelete, risk]);

 // Use imported RiskFormData or define it if import fails
 const handleRiskFormSubmit = React.useCallback((data: import('../../schemas/riskSchema').RiskFormData) => handleLocalUpdate(data as unknown as Partial<Risk>), [handleLocalUpdate]);

 const handleAIAssistantUpdate = React.useCallback((updates: Partial<Risk>) => risk && handleLocalUpdate({ ...risk, ...updates } as Risk), [handleLocalUpdate, risk]);
 const handleTreatmentUpdate = React.useCallback((treatment: RiskTreatment) => handleLocalUpdate({ treatment }), [handleLocalUpdate]);

 const handleNavigateToProject = React.useCallback(() => risk && navigate('/projects', { state: { createForRisk: risk.id, riskName: risk.threat } }), [navigate, risk]);
 const handleNavigateToAudit = React.useCallback(() => risk && navigate('/audits', { state: { createForRisk: risk.id, riskName: risk.threat } }), [navigate, risk]);

 const handleMitreSearch = React.useCallback(() => integrationService.getCommonMitreTechniques(mitreQuery, demoMode).then(setMitreResults), [mitreQuery, demoMode]);
 const handleMitreAdd = React.useCallback((t: MitreTechnique) => {
 const current = risk?.mitreTechniques || [];
 handleLocalUpdate({ mitreTechniques: [...current, t] });
 }, [risk?.mitreTechniques, handleLocalUpdate]);
 const handleMitreQueryChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setMitreQuery(e.target.value), []);


 if (!risk) return null;

 return (
 <InspectorLayout
 isOpen={isOpen}
 onClose={handleClose}
 title={risk.threat}
 subtitle={
 <div className="flex items-center gap-2">
  <Server className="h-3.5 w-3.5" /> {getAssetName(risk.assetId)}
 </div>
 }
 width="max-w-6xl"
 statusBadge={
 <Badge status={risk.status === 'Fermé' ? 'success' : risk.status === 'En cours' ? 'warning' : risk.status === 'En attente de validation' ? 'info' : 'error'}>
  {risk.status}
 </Badge>
 }
 tabs={isEditing ? [] : tabs}
 activeTab={activeTab}
 onTabChange={handleTabChange}
 hasUnsavedChanges={isFormDirty}
 actions={
 !isEditing && canEdit ? (
  <div className="flex gap-2">
  <CustomTooltip content={t('common.copy', { defaultValue: 'Dupliquer' })}>
  <Button
  variant="outline"
  size="icon"
  onClick={handleDuplicate}
  aria-label={t('common.copy', { defaultValue: 'Dupliquer le risque' })}
  >
  <Copy className="h-4 w-4" />
  </Button>
  </CustomTooltip>
  <CustomTooltip content={t('common.edit', { defaultValue: 'Modifier' })}>
  <Button
  variant="outline"
  size="icon"
  onClick={handleEditStart}
  aria-label={t('common.edit', { defaultValue: 'Modifier le risque' })}
  >
  <Edit className="h-4 w-4" />
  </Button>
  </CustomTooltip>
  <CustomTooltip content={t('common.delete', { defaultValue: 'Supprimer' })}>
  <Button
  variant="ghost"
  size="icon"
  onClick={handleDeleteRisk}
  className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"
  aria-label={t('common.delete', { defaultValue: 'Supprimer le risque' })}
  >
  <Trash2 className="h-4 w-4" />
  </Button>
  </CustomTooltip>
  </div>
 ) : null
 }
 disableContentPadding={isEditing}
 disableContentScroll={isEditing}
 tabsAriaLabel={t('risks.tabsAriaLabel', { defaultValue: 'Navigation des sections du risque' })}
 >
 {isEditing ? (
 <RiskForm
  onSubmit={handleRiskFormSubmit}
  onCancel={handleEditCancel}
  initialData={risk}
  existingRisk={risk}
  assets={assets}
  usersList={usersList}
  processes={processes}
  suppliers={suppliers}
  controls={controls}
  isEditing={true}
  isLoading={updating}
  onDirtyChange={setIsFormDirty}
 />
 ) : (
 <div className="p-4 md:p-8 space-y-8 bg-muted/50 dark:bg-transparent min-h-full">
  {activeTab === 'details' && (
  <div className="space-y-6 sm:space-y-8">
  <RiskGeneralDetails
  risk={risk}
  assetName={getAssetName(risk.assetId)}
  canEdit={canEdit}
  updating={updating}
  onStatusChangeRequest={handleStatusChangeRequest}
  onStatusChange={handleStatusChange}
  onReview={handleReview}
  onAIAssistantUpdate={handleAIAssistantUpdate}
  getOwnerName={getOwnerName}
  />
  {/* Linked Controls Summary */}
  <RiskLinkedControls
  risk={risk}
  controls={controls}
  />
  </div>
  )}

  {activeTab === 'treatment' && (
  <RiskTreatmentPlan
  risk={risk}
  onUpdate={handleTreatmentUpdate}
  users={usersList}
  controls={controls}
  onDirtyChange={setIsFormDirty}
  />
  )}

  {activeTab === 'dashboard' && <RiskDashboard risks={[risk]} />}

  {activeTab === 'projects' && (
  <RiskLinkedProjects
  linkedProjects={linkedProjects}
  canEdit={canEdit}
  onNavigateToProject={handleNavigateToProject}
  />
  )}

  {activeTab === 'audits' && (
  <RiskLinkedAudits
  linkedAudits={linkedAudits}
  canEdit={canEdit}
  onNavigateToAudit={handleNavigateToAudit}
  />
  )}

  {activeTab === 'history' && (
  <div className="space-y-6">
  <TimelineView resourceId={risk.id} resourceType="Risk" />
  </div>
  )}

  {activeTab === 'comments' && (
  <div className="h-full">
  <DiscussionPanel
  collectionName="risks"
  documentId={risk.id}
  title={`${t('compliance.discussion', { defaultValue: 'Discussion' })} - ${risk.threat}`}
  enableSearch={true}
  enableFilters={true}
  enableExport={true}
  enableNotifications={true}
  />
  </div>
  )}

  {activeTab === 'graph' && <div className="h-[500px]"><RelationshipGraph rootId={risk.id} rootType="Risk" /></div>}

  {activeTab === 'threats' && (
  <RiskMitreThreats
  risk={risk}
  mitreQuery={mitreQuery}
  mitreResults={mitreResults}
  onMitreQueryChange={handleMitreQueryChange}
  onMitreSearch={handleMitreSearch}
  onMitreAdd={handleMitreAdd}
  />
  )}
 </div>
 )}
 <ConfirmModal
 isOpen={confirmClose}
 onClose={() => setConfirmClose(false)}
 onConfirm={handleConfirmStatusChange}
 title={t('risks.closeRiskTitle', { defaultValue: 'Clôturer le risque ?' })}
 message={t('risks.closeRiskMessage', { defaultValue: 'Êtes-vous sûr de vouloir considérer ce risque comme traité (Fermé) ? Assurez-vous que tous les contrôles nécessaires sont en place.' })}
 confirmText={t('risks.closeRiskConfirm', { defaultValue: 'Oui, fermer le risque' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 type="info"
 />
 </InspectorLayout >
 );
};
