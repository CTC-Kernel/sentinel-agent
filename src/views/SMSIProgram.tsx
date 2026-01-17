
/**
 * SMSI Program View (ISO 27003)
 * Main view for managing the PDCA-based Information Security Management System program
 *
 * Story 20.1: Création programme SMSI
 * Story 20.2: Définition des jalons
 * Story 20.4: Attribution des responsables
 */

import React, { useState, Suspense, useMemo } from 'react';
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
  Download
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { EbiosReportService } from '../services/EbiosReportService';
import { SMSIStatsWidget } from '../components/smsi/SMSIStatsWidget';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { SMSIDrawer } from '../components/smsi/SMSIDrawer';
import { SMSIDashboard } from '../components/smsi/SMSIDashboard';
import { SMSIMilestoneList } from '../components/smsi/SMSIMilestoneList';
import { SMSIInspector } from '../components/smsi/SMSIInspector';
import { MilestoneFormDrawer } from '../components/smsi/MilestoneFormDrawer';
import { Milestone, PDCAPhase } from '../types/ebios';

// Lazy load the create program modal (REMOVED: Using Drawer now)
// const CreateProgramModal = React.lazy(() => import('../components/smsi/CreateProgramModal'));

export const SMSIProgramView: React.FC = () => {
  const {
    program,
    milestones,
    loading,
    createProgram,
    createMilestone,
    updateMilestone,
    getMilestonesByPhase,
    getOverdueMilestones,
    updateMilestoneStatus
  } = useSMSIProgram();

  const { users } = useTeamData();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMilestoneDrawerOpen, setIsMilestoneDrawerOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'planning'>('overview');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

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


  const handleCreateProgram = async (data: { name: string; description?: string; targetCertificationDate?: string }) => {
    await createProgram(data);
    setIsDrawerOpen(false);
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
      className="p-6 space-y-6"
    >
      <PageHeader
        title={program.name}
        subtitle="Programme SMSI - Cycle PDCA (ISO 27003)"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              Rapport
            </Button>
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
              onSelect={(milestone) => setSelectedMilestoneId(milestone.id)}
              onAddMilestone={handleAddMilestone}
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
    </motion.div>
  );
};

export default SMSIProgramView;
