/**
 * TrainingOverdueList Widget
 *
 * Displays a list of overdue training assignments with actions.
 * Part of the Training Dashboard (NIS2 Art. 21.2g).
 *
 * @module TrainingOverdueList
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Mail,
  User,
  Calendar,
  ChevronRight,
  Clock,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { useStore } from '../../../store';
import { toast } from '@/lib/toast';
import type { TrainingAssignment } from '../../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingOverdueListProps {
  assignments: (TrainingAssignment & { userName?: string; courseName?: string })[];
  isLoading: boolean;
  onSendReminder?: (assignmentId: string) => Promise<void>;
  onViewAll?: () => void;
  maxItems?: number;
}

// ============================================================================
// Helper Components
// ============================================================================

const getDaysOverdue = (dueDate: Date): number => {
  return Math.ceil((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
};

const OverdueItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 rounded-3xl bg-muted/30 border border-muted">
    <Skeleton className="w-10 h-10 rounded-3xl" />
    <div className="flex-1">
      <Skeleton className="h-4 w-48 rounded-md mb-2" />
      <Skeleton className="h-3 w-32 rounded-md" />
    </div>
    <Skeleton className="h-8 w-24 rounded-lg" />
  </div>
);

// ============================================================================
// Component
// ============================================================================

// ============================================================================
// Component
// ============================================================================

export const TrainingOverdueList: React.FC<TrainingOverdueListProps> = ({
  assignments,
  isLoading,
  onSendReminder,
  onViewAll,
  maxItems = 5,
}) => {
  const { t } = useStore();

  const handleSendReminder = useCallback(async (assignmentId: string) => {
    if (!onSendReminder) {
      toast.info(t('training.dashboard.reminderComingSoon'));
      return;
    }

    try {
      await onSendReminder(assignmentId);
      toast.success(t('training.dashboard.reminderSent'));
    } catch {
      toast.error(t('training.errors.reminderFailed'));
    }
  }, [onSendReminder, t]);

  if (isLoading) {
    return (
      <div className="glass-premium p-6 rounded-3xl border border-border/40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div>
              <Skeleton className="h-5 w-40 rounded-md mb-2" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <OverdueItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const displayAssignments = assignments.slice(0, maxItems);
  const hasMore = assignments.length > maxItems;

  return (
    <div className="glass-premium p-6 rounded-3xl border border-border/40 h-full relative overflow-hidden">
      {/* Background Decorator */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-3xl bg-red-50">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">
              {t('training.dashboard.overdueTrainings')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {assignments.length} {t('training.dashboard.requiresAttention')}
            </p>
          </div>
        </div>
        {onViewAll && hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-xs font-medium hover:bg-white/10"
          >
            {t('common.viewAll')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="relative z-10">
          <EmptyState
            icon={Clock}
            title={t('training.dashboard.noOverdue')}
            description={t('training.dashboard.noOverdueDesc')}
            semantic="success"
            compact
          />
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          <AnimatePresence>
            {displayAssignments.map((assignment, index) => {
              const dueDate = assignment.dueDate.toDate();
              const daysOverdue = getDaysOverdue(dueDate);

              return (
                <motion.div
                  key={assignment.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-border/40 dark:border-white/5 hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900 transition-all duration-300"
                >
                  {/* User Avatar Placeholder */}
                  <div className="w-10 h-10 rounded-3xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-border/40 dark:border-white/5 group-hover:scale-110 transition-transform duration-300">
                    <User className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-foreground truncate">
                      {assignment.userName || assignment.userId}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mb-1">
                      {assignment.courseName || assignment.courseId}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 dark:bg-red-900/20 text-[11px] font-bold text-red-600 dark:text-red-400">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {daysOverdue} {t('training.dashboard.daysOverdue')}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReminder(assignment.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-70 transition-all transform translate-x-2 group-hover:translate-x-0 bg-white dark:bg-slate-800 shadow-sm border-border/40 dark:border-border/40 hover:border-red-2000 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {hasMore && (
            <div className="text-center pt-2">
              <span className="text-xs text-muted-foreground font-medium">
                +{assignments.length - maxItems} {t('common.more')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

TrainingOverdueList.displayName = 'TrainingOverdueList';
