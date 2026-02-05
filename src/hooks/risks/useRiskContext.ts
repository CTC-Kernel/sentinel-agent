/**
 * useRiskContext Hook (ISO 27005)
 * Manages the organization's risk context including business context,
 * regulatory context, risk appetite, and evaluation criteria.
 */

import { useState, useCallback, useEffect } from 'react';
import { EbiosService } from '../../services/ebiosService';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import type { RiskContext, ApplicableRegulation, ScaleDefinition } from '../../types/ebios';

// Default evaluation criteria (ISO 27005 standard scales)
const DEFAULT_IMPACT_SCALE: ScaleDefinition[] = [
 { level: 1, name: 'Négligeable', description: 'Impact mineur sans conséquence significative', criteria: ['Pas de perte financière', 'Pas d\'impact sur les opérations'] },
 { level: 2, name: 'Faible', description: 'Impact limité géré par les processus existants', criteria: ['Perte financière < 10k€', 'Perturbation < 1 jour'] },
 { level: 3, name: 'Modéré', description: 'Impact notable nécessitant des actions correctives', criteria: ['Perte financière 10-100k€', 'Perturbation 1-3 jours'] },
 { level: 4, name: 'Majeur', description: 'Impact significatif avec conséquences durables', criteria: ['Perte financière 100k-1M€', 'Perturbation > 1 semaine'] },
 { level: 5, name: 'Critique', description: 'Impact catastrophique menaçant la survie de l\'organisation', criteria: ['Perte financière > 1M€', 'Interruption totale des activités'] },
];

const DEFAULT_PROBABILITY_SCALE: ScaleDefinition[] = [
 { level: 1, name: 'Rare', description: 'Événement exceptionnel (< 1% par an)', criteria: ['Jamais observé', 'Conditions très improbables'] },
 { level: 2, name: 'Peu probable', description: 'Événement occasionnel (1-10% par an)', criteria: ['Observé rarement', 'Conditions inhabituelles'] },
 { level: 3, name: 'Possible', description: 'Événement susceptible de se produire (10-30% par an)', criteria: ['Observé occasionnellement', 'Conditions normales'] },
 { level: 4, name: 'Probable', description: 'Événement fréquent (30-70% par an)', criteria: ['Observé régulièrement', 'Conditions favorables'] },
 { level: 5, name: 'Quasi-certain', description: 'Événement attendu (> 70% par an)', criteria: ['Observé très fréquemment', 'Conditions présentes'] },
];

const DEFAULT_RISK_APPETITE = {
 description: '',
 acceptableRiskLevels: {
 low: 4, // Inherent score 1-4 = acceptable
 medium: 9, // Inherent score 5-9 = needs attention
 high: 16, // Inherent score 10-16 = action required
 critical: 25 // Inherent score 17-25 = immediate action
 },
 escalationThresholds: {
 automatic: 9, // Auto-escalate risks > 9
 management: 16, // Escalate to management if > 16
 board: 20 // Board notification if > 20
 }
};

export interface UseRiskContextReturn {
 riskContext: RiskContext | null;
 loading: boolean;
 error: string | null;

 // CRUD operations
 initializeContext: () => Promise<RiskContext | null>;
 saveContext: (data: Partial<RiskContext>) => Promise<void>;

 // Partial update operations
 updateBusinessContext: (data: RiskContext['businessContext']) => Promise<void>;
 updateRegulatoryContext: (data: RiskContext['regulatoryContext']) => Promise<void>;
 updateRiskAppetite: (data: RiskContext['riskAppetite']) => Promise<void>;
 updateEvaluationCriteria: (data: RiskContext['evaluationCriteria']) => Promise<void>;

 // Regulation helpers
 addRegulation: (regulation: Omit<ApplicableRegulation, 'id'>) => Promise<void>;
 removeRegulation: (regulationId: string) => Promise<void>;

 // Validation helpers
 validateAgainstAppetite: (riskScore: number) => { acceptable: boolean; level: 'low' | 'medium' | 'high' | 'critical'; escalation: 'none' | 'automatic' | 'management' | 'board' };

 // Refresh
 refreshContext: () => Promise<void>;
}

export function useRiskContext(): UseRiskContextReturn {
 const { user, organization } = useStore();
 const [riskContext, setRiskContext] = useState<RiskContext | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const organizationId = user?.organizationId || organization?.id;

 // Fetch risk context on mount
 useEffect(() => {
 if (!organizationId) {
 setLoading(false);
 return;
 }

 const fetchContext = async () => {
 try {
 setLoading(true);
 const context = await EbiosService.getRiskContext(organizationId);
 setRiskContext(context);
 setError(null);
 } catch (err) {
 setError('Erreur lors du chargement du contexte de risque');
 ErrorLogger.error(err, 'useRiskContext.fetchContext');
 } finally {
 setLoading(false);
 }
 };

 fetchContext();
 }, [organizationId]);

 // Initialize context with defaults
 const initializeContext = useCallback(async (): Promise<RiskContext | null> => {
 if (!organizationId) {
 ErrorLogger.warn('Missing organizationId for context init', 'useRiskContext.initializeContext');
 setError('Impossible d\'initialiser le contexte: Organisation non identifiée');
 return null;
 }

 try {
 setLoading(true);
 const newContext = await EbiosService.saveRiskContext(organizationId, {
 businessContext: {
 description: '',
 activities: [],
 objectives: [],
 criticalProcesses: []
 },
 regulatoryContext: {
 description: '',
 applicableRegulations: []
 },
 riskAppetite: DEFAULT_RISK_APPETITE,
 evaluationCriteria: {
 impactScale: DEFAULT_IMPACT_SCALE,
 probabilityScale: DEFAULT_PROBABILITY_SCALE
 }
 });
 setRiskContext(newContext);
 setError(null);
 return newContext;
 } catch (err) {
 setError('Erreur lors de l\'initialisation du contexte');
 ErrorLogger.error(err, 'useRiskContext.initializeContext');
 return null;
 } finally {
 setLoading(false);
 }
 }, [organizationId]);

 // Save entire context
 const saveContext = useCallback(async (data: Partial<RiskContext>): Promise<void> => {
 if (!organizationId || !riskContext) return;

 try {
 const updated = await EbiosService.saveRiskContext(organizationId, {
 businessContext: data.businessContext ?? riskContext.businessContext,
 regulatoryContext: data.regulatoryContext ?? riskContext.regulatoryContext,
 riskAppetite: data.riskAppetite ?? riskContext.riskAppetite,
 evaluationCriteria: data.evaluationCriteria ?? riskContext.evaluationCriteria
 });
 setRiskContext(updated);
 setError(null);
 } catch (err) {
 setError('Erreur lors de la sauvegarde');
 ErrorLogger.error(err, 'useRiskContext.saveContext');
 throw err;
 }
 }, [organizationId, riskContext]);

 // Update business context
 const updateBusinessContext = useCallback(async (data: RiskContext['businessContext']): Promise<void> => {
 await saveContext({ businessContext: data });
 }, [saveContext]);

 // Update regulatory context
 const updateRegulatoryContext = useCallback(async (data: RiskContext['regulatoryContext']): Promise<void> => {
 await saveContext({ regulatoryContext: data });
 }, [saveContext]);

 // Update risk appetite
 const updateRiskAppetite = useCallback(async (data: RiskContext['riskAppetite']): Promise<void> => {
 await saveContext({ riskAppetite: data });
 }, [saveContext]);

 // Update evaluation criteria
 const updateEvaluationCriteria = useCallback(async (data: RiskContext['evaluationCriteria']): Promise<void> => {
 await saveContext({ evaluationCriteria: data });
 }, [saveContext]);

 // Add regulation
 const addRegulation = useCallback(async (regulation: Omit<ApplicableRegulation, 'id'>): Promise<void> => {
 if (!riskContext) return;

 const newRegulation: ApplicableRegulation = {
 ...regulation,
 id: crypto.randomUUID()
 };

 await updateRegulatoryContext({
 ...riskContext.regulatoryContext,
 applicableRegulations: [...riskContext.regulatoryContext.applicableRegulations, newRegulation]
 });
 }, [riskContext, updateRegulatoryContext]);

 // Remove regulation
 const removeRegulation = useCallback(async (regulationId: string): Promise<void> => {
 if (!riskContext) return;

 await updateRegulatoryContext({
 ...riskContext.regulatoryContext,
 applicableRegulations: riskContext.regulatoryContext.applicableRegulations.filter(r => r.id !== regulationId)
 });
 }, [riskContext, updateRegulatoryContext]);

 // Validate risk score against appetite
 const validateAgainstAppetite = useCallback((riskScore: number) => {
 const appetite = riskContext?.riskAppetite ?? DEFAULT_RISK_APPETITE;

 let level: 'low' | 'medium' | 'high' | 'critical';
 if (riskScore <= appetite.acceptableRiskLevels.low) {
 level = 'low';
 } else if (riskScore <= appetite.acceptableRiskLevels.medium) {
 level = 'medium';
 } else if (riskScore <= appetite.acceptableRiskLevels.high) {
 level = 'high';
 } else {
 level = 'critical';
 }

 let escalation: 'none' | 'automatic' | 'management' | 'board' = 'none';
 if (riskScore > appetite.escalationThresholds.board) {
 escalation = 'board';
 } else if (riskScore > appetite.escalationThresholds.management) {
 escalation = 'management';
 } else if (riskScore > appetite.escalationThresholds.automatic) {
 escalation = 'automatic';
 }

 return {
 acceptable: level === 'low',
 level,
 escalation
 };
 }, [riskContext]);

 // Refresh context
 const refreshContext = useCallback(async (): Promise<void> => {
 if (!organizationId) return;

 try {
 setLoading(true);
 const context = await EbiosService.getRiskContext(organizationId);
 setRiskContext(context);
 setError(null);
 } catch (err) {
 setError('Erreur lors du rafraîchissement');
 ErrorLogger.error(err, 'useRiskContext.refreshContext');
 } finally {
 setLoading(false);
 }
 }, [organizationId]);

 return {
 riskContext,
 loading,
 error,
 initializeContext,
 saveContext,
 updateBusinessContext,
 updateRegulatoryContext,
 updateRiskAppetite,
 updateEvaluationCriteria,
 addRegulation,
 removeRegulation,
 validateAgainstAppetite,
 refreshContext
 };
}

export default useRiskContext;
