import type { DocumentEncryptionMetadata, DocumentClassification, DocumentACL } from './vault';

/**
 * Unified document status enumeration (French)
 */
export const DOCUMENT_STATUSES = [
    'Brouillon',
    'En revue',
    'Approuvé',
    'Rejeté',
    'Publié',
    'Archivé',
    'Obsolète'
] as const;

export type DocumentStatus = typeof DOCUMENT_STATUSES[number];

/**
 * Document workflow steps for history tracking
 */
export const WORKFLOW_STEPS = [
    'Brouillon',
    'En revue',
    'Approbation',
    'Publication',
    'Archive'
] as const;

export type WorkflowStep = typeof WORKFLOW_STEPS[number];

/**
 * Valid document status transitions
 * Defines the state machine for document workflow
 */
export const VALID_DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
    'Brouillon': ['En revue', 'Archivé'],
    'En revue': ['Approuvé', 'Rejeté', 'Brouillon'],
    'Approuvé': ['Publié', 'Archivé'],
    'Rejeté': ['Brouillon', 'Archivé'],
    'Publié': ['Archivé', 'Obsolète'],
    'Archivé': [],
    'Obsolète': []
};

/**
 * Check if a document status transition is valid
 */
export function isValidDocumentTransition(from: DocumentStatus, to: DocumentStatus): boolean {
    return VALID_DOCUMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface Document {
    id: string;
    organizationId: string;
    title: string;
    type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
    description?: string;
    version: string;
    status: DocumentStatus;
    /** @deprecated Use status instead - unified in French */
    workflowStatus?: 'Draft' | 'Review' | 'Approved' | 'Rejected' | 'Archived';
    reviewers?: string[];
    approvers?: string[];
    signatures?: Array<{ userId: string, date: string, role: string, signatureImage?: string }>;
    workflowHistory?: WorkflowHistoryItem[];
    currentVersionId?: string;
    url?: string;
    owner: string;
    ownerId?: string;
    readBy?: string[];
    nextReviewDate?: string;
    createdAt: string;
    updatedAt: string;
    expirationDate?: string; // For evidence validity tracking
    relatedControlIds?: string[];
    relatedAssetIds?: string[];
    relatedAuditIds?: string[];
    relatedRiskIds?: string[]; // Added for bi-directional linking with Risks
    // Security & Integrity
    isSecure?: boolean;
    hash?: string; // SHA-256
    watermarkEnabled?: boolean;
    storageProvider?: 'firebase' | 'google_drive' | 'onedrive' | 'sharepoint';
    externalUrl?: string;
    externalId?: string; // ID of the file in the external provider
    folderId?: string;
    author?: string; // Generated report author name
    content?: string; // HTML content for rich text policies
    // Vault / Encryption fields (Story 23.1)
    encryption?: DocumentEncryptionMetadata;
    classification?: DocumentClassification;
    legalHoldIds?: string[];
    isUnderHold?: boolean;
    acl?: DocumentACL;
}

export interface DocumentFolder {
    id: string;
    organizationId: string;
    name: string;
    parentId?: string; // For nested folders
    createdAt: string;
    updatedAt: string;
}

export interface DocumentVersion {
    id: string;
    documentId: string;
    version: string;
    url: string;
    hash?: string;
    uploadedBy: string; // User ID
    uploadedAt: string;
    changeLog?: string;
}

/**
 * Workflow actions (French)
 */
export const WORKFLOW_ACTIONS = [
    'soumettre',
    'approuver',
    'rejeter',
    'publier',
    'archiver',
    'annuler'
] as const;

export type WorkflowAction = typeof WORKFLOW_ACTIONS[number];

export interface WorkflowHistoryItem {
    id: string;
    date: string;
    userId: string;
    userName: string;
    action: WorkflowAction;
    comment?: string;
    version: string;
    step: WorkflowStep;
}
