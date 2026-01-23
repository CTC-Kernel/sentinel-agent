/**
 * Enrollment Token Management - Generate, list, and revoke enrollment tokens
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();

/**
 * Generate a new enrollment token
 */
exports.generateEnrollmentToken = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { organizationId, name, expiresInDays = 30, maxUses = null } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    try {
      // Verify user has access to this organization
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('permission-denied', 'User not found');
      }

      const userData = userDoc.data();
      if (userData.organizationId !== organizationId && !userData.isAdmin) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create token document
      const tokenData = {
        token,
        name: name || `Token ${new Date().toISOString().split('T')[0]}`,
        organizationId,
        createdBy: auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        maxUses: maxUses || null,
        usedCount: 0,
        revoked: false,
        lastUsedAt: null,
      };

      const tokenRef = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('enrollmentTokens')
        .add(tokenData);

      // Log token creation
      await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
        type: 'enrollment_token_created',
        tokenId: tokenRef.id,
        userId: auth.uid,
        name: tokenData.name,
        expiresAt: expiresAt.toISOString(),
        maxUses,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: tokenRef.id,
        token,
        name: tokenData.name,
        expiresAt: expiresAt.toISOString(),
        maxUses,
      };
    } catch (error) {
      console.error('Generate enrollment token error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to generate enrollment token');
    }
  }
);

/**
 * List enrollment tokens for an organization
 */
exports.listEnrollmentTokens = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { organizationId, includeRevoked = false } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    try {
      // Verify user has access
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('permission-denied', 'User not found');
      }

      const userData = userDoc.data();
      if (userData.organizationId !== organizationId && !userData.isAdmin) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
      }

      let query = db
        .collection('organizations')
        .doc(organizationId)
        .collection('enrollmentTokens')
        .orderBy('createdAt', 'desc');

      if (!includeRevoked) {
        query = query.where('revoked', '==', false);
      }

      const snapshot = await query.get();

      const tokens = snapshot.docs.map((doc) => {
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
        const isExpired = expiresAt < new Date();
        const isExhausted = data.maxUses && data.usedCount >= data.maxUses;

        return {
          id: doc.id,
          name: data.name,
          // Don't expose the full token for security, only first/last 4 chars
          tokenPreview: `${data.token.slice(0, 4)}...${data.token.slice(-4)}`,
          createdAt: data.createdAt?.toDate?.().toISOString(),
          expiresAt: expiresAt.toISOString(),
          maxUses: data.maxUses,
          usedCount: data.usedCount,
          revoked: data.revoked,
          lastUsedAt: data.lastUsedAt?.toDate?.().toISOString() || null,
          status: data.revoked
            ? 'revoked'
            : isExpired
            ? 'expired'
            : isExhausted
            ? 'exhausted'
            : 'active',
        };
      });

      return { tokens };
    } catch (error) {
      console.error('List enrollment tokens error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to list enrollment tokens');
    }
  }
);

/**
 * Revoke an enrollment token
 */
exports.revokeEnrollmentToken = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { organizationId, tokenId } = request.data;

    if (!organizationId || !tokenId) {
      throw new HttpsError('invalid-argument', 'organizationId and tokenId are required');
    }

    try {
      // Verify user has access
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('permission-denied', 'User not found');
      }

      const userData = userDoc.data();
      if (userData.organizationId !== organizationId && !userData.isAdmin) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
      }

      const tokenRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('enrollmentTokens')
        .doc(tokenId);

      const tokenDoc = await tokenRef.get();
      if (!tokenDoc.exists) {
        throw new HttpsError('not-found', 'Token not found');
      }

      if (tokenDoc.data().revoked) {
        throw new HttpsError('failed-precondition', 'Token is already revoked');
      }

      await tokenRef.update({
        revoked: true,
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedBy: auth.uid,
      });

      // Log token revocation
      await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
        type: 'enrollment_token_revoked',
        tokenId,
        userId: auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Revoke enrollment token error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to revoke enrollment token');
    }
  }
);
