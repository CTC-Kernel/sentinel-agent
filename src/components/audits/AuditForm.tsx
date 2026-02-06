import React, { useEffect } from 'react';
import { Controller, useWatch, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { AddToCalendar } from '../ui/AddToCalendar';
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
import { toast } from '@/lib/toast';

import { useStore } from '../../store';

interface AuditTemplate extends BaseTemplate {
 type: string;
 standard: string;
 scope: string
}
import { AUDIT_TYPES } from '../../data/auditConstants';
import { RichTextEditor } from '../ui/RichTextEditor';
import { DatePicker } from '../ui/DatePicker';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

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
 readOnly?: boolean;
 onDirtyChange?: (isDirty: boolean) => void;
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
 isLoading = false,
 readOnly = false,
 onDirtyChange
}) => {
 const { t } = useStore();

 // Dynamic templates using translations
 const auditTemplates: AuditTemplate[] = [
 { name: 'Audit Interne ISO 27001', description: t('audits.form.templates.internal', { defaultValue: 'Vérification de conformité annuelle sur le périmètre complet.' }), type: 'Interne', standard: 'ISO 27001', scope: 'Organisation Globale' },
 { name: 'Audit Fournisseur Critique', description: t('audits.form.templates.supplier', { defaultValue: 'Évaluation de sécurité d\'un hébergeur de données de santé.' }), type: 'Externe', standard: 'HDS / ISO 27001', scope: 'Fournisseurs' },
 { name: 'Review Accès Logiques', description: t('audits.form.templates.access', { defaultValue: 'Revue trimestrielle des comptes à privilèges.' }), type: 'Interne', standard: 'Interne', scope: 'IT / IAM' },
 ];

 const { register, handleSubmit, reset, control, setValue, getValues, watch, formState: { errors, isDirty } } = useZodForm<typeof auditSchema>({
 schema: auditSchema,
 mode: 'onChange',
 shouldUnregister: false,
 defaultValues: {
 // ...
 }
 });

 useEffect(() => {
 onDirtyChange?.(isDirty);
 }, [isDirty, onDirtyChange]);

 // Persistence Hook
 const { clearDraft } = useFormPersistence<AuditFormData>('sentinel_audit_draft_new', {
 watch,
 reset
 }, {
 enabled: !existingAudit && !initialData
 });

 const onInvalid = (errors: FieldErrors<AuditFormData>) => {
 const missingFields = Object.keys(errors).join(', ');
 toast.error(t('common.formInvalid', { defaultValue: 'Formulaire invalide. Champs en erreur' }) + ` : ${missingFields}`);
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

 // Accessibility: Handle Escape key to close modal
 useEffect(() => {
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && !isLoading) {
 onCancel();
 }
 };
 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }, [isLoading, onCancel]);

 const [isGenerating, setIsGenerating] = React.useState(false);

 const handleSelectTemplate = (templateName: string) => {
 const t = auditTemplates.find(t => t.name === templateName);
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
 const prompt = t('audits.form.auditAssistant.prompt', { name: currentName }) + `
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
 <form
 onSubmit={(e) => {
 e.preventDefault();
 handleSubmit((data) => {
  onSubmit(data);
  clearDraft();
 }, onInvalid)(e);
 }}
 className="space-y-6 p-4 sm:p-6"
 >
 {!isEditing && !readOnly && (
 <AIAssistantHeader
  templates={auditTemplates}
  onSelectTemplate={handleSelectTemplate}
  onAutoGenerate={handleAutoGenerate}
  isGenerating={isGenerating}
  title={t('audits.form.auditAssistant.title')}
  description={t('audits.form.auditAssistant.desc')}
 />
 )}
 <div className="glass-premium p-6 rounded-4xl border border-border/40 shadow-sm relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
 <div className="relative z-10 space-y-6">
  <FloatingLabelInput
  label={t('audits.form.name')}
  {...register('name')}
  placeholder={t('audits.form.namePlaceholder')}
  error={errors.name?.message}
  disabled={readOnly}
  />

  <div className="space-y-2">
  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('audits.form.description')}</label>
  <textarea
  {...register('description')}
  rows={3}
  disabled={readOnly}
  className="w-full px-4 py-3.5 glass-input border border-border/40 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary focus:border-primary/60 outline-none transition-all resize-none text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed shadow-sm"
  placeholder={t('audits.form.descriptionPlaceholder')}
  />
  {errors.description && <span className="text-red-500 text-sm">{errors.description.message}</span>}
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <Controller
  name="type"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('audits.form.typeLabel')}
   value={field.value}
   onChange={field.onChange}
   options={AUDIT_TYPES.map(t => ({ value: t, label: t }))}
   error={errors.type?.message}
   disabled={readOnly}
  />
  )}
  />

  <div className="md:col-span-2">
  <Controller
  name="framework"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('audits.form.framework')}
   value={field.value || ''}
   onChange={(val) => field.onChange(val as Framework)}
   options={FRAMEWORK_OPTIONS}
   error={errors.framework?.message}
   disabled={readOnly}
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
   label={t('audits.form.dateScheduled')}
   value={field.value}
   onChange={field.onChange}
   error={errors.dateScheduled?.message}
   disabled={readOnly}
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
  label={t('audits.form.auditor')}
  value={field.value || ''}
  onChange={field.onChange}
  options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
  placeholder={t('audits.form.auditorPlaceholder')}
  error={errors.auditor?.message}
  disabled={readOnly}
  />
  )}
  />

  <Controller
  name="scope"
  control={control}
  render={({ field }) => (
  <RichTextEditor
  label={t('audits.form.scope')}
  value={field.value || ''}
  onChange={field.onChange}
  error={errors.scope?.message}
  readOnly={readOnly}
  />
  )}
  />

  <div className="space-y-4">
  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('audits.form.scopeLabel')}</label>
  <Controller
  name="relatedAssetIds"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('audits.form.assets')}
   value={field.value || []}
   onChange={field.onChange}
   options={assets.map(a => ({ value: a.id, label: a.name }))}
   multiple
   error={errors.relatedAssetIds?.message}
   disabled={readOnly}
  />
  )}
  />
  <Controller
  name="relatedControlIds"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('audits.form.controls')}
   value={field.value || []}
   onChange={field.onChange}
   options={controls.map(c => ({ value: c.id, label: c.code, subLabel: c.name }))}
   multiple
   error={errors.relatedControlIds?.message}
   disabled={readOnly}
  />
  )}
  />
  <Controller
  name="relatedRiskIds"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('audits.form.risks')}
   value={field.value || []}
   onChange={field.onChange}
   options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score} ` }))}
   multiple
   error={errors.relatedRiskIds?.message}
   disabled={readOnly}
  />
  )}
  />
  <Controller
  name="relatedProjectIds"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('audits.form.projects')}
   value={field.value || []}
   onChange={field.onChange}
   options={projects.map(p => ({ value: p.id, label: p.name }))}
   multiple
   error={errors.relatedProjectIds?.message}
   disabled={readOnly}
  />
  )}
  />
  </div>
 </div>
 </div>

 {!readOnly && (
 <div className="flex justify-end space-x-4 pt-6 border-t border-border/40 dark:border-white/5">
  <Button
  type="button"
  onClick={onCancel}
  variant="ghost"
  disabled={isLoading}
  className="px-6 py-3 text-sm font-bold text-muted-foreground hover:bg-muted rounded-3xl transition-colors"
  >
  {t('audits.form.cancel')}
  </Button>
  <Button
  type="submit"
  isLoading={isLoading}
  className="px-8 py-3 text-sm font-bold text-white bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-700 rounded-3xl hover:scale-105 transition-transform shadow-lg shadow-primary/20"
  >
  {existingAudit ? t('audits.form.save') : t('audits.form.plan')}
  </Button>
 </div>
 )}
 </form>
 );
};
