import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Drawer } from '../ui/Drawer';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { useSupplierDependencies } from '../../hooks/suppliers/useSupplierDependencies';
import { Supplier } from '../../types';
import { AlertCircle, FileText, Play, Clock, CheckCircle, ListTodo } from '../ui/Icons';
import { toast } from '@/lib/toast';
import { VendorAssessmentService } from '../../services/VendorAssessmentService';
import { ErrorLogger } from '../../services/errorLogger';
import {
 ReviewCycle,
 TemplatePreview,
 getReviewCycleLabel,
} from '../../types/vendorAssessment';
import {
 QUESTIONNAIRE_TEMPLATES,
 getTemplateById,
 getFrameworkColor,
} from '../../data/questionnaireTemplates';
import { useTranslation } from 'react-i18next';

interface Props {
 isOpen: boolean;
 onClose: () => void;
 supplier: Supplier;
 onAssessmentCreated: (assessmentId: string) => void;
}

// Review cycle options
const REVIEW_CYCLE_OPTIONS: { value: ReviewCycle | ''; label: string }[] = [
 { value: '', label: 'No scheduled review' },
 { value: 'quarterly', label: 'Quarterly (3 months)' },
 { value: 'bi-annual', label: 'Bi-annual (6 months)' },
 { value: 'annual', label: 'Annual (12 months)' },
 { value: 'custom', label: 'Custom period' },
];

export const SupplierAssessmentDrawer: React.FC<Props> = ({
 isOpen,
 onClose,
 supplier,
 onAssessmentCreated,
}) => {
 const { t } = useTranslation();
 const { user } = useStore();
 const { templates, loading } = useSupplierDependencies({ fetchTemplates: true });

 const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
 const [dueDate, setDueDate] = useState<string | undefined>();
 const [reviewCycle, setReviewCycle] = useState<ReviewCycle | ''>('');
 const [customReviewDays, setCustomReviewDays] = useState<number>(180);
 const [respondentEmail, setRespondentEmail] = useState<string>(supplier.contactEmail || '');
 const [isSubmitting, setIsSubmitting] = useState(false);

 // Compute dirty state
 const isDirty = useMemo(() => {
 return (
 selectedTemplateId !== '' ||
 dueDate !== undefined ||
 reviewCycle !== '' ||
 respondentEmail !== (supplier.contactEmail || '')
 );
 }, [selectedTemplateId, dueDate, reviewCycle, respondentEmail, supplier.contactEmail]);

 // Get template preview
 const selectedTemplatePreview = useMemo<TemplatePreview | null>(() => {
 if (!selectedTemplateId) return null;
 const template = getTemplateById(selectedTemplateId);
 if (template) {
 return {
 metadata: {
 ...template.metadata,
 applicableServiceTypes: template.metadata.applicableTo || [],
 },
 sections: template.sections.map((s) => ({
 id: s.id,
 title: s.title,
 description: s.description,
 questionCount: s.questions.length,
 weight: s.weight,
 })),
 };
 }
 // Fallback to Firestore templates
 const fsTemplate = templates.find((t) => t.id === selectedTemplateId);
 if (fsTemplate) {
 return {
 metadata: {
 id: fsTemplate.id,
 title: fsTemplate.title,
 description: fsTemplate.description,
 framework: 'Custom',
 version: '1.0',
 sectionCount: fsTemplate.sections.length,
 questionCount: fsTemplate.sections.reduce((sum, s) => sum + s.questions.length, 0),
 estimatedDuration: `${Math.ceil(
 fsTemplate.sections.reduce((sum, s) => sum + s.questions.length, 0) * 2
 )} min`,
 applicableServiceTypes: [],
 },
 sections: fsTemplate.sections.map((s) => ({
 id: s.id,
 title: s.title,
 description: s.description,
 questionCount: s.questions.length,
 weight: s.weight,
 })),
 };
 }
 return null;
 }, [selectedTemplateId, templates]);

 // Combined template options (predefined + Firestore)
 const templateOptions = useMemo(() => {
 const predefinedOptions = QUESTIONNAIRE_TEMPLATES.map((t) => ({
 value: t.metadata.id,
 label: `${t.metadata.title} (${t.metadata.framework})`,
 }));

 const firestoreOptions = templates
 .filter((t) => !QUESTIONNAIRE_TEMPLATES.some((p) => p.metadata.id === t.id))
 .map((t) => ({
 value: t.id,
 label: t.title,
 }));

 return [
 { value: '', label: t('vendorAssessment.selectTemplate', 'Select a template...') },
 ...predefinedOptions,
 ...firestoreOptions,
 ];
 }, [templates, t]);

 // Seed default templates on first load
 useEffect(() => {
 const seedTemplates = async () => {
 if (!loading && user?.organizationId) {
 try {
 await VendorAssessmentService.seedDefaultTemplates(user.organizationId, user.uid);
 } catch {
 // Non-blocking - templates can be used without seeding
 ErrorLogger.warn('Failed to seed templates', 'SupplierAssessmentDrawer');
 }
 }
 };
 if (isOpen) {
 seedTemplates();
 }
 }, [isOpen, loading, user]);

 // Reset form when drawer opens
 useEffect(() => {
 if (isOpen) {
 setSelectedTemplateId('');
 setDueDate(undefined);
 setReviewCycle('');
 setRespondentEmail(supplier.contactEmail || '');
 }
 }, [isOpen, supplier.contactEmail]);

 const handleCreate = async () => {
 if (!selectedTemplateId || !user?.organizationId) return;

 setIsSubmitting(true);
 try {
 // Calculate expiration date (same as due date or 30 days after due date)
 const expirationDate = dueDate
 ? new Date(new Date(dueDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
 : undefined;

 const assessmentId = await VendorAssessmentService.createAssessment(user.organizationId, {
 supplierId: supplier.id,
 supplierName: supplier.name,
 templateId: selectedTemplateId,
 framework: selectedTemplatePreview?.metadata.framework,
 dueDate,
 expirationDate,
 reviewCycle: reviewCycle || undefined,
 customReviewPeriodDays: reviewCycle === 'custom' ? customReviewDays : undefined,
 respondentEmail: respondentEmail || undefined,
 }, user ? { uid: user.uid, email: user.email, displayName: user.displayName } : undefined);

 toast.success(t('vendorAssessment.assessmentCreated', 'Assessment created successfully'));
 onAssessmentCreated(assessmentId);
 onClose();
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'SupplierAssessmentDrawer.handleCreate');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleClose = () => {
 onClose();
 };

 return (
 <Drawer
 isOpen={isOpen}
 onClose={handleClose}
 hasUnsavedChanges={isDirty}
 title={
 <div className="flex items-center gap-3">
 <div className="p-2 bg-muted rounded-lg text-muted-foreground shadow-sm border border-border/40 dark:border-white/5">
 <FileText className="w-5 h-5" />
 </div>
 <span>{t('vendorAssessment.newAssessment', 'New Vendor Assessment')}</span>
 </div>
 }
 subtitle={t('vendorAssessment.evaluating', 'Evaluating {{name}}', { name: supplier.name })}
 width="max-w-2xl"
 >
 <div className="flex flex-col h-full pt-6 px-1">
 <div className="space-y-6 flex-1 overflow-y-auto">
 {/* Info Banner */}
 <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-3xl border border-blue-100 dark:border-blue-800 flex gap-3">
 <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
 <div className="text-sm text-blue-800 dark:text-blue-300">
 <p className="font-semibold mb-1">
 {t('vendorAssessment.thirdPartyRisk', 'Third-Party Risk Assessment')}
 </p>
 {t(
 'vendorAssessment.assessmentDescription',
 'This assessment calculates the vendor security score and ensures compliance with regulatory requirements (DORA, ISO 27001, NIS2, HDS).'
 )}
 </div>
 </div>

 {/* Template Selection */}
 <div className="space-y-3">
 {loading ? (
 <div className="h-14 bg-muted rounded-3xl animate-pulse" />
 ) : (
 <CustomSelect
 label={t('vendorAssessment.questionnaireTemplate', 'Questionnaire Template')}
 options={templateOptions}
 value={selectedTemplateId}
 onChange={(val) => setSelectedTemplateId(val as string)}
 placeholder={t('vendorAssessment.selectTemplate', 'Select a template...')}
 />
 )}
 </div>

 {/* Template Preview */}
 {selectedTemplatePreview && (
 <div className="bg-muted/50 rounded-3xl border border-border/40 overflow-hidden">
 {/* Preview Header */}
 <div className="p-4 border-b border-border/40">
 <div className="flex items-start justify-between">
  <div>
  <h4 className="font-semibold text-foreground">
  {selectedTemplatePreview.metadata.title}
  </h4>
  <p className="text-sm text-muted-foreground mt-1">
  {selectedTemplatePreview.metadata.description}
  </p>
  </div>
  <span
  className={`px-2.5 py-1 text-xs font-medium rounded-lg ${getFrameworkColor(
  selectedTemplatePreview.metadata.framework
  )}`}
  >
  {selectedTemplatePreview.metadata.framework}
  </span>
 </div>

 {/* Stats */}
 <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
  <div className="flex items-center gap-1.5">
  <ListTodo className="w-4 h-4" />
  <span>
  {selectedTemplatePreview.metadata.sectionCount}{' '}
  {t('vendorAssessment.sections', 'sections')}
  </span>
  </div>
  <div className="flex items-center gap-1.5">
  <CheckCircle className="w-4 h-4" />
  <span>
  {selectedTemplatePreview.metadata.questionCount}{' '}
  {t('vendorAssessment.questions', 'questions')}
  </span>
  </div>
  <div className="flex items-center gap-1.5">
  <Clock className="w-4 h-4" />
  <span>{selectedTemplatePreview.metadata.estimatedDuration}</span>
  </div>
 </div>
 </div>

 {/* Section List */}
 <div className="p-4 space-y-2">
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
  {t('vendorAssessment.sectionsPreview', 'Sections')}
 </p>
 {selectedTemplatePreview.sections.map((section, idx) => (
  <div
  key={section.id || 'unknown'}
  className="flex items-center justify-between p-2.5 glass-premium rounded-lg border border-border/40 dark:border-white/5"
  >
  <div className="flex items-center gap-3">
  <span className="w-6 h-6 flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground rounded-full">
  {idx + 1}
  </span>
  <span className="text-sm text-foreground text-muted-foreground">
  {section.title}
  </span>
  </div>
  <div className="flex items-center gap-3 text-xs text-muted-foreground">
  <span>
  {section.questionCount} {t('vendorAssessment.q', 'Q')}
  </span>
  <span className="text-muted-foreground">|</span>
  <span>
  {section.weight}% {t('vendorAssessment.weight', 'weight')}
  </span>
  </div>
  </div>
 ))}
 </div>
 </div>
 )}

 {/* Due Date */}
 <DatePicker
 label={t('vendorAssessment.dueDate', 'Due Date')}
 value={dueDate}
 onChange={setDueDate}
 placeholder={t('vendorAssessment.selectDueDate', 'Select due date...')}
 />

 {/* Review Cycle */}
 <CustomSelect
 label={t('vendorAssessment.reviewCycle', 'Review Cycle')}
 options={REVIEW_CYCLE_OPTIONS.map((opt) => ({
 value: opt.value,
 label: opt.value
 ? getReviewCycleLabel(opt.value as ReviewCycle)
 : t('vendorAssessment.noScheduledReview', 'No scheduled review'),
 }))}
 value={reviewCycle}
 onChange={(val) => setReviewCycle(val as ReviewCycle | '')}
 />

 {/* Custom Review Days */}
 {reviewCycle === 'custom' && (
 <div className="space-y-2">
 <label htmlFor="custom-review-days" className="block text-sm font-medium text-foreground text-muted-foreground">
 {t('vendorAssessment.customPeriod', 'Custom Period (days)')}
 </label>
 <input
 id="custom-review-days"
 type="number"
 min="30"
 max="730"
 value={customReviewDays}
 onChange={(e) => setCustomReviewDays(parseInt(e.target.value) || 180)}
 className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-muted/50 dark:bg-black/20 text-foreground focus:ring-2 focus-visible:ring-primary focus:border-primary"
 />
 </div>
 )}

 {/* Respondent Email */}
 <div className="space-y-2">
 <label htmlFor="respondent-email" className="block text-sm font-medium text-foreground text-muted-foreground">
 {t('vendorAssessment.respondentEmail', 'Respondent Email (optional)')}
 </label>
 <input
 id="respondent-email"
 type="email"
 value={respondentEmail}
 onChange={(e) => setRespondentEmail(e.target.value)}
 placeholder={t('vendorAssessment.enterEmail', 'vendor@example.com')}
 className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-muted/50 dark:bg-black/20 text-foreground focus:ring-2 focus-visible:ring-primary focus:border-primary"
 />
 <p className="text-xs text-muted-foreground">
 {t(
 'vendorAssessment.emailHint',
 'The vendor contact will receive the questionnaire to complete.'
 )}
 </p>
 </div>
 </div>

 {/* Actions */}
 <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border/40">
 <Button variant="ghost" onClick={handleClose}>
 {t('common.cancel', 'Cancel')}
 </Button>
 <Button
 onClick={handleCreate}
 disabled={!selectedTemplateId || isSubmitting}
 isLoading={isSubmitting}
 className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
 >
 {!isSubmitting && <Play className="w-4 h-4" />}
 {t('vendorAssessment.startAssessment', 'Start Assessment')}
 </Button>
 </div>
 </div>
 </Drawer>
 );
};

export default SupplierAssessmentDrawer;
