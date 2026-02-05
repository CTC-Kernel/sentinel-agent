import { AgentCheckResult } from '../types/agent';

/**
 * Compute compliance score from actual check results.
 * Returns null if no applicable results.
 */
export function computeScoreFromResults(results: AgentCheckResult[]): number | null {
 if (!results || results.length === 0) return null;
 const applicable = results.filter(r => r.status !== 'not_applicable');
 if (applicable.length === 0) return null;
 const passed = applicable.filter(r => r.status === 'pass').length;
 return Math.round((passed / applicable.length) * 100);
}
