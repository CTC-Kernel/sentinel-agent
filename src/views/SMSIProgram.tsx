
/**
 * SMSI Program View (ISO 27003)
 * Main view for managing the PDCA-based Information Security Management System program
 *
 * Story 20.1: Création programme SMSI
 * Story 20.2: Définition des jalons
 * Story 20.4: Attribution des responsables
 */

import React, { useState, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSMSIProgram } from '../hooks/smsi/useSMSIProgram';
import { useTeamData } from '../hooks/team/useTeamData';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import {
  Calendar,
  Shield,
  LayoutDashboard,
  List,
  Download,
  Settings,
  BarChart3,
  ChevronRight,
  AlertTriangle
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { EbiosReportService } from '../services/EbiosReportService';
import { SMSIService } from '../services/SMSIService';
import { SMSIPremiumStats } from '../components/smsi/SMSIPremiumStats';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { SMSIDrawer } from '../components/smsi/SMSIDrawer';
import { SMSIDashboard } from '../components/smsi/SMSIDashboard';
import { SMSIMilestoneList } from '../components/smsi/SMSIMilestoneList';
import { SMSIInspector } from '../components/smsi/SMSIInspector';
import { MilestoneFormDrawer } from '../components/smsi/MilestoneFormDrawer';
import { SMSIMaturityDashboard } from '../components/smsi/SMSIMaturityDashboard';
import { Milestone, PDCAPhase, SMSIProgram } from '../types/ebios';
import { GlassCard } from '../components/ui/GlassCard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { cn } from '../utils/cn';
import { PHASE_CONFIG, PHASE_STYLES } from '../components/smsi/constants';

// Lazy load the create program modal (REMOVED: Using Drawer now)
// const CreateProgramModal = React.lazy(() => import('../components/smsi/CreateProgramModal'));
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

export const SMSIProgramView: React.FC = () => {
  const { t } = useTranslation();
  const {
    program,
    milestones,
    loading,
    createProgram,
    updateProgram,
    deleteProgram,
    advancePhase,
    createMilestone,
    updateMilestone,
    getMilestonesByPhase,
    getOverdueMilestones,
    getUpcomingMilestones,
    getPhaseProgress,
    updateMilestoneStatus,
    deleteMilestone
  } = useSMSIProgram();

  const { users } = useTeamData();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [isMilestoneDrawerOpen, setIsMilestoneDrawerOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'planning' | 'timeline' | 'maturity'>('overview');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [showDeleteProgramConfirm, setShowDeleteProgramConfirm] = useState(false);
  const [isDeletingProgram, setIsDeletingProgram] = useState(false);
  const [showAdvancePhaseConfirm, setShowAdvancePhaseConfirm] = useState(false);

  // Derive selected milestone from milestones list
  const selectedMilestone = useMemo(() =>
    milestones.find(m => m.id === selectedMilestoneId) || null,
    [milestones, selectedMilestoneId]);

  // Transform users to team members format for the milestone form
  const teamMembers = useMemo(() =>
    users.map(u => ({
      id: u.id,
      displayName: u.displayName || '',
      email: u.email || ''
    })),
    [users]);


  const handleCreateProgram = async (data: { name: string; description?: string; targetCertificationDate?: string; template?: 'standard' | 'fast-track' | 'maintenance' }) => {
    await createProgram(data);
    setIsDrawerOpen(false);
  };

  const handleUpdateProgram = async (data: { name: string; description?: string; targetCertificationDate?: string }) => {
    await updateProgram(data);
    setIsEditingProgram(false);
    setIsDrawerOpen(false);
  };

  const handleDeleteProgram = async () => {
    setIsDeletingProgram(true);
    try {
      await deleteProgram();
      setShowDeleteProgramConfirm(false);
    } finally {
      setIsDeletingProgram(false);
    }
  };

  const handleAdvancePhase = async () => {
    await advancePhase();
    setShowAdvancePhaseConfirm(false);
  };

  const handleDeleteMilestone = async (id: string) => {
    await deleteMilestone(id);
  };

  const handleStatusChange = async (id: string, status: Milestone['status']) => {
    await updateMilestoneStatus(id, status);
  };

  // Story 20.2: Milestone creation/editing handlers
  const handleAddMilestone = () => {
    setEditingMilestone(null);
    setIsMilestoneDrawerOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setIsMilestoneDrawerOpen(true);
    setSelectedMilestoneId(null); // Close inspector when editing
  };

  const handleMilestoneSubmit = async (data: {
    name: string;
    description?: string;
    phase: PDCAPhase;
    dueDate: string;
    responsibleId?: string;
  }) => {
    setMilestoneLoading(true);
    try {
      if (editingMilestone) {
        // Update existing milestone
        await updateMilestone(editingMilestone.id, {
          name: data.name,
          description: data.description,
          phase: data.phase,
          dueDate: data.dueDate,
          responsibleId: data.responsibleId,
        });
      } else {
        // Create new milestone
        await createMilestone({
          name: data.name,
          description: data.description,
          phase: data.phase,
          dueDate: data.dueDate,
          responsibleId: data.responsibleId,
        });
      }
      setIsMilestoneDrawerOpen(false);
      setEditingMilestone(null);
    } finally {
      setMilestoneLoading(false);
    }
  };

  // Story 20.5: Download SMSI progress report
  const handleDownloadReport = () => {
    if (!program) return;
    EbiosReportService.downloadSMSIProgressReport(program, milestones);
  };

  const tabs = useMemo(() => [
    { id: 'overview', label: t('smsi.tabs.overview') || 'Vue d\'ensemble', icon: LayoutDashboard },
    { id: 'planning', label: t('smsi.tabs.planning') || 'Jalons', icon: List },
    { id: 'timeline', label: 'Timeline', icon: BarChart3 },
    { id: 'maturity', label: t('smsi.tabs.maturity') || 'Maturité', icon: Shield },
  ], [t]);

  // Get upcoming milestones for alerts
  const upcomingMilestones = getUpcomingMilestones(7);

  // Get next phase
  const getNextPhase = (): PDCAPhase | null => {
    if (!program) return null;
    const phaseOrder: PDCAPhase[] = ['plan', 'do', 'check', 'act'];
    const currentIndex = phaseOrder.indexOf(program.currentPhase);
    if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) return null;
    return phaseOrder[currentIndex + 1];
  };

  const nextPhase = getNextPhase();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6">
        <MasterpieceBackground />
        <PageHeader
          title={t('smsi.title')}
          subtitle={t('smsi.subtitle')}
          icon={
            <img
              src="/images/pilotage.png"
              alt="PILOTAGE"
              className="w-full h-full object-contain"
            />
          }
        />
        <div className="mt-8">
          <EmptyState
            icon={Shield}
            title={t('smsi.emptyTitle')}
            description={t('smsi.emptyDescription')}
            actionLabel={t('smsi.createProgram')}
            onAction={() => setIsDrawerOpen(true)}
          />
        </div>

        <SMSIDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSubmit={handleCreateProgram}
        />
      </div>
    );
  }

  const overdueMilestones = getOverdueMilestones();

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="visible"
      className="p-6 flex flex-col gap-6"
    >
      <MasterpieceBackground />
      <PageHeader
        title={program.name}
        subtitle={`${t('smsi.title')} - ${t('smsi.pdcaCycle')}`}
        icon={
          <img
            src="/images/pilotage.png"
            alt="PILOTAGE"
            className="w-full h-full object-contain"
          />
        }
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              {t('smsi.report') || 'Rapport'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditingProgram(true);
                setIsDrawerOpen(true);
              }}
              className="gap-1.5"
            >
              <Settings className="w-4 h-4" />
              Paramètres
            </Button>
            {nextPhase && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAdvancePhaseConfirm(true)}
                className="gap-1.5"
              >
                <ChevronRight className="w-4 h-4" />
                Passer à {PHASE_CONFIG[nextPhase].label}
              </Button>
            )}
            {program.targetCertificationDate && (
              <Badge variant="outline" className="gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {t('smsi.objective') || 'Objectif'}: {new Date(program.targetCertificationDate).toLocaleDateString('fr-FR')}
              </Badge>
            )}
            <Badge
              status={program.status === 'active' ? 'success' : program.status === 'paused' ? 'warning' : 'info'}
            >
              {program.status === 'active' ? 'Actif' : program.status === 'paused' ? 'En pause' : 'Terminé'}
            </Badge>
          </div>
        }
      />

      {/* Stats Dashboard */}
      <SMSIPremiumStats program={program} overdueCount={overdueMilestones.length} />

      <ScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'overview' | 'planning' | 'timeline' | 'maturity')}
      />

      {/* Upcoming Milestones Alert */}
      {upcomingMilestones.length > 0 && (
        <GlassCard className="p-4 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                {upcomingMilestones.length} jalon{upcomingMilestones.length > 1 ? 's' : ''} à venir cette semaine
              </h4>
              <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                {upcomingMilestones.map(m => m.name).join(', ')}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            exit="exit"
          >
            <SMSIDashboard
              program={program}
              getMilestonesByPhase={getMilestonesByPhase}
              getOverdueMilestones={getOverdueMilestones}
            />
          </motion.div>
        )}

        {activeTab === 'planning' && (
          <motion.div
            key="planning"
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            exit="exit"
          >
            <SMSIMilestoneList
              milestones={milestones}
              onSelect={(milestone) => setSelectedMilestoneId(milestone.id)}
              onAddMilestone={handleAddMilestone}
            />
          </motion.div>
        )}

        {activeTab === 'timeline' && (
          <motion.div
            key="timeline"
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            exit="exit"
          >
            <SMSITimeline
              milestones={milestones}
              program={program}
              onSelect={(milestone) => setSelectedMilestoneId(milestone.id)}
              getPhaseProgress={getPhaseProgress}
            />
          </motion.div>
        )}

        {activeTab === 'maturity' && (
          <motion.div
            key="maturity"
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            exit="exit"
          >
            <SMSIMaturityDashboard
              program={program}
              milestones={milestones}
              onDownloadCertificationReport={() => {
                SMSIService.downloadCertificationReport(program, milestones, {
                  includeRecommendations: true,
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <SMSIInspector
          isOpen={!!selectedMilestone}
          onClose={() => setSelectedMilestoneId(null)}
          milestone={selectedMilestone}
          onStatusChange={handleStatusChange}
          onEdit={handleEditMilestone}
          onDelete={handleDeleteMilestone}
          teamMembers={teamMembers}
        />
      </Suspense>

      {/* Story 20.2 & 20.4: Milestone creation/editing drawer */}
      <MilestoneFormDrawer
        isOpen={isMilestoneDrawerOpen}
        onClose={() => {
          setIsMilestoneDrawerOpen(false);
          setEditingMilestone(null);
        }}
        milestone={editingMilestone}
        onSubmit={handleMilestoneSubmit}
        isLoading={milestoneLoading}
        teamMembers={teamMembers}
      />

      {/* Program Settings Drawer */}
      <SMSIDrawer
        isOpen={isDrawerOpen && isEditingProgram}
        onClose={() => {
          setIsDrawerOpen(false);
          setIsEditingProgram(false);
        }}
        program={program}
        onSubmit={handleUpdateProgram}
      />

      {/* Advance Phase Confirmation */}
      {nextPhase && (
        <ConfirmModal
          isOpen={showAdvancePhaseConfirm}
          onClose={() => setShowAdvancePhaseConfirm(false)}
          onConfirm={handleAdvancePhase}
          title="Passer à la phase suivante"
          message={`Êtes-vous sûr de vouloir passer de la phase "${PHASE_CONFIG[program.currentPhase].label}" à la phase "${PHASE_CONFIG[nextPhase].label}" ? Assurez-vous que tous les jalons de la phase actuelle sont terminés.`}
          confirmText={`Passer à ${PHASE_CONFIG[nextPhase].label}`}
          cancelText="Annuler"
          type="info"
        />
      )}

      {/* Delete Program Confirmation */}
      <ConfirmModal
        isOpen={showDeleteProgramConfirm}
        onClose={() => setShowDeleteProgramConfirm(false)}
        onConfirm={handleDeleteProgram}
        title="Supprimer le programme SMSI"
        message="Êtes-vous sûr de vouloir supprimer ce programme SMSI ? Cette action supprimera également tous les jalons associés et est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        loading={isDeletingProgram}
      />
    </motion.div>
  );
};

// Timeline component for visualizing milestones
interface SMSITimelineProps {
  milestones: Milestone[];
  program: SMSIProgram;
  onSelect: (milestone: Milestone) => void;
  getPhaseProgress: (phase: PDCAPhase) => number;
}

const SMSITimeline: React.FC<SMSITimelineProps> = ({ milestones, program, onSelect, getPhaseProgress }) => {
  const phases: PDCAPhase[] = ['plan', 'do', 'check', 'act'];

  // Group milestones by phase
  const milestonesByPhase = phases.reduce((acc, phase) => {
    acc[phase] = milestones.filter(m => m.phase === phase).sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    return acc;
  }, {} as Record<PDCAPhase, Milestone[]>);

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">Timeline du Programme SMSI</h3>

      <div className="space-y-6 sm:space-y-8">
        {phases.map((phase, phaseIndex) => {
          const config = PHASE_CONFIG[phase];
          const style = PHASE_STYLES[phase];
          const isCurrentPhase = program.currentPhase === phase;
          const progress = getPhaseProgress(phase);
          const phaseMilestones = milestonesByPhase[phase];
          const PhaseIcon = config.icon as React.ComponentType<{ className?: string }>;

          return (
            <div key={phase} className="relative">
              {/* Phase Header */}
              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 mb-4",
                isCurrentPhase ? `${style.borderActive} ${style.bgActive}` : "border-slate-200 dark:border-slate-700"
              )}>
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", style.iconBg)}>
                  <PhaseIcon className={cn("w-6 h-6", style.iconText)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className={cn("font-bold", isCurrentPhase ? style.textActive : "text-slate-700 dark:text-slate-300")}>
                      {config.label}
                    </h4>
                    {isCurrentPhase && (
                      <Badge status="info" size="sm">Phase actuelle</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{progress}%</div>
                  <div className="text-xs text-muted-foreground">Progression</div>
                </div>
              </div>

              {/* Milestones */}
              {phaseMilestones.length > 0 ? (
                <div className="ml-6 border-l-2 border-slate-200 dark:border-slate-700 pl-6 space-y-3">
                  {phaseMilestones.map((milestone) => {
                    const isOverdue = milestone.status !== 'completed' && new Date(milestone.dueDate) < new Date();
                    const isCompleted = milestone.status === 'completed';

                    return (
                      <motion.div
                        key={milestone.id}
                        className={cn(
                          "relative flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]",
                          isOverdue ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10" :
                            isCompleted ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10" :
                              "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        )}
                        onClick={() => onSelect(milestone)}
                        whileHover={{ x: 4 }}
                      >
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-[30px] w-4 h-4 rounded-full border-2",
                          isCompleted ? "bg-green-500 border-green-500" :
                            isOverdue ? "bg-red-500 border-red-500" :
                              "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                        )} />

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium",
                              isOverdue ? "text-red-700 dark:text-red-400" :
                                isCompleted ? "text-green-700 dark:text-green-400" :
                                  "text-slate-900 dark:text-white"
                            )}>
                              {milestone.name}
                            </span>
                            {isCompleted && (
                              <Badge status="success" size="sm">Terminé</Badge>
                            )}
                            {isOverdue && (
                              <Badge status="error" size="sm">En retard</Badge>
                            )}
                          </div>
                          {milestone.description && (
                            <p className="text-sm text-muted-foreground truncate">{milestone.description}</p>
                          )}
                        </div>

                        <div className="text-right text-sm">
                          <div className={cn(
                            "font-medium",
                            isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                          )}>
                            {new Date(milestone.dueDate).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="ml-6 border-l-2 border-slate-200 dark:border-slate-700 pl-6 py-4">
                  <p className="text-sm text-muted-foreground italic">Aucun jalon pour cette phase</p>
                </div>
              )}

              {/* Connector to next phase */}
              {phaseIndex < phases.length - 1 && (
                <div className="flex justify-center my-4">
                  <ChevronRight className="w-6 h-6 text-slate-300 dark:text-slate-600 rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};

export default SMSIProgramView;
