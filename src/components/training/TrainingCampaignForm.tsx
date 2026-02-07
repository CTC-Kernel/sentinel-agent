/**
 * TrainingCampaignForm Component
 *
 * Multi-step wizard for creating training campaigns.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingCampaignForm
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
 Megaphone,
 Users,
 Building2,
 Shield,
 CheckCircle,
 ChevronLeft,
 ChevronRight,
 RefreshCcw,
 GraduationCap,
 AlertCircle,
 X,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { useCourses } from '../../stores/trainingStore';
import { TrainingService } from '../../services/TrainingService';
import { trainingCampaignSchema, type TrainingCampaignFormData } from '../../schemas/trainingSchema';
import { toast } from '@/lib/toast';
import { appleEasing } from '../../utils/microInteractions';
import type {
 CampaignScope,
 RecurrenceFrequency,
 TrainingCourse,
} from '../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingCampaignFormProps {
 onSuccess: (campaignId: string) => void;
 onCancel: () => void;
}

type WizardStep = 'info' | 'courses' | 'scope' | 'review';

interface StepConfig {
 id: WizardStep;
 title: string;
 description: string;
 icon: React.ElementType<{ className?: string }>;
}

// ============================================================================
// Constants
// ============================================================================

const SCOPE_OPTIONS: { value: CampaignScope; label: string; icon: React.ElementType<{ className?: string }>; description: string }[] = [
 {
 value: 'all',
 label: 'training.campaign.scope.all',
 icon: Users,
 description: 'training.campaign.scopeDesc.all',
 },
 {
 value: 'department',
 label: 'training.campaign.scope.department',
 icon: Building2,
 description: 'training.campaign.scopeDesc.department',
 },
 {
 value: 'role',
 label: 'training.campaign.scope.role',
 icon: Shield,
 description: 'training.campaign.scopeDesc.role',
 },
];

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
 { value: 'monthly', label: 'training.campaign.frequency.monthly' },
 { value: 'quarterly', label: 'training.campaign.frequency.quarterly' },
 { value: 'yearly', label: 'training.campaign.frequency.yearly' },
];

const STEPS: StepConfig[] = [
 {
 id: 'info',
 title: 'training.campaign.steps.info',
 description: 'training.campaign.steps.infoDesc',
 icon: Megaphone,
 },
 {
 id: 'courses',
 title: 'training.campaign.steps.courses',
 description: 'training.campaign.steps.coursesDesc',
 icon: GraduationCap,
 },
 {
 id: 'scope',
 title: 'training.campaign.steps.scope',
 description: 'training.campaign.steps.scopeDesc',
 icon: Users,
 },
 {
 id: 'review',
 title: 'training.campaign.steps.review',
 description: 'training.campaign.steps.reviewDesc',
 icon: CheckCircle,
 },
];

// ============================================================================
// Helper Components
// ============================================================================

interface CourseSelectCardProps {
 course: TrainingCourse;
 selected: boolean;
 onToggle: () => void;
 t: (key: string) => string;
}

const CourseSelectCard: React.FC<CourseSelectCardProps> = ({
 course,
 selected,
 onToggle,
 t,
}) => (
 <div
 onClick={onToggle}
 onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
 role="button"
 tabIndex={0}
 aria-pressed={selected}
 className={`p-4 rounded-3xl border cursor-pointer transition-all ${selected
 ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
 : 'border-border/40 hover:border-white/20 hover:bg-muted/30'
 }`}
 >

 <div className="flex items-start gap-3">
 <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Sélectionner le cours ${course.title}`} />

 <div className="flex-1 min-w-0">
 <div className="font-medium text-foreground">{course.title}</div>
 <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
 {course.description}
 </div>
 <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
 <span className="px-2 py-0.5 rounded-full bg-muted">
 {t(`training.category.${course.category}`)}
 </span>
 <span>{course.duration} min</span>
 {course.isRequired && (
 <span className="px-2 py-0.5 rounded-full bg-error-bg text-error-text">
 {t('common.required')}
 </span>
 )}
 </div>
 </div>
 </div>
 </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const TrainingCampaignForm: React.FC<TrainingCampaignFormProps> = ({
 onSuccess,
 onCancel,
}) => {
 const { t } = useStore();
 const { user } = useAuth();
 const courses = useCourses();

 // Wizard state
 const [currentStep, setCurrentStep] = useState<WizardStep>('info');
 const [isSubmitting, setIsSubmitting] = useState(false);

 // Form
 const defaultStartDate = useMemo(() => new Date(), []);
 const defaultEndDate = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), []);

 const {
 register,
 control,
 handleSubmit,
 watch,
 setValue,
 formState: { errors },
 } = useForm<TrainingCampaignFormData>({
 resolver: zodResolver(trainingCampaignSchema),
 defaultValues: {
 name: '',
 description: '',
 startDate: defaultStartDate,
 endDate: defaultEndDate,
 scope: 'all' as const,
 scopeFilter: [] as string[],
 courseIds: [] as string[],
 recurrence: {
 enabled: false,
 frequency: 'quarterly' as const,
 },
 },
 });

 const watchedValues = watch();
 const selectedCourseIds = useMemo(() => watchedValues.courseIds || [], [watchedValues.courseIds]);

 // Navigation
 const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

 const canGoNext = useMemo(() => {
 switch (currentStep) {
 case 'info':
 return watchedValues.name && watchedValues.startDate && watchedValues.endDate;
 case 'courses':
 return selectedCourseIds.length > 0;
 case 'scope':
 return true;
 case 'review':
 return true;
 default:
 return false;
 }
 }, [currentStep, watchedValues.name, watchedValues.startDate, watchedValues.endDate, selectedCourseIds]);

 const goNext = useCallback(() => {
 const nextIndex = currentStepIndex + 1;
 if (nextIndex < STEPS.length) {
 setCurrentStep(STEPS[nextIndex].id);
 }
 }, [currentStepIndex]);

 const goBack = useCallback(() => {
 const prevIndex = currentStepIndex - 1;
 if (prevIndex >= 0) {
 setCurrentStep(STEPS[prevIndex].id);
 }
 }, [currentStepIndex]);

 // Course selection
 const toggleCourse = useCallback((courseId: string) => {
 const current = selectedCourseIds;
 if (current.includes(courseId)) {
 setValue('courseIds', current.filter((id) => id !== courseId));
 } else {
 setValue('courseIds', [...current, courseId]);
 }
 }, [selectedCourseIds, setValue]);

 // Submit
 const onSubmit = useCallback(async (formData: Record<string, unknown>) => {
 if (!user) return;

 const data = formData as unknown as TrainingCampaignFormData;
 setIsSubmitting(true);
 try {
 const campaignId = await TrainingService.createCampaign(data, user);
 toast.success(t('training.campaign.createSuccess'));
 onSuccess(campaignId);
 } catch {
 toast.error(t('training.errors.createFailed'));
 } finally {
 setIsSubmitting(false);
 }
 }, [user, t, onSuccess]);

 // Get selected courses for review
 const selectedCourses = useMemo(() => {
 return courses.filter((c) => selectedCourseIds.includes(c.id));
 }, [courses, selectedCourseIds]);

 return (
 <div className="max-w-3xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-8">
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-2xl bg-primary/10">
 <Megaphone className="w-6 h-6 text-primary" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-foreground">
 {t('training.campaign.createTitle')}
 </h1>
 <p className="text-muted-foreground">
 {t('training.campaign.createDesc')}
 </p>
 </div>
 </div>
 <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Fermer">
 <X className="w-4 h-4" />
 </Button>
 </div>

 {/* Progress Steps */}
 <div className="flex items-center justify-between mb-8">
 {STEPS.map((step, index) => {
 const StepIcon = step.icon;
 const isActive = step.id === currentStep;
 const isCompleted = index < currentStepIndex;

 return (
 <React.Fragment key={step.id || 'unknown'}>
 <div className="flex flex-col items-center">
 <div
  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive
  ? 'bg-primary text-primary-foreground'
  : isCompleted
  ? 'bg-success text-white'
  : 'bg-muted text-muted-foreground'
  }`}
 >
  {isCompleted ? (
  <CheckCircle className="w-5 h-5" />
  ) : (
  <StepIcon className="w-5 h-5" />
  )}
 </div>
 <span className={`text-xs mt-2 ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
  {t(step.title)}
 </span>
 </div>
 {index < STEPS.length - 1 && (
 <div className={`flex-1 h-0.5 mx-2 ${index < currentStepIndex ? 'bg-success' : 'bg-muted'}`} />
 )}
 </React.Fragment>
 );
 })}
 </div>

 {/* Step Content */}
 <form onSubmit={handleSubmit(onSubmit)}>
 <AnimatePresence mode="popLayout">
 <motion.div
 key={currentStep || 'unknown'}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 transition={{ duration: 0.2, ease: appleEasing }}
 className="glass-premium p-6 rounded-2xl border border-border/40 min-h-[400px]"
 >
 {/* Step: Info */}
 {currentStep === 'info' && (
 <div className="space-y-6">
 <div>
  <Label htmlFor="name">{t('training.campaign.name')} *</Label>
  <Input
  id="name"
  {...register('name')}
  placeholder={t('training.campaign.namePlaceholder')}
  className="mt-2"
  />
  {errors.name && (
  <p className="text-sm text-error-text mt-1">{errors.name.message}</p>
  )}
 </div>

 <div>
  <Label htmlFor="description">{t('common.description')}</Label>
  <textarea
  id="description"
  {...register('description')}
  placeholder={t('training.campaign.descriptionPlaceholder')}
  className="mt-2 w-full min-h-[100px] px-3 py-2 rounded-3xl border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  />
 </div>

 <div className="grid grid-cols-2 gap-4">
  <div>
  <Label htmlFor="startDate">{t('training.campaign.startDate')} *</Label>
  <Controller
  name="startDate"
  control={control}
  render={({ field }) => (
  <Input
  id="startDate"
  type="date"
  value={field.value ? new Date(field.value as Date).toISOString().split('T')[0] : ''}
  onChange={(e) => field.onChange(new Date(e.target.value))}
  className="mt-2"
  />
  )}
  />
  </div>
  <div>
  <Label htmlFor="endDate">{t('training.campaign.endDate')} *</Label>
  <Controller
  name="endDate"
  control={control}
  render={({ field }) => (
  <Input
  id="endDate"
  type="date"
  value={field.value ? new Date(field.value as Date).toISOString().split('T')[0] : ''}
  onChange={(e) => field.onChange(new Date(e.target.value))}
  className="mt-2"
  />
  )}
  />
  </div>
 </div>

 {/* Recurrence */}
 <div className="p-4 rounded-3xl border border-border/40 bg-muted/20">
  <div className="flex items-center gap-3 mb-4">
  <Controller
  name="recurrence.enabled"
  control={control}
  render={({ field }) => (
  <Checkbox
  checked={field.value}
  onCheckedChange={(checked) => field.onChange(checked)}
  />
  )}
  />
  <div>
  <div className="flex items-center gap-2 font-medium text-foreground">
  <RefreshCcw className="w-4 h-4" />
  {t('training.campaign.recurrence')}
  </div>
  <div className="text-xs text-muted-foreground">
  {t('training.campaign.recurrenceDesc')}
  </div>
  </div>
  </div>

  {watchedValues.recurrence?.enabled && (
  <div className="flex gap-2 mt-3">
  {FREQUENCY_OPTIONS.map((opt) => (
  <Controller
  key={opt.value || 'unknown'}
  name="recurrence.frequency"
  control={control}
  render={({ field }) => (
  <button
  type="button"
  onClick={() => field.onChange(opt.value)}
  aria-pressed={field.value === opt.value}
  className={`px-3 py-2 rounded-3xl text-sm font-medium transition-all ${field.value === opt.value
  ? 'bg-primary text-primary-foreground'
  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
  }`}
  >
  {t(opt.label)}
  </button>

  )}
  />
  ))}
  </div>
  )}
 </div>
 </div>
 )}

 {/* Step: Courses */}
 {currentStep === 'courses' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
  <div>
  <h2 className="font-bold text-foreground">{t('training.campaign.selectCourses')}</h2>
  <p className="text-sm text-muted-foreground">
  {selectedCourseIds.length} {t('training.campaign.coursesSelected')}
  </p>
  </div>
 </div>

 {courses.length === 0 ? (
  <div className="text-center py-8">
  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
  <p className="text-muted-foreground">{t('training.campaign.noCourses')}</p>
  </div>
 ) : (
  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
  {courses.map((course) => (
  <CourseSelectCard
  key={course.id || 'unknown'}
  course={course}
  selected={selectedCourseIds.includes(course.id)}
  onToggle={() => toggleCourse(course.id)}
  t={t}
  />
  ))}
  </div>
 )}
 </div>
 )}

 {/* Step: Scope */}
 {currentStep === 'scope' && (
 <div className="space-y-6">
 <div>
  <h2 className="font-bold text-foreground mb-4">{t('training.campaign.selectScope')}</h2>
  <div className="grid grid-cols-1 gap-3">
  {SCOPE_OPTIONS.map((opt) => {
  const ScopeIcon = opt.icon;
  const isSelected = watchedValues.scope === opt.value;

  return (
  <Controller
  key={opt.value || 'unknown'}
  name="scope"
  control={control}
  render={({ field }) => (
  <div
  onClick={() => field.onChange(opt.value)}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && field.onChange(opt.value)}
  role="button"
  tabIndex={0}
  aria-pressed={isSelected}
  className={`p-4 rounded-3xl border cursor-pointer transition-all ${isSelected
  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
  : 'border-border/40 hover:border-white/20 hover:bg-muted/30'
  }`}
  >

  <div className="flex items-center gap-3">
  <div className={`p-2 rounded-3xl ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
   <ScopeIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
  </div>
  <div>
   <div className="font-medium text-foreground">{t(opt.label)}</div>
   <div className="text-sm text-muted-foreground">{t(opt.description)}</div>
  </div>
  </div>
  </div>
  )}
  />
  );
  })}
  </div>
 </div>

 {/* TODO: Add department/role filter when scope is not 'all' */}
 </div>
 )}

 {/* Step: Review */}
 {currentStep === 'review' && (
 <div className="space-y-6">
 <h2 className="font-bold text-foreground">{t('training.campaign.reviewTitle')}</h2>

 {/* Campaign Info */}
 <div className="p-4 rounded-3xl border border-border/40 bg-muted/20">
  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
  {t('training.campaign.steps.info')}
  </h3>
  <div className="space-y-2">
  <div className="flex justify-between">
  <span className="text-muted-foreground">{t('training.campaign.name')}</span>
  <span className="font-medium text-foreground">{watchedValues.name}</span>
  </div>
  <div className="flex justify-between">
  <span className="text-muted-foreground">{t('training.campaign.dates')}</span>
  <span className="font-medium text-foreground">
  {(watchedValues.startDate as Date)?.toLocaleDateString('fr-FR')} - {(watchedValues.endDate as Date)?.toLocaleDateString('fr-FR')}
  </span>
  </div>
  {watchedValues.recurrence?.enabled && (
  <div className="flex justify-between">
  <span className="text-muted-foreground">{t('training.campaign.recurrence')}</span>
  <span className="font-medium text-foreground">
  {t(`training.campaign.frequency.${watchedValues.recurrence.frequency}`)}
  </span>
  </div>
  )}
  </div>
 </div>

 {/* Courses */}
 <div className="p-4 rounded-3xl border border-border/40 bg-muted/20">
  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
  {t('training.campaign.steps.courses')} ({selectedCourses.length})
  </h3>
  <div className="space-y-2">
  {selectedCourses.map((course) => (
  <div key={course.id || 'unknown'} className="flex items-center gap-2">
  <GraduationCap className="w-4 h-4 text-primary" />
  <span className="text-foreground">{course.title}</span>
  </div>
  ))}
  </div>
 </div>

 {/* Scope */}
 <div className="p-4 rounded-3xl border border-border/40 bg-muted/20">
  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
  {t('training.campaign.steps.scope')}
  </h3>
  <div className="flex items-center gap-2">
  {(() => {
  const scopeOpt = SCOPE_OPTIONS.find((s) => s.value === watchedValues.scope);
  const ScopeIcon = scopeOpt?.icon || Users;
  return (
  <>
  <ScopeIcon className="w-4 h-4 text-primary" />
  <span className="text-foreground">{t(scopeOpt?.label || '')}</span>
  </>
  );
  })()}
  </div>
 </div>
 </div>
 )}
 </motion.div>
 </AnimatePresence>

 {/* Navigation */}
 <div className="flex items-center justify-between mt-6">
 <Button
 type="button"
 variant="outline"
 onClick={currentStepIndex === 0 ? onCancel : goBack}
 >
 <ChevronLeft className="w-4 h-4 mr-2" />
 {currentStepIndex === 0 ? t('common.cancel') : t('common.back')}
 </Button>

 {currentStep === 'review' ? (
 <Button type="submit" disabled={isSubmitting}>
 {isSubmitting ? (
 <span className="animate-pulse">{t('common.saving')}</span>
 ) : (
 <>
  <CheckCircle className="w-4 h-4 mr-2" />
  {t('training.campaign.create')}
 </>
 )}
 </Button>
 ) : (
 <Button
 type="button"
 onClick={goNext}
 disabled={!canGoNext}
 >
 {t('common.next')}
 <ChevronRight className="w-4 h-4 ml-2" />
 </Button>
 )}
 </div>
 </form>
 </div>
 );
};

TrainingCampaignForm.displayName = 'TrainingCampaignForm';
