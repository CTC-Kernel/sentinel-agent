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
  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-muted">
    <Skeleton className="w-10 h-10 rounded-xl" />
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
      <div className="glass-panel p-5 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
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
    <div className="glass-panel p-5 rounded-2xl border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-error-bg">
            <AlertTriangle className="w-5 h-5 text-error-text" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {t('training.dashboard.overdueTrainings')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {assignments.length} {t('training.dashboard.requiresAttention')}
            </p>
          </div>
        </div>
        {onViewAll && hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-xs"
          >
            {t('common.viewAll')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={t('training.dashboard.noOverdue')}
          description={t('training.dashboard.noOverdueDesc')}
          semantic="success"
          compact
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {displayAssignments.map((assignment, index) => {
              const dueDate = assignment.dueDate.toDate();
              const daysOverdue = getDaysOverdue(dueDate);

              return (
                <motion.div
                  key={assignment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-error-bg/20 border border-error-border/30 hover:bg-error-bg/30 transition-colors"
                >
                  {/* User Avatar Placeholder */}
                  <div className="w-10 h-10 rounded-xl bg-error-bg flex items-center justify-center">
                    <User className="w-5 h-5 text-error-text" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {assignment.userName || assignment.userId}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {assignment.courseName || assignment.courseId}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-error-text">
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
                    className="shrink-0"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    {t('training.dashboard.remind')}
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {hasMore && (
            <div className="text-center pt-2">
              <span className="text-xs text-muted-foreground">
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
