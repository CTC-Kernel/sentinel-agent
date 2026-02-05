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
 <div className="fixed inset-0 z-max flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] animate-fade-in">
 <div className="glass-premium rounded-4xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-border/40 animate-scale-in relative">
 <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/10 dark:to-transparent pointer-events-none" />
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border/60 relative z-10 glass-premium backdrop-blur-md">
  <div>
  <h2 className="text-2xl font-bold text-foreground">
  Créer depuis un Template
  </h2>
  <p className="text-sm text-muted-foreground mt-1">
  Démarrez rapidement avec un projet pré-configuré
  </p>
  </div>
  <button
  aria-label="Fermer la fenêtre"
  onClick={onClose}
  className="p-2.5 hover:bg-muted rounded-3xl transition-colors"
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
   key={template.id || 'unknown'}
   aria-label={`Sélectionner le modèle ${template.name}`}
   onClick={() => setSelectedTemplate(template)}
   className="text-left p-6 rounded-3xl border-2 border-border/40 hover:border-primary dark:hover:border-primary transition-all hover:shadow-lg group"
   >
   <div className="flex items-start gap-4">
   <div className="text-4xl">{template.icon}</div>
   <div className="flex-1">
   <h3 className="font-bold text-lg text-foreground group-hover:text-primary dark:group-hover:text-primary/70 transition-colors">
    {template.name}
   </h3>
   <p className="text-sm text-muted-foreground mt-1">
    {template.description}
   </p>
   <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
    <span className="px-2 py-1 bg-primary/15 dark:bg-primary text-primary dark:text-primary/70 rounded-lg text-xs font-bold">
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
  <div className="glass-premium p-4 rounded-3xl border border-primary/30 dark:border-primary/80 bg-primary/10">
  <div className="flex items-center gap-3">
   <span className="text-3xl">{selectedTemplate.icon}</span>
   <div>
   <h3 className="font-bold text-foreground">{selectedTemplate.name}</h3>
   <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
   </div>
  </div>
  <div className="mt-3 flex gap-3 text-xs">
   <span className="px-2 py-1 bg-card rounded-lg font-bold">
   {selectedTemplate.defaultTasks.length} tâches
   </span>
   <span className="px-2 py-1 bg-card rounded-lg font-bold">
   {selectedTemplate.defaultMilestones.length} jalons
   </span>
   <span className="px-2 py-1 bg-card rounded-lg font-bold">
   ~{selectedTemplate.estimatedDuration} jours
   </span>
  </div>
  </div>

  <div>
  <label htmlFor="project-name" className="block text-sm font-bold text-foreground mb-2">
   Nom du Projet *
  </label>
  <input
   id="project-name"
   {...register('projectName')}
   type="text"
   placeholder="Ex: Certification ISO 27001 2025"
   className="w-full px-4 py-2 bg-muted border border-border/40 rounded-3xl focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  />
  {errors.projectName && <p className="text-red-500 text-xs mt-1">{errors.projectName.message}</p>}
  </div>

  <div>
  <label htmlFor="start-date" className="block text-sm font-bold text-foreground mb-2">
   Date de Début *
  </label>
  <input
   id="start-date"
   {...register('startDate')}
   type="date"
   className="w-full px-4 py-2 bg-muted border border-border/40 rounded-3xl focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  />
  {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
  </div>

  <div>
  <label htmlFor="manager-id" className="block text-sm font-bold text-foreground mb-2">
   Chef de Projet *
  </label>
  <Controller
   name="managerId"
   control={control}
   render={({ field }) => (
   <CustomSelect
   id="manager-id"
   options={managers.filter(m => !!m.uid).map(m => ({
   value: m.uid,
   label: m.displayName || m.email || 'Utilisateur'
   }))}
   value={field.value}
   onChange={field.onChange}
   placeholder="Sélectionner..."
   />
   )}
  />
  {errors.managerId && <p className="text-red-500 text-xs mt-1">{errors.managerId.message}</p>}
  </div>

  <div className="bg-muted p-4 rounded-3xl">
  <h4 className="text-sm font-bold text-foreground mb-2">
   Ce qui sera créé:
  </h4>
  <ul className="space-y-1 text-sm text-muted-foreground">
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
   className="flex-1 px-4 py-2 bg-muted text-foreground rounded-3xl font-bold hover:bg-muted transition-colors"
  >
   Retour
  </button>
  <button
   type="submit"
   aria-label="Créer le projet"
   className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-3xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
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
