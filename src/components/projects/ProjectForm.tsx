import React, { useEffect } from 'react';
import { Project, Risk, Control, Asset } from '../../types';
import { AIAssistButton } from '../ai/AIAssistButton';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { useForm, Controller, useWatch, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
    availableUsers?: string[]; // list of manager display names
    availableRisks?: Risk[];
    availableControls?: Control[];
    availableAssets?: Asset[];
    initialData?: Partial<ProjectFormData>;
    isLoading?: boolean;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
    onSubmit,
    onCancel,
    existingProject,
    availableUsers = [],
    availableRisks = [],
    availableControls = [],
    availableAssets = [],
    initialData,
    isLoading = false,
}) => {
    const { register, handleSubmit, reset, control, setValue, getValues, formState: { errors } } = useForm<ProjectFormData>({
        resolver: zodResolver(projectSchema) as Resolver<ProjectFormData>,
        defaultValues: {
            name: '',
            description: '',
            manager: '',
            status: 'Planifié',
            startDate: '',
            dueDate: '',
            relatedRiskIds: [],
            relatedControlIds: [],
            relatedAssetIds: [],
            framework: undefined,
        }
    });

    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleSelectTemplate = (templateName: string) => {
        const t = PROJECT_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('name', t.name);
            setValue('description', t.description);
            // status and priority are enums in schema, assumed valid
            if (
                t.status === 'Planifié' ||
                t.status === 'En cours' ||
                t.status === 'Terminé' ||
                t.status === 'Suspendu'
            ) {
                setValue('status', t.status);
            }
            // if (t.priority) setValue('priority', t.priority as any); // Priority not in defaultValues/schema apparent here?
        }
    };

    const handleAutoGenerate = async () => {
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
                // if (data.priority) setValue('priority', data.priority);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProjectForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
        }
    };

    const isEditing = !!existingProject;

    useEffect(() => {
        if (existingProject) {
            reset({
                name: existingProject.name || '',
                description: existingProject.description || '',
                manager: existingProject.manager || '',
                status: existingProject.status || 'Planifié',
                startDate: existingProject.startDate || '',
                dueDate: existingProject.dueDate || '',
                relatedRiskIds: existingProject.relatedRiskIds || [],
                relatedControlIds: existingProject.relatedControlIds || [],
                relatedAssetIds: existingProject.relatedAssetIds || [],
                framework: existingProject.framework,
            });
        } else {
            reset({
                name: initialData?.name || '',
                description: initialData?.description || '',
                manager: initialData?.manager || '',
                status: initialData?.status || 'Planifié',
                startDate: initialData?.startDate || '',
                dueDate: initialData?.dueDate || '',
                relatedRiskIds: initialData?.relatedRiskIds || [],
                relatedControlIds: initialData?.relatedControlIds || [],
                relatedAssetIds: initialData?.relatedAssetIds || [],
                framework: initialData?.framework,
            });
        }
    }, [existingProject, initialData, reset]);

    const onFormSubmit = (data: ProjectFormData) => {
        onSubmit(data);
    };

    // Watch values for AI context
    const watchedName = useWatch({ control, name: 'name' });
    const relatedRiskIds = useWatch({ control, name: 'relatedRiskIds' });

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="p-4 sm:p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar h-full">
            {!isEditing && (
                <AIAssistantHeader
                    templates={PROJECT_TEMPLATES}
                    onSelectTemplate={handleSelectTemplate}
                    onAutoGenerate={handleAutoGenerate}
                    isGenerating={isGenerating}
                    title="Assistant Projet"
                    description="Démarrez votre projet avec un modèle standard ou généré par l'IA."
                />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="manager"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Responsable"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    options={availableUsers.map(u => ({ value: u, label: u }))}
                                    placeholder="Sélectionner..."
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
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                                />
                            )}
                        />
                    </div>
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
                    className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none font-bold text-sm"
                >
                    {existingProject ? 'Enregistrer' : 'Créer le Projet'}
                </Button>
            </div>
        </form>
    );
};
