/**
 * TrainingCampaignList Component
 *
 * Displays a list of training campaigns with filtering and actions.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingCampaignList
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone,
  Plus,
  Search,
  Calendar,
  Users,
  Play,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  MoreVertical,
  RefreshCcw,
  Building2,
  Shield,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useStore } from '../../store';
import { useCampaigns, useCourses, useTrainingLoading } from '../../stores/trainingStore';
import { staggerContainer, staggerItem } from '../../utils/microInteractions';
import type { TrainingCampaign, CampaignStatus, CampaignScope } from '../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingCampaignListProps {
  onCreateCampaign: () => void;
  onViewCampaign: (campaign: TrainingCampaign) => void;
  onLaunchCampaign?: (campaign: TrainingCampaign) => void;
  onCancelCampaign?: (campaign: TrainingCampaign) => void;
}

type FilterStatus = 'all' | CampaignStatus;

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

const getScopeIcon = (scope: CampaignScope): React.ElementType<{ className?: string }> => {
  const icons: Record<CampaignScope, React.ElementType<{ className?: string }>> = {
    all: Users,
    department: Building2,
    role: Shield,
  };
  return icons[scope];
};

// ============================================================================
// Skeleton Component
// ============================================================================

const CampaignCardSkeleton: React.FC = () => (
  <div className="glass-premium p-5 rounded-2xl border border-border/40">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-3xl" />
        <div>
          <Skeleton className="h-5 w-48 rounded-md mb-2" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
    <Skeleton className="h-2 w-full rounded-full mb-4" />
    <div className="flex gap-2">
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
  </div>
);

// ============================================================================
// Campaign Card Component
// ============================================================================

interface CampaignCardProps {
  campaign: TrainingCampaign;
  coursesCount: number;
  onView: () => void;
  onLaunch?: () => void;
  onCancel?: () => void;
  t: (key: string) => string;
}

const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  coursesCount,
  onView,
  onLaunch,
  onCancel,
  t,
}) => {
  const statusConfig = getStatusConfig(campaign.status);
  const StatusIcon = statusConfig.icon;

  // Memoize the ScopeIcon to avoid recreation during render
  const ScopeIcon = useMemo(() => getScopeIcon(campaign.scope), [campaign.scope]);

  const progressPercent = campaign.progress.totalAssignments > 0
    ? Math.round((campaign.progress.completed / campaign.progress.totalAssignments) * 100)
    : 0;

  const startDate = campaign.startDate.toDate();
  const endDate = campaign.endDate.toDate();

  return (
    <motion.div
      variants={staggerItem}
      className="glass-premium p-5 rounded-2xl border border-border/40 hover:border-border/60 transition-all hover:shadow-md cursor-pointer group"
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-3xl ${statusConfig.bg}`}>
            <Megaphone className={`w-6 h-6 ${statusConfig.color}`} />
          </div>
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
              {campaign.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color}`}>
          <StatusIcon className="w-3 h-3" />
          {t(statusConfig.label)}
        </div>
      </div>

      {/* Progress Bar */}
      {campaign.status === 'active' && campaign.progress.totalAssignments > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">{t('training.progress')}</span>
            <span className="font-bold text-foreground">
              {campaign.progress.completed}/{campaign.progress.totalAssignments} ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-success to-success/80 rounded-full"
            />
          </div>
          {campaign.progress.overdue > 0 && (
            <div className="text-xs text-error-text mt-1">
              {campaign.progress.overdue} {t('training.campaign.overdue')}
            </div>
          )}
        </div>
      )}

      {/* Meta Info */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Scope */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
          <ScopeIcon className="w-3 h-3" />
          {t(`training.campaign.scope.${campaign.scope}`)}
        </div>

        {/* Courses count */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
          <Megaphone className="w-3 h-3" />
          {coursesCount} {t('training.campaign.courses')}
        </div>

        {/* Recurrence */}
        {campaign.recurrence?.enabled && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-xs text-primary">
            <RefreshCcw className="w-3 h-3" />
            {t(`training.campaign.frequency.${campaign.recurrence.frequency}`)}
          </div>
        )}
      </div>

      {/* Actions (on hover or via dropdown) */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="text-xs"
        >
          {t('training.campaign.viewDetails')}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>

        {(campaign.status === 'draft' || campaign.status === 'active') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {campaign.status === 'draft' && onLaunch && (
                <DropdownMenuItem onClick={() => onLaunch()}>
                  <Play className="w-4 h-4 mr-2" />
                  {t('training.campaign.launch')}
                </DropdownMenuItem>
              )}
              {campaign.status === 'active' && onCancel && (
                <DropdownMenuItem
                  onClick={() => onCancel()}
                  className="text-error-text focus:text-error-text"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {t('training.campaign.cancel')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const TrainingCampaignList: React.FC<TrainingCampaignListProps> = ({
  onCreateCampaign,
  onViewCampaign,
  onLaunchCampaign,
  onCancelCampaign,
}) => {
  const { t } = useStore();
  const campaigns = useCampaigns();
  const courses = useCourses();
  const isLoading = useTrainingLoading();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  // Get course count for a campaign
  const getCourseCount = useCallback((campaignCourseIds: string[]) => {
    return campaignCourseIds.filter((id) => courses.some((c) => c.id === id)).length;
  }, [courses]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      // Status filter
      if (statusFilter !== 'all' && campaign.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = campaign.name.toLowerCase().includes(query);
        const matchesDescription = campaign.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [campaigns, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === 'active').length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
  }), [campaigns]);

  // Filter buttons
  const filterButtons: { value: FilterStatus; label: string; count: number }[] = [
    { value: 'all', label: 'common.all', count: stats.total },
    { value: 'active', label: 'training.campaign.status.active', count: stats.active },
    { value: 'draft', label: 'training.campaign.status.draft', count: stats.draft },
    { value: 'completed', label: 'training.campaign.status.completed', count: stats.completed },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('training.campaign.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('training.campaign.description')}
          </p>
        </div>

        <Button onClick={onCreateCampaign}>
          <Plus className="w-4 h-4 mr-2" />
          {t('training.campaign.create')}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('training.campaign.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => {
            const isActive = statusFilter === btn.value;
            return (
              <button
                key={btn.value}
                onClick={() => setStatusFilter(btn.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-3xl text-sm font-medium transition-all ${isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-muted'
                  }`}
              >
                {t(btn.label)}
                {btn.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${isActive ? 'bg-white/20' : 'bg-muted'
                    }`}>
                    {btn.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={campaigns.length === 0
            ? t('training.empty.campaigns')
            : t('training.empty.noResults')
          }
          description={campaigns.length === 0
            ? t('training.empty.campaignsDesc')
            : t('training.empty.noResultsDesc')
          }
          actionLabel={campaigns.length === 0 ? t('training.campaign.create') : undefined}
          onAction={campaigns.length === 0 ? onCreateCampaign : undefined}
          secondaryActionLabel={campaigns.length > 0 ? t('common.clearFilters') : undefined}
          onSecondaryAction={campaigns.length > 0 ? () => {
            setSearchQuery('');
            setStatusFilter('all');
          } : undefined}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <AnimatePresence>
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                coursesCount={getCourseCount(campaign.courseIds)}
                onView={() => onViewCampaign(campaign)}
                onLaunch={onLaunchCampaign ? () => onLaunchCampaign(campaign) : undefined}
                onCancel={onCancelCampaign ? () => onCancelCampaign(campaign) : undefined}
                t={t}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

TrainingCampaignList.displayName = 'TrainingCampaignList';
