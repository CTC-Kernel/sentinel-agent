/**
 * Story 25.5 - Retention Policy Engine Cloud Function
 *
 * Scheduled function that processes documents past their retention period.
 * - Runs daily at 2 AM Paris time
 * - Processes documents based on retention policies
 * - Actions: archive (move to archive collection) or delete
 * - Skips documents under legal hold
 * - Generates retention report in system_logs
 * - Includes callable function for manual preview
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure admin is initialized (might be called multiple times but it's idempotent)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const BATCH_SIZE = 100;

/**
 * Calculate document expiry date based on creation date and retention days
 */
function calculateExpiryDate(createdAt, retentionDays) {
  let creationDate;

  if (createdAt && createdAt.toDate) {
    creationDate = createdAt.toDate();
  } else if (createdAt && typeof createdAt === 'string') {
    creationDate = new Date(createdAt);
  } else {
    creationDate = new Date();
  }

  const expiryDate = new Date(creationDate);
  expiryDate.setDate(expiryDate.getDate() + retentionDays);
  return expiryDate;
}

/**
 * Check if document matches policy scope
 */
function documentMatchesScope(document, scope) {
  if (!scope) return true;

  // Check classification
  if (scope.classifications && scope.classifications.length > 0) {
    const docClassification = document.classification?.level || 'internal';
    if (!scope.classifications.includes(docClassification)) {
      return false;
    }
  }

  // Check document type
  if (scope.documentTypes && scope.documentTypes.length > 0) {
    if (!scope.documentTypes.includes(document.type)) {
      return false;
    }
  }

  // Check folder
  if (scope.folderIds && scope.folderIds.length > 0) {
    if (!document.folderId || !scope.folderIds.includes(document.folderId)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if document is excluded by policy exceptions
 */
function isDocumentExcluded(document, exceptions) {
  if (!exceptions) return false;

  // Check classification exceptions
  if (exceptions.classifications && exceptions.classifications.length > 0) {
    const docClassification = document.classification?.level || 'internal';
    if (exceptions.classifications.includes(docClassification)) {
      return true;
    }
  }

  // Check legal hold exclusion
  if (exceptions.excludeLegalHold && document.isUnderHold) {
    return true;
  }

  return false;
}

/**
 * Check if document is under legal hold
 */
function isUnderLegalHold(document) {
  return document.isUnderHold === true ||
         (document.legalHoldIds && document.legalHoldIds.length > 0);
}

/**
 * Find applicable policy for a document
 */
function findApplicablePolicy(document, policies) {
  // Sort by priority (highest first)
  const sortedPolicies = [...policies].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const policy of sortedPolicies) {
    // Skip inactive policies
    if (policy.isActive === false) continue;

    // Check scope
    if (!documentMatchesScope(document, policy.scope)) continue;

    // Check exceptions
    if (isDocumentExcluded(document, policy.exceptions)) continue;

    // Check legacy documentType field
    if (policy.documentType && policy.documentType !== document.type) continue;

    return policy;
  }

  return null;
}

/**
 * Archive a document (move to archived_documents collection)
 */
async function archiveDocument(db, document, policy) {
  const batch = db.batch();

  // Create archive record
  const archiveRef = db.collection('archived_documents').doc(document.id);
  batch.set(archiveRef, {
    ...document,
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    archivedBy: 'retention-engine',
    retentionPolicyId: policy.id,
    retentionPolicyName: policy.name,
    originalCollection: 'documents',
  });

  // Update original document to mark as archived
  const docRef = db.collection('documents').doc(document.id);
  batch.update(docRef, {
    status: 'Archive',
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    archivedByRetention: true,
    retentionPolicyId: policy.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { action: 'archived', documentId: document.id };
}

/**
 * Delete a document (soft delete - mark as deleted)
 * Note: Hard delete would require Storage cleanup too
 */
async function deleteDocument(db, document, policy) {
  // For safety, we do a soft delete
  const docRef = db.collection('documents').doc(document.id);

  await docRef.update({
    status: 'Supprime',
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    deletedByRetention: true,
    retentionPolicyId: policy.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { action: 'deleted', documentId: document.id };
}

/**
 * Send notification about document expiry
 */
async function notifyAboutDocument(db, document, policy, organizationId) {
  // Create notification for document owner or admins
  const notificationData = {
    type: 'retention_warning',
    title: 'Document arrivant a expiration',
    message: `Le document "${document.title}" arrive a expiration selon la politique "${policy.name}"`,
    documentId: document.id,
    documentTitle: document.title,
    policyId: policy.id,
    policyName: policy.name,
    organizationId,
    userId: document.ownerId || document.owner,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('notifications').add(notificationData);

  return { action: 'notified', documentId: document.id };
}

/**
 * Process documents for a single organization
 */
async function processOrganization(db, organizationId, dryRun = false) {
  const results = {
    organizationId,
    processed: 0,
    archived: 0,
    deleted: 0,
    notified: 0,
    skipped: 0,
    skippedLegalHold: 0,
    errors: [],
  };

  // Get active retention policies
  const policiesSnap = await db.collection('retentionPolicies')
    .where('organizationId', '==', organizationId)
    .get();

  if (policiesSnap.empty) {
    logger.info(`No retention policies for org ${organizationId}`);
    return results;
  }

  const policies = policiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const activePolicies = policies.filter(p => p.isActive !== false);

  if (activePolicies.length === 0) {
    logger.info(`No active retention policies for org ${organizationId}`);
    return results;
  }

  // Get all documents
  const docsSnap = await db.collection('documents')
    .where('organizationId', '==', organizationId)
    .limit(BATCH_SIZE)
    .get();

  const now = new Date();

  for (const docSnap of docsSnap.docs) {
    const document = { id: docSnap.id, ...docSnap.data() };
    results.processed++;

    try {
      // Skip already archived/deleted documents
      if (document.status === 'Archive' || document.status === 'Supprime') {
        results.skipped++;
        continue;
      }

      // Find applicable policy
      const policy = findApplicablePolicy(document, activePolicies);

      if (!policy) {
        results.skipped++;
        continue;
      }

      // Check if document has expired
      const expiryDate = calculateExpiryDate(document.createdAt, policy.retentionDays);

      if (expiryDate > now) {
        // Not expired yet
        results.skipped++;
        continue;
      }

      // Check legal hold
      if (isUnderLegalHold(document)) {
        logger.info(`Document ${document.id} under legal hold, skipping`);
        results.skippedLegalHold++;
        continue;
      }

      // Execute action
      if (!dryRun) {
        switch (policy.action) {
          case 'archive':
            await archiveDocument(db, document, policy);
            results.archived++;
            break;
          case 'delete':
            await deleteDocument(db, document, policy);
            results.deleted++;
            break;
          case 'notify':
            await notifyAboutDocument(db, document, policy, organizationId);
            results.notified++;
            break;
          default:
            results.skipped++;
        }
      } else {
        // Dry run - just count what would happen
        switch (policy.action) {
          case 'archive':
            results.archived++;
            break;
          case 'delete':
            results.deleted++;
            break;
          case 'notify':
            results.notified++;
            break;
        }
      }
    } catch (error) {
      logger.error(`Error processing document ${document.id}:`, error);
      results.errors.push({
        documentId: document.id,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Scheduled retention engine - runs daily at 2 AM Paris time
 */
exports.scheduledRetentionEngine = onSchedule(
  {
    schedule: '0 2 * * *', // 2 AM daily
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    logger.info('Starting scheduled retention engine');

    const db = admin.firestore();
    const startTime = Date.now();

    try {
      // Get all organizations
      const orgsSnap = await db.collection('organizations').get();

      const totalResults = {
        organizationsProcessed: 0,
        totalProcessed: 0,
        totalArchived: 0,
        totalDeleted: 0,
        totalNotified: 0,
        totalSkipped: 0,
        totalSkippedLegalHold: 0,
        totalErrors: 0,
        details: [],
      };

      for (const orgDoc of orgsSnap.docs) {
        const organizationId = orgDoc.id;

        try {
          const results = await processOrganization(db, organizationId);

          totalResults.organizationsProcessed++;
          totalResults.totalProcessed += results.processed;
          totalResults.totalArchived += results.archived;
          totalResults.totalDeleted += results.deleted;
          totalResults.totalNotified += results.notified;
          totalResults.totalSkipped += results.skipped;
          totalResults.totalSkippedLegalHold += results.skippedLegalHold;
          totalResults.totalErrors += results.errors.length;

          if (results.archived > 0 || results.deleted > 0 || results.notified > 0) {
            totalResults.details.push(results);
          }
        } catch (error) {
          logger.error(`Error processing org ${organizationId}:`, error);
          totalResults.totalErrors++;
        }
      }

      const duration = Date.now() - startTime;

      // Store report in system_logs
      await db.collection('system_logs').add({
        type: 'retention_engine_run',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: duration,
        results: totalResults,
      });

      logger.info('Retention engine completed', totalResults);

      return totalResults;
    } catch (error) {
      logger.error('Retention engine failed:', error);

      // Log failure
      await db.collection('system_logs').add({
        type: 'retention_engine_error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }
);

/**
 * Manual retention preview - callable function
 * Returns what would happen without actually executing
 */
exports.previewRetentionActions = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Verify admin/rssi role
    const userRole = request.auth.token.role;
    if (!['admin', 'super_admin', 'rssi'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin or RSSI role required');
    }

    const { organizationId } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId required');
    }

    // Verify user belongs to organization
    if (request.auth.token.organizationId !== organizationId &&
        !request.auth.token.superAdmin) {
      throw new HttpsError('permission-denied', 'Not authorized for this organization');
    }

    logger.info(`Preview retention for org ${organizationId}`);

    const db = admin.firestore();

    try {
      // Run in dry-run mode
      const results = await processOrganization(db, organizationId, true);

      // Get detailed document list
      const details = [];

      // Re-process to get document details
      const policiesSnap = await db.collection('retentionPolicies')
        .where('organizationId', '==', organizationId)
        .where('isActive', '==', true)
        .get();

      if (!policiesSnap.empty) {
        const policies = policiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const docsSnap = await db.collection('documents')
          .where('organizationId', '==', organizationId)
          .get();

        const now = new Date();

        for (const docSnap of docsSnap.docs) {
          const document = { id: docSnap.id, ...docSnap.data() };

          if (document.status === 'Archive' || document.status === 'Supprime') {
            continue;
          }

          const policy = findApplicablePolicy(document, policies);
          if (!policy) continue;

          const expiryDate = calculateExpiryDate(document.createdAt, policy.retentionDays);
          const isExpired = expiryDate <= now;
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

          if (isExpired || daysUntilExpiry <= 30) {
            details.push({
              documentId: document.id,
              documentTitle: document.title,
              documentType: document.type,
              createdAt: document.createdAt,
              expiryDate: expiryDate.toISOString(),
              daysUntilExpiry,
              isExpired,
              isUnderLegalHold: isUnderLegalHold(document),
              policyId: policy.id,
              policyName: policy.name,
              action: policy.action,
              wouldExecute: isExpired && !isUnderLegalHold(document),
            });
          }
        }
      }

      return {
        summary: results,
        affectedDocuments: details.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Preview retention failed:', error);
      throw new HttpsError('internal', 'Failed to preview retention actions');
    }
  }
);

/**
 * Manual trigger for retention engine - for testing or emergency runs
 */
exports.runRetentionEngine = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Only super admin can trigger manually
    if (!request.auth.token.superAdmin && request.auth.token.role !== 'super_admin') {
      throw new HttpsError('permission-denied', 'Super admin role required');
    }

    const { organizationId, dryRun = false } = request.data;

    logger.info(`Manual retention run for org ${organizationId || 'ALL'}, dryRun=${dryRun}`);

    const db = admin.firestore();

    try {
      if (organizationId) {
        // Process single organization
        const results = await processOrganization(db, organizationId, dryRun);

        // Log the run
        await db.collection('system_logs').add({
          type: 'retention_engine_manual',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          triggeredBy: request.auth.uid,
          organizationId,
          dryRun,
          results,
        });

        return { success: true, results };
      } else {
        // Process all organizations (super admin only)
        const orgsSnap = await db.collection('organizations').get();

        const allResults = [];
        for (const orgDoc of orgsSnap.docs) {
          const results = await processOrganization(db, orgDoc.id, dryRun);
          allResults.push(results);
        }

        // Log the run
        await db.collection('system_logs').add({
          type: 'retention_engine_manual_all',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          triggeredBy: request.auth.uid,
          dryRun,
          organizationCount: allResults.length,
        });

        return { success: true, results: allResults };
      }
    } catch (error) {
      logger.error('Manual retention run failed:', error);
      throw new HttpsError('internal', 'Retention engine execution failed');
    }
  }
);

/**
 * Get retention engine run history
 */
exports.getRetentionHistory = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userRole = request.auth.token.role;
    if (!['admin', 'super_admin', 'rssi', 'auditor'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions');
    }

    const { limit = 10 } = request.data;

    const db = admin.firestore();

    try {
      const logsSnap = await db.collection('system_logs')
        .where('type', 'in', ['retention_engine_run', 'retention_engine_manual', 'retention_engine_error'])
        .orderBy('timestamp', 'desc')
        .limit(Math.min(limit, 100))
        .get();

      const history = logsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null,
      }));

      return { history };
    } catch (error) {
      logger.error('Get retention history failed:', error);
      throw new HttpsError('internal', 'Failed to retrieve retention history');
    }
  }
);
