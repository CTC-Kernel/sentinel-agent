/**
 * SMSI Program View (ISO 27003)
 * Main view for managing the PDCA-based Information Security Management System program
 */

import React, { useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useSMSIProgram } from '../hooks/smsi/useSMSIProgram';
import { PageHeader } from '../components/layout/PageHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';
import type { PDCAPhase, Milestone, SMSIProgram as SMSIProgramType } from '../types/ebios';
import {
  Target,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ChevronRight,
  Calendar,
  Users,
  TrendingUp,
  Shield,
  PlayCircle,
  Settings2,
  BarChart3,
} from 'lucide-react';

// Lazy load the create program modal
const CreateProgramModal = React.lazy(() => import('../components/smsi/CreateProgramModal'));

const PHASE_CONFIG: Record<PDCAPhase, { label: string; color: string; icon: React.ElementType; description: string }> = {
  plan: {
    label: 'Plan',
    color: 'blue',
    icon: Target,
    description: 'Identification du contexte, politique SMSI, appréciation des risques',
  },
  do: {
    label: 'Do',
    color: 'emerald',
    icon: PlayCircle,
    description: 'Mise en oeuvre du plan de traitement des risques, sensibilisation',
  },
  check: {
    label: 'Check',
    color: 'amber',
    icon: BarChart3,
    description: 'Audits internes, revue de direction, mesure de performance',
  },
  act: {
    label: 'Act',
    color: 'purple',
    icon: Settings2,
    description: 'Actions correctives, amélioration continue, ajustements',
  },
};

const MILESTONE_STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'slate', icon: Clock },
  in_progress: { label: 'En cours', color: 'blue', icon: TrendingUp },
  completed: { label: 'Terminé', color: 'emerald', icon: CheckCircle2 },
  overdue: { label: 'En retard', color: 'red', icon: AlertTriangle },
};

export const SMSIProgramView: React.FC = () => {
  const { t } = useTranslation();
  const {
    program,
    milestones,
    loading,
    createProgram,
    getMilestonesByPhase,
    getOverdueMilestones,
  } = useSMSIProgram();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<PDCAPhase | null>(null);

  const handleCreateProgram = async (data: { name: string; description?: string; targetCertificationDate?: string }) => {
    await createProgram(data);
    setShowCreateModal(false);
  };

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
        <PageHeader
          title="Programme SMSI"
          subtitle="Gestion du Système de Management de la Sécurité de l'Information (ISO 27003)"
        />
        <div className="mt-8">
          <EmptyState
            icon={Shield}
            title="Aucun programme SMSI"
            description="Créez votre premier programme SMSI pour commencer à gérer votre système de management selon le cycle PDCA."
            actionLabel="Créer un programme"
            onAction={() => setShowCreateModal(true)}
          />
        </div>

        <Suspense fallback={null}>
          {showCreateModal && (
            <CreateProgramModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSubmit={handleCreateProgram}
            />
          )}
        </Suspense>
      </div>
    );
  }

  const overdueMilestones = getOverdueMilestones();

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={program.name}
        subtitle="Programme SMSI - Cycle PDCA (ISO 27003)"
        actions={
          <div className="flex items-center gap-3">
            {program.targetCertificationDate && (
              <Badge variant="outline" className="gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Objectif: {new Date(program.targetCertificationDate).toLocaleDateString('fr-FR')}
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

      {/* Progress Overview */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Progression globale</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cycle PDCA du programme SMSI</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{program.overallProgress}%</div>
            <div className="text-sm text-gray-500">de complétion</div>
          </div>
        </div>

        {/* PDCA Progress Ring */}
        <div className="flex items-center justify-center gap-4 py-6">
          {(['plan', 'do', 'check', 'act'] as PDCAPhase[]).map((phase, index) => {
            const config = PHASE_CONFIG[phase];
            const phaseData = program.phases[phase];
            const Icon = config.icon;
            const isCurrentPhase = program.currentPhase === phase;
            const phaseMilestones = getMilestonesByPhase(phase);

            return (
              <React.Fragment key={phase}>
                <motion.button
                  onClick={() => setSelectedPhase(selectedPhase === phase ? null : phase)}
                  className={cn(
                    "relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all",
                    "w-36 min-h-[140px]",
                    isCurrentPhase
                      ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
                    selectedPhase === phase && "ring-2 ring-offset-2 ring-blue-500"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isCurrentPhase && (
                    <div className={`absolute -top-2 -right-2 w-5 h-5 bg-${config.color}-500 rounded-full flex items-center justify-center`}>
                      <ChevronRight className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
                    `bg-${config.color}-100 dark:bg-${config.color}-900/30`
                  )}>
                    <Icon className={`w-6 h-6 text-${config.color}-600 dark:text-${config.color}-400`} />
                  </div>

                  <span className={cn(
                    "text-sm font-bold",
                    isCurrentPhase
                      ? `text-${config.color}-600 dark:text-${config.color}-400`
                      : "text-gray-600 dark:text-gray-400"
                  )}>
                    {config.label}
                  </span>

                  <span className="text-xs text-gray-500 mt-1">
                    {phaseData.progress}%
                  </span>

                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <span>{phaseMilestones.length} jalons</span>
                  </div>
                </motion.button>

                {index < 3 && (
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </GlassCard>

      {/* Alerts for Overdue Milestones */}
      {overdueMilestones.length > 0 && (
        <GlassCard className="p-4 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-700 dark:text-red-400">
                {overdueMilestones.length} jalon{overdueMilestones.length > 1 ? 's' : ''} en retard
              </h4>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                {overdueMilestones.map(m => m.name).join(', ')}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Phase Details */}
      <AnimatePresence mode="wait">
        {selectedPhase && (
          <motion.div
            key={selectedPhase}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <PhaseDetailsPanel
              phase={selectedPhase}
              program={program}
              milestones={getMilestonesByPhase(selectedPhase)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestones Timeline */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Jalons du programme</h3>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Ajouter un jalon
          </Button>
        </div>

        {milestones.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun jalon défini. Ajoutez des jalons pour suivre l'avancement du programme.
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

interface PhaseDetailsPanelProps {
  phase: PDCAPhase;
  program: SMSIProgramType;
  milestones: Milestone[];
}

const PhaseDetailsPanel: React.FC<PhaseDetailsPanelProps> = ({ phase, program, milestones }) => {
  const config = PHASE_CONFIG[phase];
  const phaseData = program.phases[phase];
  const Icon = config.icon;

  const completedMilestones = milestones.filter(m => m.status === 'completed').length;

  return (
    <GlassCard className={`p-6 border-${config.color}-200 dark:border-${config.color}-900`}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0",
          `bg-${config.color}-100 dark:bg-${config.color}-900/30`
        )}>
          <Icon className={`w-7 h-7 text-${config.color}-600 dark:text-${config.color}-400`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Phase {config.label}</h3>
            <Badge
              status={
                phaseData.status === 'completed' ? 'success' :
                phaseData.status === 'in_progress' ? 'info' : 'warning'
              }
            >
              {phaseData.status === 'completed' ? 'Terminée' :
               phaseData.status === 'in_progress' ? 'En cours' : 'Non démarrée'}
            </Badge>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">{config.description}</p>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{phaseData.progress}%</div>
              <div className="text-sm text-gray-500">Progression</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{completedMilestones}/{milestones.length}</div>
              <div className="text-sm text-gray-500">Jalons</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                {phaseData.responsibleId ? (
                  <Users className="w-5 h-5 text-blue-500" />
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className="text-sm text-gray-500">Responsable</div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

interface MilestoneCardProps {
  milestone: Milestone;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone }) => {
  const phaseConfig = PHASE_CONFIG[milestone.phase];
  const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status];
  const StatusIcon = statusConfig.icon;

  const dueDate = new Date(milestone.dueDate);
  const isOverdue = milestone.status !== 'completed' && dueDate < new Date();

  return (
    <motion.div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md",
        isOverdue
          ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
      )}
      whileHover={{ x: 4 }}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
        `bg-${phaseConfig.color}-100 dark:bg-${phaseConfig.color}-900/30`
      )}>
        <phaseConfig.icon className={`w-5 h-5 text-${phaseConfig.color}-600 dark:text-${phaseConfig.color}-400`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">{milestone.name}</h4>
          <Badge variant="outline" size="sm">
            {phaseConfig.label}
          </Badge>
        </div>
        {milestone.description && (
          <p className="text-sm text-gray-500 truncate mt-0.5">{milestone.description}</p>
        )}
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <div className={cn(
            "text-sm font-medium",
            isOverdue ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
          )}>
            {dueDate.toLocaleDateString('fr-FR')}
          </div>
          <div className="text-xs text-gray-400">Échéance</div>
        </div>

        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium",
          `bg-${statusConfig.color}-100 dark:bg-${statusConfig.color}-900/30`,
          `text-${statusConfig.color}-700 dark:text-${statusConfig.color}-400`
        )}>
          <StatusIcon className="w-4 h-4" />
          {statusConfig.label}
        </div>
      </div>
    </motion.div>
  );
};

export default SMSIProgramView;
