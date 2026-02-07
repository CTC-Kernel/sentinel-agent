/**
 * TrainingCampaignDetail Component
 *
 * Displays detailed information about a training campaign with progress tracking.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingCampaignDetail
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
 Megaphone,
 Calendar,
 Users,
 Building2,
 Shield,
 CheckCircle,
 Clock,
 AlertTriangle,
 Play,
 XCircle,
 ChevronLeft,
 RefreshCcw,
 GraduationCap,
 TrendingUp,
 Mail,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/Skeleton';
import { useStore } from '../../store';
import { useCourses, useAssignments } from '../../stores/trainingStore';
import { staggerContainer, staggerItem } from '../../utils/microInteractions';
import type { TrainingCampaign, CampaignStatus, CampaignScope } from '../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingCampaignDetailProps {
 campaign: TrainingCampaign;
 onBack: () => void;
 onLaunch?: () => void;
 onCancel?: () => void;
 onSendReminders?: () => void;
 isLoading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const getStatusConfig = (status: CampaignStatus) => {
 const configs: Record<CampaignStatus, {
 color: string;
 bg: string;
 icon: React.ElementType<{ className?: string }>;
 label: string;
 }> = {
 draft: {
 color: 'text-muted-foreground',
 bg: 'bg-muted',
 icon: Clock,
 label: 'training.campaign.status.draft',
 },
 active: {
 color: 'text-success-text',
 bg: 'bg-success-bg',
 icon: Play,
 label: 'training.campaign.status.active',
 },
 completed: {
 color: 'text-info-text',
 bg: 'bg-info-bg',
 icon: CheckCircle,
 label: 'training.campaign.status.completed',
 },
 cancelled: {
 color: 'text-error-text',
 bg: 'bg-error-bg',
 icon: XCircle,
 label: 'training.campaign.status.cancelled',
 },
 };
 return configs[status];
};

const getScopeConfig = (scope: CampaignScope) => {
 const configs: Record<CampaignScope, {
 icon: React.ElementType<{ className?: string }>;
 label: string;
 }> = {
 all: { icon: Users, label: 'training.campaign.scope.all' },
 department: { icon: Building2, label: 'training.campaign.scope.department' },
 role: { icon: Shield, label: 'training.campaign.scope.role' },
 };
 return configs[scope];
};

// ============================================================================
// Sub-Components
// ============================================================================

interface StatCardProps {
 title: string;
 value: number | string;
 icon: React.ElementType<{ className?: string }>;
 color: 'primary' | 'success' | 'warning' | 'error';
 suffix?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, suffix }) => {
 const colorClasses = {
 primary: { bg: 'bg-primary/10', text: 'text-primary' },
 success: { bg: 'bg-success-bg', text: 'text-success-text' },
 warning: { bg: 'bg-warning-bg', text: 'text-warning-text' },
 error: { bg: 'bg-error-bg', text: 'text-error-text' },
 };

 const classes = colorClasses[color];

 return (
 <div className="glass-premium p-4 rounded-3xl border border-border/40">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-lg ${classes.bg}`}>
 <Icon className={`w-5 h-5 ${classes.text}`} />
 </div>
 <div>
 <div className="text-2xl font-bold text-foreground">
 {value}{suffix}
 </div>
 <div className="text-xs text-muted-foreground">{title}</div>
 </div>
 </div>
 </div>
 );
};

// ============================================================================
// Main Component
// ============================================================================

export const TrainingCampaignDetail: React.FC<TrainingCampaignDetailProps> = ({
 campaign,
 onBack,
 onLaunch,
 onCancel,
 onSendReminders,
 isLoading = false,
}) => {
 const { t } = useStore();
 const courses = useCourses();
 const allAssignments = useAssignments();

 // Get campaign courses
 const campaignCourses = useMemo(() => {
 return courses.filter((c) => campaign.courseIds.includes(c.id));
 }, [courses, campaign.courseIds]);

 // Get campaign assignments
 const campaignAssignments = useMemo(() => {
 return allAssignments.filter((a) => a.campaignId === campaign.id);
 }, [allAssignments, campaign.id]);

 // Calculate stats from assignments
 const stats = useMemo(() => {
 const total = campaignAssignments.length || campaign.progress.totalAssignments;
 const completed = campaignAssignments.filter((a) => a.status === 'completed').length || campaign.progress.completed;
 const overdue = campaignAssignments.filter((a) => {
 if (a.status === 'completed') return false;
 return a.dueDate.toDate() < new Date();
 }).length || campaign.progress.overdue;
 const inProgress = campaignAssignments.filter((a) => a.status === 'in_progress').length;

 return {
 total,
 completed,
 overdue,
 inProgress,
 completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
 };
 }, [campaignAssignments, campaign.progress]);

 // Status and scope configs
 const statusConfig = getStatusConfig(campaign.status);
 const scopeConfig = getScopeConfig(campaign.scope);
 const StatusIcon = statusConfig.icon;
 const ScopeIcon = scopeConfig.icon;

 // Dates
 const startDate = campaign.startDate.toDate();
 const endDate = campaign.endDate.toDate();
 const now = new Date();
 const isOngoing = startDate <= now && endDate >= now;
 const daysRemaining = isOngoing ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

 if (isLoading) {
 return (
 <div className="space-y-6">
 <Skeleton className="h-10 w-48 rounded-lg" />
 <Skeleton className="h-40 w-full rounded-2xl" />
 <div className="grid grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i || 'unknown'} className="h-24 rounded-3xl" />
 ))}
 </div>
 </div>
 );
 }

 return (
 <motion.div
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 className="space-y-6"
 >
 {/* Back Button */}
 <motion.div variants={staggerItem}>
 <Button variant="ghost" size="sm" onClick={onBack}>
 <ChevronLeft className="w-4 h-4 mr-2" />
 {t('common.back')}
 </Button>
 </motion.div>

 {/* Header Card */}
 <motion.div
 variants={staggerItem}
 className="glass-premium p-6 rounded-2xl border border-border/40"
 >
 <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
 {/* Campaign Info */}
 <div className="flex items-start gap-4">
 <div className={`p-4 rounded-2xl ${statusConfig.bg}`}>
 <Megaphone className={`w-8 h-8 ${statusConfig.color}`} />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
 <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color}`}>
  <StatusIcon className="w-3 h-3" />
  {t(statusConfig.label)}
 </div>
 </div>

 {campaign.description && (
 <p className="text-muted-foreground mb-4 max-w-2xl">{campaign.description}</p>
 )}

 <div className="flex flex-wrap items-center gap-4 text-sm">
 {/* Dates */}
 <div className="flex items-center gap-2 text-muted-foreground">
  <Calendar className="w-4 h-4" />
  <span>{startDate.toLocaleDateString('fr-FR')} - {endDate.toLocaleDateString('fr-FR')}</span>
 </div>

 {/* Scope */}
 <div className="flex items-center gap-2 text-muted-foreground">
  <ScopeIcon className="w-4 h-4" />
  <span>{t(scopeConfig.label)}</span>
 </div>

 {/* Recurrence */}
 {campaign.recurrence?.enabled && (
  <div className="flex items-center gap-2 text-primary">
  <RefreshCcw className="w-4 h-4" />
  <span>{t(`training.campaign.frequency.${campaign.recurrence.frequency}`)}</span>
  </div>
 )}

 {/* Days remaining */}
 {isOngoing && campaign.status === 'active' && (
  <div className={`flex items-center gap-2 ${daysRemaining <= 7 ? 'text-warning-text' : 'text-muted-foreground'}`}>
  <Clock className="w-4 h-4" />
  <span>{daysRemaining} {t('training.campaign.daysRemaining')}</span>
  </div>
 )}
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2">
 {campaign.status === 'draft' && onLaunch && (
 <Button onClick={onLaunch}>
 <Play className="w-4 h-4 mr-2" />
 {t('training.campaign.launch')}
 </Button>
 )}
 {campaign.status === 'active' && (
 <>
 {onSendReminders && (
  <Button variant="outline" onClick={onSendReminders}>
  <Mail className="w-4 h-4 mr-2" />
  {t('training.campaign.sendReminders')}
  </Button>
 )}
 {onCancel && (
  <Button variant="outline" onClick={onCancel} className="text-error-text hover:text-error-text">
  <XCircle className="w-4 h-4 mr-2" />
  {t('training.campaign.cancel')}
  </Button>
 )}
 </>
 )}
 </div>
 </div>
 </motion.div>

 {/* Stats Cards */}
 <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <StatCard
 title={t('training.stats.total')}
 value={stats.total}
 icon={Users}
 color="primary"
 />
 <StatCard
 title={t('training.stats.completed')}
 value={stats.completed}
 icon={CheckCircle}
 color="success"
 />
 <StatCard
 title={t('training.stats.overdue')}
 value={stats.overdue}
 icon={AlertTriangle}
 color="error"
 />
 <StatCard
 title={t('training.stats.completionRate')}
 value={stats.completionRate}
 suffix="%"
 icon={TrendingUp}
 color={stats.completionRate >= 80 ? 'success' : stats.completionRate >= 50 ? 'warning' : 'error'}
 />
 </motion.div>

 {/* Progress Bar */}
 {campaign.status === 'active' && stats.total > 0 && (
 <motion.div variants={staggerItem} className="glass-premium p-5 rounded-2xl border border-border/40">
 <div className="flex items-center justify-between mb-3">
 <h2 className="font-bold text-foreground">{t('training.campaign.overallProgress')}</h2>
 <span className="text-sm text-muted-foreground">
 {stats.completed}/{stats.total} {t('training.campaign.assignmentsCompleted')}
 </span>
 </div>
 <div className="h-4 bg-muted/50 rounded-full overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${stats.completionRate}%` }}
 transition={{ duration: 0.8, ease: 'easeOut' }}
 className={`h-full rounded-full ${stats.completionRate >= 80
  ? 'bg-gradient-to-r from-success to-success/80'
  : stats.completionRate >= 50
  ? 'bg-gradient-to-r from-warning to-warning/80'
  : 'bg-gradient-to-r from-error to-error/80'
 }`}
 />
 </div>
 </motion.div>
 )}

 {/* Courses List */}
 <motion.div variants={staggerItem} className="glass-premium p-5 rounded-2xl border border-border/40">
 <h2 className="font-bold text-foreground mb-4">
 {t('training.campaign.includedCourses')} ({campaignCourses.length})
 </h2>
 <div className="space-y-3">
 {campaignCourses.map((course) => (
 <div
 key={course.id || 'unknown'}
 className="flex items-center justify-between p-3 rounded-3xl bg-muted/30 border border-white/5"
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-primary/10">
  <GraduationCap className="w-4 h-4 text-primary" />
 </div>
 <div>
  <div className="font-medium text-foreground">{course.title}</div>
  <div className="text-xs text-muted-foreground">
  {course.duration} min • {t(`training.category.${course.category}`)}
  </div>
 </div>
 </div>
 {course.isRequired && (
 <span className="px-2 py-1 rounded-full bg-error-bg text-error-text text-xs font-bold">
  {t('common.required')}
 </span>
 )}
 </div>
 ))}
 </div>
 </motion.div>
 </motion.div>
 );
};

TrainingCampaignDetail.displayName = 'TrainingCampaignDetail';
