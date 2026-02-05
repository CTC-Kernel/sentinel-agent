
export interface ProcessingActivity {
 id: string;
 organizationId: string;
 name: string;
 purpose: string;
 manager: string;
 managerId?: string;
 legalBasis: 'Consentement' | 'Contrat' | 'Obligation Légale' | 'Intérêt Légitime' | 'Sauvegarde Intérêts' | 'Mission Publique';
 dataCategories: string[];
 dataSubjects: string[];
 retentionPeriod: string;
 hasDPIA: boolean;
 status: 'Actif' | 'En projet' | 'Archivé';
 createdAt?: string;
 updatedAt?: string;
 createdBy?: string;
 recipients?: string; // Categories of recipients (GDPR Art. 30.1.d)
 transfers?: string; // Transfers to third countries (GDPR Art. 30.1.e)
 securityMeasures?: string; // Technical/organizational security measures (GDPR Art. 30.1.g)
 relatedAssetIds?: string[]; // Linked Assets (Storage, Processing, etc.)
 relatedRiskIds?: string[]; // Linked Risks (DPIA)
}

export interface PrivacyRequest {
 id: string;
 organizationId: string;
 requestType: 'Access' | 'Deletion' | 'Rectification' | 'Portability' | 'Restriction' | 'Objection';
 dataSubject: string; // Name of the person
 email: string;
 status: 'New' | 'Verifying' | 'Processing' | 'Review' | 'Completed' | 'Rejected' | 'On Hold';
 submissionDate: string;
 dueDate: string;
 priority: 'Low' | 'Medium' | 'High';
 assignedTo?: string;
 details?: string;
 verificationDate?: string;
 processingNotes?: string;
 completedAt?: string;
}
