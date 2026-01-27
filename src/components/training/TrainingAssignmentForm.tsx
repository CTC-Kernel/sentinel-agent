/**
 * TrainingAssignmentForm Component
 *
 * Form for assigning training courses to users.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingAssignmentForm
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { batchAssignmentSchema, BatchAssignmentFormData } from '../../schemas/trainingSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import {
  Users,
  Calendar,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Award,
  FileText,
  ChevronRight,
} from '../ui/Icons';
import { useStore } from '../../store';
import { useTrainingAssignment } from '../../hooks/training/useTrainingAssignment';
import { motion, AnimatePresence } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';
import type { UserProfile } from '../../types';
import type { TrainingCategory } from '../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingAssignmentFormProps {
  onSuccess: (assignmentIds: string[]) => void;
  onCancel: () => void;
  users: UserProfile[];
  preselectedCourseId?: string;
  preselectedUserIds?: string[];
  campaignId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const getCategoryIcon = (category: TrainingCategory) => {
  const icons = {
    security: Shield,
    compliance: Award,
    awareness: Users,
    technical: FileText,
  };
  return icons[category] || GraduationCap;
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

// ============================================================================
// Component
// ============================================================================

export const TrainingAssignmentForm: React.FC<TrainingAssignmentFormProps> = ({
  onSuccess,
  onCancel,
  users,
  preselectedCourseId,
  preselectedUserIds,
  campaignId,
}) => {
  const { t } = useStore();
  const {
    isLoading,
    courses,
    preview,
    generatePreview,
    clearPreview,
    assignTraining,
  } = useTrainingAssignment();

  // Step state: 'select' | 'preview' | 'confirm'
  const [step, setStep] = useState<'select' | 'preview' | 'confirm'>('select');

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useZodForm<typeof batchAssignmentSchema>({
    schema: batchAssignmentSchema,
    mode: 'onChange',
    defaultValues: {
      courseId: preselectedCourseId || '',
      userIds: preselectedUserIds || [],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks default
    },
  });

  // Watched values
  const selectedCourseId = watch('courseId');
  const selectedUserIds = watch('userIds');
  const selectedDueDate = watch('dueDate');

  // Selected course details
  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  // Selected users details
  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedUserIds.includes(u.uid));
  }, [users, selectedUserIds]);

  // Course options for select
  const courseOptions = useMemo(() => {
    return courses
      .filter((c) => !c.isArchived)
      .map((c) => ({
        value: c.id,
        label: `${c.title} (${formatDuration(c.duration)})`,
      }));
  }, [courses]);

  // User options for select
  const userOptions = useMemo(() => {
    return users.map((u) => ({
      value: u.uid,
      label: u.displayName || u.email || u.uid,
    }));
  }, [users]);

  // Generate preview when moving to preview step
  const handlePreview = useCallback(() => {
    if (selectedCourse && selectedUsers.length > 0 && selectedDueDate) {
      generatePreview(selectedCourseId, selectedUsers, selectedDueDate);
      setStep('preview');
    }
  }, [selectedCourse, selectedUsers, selectedDueDate, selectedCourseId, generatePreview]);

  // Handle form submission
  const onFormSubmit = useCallback(async (data: BatchAssignmentFormData) => {
    try {
      const assignmentIds = await assignTraining(
        data.courseId,
        data.userIds,
        data.dueDate,
        campaignId
      );
      onSuccess(assignmentIds);
    } catch {
      // Error handled in hook
    }
  }, [assignTraining, campaignId, onSuccess]);

  // Reset preview when going back
  const handleBack = useCallback(() => {
    clearPreview();
    setStep('select');
  }, [clearPreview]);

  // Minimum date for deadline (tomorrow)
  const minDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: appleEasing }}
      className="space-y-6"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {['select', 'preview', 'confirm'].map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : i < ['select', 'preview', 'confirm'].indexOf(step)
                  ? 'bg-success-bg text-success-text'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < ['select', 'preview', 'confirm'].indexOf(step) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && (
              <div
                className={`w-12 h-0.5 transition-colors ${
                  i < ['select', 'preview', 'confirm'].indexOf(step)
                    ? 'bg-success-bg'
                    : 'bg-muted'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-bold text-foreground">
              {t('training.assignment.selectDetails')}
            </h3>

            {/* Course Selection */}
            <Controller
              control={control}
              name="courseId"
              render={({ field }) => (
                <CustomSelect
                  label={t('training.assignment.selectCourse')}
                  options={courseOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.courseId?.message}
                />
              )}
            />

            {/* Selected Course Preview */}
            {selectedCourse && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-2xl bg-muted/30 border border-muted"
              >
                <div className="flex items-start gap-3">
                  {(() => {
                    const CategoryIcon = getCategoryIcon(selectedCourse.category);
                    return (
                      <div className="p-2 rounded-xl bg-primary/10">
                        <CategoryIcon className="w-5 h-5 text-primary" />
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">
                      {selectedCourse.title}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {selectedCourse.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDuration(selectedCourse.duration)}
                      </span>
                      {selectedCourse.isRequired && (
                        <span className="px-2 py-0.5 rounded-full bg-error-bg text-error-text text-[11px] font-bold uppercase">
                          {t('common.required')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* User Selection */}
            <Controller
              control={control}
              name="userIds"
              render={({ field }) => (
                <CustomSelect
                  label={t('training.assignment.selectUsers')}
                  options={userOptions}
                  value={field.value}
                  onChange={field.onChange}
                  multiple
                  error={errors.userIds?.message}
                />
              )}
            />

            {/* Selected Users Count */}
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>
                  {selectedUsers.length} {t('training.assignment.usersSelected')}
                </span>
              </div>
            )}

            {/* Due Date */}
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <FloatingLabelInput
                  label={t('training.assignment.dueDate')}
                  type="date"
                  value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                  error={errors.dueDate?.message}
                  min={minDate}
                />
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t border-muted">
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handlePreview}
                disabled={!isValid || selectedUsers.length === 0}
                className="gap-2"
              >
                {t('training.assignment.preview')}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-bold text-foreground">
              {t('training.assignment.previewTitle')}
            </h3>

            {/* Assignment Summary Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-primary/20">
                    <GraduationCap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">
                      {preview.course.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(preview.course.duration)}
                    </p>
                  </div>
                </div>
                {preview.course.isRequired && (
                  <span className="px-3 py-1 rounded-full bg-error-bg text-error-text text-xs font-bold uppercase">
                    {t('common.required')}
                  </span>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-background/50 text-center">
                  <div className="text-2xl font-bold text-primary">
                    {preview.totalAssignments}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    {t('training.assignment.totalAssignments')}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-background/50 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    <Calendar className="w-6 h-6 mx-auto" />
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    {preview.dueDate.toLocaleDateString()}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-background/50 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    <Users className="w-6 h-6 mx-auto" />
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    {preview.users.length} {t('training.assignment.users')}
                  </div>
                </div>
              </div>
            </div>

            {/* Users List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t('training.assignment.assignees')}
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 p-1">
                {preview.users.map((user) => (
                  <div
                    key={user.uid}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(user.displayName || user.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {user.displayName || user.email}
                      </div>
                      {user.role && (
                        <div className="text-xs text-muted-foreground">
                          {user.role}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning for required training */}
            {preview.course.isRequired && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-bg/50 border border-warning-border/30">
                <AlertCircle className="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning-text">
                    {t('training.assignment.requiredWarningTitle')}
                  </p>
                  <p className="text-xs text-warning-text/80">
                    {t('training.assignment.requiredWarningDesc')}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-4 pt-4 border-t border-muted">
              <Button type="button" variant="ghost" onClick={handleBack}>
                {t('common.back')}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className="gap-2"
                >
                  {t('training.assignment.confirmAndAssign')}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && preview && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 text-center"
          >
            <div className="p-6 rounded-3xl bg-muted/30 border border-muted">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t('training.assignment.confirmTitle')}
              </h3>
              <p className="text-muted-foreground">
                {t('training.assignment.confirmDesc', {
                  count: preview.totalAssignments,
                  course: preview.course.title,
                })}
              </p>
            </div>

            {/* Final confirmation */}
            <div className="flex justify-center gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('preview')}
              >
                {t('common.back')}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit(onFormSubmit)}
                isLoading={isLoading}
                className="px-8 shadow-sm shadow-primary"
              >
                {t('training.assignment.assign')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

TrainingAssignmentForm.displayName = 'TrainingAssignmentForm';
