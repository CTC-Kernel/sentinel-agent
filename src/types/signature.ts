/**
 * Story 26.4 - Electronic Signature Types
 *
 * Type definitions for electronic signature functionality.
 * Supports internal signing and prepares for external providers (DocuSign, YouSign).
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Supported signature providers
 * - 'internal': Simple built-in signature (name + timestamp + hash)
 * - 'docusign': DocuSign API integration (future)
 * - 'yousign': YouSign API integration (future)
 */
export type SignatureProvider = 'internal' | 'docusign' | 'yousign';

/**
 * Signature request status
 */
export type SignatureStatus =
  | 'draft'           // Request created but not sent
  | 'pending'         // Awaiting signatures
  | 'in_progress'     // Some signers have signed
  | 'completed'       // All signatures collected
  | 'rejected'        // One or more signers rejected
  | 'expired'         // Deadline passed
  | 'cancelled';      // Request cancelled by creator

/**
 * Individual signer status
 */
export type SignerStatus =
  | 'pending'         // Awaiting signature
  | 'notified'        // Notification sent
  | 'viewed'          // Document viewed
  | 'signed'          // Signature completed
  | 'rejected'        // Signer rejected
  | 'expired';        // Signer deadline passed

/**
 * Signature type
 */
export type SignatureType =
  | 'simple'          // Click-to-sign
  | 'advanced'        // Handwritten/drawn signature
  | 'qualified';      // eIDAS qualified signature (future)

/**
 * Information about a signer
 */
export interface SignerInfo {
  /** Unique identifier for this signer in the request */
  id: string;
  /** User ID if internal user, null for external */
  userId?: string;
  /** Signer's email address */
  email: string;
  /** Signer's display name */
  name: string;
  /** Signer's role/title (optional) */
  role?: string;
  /** Signing order (1 = first to sign) */
  order: number;
  /** Current status */
  status: SignerStatus;
  /** When notification was sent */
  notifiedAt?: Timestamp;
  /** When document was viewed */
  viewedAt?: Timestamp;
  /** When signature was applied */
  signedAt?: Timestamp;
  /** When rejection occurred */
  rejectedAt?: Timestamp;
  /** Rejection reason if rejected */
  rejectionReason?: string;
  /** IP address when signed (for audit) */
  signedFromIp?: string;
  /** User agent when signed (for audit) */
  signedFromUserAgent?: string;
  /** The actual signature data (for internal signatures) */
  signatureData?: SignatureData;
}

/**
 * Signature data for internal signatures
 */
export interface SignatureData {
  /** Type of signature */
  type: SignatureType;
  /** Base64-encoded signature image (for drawn signatures) */
  image?: string;
  /** Typed name (for click-to-sign) */
  typedName?: string;
  /** Timestamp when signature was created */
  timestamp: string;
  /** Hash of document at time of signing */
  documentHash: string;
  /** Combined hash (document hash + signer info + timestamp) */
  signatureHash: string;
  /** Certificate chain (for qualified signatures, future) */
  certificateChain?: string[];
}

/**
 * Signature request for a document
 */
export interface SignatureRequest {
  /** Unique request ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Document ID being signed */
  documentId: string;
  /** Document name (denormalized for display) */
  documentName: string;
  /** Provider used for signing */
  provider: SignatureProvider;
  /** Current status */
  status: SignatureStatus;
  /** Request title/subject */
  title: string;
  /** Optional message to signers */
  message?: string;
  /** List of signers */
  signers: SignerInfo[];
  /** Signing deadline */
  deadline?: Timestamp;
  /** Whether signing order is enforced */
  sequentialSigning: boolean;
  /** User who created the request */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Timestamp;
  /** Last update timestamp */
  updatedAt?: Timestamp;
  /** Completion timestamp */
  completedAt?: Timestamp;
  /** Cancellation details */
  cancellation?: {
    cancelledBy: string;
    cancelledAt: Timestamp;
    reason: string;
  };
  /** External provider reference (DocuSign envelope ID, etc.) */
  externalId?: string;
  /** Reminder settings */
  reminders?: {
    enabled: boolean;
    intervalDays: number;
    maxReminders: number;
    remindersSent: number;
    lastReminderAt?: Timestamp;
  };
  /** Audit trail */
  auditTrail: SignatureAuditEvent[];
  /** Document hash at request creation */
  originalDocumentHash: string;
}

/**
 * Audit event for signature request
 */
export interface SignatureAuditEvent {
  /** Event timestamp */
  timestamp: Timestamp;
  /** Event type */
  action: SignatureAuditAction;
  /** User/signer who performed action */
  actorId?: string;
  /** Actor email */
  actorEmail?: string;
  /** Actor name */
  actorName?: string;
  /** IP address */
  ip?: string;
  /** User agent */
  userAgent?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Types of audit events
 */
export type SignatureAuditAction =
  | 'request_created'
  | 'request_sent'
  | 'reminder_sent'
  | 'document_viewed'
  | 'signature_applied'
  | 'signature_rejected'
  | 'request_completed'
  | 'request_cancelled'
  | 'request_expired'
  | 'signer_added'
  | 'signer_removed'
  | 'deadline_extended';

/**
 * Input for creating a signature request
 */
export interface CreateSignatureRequestInput {
  documentId: string;
  documentName: string;
  title: string;
  message?: string;
  signers: Omit<SignerInfo, 'id' | 'status' | 'notifiedAt' | 'viewedAt' | 'signedAt' | 'rejectedAt' | 'signatureData'>[];
  deadline?: Date;
  sequentialSigning?: boolean;
  provider?: SignatureProvider;
  sendImmediately?: boolean;
  reminders?: {
    enabled: boolean;
    intervalDays: number;
    maxReminders: number;
  };
}

/**
 * Input for applying an internal signature
 */
export interface ApplySignatureInput {
  requestId: string;
  signerId: string;
  signatureType: SignatureType;
  signatureImage?: string; // Base64 for drawn signatures
  typedName?: string;      // For click-to-sign
}

/**
 * Response from signature verification
 */
export interface SignatureVerificationResult {
  isValid: boolean;
  signatureHash: string;
  documentHashMatch: boolean;
  signerVerified: boolean;
  timestamp: string;
  errors?: string[];
}

/**
 * Signed document metadata
 */
export interface SignedDocumentMetadata {
  /** Original document ID */
  originalDocumentId: string;
  /** Signature request ID */
  signatureRequestId: string;
  /** All signatures applied */
  signatures: {
    signerId: string;
    signerName: string;
    signerEmail: string;
    signedAt: string;
    signatureHash: string;
    verified: boolean;
  }[];
  /** When signing was completed */
  completedAt: string;
  /** Certificate number for the signed document */
  certificateNumber: string;
  /** Final document hash (includes all signatures) */
  finalDocumentHash: string;
}

/**
 * Provider-specific configuration
 */
export interface SignatureProviderConfig {
  provider: SignatureProvider;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  sandboxMode?: boolean;
  defaultSettings?: {
    emailSubject?: string;
    emailBody?: string;
    reminderDays?: number;
    expirationDays?: number;
  };
}

/**
 * Webhook payload from external providers
 */
export interface SignatureWebhookPayload {
  provider: SignatureProvider;
  event: string;
  externalId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
