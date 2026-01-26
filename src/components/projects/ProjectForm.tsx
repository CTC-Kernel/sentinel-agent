import React, { useEffect, useMemo, useRef } from 'react';
import { Project, Risk, Control, Asset, UserProfile } from '../../types';
import { AIAssistButton } from '../ai/AIAssistButton';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { Controller, useWatch, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { projectSchema, ProjectFormData } from '../../schemas/projectSchema';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../ui/FloatingLabelSelect';
import { FRAMEWORK_OPTIONS } from '../../data/frameworks';

import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { Button } from '../ui/button';
import { AIAssistantHeader, BaseTemplate } from '../ui/AIAssistantHeader';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';

import { PROJECT_STATUSES } from '../../data/projectConstants';

type ProjectStatus = typeof PROJECT_STATUSES[number];
import { toast } from '@/lib/toast';
import { Loader2 } from '../ui/Icons';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

type ProjectTemplate = BaseTemplate & { status: string; priority: string };

const PROJECT_TEMPLATES: ProjectTemplate[] = [
    { name: 'Mise en conformité ISO 27001', description: 'Projet complet d\'implémentation du SMSI.', status: 'En cours', priority: 'Haute' },
    { name: 'Déploiement MFA Global', description: 'Activation du MFA pour tous les employés.', status: 'Planifié', priority: 'Critique' },
    { name: 'Migration Cloud Sécurisée', description: 'Migration des serveurs on-premise vers AWS.', status: 'En cours', priority: 'Moyenne' },
];

interface ProjectFormProps {
    onSubmit: (project: ProjectFormData) => void;
    onCancel: () => void;
    existingProject?: Project;
    usersList?: UserProfile[]; // Full user objects for members selection & manager select
    availableRisks?: Risk[];
    availableControls?: Control[];
    availableAssets?: Asset[];
    initialData?: Partial<ProjectFormData>;
    isLoading?: boolean;
    formId?: string;
    hideActions?: boolean;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
    onSubmit,
    onCancel,
    existingProject,
    usersList = [],
    availableRisks = [],
    availableControls = [],
    availableAssets = [],
    initialData,
    isLoading = false,
    hideActions = false,
}) => {
    const [isGenerating, setIsGenerating] = React.useState(false);
    const formRef = useRef<HTMLFormElement | null>(null);
    const dueDateSectionRef = useRef<HTMLDivElement | null>(null);

    const allManagers = useMemo(() => usersList
        .filter(u => !!u.uid)
        .map(u => ({
            value: u.uid,
            label: u.displayName || u.email || 'Utilisateur'
        })), [usersList]);

    const { register, handleSubmit, reset, control, setValue, getValues, watch, formState: { errors } } = useZodForm<typeof projectSchema>({
        schema: projectSchema,
        mode: 'onChange',
        defaultValues: {
            name: initialData?.name || '',
            description: initialData?.description || '',
            manager: initialData?.manager || '',
            managerId: initialData?.managerId || '',
            status: (initialData?.status || 'Planifié'),
            startDate: initialData?.startDate || '',
            dueDate: initialData?.dueDate || '',
            relatedRiskIds: initialData?.relatedRiskIds || [],
            relatedControlIds: initialData?.relatedControlIds || [],
            relatedAssetIds: initialData?.relatedAssetIds || [],
            relatedAuditIds: initialData?.relatedAuditIds || [],
            members: initialData?.members || [],
            framework: initialData?.framework,
        }
    });

    // Persistence Hook
    const { clearDraft } = useFormPersistence<ProjectFormData>('sentinel_project_draft_new', {
        watch,
        reset
    }, {
        enabled: !existingProject && !initialData
    });

    const scrollToFirstError = (fieldErrors: FieldErrors<ProjectFormData>) => {
        const firstErrorKey = Object.keys(fieldErrors)[0];
        if (firstErrorKey) {
            const el = formRef.current?.querySelector(`[name="${firstErrorKey}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (el as HTMLElement).focus?.();
            }
        }
    };

    const onInvalid = (fieldErrors: FieldErrors<ProjectFormData>) => {
        const missingFields = Object.keys(fieldErrors).join(', ');
        toast.error(`Formulaire incomplet. Champs manquants : ${missingFields}`);
        scrollToFirstError(fieldErrors);
    };

    // Generate description with AI
    const handleGenerateDescription = async () => {
        const currentName = getValues('name');
        if (!currentName) return;

        setIsGenerating(true);
        try {
            const prompt = `Décris un projet de sécurité intitulé "${currentName}".
            Format JSON attendu:
            {
                "description": "Objectifs et description détaillée",
                "priority": "Haute, Moyenne ou Basse"
            }`;

            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.description) setValue('description', data.description);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProjectForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelectTemplate = (templateName: string) => {
        const t = PROJECT_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('name', t.name);
            setValue('description', t.description);
            if (
                t.status === 'Planifié' ||
                t.status === 'En cours' ||
                t.status === 'Terminé' ||
                t.status === 'Suspendu'
            ) {
                setValue('status', t.status as ProjectStatus); // Cast to valid status
            }
            if (!getValues('dueDate')) {
                const defaultDue = new Date();
                defaultDue.setDate(defaultDue.getDate() + 90);
                const isoDate = defaultDue.toISOString().split('T')[0];
                setValue('dueDate', isoDate);
            }
        }
    };

    const handleAutoGenerate = async () => {
        await handleGenerateDescription(); // reuse existing function
    };

    const isEditing = !!existingProject;

    useEffect(() => {
        if (existingProject) {
            reset({
                name: existingProject.name || '',
                description: existingProject.description || '',
                manager: existingProject.manager || '',
                managerId: existingProject.managerId || '',
                status: existingProject.status || 'Planifié',
                startDate: existingProject.startDate || '',
                dueDate: existingProject.dueDate || '',
                relatedRiskIds: existingProject.relatedRiskIds || [],
                relatedControlIds: existingProject.relatedControlIds || [],
                relatedAssetIds: existingProject.relatedAssetIds || [],
                relatedAuditIds: existingProject.relatedAuditIds || [],
                members: existingProject.members || [],
                framework: existingProject.framework,
            });
        } else {
            reset({
                name: initialData?.name || '',
                description: initialData?.description || '',
                manager: initialData?.manager || '',
                managerId: initialData?.managerId || '',
                status: initialData?.status || 'Planifié',
                startDate: initialData?.startDate || '',
                dueDate: initialData?.dueDate || '',
                relatedRiskIds: initialData?.relatedRiskIds || [],
                relatedControlIds: initialData?.relatedControlIds || [],
                relatedAssetIds: initialData?.relatedAssetIds || [],
                relatedAuditIds: initialData?.relatedAuditIds || [],
                members: [],
                framework: initialData?.framework,
            });
        }
    }, [existingProject, initialData, reset]);

    const watchedName = useWatch({ control, name: 'name' });
    const relatedRiskIds = useWatch({ control, name: 'relatedRiskIds' });

    const onFormSubmit = (data: ProjectFormData) => {
        onSubmit({
            ...data,
            manager: allManagers.find(m => m.value === data.managerId)?.label || data.manager
        });
        clearDraft();
    };

    // ...

    const submitHandler = handleSubmit(onFormSubmit, onInvalid);

    return (
        <form ref={formRef} onSubmit={submitHandler} className="space-y-8 animate-fade-in relative">
            {isGenerating && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm rounded-xl">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                </div>
            )}

            {
                !isEditing && (
                    <AIAssistantHeader
                        templates={PROJECT_TEMPLATES}
                        onSelectTemplate={handleSelectTemplate}
                        onAutoGenerate={handleAutoGenerate}
                        isGenerating={isGenerating}
                        title="Assistant Projet"
                        description="Démarrez votre projet avec un modèle standard ou généré par l'IA."
                    />
                )
            }
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-10">
                <div className="space-y-6">
                    <div className="relative">
                        <FloatingLabelInput
                            label="Nom du projet"
                            {...register('name')}
                            error={errors.name?.message}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <AIAssistButton
                                context={{ relatedRisks: availableRisks.filter(r => relatedRiskIds?.includes(r.id)) }}
                                fieldName="Nom du projet"
                                prompt="Suggère un nom de projet professionnel pour traiter ces risques. Sois concis."
                                onSuggest={(val: string) => setValue('name', val, { shouldDirty: true })}
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <FloatingLabelTextarea
                            label="Description"
                            {...register('description')}
                            rows={4}
                            error={errors.description?.message}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <AIAssistButton
                                context={{ name: watchedName }}
                                fieldName="Description"
                                prompt="Rédige une description courte et professionnelle pour ce projet de sécurité."
                                onSuggest={(val: string) => setValue('description', val, { shouldDirty: true })}
                            />
                        </div>
                    </div>

                    <div>
                        <FloatingLabelSelect
                            label="Référentiel Associé (Optionnel)"
                            {...register('framework')}
                            options={FRAMEWORK_OPTIONS}
                            error={errors.framework?.message}
                        />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" data-field="managerId">
                        <Controller
                            name="managerId"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Responsable"
                                    value={field.value || ''}
                                    onChange={(val) => {
                                        field.onChange(val);
                                        const selectedUser = usersList.find(u => u.uid === val);
                                        setValue('manager', selectedUser?.displayName || selectedUser?.email || '');
                                    }}
                                    options={allManagers}
                                    placeholder="Sélectionner un responsable..."
                                    required
                                    error={errors.managerId?.message}
                                />
                            )}
                        />
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Statut"
                                    value={field.value || 'Planifié'}
                                    onChange={field.onChange}
                                    options={PROJECT_STATUSES.map(s => ({ value: s, label: s }))}
                                    error={errors.status?.message}
                                />
                            )}
                        />
                    </div>

                    <Controller
                        name="members"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Membres de l'équipe"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={usersList.map(u => ({
                                    value: u.uid,
                                    label: u.displayName || u.email,
                                    subLabel: u.email
                                }))}
                                multiple
                                placeholder="Sélectionner des membres..."
                                error={errors.members?.message}
                            />
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4" ref={dueDateSectionRef} data-field="dueDate">
                        <Controller
                            name="startDate"
                            control={control}
                            render={({ field }) => (
                                <DatePicker
                                    label="Date de début"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.startDate?.message}
                                />
                            )}
                        />
                        <Controller
                            name="dueDate"
                            control={control}
                            render={({ field }) => (
                                <DatePicker
                                    label="Date de fin"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.dueDate?.message}
                                    placeholder="Date requise"
                                />
                            )}
                        />
                    </div>

                    <div className="space-y-6">
                        <Controller
                            name="relatedRiskIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Risques liés"
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    options={availableRisks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}
                                    multiple
                                    error={errors.relatedRiskIds?.message}
                                />
                            )}
                        />

                        <Controller
                            name="relatedControlIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Contrôles liés"
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    options={availableControls.map(c => ({ value: c.id, label: c.code, subLabel: c.name }))}
                                    multiple
                                    error={errors.relatedControlIds?.message}
                                />
                            )}
                        />

                        <Controller
                            name="relatedAssetIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Actifs concernés"
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    options={availableAssets.map(a => ({ value: a.id, label: a.name }))}
                                    multiple
                                    error={errors.relatedAssetIds?.message}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>

            {
                !hideActions && (
                    <div className="flex justify-end space-x-4 pt-6 border-t border-slate-100 dark:border-white/5">
                        <Button
                            type="button"
                            onClick={onCancel}
                            variant="ghost"
                            disabled={isLoading}
                            className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="px-8 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl hover:scale-105 transition-transform shadow-lg shadow-brand-500/20 font-bold text-sm"
                        >
                            {existingProject ? 'Enregistrer' : 'Créer le Projet'}
                        </Button>
                    </div>
                )
            }
        </form >
    );
};
