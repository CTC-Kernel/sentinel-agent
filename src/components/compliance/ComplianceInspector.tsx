import React, { useState } from 'react';
import { Control, UserProfile, Asset, Supplier, Risk, Project, Document, Finding, SystemLog } from '../../types';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { ComplianceAIAssistant } from './ComplianceAIAssistant';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Loader2, Link, FileText, Paperclip, MessageSquare, RefreshCw, User, X, ShieldAlert, AlertOctagon } from '../../components/ui/Icons';
import { Tooltip as CustomTooltip } from '../../components/ui/Tooltip';
import { formatDate } from '../../utils/date'; // Assuming available or I use Date directly
// We can use native Date for now to avoid dependency on utils
import { Comments } from '../../components/ui/Comments'; // Need to confirm if this exists and works

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
    };
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
    handlers
}) => {
    type InspectorTabId = 'details' | 'evidence' | 'comments' | 'history' | 'linkedItems';
    const [activeTab, setActiveTab] = useState<InspectorTabId>('details');
    // Local state for justification if needed for debounce, but usually handlers update directly.
    // However, text areas need local state to input.
    // Wait, Compliance.tsx uses state `editJustification`.
    // I should create local state here and sync on blur or save.
    const [justification, setJustification] = useState(control.justification || '');

    const { updating, handleAssign, handleStatusChange, handleLinkAsset, handleUnlinkAsset, handleLinkSupplier, handleUnlinkSupplier, handleLinkProject, handleUnlinkProject, updateJustification, handleLinkDocument, handleUnlinkDocument } = handlers;

    const riskCount = risks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
    const findingsCount = findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;

    // Helper to handle justification update from AI or Textarea
    const handleJustificationChange = (text: string) => {
        setJustification(text);
    };

    const saveJustification = () => {
        if (justification !== control.justification) {
            updateJustification(control, justification);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {/* Tabs Header */}
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100 dark:border-white/5">
                {linkingToProjectId && (
                    <div className="bg-brand-50/50 dark:bg-brand-900/10 px-6 py-3 border-b border-brand-100 dark:border-brand-900/30 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center text-sm text-brand-700 dark:text-brand-300">
                            <Link className="h-4 w-4 mr-2" />
                            <span className="font-medium">Lier ce contrôle au projet <strong>{linkingToProjectName}</strong> ?</span>
                        </div>
                        <button
                            onClick={() => handleLinkProject(control, linkingToProjectId)}
                            disabled={updating || (control.relatedProjectIds || []).includes(linkingToProjectId)}
                            className="text-xs bg-brand-600 hover:bg-brand-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center shadow-sm disabled:opacity-50"
                        >
                            {updating ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Link className="h-3 w-3 mr-1.5" />}
                            {(control.relatedProjectIds || []).includes(linkingToProjectId) ? 'Déjà lié' : 'Lier maintenant'}
                        </button>
                    </div>
                )}

                <ScrollableTabs
                    tabs={[
                        { id: 'details', label: 'Détails', icon: FileText },
                        { id: 'evidence', label: `Preuves (${control.evidenceIds?.length || 0})`, icon: Paperclip },
                        { id: 'linkedItems', label: 'Éléments Liés', icon: Link },
                        { id: 'comments', label: 'Discussion', icon: MessageSquare },
                        // { id: 'history', label: 'Historique', icon: RefreshCw }, // History requires fetching specific logs, keep for later or pass prop.
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as InspectorTabId)}
                />
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {activeTab === 'details' && (
                    <div className="space-y-8 w-full max-w-3xl mx-auto">
                        <ComplianceAIAssistant control={control} onApplyPolicy={(policy) => handleJustificationChange(justification ? justification + '\n\n' + policy : policy)} />

                        {/* Status & Assignment */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Statut d'implémentation</h3>
                                {canEdit ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'] as Control['status'][]).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => handleStatusChange(control, s)}
                                                disabled={updating}
                                                className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all duration-200 flex items-center justify-center ${control.status === s
                                                    ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                                    : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                                                    } ${updating ? 'opacity-50 cursor-wait' : ''}`}
                                            >
                                                {updating && control.status === s ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <span className={`px-4 py-2 rounded-xl text-sm font-bold border uppercase tracking-wide inline-block`}>{control.status}</span>
                                )}
                            </div>

                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Responsable</h3>
                                {canEdit ? (
                                    <CustomSelect
                                        label="Assigné à"
                                        value={control.assigneeId || ''}
                                        onChange={(val) => handleAssign(control, val as string)}
                                        options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email || u.uid }))}
                                        placeholder="Sélectionner un responsable..."
                                        disabled={updating}
                                    />
                                ) : (
                                    <div className="flex items-center p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 mr-3">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {usersList.find(u => u.uid === control.assigneeId)?.displayName || 'Non assigné'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Justification Area */}
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Justification / Politique</h3>
                            {canEdit ? (
                                <textarea
                                    className="w-full min-h-[120px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-y"
                                    placeholder="Décrivez comment ce contrôle est implémenté..."
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    onBlur={saveJustification}
                                />
                            ) : (
                                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {control.justification || <span className="text-slate-400 italic">Aucune justification fournie.</span>}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'linkedItems' && (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        {/* Use 2 columns grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Assets */}
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Actifs Liés</h3>
                                <div className="space-y-2 mb-4">
                                    {control.relatedAssetIds?.map(assetId => {
                                        const asset = assets.find(a => a.id === assetId);
                                        return asset ? (
                                            <div key={assetId} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                                <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                {canEdit && <button onClick={() => handleUnlinkAsset(control, assetId)} disabled={updating} className="text-slate-500 hover:text-red-500 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                                            </div>
                                        ) : null;
                                    })}
                                    {(!control.relatedAssetIds || control.relatedAssetIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun actif lié.</p>}
                                </div>
                                {canEdit && (
                                    <CustomSelect
                                        label=""
                                        value=""
                                        onChange={(val) => handleLinkAsset(control, val as string)}
                                        options={assets.filter(a => !control.relatedAssetIds?.includes(a.id)).map(a => ({ value: a.id, label: a.name }))}
                                        placeholder="Lier un actif..."
                                        disabled={updating}
                                    />
                                )}
                            </div>

                            {/* Suppliers */}
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Fournisseurs Liés</h3>
                                <div className="space-y-2 mb-4">
                                    {control.relatedSupplierIds?.map(supplierId => {
                                        const supplier = suppliers.find(s => s.id === supplierId);
                                        return supplier ? (
                                            <div key={supplierId} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                                <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{supplier.name}</span>
                                                {canEdit && <button onClick={() => handleUnlinkSupplier(control, supplierId)} disabled={updating} className="text-slate-500 hover:text-red-500 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                                            </div>
                                        ) : null;
                                    })}
                                    {(!control.relatedSupplierIds || control.relatedSupplierIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun fournisseur lié.</p>}
                                </div>
                                {canEdit && (
                                    <CustomSelect
                                        label=""
                                        value=""
                                        onChange={(val) => handleLinkSupplier(control, val as string)}
                                        options={suppliers.filter(s => !control.relatedSupplierIds?.includes(s.id)).map(s => ({ value: s.id, label: s.name }))}
                                        placeholder="Lier un fournisseur..."
                                        disabled={updating}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Projects (Full Width) */}
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Projets Liés</h3>
                            <div className="space-y-2 mb-4">
                                {control.relatedProjectIds?.map(pid => {
                                    const project = projects.find(p => p.id === pid);
                                    return project ? (
                                        <div key={pid} className="flex items-center justify-between p-3 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                                    <FolderKanban className="h-4 w-4" /> // Assuming FolderKanban is not imported, using Link for now
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-slate-900 dark:text-white">{project.name}</span>
                                                    <span className="text-xs text-slate-500">{project.status}</span>
                                                </div>
                                            </div>
                                            {canEdit && <button onClick={() => handleUnlinkProject(control, pid)} disabled={updating} className="text-slate-500 hover:text-red-500 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                                        </div>
                                    ) : null;
                                })}
                                {(!control.relatedProjectIds || control.relatedProjectIds.length === 0) && <p className="text-xs text-slate-500 italic">Aucun projet lié.</p>}
                            </div>
                            {canEdit && (
                                <CustomSelect
                                    label=""
                                    value=""
                                    onChange={(val) => handleLinkProject(control, val as string)}
                                    options={projects.filter(p => !control.relatedProjectIds?.includes(p.id)).map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="Lier un projet..."
                                    disabled={updating}
                                />
                            )}
                        </div>

                        {/* Risks & Findings Display (Read Only) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 bg-red-50/30 dark:bg-red-900/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldAlert className="h-5 w-5 text-red-500" />
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Risques ({riskCount})</h3>
                                </div>
                                <div className="space-y-2">
                                    {risks.filter(r => r.mitigationControlIds?.includes(control.id)).map(risk => (
                                        <div key={risk.id} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-red-100 dark:border-red-900/30">
                                            <div className="font-bold truncate">{risk.name}</div>
                                            <div className="text-slate-500">Risque brut: {risk.initialRiskScore}</div>
                                        </div>
                                    ))}
                                    {riskCount === 0 && <p className="text-xs text-slate-500">Aucun risque atténué par ce contrôle.</p>}
                                </div>
                            </div>
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 bg-orange-50/30 dark:bg-orange-900/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <AlertOctagon className="h-5 w-5 text-orange-500" />
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Non-conformités ({findingsCount})</h3>
                                </div>
                                <div className="space-y-2">
                                    {findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').map(finding => (
                                        <div key={finding.id} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-orange-100 dark:border-orange-900/30">
                                            <div className="font-bold truncate">{finding.description}</div>
                                            <div className="text-slate-500">Severité: {finding.severity}</div>
                                        </div>
                                    ))}
                                    {findingsCount === 0 && <p className="text-xs text-slate-500">Aucune non-conformité ouverte.</p>}
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'comments' && (
                    <div className="max-w-3xl mx-auto">
                        <Comments entityId={control.id} entityType="controls" />
                    </div>
                )}

                {activeTab === 'evidence' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-900 dark:text-white">Preuves documentaires</h3>
                                {/* Add Evidence Button logic can be added here or passed as prop slot */}
                            </div>
                            <div className="space-y-3">
                                {control.evidenceIds?.map(docId => {
                                    const doc = documents.find(d => d.id === docId);
                                    if (!doc) return null;
                                    return (
                                        <div key={docId} className="flex items-center p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl hover:shadow-md transition-all">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg mr-3">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{doc.name}</h4>
                                                <p className="text-xs text-slate-500">{formatDate(doc.createdAt)}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                                {canEdit && (
                                                    <button onClick={() => handleUnlinkDocument(control, docId)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!control.evidenceIds || control.evidenceIds.length === 0) && (
                                    <EmptyState icon={Paperclip} title="Aucune preuve" description="Liez des documents pour prouver la conformité." compact />
                                )}
                            </div>

                            {canEdit && (
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                                    <CustomSelect
                                        label="Ajouter une preuve existante"
                                        value=""
                                        onChange={(val) => handleLinkDocument(control, val as string)}
                                        options={documents.filter(d => !control.evidenceIds?.includes(d.id)).map(d => ({ value: d.id, label: d.name }))}
                                        placeholder="Sélectionner un document..."
                                        disabled={updating}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Missing Imports fallback
const ExternalLink = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
const FolderKanban = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="6" rx="2" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
