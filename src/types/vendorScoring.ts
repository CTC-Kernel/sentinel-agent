/**
 * Vendor Scoring Types
 * Types for automated vendor risk scoring
 * Story 37-3: Automated Vendor Scoring
 */

// ============================================================================
// Risk Level Types
// ============================================================================

/**
 * Risk level categories
 */
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Risk level thresholds (score ranges)
 * Note: Lower scores = lower risk (inverse of typical risk scoring)
 * 0-40: Good security posture (Low risk)
 * 41-60: Moderate concerns (Medium risk)
 * 61-80: Significant gaps (High risk)
 * 81-100: Critical deficiencies (Critical risk)
 */
export const RISK_THRESHOLDS: Record<RiskLevel, [number, number]> = {
  Low: [0, 40],
  Medium: [41, 60],
  High: [61, 80],
  Critical: [81, 100],
};

/**
 * Risk level configuration
 */
export interface RiskLevelConfig {
  level: RiskLevel;
  minScore: number;
  maxScore: number;
  color: string;
  bgColor: string;
  description: string;
}

/**
 * Default risk level configurations
 */
export const RISK_LEVEL_CONFIGS: RiskLevelConfig[] = [
  {
    level: 'Low',
    minScore: 0,
    maxScore: 40,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Vendor demonstrates strong security posture',
  },
  {
    level: 'Medium',
    minScore: 41,
    maxScore: 60,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: 'Vendor has moderate security concerns requiring attention',
  },
  {
    level: 'High',
    minScore: 61,
    maxScore: 80,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Vendor has significant security gaps requiring remediation',
  },
  {
    level: 'Critical',
    minScore: 81,
    maxScore: 100,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Vendor has critical security deficiencies - immediate action required',
  },
];

// ============================================================================
// Score Types
// ============================================================================

/**
 * Individual question score
 */
export interface QuestionScore {
  questionId: string;
  questionText: string;
  rawScore: number; // 0-100
  weight: number;
  weightedScore: number;
  isCritical: boolean;
  answerValue: unknown;
  answerType: 'yes_no' | 'rating' | 'multiple_choice' | 'text';
}

/**
 * Section score aggregate
 */
export interface SectionScore {
  sectionId: string;
  sectionTitle: string;
  score: number; // 0-100
  weight: number;
  weightedScore: number;
  questionCount: number;
  answeredCount: number;
  criticalIssues: number; // Questions with score < 50 and isCritical
  questionScores: QuestionScore[];
}

/**
 * Complete vendor score
 */
export interface VendorScore {
  assessmentId: string;
  supplierId: string;
  supplierName: string;
  overallScore: number; // 0-100 (inverted: 0 = best, 100 = worst)
  displayScore: number; // 0-100 (normal: 100 = best, 0 = worst)
  inherentRisk: RiskLevel;
  residualRisk: RiskLevel;
  sectionScores: SectionScore[];
  totalQuestions: number;
  answeredQuestions: number;
  criticalIssuesCount: number;
  calculatedAt: string;
  calculatedBy: 'system' | 'manual';
  mitigatingFactors?: MitigatingFactor[];
}

/**
 * Mitigating factor that reduces risk
 */
export interface MitigatingFactor {
  id: string;
  type: 'certification' | 'insurance' | 'audit' | 'contract' | 'other';
  name: string;
  description?: string;
  riskReduction: number; // Percentage points to reduce (e.g., 10 = -10 from risk score)
  validUntil?: string;
  evidenceUrl?: string;
}

/**
 * Common certifications as mitigating factors
 */
export const COMMON_MITIGATING_FACTORS: Omit<MitigatingFactor, 'id' | 'validUntil' | 'evidenceUrl'>[] = [
  { type: 'certification', name: 'SOC 2 Type II', riskReduction: 15 },
  { type: 'certification', name: 'ISO 27001', riskReduction: 15 },
  { type: 'certification', name: 'ISO 27701', riskReduction: 10 },
  { type: 'certification', name: 'HDS', riskReduction: 15 },
  { type: 'certification', name: 'PCI DSS', riskReduction: 10 },
  { type: 'audit', name: 'Pentest annuel', riskReduction: 5 },
  { type: 'insurance', name: 'Cyber-assurance', riskReduction: 5 },
  { type: 'contract', name: 'SLA avec pénalités', riskReduction: 5 },
];

// ============================================================================
// Scoring Configuration Types
// ============================================================================

/**
 * Multiple choice option scoring
 */
export interface ScoringOption {
  value: string;
  label: string;
  score: number; // 0-100
}

/**
 * Question scoring configuration
 */
export interface QuestionScoringConfig {
  questionId: string;
  isCritical: boolean; // 2x weight when critical
  customWeight?: number;
  options?: ScoringOption[]; // For multiple_choice
}

/**
 * Section scoring configuration
 */
export interface SectionScoringConfig {
  sectionId: string;
  weight: number; // Percentage (all sections should total 100)
  questions: QuestionScoringConfig[];
}

/**
 * Template scoring configuration
 */
export interface TemplateScoringConfig {
  templateId: string;
  organizationId: string;
  sections: SectionScoringConfig[];
  riskThresholds?: Record<RiskLevel, [number, number]>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Vendor comparison entry
 */
export interface VendorComparisonEntry {
  supplierId: string;
  supplierName: string;
  category?: string;
  latestScore: VendorScore;
  previousScore?: VendorScore;
  scoreTrend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
  assessmentCount: number;
  lastAssessedAt: string;
}

/**
 * Risk matrix position
 */
export interface RiskMatrixPosition {
  supplierId: string;
  supplierName: string;
  riskLevel: RiskLevel;
  criticalityLevel: 'Low' | 'Medium' | 'High';
  score: number;
}

/**
 * Organization scoring statistics
 */
export interface ScoringStatistics {
  organizationId: string;
  averageScore: number;
  medianScore: number;
  vendorCount: number;
  byRiskLevel: Record<RiskLevel, number>;
  byCategory: Record<string, { count: number; averageScore: number }>;
  topRisks: VendorComparisonEntry[];
  recentImprovements: VendorComparisonEntry[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get risk level from score
 */
export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score <= 40) return 'Low';
  if (score <= 60) return 'Medium';
  if (score <= 80) return 'High';
  return 'Critical';
}

/**
 * Get risk level configuration
 */
export function getRiskLevelConfig(level: RiskLevel): RiskLevelConfig {
  return RISK_LEVEL_CONFIGS.find(c => c.level === level) || RISK_LEVEL_CONFIGS[0];
}

/**
 * Get display score (inverted: 100 = good, 0 = bad)
 * Risk score: 0 = no risk, 100 = maximum risk
 * Display score: 100 = excellent security, 0 = poor security
 */
export function getDisplayScore(riskScore: number): number {
  return Math.max(0, Math.min(100, 100 - riskScore));
}

/**
 * Get risk score from display score
 */
export function getRiskScore(displayScore: number): number {
  return Math.max(0, Math.min(100, 100 - displayScore));
}

/**
 * Calculate score color based on display score
 */
export function getScoreColor(displayScore: number): string {
  if (displayScore >= 80) return 'text-green-600';
  if (displayScore >= 60) return 'text-yellow-600';
  if (displayScore >= 40) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Calculate score background color
 */
export function getScoreBgColor(displayScore: number): string {
  if (displayScore >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (displayScore >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (displayScore >= 40) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

/**
 * Score a yes/no answer
 * Returns risk score: 0 = compliant (no risk), 100 = non-compliant (high risk)
 */
export function scoreYesNoAnswer(answer: unknown): number {
  if (answer === true || answer === 'yes' || answer === 'Oui' || answer === 'oui') {
    return 0; // Compliant = no risk
  }
  if (answer === false || answer === 'no' || answer === 'Non' || answer === 'non') {
    return 100; // Non-compliant = high risk
  }
  if (answer === 'partial' || answer === 'Partiel' || answer === 'partiel') {
    return 50; // Partial compliance = medium risk
  }
  return 50; // Unknown/unanswered = neutral
}

/**
 * Score a rating answer (1-5 scale)
 * Returns risk score: 0 = best rating (no risk), 100 = worst rating (high risk)
 */
export function scoreRatingAnswer(rating: number, maxRating: number = 5): number {
  if (typeof rating !== 'number' || isNaN(rating)) return 50;
  // Invert: higher rating = lower risk
  const normalized = Math.max(1, Math.min(maxRating, rating));
  return Math.round(((maxRating - normalized) / (maxRating - 1)) * 100);
}

/**
 * Score a multiple choice answer with configured options
 */
export function scoreMultipleChoiceAnswer(
  answer: string | string[],
  options: ScoringOption[]
): number {
  if (!answer) return 50;

  if (Array.isArray(answer)) {
    // Average score for multi-select
    const scores = answer
      .map(a => options.find(o => o.value === a)?.score ?? 50)
      .filter(s => s !== undefined);
    return scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 50;
  }

  const option = options.find(o => o.value === answer);
  return option?.score ?? 50;
}

/**
 * Score a text answer (requires manual review, neutral score)
 */
export function scoreTextAnswer(): number {
  return 50; // Neutral until manually reviewed
}

/**
 * Apply mitigating factors to reduce risk score
 */
export function applyMitigatingFactors(
  riskScore: number,
  factors: MitigatingFactor[]
): number {
  const totalReduction = factors.reduce((sum, f) => sum + f.riskReduction, 0);
  return Math.max(0, riskScore - totalReduction);
}

/**
 * Calculate trend direction
 */
export function calculateTrend(
  currentScore: number,
  previousScore: number
): { direction: 'improving' | 'stable' | 'declining'; percentage: number } {
  const diff = previousScore - currentScore; // Lower risk = improvement
  const percentage = previousScore > 0
    ? Math.round((Math.abs(diff) / previousScore) * 100)
    : 0;

  if (Math.abs(diff) < 5) {
    return { direction: 'stable', percentage: 0 };
  }

  return {
    direction: diff > 0 ? 'improving' : 'declining',
    percentage,
  };
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return `${Math.round(score)}`;
}

/**
 * Get grade letter from display score
 */
export function getScoreGrade(displayScore: number): string {
  if (displayScore >= 90) return 'A+';
  if (displayScore >= 80) return 'A';
  if (displayScore >= 70) return 'B';
  if (displayScore >= 60) return 'C';
  if (displayScore >= 50) return 'D';
  return 'F';
}

/**
 * Validate section weights total 100
 */
export function validateSectionWeights(sections: { weight: number }[]): boolean {
  const total = sections.reduce((sum, s) => sum + s.weight, 0);
  return Math.abs(total - 100) < 0.01;
}

/**
 * Normalize section weights to total 100
 */
export function normalizeSectionWeights(sections: { weight: number }[]): number[] {
  const total = sections.reduce((sum, s) => sum + s.weight, 0);
  if (total === 0) return sections.map(() => 100 / sections.length);
  return sections.map(s => (s.weight / total) * 100);
}
