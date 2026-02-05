export interface DocumentVersion {
 id: string;
 version: string; // e.g., "1.0", "1.1", "2.0"
 title: string;
 content?: string;
 url?: string;
 status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
 createdBy: string;
 createdAt: string;
 approvedBy?: string;
 approvedAt?: string;
 publishedAt?: string;
 changes?: string; // Description of changes from previous version
 previousVersionId?: string;
}

export interface DocumentSignature {
 id: string;
 documentId: string;
 documentVersion: string;
 userId: string;
 userName: string;
 userEmail: string;
 signedAt: string;
 ipAddress?: string;
 acknowledged: boolean;
}

export interface DocumentWorkflow {
 documentId: string;
 currentStatus: 'draft' | 'review' | 'approved' | 'published' | 'archived';
 currentVersion: string;
 workflow: {
 draft?: { by: string; at: string };
 review?: { by: string; at: string; reviewers?: string[] };
 approved?: { by: string; at: string };
 published?: { by: string; at: string };
 archived?: { by: string; at: string; reason?: string };
 };
 nextReviewDate?: string;
 reviewers: string[];
 approvers: string[];
}

/**
 * Generate next version number
 */
export function getNextVersion(currentVersion: string, changeType: 'major' | 'minor' | 'patch'): string {
 const parts = currentVersion.split('.').map(Number);

 if (changeType === 'major') {
 return `${parts[0] + 1}.0.0`;
 } else if (changeType === 'minor') {
 return `${parts[0]}.${parts[1] + 1}.0`;
 } else {
 return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
 }
}

/**
 * Check if a user can approve a document
 */
export function canApprove(userRole: string, workflow: DocumentWorkflow): boolean {
 if (userRole !== 'admin') return false;
 if (workflow.currentStatus !== 'review') return false;
 return true;
}

/**
 * Check if a user can publish a document
 */
export function canPublish(userRole: string, workflow: DocumentWorkflow): boolean {
 if (userRole !== 'admin') return false;
 if (workflow.currentStatus !== 'approved') return false;
 return true;
}

/**
 * Check if a document needs review
 */
export function needsReview(nextReviewDate?: string): boolean {
 if (!nextReviewDate) return false;
 return new Date(nextReviewDate) < new Date();
}

/**
 * Get signature status for a user
 */
export function hasUserSigned(signatures: DocumentSignature[], userId: string): boolean {
 return signatures.some((sig) => sig.userId === userId && sig.acknowledged);
}

/**
 * Calculate signature completion rate
 */
export function getSignatureRate(signatures: DocumentSignature[], totalUsers: number): number {
 const signed = signatures.filter((sig) => sig.acknowledged).length;
 return totalUsers > 0 ? Math.round((signed / totalUsers) * 100) : 0;
}
