/**
 * Software Inventory & CIS Benchmark Types
 *
 * Types for fleet-wide software inventory management,
 * authorization tracking, and CIS Benchmarks compliance.
 */

/**
 * Software risk levels
 */
export const RISK_LEVELS = ['critical', 'high', 'medium', 'low', 'none'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

/**
 * Software authorization status
 */
export const AUTHORIZATION_STATUS = ['authorized', 'pending', 'unauthorized', 'blocked'] as const;
export type AuthorizationStatus = typeof AUTHORIZATION_STATUS[number];

/**
 * Software categories
 */
export const SOFTWARE_CATEGORIES = [
 'productivity',
 'development',
 'security',
 'communication',
 'browser',
 'utility',
 'media',
 'system',
 'other'
] as const;
export type SoftwareCategory = typeof SOFTWARE_CATEGORIES[number];

/**
 * Individual software item on a single agent
 */
export interface AgentSoftwareItem {
 /** Software name */
 name: string;

 /** Installed version */
 version: string;

 /** Publisher/vendor */
 vendor?: string;

 /** Installation path */
 installPath?: string;

 /** Installation date */
 installDate?: string;

 /** Last used date (if available) */
 lastUsed?: string;

 /** Size in bytes */
 sizeBytes?: number;

 /** Is system software */
 isSystem: boolean;

 /** Architecture (x64, arm64, etc.) */
 architecture?: string;
}

/**
 * Aggregated software entry across fleet
 * Stored in organizations/{orgId}/softwareInventory/{id}
 */
export interface SoftwareInventoryEntry {
 /** Document ID */
 id: string;

 /** Organization ID */
 organizationId: string;

 /** Normalized software name */
 name: string;

 /** Vendor/publisher */
 vendor: string;

 /** Category */
 category: SoftwareCategory;

 /** All versions found across fleet */
 versions: SoftwareVersion[];

 /** Total agent count with this software */
 agentCount: number;

 /** Agent IDs with this software */
 agentIds: string[];

 /** Authorization status */
 authorizationStatus: AuthorizationStatus;

 /** Who authorized/blocked (userId) */
 authorizedBy?: string;

 /** Authorization date */
 authorizedAt?: string;

 /** Authorization notes */
 authorizationNotes?: string;

 /** Risk level (calculated from CVEs + other factors) */
 riskLevel: RiskLevel;

 /** Risk score (0-100) */
 riskScore: number;

 /** Risk factors */
 riskFactors: SoftwareRiskFactors;

 /** Linked CVE IDs */
 linkedCveIds: string[];

 /** Has known vulnerabilities */
 hasVulnerabilities: boolean;

 /** Vulnerability count by severity */
 vulnerabilitySummary: {
 critical: number;
 high: number;
 medium: number;
 low: number;
 };

 /** First discovered in fleet */
 firstDiscovered: string;

 /** Last seen in fleet */
 lastSeen: string;

 /** Last updated */
 updatedAt: string;

 /** Software metadata */
 metadata?: Record<string, unknown>;
}

/**
 * Version details for a software
 */
export interface SoftwareVersion {
 /** Version string */
 version: string;

 /** Agent count with this version */
 agentCount: number;

 /** Agent IDs with this version */
 agentIds: string[];

 /** Is this the latest version? */
 isLatest: boolean;

 /** Is this version outdated? */
 isOutdated: boolean;

 /** Known CVEs for this version */
 cveIds: string[];

 /** Risk level for this version */
 riskLevel: RiskLevel;

 /** First seen */
 firstSeen: string;

 /** Last seen */
 lastSeen: string;
}

/**
 * Software risk factors
 */
export interface SoftwareRiskFactors {
 /** Vulnerability score contribution */
 vulnerabilityScore: number;

 /** Outdated version score */
 outdatedScore: number;

 /** Unauthorized software score */
 unauthorizedScore: number;

 /** Exposure score (% of fleet) */
 exposureScore: number;

 /** End of life score */
 eolScore: number;
}

/**
 * Software authorization request
 */
export interface SoftwareAuthorizationRequest {
 /** Request ID */
 id: string;

 /** Organization ID */
 organizationId: string;

 /** Software inventory entry ID */
 softwareId: string;

 /** Software name */
 softwareName: string;

 /** Requested by (userId) */
 requestedBy: string;

 /** Requester email */
 requesterEmail: string;

 /** Business justification */
 justification: string;

 /** Request status */
 status: 'pending' | 'approved' | 'rejected';

 /** Reviewed by (userId) */
 reviewedBy?: string;

 /** Review date */
 reviewedAt?: string;

 /** Review notes */
 reviewNotes?: string;

 /** Created at */
 createdAt: string;
}

/**
 * Software inventory statistics
 */
export interface SoftwareInventoryStats {
 /** Total unique software */
 totalSoftware: number;

 /** Total installations (software x agents) */
 totalInstallations: number;

 /** By authorization status */
 byAuthorization: {
 authorized: number;
 pending: number;
 unauthorized: number;
 blocked: number;
 };

 /** By risk level */
 byRiskLevel: {
 critical: number;
 high: number;
 medium: number;
 low: number;
 none: number;
 };

 /** By category */
 byCategory: Record<SoftwareCategory, number>;

 /** Software with vulnerabilities */
 withVulnerabilities: number;

 /** Outdated software count */
 outdatedCount: number;

 /** Agents scanned */
 agentsScanned: number;

 /** Last scan timestamp */
 lastScanAt: string;

 /** New software this week */
 newThisWeek: number;

 /** Pending authorization requests */
 pendingRequests: number;
}

// =============================================================================
// CIS BENCHMARK TYPES
// =============================================================================

/**
 * CIS Benchmark levels
 */
export const CIS_LEVELS = ['L1', 'L2', 'BL'] as const; // Level 1, Level 2, BitLocker (for Windows)
export type CISLevel = typeof CIS_LEVELS[number];

/**
 * CIS Check status
 */
export const CIS_CHECK_STATUS = ['pass', 'fail', 'manual', 'not_applicable', 'error'] as const;
export type CISCheckStatus = typeof CIS_CHECK_STATUS[number];

/**
 * CIS Benchmark definition
 */
export interface CISBenchmark {
 /** Benchmark ID (e.g., 'CIS_WIN11_L1') */
 id: string;

 /** Full name */
 name: string;

 /** Version */
 version: string;

 /** Target OS */
 targetOS: 'windows' | 'linux' | 'darwin';

 /** OS version specifics (e.g., 'Windows 11', 'Ubuntu 22.04') */
 osVersion?: string;

 /** Level */
 level: CISLevel;

 /** Total checks in benchmark */
 totalChecks: number;

 /** Categories/sections */
 categories: CISCategory[];

 /** Publication date */
 publishedDate: string;

 /** Description */
 description: string;
}

/**
 * CIS Benchmark category (section)
 */
export interface CISCategory {
 /** Category ID (e.g., '1', '2.1') */
 id: string;

 /** Category name */
 name: string;

 /** Check count in category */
 checkCount: number;

 /** Subcategories */
 subcategories?: CISCategory[];
}

/**
 * Individual CIS check definition
 */
export interface CISCheckDefinition {
 /** Check ID (e.g., '1.1.1') */
 id: string;

 /** Benchmark ID */
 benchmarkId: string;

 /** Title */
 title: string;

 /** Description */
 description: string;

 /** Rationale */
 rationale: string;

 /** Level (L1/L2) */
 level: CISLevel;

 /** Category path */
 categoryPath: string[];

 /** Audit procedure */
 auditProcedure: string;

 /** Remediation steps */
 remediation: string;

 /** Impact if remediated */
 impact?: string;

 /** Default value */
 defaultValue?: string;

 /** References */
 references?: string[];

 /** CIS Control mapping */
 cisControlsMapping?: string[];

 /** Is automated check */
 isAutomated: boolean;

 /** Check type */
 checkType: 'registry' | 'policy' | 'service' | 'file' | 'command' | 'manual';

 /** Expected value for automated checks */
 expectedValue?: string | number | boolean;

 /** Registry path for registry checks */
 registryPath?: string;

 /** Registry value name */
 registryValueName?: string;
}

/**
 * CIS check result for a single agent
 */
export interface CISCheckResult {
 /** Result ID */
 id: string;

 /** Check definition ID */
 checkId: string;

 /** Benchmark ID */
 benchmarkId: string;

 /** Agent ID */
 agentId: string;

 /** Status */
 status: CISCheckStatus;

 /** Actual value found */
 actualValue?: string | number | boolean;

 /** Expected value */
 expectedValue?: string | number | boolean;

 /** Evidence/details */
 evidence: Record<string, unknown>;

 /** Error message if status is 'error' */
 errorMessage?: string;

 /** Timestamp */
 timestamp: string;

 /** Duration in milliseconds */
 durationMs: number;
}

/**
 * CIS Baseline for an agent
 * Stored in organizations/{orgId}/cisBaselines/{agentId}
 */
export interface CISBaseline {
 /** Document ID (same as agentId) */
 id: string;

 /** Agent ID */
 agentId: string;

 /** Organization ID */
 organizationId: string;

 /** Benchmark ID used */
 benchmarkId: string;

 /** Benchmark name */
 benchmarkName: string;

 /** Overall compliance score (0-100) */
 complianceScore: number;

 /** Results by status */
 summary: {
 pass: number;
 fail: number;
 manual: number;
 notApplicable: number;
 error: number;
 total: number;
 };

 /** Results by category */
 categoryResults: CISCategoryResult[];

 /** Individual check results */
 results: CISCheckResult[];

 /** Last scan timestamp */
 lastScanAt: string;

 /** Previous scan score (for trend) */
 previousScore?: number;

 /** Score change from previous */
 scoreChange?: number;

 /** History of scores */
 scoreHistory: {
 timestamp: string;
 score: number;
 }[];
}

/**
 * Category-level results
 */
export interface CISCategoryResult {
 /** Category ID */
 categoryId: string;

 /** Category name */
 categoryName: string;

 /** Pass count */
 pass: number;

 /** Fail count */
 fail: number;

 /** Total count */
 total: number;

 /** Compliance percentage */
 compliancePercent: number;
}

/**
 * Fleet-wide CIS compliance statistics
 */
export interface CISFleetStats {
 /** Benchmark ID */
 benchmarkId: string;

 /** Benchmark name */
 benchmarkName: string;

 /** Average compliance score */
 averageScore: number;

 /** Agents scanned */
 agentsScanned: number;

 /** Score distribution */
 scoreDistribution: {
 excellent: number; // 90-100
 good: number; // 70-89
 fair: number; // 50-69
 poor: number; // 0-49
 };

 /** Most failed checks */
 topFailedChecks: {
 checkId: string;
 title: string;
 failCount: number;
 failPercent: number;
 }[];

 /** Category compliance */
 categoryCompliance: {
 categoryId: string;
 categoryName: string;
 averagePercent: number;
 }[];

 /** Last updated */
 lastUpdated: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get risk level from score
 */
export function getRiskLevel(score: number): RiskLevel {
 if (score >= 90) return 'critical';
 if (score >= 70) return 'high';
 if (score >= 40) return 'medium';
 if (score >= 10) return 'low';
 return 'none';
}

/**
 * Get risk level color class
 */
export function getRiskLevelColor(level: RiskLevel): string {
 switch (level) {
 case 'critical': return 'text-destructive';
 case 'high': return 'text-orange-500';
 case 'medium': return 'text-warning';
 case 'low': return 'text-success';
 case 'none': return 'text-muted-foreground';
 }
}

/**
 * Get risk level background color class
 */
export function getRiskLevelBgColor(level: RiskLevel): string {
 switch (level) {
 case 'critical': return 'bg-destructive/10';
 case 'high': return 'bg-orange-500/10';
 case 'medium': return 'bg-warning/10';
 case 'low': return 'bg-success/10';
 case 'none': return 'bg-muted/10';
 }
}

/**
 * Get authorization status color
 */
export function getAuthorizationColor(status: AuthorizationStatus): string {
 switch (status) {
 case 'authorized': return 'text-success';
 case 'pending': return 'text-warning';
 case 'unauthorized': return 'text-orange-500';
 case 'blocked': return 'text-destructive';
 }
}

/**
 * Get CIS check status color
 */
export function getCISStatusColor(status: CISCheckStatus): string {
 switch (status) {
 case 'pass': return 'text-success';
 case 'fail': return 'text-destructive';
 case 'manual': return 'text-warning';
 case 'not_applicable': return 'text-muted-foreground';
 case 'error': return 'text-orange-500';
 }
}

/**
 * Get CIS check status icon name
 */
export function getCISStatusIcon(status: CISCheckStatus): string {
 switch (status) {
 case 'pass': return 'CheckCircle';
 case 'fail': return 'XCircle';
 case 'manual': return 'AlertCircle';
 case 'not_applicable': return 'MinusCircle';
 case 'error': return 'AlertTriangle';
 }
}

/**
 * Calculate software risk score
 */
export function calculateSoftwareRiskScore(
 vulnerabilitySummary: SoftwareInventoryEntry['vulnerabilitySummary'],
 isOutdated: boolean,
 isUnauthorized: boolean,
 fleetExposure: number // 0-1
): number {
 let score = 0;

 // Vulnerability contribution (max 50 points)
 score += vulnerabilitySummary.critical * 15;
 score += vulnerabilitySummary.high * 8;
 score += vulnerabilitySummary.medium * 3;
 score += vulnerabilitySummary.low * 1;
 score = Math.min(score, 50);

 // Outdated contribution (max 20 points)
 if (isOutdated) {
 score += 20;
 }

 // Unauthorized contribution (max 15 points)
 if (isUnauthorized) {
 score += 15;
 }

 // Fleet exposure contribution (max 15 points)
 score += fleetExposure * 15;

 return Math.min(100, Math.round(score));
}

/**
 * Compare software versions (semantic versioning)
 */
export function compareVersions(v1: string, v2: string): number {
 const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
 const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);

 const maxLength = Math.max(parts1.length, parts2.length);

 for (let i = 0; i < maxLength; i++) {
 const p1 = parts1[i] || 0;
 const p2 = parts2[i] || 0;

 if (p1 > p2) return 1;
 if (p1 < p2) return -1;
 }

 return 0;
}

/**
 * Format software category label
 */
export function formatCategoryLabel(category: SoftwareCategory): string {
 const labels: Record<SoftwareCategory, string> = {
 productivity: 'Productivité',
 development: 'Développement',
 security: 'Sécurité',
 communication: 'Communication',
 browser: 'Navigateur',
 utility: 'Utilitaire',
 media: 'Média',
 system: 'Système',
 other: 'Autre'
 };
 return labels[category];
}
