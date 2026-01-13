import React, { useState } from 'react';
import {
    ShieldAlert, CheckCircle2, LayoutDashboard, FolderKanban,
    History, MessageSquare, Network, Copy, Edit, Trash2,
    Server
} from 'lucide-react';
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
import { Risk, Asset, Control, Project, Audit, Supplier, MitreTechnique, UserProfile, BusinessProcess } from '../../types';
import { integrationService } from '../../services/integrationService';
import { toast } from '@/lib/toast';
import { Button } from '../ui/button';
import { ConfirmModal } from '../ui/ConfirmModal';

import { useInspector } from '../../hooks/useInspector';

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
        // Define tabs configuration
        tabs: [
            { id: 'details', label: 'Détails', icon: ShieldAlert },
            { id: 'treatment', label: 'Traitement', icon: CheckCircle2 },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'projects', label: 'Projets', icon: FolderKanban },
            { id: 'audits', label: 'Audits', icon: CheckCircle2 },
            { id: 'history', label: 'Historique', icon: History },
            { id: 'comments', label: 'Discussion', icon: MessageSquare },
            { id: 'graph', label: 'Graphe', icon: Network },
            { id: 'threats', label: 'Menaces', icon: ShieldAlert }
        ],
        moduleName: 'Risk',
        actions: {
            onUpdate: async (id, data) => {
                // Bridge between hook's expect (boolean|string) and prop's (boolean)
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

    // Reset state when risk changes
    const handleClose = React.useCallback(() => {
        setMitreQuery('');
        setMitreResults([]);
        setConfirmClose(false);
        setPendingStatus(null);
        if (isEditing) exitEditMode();
        // Reset tab if needed or let logic persist
        setActiveTab('details');
        onClose();
        // Note: useInspector hook does not auto-reset on Close when controlled externally, 
        // so we manually reset tab/edit mode here.
    }, [onClose, isEditing, exitEditMode, setActiveTab]);

    const getAssetName = React.useCallback((id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu', [assets]);

    const getOwnerName = React.useCallback((ownerId?: string) => {
        if (!ownerId) return 'Non assigné';
        // If ownerId looks like a UID (long string), try to find user
        const user = usersList.find(u => u.uid === ownerId);
        return user ? (user.displayName || user.email) : ownerId;
    }, [usersList]);

    const handleLocalUpdate = React.useCallback(async (updates: Partial<Risk>) => {
        if (!risk) return;
        // setUpdating is handled by hook (mapped to saving)
        await handleHookUpdate(updates);
        if (isEditing) exitEditMode();
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

        toast.success(`Statut mis à jour : ${newStatus}`);
    }, [canEdit, risk, handleLocalUpdate]);

    const handleReview = React.useCallback(async () => {
        if (!canEdit) return;

        await handleLocalUpdate({ lastReviewDate: new Date().toISOString() });
        toast.success("Revue validée pour aujourd'hui");
    }, [canEdit, handleLocalUpdate]);

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
    const handleTreatmentUpdate = React.useCallback((treatment: Partial<Risk['treatment']>) => handleLocalUpdate({ treatment }), [handleLocalUpdate]);

    const handleNavigateToProject = React.useCallback(() => risk && navigate('/projects', { state: { createForRisk: risk.id, riskName: risk.threat } }), [navigate, risk]);
    const handleNavigateToAudit = React.useCallback(() => risk && navigate('/audits', { state: { createForRisk: risk.id, riskName: risk.threat } }), [navigate, risk]);

    const handleMitreSearch = React.useCallback(() => integrationService.getCommonMitreTechniques(mitreQuery, demoMode).then(setMitreResults), [mitreQuery, demoMode]);
    const handleMitreAdd = React.useCallback((t: MitreTechnique) => {
        const current = risk?.mitreTechniques || [];
        handleLocalUpdate({ mitreTechniques: [...current, t] });
    }, [risk?.mitreTechniques, handleLocalUpdate]);
    const handleMitreQueryChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setMitreQuery(e.target.value), []);

    const tabs = React.useMemo(() => [
        { id: 'details', label: 'Détails', icon: ShieldAlert },
        { id: 'treatment', label: 'Traitement', icon: CheckCircle2 },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: 'Projets', icon: FolderKanban },
        { id: 'audits', label: 'Audits', icon: CheckCircle2 },
        { id: 'history', label: 'Historique', icon: History },
        { id: 'comments', label: 'Discussion', icon: MessageSquare },
        { id: 'graph', label: 'Graphe', icon: Network },
        { id: 'threats', label: 'Menaces', icon: ShieldAlert }
    ], []);

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
            actions={
                !isEditing && canEdit ? (
                    <div className="flex gap-2">
                        <CustomTooltip content="Dupliquer">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleDuplicate}
                                aria-label="Dupliquer le risque"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </CustomTooltip>
                        <CustomTooltip content="Modifier">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleEditStart}
                                aria-label="Modifier le risque"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        </CustomTooltip>
                        <CustomTooltip content="Supprimer">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDeleteRisk}
                                className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                aria-label="Supprimer le risque"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CustomTooltip>
                    </div>
                ) : null
            }
            disableContentPadding={isEditing}
            disableContentScroll={isEditing}
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
                />
            ) : (
                <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 dark:bg-transparent min-h-full">
                    {activeTab === 'details' && (
                        <div className="space-y-8">
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
                                title={`Discussion - ${risk.threat}`}
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
                title="Clôturer le risque ?"
                message="Êtes-vous sûr de vouloir considérer ce risque comme traité (Fermé) ? Assurez-vous que tous les contrôles nécessaires sont en place."
                confirmText="Oui, fermer le risque"
                cancelText="Annuler"
                type="info"
            />
        </InspectorLayout >
    );
};
