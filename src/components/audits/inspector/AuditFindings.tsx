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
                <form onSubmit={findingForm.handleSubmit(onSubmit)} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="text-sm font-bold uppercase text-slate-500 mb-4 flex items-center gap-2">
                        <Plus className="h-4 w-4" /> {t('audits.findingsSection.newFinding')}
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
                            <select {...findingForm.register('type')} className="input-field">
                                <option value="Mineure">{t('audits.findingsSection.form.type.minor')}</option>
                                <option value="Majeure">{t('audits.findingsSection.form.type.major')}</option>
                                <option value="Observation">{t('audits.findingsSection.form.type.observation')}</option>
                                <option value="Opportunité">{t('audits.findingsSection.form.type.opportunity')}</option>
                            </select>
                            <select {...findingForm.register('severity')} className="input-field">
                                <option value="Critique">{t('audits.findingsSection.form.severity.critical')}</option>
                                <option value="Haute">{t('audits.findingsSection.form.severity.high')}</option>
                                <option value="Moyenne">{t('audits.findingsSection.form.severity.medium')}</option>
                                <option value="Faible">{t('audits.findingsSection.form.severity.low')}</option>
                                <option value="Info">{t('audits.findingsSection.form.severity.info')}</option>
                            </select>
                            <select {...findingForm.register('relatedControlId')} className="input-field">
                                <option value="">{t('audits.findingsSection.form.linkControl')}</option>
                                {controls.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name.substring(0, 30)}...</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" aria-label={t('audits.findingsSection.add')} className="btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                {t('audits.findingsSection.add')}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="space-y-4 pt-4">
                <h3 className="text-lg font-bold">{t('audits.findingsSection.listTitle', { count: findings.length })}</h3>
                {findings.length === 0 ? (
                    <EmptyState
                        icon={AlertOctagon}
                        title={t('audits.findingsSection.emptyTitle')}
                        description={t('audits.findingsSection.emptyDesc')}
                        color="slate"
                    />
                ) : (
                    findings.map(f => (
                        <div key={f.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${f.type === 'Majeure' ? 'bg-red-100 text-red-700' : f.type === 'Opportunité' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {f.type}
                                    </span>
                                    {f.severity && (
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                            f.severity === 'Critique' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                            f.severity === 'Haute' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                            f.severity === 'Moyenne' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                            f.severity === 'Faible' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
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
                                    <div className="flex items-center gap-1">
                                        <CustomTooltip content={t('audits.findingsSection.uploadEvidence')}>
                                            <label htmlFor={`file-upload-${f.id}`} className={`cursor-pointer p-1 transition-colors focus-within:ring-2 focus-within:ring-brand-500 rounded ${uploadingFindingId === f.id ? 'text-indigo-500 animate-pulse' : 'text-muted-foreground hover:text-indigo-500'}`}>
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
                                            <button onClick={() => onDeleteFinding(f.id)} aria-label={t('audits.findingsSection.delete')} className="text-muted-foreground hover:text-red-500 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
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
