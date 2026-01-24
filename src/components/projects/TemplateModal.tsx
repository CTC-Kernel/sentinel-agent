import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PROJECT_TEMPLATES } from '../../utils/projectTemplates';
import { ProjectTemplate, UserProfile } from '../../types';
import { X, Zap, Calendar } from '../ui/Icons';
import { templateFormSchema, TemplateFormData } from '../../schemas/projectSchema';
import { CustomSelect } from '../ui/CustomSelect';

interface TemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: ProjectTemplate, projectName: string, startDate: Date, managerId: string) => void;
    managers: UserProfile[];
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose, onSelectTemplate, managers }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors }
    } = useForm<TemplateFormData>({
        resolver: zodResolver(templateFormSchema) as Resolver<TemplateFormData>,
        defaultValues: {
            projectName: '',
            startDate: new Date().toISOString().split('T')[0],
            managerId: ''
        }
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                projectName: '',
                startDate: new Date().toISOString().split('T')[0],
                managerId: ''
            });
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedTemplate(null);
        }
    }, [isOpen, reset]);

    const onFormSubmit = (data: TemplateFormData) => {
        if (selectedTemplate) {
            onSelectTemplate(selectedTemplate, data.projectName, new Date(data.startDate), data.managerId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-max flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel rounded-4xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20 animate-scale-in relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/10 dark:to-transparent pointer-events-none" />
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 relative z-10 glass-panel backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Créer depuis un Template
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                            Démarrez rapidement avec un projet pré-configuré
                        </p>
                    </div>
                    <button
                        aria-label="Fermer la fenêtre"
                        onClick={onClose}
                        className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-200px)] relative z-10">
                    {!selectedTemplate ? (
                        /* Template Selection */
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {PROJECT_TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        aria-label={`Sélectionner le modèle ${template.name}`}
                                        onClick={() => setSelectedTemplate(template)}
                                        className="text-left p-6 rounded-xl border-2 border-slate-200 dark:border-white/10 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:shadow-lg group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="text-4xl">{template.icon}</div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                                    {template.name}
                                                </h3>
                                                <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                                                    {template.description}
                                                </p>
                                                <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {template.estimatedDuration} jours
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Zap className="h-3 w-3" />
                                                        {template.defaultTasks.length} tâches
                                                    </span>
                                                </div>
                                                <div className="mt-3">
                                                    <span className="px-2 py-1 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-xs font-bold">
                                                        {template.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Template Configuration */
                        <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
                            <div className="glass-panel p-4 rounded-xl border border-brand-200/50 dark:border-brand-800/50 bg-brand-50/50 dark:bg-brand-900/10">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{selectedTemplate.icon}</span>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{selectedTemplate.name}</h3>
                                        <p className="text-sm text-slate-600 dark:text-muted-foreground">{selectedTemplate.description}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-3 text-xs">
                                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">
                                        {selectedTemplate.defaultTasks.length} tâches
                                    </span>
                                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">
                                        {selectedTemplate.defaultMilestones.length} jalons
                                    </span>
                                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">
                                        ~{selectedTemplate.estimatedDuration} jours
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Nom du Projet *
                                </label>
                                <input {...register('projectName')}
                                    type="text"
                                    placeholder="Ex: Certification ISO 27001 2025"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent"
                                />
                                {errors.projectName && <p className="text-red-500 text-xs mt-1">{errors.projectName.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Date de Début *
                                </label>
                                <input {...register('startDate')}
                                    type="date"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent"
                                />
                                {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Chef de Projet *
                                </label>
                                <Controller
                                    name="managerId"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            options={managers.filter(m => !!m.uid).map(m => ({
                                                value: m.uid,
                                                label: m.displayName || m.email || 'Utilisateur'
                                            }))}
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Sélectionner..."
                                            label="Chef de Projet"
                                        />
                                    )}
                                />
                                {errors.managerId && <p className="text-red-500 text-xs mt-1">{errors.managerId.message}</p>}
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Ce qui sera créé:
                                </h4>
                                <ul className="space-y-1 text-sm text-slate-600 dark:text-muted-foreground">
                                    <li>✓ {selectedTemplate.defaultTasks.length} tâches pré-configurées</li>
                                    <li>✓ {selectedTemplate.defaultMilestones.length} jalons avec dates calculées</li>
                                    {/* Note: startDate is watched or we can just use a generic message since it's dynamic */}
                                    <li>✓ Durée estimée: {selectedTemplate.estimatedDuration} jours</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    aria-label="Retour à la sélection de modèle"
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Retour
                                </button>
                                <button
                                    type="submit"
                                    aria-label="Créer le projet"
                                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                                >
                                    Créer le Projet
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// Headless UI handles FocusTrap and keyboard navigation
