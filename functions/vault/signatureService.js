/**
 * Story 26.4 - Signature Service Cloud Functions
 *
 * Cloud Functions for electronic signature operations:
 * - initiateSignature: Start a signing flow
 * - verifySignature: Validate signature authenticity
 * - handleSignatureWebhook: Process callbacks from external providers
 * - sendSignatureNotifications: Send email notifications to signers
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const crypto = require('crypto');

// Secrets
const signatureWebhookSecret = defineSecret('SIGNATURE_WEBHOOK_SECRET');

const SIGNATURE_REQUESTS_COLLECTION = 'signatureRequests';
const DOCUMENTS_COLLECTION = 'documents';
const SIGNATURE_AUDIT_COLLECTION = 'signatureAuditLogs';

/**
 * Calculate SHA-256 hash
 */
function calculateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a unique certificate number for signed documents
 */
function generateCertificateNumber(requestId) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SIG-${timestamp}-${random}-${requestId.substring(0, 6).toUpperCase()}`;
}

/**
 * Initiate a signature request
 * Called after client creates the request to perform server-side validation
 */
exports.initiateSignature = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { requestId } = request.data;
    if (!requestId) {
      throw new HttpsError('invalid-argument', 'requestId is required');
    }

    const userId = request.auth.uid;
    const db = getFirestore();

    try {
      // Get the signature request
      const requestRef = db.collection(SIGNATURE_REQUESTS_COLLECTION).doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        throw new HttpsError('not-found', 'Signature request not found');
      }

      const requestData = requestSnap.data();

      // Verify user is the creator
      if (requestData.createdBy !== userId) {
        throw new HttpsError('permission-denied', 'Only the creator can initiate the request');
      }

      // Verify organization membership
      const userOrgId = request.auth.token.organizationId;
      if (requestData.organizationId !== userOrgId) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
      }

      // Verify request is in draft status
      if (requestData.status !== 'draft') {
        throw new HttpsError('failed-precondition', 'Request has already been initiated');
      }

      // Verify document exists and get its hash
      const docRef = db.collection(DOCUMENTS_COLLECTION).doc(requestData.documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new HttpsError('not-found', 'Document not found');
      }

      const docData = docSnap.data();
      const documentHash = docData.encryption?.hash || requestData.originalDocumentHash;

      if (!documentHash) {
        throw new HttpsError('failed-precondition', 'Document hash not available. Please verify document integrity first.');
      }

      // Update request status to pending
      await requestRef.update({
        status: 'pending',
        originalDocumentHash: documentHash,
        updatedAt: FieldValue.serverTimestamp(),
        auditTrail: FieldValue.arrayUnion({
          timestamp: Timestamp.now(),
          action: 'request_sent',
          actorId: userId,
          details: {
            documentHash,
            signerCount: requestData.signers.length,
          },
        }),
      });

      // Log audit event
      await logSignatureAudit(db, {
        requestId,
        documentId: requestData.documentId,
        action: 'initiate',
        userId,
        details: {
          signerCount: requestData.signers.length,
        },
      });

      return {
        success: true,
        requestId,
        status: 'pending',
        message: 'Signature request initiated successfully',
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Initiate signature error:', error);
      throw new HttpsError('internal', 'Failed to initiate signature request');
    }
  }
);

/**
 * Verify a signature's authenticity
 * Validates the signature hash against the document and signer information
 */
exports.verifySignature = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { requestId, signerId } = request.data;
    if (!requestId || !signerId) {
      throw new HttpsError('invalid-argument', 'requestId and signerId are required');
    }

    const db = getFirestore();

    try {
      // Get the signature request
      const requestRef = db.collection(SIGNATURE_REQUESTS_COLLECTION).doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        throw new HttpsError('not-found', 'Signature request not found');
      }

      const requestData = requestSnap.data();

      // Verify organization access
      const userOrg = request.auth.token.organizationId;
      if (requestData.organizationId !== userOrg) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Find the signer
      const signer = requestData.signers.find((s) => s.id === signerId);
      if (!signer) {
        throw new HttpsError('not-found', 'Signer not found');
      }

      if (signer.status !== 'signed' || !signer.signatureData) {
        return {
          isValid: false,
          signatureHash: null,
          documentHashMatch: false,
          signerVerified: false,
          timestamp: null,
          errors: ['Signature not found or not yet applied'],
        };
      }

      const sigData = signer.signatureData;
      const errors = [];

      // Verify document hash hasn't changed
      const documentHashMatch = sigData.documentHash === requestData.originalDocumentHash;
      if (!documentHashMatch) {
        errors.push('Document has been modified since signing');
      }

      // Recalculate and verify signature hash
      const expectedPayload = `${sigData.documentHash}|${signer.email}|${sigData.timestamp}`;
      const expectedHash = calculateHash(expectedPayload);
      const signatureHashValid = sigData.signatureHash === expectedHash;

      if (!signatureHashValid) {
        errors.push('Signature hash verification failed');
      }

      // Verify signer info
      const signerVerified = Boolean(signer.signedAt && signer.email);

      // Log verification attempt
      await logSignatureAudit(db, {
        requestId,
        documentId: requestData.documentId,
        action: 'verify',
        userId: request.auth.uid,
        details: {
          signerId,
          isValid: errors.length === 0,
          documentHashMatch,
          signatureHashValid,
        },
      });

      return {
        isValid: errors.length === 0,
        signatureHash: sigData.signatureHash,
        documentHashMatch,
        signerVerified,
        timestamp: sigData.timestamp,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Verify signature error:', error);
      throw new HttpsError('internal', 'Failed to verify signature');
    }
  }
);

/**
 * Send signature notifications to pending signers
 */
exports.sendSignatureNotifications = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { requestId, organizationId } = request.data;
    if (!requestId) {
      throw new HttpsError('invalid-argument', 'requestId is required');
    }

    const db = getFirestore();

    try {
      const requestRef = db.collection(SIGNATURE_REQUESTS_COLLECTION).doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        throw new HttpsError('not-found', 'Signature request not found');
      }

      const requestData = requestSnap.data();

      // Verify organization - organizationId is mandatory
      if (!organizationId) {
        throw new HttpsError('invalid-argument', 'organizationId is required');
      }
      if (requestData.organizationId !== organizationId) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Find signers to notify
      const signersToNotify = [];

      if (requestData.sequentialSigning) {
        // For sequential signing, only notify the next pending signer
        const nextSigner = requestData.signers.find((s) => s.status === 'pending');
        if (nextSigner) {
          signersToNotify.push(nextSigner);
        }
      } else {
        // For parallel signing, notify all pending signers
        signersToNotify.push(...requestData.signers.filter((s) => s.status === 'pending'));
      }

      if (signersToNotify.length === 0) {
        return { success: true, notified: 0, message: 'No signers to notify' };
      }

      // Get organization info for email
      const orgRef = db.collection('organizations').doc(requestData.organizationId);
      const orgSnap = await orgRef.get();
      const orgName = orgSnap.exists ? orgSnap.data().name : 'Sentinel GRC';

      // Send notifications (using existing email service pattern)
      const notificationPromises = signersToNotify.map(async (signer) => {
        const maskedEmail = signer.email
          ? signer.email.replace(/(.{2}).*(@.*)/, '$1***$2')
          : 'unknown';
        try {
          // In a real implementation, this would call an email service
          // For MVP, we just update the signer status
          logger.log(`Would send notification to ${maskedEmail} for request ${requestId}`);

          return {
            email: signer.email,
            success: true,
          };
        } catch (error) {
          logger.error(`Failed to notify ${maskedEmail}:`, error);
          return {
            email: signer.email,
            success: false,
            error: error.message,
          };
        }
      });

      const results = await Promise.all(notificationPromises);
      const successCount = results.filter((r) => r.success).length;

      // Update signers with notified status
      const updatedSigners = requestData.signers.map((s) => {
        const notified = signersToNotify.find((n) => n.id === s.id);
        if (notified && results.find((r) => r.email === s.email && r.success)) {
          return {
            ...s,
            status: 'notified',
            notifiedAt: Timestamp.now(),
          };
        }
        return s;
      });

      await requestRef.update({
        signers: updatedSigners,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        notified: successCount,
        total: signersToNotify.length,
        results,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Send notifications error:', error);
      throw new HttpsError('internal', 'Failed to send notifications');
    }
  }
);

/**
 * Handle webhook from external signature providers
 * Endpoint for DocuSign, YouSign, etc. to call back with updates
 */
exports.handleSignatureWebhook = onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [signatureWebhookSecret],
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Authenticate webhook request
    const webhookSecret = signatureWebhookSecret.value();
    const providedSecret = req.headers['x-webhook-secret'];
    if (!webhookSecret || !providedSecret ||
        providedSecret.length !== webhookSecret.length ||
        !crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(webhookSecret))) {
      logger.warn('Unauthorized webhook attempt', { ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const db = getFirestore();

    try {
      const { provider, event, externalId, data, organizationId } = req.body;

      if (!provider || !event || !externalId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Find the signature request by external ID
      let requestsQueryBuilder = db
        .collection(SIGNATURE_REQUESTS_COLLECTION)
        .where('externalId', '==', externalId)
        .where('provider', '==', provider);

      // Add organizationId filter if available in webhook payload
      if (organizationId) {
        requestsQueryBuilder = requestsQueryBuilder.where('organizationId', '==', organizationId);
      }

      const requestsQuery = await requestsQueryBuilder
        .limit(1)
        .get();

      if (requestsQuery.empty) {
        logger.warn(`No request found for external ID: ${externalId}`);
        res.status(200).json({ success: true, message: 'Request not found, ignoring' });
        return;
      }

      const requestDoc = requestsQuery.docs[0];
      const requestData = requestDoc.data();

      // Process based on event type
      let updates = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      let auditAction = 'webhook_received';

      switch (event) {
        case 'signing_complete':
        case 'envelope_completed':
          updates.status = 'completed';
          updates.completedAt = FieldValue.serverTimestamp();
          auditAction = 'request_completed';
          break;

        case 'recipient_signed':
        case 'signer_signed':
          // Update specific signer
          const signerEmail = data?.signerEmail?.toLowerCase();
          if (signerEmail) {
            const updatedSigners = requestData.signers.map((s) => {
              if (s.email.toLowerCase() === signerEmail) {
                return {
                  ...s,
                  status: 'signed',
                  signedAt: Timestamp.now(),
                };
              }
              return s;
            });

            const allSigned = updatedSigners.every((s) => s.status === 'signed');
            updates.signers = updatedSigners;
            updates.status = allSigned ? 'completed' : 'in_progress';

            if (allSigned) {
              updates.completedAt = FieldValue.serverTimestamp();
            }
          }
          auditAction = 'signature_applied';
          break;

        case 'recipient_declined':
        case 'signer_rejected':
          updates.status = 'rejected';
          auditAction = 'signature_rejected';
          break;

        case 'envelope_voided':
        case 'request_cancelled':
          updates.status = 'cancelled';
          auditAction = 'request_cancelled';
          break;

        default:
          logger.log(`Unhandled webhook event: ${event}`);
      }

      // Apply updates
      await requestDoc.ref.update(updates);

      // Log audit
      await logSignatureAudit(db, {
        requestId: requestDoc.id,
        documentId: requestData.documentId,
        action: auditAction,
        userId: 'webhook',
        details: {
          provider,
          event,
          externalId,
          data,
        },
      });

      res.status(200).json({ success: true, event, requestId: requestDoc.id });
    } catch (error) {
      logger.error('Webhook handling error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Generate a signed document certificate
 */
exports.generateSignedDocumentCertificate = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { requestId } = request.data;
    if (!requestId) {
      throw new HttpsError('invalid-argument', 'requestId is required');
    }

    const userId = request.auth.uid;
    const db = getFirestore();

    try {
      const requestRef = db.collection(SIGNATURE_REQUESTS_COLLECTION).doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        throw new HttpsError('not-found', 'Signature request not found');
      }

      const requestData = requestSnap.data();

      // Verify organization
      const userOrg = request.auth.token.organizationId;
      if (requestData.organizationId !== userOrg) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Verify request is completed
      if (requestData.status !== 'completed') {
        throw new HttpsError('failed-precondition', 'Signature request is not completed');
      }

      // Get document info
      const docRef = db.collection(DOCUMENTS_COLLECTION).doc(requestData.documentId);
      const docSnap = await docRef.get();
      const docData = docSnap.exists ? docSnap.data() : {};

      // Get organization info
      const orgRef = db.collection('organizations').doc(requestData.organizationId);
      const orgSnap = await orgRef.get();
      const orgData = orgSnap.exists ? orgSnap.data() : {};

      // Get user info
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};

      // Generate certificate number
      const certificateNumber = generateCertificateNumber(requestId);

      // Build signature details
      const signatures = requestData.signers
        .filter((s) => s.status === 'signed' && s.signatureData)
        .map((s) => ({
          signerName: s.name,
          signerEmail: s.email,
          signerRole: s.role || 'Signer',
          signedAt: s.signedAt?.toDate?.()?.toISOString() || null,
          signatureHash: s.signatureData?.signatureHash,
          signatureType: s.signatureData?.type,
        }));

      // Calculate final document hash (includes all signatures)
      const signatureHashes = signatures.map((s) => s.signatureHash).join('|');
      const finalPayload = `${requestData.originalDocumentHash}|${signatureHashes}|${certificateNumber}`;
      const finalDocumentHash = calculateHash(finalPayload);

      const certificate = {
        certificateNumber,
        generatedAt: new Date().toISOString(),
        generatedBy: {
          userId,
          name: userData.displayName || userData.email || 'Unknown',
          email: userData.email,
        },
        organization: {
          id: requestData.organizationId,
          name: orgData.name || 'Unknown Organization',
        },
        document: {
          id: requestData.documentId,
          name: requestData.documentName || docData.name || 'Unknown Document',
          originalHash: requestData.originalDocumentHash,
          finalHash: finalDocumentHash,
        },
        signatureRequest: {
          id: requestId,
          title: requestData.title,
          createdAt: requestData.createdAt?.toDate?.()?.toISOString(),
          completedAt: requestData.completedAt?.toDate?.()?.toISOString(),
          provider: requestData.provider,
        },
        signatures,
        signerCount: signatures.length,
        legalDisclaimer: `This certificate attests that the referenced document has been electronically signed by the designated parties.`,
      };

      // Log certificate generation
      await logSignatureAudit(db, {
        requestId,
        documentId: requestData.documentId,
        action: 'certificate_generated',
        userId,
        details: {
          certificateNumber,
          signerCount: signatures.length,
        },
      });

      return {
        success: true,
        certificate,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Generate certificate error:', error);
      throw new HttpsError('internal', 'Failed to generate signed document certificate');
    }
  }
);

/**
 * Log signature audit event
 */
async function logSignatureAudit(db, event) {
  try {
    await db.collection(SIGNATURE_AUDIT_COLLECTION).add({
      ...event,
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        source: 'cloud-function',
        version: '1.0.0',
      },
    });
  } catch (error) {
    logger.error('Failed to log signature audit event:', error);
  }
}
