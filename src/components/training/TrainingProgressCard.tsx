/**
 * TrainingProgressCard Component
 *
 * Displays a training assignment with progress status for the employee view.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingProgressCard
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Play,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Download,
  Calendar,
  Shield,
  Award,
  Users,
  FileText,
  PlayCircle,
  HelpCircle,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';
import { useStore } from '../../store';
import { appleEasing } from '../../utils/microInteractions';
import type { TrainingAssignment, TrainingCourse, AssignmentStatus, TrainingCategory, TrainingContentType } from '../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingProgressCardProps {
  assignment: TrainingAssignment;
  course: TrainingCourse;
  onStart: (assignment: TrainingAssignment) => void;
  onContinue: (assignment: TrainingAssignment) => void;
  onComplete: (assignment: TrainingAssignment) => void;
  onViewContent: (assignment: TrainingAssignment, course: TrainingCourse) => void;
  onDownloadCertificate?: (assignment: TrainingAssignment) => void;
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
  return icons[category] || FileText;
};

const getContentTypeIcon = (type: TrainingContentType) => {
  const icons = {
    video: PlayCircle,
    document: FileText,
    quiz: HelpCircle,
    external_link: ExternalLink,
  };
  return icons[type] || FileText;
};

const getStatusConfig = (status: AssignmentStatus, isOverdue: boolean) => {
  if (isOverdue && status !== 'completed') {
    return {
      color: 'text-error-text',
      bg: 'bg-error-bg',
      border: 'border-error-border/50',
      label: 'training.status.overdue',
      icon: AlertTriangle,
    };
  }

  const configs = {
    assigned: {
      color: 'text-info-text',
      bg: 'bg-info-bg',
      border: 'border-info-border/50',
      label: 'training.status.assigned',
      icon: Clock,
    },
    in_progress: {
      color: 'text-warning-text',
      bg: 'bg-warning-bg',
      border: 'border-warning-border/50',
      label: 'training.status.in_progress',
      icon: Play,
    },
    completed: {
      color: 'text-success-text',
      bg: 'bg-success-bg',
      border: 'border-success-border/50',
      label: 'training.status.completed',
      icon: CheckCircle,
    },
    overdue: {
      color: 'text-error-text',
      bg: 'bg-error-bg',
      border: 'border-error-border/50',
      label: 'training.status.overdue',
      icon: AlertTriangle,
    },
  };

  return configs[status];
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

const getCountdown = (dueDate: Date): { text: string; urgent: boolean; overdue: boolean } => {
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();

  if (diff < 0) {
    const daysPast = Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24));
    return {
      text: daysPast === 1 ? '1 jour de retard' : `${daysPast} jours de retard`,
      urgent: true,
      overdue: true
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days === 0) {
    return {
      text: hours <= 1 ? 'Moins d\'1 heure' : `${hours} heures restantes`,
      urgent: true,
      overdue: false
    };
  }

  if (days <= 3) {
    return {
      text: days === 1 ? '1 jour restant' : `${days} jours restants`,
      urgent: true,
      overdue: false
    };
  }

  return {
    text: `${days} jours restants`,
    urgent: false,
    overdue: false
  };
};

// ============================================================================
// Component
// ============================================================================

export const TrainingProgressCard: React.FC<TrainingProgressCardProps> = ({
  assignment,
  course,
  onStart,
  onContinue,
  onComplete,
  onViewContent,
  onDownloadCertificate,
}) => {
  const { t } = useStore();

  // Check if overdue
  const dueDate = assignment.dueDate instanceof Date
    ? assignment.dueDate
    : new Date(assignment.dueDate);
  const isOverdue = dueDate < new Date() && assignment.status !== 'completed';

  // Status config
  const statusConfig = getStatusConfig(assignment.status, isOverdue);
  const StatusIcon = statusConfig.icon;
  const CategoryIcon = getCategoryIcon(course.category);
  const ContentTypeIcon = getContentTypeIcon(course.content.type);

  // Countdown
  const countdown = useMemo(() => {
    if (assignment.status === 'completed') return null;
    return getCountdown(dueDate);
  }, [assignment.status, dueDate]);

  // Progress percentage (mock - would come from actual progress tracking)
  const progress = assignment.status === 'completed'
    ? 100
    : assignment.status === 'in_progress'
    ? 50
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: appleEasing }}
      className={`relative glass-panel p-5 rounded-3xl border transition-all duration-300 hover:shadow-elevation-md ${
        isOverdue
          ? 'border-error-border/50 bg-error-bg/5'
          : assignment.status === 'completed'
          ? 'border-success-border/50'
          : 'border-white/10'
      }`}
    >
      {/* Status Badge */}
      <div className="absolute -top-2 -right-2 z-10">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border shadow-sm`}>
          <StatusIcon className="w-3 h-3" />
          {t(statusConfig.label)}
        </div>
      </div>

      {/* Header: Category + Content Type */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${
            assignment.status === 'completed'
              ? 'bg-success-bg'
              : isOverdue
              ? 'bg-error-bg'
              : 'bg-primary/10'
          }`}>
            <CategoryIcon className={`w-6 h-6 ${
              assignment.status === 'completed'
                ? 'text-success-text'
                : isOverdue
                ? 'text-error-text'
                : 'text-primary'
            }`} />
          </div>
          <div>
            <h3 className="font-bold text-foreground line-clamp-1">
              {course.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ContentTypeIcon className="w-3 h-3" />
              <span>{t(`training.contentTypes.${course.content.type}`)}</span>
              <span>•</span>
              <Clock className="w-3 h-3" />
              <span>{formatDuration(course.duration)}</span>
            </div>
          </div>
        </div>

        {/* Required badge */}
        {course.isRequired && (
          <Tooltip content={t('training.course.isRequired')}>
            <div className="px-2 py-0.5 rounded-full bg-error-bg text-error-text text-[10px] font-bold uppercase">
              {t('common.required')}
            </div>
          </Tooltip>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {course.description}
      </p>

      {/* Progress Bar (if in progress) */}
      {assignment.status === 'in_progress' && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">{t('training.progress')}</span>
            <span className="font-bold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: appleEasing }}
              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Countdown / Due Date */}
      {countdown && (
        <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${
          countdown.overdue
            ? 'bg-error-bg/50 border border-error-border/30'
            : countdown.urgent
            ? 'bg-warning-bg/50 border border-warning-border/30'
            : 'bg-muted/30 border border-muted'
        }`}>
          <Calendar className={`w-4 h-4 ${
            countdown.overdue
              ? 'text-error-text'
              : countdown.urgent
              ? 'text-warning-text'
              : 'text-muted-foreground'
          }`} />
          <div className="flex-1">
            <div className={`text-sm font-medium ${
              countdown.overdue
                ? 'text-error-text'
                : countdown.urgent
                ? 'text-warning-text'
                : 'text-foreground'
            }`}>
              {countdown.text}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('training.assignment.dueDate')}: {dueDate.toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* Completed info */}
      {assignment.status === 'completed' && assignment.completedAt && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-success-bg/50 border border-success-border/30">
          <CheckCircle className="w-4 h-4 text-success-text" />
          <div className="flex-1">
            <div className="text-sm font-medium text-success-text">
              {t('training.status.completed')}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(assignment.completedAt).toLocaleDateString()}
              {assignment.score !== undefined && ` • Score: ${assignment.score}%`}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-white/5">
        {assignment.status === 'assigned' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewContent(assignment, course)}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('training.viewContent')}
            </Button>
            <Button
              size="sm"
              onClick={() => onStart(assignment)}
              className="flex-1 shadow-elevation-sm shadow-primary"
            >
              <Play className="w-4 h-4 mr-2" />
              {t('training.assignment.start')}
            </Button>
          </>
        )}

        {assignment.status === 'in_progress' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewContent(assignment, course)}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('training.viewContent')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onContinue(assignment)}
            >
              <Play className="w-4 h-4 mr-2" />
              {t('training.assignment.continue')}
            </Button>
            <Button
              size="sm"
              onClick={() => onComplete(assignment)}
              className="shadow-elevation-sm shadow-success"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('training.assignment.markComplete')}
            </Button>
          </>
        )}

        {assignment.status === 'completed' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewContent(assignment, course)}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('training.viewContent')}
            </Button>
            {onDownloadCertificate && (
              <Button
                size="sm"
                onClick={() => onDownloadCertificate(assignment)}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('training.assignment.downloadCertificate')}
              </Button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

TrainingProgressCard.displayName = 'TrainingProgressCard';
