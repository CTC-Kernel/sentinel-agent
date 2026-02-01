/**
 * Vendor Concentration Types
 * Types for vendor concentration risk analysis
 * Story 37-4: Vendor Concentration Dashboard
 */

// ============================================================================
// Core Concentration Types
// ============================================================================

/**
 * Dependency level classification
 */
export type DependencyLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Urgency level for actions
 */
export type UrgencyLevel = 'immediate' | 'short-term' | 'long-term';

/**
 * Effort estimation for recommendations
 */
export type EffortLevel = 'low' | 'medium' | 'high';

/**
 * Vendor summary for concentration analysis
 */
export interface VendorSummary {
  supplierId: string;
  name: string;
  category: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
  servicesCount: number;
  criticalServicesCount: number;
  contractValue?: number;
  lastAssessedAt?: string;
}

// ============================================================================
// Category Concentration
// ============================================================================

/**
 * Concentration data for a single category
 */
export interface CategoryConcentration {
  category: string;
  categoryLabel: string;
  vendorCount: number;
  percentage: number;
  vendors: VendorSummary[];
  isCritical: boolean;
  hasSPOF: boolean;
  herfindahlIndex: number;
  dominantVendor?: VendorSummary;
  dominantVendorShare?: number;
}

/**
 * Overall concentration metrics
 */
export interface ConcentrationMetrics {
  organizationId: string;
  totalVendors: number;
  totalCategories: number;
  activeVendors: number;
  categoryConcentration: CategoryConcentration[];
  spofCount: number;
  highDependencyCount: number;
  overallHHI: number;
  overallRiskScore: number;
  concentrationLevel: 'low' | 'moderate' | 'high';
  calculatedAt: string;
}

// ============================================================================
// SPOF (Single Point of Failure) Types
// ============================================================================

/**
 * Impact level for SPOF
 */
export type VendorImpactLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Single Point of Failure alert
 */
export interface SPOFAlert {
  id: string;
  category: string;
  categoryLabel: string;
  vendor: VendorSummary;
  impactLevel: VendorImpactLevel;
  affectedServices: string[];
  affectedProcesses: string[];
  estimatedDowntimeRisk: string;
  recommendation: string;
  urgency: UrgencyLevel;
  createdAt: string;
}

/**
 * SPOF summary for dashboard
 */
export interface SPOFSummary {
  totalSPOFs: number;
  criticalSPOFs: number;
  highImpactSPOFs: number;
  alerts: SPOFAlert[];
  topCategories: string[];
}

// ============================================================================
// Dependency Types
// ============================================================================

/**
 * Vendor dependency entry
 */
export interface VendorDependency {
  supplierId: string;
  vendorName: string;
  category: string;
  dependencyLevel: DependencyLevel;
  servicesDependent: string[];
  criticalServices: string[];
  processesDependent: string[];
  alternativeAvailable: boolean;
  switchingCost: EffortLevel;
  contractEndDate?: string;
}

/**
 * Dependency matrix cell
 */
export interface DependencyMatrixCell {
  vendorId: string;
  vendorName: string;
  serviceId: string;
  serviceName: string;
  isCritical: boolean;
  dependencyLevel: DependencyLevel;
}

/**
 * Full dependency matrix
 */
export interface DependencyMatrix {
  vendors: VendorSummary[];
  services: { id: string; name: string; isCritical: boolean }[];
  cells: DependencyMatrixCell[];
  totalDependencies: number;
  criticalDependencies: number;
}

// ============================================================================
// Recommendation Types
// ============================================================================

/**
 * Recommended action
 */
export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  effort: EffortLevel;
  timeline: string;
}

/**
 * Diversification recommendation
 */
export interface DiversificationRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  categoryLabel: string;
  currentState: string;
  targetState: string;
  recommendation: string;
  rationale: string;
  expectedRiskReduction: number;
  estimatedEffort: EffortLevel;
  estimatedTimeline: string;
  actions: RecommendedAction[];
  relatedSPOF?: string;
}

/**
 * Recommendations summary
 */
export interface RecommendationsSummary {
  totalRecommendations: number;
  highPriority: number;
  estimatedTotalRiskReduction: number;
  recommendations: DiversificationRecommendation[];
}

// ============================================================================
// Trend Types
// ============================================================================

/**
 * Concentration trend data point
 */
export interface ConcentrationTrendPoint {
  date: string;
  vendorCount: number;
  spofCount: number;
  hhi: number;
  overallRisk: number;
}

/**
 * Category trend data point
 */
export interface CategoryTrendPoint {
  date: string;
  category: string;
  vendorCount: number;
  concentration: number;
}

/**
 * Concentration trends
 */
export interface ConcentrationTrends {
  organizationId: string;
  period: '30d' | '90d' | '180d' | '365d';
  overallTrend: ConcentrationTrendPoint[];
  categoryTrends: Record<string, CategoryTrendPoint[]>;
  trendDirection: 'improving' | 'stable' | 'worsening';
  changePercentage: number;
}

// ============================================================================
// Dashboard Filter Types
// ============================================================================

/**
 * Concentration dashboard filters
 */
export interface ConcentrationFilters {
  categories?: string[];
  riskLevels?: ('Low' | 'Medium' | 'High' | 'Critical')[];
  dependencyLevels?: DependencyLevel[];
  showSPOFOnly?: boolean;
  showCriticalOnly?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate Herfindahl-Hirschman Index
 * < 1500: Low concentration (competitive)
 * 1500-2500: Moderate concentration
 * > 2500: High concentration
 */
export function calculateHHI(shares: number[]): number {
  return shares.reduce((sum, share) => sum + Math.pow(share, 2), 0);
}

/**
 * Get HHI concentration level
 */
export function getHHILevel(hhi: number): 'low' | 'moderate' | 'high' {
  if (hhi < 1500) return 'low';
  if (hhi < 2500) return 'moderate';
  return 'high';
}

/**
 * Get dependency level from metrics
 */
export function getDependencyLevel(
  _servicesCount: number,
  criticalServicesCount: number,
  categoryShare: number
): DependencyLevel {
  if (criticalServicesCount >= 3 || categoryShare >= 50) return 'critical';
  if (criticalServicesCount >= 2 || categoryShare >= 30) return 'high';
  if (criticalServicesCount >= 1 || categoryShare >= 15) return 'medium';
  return 'low';
}

/**
 * Check if vendor is a SPOF
 */
export function isSPOF(
  vendorCount: number,
  categoryShare: number,
  criticalServicesCount: number
): boolean {
  return vendorCount === 1 || categoryShare >= 80 || criticalServicesCount >= 5;
}

/**
 * Get impact level from affected services
 */
export function getVendorImpactLevel(
  criticalServicesCount: number,
  totalServicesCount: number
): VendorImpactLevel {
  const criticalRatio = totalServicesCount > 0
    ? criticalServicesCount / totalServicesCount
    : 0;

  if (criticalServicesCount >= 5 || criticalRatio >= 0.5) return 'critical';
  if (criticalServicesCount >= 3 || criticalRatio >= 0.3) return 'high';
  if (criticalServicesCount >= 1 || criticalRatio >= 0.1) return 'medium';
  return 'low';
}

/**
 * Get urgency level from impact
 */
export function getUrgencyLevel(impactLevel: VendorImpactLevel): UrgencyLevel {
  if (impactLevel === 'critical') return 'immediate';
  if (impactLevel === 'high') return 'short-term';
  return 'long-term';
}

/**
 * Get dependency level color
 */
export function getDependencyLevelColor(level: DependencyLevel): string {
  const colors: Record<DependencyLevel, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-orange-600',
    critical: 'text-red-600',
  };
  return colors[level];
}

/**
 * Get dependency level background color
 */
export function getDependencyLevelBgColor(level: DependencyLevel): string {
  const colors: Record<DependencyLevel, string> = {
    low: 'bg-green-100 dark:bg-green-900/30',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30',
    high: 'bg-orange-100 dark:bg-orange-900/30',
    critical: 'bg-red-100 dark:bg-red-900/30',
  };
  return colors[level];
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-green-600',
  };
  return colors[priority];
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Get trend icon and color
 */
export function getTrendIndicator(direction: 'improving' | 'stable' | 'worsening'): {
  color: string;
  icon: 'up' | 'right' | 'down';
} {
  switch (direction) {
    case 'improving':
      return { color: 'text-green-600', icon: 'up' };
    case 'worsening':
      return { color: 'text-red-600', icon: 'down' };
    default:
      return { color: 'text-slate-500', icon: 'right' };
  }
}

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<string, string> = {
  cloud: 'Cloud & Infrastructure',
  security: 'Cybersecurity',
  software: 'Software & SaaS',
  network: 'Network & Telecom',
  data: 'Data & Analytics',
  payment: 'Payment & Finance',
  hr: 'HR & Payroll',
  legal: 'Legal & Compliance',
  marketing: 'Marketing & CRM',
  support: 'Support & Services',
  other: 'Other',
};

/**
 * Get category label
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category.toLowerCase()] || category;
}
