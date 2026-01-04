import React, { useState } from 'react';
import {
    ShieldAlert, CheckCircle2, LayoutDashboard, FolderKanban,
    History, MessageSquare, Network, Copy, Edit, Trash2,
    Server, Plus, CalendarDays, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { SafeHTML } from '../ui/SafeHTML';
import { RiskAIAssistant } from './RiskAIAssistant';
import { RiskForm } from './RiskForm';
import { RiskDashboard } from './RiskDashboard';
import { RelationshipGraph } from '../RelationshipGraph';
// import { CustomSelect } from '../ui/CustomSelect';
import { CommentSection } from '../collaboration/CommentSection';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';
import { TimelineView } from '../shared/TimelineView';
import { Risk, Asset, Control, Project, Audit, Supplier, MitreTechnique, UserProfile, BusinessProcess } from '../../types';
import { integrationService } from '../../services/integrationService';
// import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ConfirmModal } from '../ui/ConfirmModal';
// Form validation: useForm with required fields

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

    // Internal State
    const [inspectorTab, setInspectorTab] = useState<'details' | 'treatment' | 'dashboard' | 'projects' | 'audits' | 'history' | 'comments' | 'graph' | 'threats'>('details');
    const [isEditing, setIsEditing] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [mitreQuery, setMitreQuery] = useState('');
    const [mitreResults, setMitreResults] = useState<MitreTechnique[]>([]);
    const [confirmClose, setConfirmClose] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<Risk['status'] | null>(null);

    // Reset state when risk changes
    const handleClose = React.useCallback(() => {
        setInspectorTab('details');
        setIsEditing(false);
        setMitreQuery('');
        setMitreResults([]);
        setConfirmClose(false);
        setPendingStatus(null);
        onClose();
    }, [onClose]);

    const getAssetName = React.useCallback((id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu', [assets]);

    const getOwnerName = React.useCallback((ownerId?: string) => {
        if (!ownerId) return 'Non assigné';
        // If ownerId looks like a UID (long string), try to find user
        const user = usersList.find(u => u.uid === ownerId);
        return user ? (user.displayName || user.email) : ownerId;
    }, [usersList]);

    const handleLocalUpdate = React.useCallback(async (updates: Partial<Risk>) => {
        if (!risk) return;
        setUpdating(true);
        const success = await onUpdate(risk.id, updates);
        setUpdating(false);
        if (success && isEditing) setIsEditing(false);
    }, [risk, onUpdate, isEditing]);

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

    const handleTabChange = React.useCallback((id: string) => setInspectorTab(id as typeof inspectorTab), []);
    const handleDuplicate = React.useCallback(() => risk && onDuplicate(risk), [onDuplicate, risk]);
    const handleEditStart = React.useCallback(() => setIsEditing(true), []);
    const handleEditCancel = React.useCallback(() => setIsEditing(false), []);
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
            width={isEditing ? "max-w-4xl" : "max-w-6xl"}
            statusBadge={
                <Badge status={risk.status === 'Fermé' ? 'success' : risk.status === 'En cours' ? 'warning' : risk.status === 'En attente de validation' ? 'info' : 'error'}>
                    {risk.status}
                </Badge>
            }
            tabs={isEditing ? [] : tabs}
            activeTab={inspectorTab}
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
                    {inspectorTab === 'details' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/20 pointer-events-none" />
                                    <div className="relative z-10">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4 flex items-center gap-2">
                                            <ShieldAlert className="h-4 w-4" /> Risque Brut
                                        </h4>
                                        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                                            {Number(risk.score) || (Number(risk.probability) * Number(risk.impact)) || 0}
                                        </div>
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Prob: {risk.probability || 0} × Impact: {risk.impact || 0}</div>
                                    </div>
                                </div>
                                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/20 pointer-events-none" />
                                    <div className="relative z-10">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" /> Risque Résiduel
                                        </h4>
                                        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                                            {Number(risk.residualScore) || ((Number(risk.residualProbability) || Number(risk.probability)) * (Number(risk.residualImpact) || Number(risk.impact))) || 0}
                                        </div>
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Prob: {risk.residualProbability || risk.probability || 0} × Impact: {risk.residualImpact || risk.impact || 0}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Identification du Risque</h4>
                                <div>
                                    <span className="text-[10px] uppercase text-slate-400 font-bold">Menace</span>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{risk.threat}</p>
                                </div>
                                {risk.scenario && (
                                    <div>
                                        <span className="text-[10px] uppercase text-slate-400 font-bold">Scénario</span>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">{risk.scenario}</p>
                                    </div>
                                )}
                                {risk.vulnerability && (
                                    <div>
                                        <span className="text-[10px] uppercase text-slate-400 font-bold">Vulnérabilité Exploitée</span>
                                        <SafeHTML content={risk.vulnerability} className="text-sm text-slate-600 dark:text-slate-300" />
                                    </div>
                                )}
                            </div>

                            <RiskAIAssistant
                                risk={risk}
                                onUpdate={handleAIAssistantUpdate}
                            />

                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Stratégie de Traitement</h4>
                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{risk.strategy}</div>
                            </div>
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Propriétaire</h4>
                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{getOwnerName(risk.owner)}</div>
                            </div>
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Statut Actuel</h4>
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                    {canEdit ? (
                                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                            {['Ouvert', 'En cours', 'Fermé', 'En attente de validation'].map(s => (
                                                <button
                                                    aria-label={`Changer le statut à ${s}`}
                                                    key={s}
                                                    onClick={() => handleStatusChangeRequest(s as Risk['status'])}
                                                    disabled={updating}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex-1 sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${risk.status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md' : 'bg-transparent border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-gray-50'} ${updating ? 'opacity-50 cursor-wait' : ''}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    ) : <Badge status={risk.status === 'Ouvert' ? 'error' : risk.status === 'En cours' ? 'warning' : risk.status === 'Fermé' ? 'success' : 'info'} variant="soft">{risk.status}</Badge>}
                                    {canEdit && risk.status === 'En attente de validation' && (
                                        <div className="flex gap-2">
                                            <button
                                                aria-label="Rejeter la demande"
                                                onClick={() => handleStatusChange('Ouvert')} // Reject -> Back to Open
                                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            >
                                                Rejeter
                                            </button>
                                            <button
                                                aria-label="Approuver le risque"
                                                onClick={() => handleStatusChange('En cours')} // Approve -> In Progress
                                                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            >
                                                Approuver
                                            </button>
                                        </div>
                                    )}
                                    {canEdit && (
                                        <button
                                            aria-label="Valider la revue du risque"
                                            onClick={handleReview}
                                            disabled={updating}
                                            className={`flex items-center justify-center px-4 py-2 text-xs font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${updating ? 'opacity-70 cursor-wait' : ''}`}
                                        >
                                            {updating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5 mr-2" />}
                                            Valider la revue
                                        </button>
                                    )}
                                </div>
                                {risk.lastReviewDate && (<p className="text-xs text-slate-500 mt-3 text-right">Dernière revue le : {new Date(risk.lastReviewDate).toLocaleDateString()}</p>)}
                            </div>
                        </div>
                    )}

                    {inspectorTab === 'treatment' && (
                        <RiskTreatmentPlan
                            risk={risk}
                            onUpdate={handleTreatmentUpdate}
                            users={usersList}
                        />
                    )}

                    {inspectorTab === 'dashboard' && <RiskDashboard risks={[risk]} />}

                    {inspectorTab === 'projects' && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets de Traitement ({linkedProjects.length})</h3>
                                {canEdit && (
                                    <button
                                        aria-label="Créer un nouveau projet lié"
                                        onClick={handleNavigateToProject}
                                        className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouveau Projet
                                    </button>
                                )}
                            </div>
                            <div className="grid gap-4">
                                {linkedProjects.length === 0 ? <p className="text-sm text-slate-500 italic">Aucun projet.</p> : linkedProjects.map(p => (
                                    <div key={p.id} className="glass-panel p-4">{p.name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {inspectorTab === 'audits' && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center"><CheckCircle2 className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                                {canEdit && (
                                    <button
                                        aria-label="Créer un nouvel audit lié"
                                        onClick={handleNavigateToAudit}
                                        className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouvel Audit
                                    </button>
                                )}
                            </div>
                            <div className="grid gap-4">
                                {linkedAudits.length === 0 ? <p className="text-sm text-slate-500 italic">Aucun audit.</p> : linkedAudits.map(a => (
                                    <div key={a.id} className="glass-panel p-4">{a.name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {inspectorTab === 'history' && (
                        <div className="space-y-6">
                            <TimelineView resourceId={risk.id} resourceType="Risk" />
                        </div>
                    )}

                    {inspectorTab === 'comments' && <div className="h-[400px]"><CommentSection collectionName="risks" documentId={risk.id} /></div>}

                    {inspectorTab === 'graph' && <div className="h-[500px]"><RelationshipGraph rootId={risk.id} rootType="Risk" /></div>}

                    {inspectorTab === 'threats' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold">MITRE ATT&CK</h3>
                                <div className="flex gap-2">
                                    <input value={mitreQuery} onChange={handleMitreQueryChange}
                                        className="flex-1 px-4 py-2 border rounded-xl"
                                        placeholder="Rechercher une technique..."
                                        aria-label="Rechercher une technique MITRE ATT&CK"
                                    />
                                    <button
                                        aria-label="Rechercher"
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                        onClick={handleMitreSearch}
                                    >
                                        Chercher
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {mitreResults.map(t => (
                                        <div key={t.id} className="flex justify-between p-2 border rounded-lg">
                                            <span>{t.name}</span>
                                            <button aria-label="Ajouter la technique" onClick={() => handleMitreAdd(t)}>Ajouter</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
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
