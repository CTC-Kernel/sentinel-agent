/**
 * Compliance Prediction Types
 *
 * Types for AI-powered compliance predictions, trend analysis,
 * recommended actions, and remediation scripts.
 *
 * Sprint 7 - AI-Powered Features
 */

import type { RegulatoryFrameworkCode } from './framework';

// ============================================================================
// Prediction Confidence Levels
// ============================================================================

/**
 * Prediction confidence levels
 */
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

/**
 * Get confidence level from probability
 */
export function getConfidenceLevel(probability: number): ConfidenceLevel {
    if (probability >= 0.8) return 'high';
    if (probability >= 0.5) return 'medium';
    return 'low';
}

/**
 * Get confidence level color class
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
    switch (level) {
        case 'high': return 'text-success';
        case 'medium': return 'text-warning';
        case 'low': return 'text-muted-foreground';
    }
}

// ============================================================================
// Trend Analysis
// ============================================================================

/**
 * Trend direction
 */
export const TREND_DIRECTIONS = ['up', 'down', 'stable'] as const;
export type TrendDirection = typeof TREND_DIRECTIONS[number];

/**
 * Score data point for trend analysis
 */
export interface ScoreDataPoint {
    /** Timestamp */
    timestamp: string;

    /** Score value (0-100) */
    score: number;

    /** Number of compliant requirements at this point */
    compliantCount: number;

    /** Total requirements at this point */
    totalCount: number;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
    /** Framework ID */
    frameworkId: string;

    /** Framework code */
    frameworkCode: RegulatoryFrameworkCode;

    /** Current score */
    currentScore: number;

    /** Score 7 days ago */
    score7DaysAgo: number;

    /** Score 30 days ago */
    score30DaysAgo: number;

    /** Weekly change */
    weeklyChange: number;

    /** Monthly change */
    monthlyChange: number;

    /** Trend direction */
    direction: TrendDirection;

    /** Velocity (points per day) */
    velocity: number;

    /** Historical data points (last 90 days) */
    history: ScoreDataPoint[];

    /** Trend line coefficients (linear regression) */
    trendLine: {
        slope: number;
        intercept: number;
        r2: number; // Coefficient of determination
    };

    /** Calculated at */
    calculatedAt: string;
}

// ============================================================================
// Compliance Predictions
// ============================================================================

/**
 * Target threshold for predictions
 */
export interface TargetThreshold {
    /** Target score */
    score: number;

    /** Label (e.g., "Conformité minimale", "Excellence") */
    label: string;

    /** Is this the primary target */
    isPrimary: boolean;
}

/**
 * Prediction for reaching a target score
 */
export interface ScorePrediction {
    /** Target score */
    targetScore: number;

    /** Target label */
    targetLabel: string;

    /** Predicted date to reach target */
    predictedDate: string | null;

    /** Days until target (null if already reached or unreachable) */
    daysUntil: number | null;

    /** Confidence level */
    confidence: ConfidenceLevel;

    /** Confidence probability (0-1) */
    confidenceProbability: number;

    /** Lower bound of prediction interval */
    lowerBound: string | null;

    /** Upper bound of prediction interval */
    upperBound: string | null;

    /** Is target already reached */
    isReached: boolean;

    /** Is target unreachable at current pace */
    isUnreachable: boolean;

    /** Message explaining the prediction */
    message: string;
}

/**
 * Complete compliance prediction for a framework
 */
export interface CompliancePrediction {
    /** Prediction ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Framework ID */
    frameworkId: string;

    /** Framework code */
    frameworkCode: RegulatoryFrameworkCode;

    /** Framework name */
    frameworkName: string;

    /** Current score */
    currentScore: number;

    /** Trend analysis */
    trend: TrendAnalysis;

    /** Predictions for different targets */
    predictions: ScorePrediction[];

    /** Overall confidence */
    overallConfidence: ConfidenceLevel;

    /** Data quality score (0-100, based on data completeness) */
    dataQuality: number;

    /** Number of data points used */
    dataPointsUsed: number;

    /** Minimum data points needed for reliable prediction */
    minimumDataPoints: number;

    /** Is prediction reliable */
    isReliable: boolean;

    /** Factors affecting prediction */
    factors: PredictionFactor[];

    /** Generated at */
    generatedAt: string;

    /** Valid until (predictions should be refreshed after this) */
    validUntil: string;
}

/**
 * Factor affecting prediction accuracy
 */
export interface PredictionFactor {
    /** Factor type */
    type: 'positive' | 'negative' | 'neutral';

    /** Factor name */
    name: string;

    /** Description */
    description: string;

    /** Impact on prediction (-1 to 1) */
    impact: number;
}

// ============================================================================
// Recommended Actions
// ============================================================================

/**
 * Action effort level
 */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'very_high'] as const;
export type EffortLevel = typeof EFFORT_LEVELS[number];

/**
 * Action priority
 */
export const ACTION_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type ActionPriority = typeof ACTION_PRIORITIES[number];

/**
 * Action category
 */
export const ACTION_CATEGORIES = [
    'agent_remediation',  // Can be auto-fixed via agent
    'configuration',      // System configuration change
    'policy',             // Policy update needed
    'training',           // User training needed
    'documentation',      // Documentation update
    'technical',          // Technical implementation
    'process',            // Process change
] as const;
export type ActionCategory = typeof ACTION_CATEGORIES[number];

/**
 * Recommended action for improving compliance
 */
export interface RecommendedAction {
    /** Action ID */
    id: string;

    /** Rank (1 = highest impact) */
    rank: number;

    /** Title */
    title: string;

    /** Description */
    description: string;

    /** Category */
    category: ActionCategory;

    /** Priority */
    priority: ActionPriority;

    /** Effort level */
    effort: EffortLevel;

    /** Estimated effort in hours */
    estimatedHours: number;

    /** Expected score impact (points) */
    scoreImpact: number;

    /** Affected requirements count */
    affectedRequirements: number;

    /** Related framework IDs */
    frameworkIds: string[];

    /** Related control IDs */
    controlIds: string[];

    /** Has automated remediation */
    hasAutomatedRemediation: boolean;

    /** Remediation script ID (if available) */
    remediationScriptId?: string;

    /** Affected agent count (for agent-based actions) */
    affectedAgentCount?: number;

    /** Prerequisites (action IDs that must be completed first) */
    prerequisites: string[];

    /** Is quick win (low effort, high impact) */
    isQuickWin: boolean;

    /** Confidence in impact estimate */
    confidence: ConfidenceLevel;

    /** Steps to complete */
    steps: ActionStep[];

    /** Resources/links */
    resources: ActionResource[];
}

/**
 * Step within an action
 */
export interface ActionStep {
    /** Step number */
    stepNumber: number;

    /** Title */
    title: string;

    /** Description */
    description: string;

    /** Is optional */
    isOptional: boolean;

    /** Estimated minutes */
    estimatedMinutes: number;
}

/**
 * Resource for an action
 */
export interface ActionResource {
    /** Resource type */
    type: 'documentation' | 'template' | 'script' | 'video' | 'external_link';

    /** Title */
    title: string;

    /** URL or path */
    url: string;
}

/**
 * Impact summary for recommended actions
 */
export interface ActionImpactSummary {
    /** Total potential score increase */
    totalPotentialIncrease: number;

    /** If all quick wins completed */
    quickWinIncrease: number;

    /** Number of quick wins */
    quickWinCount: number;

    /** Total estimated hours */
    totalEstimatedHours: number;

    /** Quick win hours */
    quickWinHours: number;

    /** By framework */
    byFramework: {
        frameworkId: string;
        frameworkCode: RegulatoryFrameworkCode;
        currentScore: number;
        potentialScore: number;
        increase: number;
    }[];

    /** By category */
    byCategory: {
        category: ActionCategory;
        actionCount: number;
        totalImpact: number;
    }[];
}

// ============================================================================
// Remediation Scripts
// ============================================================================

/**
 * Script target platform
 */
export const SCRIPT_PLATFORMS = ['windows', 'macos', 'linux', 'cross_platform'] as const;
export type ScriptPlatform = typeof SCRIPT_PLATFORMS[number];

/**
 * Script execution mode
 */
export const SCRIPT_MODES = ['automatic', 'manual', 'supervised'] as const;
export type ScriptMode = typeof SCRIPT_MODES[number];

/**
 * Remediation script
 */
export interface RemediationScript {
    /** Script ID */
    id: string;

    /** Name */
    name: string;

    /** Description */
    description: string;

    /** Target platform */
    platform: ScriptPlatform;

    /** Execution mode */
    mode: ScriptMode;

    /** Script content (base64 encoded for binary) */
    content: string;

    /** Script language (powershell, bash, python, etc.) */
    language: string;

    /** File extension */
    extension: string;

    /** Version */
    version: string;

    /** Author */
    author: string;

    /** Requires admin/root privileges */
    requiresElevation: boolean;

    /** Requires reboot after execution */
    requiresReboot: boolean;

    /** Estimated execution time (seconds) */
    estimatedDuration: number;

    /** Risk level of execution */
    riskLevel: 'low' | 'medium' | 'high';

    /** What the script does (detailed) */
    whatItDoes: string[];

    /** Prerequisites */
    prerequisites: string[];

    /** Rollback script ID (if available) */
    rollbackScriptId?: string;

    /** Related check IDs (agent checks this fixes) */
    relatedCheckIds: string[];

    /** Related CIS benchmark checks */
    relatedCisChecks: string[];

    /** Test command to verify success */
    verificationCommand?: string;

    /** Expected verification result */
    expectedVerificationResult?: string;

    /** Times used successfully */
    successCount: number;

    /** Times failed */
    failureCount: number;

    /** Success rate */
    successRate: number;

    /** Created at */
    createdAt: string;

    /** Updated at */
    updatedAt: string;

    /** Is verified/approved */
    isVerified: boolean;

    /** Verified by (user ID) */
    verifiedBy?: string;
}

/**
 * Script execution request
 */
export interface ScriptExecutionRequest {
    /** Request ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Script ID */
    scriptId: string;

    /** Target agent IDs */
    targetAgentIds: string[];

    /** Requested by (user ID) */
    requestedBy: string;

    /** Request status */
    status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

    /** Approved by (user ID) */
    approvedBy?: string;

    /** Approved at */
    approvedAt?: string;

    /** Rejection reason */
    rejectionReason?: string;

    /** Execution results */
    results?: ScriptExecutionResult[];

    /** Created at */
    createdAt: string;

    /** Completed at */
    completedAt?: string;
}

/**
 * Script execution result for a single agent
 */
export interface ScriptExecutionResult {
    /** Agent ID */
    agentId: string;

    /** Agent hostname */
    hostname: string;

    /** Execution status */
    status: 'success' | 'failure' | 'timeout' | 'skipped';

    /** Exit code */
    exitCode?: number;

    /** Output (truncated) */
    output?: string;

    /** Error message */
    errorMessage?: string;

    /** Execution duration (ms) */
    durationMs: number;

    /** Executed at */
    executedAt: string;

    /** Verification passed */
    verificationPassed?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get effort level label
 */
export function getEffortLabel(effort: EffortLevel): string {
    switch (effort) {
        case 'low': return 'Faible';
        case 'medium': return 'Moyen';
        case 'high': return 'Élevé';
        case 'very_high': return 'Très élevé';
    }
}

/**
 * Get effort color class
 */
export function getEffortColor(effort: EffortLevel): string {
    switch (effort) {
        case 'low': return 'text-success';
        case 'medium': return 'text-primary';
        case 'high': return 'text-warning';
        case 'very_high': return 'text-destructive';
    }
}

/**
 * Get priority label
 */
export function getPriorityLabel(priority: ActionPriority): string {
    switch (priority) {
        case 'critical': return 'Critique';
        case 'high': return 'Haute';
        case 'medium': return 'Moyenne';
        case 'low': return 'Basse';
    }
}

/**
 * Get priority color class
 */
export function getPriorityColor(priority: ActionPriority): string {
    switch (priority) {
        case 'critical': return 'text-destructive';
        case 'high': return 'text-orange-500';
        case 'medium': return 'text-warning';
        case 'low': return 'text-muted-foreground';
    }
}

/**
 * Get category label
 */
export function getCategoryLabel(category: ActionCategory): string {
    switch (category) {
        case 'agent_remediation': return 'Remédiation Agent';
        case 'configuration': return 'Configuration';
        case 'policy': return 'Politique';
        case 'training': return 'Formation';
        case 'documentation': return 'Documentation';
        case 'technical': return 'Technique';
        case 'process': return 'Processus';
    }
}

/**
 * Get category icon name
 */
export function getCategoryIcon(category: ActionCategory): string {
    switch (category) {
        case 'agent_remediation': return 'Bot';
        case 'configuration': return 'Settings';
        case 'policy': return 'FileText';
        case 'training': return 'GraduationCap';
        case 'documentation': return 'BookOpen';
        case 'technical': return 'Wrench';
        case 'process': return 'GitBranch';
    }
}

/**
 * Calculate quick win score (higher = better quick win)
 */
export function calculateQuickWinScore(action: RecommendedAction): number {
    // Impact per hour of effort
    const impactPerHour = action.scoreImpact / (action.estimatedHours || 1);

    // Bonus for low effort
    const effortBonus = action.effort === 'low' ? 2 :
        action.effort === 'medium' ? 1.5 : 1;

    // Bonus for automated remediation
    const automationBonus = action.hasAutomatedRemediation ? 1.5 : 1;

    // Bonus for high confidence
    const confidenceBonus = action.confidence === 'high' ? 1.3 :
        action.confidence === 'medium' ? 1.1 : 1;

    return impactPerHour * effortBonus * automationBonus * confidenceBonus;
}

/**
 * Format prediction message
 */
export function formatPredictionMessage(
    currentScore: number,
    targetScore: number,
    daysUntil: number | null,
    isReached: boolean,
    isUnreachable: boolean
): string {
    if (isReached) {
        return `Objectif de ${targetScore}% atteint ! Score actuel: ${currentScore}%`;
    }

    if (isUnreachable) {
        return `Au rythme actuel, l'objectif de ${targetScore}% ne sera pas atteint. Actions recommandées nécessaires.`;
    }

    if (daysUntil === null) {
        return `Données insuffisantes pour prédire l'atteinte de ${targetScore}%.`;
    }

    if (daysUntil <= 7) {
        return `Objectif de ${targetScore}% prévu dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}.`;
    }

    if (daysUntil <= 30) {
        const weeks = Math.round(daysUntil / 7);
        return `Objectif de ${targetScore}% prévu dans ${weeks} semaine${weeks > 1 ? 's' : ''}.`;
    }

    const months = Math.round(daysUntil / 30);
    return `Objectif de ${targetScore}% prévu dans ${months} mois.`;
}
