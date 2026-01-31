/**
 * Users Module - User Management Functions
 * Domain: User Claims, Roles, Token Refresh, Super Admin
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { user } = require("firebase-functions/v1/auth");
const admin = require("firebase-admin");
const crypto = require("crypto");
const cors = require("cors");
const { checkCallableRateLimit } = require("../utils/rateLimiter");

// CORS Configuration for callable functions
const corsOptions = {
    origin: [
        'https://app.cyber-threat-consulting.com',
        'https://cyber-threat-consulting.com',
        'https://sentinel-grc-a8701.web.app',
        'https://sentinel-grc-a8701.firebaseapp.com'
    ],
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600
};

/**
 * Set custom claims when user document is created/updated
 */
exports.setUserClaims = onDocumentWritten({
    document: "users/{userId}",
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap || !afterSnap.exists) return;

    const userData = afterSnap.data();
    const userId = event.params.userId;
    const userEmail = userData.email;

    try {
        const db = admin.firestore();
        const userRef = afterSnap.ref;
        let updates = {};
        let organizationId = userData.organizationId;
        let role = userData.role || 'user';

        // 0. Security: Revoke Tokens on Sensitive Changes
        const beforeSnap = event.data?.before;
        if (beforeSnap && beforeSnap.exists) {
            const beforeData = beforeSnap.data();
            if (beforeData.role !== role || beforeData.organizationId !== organizationId) {
                logger.info(`Security critical change for user ${userId} (Role: ${beforeData.role}->${role}, Org: ${beforeData.organizationId}->${organizationId}). Revoking tokens.`);
                try {
                    await admin.auth().revokeRefreshTokens(userId);
                } catch (e) {
                    logger.error(`Failed to revoke tokens for ${userId}`, e);
                }
            }
        }

        // 1. Check for Pending Invitations if no organization is set
        if (!organizationId && userEmail) {
            const inviteQuery = await db.collection('invitations')
                .where('email', '==', userEmail)
                .limit(1)
                .get();

            if (!inviteQuery.empty) {
                const inviteDoc = inviteQuery.docs[0];
                const inviteData = inviteDoc.data();

                logger.info(`Found invitation for user ${userId} to org ${inviteData.organizationId}`);

                organizationId = inviteData.organizationId;
                role = inviteData.role || 'user';

                updates = {
                    organizationId: organizationId,
                    organizationName: inviteData.organizationName,
                    department: inviteData.department || '',
                    role: role,
                    onboardingCompleted: false
                };

                await inviteDoc.ref.delete();
            }
        }

        // 2. Validate/Enforce Role & Organization
        if (organizationId) {
            const orgRef = db.collection('organizations').doc(organizationId);
            const orgSnap = await orgRef.get();

            if (orgSnap.exists) {
                const orgData = orgSnap.data();
                if (orgData.ownerId === userId) {
                    logger.info(`User ${userId} is owner of org ${organizationId} - Enforcing ADMIN role`);
                    role = 'admin';
                    updates.role = 'admin';
                }
            } else {
                logger.warn(`Organization ${organizationId} not found for user ${userId}`);
            }
        } else {
            if (!userData.role) {
                updates.role = 'user';
            }
        }

        // 3. Apply Firestore Updates if needed
        if (Object.keys(updates).length > 0) {
            const diff = {};
            for (const [k, v] of Object.entries(updates)) {
                const current = userData[k];
                if (current !== v) diff[k] = v;
            }
            if (Object.keys(diff).length > 0) {
                await userRef.update(diff);
            }
        }

        // 4. Set Custom Claims
        if (organizationId) {
            await admin.auth().setCustomUserClaims(userId, {
                organizationId: organizationId,
                role: role
            });
            logger.info(`Custom claims set for user ${userId}: org=${organizationId}, role=${role}`);
        } else {
            logger.info(`User ${userId} has no organization - skipping custom claims (or clearing them)`);
            await admin.auth().setCustomUserClaims(userId, { role: 'user' });
        }

    } catch (error) {
        logger.error(`Error setting custom claims for user ${userId}:`, error);
    }
});

/**
 * Callable function to refresh user token (force claims update)
 */
exports.refreshUserToken = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User not authenticated');
    }

    // SECURITY: Rate limit token refresh to prevent abuse
    checkCallableRateLimit(request, 'auth');

    try {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User document not found');
        }

        let userData = userDoc.data();

        // SELF-HEALING: If no organizationId, check if user owns an org
        if (!userData.organizationId) {
            logger.info(`User ${uid} has no organizationId - attempting self-healing...`);
            const orgsSnap = await db.collection('organizations').where('ownerId', '==', uid).limit(1).get();

            if (!orgsSnap.empty) {
                const org = orgsSnap.docs[0];
                const orgData = org.data();

                logger.info(`Found owned organization ${org.id} for user ${uid}. Healing profile.`);

                await userRef.update({
                    organizationId: org.id,
                    organizationName: orgData.name,
                    role: 'admin',
                    onboardingCompleted: true
                });

                userData = (await userRef.get()).data();
            } else {
                logger.warn(`User ${uid} has no organizationId and no owned organization - skipping token refresh`);
                return { success: false, message: 'User has no organization - onboarding required' };
            }
        }

        let role = userData.role || 'user';

        // Ensure Admin role if owner
        if (userData.organizationId) {
            const orgRef = db.collection('organizations').doc(userData.organizationId);
            const orgSnap = await orgRef.get();
            if (orgSnap.exists && orgSnap.data()?.ownerId === uid) {
                role = 'admin';
                if (userData.role !== 'admin') {
                    await userRef.update({ role: 'admin' });
                }
            }
        }

        await admin.auth().setCustomUserClaims(uid, {
            organizationId: userData.organizationId,
            role
        });

        logger.info(`Token claims refreshed for ${uid}: org=${userData.organizationId}, role=${role}`);

        return { success: true, message: 'Token refreshed successfully', permissions: { organizationId: userData.organizationId, role } };
    } catch (error) {
        logger.error('Error refreshing token:', error);
        throw new HttpsError('internal', 'Failed to refresh token');
    }
});

/**
 * Self-healing function for users stuck in onboarding
 */
exports.healMe = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) return { success: false, error: 'Unauthenticated' };

    // SECURITY: Rate limit self-healing endpoint
    checkCallableRateLimit(request, 'auth');

    try {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) return { success: false, error: 'User not found' };
        const userData = userSnap.data();

        // If already has org, just ensure claims
        if (userData.organizationId) {
            let role = userData.role || 'user';
            const orgRef = db.collection('organizations').doc(userData.organizationId);
            const orgSnap = await orgRef.get();
            if (orgSnap.exists && orgSnap.data()?.ownerId === uid) {
                role = 'admin';
                if (userData.role !== 'admin') {
                    await userRef.update({ role: 'admin' });
                }
            }
            await admin.auth().setCustomUserClaims(uid, {
                organizationId: userData.organizationId,
                role
            });
            return { success: true, organizationId: userData.organizationId };
        }

        // Find org owned by user
        const orgsSnap = await db.collection('organizations').where('ownerId', '==', uid).limit(1).get();

        if (!orgsSnap.empty) {
            const org = orgsSnap.docs[0];
            const orgData = org.data();

            const role = 'admin';

            await userRef.update({
                organizationId: org.id,
                organizationName: orgData.name,
                onboardingCompleted: true,
                role
            });

            await admin.auth().setCustomUserClaims(uid, {
                organizationId: org.id,
                role
            });

            return { success: true, organizationId: org.id, restored: true };
        }

        return { success: false, error: 'No organization found' };
    } catch (e) {
        logger.error('HealMe failed', e);
        throw new HttpsError('internal', 'An internal error occurred');
    }
});

/**
 * Verifies if the current user is a Super Admin
 * Also auto-grants superAdmin claim to bootstrap admins if not already set
 */
exports.verifySuperAdmin = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // SECURITY: Rate limit admin verification to prevent brute force
    checkCallableRateLimit(request, 'admin');

    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const isClaimSuperAdmin = request.auth.token.superAdmin === true;

    // SECURITY: Super admin emails loaded from environment variable
    const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const isBootstrapSuperAdmin = email && SUPER_ADMIN_EMAILS.includes(email);

    // Auto-grant superAdmin claim to bootstrap admins if not already set
    if (isBootstrapSuperAdmin && !isClaimSuperAdmin) {
        try {
            const userRecord = await admin.auth().getUser(uid);
            const currentClaims = userRecord.customClaims || {};
            await admin.auth().setCustomUserClaims(uid, {
                ...currentClaims,
                superAdmin: true
            });
            logger.info(`Auto-granted superAdmin claim to bootstrap admin ${email}`);
            return { isSuperAdmin: true, claimGranted: true };
        } catch (error) {
            logger.error(`Failed to auto-grant superAdmin claim to ${email}:`, error);
            // Still return true since they're in bootstrap list
            return { isSuperAdmin: true, claimGranted: false };
        }
    }

    if (isClaimSuperAdmin || isBootstrapSuperAdmin) {
        return { isSuperAdmin: true };
    }

    return { isSuperAdmin: false };
});

/**
 * Grants Super Admin status to a user
 */
exports.grantSuperAdmin = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // SECURITY: Strict rate limit on privilege escalation
    checkCallableRateLimit(request, 'admin');

    const { targetEmail } = request.data;
    if (!targetEmail) {
        throw new HttpsError('invalid-argument', 'Target email is required.');
    }

    const callerEmail = request.auth.token.email;
    const callerIsClaimAdmin = request.auth.token.superAdmin === true;
    // SECURITY: Super admin emails loaded from environment variable
    const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const callerIsBootstrapAdmin = callerEmail && SUPER_ADMIN_EMAILS.includes(callerEmail);

    if (!callerIsClaimAdmin && !callerIsBootstrapAdmin) {
        throw new HttpsError('permission-denied', 'Only Super Admins can grant this role.');
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(targetEmail);

        const currentClaims = userRecord.customClaims || {};
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            ...currentClaims,
            superAdmin: true
        });

        logger.info(`Super Admin granted to ${targetEmail} by ${callerEmail}`);
        return { success: true, message: `Super Admin role granted to ${targetEmail}` };

    } catch (error) {
        logger.error("Error granting Super Admin:", error);
        throw new HttpsError('internal', 'Failed to grant role');
    }
});

/**
 * Switch Organization Context (Super Admin Only)
 */
exports.switchOrganization = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // SECURITY: Rate limit org switching to prevent abuse
    checkCallableRateLimit(request, 'admin');

    const { targetOrgId } = request.data;
    if (!targetOrgId) {
        throw new HttpsError('invalid-argument', 'Target Organization ID is required.');
    }

    const callerUid = request.auth.uid;
    const token = request.auth.token;

    const isSuperAdmin = token.superAdmin === true;

    if (!isSuperAdmin) {
        throw new HttpsError('permission-denied', 'Only Super Admins can switch organization context.');
    }

    try {
        const db = admin.firestore();

        const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
        if (!orgDoc.exists) {
            throw new HttpsError('not-found', 'Organization not found.');
        }
        const orgData = orgDoc.data();

        await db.collection('users').doc(callerUid).update({
            organizationId: targetOrgId,
            organizationName: orgData.name,
            role: 'admin',
            onboardingCompleted: true
        });

        const customClaims = {
            organizationId: targetOrgId,
            role: 'admin',
            superAdmin: true,
            acceptedTerms: token.acceptedTerms || false
        };

        await admin.auth().setCustomUserClaims(callerUid, customClaims);

        logger.info(`Super Admin ${callerUid} switched context to organization ${targetOrgId}`);

        return { success: true, message: `Switched to ${orgData.name}` };

    } catch (error) {
        logger.error("Error switching organization:", error);
        throw new HttpsError('internal', 'Failed to switch organization');
    }
});

/**
 * Transfer Organization Ownership
 */
exports.transferOwnership = onCall({
    memory: '256MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { organizationId, newOwnerId } = request.data;
    if (!organizationId || !newOwnerId) throw new HttpsError('invalid-argument', 'Missing parameters.');

    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(organizationId);
    const newOwnerRef = db.collection('users').doc(newOwnerId);

    try {
        await db.runTransaction(async (t) => {
            const orgDoc = await t.get(orgRef);
            if (!orgDoc.exists) throw new HttpsError('not-found', 'Organization not found.');

            const orgData = orgDoc.data();
            if (orgData.ownerId !== uid) {
                throw new HttpsError('permission-denied', 'Only the current owner can transfer ownership.');
            }

            const newOwnerDoc = await t.get(newOwnerRef);
            if (!newOwnerDoc.exists) throw new HttpsError('not-found', 'New owner user not found.');
            const newOwnerData = newOwnerDoc.data();

            if (newOwnerData.organizationId !== organizationId) {
                throw new HttpsError('failed-precondition', 'New owner must be a member of the organization.');
            }

            t.update(orgRef, { ownerId: newOwnerId });
            t.update(newOwnerRef, { role: 'admin' });
        });

        await admin.auth().setCustomUserClaims(newOwnerId, {
            organizationId: organizationId,
            role: 'admin'
        });

        await admin.auth().setCustomUserClaims(uid, {
            organizationId: organizationId,
            role: 'admin'
        });

        return { success: true, message: 'Ownership transferred successfully.' };
    } catch (error) {
        logger.error('Transfer Ownership Failed', error);
        throw new HttpsError('internal', 'An internal error occurred');
    }
});

/**
 * Approve Join Request
 */
exports.approveJoinRequest = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { requestId } = request.data;
    if (!requestId) {
        throw new HttpsError('invalid-argument', 'Missing requestId.');
    }

    const db = admin.firestore();
    const requestRef = db.collection('join_requests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
        throw new HttpsError('not-found', 'Join request not found.');
    }

    const requestData = requestSnap.data();

    const callerId = request.auth.uid;
    const callerToken = request.auth.token;

    // SECURITY: Use token claims instead of Firestore doc for role/org check
    if (callerToken.organizationId !== requestData.organizationId || callerToken.role !== 'admin') {
        const orgSnap = await db.collection('organizations').doc(requestData.organizationId).get();
        if (!orgSnap.exists || orgSnap.data().ownerId !== callerId) {
            throw new HttpsError('permission-denied', 'You must be an admin of the organization to approve requests.');
        }
    }

    if (requestData.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Request is not pending.');
    }

    try {
        const batch = db.batch();

        const userRef = db.collection('users').doc(requestData.userId);
        batch.update(userRef, {
            organizationId: requestData.organizationId,
            organizationName: requestData.organizationName,
            role: 'user',
            onboardingCompleted: true
        });

        batch.update(requestRef, {
            status: 'approved',
            approvedBy: callerId,
            approvedAt: new Date().toISOString()
        });

        await batch.commit();

        await admin.auth().setCustomUserClaims(requestData.userId, {
            organizationId: requestData.organizationId,
            role: 'user'
        });

        return { success: true };
    } catch (error) {
        logger.error('Error approving join request:', error);
        throw new HttpsError('internal', 'Failed to approve request.');
    }
});

/**
 * Reject Join Request
 */
exports.rejectJoinRequest = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { requestId } = request.data;
    if (!requestId) {
        throw new HttpsError('invalid-argument', 'Missing requestId.');
    }

    const db = admin.firestore();
    const requestRef = db.collection('join_requests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
        throw new HttpsError('not-found', 'Join request not found.');
    }

    const requestData = requestSnap.data();

    const callerId = request.auth.uid;
    const callerToken = request.auth.token;

    // SECURITY: Use token claims instead of Firestore doc for role/org check
    if (callerToken.organizationId !== requestData.organizationId || callerToken.role !== 'admin') {
        const orgSnap = await db.collection('organizations').doc(requestData.organizationId).get();
        if (!orgSnap.exists || orgSnap.data().ownerId !== callerId) {
            throw new HttpsError('permission-denied', 'You must be an admin of the organization to reject requests.');
        }
    }

    try {
        await requestRef.update({
            status: 'rejected',
            rejectedBy: callerId,
            rejectedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        logger.error('Error rejecting join request:', error);
        throw new HttpsError('internal', 'Failed to reject request.');
    }
});

/**
 * GDPR Right to Be Forgotten - Complete User Data Erasure
 * This function handles comprehensive deletion of all user personal data
 * Required for GDPR Article 17 compliance
 */
exports.deleteUserAccount = onCall({
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1',
    cors: corsOptions
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // SECURITY: Strict rate limit on account deletion (heavy operation)
    checkCallableRateLimit(request, 'heavy');

    const uid = request.auth.uid;
    const db = admin.firestore();

    logger.info(`[GDPR] Starting user data erasure for ${uid}`);

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found.');
        }

        const userData = userDoc.data();
        const organizationId = userData.organizationId;

        // Check if user is org owner - must transfer ownership first
        if (organizationId) {
            const orgRef = db.collection('organizations').doc(organizationId);
            const orgSnap = await orgRef.get();
            if (orgSnap.exists && orgSnap.data()?.ownerId === uid) {
                // Check if there are other users in the org
                const otherUsersSnap = await db.collection('users')
                    .where('organizationId', '==', organizationId)
                    .where(admin.firestore.FieldPath.documentId(), '!=', uid)
                    .limit(1)
                    .get();

                if (!otherUsersSnap.empty) {
                    throw new HttpsError('failed-precondition',
                        'Vous êtes propriétaire de l\'organisation. Transférez d\'abord la propriété à un autre administrateur avant de supprimer votre compte.');
                }
                // If sole member, org will be deleted below
            }
        }

        // 1. Delete activity logs (personal data)
        logger.info(`[GDPR] Deleting activity logs for ${uid}`);
        await deleteUserCollectionData(db, 'activity_logs', 'userId', uid);

        // 2. Delete consent records
        logger.info(`[GDPR] Deleting consent records for ${uid}`);
        await deleteUserCollectionData(db, 'consent_records', 'userId', uid);

        // 3. Delete notifications
        logger.info(`[GDPR] Deleting notifications for ${uid}`);
        await deleteUserCollectionData(db, 'notifications', 'userId', uid);

        // 4. Anonymize comments (keep content but remove author identity)
        logger.info(`[GDPR] Anonymizing comments for ${uid}`);
        await anonymizeUserComments(db, uid);

        // 5. Anonymize ownership references in organization data
        if (organizationId) {
            logger.info(`[GDPR] Anonymizing owned items for ${uid}`);
            await anonymizeOwnedItems(db, uid, organizationId);
        }

        // 5a. Delete auth_audit_logs (contains email, IP)
        logger.info(`[GDPR] Deleting auth_audit_logs for ${uid}`);
        await deleteUserCollectionData(db, 'auth_audit_logs', 'userId', uid);

        // 5b. Delete system_logs (contains userEmail, userId, IP)
        logger.info(`[GDPR] Deleting system_logs for ${uid}`);
        await deleteUserCollectionData(db, 'system_logs', 'userId', uid);

        // 5c. Anonymize audit_logs (keep records but remove identity)
        logger.info(`[GDPR] Anonymizing audit_logs for ${uid}`);
        await anonymizeCollectionData(db, 'audit_logs', 'userId', uid, {
            userEmail: 'deleted_user',
            userId: 'deleted'
        });

        // 5d. Anonymize document_audit_logs
        logger.info(`[GDPR] Anonymizing document_audit_logs for ${uid}`);
        await anonymizeCollectionData(db, 'document_audit_logs', 'userId', uid, {
            userEmail: 'deleted_user',
            userId: 'deleted'
        });

        // 5e. Delete training_assignments
        logger.info(`[GDPR] Deleting training_assignments for ${uid}`);
        await deleteUserCollectionData(db, 'training_assignments', 'userId', uid);

        // 5f. Delete questionnaire_responses
        logger.info(`[GDPR] Deleting questionnaire_responses for ${uid}`);
        await deleteUserCollectionData(db, 'questionnaire_responses', 'userId', uid);

        // 5g. Delete access_reviews (where userId or reviewerId matches)
        logger.info(`[GDPR] Deleting access_reviews for ${uid}`);
        await deleteUserCollectionData(db, 'access_reviews', 'userId', uid);
        await deleteUserCollectionData(db, 'access_reviews', 'reviewerId', uid);

        // 5h. Delete dormant_accounts
        logger.info(`[GDPR] Deleting dormant_accounts for ${uid}`);
        await deleteUserCollectionData(db, 'dormant_accounts', 'userId', uid);

        // 5i. Delete join_requests
        logger.info(`[GDPR] Deleting join_requests for ${uid}`);
        await deleteUserCollectionData(db, 'join_requests', 'userId', uid);

        // 6. Delete user's personal files from storage
        logger.info(`[GDPR] Deleting storage files for ${uid}`);
        try {
            const bucket = admin.storage().bucket();
            // Delete avatar
            const avatarFile = bucket.file(`avatars/${uid}`);
            const [avatarExists] = await avatarFile.exists();
            if (avatarExists) await avatarFile.delete();
            // Delete any personal uploads
            await bucket.deleteFiles({ prefix: `users/${uid}/` });
        } catch (storageError) {
            logger.warn(`[GDPR] Storage cleanup warning for ${uid}:`, storageError.message);
        }

        // 7. Log the erasure request (required for compliance audit trail)
        const hashedEmail = crypto.createHash('sha256').update(userData.email).digest('hex');
        await db.collection('gdpr_erasure_log').add({
            userId: uid,
            emailHash: hashedEmail, // Hashed for GDPR compliance - no plaintext PII
            organizationId: organizationId || null,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'completed'
        });

        // 8. Delete user profile document
        await userRef.delete();
        logger.info(`[GDPR] Deleted user profile for ${uid}`);

        // 9. If sole member of org, clean up organization
        if (organizationId) {
            const remainingUsersSnap = await db.collection('users')
                .where('organizationId', '==', organizationId)
                .limit(1)
                .get();

            if (remainingUsersSnap.empty) {
                logger.info(`[GDPR] User was sole member - cleaning up organization ${organizationId}`);
                // Import AccountService for org deletion
                const { AccountService: BackendAccountService } = require('../services/accountService');
                // Note: We pass uid but org ownership check should pass since user doc is deleted
                // Instead, directly delete org since user is sole member
                await db.collection('organizations').doc(organizationId).delete();
            }
        }

        // 10. Delete Firebase Auth user (this will trigger onUserDeleted as backup)
        await admin.auth().deleteUser(uid);

        logger.info(`[GDPR] User data erasure completed for ${uid}`);

        return { success: true, message: 'Toutes vos données personnelles ont été supprimées.' };

    } catch (error) {
        logger.error(`[GDPR] User data erasure failed for ${uid}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Échec de la suppression du compte');
    }
});

/**
 * Helper: Delete all documents in a collection where field matches userId
 */
async function deleteUserCollectionData(db, collectionName, fieldName, userId) {
    const batchSize = 500;
    while (true) {
        const snap = await db.collection(collectionName)
            .where(fieldName, '==', userId)
            .limit(batchSize)
            .get();

        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

/**
 * Helper: Anonymize documents in a collection where field matches userId
 * Sets the specified fields to anonymized values instead of deleting the documents
 */
async function anonymizeCollectionData(db, collectionName, fieldName, userId, anonymizedFields) {
    const batchSize = 500;
    while (true) {
        const snap = await db.collection(collectionName)
            .where(fieldName, '==', userId)
            .limit(batchSize)
            .get();

        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach(doc => batch.update(doc.ref, anonymizedFields));
        await batch.commit();
    }
}

/**
 * Helper: Anonymize comments - replace author info with generic "Utilisateur supprimé"
 */
async function anonymizeUserComments(db, userId) {
    const batchSize = 500;
    while (true) {
        const snap = await db.collectionGroup('comments')
            .where('authorId', '==', userId)
            .limit(batchSize)
            .get();

        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach(doc => {
            batch.update(doc.ref, {
                authorId: 'deleted_user',
                authorName: 'Utilisateur supprimé',
                authorEmail: null
            });
        });
        await batch.commit();
    }
}

/**
 * Helper: Anonymize ownership references in org data
 */
async function anonymizeOwnedItems(db, userId, organizationId) {
    const collectionsToAnonymize = ['assets', 'risks', 'documents', 'projects', 'incidents', 'audits'];

    for (const collName of collectionsToAnonymize) {
        const batchSize = 500;
        while (true) {
            const snap = await db.collection(collName)
                .where('organizationId', '==', organizationId)
                .where('ownerId', '==', userId)
                .limit(batchSize)
                .get();

            if (snap.empty) break;

            const batch = db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    ownerId: null,
                    owner: 'Utilisateur supprimé',
                    ownerEmail: null
                });
            });
            await batch.commit();
        }
    }

    // Anonymize controls (ownerId, createdBy)
    const controlsBatchSize = 500;
    for (const fieldName of ['ownerId', 'createdBy']) {
        while (true) {
            const snap = await db.collection('controls')
                .where('organizationId', '==', organizationId)
                .where(fieldName, '==', userId)
                .limit(controlsBatchSize)
                .get();

            if (snap.empty) break;

            const batch = db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    [fieldName]: null,
                    owner: 'Utilisateur supprimé',
                    ownerEmail: null
                });
            });
            await batch.commit();
        }
    }

    // Anonymize suppliers (createdBy)
    {
        const batchSize = 500;
        while (true) {
            const snap = await db.collection('suppliers')
                .where('organizationId', '==', organizationId)
                .where('createdBy', '==', userId)
                .limit(batchSize)
                .get();

            if (snap.empty) break;

            const batch = db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    createdBy: null,
                    owner: 'Utilisateur supprimé',
                    ownerEmail: null
                });
            });
            await batch.commit();
        }
    }

    // Anonymize processing_activities (managerId, createdBy)
    for (const fieldName of ['managerId', 'createdBy']) {
        const batchSize = 500;
        while (true) {
            const snap = await db.collection('processing_activities')
                .where('organizationId', '==', organizationId)
                .where(fieldName, '==', userId)
                .limit(batchSize)
                .get();

            if (snap.empty) break;

            const batch = db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    [fieldName]: null,
                    owner: 'Utilisateur supprimé',
                    ownerEmail: null
                });
            });
            await batch.commit();
        }
    }
}

/**
 * Trigger: Clean up user data when an Auth user is deleted
 */
exports.onUserDeleted = user().onDelete(async (userRecord) => {
    const uid = userRecord.uid;
    logger.info(`User deleted from Auth: ${uid}`);

    try {
        const db = admin.firestore();

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            await userRef.delete();
            logger.info(`Deleted user document for ${uid}`);
        } else {
            logger.info(`User document for ${uid} already deleted or not found.`);
        }

        try {
            const bucket = admin.storage().bucket();
            const file = bucket.file(`avatars/${uid}`);
            const [exists] = await file.exists();
            if (exists) {
                await file.delete();
                logger.info(`Deleted avatar for ${uid}`);
            }
        } catch (storageError) {
            logger.warn(`Error deleting avatar for ${uid}:`, storageError);
        }

    } catch (error) {
        logger.error(`Error cleaning up user ${uid}:`, error);
    }
});
