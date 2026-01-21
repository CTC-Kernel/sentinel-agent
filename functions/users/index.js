/**
 * Users Module - User Management Functions
 * Domain: User Claims, Roles, Token Refresh, Super Admin
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { user } = require("firebase-functions/v1/auth");
const admin = require("firebase-admin");
const cors = require("cors");

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
        throw new HttpsError('internal', 'Failed to refresh token: ' + error.message);
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
        throw new HttpsError('internal', e.message);
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

    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const isClaimSuperAdmin = request.auth.token.superAdmin === true;

    const SUPER_ADMIN_EMAILS = ['thibault.llopis@gmail.com', '***REMOVED***', 'admin@cyber-threat-consulting.com'];
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

    const { targetEmail } = request.data;
    if (!targetEmail) {
        throw new HttpsError('invalid-argument', 'Target email is required.');
    }

    const callerEmail = request.auth.token.email;
    const callerIsClaimAdmin = request.auth.token.superAdmin === true;
    const SUPER_ADMIN_EMAILS = ['thibault.llopis@gmail.com', '***REMOVED***', 'admin@cyber-threat-consulting.com'];
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
        throw new HttpsError('internal', 'Failed to grant role: ' + error.message);
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
        throw new HttpsError('internal', 'Failed to switch organization: ' + error.message);
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
        throw new HttpsError('internal', error.message);
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
    const callerSnap = await db.collection('users').doc(callerId).get();
    const callerData = callerSnap.data();

    if (callerData.organizationId !== requestData.organizationId || callerData.role !== 'admin') {
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
    const callerSnap = await db.collection('users').doc(callerId).get();
    const callerData = callerSnap.data();

    if (callerData.organizationId !== requestData.organizationId || callerData.role !== 'admin') {
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
