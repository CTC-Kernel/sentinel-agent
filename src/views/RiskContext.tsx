/**
 * Risk Context View (ISO 27005)
 * Main view for managing organizational risk context
 */

import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { RiskContextManager } from '../components/risks/context/RiskContextManager';

export const RiskContextView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Contexte de Risque"
        subtitle="Configuration du contexte organisationnel pour l'analyse des risques (ISO 27005)"
      />
      <RiskContextManager />
    </div>
  );
};

export default RiskContextView;
