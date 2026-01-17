import { Framework, AIAnalysisResult } from './common';

/**
 * Unified risk status enumeration
 */
export const RISK_STATUSES = [
    'Brouillon',
    'Ouvert',
    'En cours',
    'En attente de validation',
    'Fermé'
] as const;

export type RiskStatus = typeof RISK_STATUSES[number];

/**
 * Risk status state machine - defines valid transitions
 * Prevents invalid state changes (e.g., Fermé → Ouvert)
 */
export const VALID_RISK_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
    'Brouillon': ['Ouvert'],
    'Ouvert': ['En cours', 'Fermé'],
    'En cours': ['En attente de validation', 'Fermé'],
    'En attente de validation': ['En cours', 'Fermé'],
    'Fermé': [] // Terminal state - no transitions allowed
};

/**
 * Check if a risk status transition is valid
 */
export function isValidRiskTransition(from: RiskStatus, to: RiskStatus): boolean {
    return VALID_RISK_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Unified treatment status enumeration (French)
 * Replaces dual English/French fields
 */
export const TREATMENT_STATUSES = [
    'Planifié',
    'En cours',
    'Terminé',
    'Retard'
] as const;

export type TreatmentStatus = typeof TREATMENT_STATUSES[number];

export interface MitreTechnique {
    id: string;
    name: string;
    description: string;
}

export interface CompanySearchResult {
    name: string;
    siren: string;
    address: string;
    activity: string;
}

export interface CyberNewsItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

export interface Vulnerability {
    id?: string;
    organizationId?: string;
    cveId: string;
    title?: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    score?: number;
    cvssVector?: string;
    publishedDate: string;
    dateDiscovered?: string;
    detectedAt?: string;
    remediatedAt?: string;
    status?: 'Open' | 'In Progress' | 'Resolved' | 'False Positive' | 'Patch Applied' | 'Risk Accepted';
    assetId?: string;
    assetName?: string;
    source: string;
    remediationPlan?: string;
    relatedRiskId?: string;
    assignee?: string;
    createdAt?: string;
    relatedTlptCampaignId?: string;
    relatedTlptCampaignName?: string;
    attachments?: EvidenceAttachment[];
    updatedAt?: string;
}

export interface EvidenceAttachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt: string;
    uploadedBy: string;
    hash?: string;
}

export interface Risk {
    id: string;
    organizationId: string;
    assetId: string;
    threat: string;
    scenario?: string; // Scénario de risque (ISO 27005)
    framework?: Framework;
    vulnerability: string;
    probability: 1 | 2 | 3 | 4 | 5;
    impact: 1 | 2 | 3 | 4 | 5;
    score: number;
    residualProbability?: 1 | 2 | 3 | 4 | 5;
    residualImpact?: 1 | 2 | 3 | 4 | 5;
    residualScore?: number;
    mitreTechniques?: MitreTechnique[];
    previousScore?: number;
    strategy: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
    status: RiskStatus;
    owner: string;
    ownerId?: string;
    mitigationControlIds?: string[];
    lastReviewDate?: string;
    createdAt?: string;
    affectedProcessIds?: string[];
    relatedSupplierIds?: string[];
    relatedProjectIds?: string[];
    history?: RiskHistory[];
    treatment?: RiskTreatment;
    treatmentActions?: TreatmentAction[];
    isSecureStorage?: boolean;
    // V2: SLA & Treatment
    treatmentDeadline?: string;
    treatmentOwnerId?: string;
    /** @deprecated Use treatment.status instead - unified in French */
    treatmentStatus?: TreatmentStatus;
    category?: string;
    updatedAt?: string;
    justification?: string;
    aiAnalysis?: AIAnalysisResult;
    // EBIOS RM Integration (Story 18.5)
    ebiosReference?: EbiosReference;
    source?: 'manual' | 'ebios_rm' | 'import';
}

export interface RiskTreatment {
    strategy?: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
    description?: string;
    ownerId?: string;
    dueDate?: string;
    completedDate?: string;
    status?: TreatmentStatus;
    slaStatus?: 'On Track' | 'At Risk' | 'Breached';
    estimatedCost?: number;
    measures?: string[]; // AI generated or manual measures
}

export type TreatmentActionStatus = 'À faire' | 'En cours' | 'Terminé';

export interface TreatmentAction {
    id: string;
    title: string;
    description?: string;
    ownerId?: string;
    deadline?: string;
    status: TreatmentActionStatus;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
}

export interface RiskRecommendation {
    title: string;
    description: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    suggested_actions: { action: string; priority: string }[];
    confidence_score: number;
}

export interface RiskHistory {
    id?: string;
    riskId?: string;
    organizationId?: string;
    date: string;
    previousScore: number;
    newScore: number;
    previousProbability?: number;
    newProbability?: number;
    previousImpact?: number;
    newImpact?: number;
    residualProbability?: number;
    residualImpact?: number;
    residualScore?: number;
    mitreTechniques?: MitreTechnique[];
    changedBy: string;
    reason?: string;
    action?: string; // Compatibility with generic logs
    details?: string; // Compatibility with legacy history
}

/**
 * EBIOS RM Reference - Links a Risk to its EBIOS source
 * Story 18.5: Création dans le registre de risques
 */
export interface EbiosReference {
    analysisId: string;
    analysisName: string;
    scenarioId: string;
    scenarioCode?: string;
    scenarioType: 'strategic' | 'operational';
}

export interface ThreatTemplate {
    id?: string; // Optional for hardcoded, required for Firestore
    name: string;
    description: string;
    field: string;
    scenario: string;
    threat: string;
    vulnerability: string;
    probability: number;
    impact: number;
    strategy: 'Accepter' | 'Éviter' | 'Transférer' | 'Atténuer';
    framework: string;
    treatment?: {
        strategy: 'Accepter' | 'Éviter' | 'Transférer' | 'Atténuer';
        description: string;
        status: TreatmentStatus;
        estimatedCost: number;
        dueDate: string;
    };
    source?: 'Standard' | 'Custom';
    organizationId?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Threat {
    id: string;
    title: string;
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    country: string;
    date: string;
    votes: number;
    comments: number;
    author: string;
    authorId?: string; // Link to user
    organizationId?: string; // Link to origin org
    coordinates?: [number, number];
    timestamp?: number;
    active?: boolean;
    verified?: boolean; // New verified field
    source?: string; // 'Community' | 'CISA' | 'URLhaus' | etc.
    description?: string;
    url?: string;
}

// AISuggestedLink moved to voxel.ts
