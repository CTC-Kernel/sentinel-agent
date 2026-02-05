/**
 * Auto-Population Types
 *
 * Types for automatically populating compliance questionnaires
 * from agent evidence. Enables RSSI to review and approve suggestions.
 */

import { RegulatoryFrameworkCode } from './framework';
import { AssessmentStatus } from './compliance';
import { AgentCheckId } from './agentEvidence';

/**
 * Suggestion status for auto-populated answers
 */
export const SUGGESTION_STATUSES = [
 'pending', // Awaiting review
 'approved', // Accepted by user
 'rejected', // Rejected by user
 'modified', // Accepted with modifications
 'expired', // Evidence too old
] as const;

export type SuggestionStatus = typeof SUGGESTION_STATUSES[number];

/**
 * Confidence level for suggestions
 */
export const CONFIDENCE_LEVELS = [
 'high', // 80-100% confidence
 'medium', // 50-79% confidence
 'low', // Below 50% confidence
] as const;

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

/**
 * Individual population suggestion
 * Represents a proposed answer for a compliance requirement
 */
export interface PopulationSuggestion {
 /** Unique suggestion ID */
 id: string;

 /** Organization ID */
 organizationId: string;

 /** Session ID this suggestion belongs to */
 sessionId: string;

 /** Framework being populated */
 frameworkCode: RegulatoryFrameworkCode;

 /** Requirement ID being answered */
 requirementId: string;

 /** Requirement reference (e.g., "Art.21.2.j") */
 requirementReference: string;

 /** Requirement text/question */
 requirementText: string;

 /** Control ID if mapped to a control */
 controlId?: string;

 /** Suggested assessment status */
 suggestedStatus: AssessmentStatus;

 /** Suggested score (0-100) */
 suggestedScore: number;

 /** Suggested answer text */
 suggestedAnswer: string;

 /** Confidence score (0-100) */
 confidenceScore: number;

 /** Confidence level derived from score */
 confidenceLevel: ConfidenceLevel;

 /** Source check IDs that support this suggestion */
 sourceCheckIds: AgentCheckId[];

 /** Evidence IDs supporting this suggestion */
 evidenceIds: string[];

 /** Number of agents contributing evidence */
 agentCount: number;

 /** Latest verification timestamp */
 lastVerified: string;

 /** Current status of the suggestion */
 status: SuggestionStatus;

 /** User who reviewed (if reviewed) */
 reviewedBy?: string;

 /** Review timestamp */
 reviewedAt?: string;

 /** Modified answer (if status is 'modified') */
 modifiedAnswer?: string;

 /** Modified status (if status is 'modified') */
 modifiedStatus?: AssessmentStatus;

 /** Review notes */
 reviewNotes?: string;

 /** Created timestamp */
 createdAt: string;
}

/**
 * Population session
 * Represents a single auto-population attempt for a framework
 */
export interface PopulationSession {
 /** Session ID */
 id: string;

 /** Organization ID */
 organizationId: string;

 /** Framework being populated */
 frameworkCode: RegulatoryFrameworkCode;

 /** Framework name for display */
 frameworkName: string;

 /** Session status */
 status: 'in_progress' | 'completed' | 'cancelled';

 /** Total requirements in framework */
 totalRequirements: number;

 /** Requirements with suggestions */
 suggestedRequirements: number;

 /** Population percentage */
 populationPercent: number;

 /** Suggestions by status */
 suggestionsByStatus: {
 pending: number;
 approved: number;
 rejected: number;
 modified: number;
 expired: number;
 };

 /** Average confidence score */
 averageConfidence: number;

 /** Unique agents contributing */
 agentCount: number;

 /** Created by user */
 createdBy: string;

 /** Created timestamp */
 createdAt: string;

 /** Completed timestamp */
 completedAt?: string;

 /** Completed by user */
 completedBy?: string;

 /** Initial score before population */
 initialScore: number;

 /** Final score after population */
 finalScore?: number;

 /** Score improvement */
 scoreImprovement?: number;
}

/**
 * Cross-framework mapping entry
 * Shows how one check maps to multiple frameworks
 */
export interface CrossFrameworkEntry {
 /** Check ID */
 checkId: AgentCheckId;

 /** Check name */
 checkName: string;

 /** Check category */
 checkCategory: string;

 /** Mappings to frameworks */
 frameworkMappings: {
 frameworkCode: RegulatoryFrameworkCode;
 frameworkName: string;
 requirementId: string;
 requirementReference: string;
 coverageType: 'full' | 'partial';
 weight: number;
 hasEvidence: boolean;
 evidenceStatus?: 'pass' | 'fail' | 'mixed';
 lastVerified?: string;
 }[];

 /** Overall status across frameworks */
 overallStatus: 'verified' | 'partial' | 'missing';
}

/**
 * Framework population summary
 * Overview of population status for a framework
 */
export interface FrameworkPopulationSummary {
 frameworkCode: RegulatoryFrameworkCode;
 frameworkName: string;

 /** Total requirements */
 totalRequirements: number;

 /** Requirements covered by agent checks */
 agentCoveredRequirements: number;

 /** Coverage percentage */
 coveragePercent: number;

 /** Requirements by suggested status */
 requirementsByStatus: {
 verified: number;
 partial: number;
 notCovered: number;
 };

 /** Average confidence for covered requirements */
 averageConfidence: number;

 /** Potential score if all suggestions accepted */
 potentialScore: number;

 /** Active agents contributing */
 activeAgents: number;

 /** Last population session */
 lastSession?: {
 id: string;
 createdAt: string;
 status: PopulationSession['status'];
 populationPercent: number;
 };
}

/**
 * Population wizard state
 * Tracks wizard progress and selections
 */
export interface PopulationWizardState {
 /** Current step (1-3) */
 currentStep: 1 | 2 | 3;

 /** Selected framework */
 selectedFramework: RegulatoryFrameworkCode | null;

 /** Session being worked on */
 sessionId: string | null;

 /** Suggestions for review */
 suggestions: PopulationSuggestion[];

 /** Currently selected suggestion for detail view */
 selectedSuggestionId: string | null;

 /** Filter for suggestions */
 filter: {
 status: SuggestionStatus | 'all';
 confidence: ConfidenceLevel | 'all';
 search: string;
 };

 /** Loading state */
 loading: boolean;

 /** Error message */
 error: string | null;
}

/**
 * Population statistics for dashboard
 */
export interface PopulationStats {
 /** Total sessions */
 totalSessions: number;

 /** Sessions this month */
 sessionsThisMonth: number;

 /** Average population rate */
 averagePopulationRate: number;

 /** Total suggestions generated */
 totalSuggestions: number;

 /** Suggestions approved */
 suggestionsApproved: number;

 /** Approval rate */
 approvalRate: number;

 /** Average score improvement */
 averageScoreImprovement: number;

 /** Frameworks with coverage */
 frameworksCovered: number;

 /** Time saved estimate (hours) */
 timeSavedHours: number;
}

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
 if (score >= 80) return 'high';
 if (score >= 50) return 'medium';
 return 'low';
}

/**
 * Get suggested status from evidence
 */
export function getSuggestedStatus(
 evidenceStatus: 'pass' | 'fail' | 'mixed',
 confidenceScore: number
): AssessmentStatus {
 if (evidenceStatus === 'fail') {
 return 'non_compliant';
 }
 if (evidenceStatus === 'pass' && confidenceScore >= 80) {
 return 'compliant';
 }
 if (evidenceStatus === 'pass' || evidenceStatus === 'mixed') {
 return 'partially_compliant';
 }
 return 'in_progress';
}

/**
 * Calculate suggested score from evidence
 */
export function calculateSuggestedScore(
 evidenceStatus: 'pass' | 'fail' | 'mixed',
 confidenceScore: number,
 coverageWeight: number
): number {
 if (evidenceStatus === 'fail') {
 return 0;
 }
 if (evidenceStatus === 'pass') {
 return Math.round((confidenceScore * coverageWeight) / 100);
 }
 // Mixed status
 return Math.round((confidenceScore * coverageWeight * 0.5) / 100);
}
