import { Timestamp } from 'firebase/firestore';

/**
 * Cloud KMS encryption configuration
 */
export interface EncryptionConfig {
  keyRingId: string;
  cryptoKeyId: string;
  location: string;
  projectId: string;
}

/**
 * Document classification levels following ISO 27001 guidelines
 */
export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'secret';

/**
 * Document classification metadata
 */
export interface DocumentClassification {
  level: ClassificationLevel;
  classifiedBy: string;
  classifiedAt: Timestamp;
  justification?: string;
  autoClassified: boolean;
}

/**
 * Encryption metadata stored with encrypted documents
 */
export interface DocumentEncryptionMetadata {
  encrypted: boolean;
  keyVersion: string;
  encryptedAt: Timestamp;
  algorithm: 'AES-256-GCM';
  hash: string;
}

/**
 * Encryption status for UI display
 */
export interface EncryptionStatus {
  isEncrypted: boolean;
  keyVersion?: string;
  encryptedAt?: Date;
  integrityVerified?: boolean;
}

/**
 * Legal hold for compliance and litigation purposes
 */
export interface LegalHold {
  id: string;
  organizationId: string;
  name: string;
  reason: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  documentIds: string[];
  status: 'active' | 'released';
  releasedBy?: string;
  releasedAt?: Timestamp;
  releaseReason?: string;
}

/**
 * Retention policy for document lifecycle management
 */
export interface RetentionPolicy {
  id: string;
  organizationId: string;
  name: string;
  documentType: string;
  retentionDays: number;
  action: 'archive' | 'delete' | 'notify';
  notifyDaysBefore: number;
  exceptions?: {
    classifications?: ClassificationLevel[];
    excludeLegalHold?: boolean;
  };
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Document Access Control List
 */
export interface DocumentACL {
  defaultAccess: 'classification' | 'explicit';
  permissions: DocumentPermission[];
}

/**
 * Individual document permission entry
 */
export interface DocumentPermission {
  principalType: 'user' | 'role' | 'group';
  principalId: string;
  access: 'read' | 'download' | 'edit' | 'delete' | 'share' | 'admin';
  grantedBy: string;
  grantedAt: Timestamp;
  expiresAt?: Timestamp;
}

/**
 * Immutable audit log entry for document actions
 */
export interface DocumentAuditLog {
  id: string;
  organizationId: string;
  documentId: string;
  action: DocumentAction;
  userId: string;
  timestamp: Timestamp;
  metadata: {
    ip?: string;
    userAgent?: string;
    previousValue?: unknown;
    newValue?: unknown;
  };
  integrity: {
    hash: string;
    previousLogHash: string;
  };
}

/**
 * Document actions for audit logging
 */
export type DocumentAction =
  | 'create'
  | 'read'
  | 'download'
  | 'update'
  | 'delete'
  | 'share'
  | 'classify'
  | 'encrypt'
  | 'decrypt'
  | 'legal_hold_apply'
  | 'legal_hold_release'
  | 'access_denied';
