import React, { useState } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Asset, UserProfile, Supplier, BusinessProcess } from '../../types';
import { AssetFormData } from '../../schemas/assetSchema';
import { AssetForm } from './AssetForm';
import { RelationshipGraph } from '../RelationshipGraph';
import { AssetAIAssistant } from './AssetAIAssistant';
import { CommentSection } from '../collaboration/CommentSection';
import { ResourceHistory } from '../shared/ResourceHistory';
import { AssetInspectorSecurity } from './inspector/AssetInspectorSecurity';
import { AssetInspectorLifecycle } from './inspector/AssetInspectorLifecycle';
import { useAssetDetails } from '../../hooks/assets/useAssetDetails';
import { useAssetSecurity } from '../../hooks/assets/useAssetSecurity';
import { useStore } from '../../store';
import { canDeleteResource } from '../../utils/permissions';
import { Trash2 } from '../ui/Icons';
import {
    HeartPulse, ShieldAlert,
    FolderKanban, CheckSquare, CalendarClock,
    AlertTriangle, FileText, ExternalLink, History, Plus, Server
} from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Shield, Network, BrainCircuit, MessageSquare } from 'lucide-react';
// Form validation: useForm with required fields

interface AssetInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset?: Asset | null;
    onUpdate: (id: string, data: AssetFormData) => Promise<boolean | string>;
    onCreate: (data: AssetFormData) => Promise<boolean | string>;
    users: UserProfile[];
    suppliers: Supplier[];
    processes: BusinessProcess[];
    canEdit: boolean;
    onDelete: (id: string, name: string) => void;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
    isOpen,
    onClose,
    selectedAsset,
    onUpdate,
    onCreate,
    users,
    suppliers,
    processes,
    canEdit,
    onDelete
}) => {
    const { user, t } = useStore();
    // Check permission - we need to see if we can delete THIS specific asset if RBAC requires ownership,
    // but usually canDeleteResource(user, 'Asset') checks the role.
    const canDelete = React.useMemo(() => {
        if (!user) return false;
        // Using the imported helper
        return canDeleteResource(user, 'Asset');
    }, [user]);

    const handleDelete = () => {
        if (selectedAsset && onDelete) {
            onDelete(selectedAsset.id, selectedAsset.name);
            // onClose should be triggered by the parent after delete, or we can close here?
            // Usually the parent handles the delete logic including closing/refreshing.
            // But we should probably close the inspector if the asset is deleted.
            // Rely on parent `onDelete` to handle UI updates.
        }
    };

    const navigate = useNavigate();
    const [inspectorTab, setInspectorTab] = useState<'details' | 'lifecycle' | 'security' | 'compliance' | 'projects' | 'audits' | 'documents' | 'history' | 'graph' | 'intelligence' | 'comments'>('details');
    const {
        maintenanceRecords,
        linkedRisks,
        linkedIncidents,
        linkedProjects,
        linkedAudits,
        linkedDocuments,
        linkedControls,
        addMaintenance
    } = useAssetDetails(selectedAsset || null);

    const {
        scanning,
        shodanResult,
        vulnerabilities,
        scanShodan,
        checkCVEs,
        createRiskFromVuln
    } = useAssetSecurity(selectedAsset || null);





    const tabs = [
        { id: 'details', label: 'Détails', icon: LayoutDashboard },
        ...(selectedAsset ? [
            { id: 'lifecycle', label: 'Cycle de Vie', icon: RefreshCw },
            { id: 'security', label: 'Sécurité', icon: ShieldAlert },
            { id: 'compliance', label: 'Conformité', icon: Shield },
            { id: 'projects', label: 'Projets', icon: FolderKanban },
            { id: 'audits', label: 'Audits', icon: CheckSquare },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'history', label: 'Historique', icon: History },
            { id: 'graph', label: 'Graphe', icon: Network },
            { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
            { id: 'comments', label: 'Discussion', icon: MessageSquare }
        ] : [])
    ];

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={selectedAsset ? selectedAsset.name : "Nouvel Actif"}
            subtitle={selectedAsset ? "Détails et configuration de l'actif" : "Ajouter un nouvel actif à l'inventaire"}
            icon={selectedAsset ? Server : Plus}
            statusBadge={selectedAsset ? (
                <div className="flex gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${selectedAsset.lifecycleStatus === 'En service' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'}`}>
                        {selectedAsset.lifecycleStatus || 'Neuf'}
                    </span>
                    {canDelete && selectedAsset && (
                        <CustomTooltip content={t('assets.deleteAssetTooltip')}>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                </div>
            ) : null}
            tabs={tabs}
            activeTab={inspectorTab}
            onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
        >

            <div className="space-y-8 max-w-7xl mx-auto">
                {inspectorTab === 'details' && (
                    <div className="space-y-8">
                        <AssetForm
                            initialData={selectedAsset || undefined}
                            onSubmit={async (data) => {
                                if (selectedAsset) {
                                    await onUpdate(selectedAsset.id, data);
                                } else {
                                    await onCreate(data);
                                    onClose();
                                }
                            }}
                            usersList={users}
                            suppliers={suppliers}
                            isEditing={!!selectedAsset}
                            onCancel={onClose}
                            readOnly={!canEdit}
                        />


                    </div>
                )}

                {inspectorTab === 'lifecycle' && selectedAsset && (
                    <AssetInspectorLifecycle
                        selectedAsset={selectedAsset}
                        maintenanceRecords={maintenanceRecords}
                        addMaintenance={addMaintenance}
                        canEdit={canEdit}
                    />
                )}

                {inspectorTab === 'security' && selectedAsset && (
                    <AssetInspectorSecurity
                        selectedAsset={selectedAsset}
                        scanning={scanning}
                        shodanResult={shodanResult}
                        vulnerabilities={vulnerabilities}
                        linkedRisks={linkedRisks}
                        linkedIncidents={linkedIncidents}
                        scanShodan={scanShodan}
                        checkCVEs={checkCVEs}
                        createRiskFromVuln={createRiskFromVuln}
                        navigate={navigate}
                    />
                )}

                {inspectorTab === 'compliance' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><Shield className="h-4 w-4 mr-2" /> Contrôles de Sécurité ({linkedControls.length})</h3>
                        {linkedControls.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun contrôle associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedControls.map(ctrl => (
                                    <div key={ctrl.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                {ctrl.code}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${ctrl.status === 'Implémenté' ? 'bg-green-100 text-green-700' : ctrl.status === 'Partiel' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{ctrl.status}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{ctrl.name}</p>
                                        <div className="text-[10px] text-slate-400">Type: {ctrl.type || 'Non défini'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-slate-400 text-center mt-4">Les contrôles sont gérés dans le module Conformité.</p>

                        {/* Supported Processes (Moved from Details) */}
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                                <HeartPulse className="h-4 w-4 mr-2" /> Processus Supportés
                            </h3>
                            {(() => {
                                const supported = processes.filter(p => p.supportingAssetIds?.includes(selectedAsset.id));
                                return supported.length > 0 ? (
                                    <div className="space-y-2">
                                        {supported.map(p => (
                                            <div key={p.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-white">{p.name}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.priority === 'Critique' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.priority}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-slate-500 italic">Cet actif ne supporte aucun processus critique.</p>;
                            })()}
                        </div>
                    </div>
                )}
                {inspectorTab === 'projects' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets Liés ({linkedProjects.length})</h3>
                        {linkedProjects.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun projet associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedProjects.map(proj => (
                                    <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{proj.status}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{proj.description}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 mr-4 max-w-[100px]">
                                                <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{proj.progress}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'audits' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><CheckSquare className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                        {linkedAudits.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun audit associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedAudits.map(audit => (
                                    <div key={audit.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{audit.name}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${audit.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{audit.status}</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                <CalendarClock className="h-3 w-3" />
                                                {new Date(audit.dateScheduled).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {audit.findingsCount} constats
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'documents' && selectedAsset && (
                    <div className="space-y-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><FileText className="h-4 w-4 mr-2" /> Documents Liés ({linkedDocuments.length})</h3>
                        {linkedDocuments.length === 0 ? (
                            <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun document associé.</p>
                        ) : (
                            <div className="grid gap-4">
                                {linkedDocuments.map(doc => (
                                    <div key={doc.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate pr-4">{doc.title}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${doc.status === 'Publié' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{doc.status}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-xs text-slate-500">{doc.type} • v{doc.version}</span>
                                            <CustomTooltip content="Ouvrir le document dans un nouvel onglet">
                                                <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Voir le document ${doc.title}`} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center">
                                                    Voir <ExternalLink className="h-3 w-3 ml-1" />
                                                </a>
                                            </CustomTooltip>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'history' && selectedAsset && (
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center">
                                <History className="h-4 w-4 mr-2" /> Historique DICP
                            </h3>
                            {!selectedAsset.history || selectedAsset.history.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Aucune modification enregistrée.</p>
                            ) : (
                                <div className="space-y-4">
                                    {selectedAsset.history.slice().reverse().map((h, i) => (
                                        <div key={`rec-${i}`} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(h.date).toLocaleString()}</span>
                                                <span className="text-xs font-medium text-slate-500">par {h.userName}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                    <span className="text-[10px] text-slate-500 uppercase">Confidentialité</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="line-through opacity-50">{h.previousConfidentiality}</span>
                                                        <span>→</span>
                                                        <span className="font-bold">{h.newConfidentiality}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                    <span className="text-[10px] text-slate-500 uppercase">Intégrité</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="line-through opacity-50">{h.previousIntegrity}</span>
                                                        <span>→</span>
                                                        <span className="font-bold">{h.newIntegrity}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                    <span className="text-[10px] text-slate-500 uppercase">Disponibilité</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="line-through opacity-50">{h.previousAvailability}</span>
                                                        <span>→</span>
                                                        <span className="font-bold">{h.newAvailability}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="px-1">
                            <ResourceHistory resourceId={selectedAsset.id} resourceType="Asset" />
                        </div>
                    </div>
                )}

                {inspectorTab === 'graph' && selectedAsset && (
                    <div className="h-[500px]">
                        <RelationshipGraph rootId={selectedAsset.id} rootType="Asset" />
                    </div>
                )}

                {inspectorTab === 'intelligence' && selectedAsset && (
                    <div className="h-full overflow-y-auto p-6">
                        <AssetAIAssistant
                            asset={selectedAsset}
                            onUpdate={(updates) => onUpdate(selectedAsset.id, { ...selectedAsset, ...updates } as unknown as AssetFormData)}
                        />
                    </div>
                )}

                {inspectorTab === 'comments' && selectedAsset && (
                    <div className="h-full flex flex-col">
                        <CommentSection collectionName="assets" documentId={selectedAsset.id} />
                    </div>
                )}
            </div>
        </InspectorLayout>
    );
};
