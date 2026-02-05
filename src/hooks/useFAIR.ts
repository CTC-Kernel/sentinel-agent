/**
 * useFAIR Hook
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 *
 * React hook for FAIR model management and simulation.
 */

import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { useAuth } from './useAuth';
import { FAIRService } from '../services/FAIRService';
import { ErrorLogger } from '../services/errorLogger';
import { MonteCarloService } from '../services/MonteCarloService';
import type {
 FAIRModelConfig,
 FAIRSimpleFormValues,
 FAIRStandardFormValues,
 FAIRAdvancedFormValues,
 SimulationResults
} from '../types/fair';

interface UseFAIROptions {
 riskId?: string;
 autoLoad?: boolean;
}

interface UseFAIRReturn {
 // Data
 configurations: FAIRModelConfig[];
 selectedConfig: FAIRModelConfig | null;
 simulationResults: SimulationResults | null;

 // State
 loading: boolean;
 simulating: boolean;
 error: string | null;

 // Actions
 loadConfigurations: () => Promise<void>;
 selectConfiguration: (configId: string) => Promise<void>;
 createFromSimpleForm: (values: FAIRSimpleFormValues) => Promise<string>;
 createFromStandardForm: (values: FAIRStandardFormValues) => Promise<string>;
 createFromAdvancedForm: (values: FAIRAdvancedFormValues) => Promise<string>;
 createFromPreset: (presetId: string, name: string) => Promise<string>;
 updateConfiguration: (configId: string, updates: Partial<FAIRModelConfig>) => Promise<void>;
 deleteConfiguration: (configId: string) => Promise<void>;
 duplicateConfiguration: (configId: string) => Promise<string>;
 runSimulation: (iterations?: number) => Promise<SimulationResults>;
 clearSelection: () => void;
}

export function useFAIR(options: UseFAIROptions = {}): UseFAIRReturn {
 const { riskId, autoLoad = true } = options;
 const { organization } = useStore();
 const { user } = useAuth();

 const [configurations, setConfigurations] = useState<FAIRModelConfig[]>([]);
 const [selectedConfig, setSelectedConfig] = useState<FAIRModelConfig | null>(null);
 const [simulationResults, setSimulationResults] = useState<SimulationResults | null>(null);
 const [loading, setLoading] = useState(false);
 const [simulating, setSimulating] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Load configurations
 const loadConfigurations = useCallback(async () => {
 if (!organization?.id) return;

 setLoading(true);
 setError(null);

 try {
 const configs = riskId
 ? await FAIRService.getConfigurationsByRisk(organization.id, riskId)
 : await FAIRService.getConfigurations(organization.id);
 setConfigurations(configs);
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.loadConfigurations');
 setError('Failed to load configurations');
 } finally {
 setLoading(false);
 }
 }, [organization?.id, riskId]);

 // Auto-load on mount
 useEffect(() => {
 if (autoLoad && organization?.id) {
 loadConfigurations();
 }
 }, [autoLoad, organization?.id, loadConfigurations]);

 // Select configuration
 const selectConfiguration = useCallback(
 async (configId: string) => {
 if (!organization?.id) return;

 setLoading(true);
 setError(null);

 try {
 const config = await FAIRService.getConfiguration(organization.id, configId);
 setSelectedConfig(config);
 if (config?.lastSimulation) {
 setSimulationResults(config.lastSimulation);
 } else {
 setSimulationResults(null);
 }
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.selectConfiguration');
 setError('Failed to load configuration');
 } finally {
 setLoading(false);
 }
 },
 [organization?.id]
 );

 // Create from simple form
 const createFromSimpleForm = useCallback(
 async (values: FAIRSimpleFormValues): Promise<string> => {
 if (!organization?.id || !user?.uid) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 const configId = await FAIRService.createFromSimpleForm(
 organization.id,
 user.uid,
 values,
 riskId
 );
 await loadConfigurations();
 await selectConfiguration(configId);
 return configId;
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.createConfiguration');
 setError('Failed to create configuration');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, user?.uid, riskId, loadConfigurations, selectConfiguration]
 );

 // Create from standard form
 const createFromStandardForm = useCallback(
 async (values: FAIRStandardFormValues): Promise<string> => {
 if (!organization?.id || !user?.uid) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 const configId = await FAIRService.createFromStandardForm(
 organization.id,
 user.uid,
 values,
 riskId
 );
 await loadConfigurations();
 await selectConfiguration(configId);
 return configId;
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.createConfiguration');
 setError('Failed to create configuration');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, user?.uid, riskId, loadConfigurations, selectConfiguration]
 );

 // Create from advanced form
 const createFromAdvancedForm = useCallback(
 async (values: FAIRAdvancedFormValues): Promise<string> => {
 if (!organization?.id || !user?.uid) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 const configId = await FAIRService.createFromAdvancedForm(
 organization.id,
 user.uid,
 values,
 riskId
 );
 await loadConfigurations();
 await selectConfiguration(configId);
 return configId;
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.createConfiguration');
 setError('Failed to create configuration');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, user?.uid, riskId, loadConfigurations, selectConfiguration]
 );

 // Create from preset
 const createFromPreset = useCallback(
 async (presetId: string, name: string): Promise<string> => {
 if (!organization?.id || !user?.uid) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 const configId = await FAIRService.createFromPreset(
 organization.id,
 user.uid,
 presetId,
 name,
 riskId
 );
 await loadConfigurations();
 await selectConfiguration(configId);
 return configId;
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.createFromPreset');
 setError('Failed to create from preset');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, user?.uid, riskId, loadConfigurations, selectConfiguration]
 );

 // Update configuration
 const updateConfiguration = useCallback(
 async (configId: string, updates: Partial<FAIRModelConfig>): Promise<void> => {
 if (!organization?.id || !user?.uid) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 await FAIRService.updateConfiguration(organization.id, configId, user.uid, updates);
 await loadConfigurations();
 if (selectedConfig?.id === configId) {
 await selectConfiguration(configId);
 }
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.updateConfiguration');
 setError('Failed to update configuration');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, user?.uid, loadConfigurations, selectedConfig?.id, selectConfiguration]
 );

 // Delete configuration
 const deleteConfiguration = useCallback(
 async (configId: string): Promise<void> => {
 if (!organization?.id) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 await FAIRService.deleteConfiguration(organization.id, configId);
 if (selectedConfig?.id === configId) {
 setSelectedConfig(null);
 setSimulationResults(null);
 }
 await loadConfigurations();
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.deleteConfiguration');
 setError('Failed to delete configuration');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, selectedConfig?.id, loadConfigurations]
 );

 // Duplicate configuration
 const duplicateConfiguration = useCallback(
 async (configId: string): Promise<string> => {
 if (!organization?.id || !user?.uid) {
 throw new Error('Not authenticated');
 }

 setLoading(true);
 setError(null);

 try {
 const newConfigId = await FAIRService.duplicateConfiguration(
 organization.id,
 configId,
 user.uid
 );
 await loadConfigurations();
 return newConfigId;
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.duplicateConfiguration');
 setError('Failed to duplicate configuration');
 throw err;
 } finally {
 setLoading(false);
 }
 },
 [organization?.id, user?.uid, loadConfigurations]
 );

 // Run simulation
 const runSimulation = useCallback(
 async (iterations?: number): Promise<SimulationResults> => {
 if (!organization?.id || !selectedConfig) {
 throw new Error('No configuration selected');
 }

 setSimulating(true);
 setError(null);

 try {
 // Run Monte Carlo simulation
 const results = MonteCarloService.runSimulation(
 selectedConfig,
 iterations ? { iterations } : undefined
 );

 // Save results
 const resultId = await FAIRService.saveSimulationResults(
 organization.id,
 selectedConfig.id,
 results
 );

 const savedResults = { ...results, id: resultId };
 setSimulationResults(savedResults);

 // Refresh configuration to get updated lastSimulation
 await selectConfiguration(selectedConfig.id);

 return savedResults;
 } catch (err) {
 ErrorLogger.error(err, 'useFAIR.runSimulation');
 setError('Failed to run simulation');
 throw err;
 } finally {
 setSimulating(false);
 }
 },
 [organization?.id, selectedConfig, selectConfiguration]
 );

 // Clear selection
 const clearSelection = useCallback(() => {
 setSelectedConfig(null);
 setSimulationResults(null);
 }, []);

 return {
 configurations,
 selectedConfig,
 simulationResults,
 loading,
 simulating,
 error,
 loadConfigurations,
 selectConfiguration,
 createFromSimpleForm,
 createFromStandardForm,
 createFromAdvancedForm,
 createFromPreset,
 updateConfiguration,
 deleteConfiguration,
 duplicateConfiguration,
 runSimulation,
 clearSelection
 };
}

export default useFAIR;
