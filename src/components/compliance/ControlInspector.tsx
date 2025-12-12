
import React, { useState, useEffect } from 'react';
import { Control, Risk, Project, Document, UserProfile, SystemLog, Audit, Finding, AutomatedEvidence } from '../../types';
import { IntegrationProvider } from '../../services/integrationService';
import { ScrollableTabs } from '../ui/ScrollableTabs';
import { Badge } from '../ui/Badge';
import { FileText, Paperclip, MessageSquare, History, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { useStore } from '../../store';
import { Comments } from '../ui/Comments';
import { ComplianceAIAssistant } from './ComplianceAIAssistant';

interface ControlInspectorProps {
    control: Control;
    users: UserProfile[];
    risks: Risk[];
    findings?: Finding[];
    projects?: Project[];
    audits?: Audit[];
    documents: Document[];
    providers?: IntegrationProvider[];
    history: SystemLog[];
    onClose: () => void;

    // Actions
    onUpdateAssignee: (id: string) => Promise<void>;
    onUpdateStatus: (status: Control['status']) => Promise<void>;
    onSaveJustification: (text: string) => Promise<void>;
    onLinkDocument: (id: string) => Promise<void>;
    onUnlinkDocument: (id: string) => Promise<void>;
    onLinkRisk: (id: string) => Promise<void>;
    onUnlinkRisk: (id: string) => Promise<void>;
    onLinkProject: (id: string) => Promise<void>;
    onUnlinkProject: (id: string) => Promise<void>;
    onLinkAudit: (id: string) => Promise<void>;
    onLinkAutomatedEvidence: (providerId: string, resourceId: string) => Promise<void>;
    onUnlinkAutomatedEvidence: (id: string) => Promise<void>;
    onSyncEvidence: (evidence: AutomatedEvidence) => Promise<void>;

    canEdit: boolean;
    updating: boolean;
}

export const ControlInspector: React.FC<ControlInspectorProps> = ({
    control,
    users,
    risks,
    findings = [],
    projects = [],
    audits = [],
    documents = [],
    providers = [],
    history,
    canEdit,
    updating,
    onUpdateAssignee,
    onUpdateStatus,
    onSaveJustification,
    onLinkDocument,
    onUnlinkDocument,
    onLinkRisk,
    onUnlinkRisk,
    onLinkProject,
    onUnlinkProject,
    onLinkAudit,
    onLinkAutomatedEvidence,
    onUnlinkAutomatedEvidence,
    onSyncEvidence
}) => {
    // Unused props silencer:
    void findings; void audits; void providers; void onLinkAudit; void onLinkAutomatedEvidence; void onUnlinkAutomatedEvidence; void onSyncEvidence;

    const { user } = useStore();
    void user; // Silence unused warning
    const [activeTab, setActiveTab] = useState('details');
    const [editJustification, setEditJustification] = useState(control.justification || '');

    // Sync local justification state with control prop
    useEffect(() => {
        setEditJustification(control.justification || '');
    }, [control.id, control.justification]);

    const tabs = [
        { id: 'details', label: 'Détails', icon: FileText },
        { id: 'evidence', label: 'Preuves', icon: Paperclip, count: (control.evidenceIds?.length || 0) + (control.automatedEvidence?.length || 0) },
        { id: 'linkedItems', label: 'Associations', icon: LinkIcon, count: (control.relatedProjectIds?.length || 0) + (control.relatedSupplierIds?.length || 0) + (risks.filter(r => r.mitigationControlIds?.includes(control.id)).length) },
        { id: 'comments', label: 'Discussion', icon: MessageSquare },
        { id: 'history', label: 'Historique', icon: History }
    ];

    const linkedDocuments = documents.filter(d => control.evidenceIds?.includes(d.id));
    const linkedRisks = risks.filter(r => control.relatedRiskIds?.includes(r.id) || r.mitigationControlIds?.includes(control.id));
    const linkedProjects = projects.filter(p => control.relatedProjectIds?.includes(p.id));

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0B1120] w-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge className="text-xs">{control.code}</Badge>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{control.framework}</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{control.name}</h2>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                    <CustomSelect
                        options={['Non commencé', 'En cours', 'Partiel', 'Implémenté', 'Non applicable', 'Exclu'].map(s => ({ value: s, label: s }))}
                        value={control.status}
                        onChange={(val) => onUpdateStatus(val as any)}
                        className="w-40"
                        disabled={!canEdit || updating}
                    />
                    <CustomSelect
                        options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                        value={control.assigneeId || ''}
                        onChange={(val) => onUpdateAssignee(val as string)}
                        placeholder="Assigner..."
                        className="w-48"
                        disabled={!canEdit || updating}
                    />
                </div>

                <div className="mt-8">
                    <ScrollableTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 min-w-0">
                {activeTab === 'details' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Description</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                                {control.description || "Aucune description disponible."}
                            </p>
                        </div>

                        <ComplianceAIAssistant
                            control={control}
                            onApplyPolicy={(text) => setEditJustification(prev => prev ? prev + '\n\n' + text : text)}
                        />

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Justification / Notes d'implémentation</h3>
                                {canEdit && (
                                    <button
                                        onClick={() => onSaveJustification(editJustification)}
                                        disabled={updating || editJustification === control.justification}
                                        className="text-xs font-bold text-brand-600 hover:text-brand-500 disabled:opacity-50"
                                    >
                                        Sauvegarder
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={editJustification}
                                onChange={(e) => setEditJustification(e.target.value)}
                                placeholder="Décrivez comment ce contrôle est implémenté ou justifiez son exclusion..."
                                className="w-full h-32 p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                disabled={!canEdit}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'evidence' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Documents liés</h3>
                                {canEdit && <button onClick={() => onLinkDocument('new')} className="text-xs text-brand-600 font-bold hover:text-brand-500 flex items-center gap-1"><Plus className="h-3 w-3" /> Ajouter</button>}
                            </div>

                            {linkedDocuments.length > 0 ? (
                                <div className="space-y-3">
                                    {linkedDocuments.map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 group">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{doc.title}</p>
                                                    <p className="text-xs text-slate-500">{new Date(doc.updatedAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors">
                                                    <ExternalLink className="h-4 w-4 text-slate-500" />
                                                </a>
                                                {canEdit && (
                                                    <button onClick={() => onUnlinkDocument(doc.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic">Aucun document lié.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'linkedItems' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Risques</h3>
                                {canEdit && <button onClick={() => onLinkRisk('new')} className="text-xs text-brand-600 font-bold hover:text-brand-500 flex items-center gap-1"><Plus className="h-3 w-3" /> Lier</button>}
                            </div>
                            {linkedRisks.length > 0 ? (
                                <div className="space-y-2">
                                    {linkedRisks.map(risk => (
                                        <div key={risk.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center group">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{risk.threat}</span>
                                            {canEdit && (
                                                <button onClick={() => onUnlinkRisk(risk.id)} className="opacity-0 group-hover:opacity-100 text-red-500 p-1">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-500 italic">Aucun risque associé.</p>}
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Projets</h3>
                                {canEdit && <button onClick={() => onLinkProject('new')} className="text-xs text-brand-600 font-bold hover:text-brand-500 flex items-center gap-1"><Plus className="h-3 w-3" /> Lier</button>}
                            </div>
                            {linkedProjects.length > 0 ? (
                                <div className="space-y-2">
                                    {linkedProjects.map(proj => (
                                        <div key={proj.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center group">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{proj.name}</span>
                                            {canEdit && (
                                                <button
                                                    onClick={() => onUnlinkProject(proj.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                    title="Délier le projet"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-500 italic">Aucun projet associé.</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'comments' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 h-full">
                        <Comments collectionName="controls" documentId={control.id} />
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                        <ul className="space-y-4">
                            {history.length > 0 ? history.map((log) => (
                                <li key={log.id} className="flex gap-4">
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-900 dark:text-white font-medium">{log.action}</p>
                                        <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                                        {log.details && <p className="text-xs text-slate-500 mt-1">{log.details}</p>}
                                    </div>
                                </li>
                            )) : <p className="text-sm text-slate-500">Aucun historique récent.</p>}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
