/**
 * Story 27.2 - Audit Query Functions
 *
 * Cloud Functions for querying and exporting document audit trails.
 * Supports pagination, filtering, and multiple export formats.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const DOCUMENT_AUDIT_LOGS_COLLECTION = 'document_audit_logs';

/**
 * Get audit trail for a specific document
 * Callable function with pagination support
 */
exports.getDocumentAuditTrail = onCall(
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

    const { documentId, limit = 50, startAfter = null, filters = {} } = request.data;

    if (!documentId) {
      throw new HttpsError('invalid-argument', 'documentId is required');
    }

    const db = getFirestore();
    const userOrg = request.auth.token.organizationId;

    try {
      // First verify the user has access to this document's organization
      const docRef = db.collection('documents').doc(documentId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const docData = docSnap.data();
        if (docData.organizationId !== userOrg) {
          throw new HttpsError('permission-denied', 'Access denied');
        }
      }

      // Build the query
      let query = db
        .collection(DOCUMENT_AUDIT_LOGS_COLLECTION)
        .where('documentId', '==', documentId)
        .orderBy('timestamp', 'desc');

      // Apply action filter if provided
      if (filters.actions && Array.isArray(filters.actions) && filters.actions.length > 0) {
        query = query.where('action', 'in', filters.actions);
      }

      // Apply date range filter if provided
      if (filters.startDate) {
        query = query.where('timestamp', '>=', new Date(filters.startDate));
      }
      if (filters.endDate) {
        query = query.where('timestamp', '<=', new Date(filters.endDate));
      }

      // Apply pagination
      if (startAfter) {
        const startAfterDoc = await db.collection(DOCUMENT_AUDIT_LOGS_COLLECTION).doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      query = query.limit(Math.min(limit, 100));

      const snapshot = await query.get();
      const entries = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          documentId: data.documentId,
          action: data.action,
          userId: data.userId,
          userEmail: data.userEmail,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          details: data.details || {},
          metadata: data.metadata || {},
          integrity: data.integrity || {},
        });
      });

      // Get next page cursor
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const nextCursor = lastDoc ? lastDoc.id : null;

      return {
        success: true,
        entries,
        pagination: {
          limit,
          count: entries.length,
          nextCursor,
          hasMore: entries.length === limit,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('Get document audit trail error:', error);
      throw new HttpsError('internal', 'Failed to retrieve audit trail');
    }
  }
);

/**
 * Get audit trail for all actions by a specific user
 */
exports.getUserAuditTrail = onCall(
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

    const { userId, limit = 50, startAfter = null, filters = {} } = request.data;

    // Users can only query their own audit trail unless they are admin/rssi
    const requestingUserId = request.auth.uid;
    const userRole = request.auth.token.role || 'user';
    const targetUserId = userId || requestingUserId;

    if (targetUserId !== requestingUserId && !['admin', 'rssi', 'super_admin'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Cannot view other users audit trail');
    }

    const db = getFirestore();
    const userOrg = request.auth.token.organizationId;

    try {
      // Build the query
      let query = db
        .collection(DOCUMENT_AUDIT_LOGS_COLLECTION)
        .where('organizationId', '==', userOrg)
        .where('userId', '==', targetUserId)
        .orderBy('timestamp', 'desc');

      // Apply action filter if provided
      if (filters.actions && Array.isArray(filters.actions) && filters.actions.length > 0) {
        query = query.where('action', 'in', filters.actions);
      }

      // Apply pagination
      if (startAfter) {
        const startAfterDoc = await db.collection(DOCUMENT_AUDIT_LOGS_COLLECTION).doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      query = query.limit(Math.min(limit, 100));

      const snapshot = await query.get();
      const entries = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          documentId: data.documentId,
          action: data.action,
          userId: data.userId,
          userEmail: data.userEmail,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          details: data.details || {},
        });
      });

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const nextCursor = lastDoc ? lastDoc.id : null;

      return {
        success: true,
        entries,
        pagination: {
          limit,
          count: entries.length,
          nextCursor,
          hasMore: entries.length === limit,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('Get user audit trail error:', error);
      throw new HttpsError('internal', 'Failed to retrieve user audit trail');
    }
  }
);

/**
 * Get organization-wide audit trail with advanced filtering
 * Admin/RSSI only
 */
exports.getOrganizationAuditTrail = onCall(
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

    const userRole = request.auth.token.role || 'user';
    if (!['admin', 'rssi', 'super_admin', 'auditor'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin or auditor access required');
    }

    const { limit = 100, startAfter = null, filters = {} } = request.data;
    const db = getFirestore();
    const userOrg = request.auth.token.organizationId;

    try {
      // Build the query
      let query = db
        .collection(DOCUMENT_AUDIT_LOGS_COLLECTION)
        .where('organizationId', '==', userOrg)
        .orderBy('timestamp', 'desc');

      // Apply filters
      if (filters.documentId) {
        query = query.where('documentId', '==', filters.documentId);
      }

      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      if (filters.actions && Array.isArray(filters.actions) && filters.actions.length > 0) {
        query = query.where('action', 'in', filters.actions);
      }

      if (filters.startDate) {
        query = query.where('timestamp', '>=', new Date(filters.startDate));
      }

      if (filters.endDate) {
        query = query.where('timestamp', '<=', new Date(filters.endDate));
      }

      // Apply pagination
      if (startAfter) {
        const startAfterDoc = await db.collection(DOCUMENT_AUDIT_LOGS_COLLECTION).doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      query = query.limit(Math.min(limit, 500));

      const snapshot = await query.get();
      const entries = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          documentId: data.documentId,
          action: data.action,
          userId: data.userId,
          userEmail: data.userEmail,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          details: data.details || {},
          metadata: data.metadata || {},
          integrity: data.integrity || {},
        });
      });

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const nextCursor = lastDoc ? lastDoc.id : null;

      return {
        success: true,
        entries,
        pagination: {
          limit,
          count: entries.length,
          nextCursor,
          hasMore: entries.length === limit,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('Get organization audit trail error:', error);
      throw new HttpsError('internal', 'Failed to retrieve organization audit trail');
    }
  }
);

/**
 * Export audit trail to various formats
 * Admin/RSSI only
 */
exports.exportAuditTrail = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userRole = request.auth.token.role || 'user';
    if (!['admin', 'rssi', 'super_admin', 'auditor'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin or auditor access required');
    }

    const { format = 'json', filters = {}, maxRecords = 10000 } = request.data;

    if (!['json', 'csv'].includes(format)) {
      throw new HttpsError('invalid-argument', 'Format must be json or csv');
    }

    const db = getFirestore();
    const userOrg = request.auth.token.organizationId;

    try {
      // Build the query
      let query = db
        .collection(DOCUMENT_AUDIT_LOGS_COLLECTION)
        .where('organizationId', '==', userOrg)
        .orderBy('timestamp', 'desc');

      // Apply filters
      if (filters.documentId) {
        query = query.where('documentId', '==', filters.documentId);
      }

      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      if (filters.actions && Array.isArray(filters.actions) && filters.actions.length > 0) {
        query = query.where('action', 'in', filters.actions);
      }

      if (filters.startDate) {
        query = query.where('timestamp', '>=', new Date(filters.startDate));
      }

      if (filters.endDate) {
        query = query.where('timestamp', '<=', new Date(filters.endDate));
      }

      query = query.limit(Math.min(maxRecords, 10000));

      const snapshot = await query.get();
      const entries = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          documentId: data.documentId,
          action: data.action,
          userId: data.userId,
          userEmail: data.userEmail,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          ipAddress: data.metadata?.ipAddress || 'N/A',
          userAgent: data.metadata?.userAgent || 'N/A',
          details: JSON.stringify(data.details || {}),
          integrityHash: data.integrity?.hash || 'N/A',
        });
      });

      let exportData;
      let contentType;

      if (format === 'csv') {
        // Generate CSV
        const headers = [
          'ID',
          'Document ID',
          'Action',
          'User ID',
          'User Email',
          'Timestamp',
          'IP Address',
          'User Agent',
          'Details',
          'Integrity Hash',
        ];

        const csvRows = [headers.join(',')];

        for (const entry of entries) {
          const row = [
            entry.id,
            entry.documentId,
            entry.action,
            entry.userId,
            entry.userEmail,
            entry.timestamp,
            entry.ipAddress,
            entry.userAgent,
            `"${entry.details.replace(/"/g, '""')}"`,
            entry.integrityHash,
          ];
          csvRows.push(row.join(','));
        }

        exportData = csvRows.join('\n');
        contentType = 'text/csv';
      } else {
        // JSON format
        exportData = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            exportedBy: request.auth.uid,
            organizationId: userOrg,
            filters,
            totalRecords: entries.length,
            entries,
          },
          null,
          2
        );
        contentType = 'application/json';
      }

      return {
        success: true,
        format,
        contentType,
        data: exportData,
        recordCount: entries.length,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('Export audit trail error:', error);
      throw new HttpsError('internal', 'Failed to export audit trail');
    }
  }
);

/**
 * Get audit statistics for dashboard
 */
exports.getAuditStatistics = onCall(
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

    const userRole = request.auth.token.role || 'user';
    if (!['admin', 'rssi', 'super_admin', 'auditor'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin or auditor access required');
    }

    const { days = 30 } = request.data;
    const db = getFirestore();
    const userOrg = request.auth.token.organizationId;

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = db
        .collection(DOCUMENT_AUDIT_LOGS_COLLECTION)
        .where('organizationId', '==', userOrg)
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'desc');

      const snapshot = await query.get();

      // Calculate statistics
      const stats = {
        totalActions: 0,
        actionCounts: {},
        userCounts: {},
        documentCounts: {},
        dailyCounts: {},
        accessDeniedCount: 0,
        integrityFailures: 0,
      };

      snapshot.forEach((doc) => {
        const data = doc.data();
        stats.totalActions++;

        // Count by action type
        const action = data.action || 'unknown';
        stats.actionCounts[action] = (stats.actionCounts[action] || 0) + 1;

        // Count by user
        const userId = data.userId || 'unknown';
        stats.userCounts[userId] = (stats.userCounts[userId] || 0) + 1;

        // Count by document
        const documentId = data.documentId || 'unknown';
        stats.documentCounts[documentId] = (stats.documentCounts[documentId] || 0) + 1;

        // Count by day
        const timestamp = data.timestamp?.toDate?.();
        if (timestamp) {
          const dateKey = timestamp.toISOString().split('T')[0];
          stats.dailyCounts[dateKey] = (stats.dailyCounts[dateKey] || 0) + 1;
        }

        // Special counts
        if (action === 'access_denied') {
          stats.accessDeniedCount++;
        }
        if (action === 'integrity_failure') {
          stats.integrityFailures++;
        }
      });

      // Convert to arrays for easier consumption
      const topActions = Object.entries(stats.actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topUsers = Object.entries(stats.userCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topDocuments = Object.entries(stats.documentCounts)
        .map(([documentId, count]) => ({ documentId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const dailyTrend = Object.entries(stats.dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        success: true,
        period: {
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
          days,
        },
        summary: {
          totalActions: stats.totalActions,
          uniqueUsers: Object.keys(stats.userCounts).length,
          uniqueDocuments: Object.keys(stats.documentCounts).length,
          accessDeniedCount: stats.accessDeniedCount,
          integrityFailures: stats.integrityFailures,
        },
        topActions,
        topUsers,
        topDocuments,
        dailyTrend,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('Get audit statistics error:', error);
      throw new HttpsError('internal', 'Failed to retrieve audit statistics');
    }
  }
);
