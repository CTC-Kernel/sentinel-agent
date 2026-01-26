/**
 * Agent Evidence Types
 *
 * Types for linking agent compliance check results to framework controls.
 * Enables automatic evidence collection and compliance verification.
 */

import { RegulatoryFrameworkCode } from './framework';

/**
 * Agent check identifiers
 * These correspond to the checks performed by the Sentinel agent
 */
export const AGENT_CHECK_IDS = [
    'mfa_enabled',
    'disk_encryption',
    'firewall_active',
    'audit_logging',
    'patches_current',
    'antivirus_active',
    'screen_lock',
    'password_policy',
    'remote_access_secure',
    'backup_configured',
] as const;

export type AgentCheckId = typeof AGENT_CHECK_IDS[number];

/**
 * Agent check metadata
 */
export interface AgentCheckDefinition {
    id: AgentCheckId;
    name: string;
    description: string;
    category: 'access_control' | 'data_protection' | 'network_security' | 'system_integrity' | 'monitoring';
    severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Mapping between agent checks and framework requirements
 */
export interface CheckControlMapping {
    checkId: AgentCheckId;
    frameworkCode: RegulatoryFrameworkCode;
    requirementId: string;
    articleReference: string;
    coverageType: 'full' | 'partial';
    weight: number; // 0-100, how much this check contributes to requirement satisfaction
}

/**
 * Agent evidence record
 * Links an agent check result to a compliance control/requirement
 */
export interface AgentEvidence {
    /** Unique evidence ID */
    id: string;

    /** Organization ID for multi-tenant isolation */
    organizationId: string;

    /** Reference to the agent result that generated this evidence */
    resultId: string;

    /** Agent ID that produced this evidence */
    agentId: string;

    /** Check ID that was performed */
    checkId: AgentCheckId;

    /** Control ID this evidence is linked to */
    controlId: string;

    /** Requirement ID being satisfied */
    requirementId?: string;

    /** Framework this evidence applies to */
    frameworkCode: RegulatoryFrameworkCode;

    /** Article/clause reference in the framework */
    articleReference: string;

    /** Pass/fail status from the agent check */
    status: 'pass' | 'fail' | 'error' | 'not_applicable';

    /** Confidence score (0-100) - decays over time */
    confidenceScore: number;

    /** Raw evidence data from the agent */
    evidence: Record<string, unknown>;

    /** Human-readable summary of the evidence */
    summary: string;

    /** When the check was performed */
    verifiedAt: string;

    /** When the evidence was created */
    createdAt: string;

    /** When the evidence expires (for re-verification) */
    expiresAt: string;

    /** Whether this evidence has been manually reviewed */
    reviewed: boolean;

    /** User who reviewed the evidence */
    reviewedBy?: string;

    /** Review timestamp */
    reviewedAt?: string;

    /** Review notes */
    reviewNotes?: string;
}

/**
 * Evidence confidence calculation factors
 */
export interface EvidenceConfidenceFactors {
    /** Base confidence from check result (pass=100, fail=0) */
    baseScore: number;

    /** Time decay factor (decreases over time since verification) */
    timeDecay: number;

    /** Agent health factor (based on agent status and metrics) */
    agentHealthFactor: number;

    /** Coverage factor (full vs partial coverage) */
    coverageFactor: number;

    /** Final calculated confidence */
    finalScore: number;
}

/**
 * Aggregated evidence for a control
 */
export interface ControlEvidenceSummary {
    controlId: string;
    controlCode: string;
    controlName: string;

    /** Total evidence count from agents */
    totalEvidence: number;

    /** Passing evidence count */
    passingEvidence: number;

    /** Failing evidence count */
    failingEvidence: number;

    /** Average confidence score */
    averageConfidence: number;

    /** Last verification timestamp */
    lastVerified: string | null;

    /** Linked agent IDs */
    agentIds: string[];

    /** Evidence by check type */
    evidenceByCheck: {
        checkId: AgentCheckId;
        status: 'pass' | 'fail' | 'mixed';
        count: number;
        lastVerified: string;
    }[];

    /** Overall compliance status derived from evidence */
    complianceStatus: 'verified' | 'partial' | 'non_compliant' | 'pending';
}

/**
 * Framework evidence coverage
 */
export interface FrameworkEvidenceCoverage {
    frameworkCode: RegulatoryFrameworkCode;
    frameworkName: string;

    /** Total requirements in framework */
    totalRequirements: number;

    /** Requirements with agent evidence */
    coveredRequirements: number;

    /** Coverage percentage */
    coveragePercent: number;

    /** Requirements by status */
    requirementsByStatus: {
        verified: number;
        partial: number;
        non_compliant: number;
        pending: number;
    };

    /** Average confidence across all evidence */
    averageConfidence: number;

    /** Last evidence collection timestamp */
    lastUpdated: string;
}

/**
 * Evidence collection stats for dashboard
 */
export interface EvidenceCollectionStats {
    /** Total evidence records */
    totalEvidence: number;

    /** Evidence collected in last 24h */
    last24h: number;

    /** Evidence collected in last 7 days */
    last7d: number;

    /** Active agents contributing evidence */
    activeAgents: number;

    /** Controls with evidence */
    controlsCovered: number;

    /** Frameworks with coverage */
    frameworksCovered: number;

    /** Average confidence score */
    averageConfidence: number;

    /** Evidence requiring review */
    pendingReview: number;

    /** Expired evidence needing refresh */
    expiredEvidence: number;
}

/**
 * Check definitions with human-readable information
 */
export const AGENT_CHECK_DEFINITIONS: Record<AgentCheckId, AgentCheckDefinition> = {
    mfa_enabled: {
        id: 'mfa_enabled',
        name: 'Authentification MFA',
        description: 'Vérifie que l\'authentification multi-facteurs est activée',
        category: 'access_control',
        severity: 'critical',
    },
    disk_encryption: {
        id: 'disk_encryption',
        name: 'Chiffrement disque',
        description: 'Vérifie que le chiffrement du disque est actif (BitLocker/FileVault)',
        category: 'data_protection',
        severity: 'critical',
    },
    firewall_active: {
        id: 'firewall_active',
        name: 'Pare-feu actif',
        description: 'Vérifie que le pare-feu système est activé',
        category: 'network_security',
        severity: 'high',
    },
    audit_logging: {
        id: 'audit_logging',
        name: 'Journalisation audit',
        description: 'Vérifie que la journalisation d\'audit est configurée',
        category: 'monitoring',
        severity: 'high',
    },
    patches_current: {
        id: 'patches_current',
        name: 'Correctifs à jour',
        description: 'Vérifie que les correctifs de sécurité sont à jour',
        category: 'system_integrity',
        severity: 'critical',
    },
    antivirus_active: {
        id: 'antivirus_active',
        name: 'Antivirus actif',
        description: 'Vérifie que l\'antivirus est installé et actif',
        category: 'system_integrity',
        severity: 'high',
    },
    screen_lock: {
        id: 'screen_lock',
        name: 'Verrouillage écran',
        description: 'Vérifie que le verrouillage automatique de l\'écran est configuré',
        category: 'access_control',
        severity: 'medium',
    },
    password_policy: {
        id: 'password_policy',
        name: 'Politique mot de passe',
        description: 'Vérifie la conformité de la politique de mot de passe',
        category: 'access_control',
        severity: 'high',
    },
    remote_access_secure: {
        id: 'remote_access_secure',
        name: 'Accès distant sécurisé',
        description: 'Vérifie la sécurité des accès distants (SSH, RDP)',
        category: 'network_security',
        severity: 'high',
    },
    backup_configured: {
        id: 'backup_configured',
        name: 'Sauvegarde configurée',
        description: 'Vérifie que les sauvegardes automatiques sont configurées',
        category: 'data_protection',
        severity: 'medium',
    },
};

/**
 * Default check-to-control mappings
 * These map agent checks to framework requirements
 * Using only valid RegulatoryFrameworkCode values: NIS2, DORA, RGPD, AI_ACT, ISO27001, ISO22301, SOC2, PCI_DSS, NIST_CSF, HDS, SECNUMCLOUD
 */
export const DEFAULT_CHECK_CONTROL_MAPPINGS: CheckControlMapping[] = [
    // NIS2 Mappings
    { checkId: 'mfa_enabled', frameworkCode: 'NIS2', requirementId: 'art-21-2-j', articleReference: 'Art.21.2.j', coverageType: 'full', weight: 100 },
    { checkId: 'disk_encryption', frameworkCode: 'NIS2', requirementId: 'art-21-2-d', articleReference: 'Art.21.2.d', coverageType: 'partial', weight: 60 },
    { checkId: 'firewall_active', frameworkCode: 'NIS2', requirementId: 'art-21-2-c', articleReference: 'Art.21.2.c', coverageType: 'partial', weight: 40 },
    { checkId: 'audit_logging', frameworkCode: 'NIS2', requirementId: 'art-21-2-g', articleReference: 'Art.21.2.g', coverageType: 'partial', weight: 50 },
    { checkId: 'patches_current', frameworkCode: 'NIS2', requirementId: 'art-21-2-e', articleReference: 'Art.21.2.e', coverageType: 'full', weight: 100 },

    // DORA Mappings
    { checkId: 'mfa_enabled', frameworkCode: 'DORA', requirementId: 'art-9-4-c', articleReference: 'Art.9.4.c', coverageType: 'full', weight: 100 },
    { checkId: 'disk_encryption', frameworkCode: 'DORA', requirementId: 'art-9-2-b', articleReference: 'Art.9.2.b', coverageType: 'partial', weight: 60 },
    { checkId: 'firewall_active', frameworkCode: 'DORA', requirementId: 'art-9-3-a', articleReference: 'Art.9.3.a', coverageType: 'partial', weight: 40 },
    { checkId: 'audit_logging', frameworkCode: 'DORA', requirementId: 'art-12-1', articleReference: 'Art.12.1', coverageType: 'partial', weight: 50 },
    { checkId: 'patches_current', frameworkCode: 'DORA', requirementId: 'art-9-4-a', articleReference: 'Art.9.4.a', coverageType: 'full', weight: 100 },

    // ISO 27001 Mappings
    { checkId: 'mfa_enabled', frameworkCode: 'ISO27001', requirementId: 'a-9-4-2', articleReference: 'A.9.4.2', coverageType: 'full', weight: 100 },
    { checkId: 'disk_encryption', frameworkCode: 'ISO27001', requirementId: 'a-10-1-1', articleReference: 'A.10.1.1', coverageType: 'partial', weight: 60 },
    { checkId: 'firewall_active', frameworkCode: 'ISO27001', requirementId: 'a-13-1-1', articleReference: 'A.13.1.1', coverageType: 'partial', weight: 40 },
    { checkId: 'audit_logging', frameworkCode: 'ISO27001', requirementId: 'a-12-4-1', articleReference: 'A.12.4.1', coverageType: 'partial', weight: 50 },
    { checkId: 'patches_current', frameworkCode: 'ISO27001', requirementId: 'a-12-6-1', articleReference: 'A.12.6.1', coverageType: 'full', weight: 100 },
    { checkId: 'antivirus_active', frameworkCode: 'ISO27001', requirementId: 'a-12-2-1', articleReference: 'A.12.2.1', coverageType: 'full', weight: 100 },
    { checkId: 'backup_configured', frameworkCode: 'ISO27001', requirementId: 'a-12-3-1', articleReference: 'A.12.3.1', coverageType: 'partial', weight: 50 },

    // SOC2 Mappings
    { checkId: 'mfa_enabled', frameworkCode: 'SOC2', requirementId: 'cc6-1', articleReference: 'CC6.1', coverageType: 'full', weight: 100 },
    { checkId: 'disk_encryption', frameworkCode: 'SOC2', requirementId: 'cc6-7', articleReference: 'CC6.7', coverageType: 'full', weight: 100 },
    { checkId: 'audit_logging', frameworkCode: 'SOC2', requirementId: 'cc7-2', articleReference: 'CC7.2', coverageType: 'partial', weight: 60 },
];

/**
 * Helper to get mappings for a specific check
 */
export const getMappingsForCheck = (checkId: AgentCheckId): CheckControlMapping[] => {
    return DEFAULT_CHECK_CONTROL_MAPPINGS.filter(m => m.checkId === checkId);
};

/**
 * Helper to get mappings for a specific framework
 */
export const getMappingsForFramework = (frameworkCode: RegulatoryFrameworkCode): CheckControlMapping[] => {
    return DEFAULT_CHECK_CONTROL_MAPPINGS.filter(m => m.frameworkCode === frameworkCode);
};

/**
 * Calculate confidence score based on time elapsed
 * Score decays linearly over 30 days
 */
export const calculateConfidenceDecay = (verifiedAt: string, baseScore: number = 100): number => {
    const verifiedDate = new Date(verifiedAt);
    const now = new Date();
    const daysSinceVerification = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);

    // Linear decay: lose 3.33% per day, reaches 0 at 30 days
    const decayFactor = Math.max(0, 1 - (daysSinceVerification / 30));
    return Math.round(baseScore * decayFactor);
};
