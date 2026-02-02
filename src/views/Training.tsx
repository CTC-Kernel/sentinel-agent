/**
 * Training View
 *
 * Main view for the Training & Awareness module.
 * Part of NIS2 Article 21.2(g) compliance.
 *
 * Features:
 * - Tab navigation: Dashboard, Catalog, My Training, Campaigns
 * - Role-based content visibility
 * - Responsive design
 *
 * @module views/Training
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  User,
  Megaphone,
} from '../components/ui/Icons';
import { useStore } from '../store';
import { hasPermission } from '../utils/permissions';
import { TrainingService } from '../services/TrainingService';
import { ErrorLogger } from '../services/errorLogger';
import { useTeamManagement } from '../hooks/useTeamManagement';
import { useAuth } from '../hooks/useAuth';
import type { TrainingCourse, TrainingCampaign } from '../types/training';
import type { TrainingCourseFormData } from '../schemas/trainingSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';

// Lazy load training components
const TrainingDashboard = React.lazy(() =>
  import('../components/training/TrainingDashboard').then(module => ({
    default: module.TrainingDashboard
  }))
);
const TrainingCatalog = React.lazy(() =>
  import('../components/training/TrainingCatalog').then(module => ({
    default: module.TrainingCatalog
  }))
);
const MyTrainingPage = React.lazy(() =>
  import('../components/training/MyTrainingPage').then(module => ({
    default: module.MyTrainingPage
  }))
);
const TrainingCampaignList = React.lazy(() =>
  import('../components/training/TrainingCampaignList').then(module => ({
    default: module.TrainingCampaignList
  }))
);
const TrainingCampaignForm = React.lazy(() =>
  import('../components/training/TrainingCampaignForm').then(module => ({
    default: module.TrainingCampaignForm
  }))
);
const TrainingCampaignDetail = React.lazy(() =>
  import('../components/training/TrainingCampaignDetail').then(module => ({
    default: module.TrainingCampaignDetail
  }))
);
const TrainingCourseForm = React.lazy(() =>
  import('../components/training/TrainingCourseForm').then(module => ({
    default: module.TrainingCourseForm
  }))
);
const TrainingAssignmentForm = React.lazy(() =>
  import('../components/training/TrainingAssignmentForm').then(module => ({
    default: module.TrainingAssignmentForm
  }))
);

// Types
type TabId = 'dashboard' | 'catalog' | 'my-training' | 'campaigns';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType<{ className?: string }>;
  adminOnly?: boolean;
}

// View state
type ViewState =
  | { type: 'list' }
  | { type: 'create-course' }
  | { type: 'edit-course'; course: TrainingCourse }
  | { type: 'assign-course'; course: TrainingCourse }
  | { type: 'create-campaign' }
  | { type: 'view-campaign'; campaign: TrainingCampaign };

export const Training: React.FC = () => {
  const { t, user, addToast } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { claimsSynced } = useAuth();
  const { users: teamUsers } = useTeamManagement(claimsSynced);

  // State
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get('tab');
    // Validate tab param
    const validTabs: TabId[] = ['dashboard', 'catalog', 'my-training', 'campaigns'];
    return (tabParam && validTabs.includes(tabParam as TabId)) ? (tabParam as TabId) : 'my-training';
  });
  const [viewState, setViewState] = useState<ViewState>({ type: 'list' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if user is admin
  const isAdmin = user ? hasPermission(user, 'User', 'manage') : false;

  // Tabs configuration
  const tabs: Tab[] = [
    { id: 'dashboard', label: t('training.dashboard_tab'), icon: LayoutDashboard, adminOnly: true },
    { id: 'catalog', label: t('training.catalog'), icon: BookOpen, adminOnly: true },
    { id: 'my-training', label: t('training.myCourses'), icon: User },
    { id: 'campaigns', label: t('training.campaigns'), icon: Megaphone, adminOnly: true },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabId | null;
    if (tabParam && visibleTabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams, visibleTabs]);

  // Handle tab change
  const handleTabChange = useCallback((tabId: string) => {
    const id = tabId as TabId;
    setActiveTab(id);
    setSearchParams({ tab: id });
    setViewState({ type: 'list' });
  }, [setSearchParams]);

  // Handle course form submit
  const handleCourseSubmit = useCallback(async (data: TrainingCourseFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      if (viewState.type === 'edit-course') {
        await TrainingService.updateCourse(viewState.course.id, data, user);
        addToast(t('training.success.courseUpdated'), 'success');
      } else {
        await TrainingService.createCourse(data, user);
        addToast(t('training.success.courseCreated'), 'success');
      }
      setViewState({ type: 'list' });
      setRefreshKey(k => k + 1);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'training.errors.createFailed');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, viewState, t, addToast]);

  // Handle archive course
  const handleArchiveCourse = useCallback(async (course: TrainingCourse) => {
    if (!user) return;

    try {
      await TrainingService.archiveCourse(course.id, user);
      addToast(t('training.success.courseArchived'), 'success');
      setRefreshKey(k => k + 1);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'training.errors.updateFailed');
    }
  }, [user, t, addToast]);

  // Handle campaign creation success
  const handleCampaignSuccess = useCallback((_campaignId: string) => {
    addToast(t('training.success.campaignCreated'), 'success');
    setViewState({ type: 'list' });
    setRefreshKey(k => k + 1);
  }, [t, addToast]);

  // Render tab content
  const renderContent = () => {
    // Handle non-list views first
    if (viewState.type === 'create-course' || viewState.type === 'edit-course') {
      return (
        <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
          <TrainingCourseForm
            onSubmit={handleCourseSubmit}
            onCancel={() => setViewState({ type: 'list' })}
            initialData={viewState.type === 'edit-course' ? viewState.course : null}
            isLoading={isSubmitting}
          />
        </React.Suspense>
      );
    }

    if (viewState.type === 'assign-course') {
      return (
        <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
          <TrainingAssignmentForm
            users={teamUsers}
            preselectedCourseId={viewState.course.id}
            onCancel={() => setViewState({ type: 'list' })}
            onSuccess={() => {
              addToast(t('training.success.assignmentCreated'), 'success');
              setViewState({ type: 'list' });
            }}
          />
        </React.Suspense>
      );
    }

    if (viewState.type === 'create-campaign') {
      return (
        <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
          <TrainingCampaignForm
            onSuccess={handleCampaignSuccess}
            onCancel={() => setViewState({ type: 'list' })}
          />
        </React.Suspense>
      );
    }

    if (viewState.type === 'view-campaign') {
      return (
        <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
          <TrainingCampaignDetail
            campaign={viewState.campaign}
            onBack={() => setViewState({ type: 'list' })}
          />
        </React.Suspense>
      );
    }

    // Render based on active tab
    switch (activeTab) {
      case 'dashboard':
        return (
          <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
            <TrainingDashboard key={refreshKey || 'unknown'} />
          </React.Suspense>
        );

      case 'catalog':
        return (
          <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
            <TrainingCatalog
              key={refreshKey || 'unknown'}
              onCreateCourse={() => setViewState({ type: 'create-course' })}
              onViewCourse={(course) => setViewState({ type: 'edit-course', course })}
              onEditCourse={(course) => setViewState({ type: 'edit-course', course })}
              onArchiveCourse={handleArchiveCourse}
              onAssignCourse={(course) => setViewState({ type: 'assign-course', course })}
              onRefresh={() => setRefreshKey(k => k + 1)}
              canEdit={!!isAdmin}
            />
          </React.Suspense>
        );

      case 'my-training':
        return (
          <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
            <MyTrainingPage key={refreshKey || 'unknown'} />
          </React.Suspense>
        );

      case 'campaigns':
        return (
          <React.Suspense fallback={<div className="animate-pulse h-96 bg-muted/20 rounded-2xl" />}>
            <TrainingCampaignList
              key={refreshKey || 'unknown'}
              onCreateCampaign={() => setViewState({ type: 'create-campaign' })}
              onViewCampaign={(campaign) => setViewState({ type: 'view-campaign', campaign })}
            />
          </React.Suspense>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="w-full px-2 sm:px-4 lg:px-8 py-6 max-w-[1800px] mx-auto flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
    >
      <MasterpieceBackground />
      <SEO title={t('training.title')} description={t('training.subtitle')} />

      <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
        {/* Header */}
        <motion.div variants={slideUpVariants}>
          <PageHeader
            title={t('training.title')}
            subtitle={t('training.subtitle')}
            icon={<GraduationCap className="w-12 h-12 text-primary" />}
            trustType="availability"
            actions={
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <span>NIS2</span>
                <span className="text-primary/60">|</span>
                <span>{t('training.nis2.article')}</span>
              </div>
            }
          />
        </motion.div>

        {/* Tabs - Only show when in list view */}
        {viewState.type === 'list' && (
          <motion.div variants={slideUpVariants}>
            <ScrollableTabs
              tabs={visibleTabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              className="mb-6"
            />
          </motion.div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewState.type === 'list' ? activeTab : viewState.type || 'unknown'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Training;
