/**
 * Vendor Portal Types
 * Types for vendor self-service questionnaire portal
 * Story 37-2: Vendor Self-Service Portal
 */

// ============================================================================
// Portal Access Types
// ============================================================================

/**
 * Status of portal access
 */
export type PortalAccessStatus = 'active' | 'submitted' | 'expired' | 'revoked';

/**
 * Vendor portal access record
 */
export interface VendorPortalAccess {
 id: string;
 /** Assessment being completed */
 assessmentId: string;
 /** Organization requesting the assessment */
 organizationId: string;
 /** Organization display name for branding */
 organizationName: string;
 /** Template ID for the questionnaire */
 templateId: string;
 /** Vendor supplier ID */
 supplierId: string;
 /** Vendor company name */
 vendorName: string;
 /** Vendor contact email */
 vendorEmail: string;
 /** Secure access token */
 token: string;
 /** Current access status */
 status: PortalAccessStatus;
 /** When access was created */
 createdAt: string;
 /** When access expires */
 expiresAt: string;
 /** Last time vendor accessed portal */
 lastAccessedAt?: string;
 /** When questionnaire was submitted */
 submittedAt?: string;
 /** Number of access attempts */
 accessCount: number;
 /** IP address of last access */
 lastAccessIp?: string;
 /** Email verification status */
 emailVerified: boolean;
 /** Verification code (hashed) */
 verificationCodeHash?: string;
 /** Verification code expiry */
 verificationCodeExpiresAt?: string;
}

/**
 * Input for creating portal access
 */
export interface CreatePortalAccessInput {
 assessmentId: string;
 organizationId: string;
 organizationName: string;
 templateId: string;
 supplierId: string;
 vendorName: string;
 vendorEmail: string;
 expiresAt: string;
}

/**
 * Portal access validation result
 */
export interface PortalAccessValidation {
 valid: boolean;
 access?: VendorPortalAccess;
 error?: PortalAccessError;
}

/**
 * Portal access error types
 */
export type PortalAccessError =
 | 'invalid_token'
 | 'expired_token'
 | 'already_submitted'
 | 'access_revoked'
 | 'rate_limited'
 | 'verification_required'
 | 'verification_failed';

// ============================================================================
// Portal Session Types
// ============================================================================

/**
 * Active portal session
 */
export interface PortalSession {
 accessId: string;
 assessmentId: string;
 vendorEmail: string;
 vendorName: string;
 organizationName: string;
 templateId: string;
 isSubmitted: boolean;
 isReadOnly: boolean;
 expiresAt: string;
}

/**
 * Portal authentication state
 */
export interface PortalAuthState {
 isLoading: boolean;
 isAuthenticated: boolean;
 requiresVerification: boolean;
 session: PortalSession | null;
 error: PortalAccessError | null;
}

// ============================================================================
// Questionnaire Progress Types
// ============================================================================

/**
 * Answer value types
 */
export type AnswerValue = string | number | boolean | string[];

/**
 * Single question answer
 */
export interface QuestionAnswer {
 questionId: string;
 value: AnswerValue;
 comment?: string;
 evidenceUrl?: string;
 answeredAt: string;
}

/**
 * Section progress
 */
export interface SectionProgress {
 sectionId: string;
 totalQuestions: number;
 answeredQuestions: number;
 requiredQuestions: number;
 answeredRequired: number;
 isComplete: boolean;
}

/**
 * Overall questionnaire progress
 */
export interface QuestionnaireProgress {
 assessmentId: string;
 totalQuestions: number;
 answeredQuestions: number;
 requiredQuestions: number;
 answeredRequired: number;
 completionPercentage: number;
 sectionProgress: SectionProgress[];
 canSubmit: boolean;
 lastSavedAt?: string;
}

/**
 * Save status for auto-save
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Auto-save state
 */
export interface AutoSaveState {
 status: SaveStatus;
 lastSavedAt?: string;
 error?: string;
 pendingChanges: boolean;
}

// ============================================================================
// Portal Notification Types
// ============================================================================

/**
 * Portal email types
 */
export type PortalEmailType =
 | 'access_granted'
 | 'verification_code'
 | 'reminder'
 | 'submission_confirmation'
 | 'access_expiring';

/**
 * Portal email data
 */
export interface PortalEmailData {
 type: PortalEmailType;
 recipientEmail: string;
 recipientName: string;
 organizationName: string;
 portalUrl?: string;
 verificationCode?: string;
 deadline?: string;
 assessmentTitle?: string;
}

// ============================================================================
// Portal Activity Log Types
// ============================================================================

/**
 * Portal activity types
 */
export type PortalActivityType =
 | 'access_created'
 | 'access_attempted'
 | 'email_verified'
 | 'questionnaire_viewed'
 | 'answer_saved'
 | 'questionnaire_submitted'
 | 'access_expired'
 | 'access_revoked';

/**
 * Portal activity log entry
 */
export interface PortalActivityLog {
 id: string;
 accessId: string;
 assessmentId: string;
 organizationId: string;
 activityType: PortalActivityType;
 timestamp: string;
 ipAddress?: string;
 userAgent?: string;
 details?: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if portal access is expired
 */
export function isPortalAccessExpired(access: Pick<VendorPortalAccess, 'status' | 'expiresAt'>): boolean {
 if (access.status === 'expired') return true;
 return new Date(access.expiresAt) < new Date();
}

/**
 * Check if portal access allows editing
 */
export function canEditPortalAccess(access: Pick<VendorPortalAccess, 'status' | 'expiresAt'>): boolean {
 if (access.status !== 'active') return false;
 return !isPortalAccessExpired(access);
}

/**
 * Get portal access status message
 */
export function getPortalAccessStatusMessage(
 status: PortalAccessStatus,
 isExpired: boolean
): string {
 if (isExpired) return 'This portal access has expired.';

 switch (status) {
 case 'active':
 return 'Portal access is active.';
 case 'submitted':
 return 'Questionnaire has been submitted. You can view your responses but cannot make changes.';
 case 'expired':
 return 'This portal access has expired.';
 case 'revoked':
 return 'This portal access has been revoked.';
 }
}

/**
 * Get error message for portal access error
 */
export function getPortalErrorMessage(error: PortalAccessError): string {
 switch (error) {
 case 'invalid_token':
 return 'The access link is invalid. Please contact the requesting organization.';
 case 'expired_token':
 return 'The access link has expired. Please contact the requesting organization for a new link.';
 case 'already_submitted':
 return 'The questionnaire has already been submitted. You can view but not edit your responses.';
 case 'access_revoked':
 return 'Access to this questionnaire has been revoked.';
 case 'rate_limited':
 return 'Too many access attempts. Please try again later.';
 case 'verification_required':
 return 'Please verify your email to continue.';
 case 'verification_failed':
 return 'Verification failed. Please check the code and try again.';
 }
}

/**
 * Calculate section progress
 */
export function calculateSectionProgress(
 sectionId: string,
 questions: Array<{ id: string; required: boolean }>,
 answers: Record<string, QuestionAnswer>
): SectionProgress {
 const totalQuestions = questions.length;
 const requiredQuestions = questions.filter(q => q.required).length;

 let answeredQuestions = 0;
 let answeredRequired = 0;

 questions.forEach(q => {
 const answer = answers[q.id];
 if (answer && hasValidAnswer(answer.value)) {
 answeredQuestions++;
 if (q.required) {
 answeredRequired++;
 }
 }
 });

 return {
 sectionId,
 totalQuestions,
 answeredQuestions,
 requiredQuestions,
 answeredRequired,
 isComplete: answeredRequired >= requiredQuestions,
 };
}

/**
 * Check if an answer value is valid (not empty)
 */
export function hasValidAnswer(value: AnswerValue): boolean {
 if (value === null || value === undefined) return false;
 if (typeof value === 'string') return value.trim().length > 0;
 if (typeof value === 'boolean') return true;
 if (typeof value === 'number') return true;
 if (Array.isArray(value)) return value.length > 0;
 return false;
}

/**
 * Calculate overall questionnaire progress
 */
export function calculateQuestionnaireProgress(
 assessmentId: string,
 sections: Array<{
 id: string;
 questions: Array<{ id: string; required: boolean }>;
 }>,
 answers: Record<string, QuestionAnswer>,
 lastSavedAt?: string
): QuestionnaireProgress {
 const sectionProgress = sections.map(section =>
 calculateSectionProgress(section.id, section.questions, answers)
 );

 const totalQuestions = sectionProgress.reduce((sum, sp) => sum + sp.totalQuestions, 0);
 const answeredQuestions = sectionProgress.reduce((sum, sp) => sum + sp.answeredQuestions, 0);
 const requiredQuestions = sectionProgress.reduce((sum, sp) => sum + sp.requiredQuestions, 0);
 const answeredRequired = sectionProgress.reduce((sum, sp) => sum + sp.answeredRequired, 0);

 const completionPercentage = totalQuestions > 0
 ? Math.round((answeredQuestions / totalQuestions) * 100)
 : 0;

 const canSubmit = answeredRequired >= requiredQuestions;

 return {
 assessmentId,
 totalQuestions,
 answeredQuestions,
 requiredQuestions,
 answeredRequired,
 completionPercentage,
 sectionProgress,
 canSubmit,
 lastSavedAt,
 };
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
 const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
 const randomValues = new Uint8Array(length);
 crypto.getRandomValues(randomValues);
 return Array.from(randomValues, v => chars[v % chars.length]).join('');
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
 const randomValues = new Uint8Array(3);
 crypto.getRandomValues(randomValues);
 const num = (randomValues[0] * 65536 + randomValues[1] * 256 + randomValues[2]) % 1000000;
 return num.toString().padStart(6, '0');
}
