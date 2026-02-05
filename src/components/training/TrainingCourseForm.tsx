/**
 * TrainingCourseForm Component
 *
 * Form for creating and editing training courses.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingCourseForm
 */

import React, { useCallback, useMemo } from 'react';
import { Controller, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { trainingCourseSchema, TrainingCourseFormData } from '../../schemas/trainingSchema';
import type { TrainingCourse, TrainingCategory, TrainingSource, TrainingContentType } from '../../types/training';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { RichTextEditor } from '../ui/RichTextEditor';
import {
 Shield,
 Award,
 Users,
 FileText,
 PlayCircle,
 HelpCircle,
 ExternalLink,
 Info,
} from '../ui/Icons';
import { useStore } from '../../store';
import { toast } from '@/lib/toast';
import { motion } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

// ============================================================================
// Types
// ============================================================================

interface TrainingCourseFormProps {
 onSubmit: (data: TrainingCourseFormData) => Promise<void>;
 onCancel: () => void;
 initialData?: TrainingCourse | null;
 isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_OPTIONS: { value: TrainingCategory; label: string; icon: React.ElementType }[] = [
 { value: 'security', label: 'training.categories.security', icon: Shield },
 { value: 'compliance', label: 'training.categories.compliance', icon: Award },
 { value: 'awareness', label: 'training.categories.awareness', icon: Users },
 { value: 'technical', label: 'training.categories.technical', icon: FileText },
];

const SOURCE_OPTIONS: { value: TrainingSource; label: string }[] = [
 { value: 'anssi', label: 'training.sources.anssi' },
 { value: 'cnil', label: 'training.sources.cnil' },
 { value: 'internal', label: 'training.sources.internal' },
 { value: 'external', label: 'training.sources.external' },
];

const CONTENT_TYPE_OPTIONS: { value: TrainingContentType; label: string; icon: React.ElementType }[] = [
 { value: 'video', label: 'training.contentTypes.video', icon: PlayCircle },
 { value: 'document', label: 'training.contentTypes.document', icon: FileText },
 { value: 'quiz', label: 'training.contentTypes.quiz', icon: HelpCircle },
 { value: 'external_link', label: 'training.contentTypes.external_link', icon: ExternalLink },
];

const TARGET_ROLE_OPTIONS = [
 { value: 'all', label: 'training.roles.all' },
 { value: 'executives', label: 'training.roles.executives' },
 { value: 'managers', label: 'training.roles.managers' },
 { value: 'it_staff', label: 'training.roles.it_staff' },
 { value: 'developers', label: 'training.roles.developers' },
 { value: 'security_team', label: 'training.roles.security_team' },
 { value: 'hr', label: 'training.roles.hr' },
 { value: 'finance', label: 'training.roles.finance' },
 { value: 'operations', label: 'training.roles.operations' },
 { value: 'new_employees', label: 'training.roles.new_employees' },
];

// ============================================================================
// Component
// ============================================================================

export const TrainingCourseForm: React.FC<TrainingCourseFormProps> = ({
 onSubmit,
 onCancel,
 initialData,
 isLoading = false,
}) => {
 const { t } = useStore();

 // Convert initialData to form default values
 const defaultValues = useMemo((): TrainingCourseFormData => ({
 title: initialData?.title || '',
 description: initialData?.description || '',
 category: initialData?.category || 'awareness',
 source: initialData?.source || 'internal',
 duration: initialData?.duration || 30,
 isRequired: initialData?.isRequired || false,
 targetRoles: initialData?.targetRoles || [],
 frameworkMappings: {
 nis2: initialData?.frameworkMappings?.nis2 || [],
 iso27001: initialData?.frameworkMappings?.iso27001 || [],
 dora: initialData?.frameworkMappings?.dora || [],
 rgpd: initialData?.frameworkMappings?.rgpd || [],
 },
 content: {
 type: initialData?.content?.type || 'document',
 url: initialData?.content?.url || '',
 quizId: initialData?.content?.quizId || undefined,
 },
 }), [initialData]);

 const {
 register,
 handleSubmit,
 control,
 setValue,
 watch,
 formState: { errors },
 } = useZodForm<typeof trainingCourseSchema>({
 schema: trainingCourseSchema,
 mode: 'onChange',
 defaultValues,
 });

 // Watched values
 const contentType = watch('content.type');
 const isRequired = watch('isRequired');
 const category = watch('category');
 const source = watch('source');

 // Error handler
 const onInvalid = useCallback((errs: FieldErrors<TrainingCourseFormData>) => {
 const missingFields = Object.keys(errs).join(', ');
 toast.error(`${t('validation.formInvalid')}: ${missingFields}`);
 }, [t]);

 // Form submission
 const onFormSubmit = useCallback(async (data: TrainingCourseFormData) => {
 await onSubmit(data);
 }, [onSubmit]);

 // Get selected frameworks for display
 const selectedFrameworks = useMemo(() => {
 const frameworks: string[] = [];
 const mappings = watch('frameworkMappings');
 if (mappings?.nis2?.length) frameworks.push('nis2');
 if (mappings?.iso27001?.length) frameworks.push('iso27001');
 if (mappings?.dora?.length) frameworks.push('dora');
 if (mappings?.rgpd?.length) frameworks.push('rgpd');
 return frameworks;
 }, [watch]);

 return (
 <motion.form
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3, ease: appleEasing }}
 onSubmit={handleSubmit(onFormSubmit, onInvalid)}
 className="space-y-8"
 >
 {/* Basic Information Section */}
 <section className="space-y-6">
 <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
 {t('training.form.basicInfo')}
 </h3>

 <FloatingLabelInput
 label={t('training.course.title')}
 {...register('title')}
 error={errors.title?.message}
 placeholder={t('training.form.titlePlaceholder')}
 />

 <Controller
 control={control}
 name="description"
 render={({ field }) => (
 <RichTextEditor
 label={t('training.course.description')}
 value={field.value || ''}
 onChange={field.onChange}
 error={errors.description?.message}
 />
 )}
 />

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <CustomSelect
 label={t('training.course.category')}
 options={CATEGORY_OPTIONS.map((opt) => ({
 value: opt.value,
 label: t(opt.label),
 }))}
 value={category || 'awareness'}
 onChange={(val) => setValue('category', val as TrainingCategory)}
 error={errors.category?.message}
 />

 <CustomSelect
 label={t('training.course.source')}
 options={SOURCE_OPTIONS.map((opt) => ({
 value: opt.value,
 label: t(opt.label),
 }))}
 value={source || 'internal'}
 onChange={(val) => setValue('source', val as TrainingSource)}
 error={errors.source?.message}
 />
 </div>

 <FloatingLabelInput
 label={t('training.course.duration')}
 type="number"
 {...register('duration', { valueAsNumber: true })}
 error={errors.duration?.message}
 min={1}
 max={480}
 />

 {/* Required Toggle */}
 <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-muted">
 <Controller
 control={control}
 name="isRequired"
 render={({ field }) => (
 <label htmlFor="isRequired-checkbox" className="flex items-center gap-3 cursor-pointer flex-1">
 <input
  id="isRequired-checkbox"
  type="checkbox"
  checked={field.value || false}
  onChange={(e) => field.onChange(e.target.checked)}
  className="w-5 h-5 rounded-lg border-muted text-primary focus:ring-primary/20"
  aria-label={t('training.course.isRequired')}
 />
 <div>
  <span className="text-sm font-semibold text-foreground">
  {t('training.course.isRequired')}
  </span>
  <p className="text-xs text-muted-foreground">
  {t('training.form.requiredHint')}
  </p>
 </div>
 </label>
 )}
 />
 {isRequired && (
 <motion.div
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 className="px-3 py-1 rounded-full bg-error-bg text-error-text text-xs font-bold uppercase"
 >
 {t('common.required')}
 </motion.div>
 )}
 </div>
 </section>

 {/* Target Roles Section */}
 <section className="space-y-6">
 <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
 {t('training.course.targetRoles')}
 </h3>

 <Controller
 control={control}
 name="targetRoles"
 render={({ field }) => (
 <CustomSelect
 label={t('training.form.selectRoles')}
 options={TARGET_ROLE_OPTIONS.map((opt) => ({
 value: opt.value,
 label: t(opt.label),
 }))}
 value={field.value || []}
 onChange={field.onChange}
 multiple
 error={errors.targetRoles?.message}
 />
 )}
 />

 <div className="flex items-start gap-2 p-3 rounded-3xl bg-info-bg/50 border border-info-border/30">
 <Info className="w-4 h-4 text-info-text mt-0.5 shrink-0" />
 <p className="text-xs text-info-text">
 {t('training.form.rolesHint')}
 </p>
 </div>
 </section>

 {/* Content Section */}
 <section className="space-y-6">
 <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
 {t('training.form.content')}
 </h3>

 <CustomSelect
 label={t('training.form.contentType')}
 options={CONTENT_TYPE_OPTIONS.map((opt) => ({
 value: opt.value,
 label: t(opt.label),
 }))}
 value={contentType || 'document'}
 onChange={(val) => setValue('content.type', val as TrainingContentType)}
 error={errors.content?.type?.message}
 />

 {contentType === 'quiz' ? (
 <FloatingLabelInput
 label={t('training.form.quizId')}
 {...register('content.quizId')}
 error={errors.content?.quizId?.message}
 placeholder="quiz-uuid-here"
 />
 ) : (
 <FloatingLabelInput
 label={contentType === 'external_link' ? t('training.form.externalUrl') : t('training.form.contentUrl')}
 {...register('content.url')}
 error={errors.content?.url?.message}
 placeholder={
 contentType === 'video'
 ? 'https://example.com/video.mp4'
 : contentType === 'document'
  ? 'https://example.com/document.pdf'
  : 'https://example.com/external-training'
 }
 />
 )}
 </section>

 {/* Framework Mappings Section */}
 <section className="space-y-6">
 <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
 {t('training.form.frameworkMappings')}
 </h3>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <Controller
 control={control}
 name="frameworkMappings.nis2"
 render={({ field }) => (
 <FloatingLabelInput
 label="NIS2"
 value={(field.value || []).join(', ')}
 onChange={(e) => {
  const values = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
  field.onChange(values);
 }}
 placeholder="21.2(g), 21.2(h)"
 />
 )}
 />

 <Controller
 control={control}
 name="frameworkMappings.iso27001"
 render={({ field }) => (
 <FloatingLabelInput
 label="ISO 27001"
 value={(field.value || []).join(', ')}
 onChange={(e) => {
  const values = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
  field.onChange(values);
 }}
 placeholder="A.7.2.2, A.7.3.1"
 />
 )}
 />

 <Controller
 control={control}
 name="frameworkMappings.dora"
 render={({ field }) => (
 <FloatingLabelInput
 label="DORA"
 value={(field.value || []).join(', ')}
 onChange={(e) => {
  const values = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
  field.onChange(values);
 }}
 placeholder="Art. 13, Art. 16"
 />
 )}
 />

 <Controller
 control={control}
 name="frameworkMappings.rgpd"
 render={({ field }) => (
 <FloatingLabelInput
 label="RGPD"
 value={(field.value || []).join(', ')}
 onChange={(e) => {
  const values = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
  field.onChange(values);
 }}
 placeholder="Art. 32, Art. 39"
 />
 )}
 />
 </div>

 {selectedFrameworks.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {selectedFrameworks.map((fw) => (
 <span
 key={fw || 'unknown'}
 className="px-2 py-1 rounded-lg text-xs font-bold uppercase bg-primary/10 text-primary border border-primary/20"
 >
 {fw.toUpperCase()}
 </span>
 ))}
 </div>
 )}
 </section>

 {/* Actions */}
 <div className="flex justify-end gap-4 pt-6 border-t border-muted">
 <Button type="button" variant="ghost" onClick={onCancel}>
 {t('common.cancel')}
 </Button>
 <Button
 type="submit"
 isLoading={isLoading}
 className="px-8 shadow-sm shadow-primary"
 >
 {initialData ? t('common.save') : t('training.course.create')}
 </Button>
 </div>
 </motion.form>
 );
};

TrainingCourseForm.displayName = 'TrainingCourseForm';
