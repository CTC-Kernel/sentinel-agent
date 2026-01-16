/**
 * Control Effectiveness View (ISO 27002)
 * Main view for managing control effectiveness assessments
 */

import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { ControlEffectivenessManager } from '../components/controls/ControlEffectivenessManager';

export const ControlEffectivenessView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Efficacité des Contrôles"
        subtitle="Évaluation de la maturité des contrôles de sécurité (ISO 27002)"
      />
      <ControlEffectivenessManager />
    </div>
  );
};

export default ControlEffectivenessView;
