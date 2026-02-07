/**
 * ISO 27002 Domain maturity level thresholds
 * 
 * Extracted from hooks/controls/useControlEffectiveness.ts to satisfy
 * the convention that only hooks (use*) are exported from /hooks/ directory.
 * 
 * @module constants/maturityThresholds
 */

export const MATURITY_THRESHOLDS = {
 1: { min: 0, max: 20, label: 'Initial', description: 'Pratiques ad-hoc, non formalisées' },
 2: { min: 20, max: 40, label: 'Géré', description: 'Processus documentés mais non systématiques' },
 3: { min: 40, max: 60, label: 'Défini', description: 'Processus standardisés et systématiques' },
 4: { min: 60, max: 80, label: 'Mesuré', description: 'Mesure et amélioration continue' },
 5: { min: 80, max: 100, label: 'Optimisé', description: 'Amélioration continue et excellence' },
} as const;
