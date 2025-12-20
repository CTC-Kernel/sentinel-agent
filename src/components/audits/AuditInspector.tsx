import React, { useState, useEffect } from 'react';
import { Audit, Control, Document as GRCDocument } from '../../types';
import { useAuditDetails } from '../../hooks/audits/useAuditDetails';
import { InspectorLayout } from '../ui/InspectorLayout';
import { AlertOctagon, ClipboardCheck, BrainCircuit, FileText, Target, Plus, Trash2, CheckCheck, Loader2, Download } from 'lucide-react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { FloatingLabelTextarea } from '../ui/FloatingLabelInput';
import { AIAssistButton } from '../ai/AIAssistButton';
import { AuditDashboard } from './AuditDashboard';
import { useStore } from '../../store';
import { canDeleteResource } from '../../utils/permissions';
import { useForm } from 'react-hook-form'; // Removed Controller
import { zodResolver } from '@hookform/resolvers/zod';
import { findingSchema, FindingFormData } from '../../schemas/findingSchema';

interface AuditInspectorProps {
    audit: Audit;
    onClose: () => void;
    controls: Control[];
    documents: GRCDocument[];
    refreshAudits: () => void;
    canEdit: boolean;
}

export const AuditInspector: React.FC<AuditInspectorProps> = ({ audit, onClose, controls, documents, refreshAudits, canEdit }) => {
    const { user } = useStore();
    const {
        findings, checklist, fetchDetails,
        handleAddFinding, handleDeleteFinding,
        generateChecklist, handleChecklistAnswer,
        validateAudit, generateAuditReport, handleExportPack,
        isGeneratingReport, isValidating
    } = useAuditDetails(audit, controls, documents, refreshAudits);

    const [activeTab, setActiveTab] = useState('findings');

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const findingForm = useForm<FindingFormData>({
        resolver: zodResolver(findingSchema),
        defaultValues: { description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] }
    });

    const onSubmitFinding = async (data: FindingFormData) => {
        await handleAddFinding(data);
        findingForm.reset();
    };

    const tabs = [
        { id: 'findings', label: 'Constats', icon: AlertOctagon },
        { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
        { id: 'dashboard', label: 'Tableau de bord', icon: Target },
    ];

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
                        <CustomTooltip content="Supprimer l'audit (via liste)">
                            <button className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50" disabled>
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </CustomTooltip>
                    )}
                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2" />

                    {audit.status !== 'Validé' && canEdit && (
                        <button
                            onClick={validateAudit}
                            disabled={isValidating}
                            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 ${isValidating ? 'opacity-75 cursor-wait' : ''}`}
                        >
                            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                            <span className="hidden sm:inline">Valider</span>
                        </button>
                    )}

                    <CustomTooltip content="Rapport PDF">
                        <button onClick={() => generateAuditReport([])} disabled={isGeneratingReport} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-blue-500">
                            {isGeneratingReport ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                        </button>
                    </CustomTooltip>
                    <CustomTooltip content="Pack Audit (ZIP)">
                        <button onClick={handleExportPack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-emerald-500">
                            <Download className="h-5 w-5" />
                        </button>
                    </CustomTooltip>
                </div>
            }
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
        >
            <div className="space-y-6 max-w-7xl mx-auto">
                {activeTab === 'findings' && (
                    <>
                        {canEdit && (
                            <form onSubmit={findingForm.handleSubmit(onSubmitFinding)} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <h3 className="text-sm font-bold uppercase text-slate-500 mb-4 flex items-center gap-2"><Plus className="h-4 w-4" /> Nouveau Constat</h3>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-end">
                                            <AIAssistButton
                                                context={{ auditName: audit.name, auditType: audit.type }}
                                                fieldName="description"
                                                onSuggest={(val) => findingForm.setValue('description', val)}
                                                prompt="Rédige un constat d'audit factuel."
                                            />
                                        </div>
                                        <FloatingLabelTextarea label="Description" {...findingForm.register('description')} required rows={3} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select {...findingForm.register('type')} className="input-field">
                                            <option value="Mineure">Mineure</option>
                                            <option value="Majeure">Majeure</option>
                                            <option value="Opportunité">Opportunité</option>
                                        </select>
                                        <select {...findingForm.register('relatedControlId')} className="input-field">
                                            <option value="">Lier à un contrôle (optionnel)</option>
                                            {controls.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name.substring(0, 30)}...</option>)}
                                        </select>
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="submit" className="btn-primary">Ajouter</button>
                                    </div>
                                </div>
                            </form>
                        )}

                        <div className="space-y-4 pt-4">
                            <h3 className="text-lg font-bold">Liste des Écarts ({findings.length})</h3>
                            {findings.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 italic">Aucun constat pour le moment.</div>
                            ) : (
                                findings.map(f => (
                                    <div key={f.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${f.type === 'Majeure' ? 'bg-red-100 text-red-700' : f.type === 'Opportunité' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {f.type}
                                                </span>
                                                <span className="text-xs text-slate-400">{new Date(f.createdAt || '').toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{f.description}</p>
                                        </div>
                                        {canEdit && (
                                            <button onClick={() => handleDeleteFinding(f.id)} className="text-slate-400 hover:text-red-500 p-1">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'checklist' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Checklist d'Audit</h3>
                            {canEdit && (
                                <button onClick={generateChecklist} className="btn-secondary text-sm flex items-center gap-2">
                                    <BrainCircuit className="h-4 w-4" /> Générer avec IA
                                </button>
                            )}
                        </div>

                        {checklist ? (
                            <div className="space-y-4">
                                {checklist.questions.map(q => (
                                    <div key={q.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5">
                                        <p className="font-medium mb-3">{q.question}</p>
                                        <div className="flex gap-2">
                                            {(['Conforme', 'Non-conforme', 'Non-applicable'] as const).map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => handleChecklistAnswer(q.id, opt)}
                                                    className={`px-3 py-1 rounded-lg text-sm border ${q.response === opt ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30' : 'border-slate-200 text-slate-600'}`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                                <p className="text-slate-500 mb-4">Aucune checklist générée.</p>
                                <button onClick={generateChecklist} className="btn-primary">Générer maintenant</button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <AuditDashboard audits={[audit]} findings={findings} />
                )}
            </div>
        </InspectorLayout>
    );
};
