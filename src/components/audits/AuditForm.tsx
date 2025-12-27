import React, { useEffect } from 'react';
import { useForm, Controller, useWatch, FieldErrors } from 'react-hook-form';
import { AddToCalendar } from '../ui/AddToCalendar';
import { zodResolver } from '@hookform/resolvers/zod';
import { auditSchema, AuditFormData } from '../../schemas/auditSchema';
import { Audit, Control, Asset, Risk, UserProfile, Project } from '../../types';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { AIAssistantHeader, BaseTemplate } from '../ui/AIAssistantHeader';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';
import type { Framework } from '../../types';
import { FRAMEWORK_OPTIONS } from '../../data/frameworks';
import { toast } from 'sonner';

type AuditTemplate = BaseTemplate & { type: string; standard: string; scope: string };

const AUDIT_TEMPLATES: AuditTemplate[] = [
    { name: 'Audit Interne ISO 27001', description: 'Vérification de conformité annuelle sur le périmètre complet.', type: 'Interne', standard: 'ISO 27001', scope: 'Organisation Globale' },
    { name: 'Audit Fournisseur Critique', description: 'Évaluation de sécurité d\'un hébergeur de données de santé.', type: 'Externe', standard: 'HDS / ISO 27001', scope: 'Fournisseurs' },
    { name: 'Review Accès Logiques', description: 'Revue trimestrielle des comptes à privilèges.', type: 'Interne', standard: 'Interne', scope: 'IT / IAM' },
];
import { AUDIT_TYPES } from '../../data/auditConstants';
import { RichTextEditor } from '../ui/RichTextEditor';
import { DatePicker } from '../ui/DatePicker';

interface AuditFormProps {
    onSubmit: import('react-hook-form').SubmitHandler<AuditFormData>;
    onCancel: () => void;
    existingAudit?: Audit | null;
    assets: Asset[];
    risks: Risk[];
    controls: Control[];
    projects: Project[];
    usersList: UserProfile[];
    initialData?: Partial<AuditFormData>;
    isLoading?: boolean;
}

export const AuditForm: React.FC<AuditFormProps> = ({
    onSubmit,
    onCancel,
    existingAudit,
    assets,
    risks,
    controls,
    projects,
    usersList,
    initialData,
    isLoading = false
}) => {
    const { register, handleSubmit, reset, control, setValue, getValues, formState: { errors } } = useForm<AuditFormData>({
        resolver: zodResolver(auditSchema),
        shouldUnregister: true,
        defaultValues: {
            // ...
        }
    });

    const onInvalid = (errors: FieldErrors<AuditFormData>) => {
        console.error("Form Validation Errors:", errors);
        const missingFields = Object.keys(errors).join(', ');
        toast.error(`Formulaire invalide. Champs en erreur : ${missingFields}`);
    };

    const watchedName = useWatch({ control, name: 'name' });
    const watchedType = useWatch({ control, name: 'type' });
    const watchedScope = useWatch({ control, name: 'scope' });
    const watchedDateScheduled = useWatch({ control, name: 'dateScheduled' });

    useEffect(() => {
        if (existingAudit) {
            reset({
                name: existingAudit.name,
                type: existingAudit.type,
                auditor: existingAudit.auditor,
                dateScheduled: existingAudit.dateScheduled,
                status: existingAudit.status,
                scope: existingAudit.scope || '',
                framework: existingAudit.framework,
                relatedAssetIds: existingAudit.relatedAssetIds || [],
                relatedRiskIds: existingAudit.relatedRiskIds || [],
                relatedControlIds: existingAudit.relatedControlIds || [],
                relatedProjectIds: existingAudit.relatedProjectIds || []
            });
        } else {
            reset({
                name: initialData?.name || '',
                type: initialData?.type || 'Interne',
                auditor: initialData?.auditor || '',
                dateScheduled: initialData?.dateScheduled || new Date().toISOString().split('T')[0],
                status: initialData?.status || 'Planifié',
                description: initialData?.description || '',
                scope: initialData?.scope || '',
                framework: initialData?.framework,
                relatedAssetIds: initialData?.relatedAssetIds || [],
                relatedRiskIds: initialData?.relatedRiskIds || [],
                relatedControlIds: initialData?.relatedControlIds || [],
                relatedProjectIds: initialData?.relatedProjectIds || []
            });
        }

    }, [existingAudit, initialData, reset]);

    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleSelectTemplate = (templateName: string) => {
        const t = AUDIT_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('name', t.name);
            setValue('description', t.description);
            if (typeof t.standard === 'string') {
                setValue('framework', t.standard as Framework);
            } else {
                setValue('framework', undefined);
            }
            setValue('type', t.type as AuditFormData['type']); // Assuming type is compatible or string
            setValue('scope', typeof t.scope === 'string' ? t.scope : '');
        }
    };

    const handleAutoGenerate = async () => {
        const currentName = getValues('name');
        if (!currentName) return;

        setIsGenerating(true);
        try {
            const prompt = `Décris un audit de sécurité intitulé "${currentName}".
            Format JSON attendu:
            {
                "description": "Objectifs et description",
                "scope": "Périmètre probable",
                "standard": "Norme probable (ISO 27001, RGPD, etc.)"
            }`;

            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.description) setValue('description', data.description);
                if (typeof data.standard === 'string') {
                    setValue('framework', data.standard as Framework);
                }
                if (typeof data.scope === 'string') {
                    setValue('scope', data.scope);
                }
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AuditForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
        }
    };

    const isEditing = !!existingAudit;

    return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 p-4 sm:p-6">
            {!isEditing && (
                <AIAssistantHeader
                    templates={AUDIT_TEMPLATES}
                    onSelectTemplate={handleSelectTemplate}
                    onAutoGenerate={handleAutoGenerate}
                    isGenerating={isGenerating}
                    title="Assistant Audit"
                    description="Initiez votre audit rapidement avec un modèle ou l'aide de l'IA."
                />
            )}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                <FloatingLabelInput
                    label="Nom de l'audit"
                    {...register('name')}
                    placeholder="Ex: Audit Interne ISO 27001 - Q1"
                    error={errors.name?.message}
                />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <textarea
                        {...register('description')}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-slate-900 dark:text-white placeholder-slate-400"
                        placeholder="Objectifs et contexte de l'audit..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Type"
                                value={field.value}
                                onChange={field.onChange}
                                options={AUDIT_TYPES.map(t => ({ value: t, label: t }))}
                            />
                        )}
                    />



                    <div className="md:col-span-2">
                        <Controller
                            name="framework"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Référentiel / Standard (Optionnel)"
                                    value={field.value || ''}
                                    onChange={(val) => field.onChange(val as Framework)}
                                    options={FRAMEWORK_OPTIONS}
                                    error={errors.framework?.message}
                                />
                            )}
                        />
                    </div>



                    <div className="relative">
                        <Controller
                            control={control}
                            name="dateScheduled"
                            render={({ field }) => (
                                <DatePicker
                                    label="Date Prévue"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.dateScheduled?.message}
                                />
                            )}
                        />
                        {watchedDateScheduled && watchedName && (
                            <div className="absolute right-2 top-2 z-10">
                                <AddToCalendar
                                    event={{
                                        title: watchedName,
                                        description: `Audit ${watchedType} - ${watchedScope} `,
                                        start: new Date(watchedDateScheduled),
                                        end: new Date(watchedDateScheduled),
                                        location: 'Sentinel GRC'
                                    }}
                                    className="scale-75 origin-right"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <Controller
                    name="auditor"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Auditeur"
                            value={field.value || ''}
                            onChange={field.onChange}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                            placeholder="Sélectionner un auditeur..."
                        />
                    )}
                />

                <Controller
                    name="scope"
                    control={control}
                    render={({ field }) => (
                        <RichTextEditor
                            label="Description du Périmètre"
                            value={field.value || ''}
                            onChange={field.onChange}
                            error={errors.scope?.message}
                        />
                    )}
                />

                <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600">Périmètre</label>
                    <Controller
                        name="relatedAssetIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Actifs concernés"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={assets.map(a => ({ value: a.id, label: a.name }))}
                                multiple
                            />
                        )}
                    />
                    <Controller
                        name="relatedControlIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Contrôles à vérifier"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={controls.map(c => ({ value: c.id, label: c.code, subLabel: c.name }))}
                                multiple
                            />
                        )}
                    />
                    <Controller
                        name="relatedRiskIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Risques concernés"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score} ` }))}
                                multiple
                            />
                        )}
                    />
                    <Controller
                        name="relatedProjectIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Projets liés"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={projects.map(p => ({ value: p.id, label: p.name }))}
                                multiple
                            />
                        )}
                    />
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-white/5">
                <Button
                    type="button"
                    onClick={onCancel}
                    variant="ghost"
                    disabled={isLoading}
                    className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                    Annuler
                </Button>
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="px-8 py-3 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-brand-500/20"
                >
                    {existingAudit ? 'Enregistrer' : 'Planifier'}
                </Button>
            </div>
        </form>
    );
};
