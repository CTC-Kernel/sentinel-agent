/**
 * TrainingCourseCard Component
 *
 * Displays a single training course in a card format.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingCourseCard
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  PlayCircle,
  FileText,
  HelpCircle,
  ExternalLink,
  Clock,
  Users,
  Shield,
  Edit,
  Archive,
  MoreVertical,
  Play,
  Award,
} from '../ui/Icons';
import { Menu, Transition } from '@headlessui/react';
import { Tooltip } from '../ui/Tooltip';
import type { TrainingCourse, TrainingCategory, TrainingSource, TrainingContentType } from '../../types/training';
import { useStore } from '../../store';
import { appleEasing } from '../../utils/microInteractions';

// ============================================================================
// Types
// ============================================================================

interface TrainingCourseCardProps {
  course: TrainingCourse;
  onView: (course: TrainingCourse) => void;
  onEdit?: (course: TrainingCourse) => void;
  onArchive?: (course: TrainingCourse) => void;
  onAssign?: (course: TrainingCourse) => void;
  canEdit?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const getCategoryConfig = (category: TrainingCategory) => {
  const configs = {
    security: {
      icon: Shield,
      color: 'text-error-text',
      bg: 'bg-error-bg',
      border: 'border-error-border/50',
      label: 'training.categories.security',
    },
    compliance: {
      icon: Award,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      label: 'training.categories.compliance',
    },
    awareness: {
      icon: Users,
      color: 'text-warning-text',
      bg: 'bg-warning-bg',
      border: 'border-warning-border/50',
      label: 'training.categories.awareness',
    },
    technical: {
      icon: FileText,
      color: 'text-info-text',
      bg: 'bg-info-bg',
      border: 'border-info-border/50',
      label: 'training.categories.technical',
    },
  };
  return configs[category] || configs.awareness;
};

const getSourceConfig = (source: TrainingSource) => {
  const configs = {
    anssi: { label: 'ANSSI', color: 'text-primary bg-primary/10 border-primary/20' },
    cnil: { label: 'CNIL', color: 'text-info-text bg-info-bg border-info-border/50' },
    internal: { label: 'Interne', color: 'text-success-text bg-success-bg border-success-border/50' },
    external: { label: 'Externe', color: 'text-muted-foreground bg-muted border-muted' },
  };
  return configs[source] || configs.internal;
};

const getContentTypeIcon = (type: TrainingContentType): React.ElementType<{ className?: string }> => {
  const icons = {
    video: PlayCircle,
    document: FileText,
    quiz: HelpCircle,
    external_link: ExternalLink,
  };
  return icons[type] || FileText;
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

export const TrainingCourseCard: React.FC<TrainingCourseCardProps> = React.memo(({
  course,
  onView,
  onEdit,
  onArchive,
  onAssign,
  canEdit = false,
}) => {
  const { t } = useStore();

  const categoryConfig = getCategoryConfig(course.category);
  const sourceConfig = getSourceConfig(course.source);

  const frameworkBadges = [];
  if (course.frameworkMappings?.nis2?.length) {
    frameworkBadges.push({ label: 'NIS2', color: 'bg-primary/10 text-primary border-primary/20' });
  }
  if (course.frameworkMappings?.iso27001?.length) {
    frameworkBadges.push({ label: 'ISO27001', color: 'bg-info-bg text-info-text border-info-border/50' });
  }
  if (course.frameworkMappings?.dora?.length) {
    frameworkBadges.push({ label: 'DORA', color: 'bg-warning-bg text-warning-text border-warning-border/50' });
  }
  if (course.frameworkMappings?.rgpd?.length) {
    frameworkBadges.push({ label: 'RGPD', color: 'bg-success-bg text-success-text border-success-border/50' });
  }


  return (
    <motion.div
      className="group relative glass-premium p-5 rounded-3xl border border-white/5 transition-all duration-300 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: appleEasing }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => onView(course)}
    >
      {/* Required Badge */}
      {course.isRequired && (
        <div className="absolute -top-2 -right-2 z-10">
          <Tooltip content={t('training.course.isRequired')}>
            <div className="px-2 py-0.5 rounded-full bg-error-bg text-error-text text-[11px] font-bold uppercase tracking-wider border border-error-border/50 shadow-sm">
              {t('common.required') || 'Obligatoire'}
            </div>
          </Tooltip>
        </div>
      )}

      {/* Top section: Category Icon + Content Type */}
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${categoryConfig.bg} ${categoryConfig.border} border backdrop-blur-sm`}>
          {React.createElement(categoryConfig.icon, {
            className: `w-6 h-6 ${categoryConfig.color}`
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Content Type Icon */}
          <Tooltip content={t(`training.contentTypes.${course.content.type}`)}>
            <div className="p-2 rounded-3xl bg-muted/50 border border-muted">
              {React.createElement(getContentTypeIcon(course.content.type), {
                className: "w-4 h-4 text-muted-foreground"
              })}
            </div>
          </Tooltip>

          {/* Actions Menu */}
          {canEdit && (
            <Menu as="div" className="relative">
              <Menu.Button
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-3xl bg-muted/50 hover:bg-muted border border-muted transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </Menu.Button>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-70"
                leave="transition duration-75 ease-in"
                leaveFrom="transform scale-100 opacity-70"
                leaveTo="transform scale-95 opacity-0"
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right glass-premium rounded-2xl p-1 shadow-lg z-50 border border-border/40">
                  {onAssign && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssign(course);
                          }}
                          className={`${active ? 'bg-primary/10 text-primary' : 'text-foreground'
                            } flex items-center gap-2 w-full px-3 py-2 text-sm rounded-3xl transition-colors`}
                        >
                          <Play className="w-4 h-4" />
                          {t('training.assignment.assign')}
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  {onEdit && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(course);
                          }}
                          className={`${active ? 'bg-primary/10 text-primary' : 'text-foreground'
                            } flex items-center gap-2 w-full px-3 py-2 text-sm rounded-3xl transition-colors`}
                        >
                          <Edit className="w-4 h-4" />
                          {t('common.edit')}
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  {onArchive && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onArchive(course);
                          }}
                          className={`${active ? 'bg-error-bg text-error-text' : 'text-error-text'
                            } flex items-center gap-2 w-full px-3 py-2 text-sm rounded-3xl transition-colors`}
                        >
                          <Archive className="w-4 h-4" />
                          {t('training.course.archive')}
                        </button>
                      )}
                    </Menu.Item>
                  )}
                </Menu.Items>
              </Transition>
            </Menu>
          )}
        </div>
      </div>

      {/* Title and Description */}
      <h3 className="text-base font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {course.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {course.description}
      </p>

      {/* Meta info: Duration, Source */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDuration(course.duration)}</span>
        </div>
        <div className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${sourceConfig.color}`}>
          {sourceConfig.label}
        </div>
      </div>

      {/* Framework mappings */}
      {frameworkBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {frameworkBadges.map((badge) => (
            <span
              key={badge.label || 'unknown'}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${badge.color}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {/* Target roles (if any) */}
      {course.targetRoles && course.targetRoles.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="truncate">
              {course.targetRoles.length === 1
                ? course.targetRoles[0]
                : `${course.targetRoles.length} ${t('training.course.targetRoles').toLowerCase()}`
              }
            </span>
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-70 transition-opacity pointer-events-none" />
    </motion.div>
  );
});

TrainingCourseCard.displayName = 'TrainingCourseCard';
