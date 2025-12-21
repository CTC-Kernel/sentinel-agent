export interface Document {
    id: string;
    organizationId: string;
    title: string;
    type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
    description?: string;
    version: string;
    status: 'Brouillon' | 'En revue' | 'Approuvé' | 'Rejeté' | 'Publié' | 'Obsolète';
    workflowStatus?: 'Draft' | 'Review' | 'Approved' | 'Rejected';
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

export interface WorkflowHistoryItem {
    id: string; // uuid
    date: string;
    userId: string;
    userName: string; // snapshot of name
    action: 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'revert';
    comment?: string;
    version: string;
    step: 'Draft' | 'Review' | 'Approval' | 'Publication';
}
