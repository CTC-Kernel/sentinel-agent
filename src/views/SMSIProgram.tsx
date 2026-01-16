
/**
 * SMSI Program View (ISO 27003)
 * Main view for managing the PDCA-based Information Security Management System program
 */

import React, { useState, Suspense, useMemo, useEffect } from 'react';
import { useSMSIProgram } from '../hooks/smsi/useSMSIProgram';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import {
  Calendar,
  Shield,
  LayoutDashboard,
  List
} from 'lucide-react';
import { SMSIStatsWidget } from '../components/smsi/SMSIStatsWidget';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { SMSIDashboard } from '../components/smsi/SMSIDashboard';
import { SMSIMilestoneList } from '../components/smsi/SMSIMilestoneList';
import { SMSIInspector } from '../components/smsi/SMSIInspector';
import { Milestone } from '../types/ebios';

// Lazy load the create program modal
const CreateProgramModal = React.lazy(() => import('../components/smsi/CreateProgramModal'));

export const SMSIProgramView: React.FC = () => {
  const {
    program,
    milestones,
    loading,
    createProgram,
    getMilestonesByPhase,
    getOverdueMilestones,
    updateMilestoneStatus
  } = useSMSIProgram();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'planning'>('overview');
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Update selected milestone when milestones list changes (e.g. after status update)
  useEffect(() => {
    if (selectedMilestone) {
      const updated = milestones.find(m => m.id === selectedMilestone.id);
      if (updated) {
        setSelectedMilestone(updated);
      }
    }
  }, [milestones, selectedMilestone?.id]);


  const handleCreateProgram = async (data: { name: string; description?: string; targetCertificationDate?: string }) => {
    await createProgram(data);
    setShowCreateModal(false);
  };

  const handleStatusChange = async (id: string, status: Milestone['status']) => {
    await updateMilestoneStatus(id, status);
  };

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { id: 'planning', label: 'Planning & Jalons', icon: List },
  ], []);

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
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="visible"
      className="p-6 space-y-6"
    >
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

      {/* Stats Dashboard */}
      <SMSIStatsWidget program={program} overdueCount={overdueMilestones.length} />

      <ScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'overview' | 'planning')}
      />

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
              onSelect={setSelectedMilestone}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <SMSIInspector
          isOpen={!!selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          milestone={selectedMilestone}
          onStatusChange={handleStatusChange}
        />
      </Suspense>
    </motion.div>
  );
};

export default SMSIProgramView;
