/**
 * Control Effectiveness View (ISO 27002)
 * Main view for managing control effectiveness assessments
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../components/ui/PageHeader';
import { ControlEffectivenessManager } from '../components/controls/ControlEffectivenessManager';
import { ControlEffectivenessDashboard } from '../components/controls/dashboard/ControlEffectivenessDashboard';
import { AssessmentFormModal } from '../components/controls/AssessmentFormModal';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { LayoutDashboard, List } from '../components/ui/Icons';
import { usePersistedState } from '../hooks/usePersistedState';
import { useControlEffectiveness } from '../hooks/controls/useControlEffectiveness';
import { ISO_SEED_CONTROLS } from '../data/complianceData';

export const ControlEffectivenessView: React.FC = () => {
  const [activeTab, setActiveTab] = usePersistedState<string>('control-effectiveness-active-tab', 'overview');
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [selectedControl, setSelectedControl] = useState<{ code: string; name: string } | null>(null);

  const {
    assessments,
    domainScores,
    loading,
    error,
    createAssessment
  } = useControlEffectiveness();

  const handleOpenAssessment = (control?: { code: string; name: string }) => {
    setSelectedControl(control || null);
    setShowAssessmentForm(true);
  };

  const handleAssessmentSubmit = async (data: any) => {
    await createAssessment(data);
    setShowAssessmentForm(false);
    setSelectedControl(null);
  };

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { id: 'controls', label: 'Contrôles ISO 27002', icon: List, count: ISO_SEED_CONTROLS.length } // Total controls count
  ];

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <MasterpieceBackground />
      <SEO title="Efficacité des Contrôles" description="Évaluation de la maturité des contrôles de sécurité (ISO 27002)" />

      <div className="flex flex-col gap-8">
        <motion.div variants={slideUpVariants}>
          <PageHeader
            title="Efficacité des Contrôles"
            subtitle="Évaluation de la maturité des contrôles de sécurité (ISO 27002)"
            icon={
              <img
                src="/images/gouvernance.png" // Using Gouvernance as it fits controls/compliance
                alt="GOUVERNANCE"
                className="w-full h-full object-contain"
              />
            }
            breadcrumbs={[
              { label: 'Tableau de bord', path: '/' },
              { label: 'Efficacité des Contrôles' }
            ]}
            trustType="integrity"
          />
        </motion.div>

        {/* Tabs */}
        <motion.div variants={slideUpVariants}>
          <ScrollableTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="mb-6"
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ControlEffectivenessDashboard
                onAssessClick={() => handleOpenAssessment(undefined)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="controls"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ControlEffectivenessManager
                assessments={assessments}
                domainScores={domainScores}
                loading={loading}
                error={error}
                onAssessControl={handleOpenAssessment}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Assessment Modal */}
      <AnimatePresence>
        {showAssessmentForm && (
          <AssessmentFormModal
            control={selectedControl}
            controls={ISO_SEED_CONTROLS}
            onClose={() => {
              setShowAssessmentForm(false);
              setSelectedControl(null);
            }}
            onSubmit={handleAssessmentSubmit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ControlEffectivenessView;
