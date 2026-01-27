
export enum Criticality {
    LOW = 'Faible',
    MEDIUM = 'Moyenne',
    HIGH = 'Élevée',
    CRITICAL = 'Critique'
}

export type ResourceType = 'Asset' | 'Risk' | 'Project' | 'Audit' | 'Document' | 'Control' | 'Incident' | 'Supplier' | 'BusinessProcess' | 'Vulnerability' | 'Threat' | 'SystemLog' | 'ProcessingActivity' | 'SupplierAssessment' | 'SupplierIncident' | 'User' | 'Settings' | 'CTCEngine' | 'AuditTrail' | 'Organization' | 'Backup' | 'Integration' | 'Partner' | 'BcpDrill' | 'TlptCampaign' | 'RecoveryPlan' | 'Agent' | 'AgentPolicy' | 'AgentReport' | 'TrainingCourse' | 'TrainingAssignment' | 'TrainingCampaign' | 'Certificate' | 'AccessReview';
export type ActionType = 'read' | 'create' | 'update' | 'delete' | 'manage';

export interface HealthIssue {
    id: string;
    type: 'warning' | 'danger';
    message: string;
    count: number;
    link: string;
}

export interface ActionItem {
    id: string;
    type: 'audit' | 'document' | 'project' | 'policy' | 'incident' | 'risk';
    title: string;
    date: string;
    status: string;
    link: string;
}

/**
 * Supported compliance frameworks
 */
export const FRAMEWORKS = [
    'ISO27001', 'ISO22301', 'ISO27005', 'NIS2', 'DORA', 'GDPR',
    'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL'
] as const;

export type Framework = typeof FRAMEWORKS[number];

export interface AIAnalysisResult {
    type: string;
    response: Record<string, unknown>;
    timestamp: string;
}

/**
 * Interface for Firestore Timestamp-like objects
 * Handles both native Firestore Timestamps and serialized versions
 */
export interface FirestoreTimestampLike {
    toDate?: () => Date;
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
}

/**
 * Type guard to check if a value is a Firestore Timestamp-like object
 */
export function isFirestoreTimestamp(value: unknown): value is FirestoreTimestampLike {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.toDate === 'function' ||
        typeof obj.toMillis === 'function' ||
        typeof obj.seconds === 'number'
    );
}

/**
 * Safely converts a Firestore timestamp or date-like value to milliseconds
 */
export function timestampToMillis(timestamp: unknown): number {
    if (!timestamp) return 0;
    if (timestamp instanceof Date) return timestamp.getTime();
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp).getTime();

    if (isFirestoreTimestamp(timestamp)) {
        if (timestamp.toMillis) return timestamp.toMillis();
        if (timestamp.toDate) return timestamp.toDate().getTime();
        if (timestamp.seconds !== undefined) return timestamp.seconds * 1000;
    }

    return 0;
}

/**
 * Safely converts a Firestore timestamp or date-like value to ISO string
 */
export function timestampToISOString(timestamp: unknown): string | null {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp === 'string') return timestamp;

    if (isFirestoreTimestamp(timestamp)) {
        if (timestamp.toDate) return timestamp.toDate().toISOString();
        if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000).toISOString();
    }

    return null;
}
