import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertOctagon, Plus, Loader2, Upload, Trash2 } from '../../ui/Icons';

import { Audit, Control, Finding } from '../../../types';
import { findingSchema, FindingFormData } from '../../../schemas/findingSchema';
import { EmptyState } from '../../ui/EmptyState';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { FloatingLabelTextarea } from '../../ui/FloatingLabelInput';
import { AIAssistButton } from '../../ai/AIAssistButton';
import { ErrorLogger } from '../../../services/errorLogger';
import { useStore } from '../../../store';

interface AuditFindingsProps {
    audit: Audit;
    controls: Control[];
    findings: Finding[];
    canEdit: boolean;
    onAddFinding: (data: FindingFormData) => Promise<void>;
    onDeleteFinding: (id: string) => Promise<void>;
    onUploadEvidence: (findingId: string, url: string, name: string) => Promise<string | null>;
}

export const AuditFindings: React.FC<AuditFindingsProps> = ({
    audit,
    controls,
    findings,
    canEdit,
    onAddFinding,
    onDeleteFinding,
    onUploadEvidence
}) => {
    const { t } = useStore();
    const [uploadingFindingId, setUploadingFindingId] = useState<string | null>(null);

    const findingForm = useForm<FindingFormData>({
        resolver: zodResolver(findingSchema),
        defaultValues: { description: '', type: 'Mineure', severity: 'Moyenne', status: 'Ouvert', relatedControlId: '', evidenceIds: [] }
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, findingId: string) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingFindingId(findingId);
        try {
            // TODO: Implement proper Cloud Storage upload
            const fakeUrl = URL.createObjectURL(file);
            await onUploadEvidence(findingId, fakeUrl, file.name);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'AuditFindings.handleFileUpload', 'FILE_UPLOAD_FAILED');
        } finally {
            setUploadingFindingId(null);
        }
    };

    const onSubmit = async (data: FindingFormData) => {
        await onAddFinding(data);
        findingForm.reset();
    };

    return (
        <div className="space-y-6">
            {canEdit && (
                <form onSubmit={findingForm.handleSubmit(onSubmit)} className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Plus className="h-4 w-4 text-brand-500" /> {t('audits.findingsSection.newFinding')}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-end">
                                <AIAssistButton
                                    context={{ auditName: audit.name, auditType: audit.type }}
                                    fieldName="description"
                                    onSuggest={(val) => findingForm.setValue('description', val)}
                                    prompt={t('audits.findingsSection.form.descriptionPlaceholder')}
                                />
                            </div>
                            <FloatingLabelTextarea
                                label={t('audits.findingsSection.form.description')}
                                {...findingForm.register('description')}
                                required
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <select {...findingForm.register('type')} className="w-full px-4 py-3 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border border-border/40 dark:border-border/40 rounded-3xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-brand-400 transition-all outline-none">
                                <option value="Mineure">{t('audits.findingsSection.form.type.minor')}</option>
                                <option value="Majeure">{t('audits.findingsSection.form.type.major')}</option>
                                <option value="Observation">{t('audits.findingsSection.form.type.observation')}</option>
                                <option value="Opportunité">{t('audits.findingsSection.form.type.opportunity')}</option>
                            </select>
                            <select {...findingForm.register('severity')} className="w-full px-4 py-3 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border border-border/40 dark:border-border/40 rounded-3xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-brand-400 transition-all outline-none">
                                <option value="Critique">{t('audits.findingsSection.form.severity.critical')}</option>
                                <option value="Haute">{t('audits.findingsSection.form.severity.high')}</option>
                                <option value="Moyenne">{t('audits.findingsSection.form.severity.medium')}</option>
                                <option value="Faible">{t('audits.findingsSection.form.severity.low')}</option>
                                <option value="Info">{t('audits.findingsSection.form.severity.info')}</option>
                            </select>
                            <select {...findingForm.register('relatedControlId')} className="w-full px-4 py-3 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border border-border/40 dark:border-border/40 rounded-3xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-brand-400 transition-all outline-none">
                                <option value="">{t('audits.findingsSection.form.linkControl')}</option>
                                {controls.map(c => <option key={c.id || 'unknown'} value={c.id}>{c.code} - {c.name.substring(0, 30)}...</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" aria-label={t('audits.findingsSection.add')} className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-semibold rounded-3xl shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                {t('audits.findingsSection.add')}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="space-y-4 pt-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('audits.findingsSection.listTitle', { count: findings.length })}</h3>
                {findings.length === 0 ? (
                    <EmptyState
                        icon={AlertOctagon}
                        title={t('audits.findingsSection.emptyTitle')}
                        description={t('audits.findingsSection.emptyDesc')}
                        color="slate"
                    />
                ) : (
                    findings.map(f => (
                        <div key={f.id || 'unknown'} className="p-4 glass-premium rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-all flex justify-between items-start group">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${f.type === 'Majeure' ? 'bg-red-50 text-red-600 dark:text-red-400 ring-1 ring-red-500/20' : f.type === 'Opportunité' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-amber-50 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'}`}>
                                        {f.type}
                                    </span>
                                    {f.severity && (
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${f.severity === 'Critique' ? 'bg-error-bg text-error-text ring-1 ring-error-border' :
                                                f.severity === 'Haute' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                                                    f.severity === 'Moyenne' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                                                        f.severity === 'Faible' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                                                            'bg-muted text-muted-foreground ring-1 ring-border'
                                            }`}>
                                            {f.severity}
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">{new Date(f.createdAt || '').toLocaleDateString()}</span>
                                </div>
                                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{f.description}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {canEdit && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-70 transition-opacity">
                                        <CustomTooltip content={t('audits.findingsSection.uploadEvidence')}>
                                            <label htmlFor={`file-upload-${f.id}`} className={`cursor-pointer p-2 transition-all rounded-3xl hover:bg-indigo-500/10 ${uploadingFindingId === f.id ? 'text-indigo-500 animate-pulse' : 'text-slate-400 hover:text-indigo-500'}`}>
                                                {uploadingFindingId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                <input type="file"
                                                    id={`file-upload-${f.id}`}
                                                    aria-label="Upload de preuve pour le constat"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e, f.id)}
                                                    disabled={!!uploadingFindingId}
                                                />
                                            </label>
                                        </CustomTooltip>
                                        <CustomTooltip content={t('audits.findingsSection.delete')}>
                                            <button onClick={() => onDeleteFinding(f.id)} aria-label={t('audits.findingsSection.delete')} className="text-slate-400 hover:text-red-500 p-2 rounded-3xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </CustomTooltip>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
