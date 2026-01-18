/**
 * Story 27.1 - Document Audit Logger
 *
 * Immutable audit trail for all document operations in the Coffre-Fort.
 * All audit logs are append-only - they cannot be updated or deleted.
 *
 * Actions tracked:
 * - view, download, upload, update, delete
 * - share, classify, sign, verify
 * - hold_applied, hold_released
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

const DOCUMENT_AUDIT_LOGS_COLLECTION = 'document_audit_logs';

/**
 * Document action types for audit logging
 */
const DocumentActions = {
  VIEW: 'view',
  DOWNLOAD: 'download',
  UPLOAD: 'upload',
  UPDATE: 'update',
  DELETE: 'delete',
  SHARE: 'share',
  CLASSIFY: 'classify',
  SIGN: 'sign',
  VERIFY: 'verify',
  HOLD_APPLIED: 'hold_applied',
  HOLD_RELEASED: 'hold_released',
  ACCESS_DENIED: 'access_denied',
  INTEGRITY_FAILURE: 'integrity_failure',
  WATERMARKED_DOWNLOAD: 'watermarked_download',
};

/**
 * Calculate integrity hash for audit log entry
 * Creates a chain of hashes linking each entry to the previous one
 *
 * @param {Object} logEntry - The log entry data
 * @param {string} previousLogHash - Hash of the previous log entry (or 'GENESIS' for first entry)
 * @returns {string} SHA-256 hash of the log entry
 */
function calculateLogHash(logEntry, previousLogHash = 'GENESIS') {
  const hashContent = JSON.stringify({
    documentId: logEntry.documentId,
    organizationId: logEntry.organizationId,
    action: logEntry.action,
    userId: logEntry.userId,
    userEmail: logEntry.userEmail,
    timestamp: logEntry.timestamp?.toDate?.() || logEntry.timestamp,
    previousLogHash,
  });

  return crypto.createHash('sha256').update(hashContent).digest('hex');
}

/**
 * Get the hash of the most recent audit log for integrity chain
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} documentId - Document ID
 * @returns {Promise<string>} Previous log hash or 'GENESIS'
 */
async function getPreviousLogHash(db, documentId) {
  try {
    const lastLogQuery = db
      .collection(DOCUMENT_AUDIT_LOGS_COLLECTION)
      .where('documentId', '==', documentId)
      .orderBy('timestamp', 'desc')
      .limit(1);

    const snapshot = await lastLogQuery.get();

    if (snapshot.empty) {
      return 'GENESIS';
    }

    const lastLog = snapshot.docs[0].data();
    return lastLog.integrity?.hash || 'GENESIS';
  } catch (error) {
    // If query fails (e.g., no index), start fresh
    console.warn('Failed to get previous log hash:', error.message);
    return 'GENESIS';
  }
}

/**
 * Log a document action to the immutable audit trail
 *
 * @param {Object} options - Logging options
 * @param {string} options.documentId - Document ID
 * @param {string} options.organizationId - Organization ID
 * @param {string} options.action - Action type (from DocumentActions)
 * @param {string} options.userId - User ID who performed the action
 * @param {string} options.userEmail - User email for compliance
 * @param {Object} options.details - Additional details about the action
 * @param {string} options.ipAddress - Client IP address
 * @param {string} options.userAgent - Client user agent
 * @returns {Promise<string>} Created log entry ID
 */
async function logDocumentAction({
  documentId,
  organizationId,
  action,
  userId,
  userEmail,
  details = {},
  ipAddress = null,
  userAgent = null,
}) {
  const db = getFirestore();

  try {
    // Get previous log hash for integrity chain
    const previousLogHash = await getPreviousLogHash(db, documentId);

    // Create the timestamp first so we can use it in hash calculation
    const now = new Date();

    // Build the log entry
    const logEntry = {
      documentId,
      organizationId,
      action,
      userId,
      userEmail: userEmail || 'unknown',
      timestamp: FieldValue.serverTimestamp(),
      details: sanitizeDetails(details),
      metadata: {
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        source: 'cloud-function',
        version: '1.0.0',
      },
    };

    // Calculate integrity hash
    const entryForHash = { ...logEntry, timestamp: now };
    const hash = calculateLogHash(entryForHash, previousLogHash);

    // Add integrity block
    logEntry.integrity = {
      hash,
      previousLogHash,
      algorithm: 'SHA-256',
    };

    // Store the log entry
    const docRef = await db.collection(DOCUMENT_AUDIT_LOGS_COLLECTION).add(logEntry);

    console.log(`Audit log created: ${action} on ${documentId} by ${userId}`);

    return docRef.id;
  } catch (error) {
    console.error('Failed to log document action:', error);
    // Don't throw - audit logging should not break the main operation
    // But log the error for monitoring
    return null;
  }
}

/**
 * Sanitize details object for storage
 * Removes sensitive data and limits field sizes
 *
 * @param {Object} details - Raw details object
 * @returns {Object} Sanitized details
 */
function sanitizeDetails(details) {
  if (!details || typeof details !== 'object') {
    return {};
  }

  const MAX_STRING_LENGTH = 2000;
  const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'credential'];

  const sanitized = {};

  for (const [key, value] of Object.entries(details)) {
    // Skip sensitive fields
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = '[***REMOVED***]';
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      sanitized[key] = value.substring(0, MAX_STRING_LENGTH) + '...[truncated]';
      continue;
    }

    // Handle nested objects (one level)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Log document view action
 */
async function logDocumentView(documentId, organizationId, userId, userEmail, metadata = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.VIEW,
    userId,
    userEmail,
    details: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document download action
 */
async function logDocumentDownload(documentId, organizationId, userId, userEmail, metadata = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.DOWNLOAD,
    userId,
    userEmail,
    details: {
      ...metadata,
      downloadedAt: new Date().toISOString(),
    },
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document upload action
 */
async function logDocumentUpload(documentId, organizationId, userId, userEmail, metadata = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.UPLOAD,
    userId,
    userEmail,
    details: {
      filename: metadata.filename,
      size: metadata.size,
      mimeType: metadata.mimeType,
      classification: metadata.classification,
      uploadedAt: new Date().toISOString(),
    },
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document update action
 */
async function logDocumentUpdate(documentId, organizationId, userId, userEmail, changes = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.UPDATE,
    userId,
    userEmail,
    details: {
      changedFields: Object.keys(changes),
      previousValues: changes.previous || {},
      newValues: changes.current || {},
    },
  });
}

/**
 * Log document share action
 */
async function logDocumentShare(documentId, organizationId, userId, userEmail, shareDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.SHARE,
    userId,
    userEmail,
    details: {
      sharedWith: shareDetails.recipients || [],
      accessLevel: shareDetails.accessLevel,
      expiresAt: shareDetails.expiresAt,
      shareType: shareDetails.type || 'user',
    },
  });
}

/**
 * Log document classification change
 */
async function logDocumentClassify(documentId, organizationId, userId, userEmail, classificationDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.CLASSIFY,
    userId,
    userEmail,
    details: {
      previousLevel: classificationDetails.previousLevel,
      newLevel: classificationDetails.newLevel,
      justification: classificationDetails.justification,
      autoClassified: classificationDetails.autoClassified || false,
    },
  });
}

/**
 * Log document signature action
 */
async function logDocumentSign(documentId, organizationId, userId, userEmail, signatureDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.SIGN,
    userId,
    userEmail,
    details: {
      signatureType: signatureDetails.type,
      signatureHash: signatureDetails.hash,
      signedAt: new Date().toISOString(),
      certificateInfo: signatureDetails.certificate,
    },
  });
}

/**
 * Log document integrity verification
 */
async function logDocumentVerify(documentId, organizationId, userId, userEmail, verificationDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.VERIFY,
    userId,
    userEmail,
    details: {
      status: verificationDetails.status,
      hash: verificationDetails.hash,
      expectedHash: verificationDetails.expectedHash,
      verified: verificationDetails.verified,
      verifiedAt: new Date().toISOString(),
    },
  });
}

/**
 * Log legal hold application
 */
async function logHoldApplied(documentId, organizationId, userId, userEmail, holdDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.HOLD_APPLIED,
    userId,
    userEmail,
    details: {
      holdId: holdDetails.holdId,
      holdName: holdDetails.holdName,
      reason: holdDetails.reason,
      matterNumber: holdDetails.matterNumber,
      appliedAt: new Date().toISOString(),
    },
  });
}

/**
 * Log legal hold release
 */
async function logHoldReleased(documentId, organizationId, userId, userEmail, holdDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.HOLD_RELEASED,
    userId,
    userEmail,
    details: {
      holdId: holdDetails.holdId,
      holdName: holdDetails.holdName,
      releaseReason: holdDetails.releaseReason,
      releasedAt: new Date().toISOString(),
    },
  });
}

/**
 * Log access denied event
 */
async function logAccessDenied(documentId, organizationId, userId, userEmail, denialDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.ACCESS_DENIED,
    userId,
    userEmail,
    details: {
      reason: denialDetails.reason,
      requestedAction: denialDetails.requestedAction,
      userRole: denialDetails.userRole,
      classificationLevel: denialDetails.classificationLevel,
    },
  });
}

/**
 * Log watermarked download
 */
async function logWatermarkedDownload(documentId, organizationId, userId, userEmail, watermarkDetails = {}) {
  return logDocumentAction({
    documentId,
    organizationId,
    action: DocumentActions.WATERMARKED_DOWNLOAD,
    userId,
    userEmail,
    details: {
      watermarkText: watermarkDetails.text,
      watermarkPosition: watermarkDetails.position,
      downloadedAt: new Date().toISOString(),
    },
  });
}

module.exports = {
  DocumentActions,
  logDocumentAction,
  logDocumentView,
  logDocumentDownload,
  logDocumentUpload,
  logDocumentUpdate,
  logDocumentShare,
  logDocumentClassify,
  logDocumentSign,
  logDocumentVerify,
  logHoldApplied,
  logHoldReleased,
  logAccessDenied,
  logWatermarkedDownload,
  calculateLogHash,
  sanitizeDetails,
};
