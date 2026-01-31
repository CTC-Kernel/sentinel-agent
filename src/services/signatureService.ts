/**
 * Story 26.4 - Client-side Signature Service
 *
 * Service for managing electronic signatures on documents.
 * Supports internal signing with extensible interface for external providers.
 */

import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { functions, db } from '@/firebase';
import { ErrorLogger } from './errorLogger';
import { IntegrityService } from './integrityService';
import type {
  SignatureRequest,
  SignatureStatus,
  SignerInfo,
  SignerStatus,
  SignatureData,
  CreateSignatureRequestInput,
  ApplySignatureInput,
  SignatureVerificationResult,
  SignatureAuditEvent,
} from '@/types/signature';

const SIGNATURE_REQUESTS_COLLECTION = 'signatureRequests';

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
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Calculate SHA-256 hash of a string
 */
async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signature Service for document signing operations
 */
export const SignatureService = {
  /**
   * Create a new signature request
   */
  async createSignatureRequest(
    organizationId: string,
    createdBy: string,
    input: CreateSignatureRequestInput
  ): Promise<SignatureRequest> {
    try {
      // Get document integrity info for original hash
      const integrity = await IntegrityService.getIntegrityStatus(input.documentId);
      const originalHash = integrity.hash || await this.calculateDocumentHash(input.documentId);

      // Build signers with IDs and initial status
      const signers: SignerInfo[] = input.signers.map((signer, index) => ({
        ...signer,
        id: generateId(),
        order: signer.order || index + 1,
        status: 'pending' as SignerStatus,
      }));

      // Create audit trail entry
      const auditTrail: SignatureAuditEvent[] = [{
        timestamp: Timestamp.now(),
        action: 'request_created',
        actorId: createdBy,
        details: {
          signerCount: signers.length,
          sequentialSigning: input.sequentialSigning ?? false,
        },
      }];

      const requestData: Omit<SignatureRequest, 'id'> = {
        organizationId,
        documentId: input.documentId,
        documentName: input.documentName,
        provider: input.provider || 'internal',
        status: input.sendImmediately ? 'pending' : 'draft',
        title: input.title,
        message: input.message,
        signers,
        deadline: input.deadline ? Timestamp.fromDate(input.deadline) : undefined,
        sequentialSigning: input.sequentialSigning ?? false,
        createdBy,
        createdAt: Timestamp.now(),
        reminders: input.reminders ? {
          ...input.reminders,
          remindersSent: 0,
        } : undefined,
        auditTrail,
        originalDocumentHash: originalHash,
      };

      const docRef = await addDoc(
        collection(db, SIGNATURE_REQUESTS_COLLECTION),
        requestData
      );

      // If send immediately, notify first signer(s)
      if (input.sendImmediately) {
        await this.sendSignatureNotifications(docRef.id, organizationId);
      }

      return {
        id: docRef.id,
        ...requestData,
      };
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.createSignatureRequest');
      throw error;
    }
  },

  /**
   * Get a signature request by ID
   */
  async getSignatureRequest(requestId: string, organizationId?: string): Promise<SignatureRequest | null> {
    try {
      const docRef = doc(db, SIGNATURE_REQUESTS_COLLECTION, requestId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Verify organization ownership if organizationId provided
      if (organizationId && data.organizationId !== organizationId) {
        ErrorLogger.warn('IDOR attempt: signature request org mismatch', 'SignatureService.getSignatureRequest');
        return null;
      }

      return {
        id: docSnap.id,
        ...data,
      } as SignatureRequest;
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.getSignatureRequest');
      throw error;
    }
  },

  /**
   * Get all signature requests for a document
   */
  async getSignatureRequestsForDocument(
    documentId: string,
    organizationId: string
  ): Promise<SignatureRequest[]> {
    try {
      const q = query(
        collection(db, SIGNATURE_REQUESTS_COLLECTION),
        where('organizationId', '==', organizationId),
        where('documentId', '==', documentId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const requests: SignatureRequest[] = [];

      snapshot.forEach((docSnap) => {
        requests.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as SignatureRequest);
      });

      return requests;
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.getSignatureRequestsForDocument');
      throw error;
    }
  },

  /**
   * Get all signature requests for an organization
   */
  async getSignatureRequests(
    organizationId: string,
    options?: {
      status?: SignatureStatus[];
      limit?: number;
    }
  ): Promise<SignatureRequest[]> {
    try {
      const q = query(
        collection(db, SIGNATURE_REQUESTS_COLLECTION),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let requests: SignatureRequest[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SignatureRequest;
        // Filter by status if specified
        if (!options?.status || options.status.includes(data.status)) {
          requests.push({
            ...data,
            id: docSnap.id,
          });
        }
      });

      // Apply limit
      if (options?.limit) {
        requests = requests.slice(0, options.limit);
      }

      return requests;
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.getSignatureRequests');
      throw error;
    }
  },

  /**
   * Get pending signature requests for a user (as signer)
   */
  async getPendingRequestsForUser(
    userEmail: string,
    organizationId: string
  ): Promise<SignatureRequest[]> {
    try {
      const allRequests = await this.getSignatureRequests(organizationId, {
        status: ['pending', 'in_progress'],
      });

      // Filter requests where user is a pending signer
      return allRequests.filter((request) =>
        request.signers.some(
          (signer) =>
            signer.email.toLowerCase() === userEmail.toLowerCase() &&
            signer.status === 'pending'
        )
      );
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.getPendingRequestsForUser');
      throw error;
    }
  },

  /**
   * Apply an internal signature
   */
  async applySignature(
    input: ApplySignatureInput,
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<SignatureVerificationResult> {
    try {
      // Get the request
      const request = await this.getSignatureRequest(input.requestId);
      if (!request) {
        throw new Error('Demande de signature non trouvée');
      }

      // Find the signer
      const signerIndex = request.signers.findIndex(s => s.id === input.signerId);
      if (signerIndex === -1) {
        throw new Error('Signataire non trouvé');
      }

      const signer = request.signers[signerIndex];

      // Verify signer email matches
      if (signer.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error('Vous n\'êtes pas autorisé à signer pour ce signataire');
      }

      // Check if already signed
      if (signer.status === 'signed') {
        throw new Error('Ce signataire a déjà signé');
      }

      // Check sequential signing order
      if (request.sequentialSigning) {
        const canSign = request.signers.every((s, idx) => {
          if (idx < signerIndex) {
            return s.status === 'signed';
          }
          return true;
        });

        if (!canSign) {
          throw new Error('Veuillez attendre que les signataires précédents aient signé');
        }
      }

      // Get current document hash
      const currentDocHash = await this.calculateDocumentHash(request.documentId);

      // Verify document hasn't changed
      if (currentDocHash !== request.originalDocumentHash) {
        throw new Error('Le document a été modifié depuis la création de la demande');
      }

      // Create signature data
      const timestamp = new Date().toISOString();
      const signaturePayload = `${currentDocHash}|${signer.email}|${timestamp}`;
      const signatureHash = await calculateHash(signaturePayload);

      const signatureData: SignatureData = {
        type: input.signatureType,
        image: input.signatureImage,
        typedName: input.typedName,
        timestamp,
        documentHash: currentDocHash,
        signatureHash,
      };

      // Update signer
      const updatedSigners = [...request.signers];
      updatedSigners[signerIndex] = {
        ...signer,
        status: 'signed',
        signedAt: Timestamp.now(),
        userId,
        signatureData,
      };

      // Add audit event
      const auditEvent: SignatureAuditEvent = {
        timestamp: Timestamp.now(),
        action: 'signature_applied',
        actorId: userId,
        actorEmail: userEmail,
        actorName: userName,
        details: {
          signerId: input.signerId,
          signatureHash,
        },
      };

      // Check if all signers have signed
      const allSigned = updatedSigners.every(s => s.status === 'signed');
      const newStatus: SignatureStatus = allSigned ? 'completed' : 'in_progress';

      // Update the request
      const docRef = doc(db, SIGNATURE_REQUESTS_COLLECTION, input.requestId);
      await updateDoc(docRef, {
        signers: updatedSigners,
        status: newStatus,
        updatedAt: Timestamp.now(),
        ...(allSigned && { completedAt: Timestamp.now() }),
        auditTrail: [...request.auditTrail, auditEvent],
      });

      // If completed, update document with signature info
      if (allSigned) {
        await this.updateDocumentWithSignatures(request.documentId, input.requestId, updatedSigners);
      }

      return {
        isValid: true,
        signatureHash,
        documentHashMatch: true,
        signerVerified: true,
        timestamp,
      };
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.applySignature');
      throw error;
    }
  },

  /**
   * Reject a signature request
   */
  async rejectSignature(
    requestId: string,
    signerId: string,
    reason: string,
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<void> {
    try {
      const request = await this.getSignatureRequest(requestId);
      if (!request) {
        throw new Error('Demande de signature non trouvée');
      }

      const signerIndex = request.signers.findIndex(s => s.id === signerId);
      if (signerIndex === -1) {
        throw new Error('Signataire non trouvé');
      }

      const signer = request.signers[signerIndex];

      if (signer.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error('Vous n\'êtes pas autorisé à rejeter pour ce signataire');
      }

      // Update signer
      const updatedSigners = [...request.signers];
      updatedSigners[signerIndex] = {
        ...signer,
        status: 'rejected',
        rejectedAt: Timestamp.now(),
        rejectionReason: reason,
      };

      // Add audit event
      const auditEvent: SignatureAuditEvent = {
        timestamp: Timestamp.now(),
        action: 'signature_rejected',
        actorId: userId,
        actorEmail: userEmail,
        actorName: userName,
        details: {
          signerId,
          reason,
        },
      };

      const docRef = doc(db, SIGNATURE_REQUESTS_COLLECTION, requestId);
      await updateDoc(docRef, {
        signers: updatedSigners,
        status: 'rejected',
        updatedAt: Timestamp.now(),
        auditTrail: [...request.auditTrail, auditEvent],
      });
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.rejectSignature');
      throw error;
    }
  },

  /**
   * Cancel a signature request
   */
  async cancelSignatureRequest(
    requestId: string,
    reason: string,
    cancelledBy: string
  ): Promise<void> {
    try {
      const request = await this.getSignatureRequest(requestId);
      if (!request) {
        throw new Error('Demande de signature non trouvée');
      }

      if (request.status === 'completed') {
        throw new Error('Impossible d\'annuler une demande complétée');
      }

      if (request.status === 'cancelled') {
        throw new Error('Cette demande est déjà annulée');
      }

      const auditEvent: SignatureAuditEvent = {
        timestamp: Timestamp.now(),
        action: 'request_cancelled',
        actorId: cancelledBy,
        details: { reason },
      };

      const docRef = doc(db, SIGNATURE_REQUESTS_COLLECTION, requestId);
      await updateDoc(docRef, {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
        cancellation: {
          cancelledBy,
          cancelledAt: Timestamp.now(),
          reason,
        },
        auditTrail: [...request.auditTrail, auditEvent],
      });
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.cancelSignatureRequest');
      throw error;
    }
  },

  /**
   * Subscribe to real-time updates for a signature request
   */
  subscribeToSignatureRequest(
    requestId: string,
    callback: (request: SignatureRequest | null) => void
  ): Unsubscribe {
    const docRef = doc(db, SIGNATURE_REQUESTS_COLLECTION, requestId);
    return onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }
      callback({
        id: docSnap.id,
        ...docSnap.data(),
      } as SignatureRequest);
    });
  },

  /**
   * Verify a signature
   */
  async verifySignature(
    requestId: string,
    signerId: string
  ): Promise<SignatureVerificationResult> {
    try {
      const verifyFn = httpsCallable<
        { requestId: string; signerId: string },
        SignatureVerificationResult
      >(functions, 'verifySignature');

      const result = await verifyFn({ requestId, signerId });
      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.verifySignature');

      if (isFirebaseError(error)) {
        if (error.message) {
          throw new Error(error.message);
        }
      }

      throw new Error('Échec de la vérification de signature');
    }
  },

  /**
   * Calculate document hash (client-side, uses Cloud Function)
   */
  async calculateDocumentHash(documentId: string): Promise<string> {
    try {
      const integrity = await IntegrityService.getIntegrityStatus(documentId);
      if (integrity.hash) {
        return integrity.hash;
      }

      // If no hash exists, trigger verification to generate one
      const result = await IntegrityService.verifyDocumentIntegrity(documentId);
      return result.hash;
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.calculateDocumentHash');
      throw new Error('Impossible de calculer le hash du document');
    }
  },

  /**
   * Send signature notifications to pending signers
   * (via Cloud Function for email delivery)
   */
  async sendSignatureNotifications(
    requestId: string,
    organizationId: string
  ): Promise<void> {
    try {
      const sendFn = httpsCallable<{ requestId: string; organizationId: string }, { success: boolean }>(
        functions,
        'sendSignatureNotifications'
      );
      await sendFn({ requestId, organizationId });
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.sendSignatureNotifications');
      // Don't throw - notifications are non-critical
    }
  },

  /**
   * Update document with signature information after completion
   */
  async updateDocumentWithSignatures(
    documentId: string,
    requestId: string,
    signers: SignerInfo[]
  ): Promise<void> {
    try {
      const signatures = signers
        .filter(s => s.status === 'signed' && s.signatureData)
        .map(s => ({
          signerId: s.id,
          signerName: s.name,
          signerEmail: s.email,
          signedAt: s.signedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          signatureHash: s.signatureData?.signatureHash || '',
        }));

      const docRef = doc(db, 'documents', documentId);
      await updateDoc(docRef, {
        signatures,
        signatureRequestId: requestId,
        signatureStatus: 'signed',
        signedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      ErrorLogger.error(error, 'SignatureService.updateDocumentWithSignatures');
      // Don't throw - this is a best-effort update
    }
  },

  /**
   * Get status badge configuration
   */
  getStatusConfig(status: SignatureStatus): {
    label: string;
    badgeStatus: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    description: string;
  } {
    const configs: Record<SignatureStatus, {
      label: string;
      badgeStatus: 'success' | 'warning' | 'error' | 'info' | 'neutral';
      description: string;
    }> = {
      draft: {
        label: 'Brouillon',
        badgeStatus: 'neutral',
        description: 'La demande n\'a pas encore été envoyée',
      },
      pending: {
        label: 'En attente',
        badgeStatus: 'warning',
        description: 'En attente de signatures',
      },
      in_progress: {
        label: 'En cours',
        badgeStatus: 'info',
        description: 'Certains signataires ont signé',
      },
      completed: {
        label: 'Complété',
        badgeStatus: 'success',
        description: 'Toutes les signatures ont été collectées',
      },
      rejected: {
        label: 'Rejeté',
        badgeStatus: 'error',
        description: 'Un ou plusieurs signataires ont rejeté',
      },
      expired: {
        label: 'Expiré',
        badgeStatus: 'error',
        description: 'La date limite est dépassée',
      },
      cancelled: {
        label: 'Annulé',
        badgeStatus: 'neutral',
        description: 'La demande a été annulée',
      },
    };

    return configs[status] || configs.pending;
  },

  /**
   * Get signer status badge configuration
   */
  getSignerStatusConfig(status: SignerStatus): {
    label: string;
    badgeStatus: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  } {
    const configs: Record<SignerStatus, {
      label: string;
      badgeStatus: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    }> = {
      pending: { label: 'En attente', badgeStatus: 'warning' },
      notified: { label: 'Notifié', badgeStatus: 'info' },
      viewed: { label: 'Vu', badgeStatus: 'info' },
      signed: { label: 'Signé', badgeStatus: 'success' },
      rejected: { label: 'Rejeté', badgeStatus: 'error' },
      expired: { label: 'Expiré', badgeStatus: 'error' },
    };

    return configs[status] || configs.pending;
  },
};

export default SignatureService;
