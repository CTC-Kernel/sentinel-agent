import React, { useState, useMemo } from 'react';
import { ClipboardList, ChevronRight, Clock, CheckCircle2, AlertTriangle, Calendar, Filter, RefreshCw } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { SupplierQuestionnaireResponse } from '../../../types';
import { EnhancedAssessmentResponse, VendorAssessmentStatus, getDaysUntil } from '../../../types/vendorAssessment';
import { Button } from '../../ui/button';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/hooks/useLocale';

interface SupplierAssessmentsProps {
 canEdit: boolean;
 onStartAssessment: () => void;
 assessments: (SupplierQuestionnaireResponse | EnhancedAssessmentResponse)[];
 onViewAssessment: (id: string) => void;
}

// Status options for filter
const STATUS_OPTIONS: (VendorAssessmentStatus | 'all')[] = ['all', 'Draft', 'Sent', 'In Progress', 'Submitted', 'Reviewed', 'Archived', 'Expired'];

const getStatusColorClasses = (status: string): string => {
 switch (status) {
 case 'Submitted':
 return 'bg-green-100 text-green-700 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400';
 case 'Reviewed':
 return 'bg-info-bg text-info-text dark:text-blue-400';
 case 'Archived':
 return 'bg-muted text-foreground ';
 case 'Expired':
 return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
 case 'In Progress':
 return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
 case 'Sent':
 return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
 default:
 return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
 }
};

const getStatusLabel = (status: string, t: (key: string, fallback: string) => string): string => {
 switch (status) {
 case 'Draft':
 return t('vendorAssessment.status.draft', 'Draft');
 case 'Sent':
 return t('vendorAssessment.status.sent', 'Sent');
 case 'In Progress':
 return t('vendorAssessment.status.inProgress', 'In Progress');
 case 'Submitted':
 return t('vendorAssessment.status.submitted', 'Submitted');
 case 'Reviewed':
 return t('vendorAssessment.status.reviewed', 'Reviewed');
 case 'Archived':
 return t('vendorAssessment.status.archived', 'Archived');
 case 'Expired':
 return t('vendorAssessment.status.expired', 'Expired');
 default:
 return status;
 }
};

// Helper to parse date from Firestore timestamp or string
const parseDate = (dateValue: unknown): Date | null => {
 if (!dateValue) return null;
 if (typeof dateValue === 'string') return new Date(dateValue);
 if (typeof dateValue === 'object' && 'seconds' in (dateValue as object)) {
 return new Date((dateValue as { seconds: number }).seconds * 1000);
 }
 return null;
};

// Progress bar component
const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
 const clampedValue = Math.min(100, Math.max(0, value));
 const color = clampedValue >= 80 ? 'bg-green-500' : clampedValue >= 50 ? 'bg-amber-500' : 'bg-red-500';

 return (
 <div className={`h-1.5 bg-muted rounded-full overflow-hidden ${className}`}>
 <div
 className={`h-full ${color} transition-all duration-300`}
 style={{ width: `${clampedValue}%` }}
 />
 </div>
 );
};

// Expiration badge component
const ExpirationBadge: React.FC<{ dueDate?: string | null; status: string }> = ({ dueDate, status }) => {
 const { t } = useTranslation();

 if (!dueDate || ['Reviewed', 'Archived', 'Expired'].includes(status)) return null;

 const daysUntil = getDaysUntil(dueDate);

 if (daysUntil < 0) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
 <AlertTriangle className="w-3 h-3" />
 {t('vendorAssessment.overdue', 'Overdue')}
 </span>
 );
 }

 if (daysUntil <= 7) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
 <Clock className="w-3 h-3" />
 {t('vendorAssessment.daysLeft', '{{count}} days left', { count: daysUntil })}
 </span>
 );
 }

 if (daysUntil <= 30) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
 <Clock className="w-3 h-3" />
 {t('vendorAssessment.daysLeft', '{{count}} days left', { count: daysUntil })}
 </span>
 );
 }

 return null;
};

// Next review date component
const NextReviewBadge: React.FC<{ nextReviewDate?: string | null }> = ({ nextReviewDate }) => {
 const { t } = useTranslation();
 const { config } = useLocale();

 if (!nextReviewDate) return null;

 const daysUntil = getDaysUntil(nextReviewDate);
 const date = new Date(nextReviewDate);

 if (daysUntil <= 30) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
 <RefreshCw className="w-3 h-3" />
 {t('vendorAssessment.reviewIn', 'Review in {{count}} days', { count: daysUntil })}
 </span>
 );
 }

 return (
 <span className="text-xs text-muted-foreground flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 {t('vendorAssessment.nextReview', 'Next review: {{date}}', {
 date: date.toLocaleDateString(config.intlLocale, { day: 'numeric', month: 'short', year: 'numeric' }),
 })}
 </span>
 );
};

export const SupplierAssessments: React.FC<SupplierAssessmentsProps> = ({
 canEdit,
 onStartAssessment,
 assessments,
 onViewAssessment,
}) => {
 const { t } = useTranslation();
 const { config } = useLocale();
 const [statusFilter, setStatusFilter] = useState<VendorAssessmentStatus | 'all'>('all');

 // Filter assessments
 const filteredAssessments = useMemo(() => {
 if (statusFilter === 'all') return assessments;
 return assessments.filter((a) => a.status === statusFilter);
 }, [assessments, statusFilter]);

 // Count by status for filter badges
 const statusCounts = useMemo(() => {
 const counts: Record<string, number> = { all: assessments.length };
 assessments.forEach((a) => {
 counts[a.status] = (counts[a.status] || 0) + 1;
 });
 return counts;
 }, [assessments]);

 return (
 <div className="p-6 h-full overflow-y-auto">
 {/* Header */}
 <div className="flex justify-between items-start mb-6">
 <div>
 <h2 className="font-bold text-lg text-foreground">
 {t('vendorAssessment.assessments', 'Assessments')}
 </h2>
 <p className="text-sm text-muted-foreground">
 {t('vendorAssessment.assessmentsDescription', 'Compliance assessment history (DORA, ISO 27001, NIS2, HDS).')}
 </p>
 </div>
 {canEdit && (
 <Button onClick={onStartAssessment} className="rounded-3xl shadow-lg shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
 <ClipboardList className="w-4 h-4 mr-2" />
 {t('vendorAssessment.newAssessment', 'New Assessment')}
 </Button>
 )}
 </div>

 {/* Status Filter */}
 {assessments.length > 0 && (
 <div className="mb-4 flex items-center gap-2 flex-wrap">
 <Filter className="w-4 h-4 text-muted-foreground" />
 {STATUS_OPTIONS.map((status) => {
 const count = statusCounts[status] || 0;
 if (status !== 'all' && count === 0) return null;

 const isActive = statusFilter === status;
 return (
 <button
 key={status || 'unknown'}
 onClick={() => setStatusFilter(status)}
 className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
  isActive
  ? 'bg-primary/15 text-primary dark:bg-primary dark:text-primary/70'
  : 'bg-muted text-muted-foreground hover:bg-muted '
 }`}
 >
 {status === 'all' ? t('vendorAssessment.allStatuses', 'All') : getStatusLabel(status, t)}
 <span className="ml-1.5 opacity-60">({count})</span>
 </button>
 );
 })}
 </div>
 )}

 {/* Assessment List */}
 <div className="space-y-4">
 {filteredAssessments.length === 0 ? (
 <EmptyState
 icon={ClipboardList}
 title={
 statusFilter === 'all'
 ? t('vendorAssessment.noAssessments', 'No assessments')
 : t('vendorAssessment.noAssessmentsWithFilter', 'No {{status}} assessments', {
  status: getStatusLabel(statusFilter, t).toLowerCase(),
  })
 }
 description={
 statusFilter === 'all'
 ? t('vendorAssessment.startFirstAssessment', 'Start a first vendor assessment.')
 : t('vendorAssessment.tryDifferentFilter', 'Try a different filter.')
 }
 actionLabel={canEdit && statusFilter === 'all' ? t('vendorAssessment.startAssessment', 'Start Assessment') : undefined}
 onAction={canEdit && statusFilter === 'all' ? onStartAssessment : undefined}
 />
 ) : (
 filteredAssessments.map((assessment) => {
 const enhanced = assessment as EnhancedAssessmentResponse;
 const updatedAt = parseDate(assessment.updatedAt);
 const completionPercentage = enhanced.completionPercentage ?? 0;
 const showProgress = ['Draft', 'Sent', 'In Progress'].includes(assessment.status);

 return (
 <div
 key={assessment.id || 'unknown'}
 className="glass-premium rounded-3xl p-5 border border-border/40 hover:border-primary/40 dark:hover:border-primary/80 transition-colors group relative overflow-hidden"
 >
 <div className="flex justify-between items-start">
  <div className="flex items-start gap-4 flex-1 min-w-0">
  {/* Status Icon */}
  <div
  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
  assessment.status === 'Reviewed'
  ? 'bg-info-bg text-info-text dark:text-blue-400'
  : assessment.status === 'Submitted'
  ? 'bg-green-100 text-green-600 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400'
  : assessment.status === 'Expired'
  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
  }`}
  >
  {assessment.status === 'Reviewed' || assessment.status === 'Submitted' ? (
  <CheckCircle2 className="w-5 h-5" />
  ) : assessment.status === 'Expired' ? (
  <AlertTriangle className="w-5 h-5" />
  ) : (
  <Clock className="w-5 h-5" />
  )}
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
  {enhanced.framework
  ? t('vendorAssessment.frameworkAssessment', '{{framework}} Assessment', {
  framework: enhanced.framework,
  })
  : t('vendorAssessment.vendorAssessment', 'Vendor Assessment')}
  </h3>
  {/* Framework badge */}
  {enhanced.framework && (
  <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
  {enhanced.framework}
  </span>
  )}
  </div>

  {/* Date and badges row */}
  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
  <p className="text-sm text-muted-foreground flex items-center gap-1">
  <Clock className="w-3 h-3" />
  {updatedAt ? updatedAt.toLocaleDateString(config.intlLocale) : t('common.unknownDate', 'Unknown date')}
  </p>
  <ExpirationBadge dueDate={assessment.dueDate} status={assessment.status} />
  {assessment.status === 'Reviewed' && <NextReviewBadge nextReviewDate={enhanced.nextReviewDate} />}
  </div>

  {/* Progress bar for in-progress assessments */}
  {showProgress && (
  <div className="mt-3">
  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
  <span>{t('vendorAssessment.completion', 'Completion')}</span>
  <span>{completionPercentage}%</span>
  </div>
  <ProgressBar value={completionPercentage} />
  </div>
  )}
  </div>
  </div>

  {/* Right side - Status and Score */}
  <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColorClasses(assessment.status)}`}>
  {getStatusLabel(assessment.status, t)}
  </span>
  {typeof assessment.overallScore === 'number' && assessment.overallScore > 0 && (
  <span
  className={`text-sm font-bold ${
  assessment.overallScore >= 80
  ? 'text-green-600'
  : assessment.overallScore >= 50
  ? 'text-amber-600'
  : 'text-red-600'
  }`}
  >
  {t('vendorAssessment.score', 'Score')}: {assessment.overallScore}%
  </span>
  )}
  </div>
 </div>

 {/* Footer */}
 <div className="mt-4 pt-4 border-t border-border/40 flex justify-end">
  <Button
  variant="ghost"
  size="sm"
  onClick={() => onViewAssessment(assessment.id!)}
  className="text-primary hover:text-primary hover:bg-primary/10 dark:hover:bg-primary"
  >
  {t('vendorAssessment.viewDetails', 'View Details')}
  <ChevronRight className="w-4 h-4 ml-1" />
  </Button>
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 );
};
