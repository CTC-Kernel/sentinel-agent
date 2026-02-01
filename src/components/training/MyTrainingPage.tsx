/**
 * MyTrainingPage Component
 *
 * Employee view for their assigned trainings.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module MyTrainingPage
 */

import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Award,
  Target,
  TrendingUp,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { TrainingProgressCard } from './TrainingProgressCard';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import {
  useTrainingStore,
  useCourses,
  useUserAssignments,
  useTrainingLoading,
} from '../../stores/trainingStore';
import { TrainingService } from '../../services/TrainingService';
import { toast } from '@/lib/toast';
import { staggerContainer, staggerItem } from '../../utils/microInteractions';
import type { TrainingAssignment, TrainingCourse } from '../../types/training';
import { useLocale } from '@/hooks/useLocale';

// ============================================================================
// Types
// ============================================================================

interface MyTrainingPageProps {
  onRefresh?: () => void;
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';

// ============================================================================
// Skeleton Components
// ============================================================================

const TrainingCardSkeleton: React.FC = () => (
  <div className="glass-premium p-5 rounded-3xl border border-border/40">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div>
          <Skeleton className="h-5 w-48 rounded-md mb-2" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
    <Skeleton className="h-4 w-full rounded-md mb-2" />
    <Skeleton className="h-4 w-3/4 rounded-md mb-4" />
    <Skeleton className="h-12 w-full rounded-3xl mb-4" />
    <div className="flex gap-2 pt-4 border-t border-white/5">
      <Skeleton className="h-9 flex-1 rounded-3xl" />
      <Skeleton className="h-9 flex-1 rounded-3xl" />
    </div>
  </div>
);

// ============================================================================
// Component
// ============================================================================

export const MyTrainingPage: React.FC<MyTrainingPageProps> = ({
  onRefresh,
}) => {
  const { t } = useStore();
  const { config } = useLocale();
  const { user } = useAuth();
  const courses = useCourses();
  const isLoading = useTrainingLoading();
  const userAssignments = useUserAssignments(user?.uid || '');
  const updateAssignment = useTrainingStore((s) => s.updateAssignment);

  // Local state
  const [filter, setFilter] = useState<FilterType>('all');
  const [, setIsUpdating] = useState<string | null>(null);

  // Get course by ID
  const getCourse = useCallback((courseId: string): TrainingCourse | undefined => {
    return courses.find((c) => c.id === courseId);
  }, [courses]);

  // Check if assignment is overdue
  const isOverdue = useCallback((assignment: TrainingAssignment): boolean => {
    const dueDate = assignment.dueDate.toDate();
    return dueDate < new Date() && assignment.status !== 'completed';
  }, []);

  // Filter and sort assignments
  const filteredAssignments = useMemo(() => {
    let filtered = [...userAssignments];

    // Apply filter
    switch (filter) {
      case 'pending':
        filtered = filtered.filter((a) => a.status === 'assigned');
        break;
      case 'in_progress':
        filtered = filtered.filter((a) => a.status === 'in_progress');
        break;
      case 'completed':
        filtered = filtered.filter((a) => a.status === 'completed');
        break;
      case 'overdue':
        filtered = filtered.filter((a) => isOverdue(a));
        break;
    }

    // Sort by urgency: overdue first, then by due date
    filtered.sort((a, b) => {
      // Completed last
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;

      // Overdue first
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (bOverdue && !aOverdue) return 1;

      // Then by due date
      const aDate = a.dueDate.toDate();
      const bDate = b.dueDate.toDate();
      return aDate.getTime() - bDate.getTime();
    });

    return filtered;
  }, [userAssignments, filter, isOverdue]);

  // Stats
  const stats = useMemo(() => {
    const total = userAssignments.length;
    const completed = userAssignments.filter((a) => a.status === 'completed').length;
    const inProgress = userAssignments.filter((a) => a.status === 'in_progress').length;
    const overdue = userAssignments.filter((a) => isOverdue(a)).length;
    const pending = userAssignments.filter((a) => a.status === 'assigned').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, overdue, pending, completionRate };
  }, [userAssignments, isOverdue]);

  // Handlers
  const handleStart = useCallback(async (assignment: TrainingAssignment) => {
    if (!user) return;

    setIsUpdating(assignment.id);
    try {
      await TrainingService.startAssignment(
        user.organizationId!,
        assignment.id
      );
      updateAssignment(assignment.id, { status: 'in_progress' });
      toast.success(t('training.success.trainingStarted'));
    } catch {
      toast.error(t('training.errors.updateFailed'));
    } finally {
      setIsUpdating(null);
    }
  }, [user, updateAssignment, t]);

  const handleContinue = useCallback((assignment: TrainingAssignment) => {
    const course = getCourse(assignment.courseId);
    if (course?.content.url) {
      window.open(course.content.url, '_blank');
    }
  }, [getCourse]);

  const handleComplete = useCallback(async (assignment: TrainingAssignment) => {
    if (!user) return;

    setIsUpdating(assignment.id);
    try {
      await TrainingService.completeAssignment(
        user.organizationId!,
        assignment.id
      );
      updateAssignment(assignment.id, { status: 'completed' });
      toast.success(t('training.success.assignmentCompleted'));
    } catch {
      toast.error(t('training.errors.updateFailed'));
    } finally {
      setIsUpdating(null);
    }
  }, [user, updateAssignment, t]);

  const handleViewContent = useCallback((_assignment: TrainingAssignment, course: TrainingCourse) => {
    if (course.content.url) {
      window.open(course.content.url, '_blank');
    }
  }, []);

  const handleDownloadCertificate = useCallback((assignment: TrainingAssignment) => {
    const course = getCourse(assignment.courseId);
    const courseName = course?.title || assignment.courseId;
    const userName = user?.displayName || user?.email || '';
    const completedDate = assignment.completedAt
      ? assignment.completedAt.toDate().toLocaleDateString(config.intlLocale, { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString(config.intlLocale, { year: 'numeric', month: 'long', day: 'numeric' });

    // Generate a client-side certificate via a printable window
    // TODO: Replace with Cloud Function PDF generation (e.g., functions/generateCertificate) for production use
    const certWindow = window.open('', '_blank');
    if (!certWindow) {
      toast.error(t('training.errors.updateFailed'));
      return;
    }

    certWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Certificat - ${courseName}</title>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; }
          .cert { width: 800px; padding: 60px; border: 3px solid #1e40af; border-radius: 24px; background: white; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .cert h1 { font-size: 32px; color: #1e40af; margin-bottom: 8px; letter-spacing: 2px; text-transform: uppercase; }
          .cert .subtitle { color: #64748b; font-size: 14px; margin-bottom: 40px; }
          .cert .name { font-size: 28px; font-weight: 700; color: #0f172a; margin: 24px 0 8px; }
          .cert .course { font-size: 20px; color: #334155; margin-bottom: 32px; }
          .cert .date { color: #64748b; font-size: 14px; margin-top: 40px; }
          .cert .divider { width: 120px; height: 2px; background: #1e40af; margin: 24px auto; }
        </style>
      </head>
      <body>
        <div class="cert">
          <h1>Certificat de Formation</h1>
          <p class="subtitle">Sentinel GRC - Conformité NIS2</p>
          <div class="divider"></div>
          <p style="color:#64748b;">Ce certificat atteste que</p>
          <p class="name">${userName}</p>
          <p style="color:#64748b;">a complété avec succès la formation</p>
          <p class="course">${courseName}</p>
          <div class="divider"></div>
          <p class="date">Date de complétion : ${completedDate}</p>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    certWindow.document.close();

    toast.success(t('training.success.assignmentCompleted'));
  }, [getCourse, user, t]);

  // Filter buttons config
  const filterButtons: { value: FilterType; label: string; icon: React.ElementType<{ className?: string }>; count: number }[] = [
    { value: 'all', label: 'common.all', icon: GraduationCap, count: stats.total },
    { value: 'pending', label: 'training.status.assigned', icon: Clock, count: stats.pending },
    { value: 'in_progress', label: 'training.status.in_progress', icon: TrendingUp, count: stats.inProgress },
    { value: 'completed', label: 'training.status.completed', icon: CheckCircle, count: stats.completed },
    { value: 'overdue', label: 'training.status.overdue', icon: AlertTriangle, count: stats.overdue },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('training.myCourses')}
          </h1>
          <p className="text-muted-foreground">
            {t('training.myCoursesDesc')}
          </p>
        </div>

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.refresh')}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-premium p-4 rounded-2xl border border-border/40"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-primary/10">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('training.stats.total')}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-premium p-4 rounded-2xl border border-border/40"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-success-bg">
              <CheckCircle className="w-5 h-5 text-success-text" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{stats.completed}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('training.stats.completed')}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-premium p-4 rounded-2xl border border-border/40"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-error-bg">
              <AlertTriangle className="w-5 h-5 text-error-text" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('training.stats.overdue')}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-premium p-4 rounded-2xl border border-border/40"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-warning-bg">
              <Award className="w-5 h-5 text-warning-text" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{stats.completionRate}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('training.stats.completionRate')}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = filter === btn.value;
          return (
            <button
              key={btn.value || 'unknown'}
              onClick={() => setFilter(btn.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-3xl text-sm font-medium transition-all ${isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-muted'
                }`}
            >
              <Icon className="w-4 h-4" />
              {t(btn.label)}
              {btn.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${isActive
                    ? 'bg-white/20'
                    : btn.value === 'overdue' && btn.count > 0
                      ? 'bg-error-bg text-error-text'
                      : 'bg-muted'
                  }`}>
                  {btn.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <TrainingCardSkeleton key={i || 'unknown'} />
          ))}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={filter === 'all'
            ? t('training.empty.assignments')
            : t('training.empty.noResults')
          }
          description={filter === 'all'
            ? t('training.empty.assignmentsDesc')
            : t('training.empty.noResultsDesc')
          }
          secondaryActionLabel={filter !== 'all' ? t('common.clearFilters') : undefined}
          onSecondaryAction={filter !== 'all' ? () => setFilter('all') : undefined}
          semantic={filter === 'completed' ? 'success' : 'info'}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <AnimatePresence>
            {filteredAssignments.map((assignment) => {
              const course = getCourse(assignment.courseId);
              if (!course) return null;

              return (
                <motion.div
                  key={assignment.id || 'unknown'}
                  variants={staggerItem}
                  layout
                >
                  <TrainingProgressCard
                    assignment={assignment}
                    course={course}
                    onStart={handleStart}
                    onContinue={handleContinue}
                    onComplete={handleComplete}
                    onViewContent={handleViewContent}
                    onDownloadCertificate={handleDownloadCertificate}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

MyTrainingPage.displayName = 'MyTrainingPage';
