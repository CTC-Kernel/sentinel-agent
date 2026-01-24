/**
 * EBIOS Analyses List View
 * Main page for managing EBIOS RM analyses
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ShieldCheck,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Copy,
  Archive,
} from '../components/ui/Icons';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/ui/PageHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { ProgressRing } from '../components/ui/ProgressRing';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { EbiosService } from '../services/ebiosService';
import { toast } from '@/lib/toast';
import { cn } from '../utils/cn';
import { ErrorLogger } from '../services/errorLogger';
import type { EbiosAnalysis, EbiosAnalysisStatus } from '../types/ebios';

import { EbiosStatsWidget } from '../components/ebios/EbiosStatsWidget';

// Create Analysis Inspector
const CreateAnalysisDrawer = React.lazy(() => import('../components/ebios/CreateAnalysisDrawer'));

export const EbiosAnalyses: React.FC = () => {
  const { t } = useStore();
  const { user } = useAuth();
  const organizationId = user?.organizationId;
  const navigate = useNavigate();

  // State
  const [analyses, setAnalyses] = useState<EbiosAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EbiosAnalysisStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<EbiosAnalysis | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Fetch analyses
  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!organizationId) return;

      try {
        setLoading(true);
        const data = await EbiosService.listAnalyses(organizationId);
        setAnalyses(data);
      } catch (error) {
        ErrorLogger.error(error, 'EbiosAnalyses.fetchAnalyses');
        toast.error(t('ebios.errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [organizationId, t]);

  // Filter analyses
  const filteredAnalyses = analyses.filter((analysis) => {
    const matchesSearch =
      searchQuery === '' ||
      analysis.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      analysis.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleCreateAnalysis = useCallback(async (data: { name: string; description?: string; sector?: string; targetCertificationDate?: string }) => {
    if (!organizationId || !user?.uid) return;

    try {
      const newAnalysis = await EbiosService.createAnalysis(
        organizationId,
        data,
        user.uid
      );
      setAnalyses((prev) => [newAnalysis, ...prev]);
      setShowCreateModal(false);
      toast.success(t('ebios.analysisCreated'));
      navigate(`/ebios/${newAnalysis.id}`);
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalyses.handleCreateAnalysis');
      toast.error(t('ebios.errors.createFailed'));
    }
  }, [organizationId, user?.uid, t, navigate]);

  const handleDeleteAnalysis = useCallback(async () => {
    if (!organizationId || !selectedAnalysis) return;

    try {
      await EbiosService.deleteAnalysis(organizationId, selectedAnalysis.id);
      setAnalyses((prev) => prev.filter((a) => a.id !== selectedAnalysis.id));
      setShowDeleteConfirm(false);
      setSelectedAnalysis(null);
      toast.success(t('ebios.analysisDeleted'));
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalyses.handleDeleteAnalysis');
      toast.error(t('ebios.errors.deleteFailed'));
    }
  }, [organizationId, selectedAnalysis, t]);

  const handleArchiveAnalysis = useCallback(async (analysis: EbiosAnalysis) => {
    if (!organizationId || !user?.uid) return;

    try {
      await EbiosService.updateAnalysis(organizationId, analysis.id, { status: 'archived' }, user.uid);
      setAnalyses((prev) =>
        prev.map((a) => (a.id === analysis.id ? { ...a, status: 'archived' as const } : a))
      );
      toast.success(t('ebios.analysisArchived'));
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalyses.handleArchiveAnalysis');
      toast.error(t('ebios.errors.archiveFailed'));
    }
  }, [organizationId, user?.uid, t]);

  const handleDuplicateAnalysis = useCallback(async (analysis: EbiosAnalysis) => {
    if (!organizationId || !user?.uid) return;

    try {
      const duplicated = await EbiosService.duplicateAnalysis(organizationId, analysis.id, user.uid);
      setAnalyses((prev) => [duplicated, ...prev]);
      toast.success(t('ebios.analysisDuplicated'));
    } catch (error) {
      ErrorLogger.error(error, 'EbiosAnalyses.handleDuplicateAnalysis');
      toast.error(t('ebios.errors.duplicateFailed'));
    }
  }, [organizationId, user?.uid, t]);

  const getStatusColor = (status: EbiosAnalysisStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'archived':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
      default:
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    }
  };

  const getStatusLabel = (status: EbiosAnalysisStatus) => {
    const labels: Record<EbiosAnalysisStatus, string> = {
      draft: t('ebios.status.draft'),
      in_progress: t('ebios.status.inProgress'),
      completed: t('ebios.status.completed'),
      archived: t('ebios.status.archived'),
    };
    return labels[status];
  };

  return (
    <div className="min-h-screen">
      <MasterpieceBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          title={t('ebios.title')}
          subtitle={t('ebios.description')}
          icon={
            <img
              src="/images/gouvernance.png"
              alt="EBIOS"
              className="w-full h-full object-contain"
            />
          }
          actions={
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 transition-all"
            >
              <Plus className="w-5 h-5" />
              {t('ebios.newAnalysis')}
            </button>
          }
        />

        {/* Stats Dashboard */}
        <div className="mt-8">
          <EbiosStatsWidget analyses={analyses} />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ebios.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EbiosAnalysisStatus | 'all')}
              className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-white"
            >
              <option value="all">{t('ebios.allStatuses')}</option>
              <option value="draft">{t('ebios.status.draft')}</option>
              <option value="in_progress">{t('ebios.status.inProgress')}</option>
              <option value="completed">{t('ebios.status.completed')}</option>
              <option value="archived">{t('ebios.status.archived')}</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={searchQuery || statusFilter !== 'all' ? t('ebios.noResultsTitle') : t('ebios.emptyTitle')}
            description={searchQuery || statusFilter !== 'all' ? t('ebios.noResultsDescription') : t('ebios.emptyDescription')}
            actionLabel={!searchQuery && statusFilter === 'all' ? t('ebios.createFirstAnalysis') : undefined}
            onAction={!searchQuery && statusFilter === 'all' ? () => setShowCreateModal(true) : undefined}
          />
        ) : (
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filteredAnalyses.map((analysis) => (
                <motion.div
                  key={analysis.id}
                  variants={slideUpVariants}
                  layout
                >
                  <GlassCard
                    hoverEffect
                    className="relative cursor-pointer"
                    onClick={() => navigate(`/ebios/${analysis.id}`)}
                  >
                    {/* Action Menu */}
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuOpen(actionMenuOpen === analysis.id ? null : analysis.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {actionMenuOpen === analysis.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateAnalysis(analysis);
                              setActionMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Copy className="w-4 h-4" />
                            {t('common.duplicate')}
                          </button>
                          {analysis.status !== 'archived' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveAnalysis(analysis);
                                setActionMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <Archive className="w-4 h-4" />
                              {t('common.archive')}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnalysis(analysis);
                              setShowDeleteConfirm(true);
                              setActionMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex items-start gap-4">
                      <ProgressRing
                        progress={analysis.completionPercentage}
                        size={60}
                        strokeWidth={5}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate pr-8">
                          {analysis.name}
                        </h3>
                        {analysis.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                            {analysis.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status & Workshop */}
                    <div className="mt-4 flex items-center justify-between">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        getStatusColor(analysis.status)
                      )}>
                        {getStatusLabel(analysis.status)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {t('ebios.workshop')} {analysis.currentWorkshop}/5
                      </span>
                    </div>

                    {/* Workshop Progress Bar */}
                    <div className="mt-3 flex gap-1">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const workshop = analysis.workshops[num as 1 | 2 | 3 | 4 | 5];
                        return (
                          <div
                            key={num}
                            className={cn(
                              "flex-1 h-1.5 rounded-full",
                              workshop.status === 'validated' ? "bg-purple-500" :
                                workshop.status === 'completed' ? "bg-green-500" :
                                  workshop.status === 'in_progress' ? "bg-blue-500" :
                                    "bg-slate-200 dark:bg-slate-700"
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Metadata */}
                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('ebios.updatedAt', { date: new Date(analysis.updatedAt).toLocaleDateString() })}</span>
                      {analysis.sector && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {analysis.sector}
                        </span>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Create Inspector */}
      {showCreateModal && (
        <React.Suspense fallback={<Spinner />}>
          <CreateAnalysisDrawer
            isOpen={true}
            onSave={handleCreateAnalysis}
            onClose={() => setShowCreateModal(false)}
          />
        </React.Suspense>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t('ebios.deleteConfirmTitle')}
        message={t('ebios.deleteConfirmMessage', { name: selectedAnalysis?.name })}
        confirmText={t('common.delete')}
        type="danger"
        onConfirm={handleDeleteAnalysis}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedAnalysis(null);
        }}
      />
    </div>
  );
};

export default EbiosAnalyses;
