import { Framework, AIAnalysisResult } from './common';

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
    updatedAt?: string;
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
    status: 'Ouvert' | 'En cours' | 'Fermé' | 'En attente de validation';
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
    isSecureStorage?: boolean;
    // V2: SLA & Treatment
    treatmentDeadline?: string;
    treatmentOwnerId?: string;
    treatmentStatus?: 'Pending' | 'In Progress' | 'Done' | 'Overdue';
    category?: string;
    updatedAt?: string;
    justification?: string;
    aiAnalysis?: AIAnalysisResult;
}

export interface RiskTreatment {
    strategy?: 'Accepter' | 'Atténuer' | 'Transférer' | 'Éviter';
    description?: string;
    ownerId?: string;
    dueDate?: string;
    completedDate?: string;
    status?: 'Planifié' | 'En cours' | 'Terminé' | 'Retard';
    slaStatus?: 'On Track' | 'At Risk' | 'Breached';
    estimatedCost?: number;
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
        status: 'Planifié' | 'En cours' | 'Terminé' | 'Annulé';
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
}

export interface AISuggestedLink {
    id: string;
    sourceId: string;
    targetId: string;
    type: 'risk_factor' | 'dependency' | 'impact' | 'mitigation';
    confidence: number;
    reasoning: string;
}
