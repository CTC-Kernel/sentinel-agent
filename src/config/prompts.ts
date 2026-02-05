/**
 * Centralized configuration for AI Prompts
 * Avoids hardcoding prompts in components
 */

export const AI_PROMPTS = {
 dashboard_executive_summary: (context: {
 score: number;
 incidents: number;
 risks: number;
 topRisks: string[];
 financial: number;
 recentIncidents: string;
 }) => `
 Analyse cette posture de cybersécurité pour un rapport exécutif (synthèse courte, max 3-4 phrases percutantes) :
 - Score Global : ${context.score}%
 - Incidents Actifs : ${context.incidents}
 - Risques Critiques : ${context.risks} (Top: ${context.topRisks.join(', ')})
 - Risque Financier : ${context.financial}€
 - Incidents récents : ${context.recentIncidents}

 Format attendu : Markdown riche (gras, puces).
 Ton : Professionnel, direct, orienté action.
 Structure :
 1. **État Global** : Résumé en 1 phrase.
 2. **Priorités** : 2 points d'attention majeurs.
 3. **Recommandation** : 1 action immédiate.
 `
};
