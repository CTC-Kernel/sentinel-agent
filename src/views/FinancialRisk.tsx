/**
 * Financial Risk View
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 * Story 39-2: Monte Carlo Simulation
 *
 * Main view for FAIR risk quantification and simulation.
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/hooks/useLocale';
import {
  Calculator,
  Plus,
  BarChart3,
  Settings,
  Play,
  ArrowLeft,
  Loader2,
  AlertTriangle
} from '../components/ui/Icons';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../components/ui/dialog';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { toast } from '../lib/toast';
import { useFAIR } from '../hooks/useFAIR';
import { FAIRConfigList } from '../components/fair/FAIRConfigList';
import { FAIRSimpleForm } from '../components/fair/FAIRSimpleForm';
import { SimulationResults } from '../components/fair/SimulationResults';
import type { FAIRModelConfig, FAIRSimpleFormValues, SimulationResults as SimulationResultsType } from '../types/fair';

// Internal PageHeader removed in favor of shared component

// ============================================================================
// Detail View Component
// ============================================================================

interface DetailViewProps {
  config: FAIRModelConfig;
  simulationResults: SimulationResultsType | null;
  onBack: () => void;
  onRunSimulation: () => Promise<void>;
  onEdit: () => void;
  simulating: boolean;
}

const DetailView: React.FC<DetailViewProps> = ({
  config,
  simulationResults,
  onBack,
  onRunSimulation,
  onEdit,
  simulating
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back', { defaultValue: 'Back' })}
          </Button>
          <div>
            <h2 className="text-xl font-bold">{config.name}</h2>
            {config.description && (
              <p className="text-sm text-muted-foreground">{config.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Settings className="h-4 w-4 mr-2" />
            {t('common.edit', { defaultValue: 'Edit' })}
          </Button>
          <Button onClick={onRunSimulation} disabled={simulating}>
            {simulating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {t('fair.actions.runSimulation', { defaultValue: 'Run simulation' })}
          </Button>
        </div>
      </div>

      {/* Configuration Summary */}
      <Card className="p-6">
        <h3 className="font-medium mb-4">{t('fair.config.summary', { defaultValue: 'Configuration' })}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('fair.config.frequency', { defaultValue: 'Frequency' })}</p>
            <p className="font-medium">
              {config.lossEventFrequency.distribution.mostLikely?.toFixed(2) || '-'} / {t('fair.config.perYear', { defaultValue: 'year' })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('fair.config.lossRange', { defaultValue: 'Loss range' })}</p>
            <p className="font-medium">
              {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: config.primaryLossMagnitude.currency, notation: 'compact' }).format(config.primaryLossMagnitude.distribution.min)}
              {' - '}
              {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: config.primaryLossMagnitude.currency, notation: 'compact' }).format(config.primaryLossMagnitude.distribution.max)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('fair.config.controlStrength', { defaultValue: 'Control strength' })}</p>
            <p className="font-medium">{config.vulnerability.controlStrength.overall}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('fair.config.vulnerability', { defaultValue: 'Vulnerability' })}</p>
            <p className="font-medium">{config.vulnerability.vulnerabilityScore}%</p>
          </div>
        </div>
      </Card>

      {/* Simulation Results */}
      {simulationResults ? (
        <SimulationResults
          results={simulationResults as SimulationResultsType}
          currency={config.primaryLossMagnitude.currency}
          onRunAgain={onRunSimulation}
          loading={simulating}
        />
      ) : (
        <Card className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">
            {t('fair.noResults', { defaultValue: 'No simulation results' })}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('fair.noResultsDesc', { defaultValue: 'Run a Monte Carlo simulation to quantify this risk.' })}
          </p>
          <Button onClick={onRunSimulation} disabled={simulating}>
            {simulating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {t('fair.actions.runSimulation', { defaultValue: 'Run simulation' })}
          </Button>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface FinancialRiskProps {
  hideHeader?: boolean;
}

export const FinancialRisk: React.FC<FinancialRiskProps> = ({ hideHeader = false }) => {
  const { t } = useTranslation();
  const { config } = useLocale();
  const {
    configurations,
    selectedConfig,
    simulationResults,
    loading,
    simulating,
    error,
    selectConfiguration,
    createFromSimpleForm,
    deleteConfiguration,
    duplicateConfiguration,
    runSimulation,
    clearSelection
  } = useFAIR();

  // UI State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<FAIRModelConfig | null>(null);

  // Handlers
  const handleCreateNew = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateSubmit = useCallback(
    async (data: FAIRSimpleFormValues) => {
      try {
        await createFromSimpleForm(data);
        setCreateDialogOpen(false);
        toast.success(
          t('fair.toast.created', { defaultValue: 'Analysis created' }),
          t('fair.toast.createdDesc', { defaultValue: 'The FAIR analysis has been created successfully.' })
        );
      } catch {
        toast.error(
          t('common.error', { defaultValue: 'Error' }),
          t('fair.toast.createError', { defaultValue: 'Error creating the analysis.' })
        );
      }
    },
    [createFromSimpleForm, t]
  );

  const handleView = useCallback(
    (config: FAIRModelConfig) => {
      selectConfiguration(config.id);
    },
    [selectConfiguration]
  );

  const handleEdit = useCallback(
    (config: FAIRModelConfig) => {
      // For now, just view - edit form can be added later
      selectConfiguration(config.id);
    },
    [selectConfiguration]
  );

  const handleDuplicate = useCallback(
    async (config: FAIRModelConfig) => {
      try {
        await duplicateConfiguration(config.id);
        toast.success(
          t('fair.toast.duplicated', { defaultValue: 'Analysis duplicated' }),
          t('fair.toast.duplicatedDesc', { defaultValue: 'A copy of the analysis has been created.' })
        );
      } catch {
        toast.error(
          t('common.error', { defaultValue: 'Error' }),
          t('fair.toast.duplicateError', { defaultValue: 'Error during duplication.' })
        );
      }
    },
    [duplicateConfiguration, t]
  );

  const handleDeleteClick = useCallback((config: FAIRModelConfig) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!configToDelete) return;
    try {
      await deleteConfiguration(configToDelete.id);
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast.success(
        t('fair.toast.deleted', { defaultValue: 'Analysis deleted' }),
        t('fair.toast.deletedDesc', { defaultValue: 'The analysis has been deleted.' })
      );
    } catch {
      toast.error(
        t('common.error', { defaultValue: 'Error' }),
        t('fair.toast.deleteError', { defaultValue: 'Error during deletion.' })
      );
    }
  }, [configToDelete, deleteConfiguration, t]);

  const handleRunSimulation = useCallback(
    async (config: FAIRModelConfig) => {
      try {
        await selectConfiguration(config.id);
        await runSimulation();
        toast.success(
          t('fair.toast.simulated', { defaultValue: 'Simulation complete' }),
          t('fair.toast.simulatedDesc', { defaultValue: 'Results are available.' })
        );
      } catch {
        toast.error(
          t('common.error', { defaultValue: 'Error' }),
          t('fair.toast.simulationError', { defaultValue: 'Error during simulation.' })
        );
      }
    },
    [selectConfiguration, runSimulation, t]
  );

  const handleRunSimulationFromDetail = useCallback(async () => {
    try {
      await runSimulation();
      toast.success(
        t('fair.toast.simulated', { defaultValue: 'Simulation complete' }),
        t('fair.toast.simulatedDesc', { defaultValue: 'Results are available.' })
      );
    } catch {
      toast.error(
        t('common.error', { defaultValue: 'Error' }),
        t('fair.toast.simulationError', { defaultValue: 'Error during simulation.' })
      );
    }
  }, [runSimulation, t]);

  // Render detail view if config selected
  if (selectedConfig) {
    return (
      <div className={hideHeader ? "" : "container mx-auto py-6 px-4"}>
        <DetailView
          config={selectedConfig}
          simulationResults={simulationResults}
          onBack={clearSelection}
          onRunSimulation={handleRunSimulationFromDetail}
          onEdit={() => { }}
          simulating={simulating}
        />
      </div>
    );
  }

  return (
    <div className={hideHeader ? "" : "container mx-auto py-6 px-4"}>
      {!hideHeader && (
        <div className="mb-6">
          <PageHeader
            title={t('fair.title', { defaultValue: 'Risk quantification' })}
            subtitle={t('fair.subtitle', { defaultValue: 'FAIR analysis and Monte Carlo simulation' })}
            icon={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-success-text to-brand-600 text-white">
                <Calculator className="h-6 w-6" />
              </div>
            }
            actions={
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm">
                  {configurations.length} {t('fair.analyses', { defaultValue: 'analyses' })}
                </Badge>
                <Button onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('fair.actions.newAnalysis', { defaultValue: 'New analysis' })}
                </Button>
              </div>
            }
          />
        </div>
      )}

      {/* Action Bar when embedded */}
      {hideHeader && (
        <div className="flex items-center justify-between mb-6">
          <Badge variant="outline" className="text-sm">
            {configurations.length} {t('fair.analyses', { defaultValue: 'analyses' })}
          </Badge>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t('fair.actions.newAnalysis', { defaultValue: 'New analysis' })}
          </Button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-4 mb-6 bg-error-bg border-error-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-error-text" />
            <p className="text-error-text">{error}</p>
          </div>
        </Card>
      )}

      {/* Configuration List */}
      <FAIRConfigList
        configurations={configurations}
        onView={handleView}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteClick}
        onRunSimulation={handleRunSimulation}
        loading={loading}
      />

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-success-text" />
              {t('fair.create.title', { defaultValue: 'New FAIR analysis' })}
            </DialogTitle>
            <DialogDescription>
              {t(
                'fair.create.description',
                { defaultValue: 'Configure the basic parameters to quantify the financial risk.' }
              )}
            </DialogDescription>
          </DialogHeader>
          <FAIRSimpleForm
            onSubmit={handleCreateSubmit}
            onCancel={() => setCreateDialogOpen(false)}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t('fair.delete.title', { defaultValue: 'Delete this analysis?' })}
        message={t(
          'fair.delete.description',
          { defaultValue: 'This action is irreversible. All simulation results will also be deleted.' }
        )}
        type="danger"
        confirmText={t('common.delete', { defaultValue: 'Delete' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
      />
    </div>
  );
};

export default FinancialRisk;
