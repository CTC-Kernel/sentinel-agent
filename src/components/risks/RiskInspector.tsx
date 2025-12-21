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
import { RiskAIAssistant } from './RiskAIAssistant';
import { RiskForm } from './RiskForm';
import { RiskDashboard } from './RiskDashboard';
import { RelationshipGraph } from '../RelationshipGraph';
// import { CustomSelect } from '../ui/CustomSelect';
import { Comments } from '../ui/Comments';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';
import { AuditTrail } from '../common/AuditTrail';
import { Risk, Asset, Control, Project, Audit, Supplier, MitreTechnique, UserProfile, BusinessProcess } from '../../types';
import { integrationService } from '../../services/integrationService';
// import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

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

    // Reset state when risk changes
    const handleClose = () => {
        setInspectorTab('details');
        setIsEditing(false);
        setMitreQuery('');
        setMitreResults([]);
        onClose();
    };

    if (!risk) return null;

    const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu';

    const handleLocalUpdate = async (updates: Partial<Risk>) => {
        setUpdating(true);
        const success = await onUpdate(risk.id, updates);
        setUpdating(false);
        if (success && isEditing) setIsEditing(false);
    };

    const handleStatusChange = async (newStatus: Risk['status']) => {
        if (!canEdit || !risk) return;

        const updates: Partial<Risk> = { status: newStatus };

        // If closing the risk, user might want to set completion date etc.
        // For simplicity, we just update status here as per original code logic
        await handleLocalUpdate(updates);

        toast.success(`Statut mis à jour : ${newStatus}`);
    };

    //    const handleStrategyChange = async (newStrategy: Risk['strategy']) => {
    //        if (!canEdit || !risk) return;
    //        await handleLocalUpdate({ strategy: newStrategy });
    //        addToast(`Stratégie mise à jour : ${newStrategy}`, 'success');
    //    };

    const handleReview = async () => {
        if (!canEdit) return;

        await handleLocalUpdate({ lastReviewDate: new Date().toISOString() });
        toast.success("Revue validée pour aujourd'hui");
    };

    const linkedProjects = projects.filter(p => p.relatedRiskIds?.includes(risk.id));
    const linkedAudits = audits.filter(a => a.relatedRiskIds?.includes(risk.id));

    const tabs = [
        { id: 'details', label: 'Détails', icon: ShieldAlert },
        { id: 'treatment', label: 'Traitement', icon: CheckCircle2 },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: 'Projets', icon: FolderKanban },
        { id: 'audits', label: 'Audits', icon: CheckCircle2 },
        { id: 'history', label: 'Historique', icon: History },
        { id: 'comments', label: 'Discussion', icon: MessageSquare },
        { id: 'graph', label: 'Graphe', icon: Network },
        { id: 'threats', label: 'Menaces', icon: ShieldAlert }
    ];

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
            onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
            actions={
                !isEditing && canEdit ? (
                    <>
                        <CustomTooltip content="Dupliquer">
                            <button onClick={() => onDuplicate(risk)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm">
                                <Copy className="h-5 w-5" />
                            </button>
                        </CustomTooltip>
                        <CustomTooltip content="Modifier">
                            <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm">
                                <Edit className="h-5 w-5" />
                            </button>
                        </CustomTooltip>
                        <CustomTooltip content="Supprimer">
                            <button onClick={() => onDelete(risk.id, risk.threat)} className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm">
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </CustomTooltip>
                    </>
                ) : null
            }
        >
            {isEditing ? (
                <div className="p-6">
                    <RiskForm
                        onSubmit={(data) => handleLocalUpdate(data as Partial<Risk>)}
                        onCancel={() => setIsEditing(false)}
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
                </div>
            ) : (
                <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 dark:bg-transparent min-h-full">
                    {inspectorTab === 'details' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-6 bg-red-50/80 dark:bg-red-900/10 rounded-[2rem] border border-red-100 dark:border-red-900/30 shadow-sm">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4">Risque Brut</h4>
                                    <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">{risk.score}</div>
                                    <div className="text-xs font-medium text-slate-600">Prob: {risk.probability} × Impact: {risk.impact}</div>
                                </div>
                                <div className="p-6 bg-emerald-50/80 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4">Risque Résiduel</h4>
                                    <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">{risk.residualScore || risk.score}</div>
                                    <div className="text-xs font-medium text-slate-600">Prob: {risk.residualProbability || risk.probability} × Impact: {risk.residualImpact || risk.impact}</div>
                                </div>
                            </div>

                            <RiskAIAssistant
                                risk={risk}
                                onUpdate={(updates) => handleLocalUpdate({ ...risk, ...updates } as Risk)}
                            />

                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Stratégie de Traitement</h4>
                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{risk.strategy}</div>
                            </div>
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Propriétaire</h4>
                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{risk.owner || 'Non assigné'}</div>
                            </div>
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Statut Actuel</h4>
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                    {canEdit ? (
                                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                            {['Ouvert', 'En cours', 'Fermé', 'En attente de validation'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => handleStatusChange(s as Risk['status'])}
                                                    disabled={updating}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex-1 sm:flex-none ${risk.status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md' : 'bg-transparent border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-gray-50'} ${updating ? 'opacity-50 cursor-wait' : ''}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    ) : <Badge status={risk.status === 'Ouvert' ? 'error' : risk.status === 'En cours' ? 'warning' : risk.status === 'Fermé' ? 'success' : 'info'} variant="soft">{risk.status}</Badge>}
                                    {canEdit && risk.status === 'En attente de validation' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStatusChange('Ouvert')} // Reject -> Back to Open
                                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100"
                                            >
                                                Rejeter
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('En cours')} // Approve -> In Progress
                                                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100"
                                            >
                                                Approuver
                                            </button>
                                        </div>
                                    )}
                                    {canEdit && (
                                        <button
                                            onClick={handleReview}
                                            disabled={updating}
                                            className={`flex items-center justify-center px-4 py-2 text-xs font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors w-full sm:w-auto ${updating ? 'opacity-70 cursor-wait' : ''}`}
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
                            onUpdate={(treatment) => handleLocalUpdate({ treatment })}
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
                                        onClick={() => navigate('/projects', { state: { createForRisk: risk.id, riskName: risk.threat } })}
                                        className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm"
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
                                        onClick={() => navigate('/audits', { state: { createForRisk: risk.id, riskName: risk.threat } })}
                                        className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm"
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
                            <AuditTrail resourceId={risk.id} resourceType="Risk" />
                        </div>
                    )}

                    {inspectorTab === 'comments' && <div className="h-[400px]"><Comments collectionName="risks" documentId={risk.id} /></div>}

                    {inspectorTab === 'graph' && <div className="h-[500px]"><RelationshipGraph rootId={risk.id} rootType="Risk" /></div>}

                    {inspectorTab === 'threats' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold">MITRE ATT&CK</h3>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-4 py-2 border rounded-xl"
                                        placeholder="Rechercher une technique..."
                                        value={mitreQuery}
                                        onChange={e => setMitreQuery(e.target.value)}
                                    />
                                    <button
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl"
                                        onClick={() => integrationService.getCommonMitreTechniques(mitreQuery, demoMode).then(setMitreResults)}
                                    >
                                        Chercher
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {mitreResults.map(t => (
                                        <div key={t.id} className="flex justify-between p-2 border rounded-lg">
                                            <span>{t.name}</span>
                                            <button onClick={() => {
                                                const current = risk.mitreTechniques || [];
                                                handleLocalUpdate({ mitreTechniques: [...current, t] });
                                            }}>Ajouter</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </InspectorLayout>
    );
};
