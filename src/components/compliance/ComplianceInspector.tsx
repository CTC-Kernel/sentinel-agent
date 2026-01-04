import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Control, UserProfile, Asset, Supplier, Risk, Project, Document, Finding } from '../../types';
import { ScrollableTabs } from '../../components/ui/ScrollableTabs';
import { ComplianceAIAssistant } from './ComplianceAIAssistant';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Loader2, Link, FileText, Paperclip, MessageSquare, User, X, ShieldAlert, AlertOctagon, ExternalLink, FolderKanban, Upload } from '../../components/ui/Icons';
import { formatDate } from '@/utils/date';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { TimelineView } from '../shared/TimelineView';
import { EmptyState } from '../../components/ui/EmptyState';

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
        onUploadEvidence: (c: Control) => void;
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
                        <Button
                            aria-label={`Lier le contrôle au projet ${linkingToProjectName}`}
                            onClick={() => handleLinkProject(control, linkingToProjectId)}
                            disabled={updating || (control.relatedProjectIds || []).includes(linkingToProjectId)}
                            size="sm"
                            className="text-xs font-bold shadow-sm"
                        >
                            {updating ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Link className="h-3 w-3 mr-1.5" />}
                            {(control.relatedProjectIds || []).includes(linkingToProjectId) ? 'Déjà lié' : 'Lier maintenant'}
                        </Button>
                    </div>
                )}

                <ScrollableTabs
                    tabs={[
                        { id: 'details', label: 'Détails', icon: FileText },
                        { id: 'evidence', label: `Preuves (${control.evidenceIds?.length || 0})`, icon: Paperclip },
                        { id: 'linkedItems', label: 'Éléments Liés', icon: Link },
                        { id: 'comments', label: 'Discussion', icon: MessageSquare },
                        { id: 'history', label: 'Historique', icon: FileText },
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
                            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Statut d'implémentation</h3>
                                {canEdit ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'] as Control['status'][]).map((s) => (
                                            <Button
                                                key={s}
                                                aria-label={`Changer le statut à ${s}`}
                                                aria-pressed={control.status === s}
                                                onClick={() => handleStatusChange(control, s)}
                                                disabled={updating}
                                                variant={control.status === s ? 'default' : 'outline'}
                                                className={`h-auto py-2 text-[10px] font-bold justify-center whitespace-normal ${control.status === s ? 'bg-brand-600 hover:bg-brand-700' : 'text-slate-600 dark:text-slate-400'}`}
                                            >
                                                {updating && control.status === s ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                {s}
                                            </Button>
                                        ))}
                                    </div>
                                ) : (
                                    <span className={`px-4 py-2 rounded-xl text-sm font-bold border uppercase tracking-wide inline-block`}>{control.status}</span>
                                )}
                            </div>

                            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
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
                        <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
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
                            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Actifs Liés</h3>
                                <div className="space-y-2 mb-4">
                                    {control.relatedAssetIds?.map(assetId => {
                                        const asset = assets.find(a => a.id === assetId);
                                        return asset ? (
                                            <div key={assetId} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                                <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                {canEdit && <Button variant="ghost" size="icon" aria-label="Délier l'actif" onClick={() => handleUnlinkAsset(control, assetId)} disabled={updating} className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
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
                            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Fournisseurs Liés</h3>
                                <div className="space-y-2 mb-4">
                                    {control.relatedSupplierIds?.map(supplierId => {
                                        const supplier = suppliers.find(s => s.id === supplierId);
                                        return supplier ? (
                                            <div key={supplierId} className="flex items-center justify-between p-2 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                                <span className="truncate flex-1 font-medium text-slate-700 dark:text-slate-200">{supplier.name}</span>
                                                {canEdit && <Button variant="ghost" size="icon" aria-label="Délier le fournisseur" onClick={() => handleUnlinkSupplier(control, supplierId)} disabled={updating} className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
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
                        <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Projets Liés</h3>
                            <div className="space-y-2 mb-4">
                                {control.relatedProjectIds?.map(pid => {
                                    const project = projects.find(p => p.id === pid);
                                    return project ? (
                                        <div key={pid} className="flex items-center justify-between p-3 bg-white/40 dark:bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                                    <FolderKanban className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-slate-900 dark:text-white">{project.name}</span>
                                                    <span className="text-xs text-slate-500">{project.status}</span>
                                                </div>
                                            </div>
                                            {canEdit && <Button variant="ghost" size="icon" aria-label="Délier le projet" onClick={() => handleUnlinkProject(control, pid)} disabled={updating} className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></Button>}
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
                            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 bg-red-50/30 dark:bg-red-900/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldAlert className="h-5 w-5 text-red-500" />
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Risques ({riskCount})</h3>
                                </div>
                                <div className="space-y-2">
                                    {risks.filter(r => r.mitigationControlIds?.includes(control.id)).map(risk => (
                                        <div key={risk.id} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-red-100 dark:border-red-900/30">
                                            <div className="font-bold truncate">{risk.threat}</div>
                                            <div className="text-slate-500">Risque brut: {risk.score}</div>
                                        </div>
                                    ))}
                                    {riskCount === 0 && <p className="text-xs text-slate-500">Aucun risque atténué par ce contrôle.</p>}
                                </div>
                            </div>
                            <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 bg-orange-50/30 dark:bg-orange-900/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <AlertOctagon className="h-5 w-5 text-orange-500" />
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Non-conformités ({findingsCount})</h3>
                                </div>
                                <div className="space-y-2">
                                    {findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').map(finding => (
                                        <div key={finding.id} className="p-2 bg-white/60 dark:bg-black/20 rounded-lg text-xs border border-orange-100 dark:border-orange-900/30">
                                            <div className="font-bold truncate">{finding.description}</div>
                                            <div className="text-slate-500">Type: {finding.type}</div>
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
                        <DiscussionPanel 
                            collectionName="controls" 
                            documentId={control.id}
                            title={`Discussion - ${control.code} ${control.name}`}
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

                {activeTab === 'evidence' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="glass-premium p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-900 dark:text-white">Preuves documentaires</h3>
                                {canEdit && (
                                    <Button
                                        onClick={() => handlers.onUploadEvidence(control)}
                                        size="sm"
                                        className="text-xs font-bold shadow-sm"
                                    >
                                        <Upload className="h-3 w-3 mr-1.5" />
                                        Ajouter une preuve
                                    </Button>
                                )}
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
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{doc.title}</h4>
                                                <p className="text-xs text-slate-500">{formatDate(doc.createdAt)}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                                {canEdit && (
                                                    <Button variant="ghost" size="icon" aria-label="Délier le document" onClick={() => handleUnlinkDocument(control, docId)} className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                        <X className="h-4 w-4" />
                                                    </Button>
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
                                        options={documents.filter(d => !control.evidenceIds?.includes(d.id)).map(d => ({ value: d.id, label: d.title }))}
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
