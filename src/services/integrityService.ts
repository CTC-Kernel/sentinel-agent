/**
 * Story 26.2 - Client-side Integrity Service
 *
 * Service for verifying document integrity and managing integrity certificates.
 * Communicates with Cloud Functions for cryptographic operations.
 */

import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, db } from '@/firebase';
import { ErrorLogger } from './errorLogger';

/**
 * Integrity status types
 */
export type IntegrityStatus = 'verified' | 'pending' | 'compromised' | 'unknown';

/**
 * Document integrity information
 */
export interface DocumentIntegrity {
  hash: string | null;
  algorithm: 'SHA-256';
  status: IntegrityStatus;
  lastVerified: Date | null;
  verifiedBy: string | null;
}

/**
 * Integrity verification result from Cloud Function
 */
export interface IntegrityVerificationResult {
  success: boolean;
  status: IntegrityStatus;
  hash: string;
  expectedHash?: string;
  match: boolean;
  verifiedAt: string;
  message: string;
}

/**
 * Hash history event
 */
export interface HashHistoryEvent {
  id: string;
  action: string;
  userId: string;
  timestamp: string | null;
  hash: string | null;
  expectedHash?: string;
  status: IntegrityStatus;
}

/**
 * Hash history response
 */
export interface HashHistoryResponse {
  success: boolean;
  documentId: string;
  currentStatus: {
    hash: string | null;
    lastVerified: string | null;
    status: IntegrityStatus;
    verifiedBy: string | null;
  };
  history: HashHistoryEvent[];
  totalEvents: number;
}

/**
 * Integrity certificate data
 */
export interface IntegrityCertificate {
  certificateNumber: string;
  generatedAt: string;
  generatedBy: {
    userId: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
  document: {
    id: string;
    name: string;
    type: string;
    size: number | null;
    uploadedAt: string | null;
    uploadedBy: string | null;
  };
  integrity: {
    hash: string;
    algorithm: string;
    status: IntegrityStatus;
    lastVerified: string | null;
    verifiedBy: string | null;
  };
  encryption: {
    encrypted: boolean;
    algorithm: string;
    keyVersion: string;
    encryptedAt: string | null;
  };
  signatures: SignatureInfo[];
  legalDisclaimer: string;
}

/**
 * Signature information for certificate
 */
export interface SignatureInfo {
  signerId: string;
  signerName: string;
  signedAt: string;
  signatureHash: string;
}

/**
 * Firebase error type guard
 */
interface FirebaseError {
  code?: string;
  message?: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

/**
 * Integrity Service for document verification operations
 */
export const IntegrityService = {
  /**
   * Verify document integrity by comparing hashes
   * Calls Cloud Function to decrypt (if needed) and calculate hash
   */
  async verifyDocumentIntegrity(documentId: string): Promise<IntegrityVerificationResult> {
    try {
      const verifyFn = httpsCallable<{ documentId: string }, IntegrityVerificationResult>(
        functions,
        'verifyIntegrity'
      );
      const result = await verifyFn({ documentId });
      return result.data;
    } catch (error: unknown) {
      ErrorLogger.error(error, 'IntegrityService.verifyDocumentIntegrity');

      if (isFirebaseError(error)) {
        if (error.code === 'not-found') {
          throw new Error('Document non trouvé');
        }
        if (error.code === 'permission-denied') {
          throw new Error('Accès refusé');
        }
        if (error.message) {
          throw new Error(error.message);
        }
      }

      throw new Error('Échec de la vérification d\'intégrité');
    }
  },

  /**
   * Get current integrity status for a document from Firestore
   * Fast local check without triggering verification
   */
  async getIntegrityStatus(documentId: string): Promise<DocumentIntegrity> {
    try {
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Document non trouvé');
      }

      const data = docSnap.data();
      const encryption = data.encryption || {};
      const integrity = data.integrity || {};

      return {
        hash: encryption.hash || null,
        algorithm: 'SHA-256',
        status: (integrity.status as IntegrityStatus) || 'unknown',
        lastVerified: integrity.lastVerified?.toDate?.() || null,
        verifiedBy: integrity.verifiedBy || null,
      };
    } catch (error) {
      ErrorLogger.error(error, 'IntegrityService.getIntegrityStatus');
      throw error;
    }
  },

  /**
   * Get hash history / audit trail for a document
   */
  async getHashHistory(documentId: string, limit = 50): Promise<HashHistoryResponse> {
    try {
      const historyFn = httpsCallable<
        { documentId: string; limit: number },
        HashHistoryResponse
      >(functions, 'getHashHistory');
      const result = await historyFn({ documentId, limit });
      return result.data;
    } catch (error: unknown) {
      ErrorLogger.error(error, 'IntegrityService.getHashHistory');

      if (isFirebaseError(error)) {
        if (error.code === 'not-found') {
          throw new Error('Document non trouvé');
        }
        if (error.code === 'permission-denied') {
          throw new Error('Accès refusé');
        }
      }

      throw new Error('Échec de la récupération de l\'historique');
    }
  },

  /**
   * Generate an integrity certificate for a document
   */
  async generateCertificate(documentId: string): Promise<IntegrityCertificate> {
    try {
      const certFn = httpsCallable<{ documentId: string }, { success: boolean; certificate: IntegrityCertificate }>(
        functions,
        'generateIntegrityCertificate'
      );
      const result = await certFn({ documentId });

      if (!result.data.success) {
        throw new Error('Échec de la génération du certificat');
      }

      return result.data.certificate;
    } catch (error: unknown) {
      ErrorLogger.error(error, 'IntegrityService.generateCertificate');

      if (isFirebaseError(error)) {
        if (error.code === 'not-found') {
          throw new Error('Document non trouvé');
        }
        if (error.code === 'permission-denied') {
          throw new Error('Accès refusé');
        }
      }

      throw new Error('Échec de la génération du certificat');
    }
  },

  /**
   * Format hash for display (truncated with ellipsis)
   */
  formatHash(hash: string | null, length = 12): string {
    if (!hash) return 'N/A';
    if (hash.length <= length) return hash;
    return `${hash.substring(0, length)}...`;
  },

  /**
   * Get status color class for UI
   */
  getStatusColor(status: IntegrityStatus): {
    text: string;
    bg: string;
    border: string;
  } {
    switch (status) {
      case 'verified':
        return {
          text: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-950',
          border: 'border-green-200 dark:border-green-800',
        };
      case 'compromised':
        return {
          text: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-950',
          border: 'border-red-200 dark:border-red-800',
        };
      case 'pending':
        return {
          text: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950',
          border: 'border-amber-200 dark:border-amber-800',
        };
      default:
        return {
          text: 'text-gray-500 dark:text-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-900',
          border: 'border-gray-200 dark:border-gray-700',
        };
    }
  },

  /**
   * Get status label for UI (French)
   */
  getStatusLabel(status: IntegrityStatus): string {
    switch (status) {
      case 'verified':
        return 'Vérifié';
      case 'compromised':
        return 'Compromis';
      case 'pending':
        return 'En attente';
      default:
        return 'Inconnu';
    }
  },
};

export default IntegrityService;
