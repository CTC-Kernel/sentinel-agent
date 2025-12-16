const { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp(); // Initialize immediately to avoid "default Firebase app does not exist" errors

const sgMail = require('@sendgrid/mail');
// sgMail.setApiKey is now called with secret

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString, defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const { getMessaging } = require('firebase-admin/messaging');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Hardcoded secrets for Zero Config deployment (User requested)

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

const crypto = require("crypto");

const userSecretsKey = defineSecret("USER_SECRETS_ENCRYPTION_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const sendGridApiKey = defineSecret("SENDGRID_API_KEY");

const { generateAuditTrigger } = require('./services/auditTriggers'); // Import Audit Factory
const { BackupManager } = require('./services/backupManager');
const {
    getJoinRequestEmailHtml,
    getApprovedEmailHtml,
    getRejectedEmailHtml,
    getPasswordResetEmailHtml,
    getWelcomeEmailHtml
} = require('./services/emailTemplates');

// Email generation logic moved to ./services/emailTemplates.js

/**
 * Scheduled Backup (Runs every 24 hours)
 */
exports.scheduledBackup = onSchedule("every 24 hours", async (event) => {
    logger.info("Starting scheduled backup check (Hourly)...");

    // We can also check specific schedules in Firestore if we want per-tenant scheduling
    // For now, we'll iterate over all organizations that have backup enabled or just run for all.
    // Ideally, we query 'backup_schedules' collection.

    const db = admin.firestore();
    const now = new Date();

    try {
        const schedulesSnap = await db.collection('backup_schedules')
            .where('nextBackupAt', '<=', now.toISOString())
            .get();

        if (schedulesSnap.empty) {
            logger.info("No backups scheduled for execution.");
            return;
        }

        const promises = schedulesSnap.docs.map(async (doc) => {
            const schedule = doc.data();
            try {
                // Trigger Backup
                logger.info(`Triggering backup for Org ${schedule.organizationId}`);
                await BackupManager.createBackup(schedule.organizationId, schedule.config);

                // Update Next Run
                let nextRun = new Date();
                if (schedule.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
                else if (schedule.frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
                else if (schedule.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

                await doc.ref.update({
                    lastBackupAt: now.toISOString(),
                    nextBackupAt: nextRun.toISOString()
                });

            } catch (err) {
                logger.error(`Failed to run backup for schedule ${doc.id}`, err);
            }
        });

        await Promise.all(promises);
        logger.info(`Completed execution of ${schedulesSnap.size} scheduled backups.`);

    } catch (error) {
        logger.error("Error in scheduledBackup function", error);
    }
});

/**
 * Scheduled Notification Checks (Runs every 6 hours)
 * Checks for upcoming audits, document reviews, expired risks, etc.
 */
exports.scheduledNotificationChecks = onSchedule("every 6 hours", async (event) => {
    const { NotificationManager } = require('./services/notificationManager');
    await NotificationManager.runAutomatedChecks();
});

/**
 * Generic Push Notification Trigger
 * Listens to new docs in 'notifications' collection and sends FCM push.
 */
exports.onNotificationCreated = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const notification = snap.data();
    const userId = notification.userId;

    if (!userId) return;

    try {
        // 1. Get User's FCM Tokens
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const tokens = userData.fcmTokens;

        if (!tokens || tokens.length === 0) {
            logger.info(`No FCM tokens found for user ${userId}`);
            return;
        }

        // 2. Prepare Payload
        const payload = {
            notification: {
                title: notification.title,
                body: notification.message,
            },
            data: {
                url: notification.link || '/',
                notificationId: event.params.notificationId
            }
        };

        // 3. Send Multicast
        const response = await getMessaging().sendEachForMulticast({
            tokens: tokens,
            notification: payload.notification,
            data: payload.data
        });

        logger.info(`Sent push notification to user ${userId}: ${response.successCount} success, ${response.failureCount} failed.`);

        // Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            if (failedTokens.length > 0) {
                await userDoc.ref.update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                });
            }
        }

    } catch (error) {
        logger.error("Error sending push notification", error);
    }
});

exports.onJoinRequestCreated = onDocumentCreated("join_requests/{requestId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const request = snap.data();

    // 1. Get Org Admins
    const adminsSnap = await admin.firestore().collection('users')
        .where('organizationId', '==', request.organizationId)
        .where('role', '==', 'admin')
        .get();

    if (adminsSnap.empty) {
        logger.info(`No admins found for org ${request.organizationId}`);
        return;
    }

    // 2. Queue Email for each admin
    const batch = admin.firestore().batch();
    const link = `${appBaseUrl.value()}/team`;

    adminsSnap.forEach(adminDoc => {
        const adminUser = adminDoc.data();
        const mailRef = admin.firestore().collection('mail_queue').doc();
        batch.set(mailRef, {
            to: adminUser.email,
            message: {
                subject: `Nouvelle demande d'accès : ${request.displayName}`,
                html: getJoinRequestEmailHtml(request.displayName, request.userEmail, request.organizationName, link)
            },
            type: 'JOIN_REQUEST',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    logger.info(`Queued join request emails for ${adminsSnap.size} admins.`);
});

exports.onJoinRequestUpdated = onDocumentUpdated("join_requests/{requestId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only react to status changes
    if (before.status === after.status) return;

    const link = `${appBaseUrl.value()}/dashboard`;

    if (after.status === 'approved') {
        await admin.firestore().collection('mail_queue').add({
            to: after.userEmail,
            message: {
                subject: `Accès approuvé à ${after.organizationName}`,
                html: getApprovedEmailHtml(after.displayName, after.organizationName, link)
            },
            type: 'JOIN_REQUEST_APPROVED',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } else if (after.status === 'rejected') {
        await admin.firestore().collection('mail_queue').add({
            to: after.userEmail,
            message: {
                subject: `Demande d'accès refusée - ${after.organizationName}`,
                html: getRejectedEmailHtml(after.displayName, after.organizationName)
            },
            type: 'JOIN_REQUEST_REJECTED',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
});

// Imports moved to top

// Set custom claims when user document is created/updated
exports.setUserClaims = onDocumentWritten("users/{userId}", async (event) => {
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

                // Prepare updates from invitation
                organizationId = inviteData.organizationId;
                role = inviteData.role || 'user';

                updates = {
                    organizationId: organizationId,
                    organizationName: inviteData.organizationName,
                    department: inviteData.department || '',
                    role: role,
                    onboardingCompleted: false // Require user to confirm details
                };

                // Delete the used invitation
                await inviteDoc.ref.delete();
            }
        }

        // 2. Validate/Enforce Role & Organization
        if (organizationId) {
            // Fetch organization to check ownership
            const orgRef = db.collection('organizations').doc(organizationId);
            const orgSnap = await orgRef.get();

            if (orgSnap.exists) {
                const orgData = orgSnap.data();
                // Enforce ADMIN role if user is the owner
                if (orgData.ownerId === userId) {
                    logger.info(`User ${userId} is owner of org ${organizationId} - Enforcing ADMIN role`);
                    role = 'admin';
                    updates.role = 'admin';
                }
            } else {
                logger.warn(`Organization ${organizationId} not found for user ${userId}`);
                // Optional: Detach user from missing org?
            }
        } else {
            // No organization - ensure default role is set
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
        // Only set claims if we have an organizationId (or if we want to set 'role' globally)
        // For now, we stick to the existing pattern: Claims = OrgId + Role
        if (organizationId) {
            await admin.auth().setCustomUserClaims(userId, {
                organizationId: organizationId,
                role: role
            });
            logger.info(`Custom claims set for user ${userId}: org=${organizationId}, role=${role}`);
        } else {
            // Clear claims if no org (or set just role if your app supports org-less users)
            // For Sentinel GRC, users usually need an org.
            logger.info(`User ${userId} has no organization - skipping custom claims (or clearing them)`);
            await admin.auth().setCustomUserClaims(userId, { role: 'user' });
        }

    } catch (error) {
        logger.error(`Error setting custom claims for user ${userId}:`, error);
    }
});

// Callable function to refresh user token (force claims update)
exports.refreshUserToken = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User not authenticated');
    }

    try {
        // Get user data from Firestore
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User document not found');
        }

        const userData = userDoc.data();

        // Only update claims if user has an organizationId
        if (!userData.organizationId) {
            logger.warn(`User ${uid} has no organizationId - skipping token refresh`);
            return { success: false, message: 'User has no organization - onboarding required' };
        }

        let role = userData.role || 'user';
        const orgRef = admin.firestore().collection('organizations').doc(userData.organizationId);
        const orgSnap = await orgRef.get();
        if (orgSnap.exists && orgSnap.data()?.ownerId === uid) {
            role = 'admin';
            if (userData.role !== 'admin') {
                await admin.firestore().collection('users').doc(uid).update({ role: 'admin' });
            }
        }

        await admin.auth().setCustomUserClaims(uid, {
            organizationId: userData.organizationId,
            role
        });

        return { success: true, message: 'Token refreshed successfully' };
    } catch (error) {
        logger.error('Error refreshing token:', error);
        throw new HttpsError('internal', 'Failed to refresh token: ' + error.message);
    }
});

// Self-healing function for users stuck in onboarding
exports.healMe = onCall(async (request) => {
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

// ADMIN ONLY: Fix all existing users by adding organizationId and setting claims
// ADMIN ONLY: Fix all existing users by adding organizationId and setting claims
// DISABLED FOR SECURITY: This function allows global user modification.
// exports.fixAllUsers = onCall(async (request) => {
//     throw new HttpsError('permission-denied', 'This function is disabled for security reasons.');
// });

/**
 * Verifies if the current user is a Super Admin.
 * This is a secure backend check that validates the user's email against a hardcoded allowlist.
 * In a future iteration, this should be replaced by a custom claim 'superAdmin'.
 */
exports.verifySuperAdmin = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const email = request.auth.token.email;
    const isClaimSuperAdmin = request.auth.token.superAdmin === true;

    // Legacy/Bootstrap: Hardcoded allowlist
    const SUPER_ADMIN_EMAILS = ['thibault.llopis@gmail.com', 'contact@cyber-threat-consulting.com'];
    const isBootstrapSuperAdmin = email && SUPER_ADMIN_EMAILS.includes(email);

    if (isClaimSuperAdmin || isBootstrapSuperAdmin) {
        return { isSuperAdmin: true };
    }

    return { isSuperAdmin: false };
});

/**
 * Grants Super Admin status to a user.
 * Can only be called by an existing Super Admin.
 */
exports.grantSuperAdmin = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { targetEmail } = request.data;
    if (!targetEmail) {
        throw new HttpsError('invalid-argument', 'Target email is required.');
    }

    // 1. Verify Caller is Super Admin
    const callerEmail = request.auth.token.email;
    const callerIsClaimAdmin = request.auth.token.superAdmin === true;
    const SUPER_ADMIN_EMAILS = ['thibault.llopis@gmail.com', 'contact@cyber-threat-consulting.com'];
    const callerIsBootstrapAdmin = callerEmail && SUPER_ADMIN_EMAILS.includes(callerEmail);

    if (!callerIsClaimAdmin && !callerIsBootstrapAdmin) {
        throw new HttpsError('permission-denied', 'Only Super Admins can grant this role.');
    }

    try {
        // 2. Find target user
        const userRecord = await admin.auth().getUserByEmail(targetEmail);

        // 3. Set Custom Claim (Preserve existing claims)
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
 * Allows a Super Admin to assume the identity of a member of a target organization.
 * Updates the user's profile and custom claims.
 */
exports.switchOrganization = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { targetOrgId } = request.data;
    if (!targetOrgId) {
        throw new HttpsError('invalid-argument', 'Target Organization ID is required.');
    }

    const callerUid = request.auth.uid;
    const token = request.auth.token;

    // Verify Super Admin
    // We check the token claim (fastest) but also could verify via database for extra security if needed.
    // Given the previous steps established superAdmin claim, we trust it or the hardcoded check from verifySuperAdmin logic.
    const isSuperAdmin = token.superAdmin === true;

    if (!isSuperAdmin) {
        throw new HttpsError('permission-denied', 'Only Super Admins can switch organization context.');
    }

    try {
        const db = admin.firestore();

        // 1. Verify target organization exists
        const orgDoc = await db.collection('organizations').doc(targetOrgId).get();
        if (!orgDoc.exists) {
            throw new HttpsError('not-found', 'Organization not found.');
        }
        const orgData = orgDoc.data();

        // 2. Update User Profile in Firestore
        // We set role to 'admin' so they have full access in that org context.
        // We MUST preserve superAdmin status if stored in profile (though it's usually just a claim).
        await db.collection('users').doc(callerUid).update({
            organizationId: targetOrgId,
            organizationName: orgData.name,
            role: 'admin', // Super admin acts as admin in the target org
            onboardingCompleted: true // Bypass onboarding when switching context
        });

        // 3. Update Custom Claims
        // We must preserve the 'superAdmin' claim!
        const newClaims = {
            ...token,
            organizationId: targetOrgId,
            role: 'admin',
            superAdmin: true
        };

        // Filter out standard JWT claims (iss, aud, etc.) before setting custom claims?
        // setCustomUserClaims REPLACES all custom claims.
        // So we should construct exactly what we want.
        // 'token' contains standard claims too. Safer to build from scratch or careful merge.
        // Standard claims: aud, auth_time, email, email_verified, exp, firebase, iat, iss, sub, user_id.
        // We only want our custom ones.

        const customClaims = {
            organizationId: targetOrgId,
            role: 'admin',
            superAdmin: true,
            // Preserve acceptedTerms if it exists
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
 * Securely create a new organization and assign the creator as Admin.
 */
exports.createOrganization = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to create an organization.');
    }

    const { organizationName, industry, department, role, displayName } = request.data;
    const uid = request.auth.uid;
    const email = request.auth.token.email;

    if (!organizationName) {
        throw new HttpsError('invalid-argument', 'Organization name is required.');
    }

    const db = admin.firestore();

    try {
        // 1. Check if user already has an organization
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();

        if (userSnap.exists && userSnap.data().organizationId) {
            throw new HttpsError('already-exists', 'User already belongs to an organization.');
        }

        // 2. Generate IDs and Slugs
        const organizationId = crypto.randomUUID();
        const slug = organizationName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || organizationId;

        const batch = db.batch();

        // 3. Create Organization Document
        const orgRef = db.collection('organizations').doc(organizationId);
        batch.set(orgRef, {
            id: organizationId,
            name: organizationName,
            slug: slug,
            ownerId: uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            industry: industry || '',
            subscription: {
                planId: 'discovery',
                status: 'active',
                startDate: new Date().toISOString(),
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false
            }
        });

        // 4. Update User Profile
        batch.set(userRef, {
            uid: uid,
            email: email,
            role: 'admin', // Enforce Admin role for creator
            department: department || '',
            industry: industry || '',
            displayName: displayName || '',
            organizationName: organizationName,
            organizationId: organizationId,
            photoURL: request.auth.token.picture || null,
            lastLogin: new Date().toISOString(),
            onboardingCompleted: true,
            createdAt: new Date().toISOString(), // Ensure createdAt exists
            theme: 'light'
        }, { merge: true });

        await batch.commit();

        // 5. Set Custom Claims IMMEDIATELY
        await admin.auth().setCustomUserClaims(uid, {
            organizationId: organizationId,
            role: 'admin'
        });

        // 6. Send Welcome Email (Async)
        // We can reuse the logic from the frontend but run it here securely
        // For now, we'll let the frontend trigger the email or rely on a separate trigger if needed.
        // But to be "ultra complete", let's queue it here.

        const link = `${appBaseUrl.value()}/`;
        const htmlContent = getWelcomeEmailHtml(displayName || 'Administrateur', organizationName, link);

        await db.collection('mail_queue').add({
            to: email,
            message: {
                subject: 'Bienvenue sur Sentinel GRC',
                html: htmlContent
            },
            type: 'WELCOME_EMAIL',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, organizationId };

    } catch (error) {
        logger.error('Error creating organization:', error);
        throw new HttpsError('internal', 'Failed to create organization: ' + error.message);
    }
});

// --- STRIPE SUBSCRIPTION LOGIC ---

// Stripe initialized lazily inside functions
// const stripe = require("stripe")(stripeSecretKey.value());

// Define Plans mapping for backend
const PLANS = {
    'discovery': { monthly: null, yearly: null },
    'professional': {
        monthly: 'price_1SZ5JwDKg6Juwz5xoPsDEGHo',
        yearly: 'price_1SZ5uZDKg6Juwz5xmkEvoxww'
    },
    'enterprise': {
        monthly: 'price_1SZ5HXDKg6Juwz5x5Uml5fG3',
        yearly: 'price_1SZ5tXDKg6Juwz5xukDpGfgZ'
    }
};


const AI_LIMITS = {
    'discovery': 1000,
    'professional': 5000,
    'enterprise': 50000
};




/**
 * Helper to check and increment AI usage for an organization.
 * Enforces daily limits based on the plan.
 */
async function checkAndIncrementAiUsage(uid, organizationId) {
    if (!organizationId) return true; // Should not happen if validated upstream

    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) return false;

    const orgData = orgSnap.data();
    const planId = orgData.subscription?.planId || 'discovery';
    const limit = AI_LIMITS[planId] || 5;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageRef = orgRef.collection('usage').doc(`ai_${today}`);

    return await db.runTransaction(async (t) => {
        const usageDoc = await t.get(usageRef);
        let currentCount = 0;

        if (usageDoc.exists) {
            currentCount = usageDoc.data().count || 0;
        }

        if (currentCount >= limit) {
            throw new HttpsError('resource-exhausted', `Daily AI limit reached for ${planId} plan (${limit} requests/day). Upgrade to increase limits.`);
        }

        t.set(usageRef, {
            count: currentCount + 1,
            date: today,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return true;
    });
}

/**
 * Create a Stripe Checkout Session for a subscription.
 */
exports.createCheckoutSession = onCall({
    secrets: [stripeSecretKey]
}, async (request) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    // interval is 'month' or 'year', default to month
    const { planId, organizationId, successUrl, cancelUrl, interval = 'month' } = request.data;

    if (!organizationId || !planId) {
        throw new HttpsError("invalid-argument", "Missing organizationId or planId.");
    }

    // 1. Verify User is Admin of the Organization
    const userRef = admin.firestore().collection("users").doc(request.auth.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    const orgRef = admin.firestore().collection("organizations").doc(organizationId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
        throw new HttpsError("not-found", "Organization not found.");
    }
    const orgData = orgSnap.data();

    if (orgData.ownerId !== request.auth.uid) {
        if (userData.role !== 'admin' || userData.organizationId !== organizationId) {
            throw new HttpsError("permission-denied", "Only admins of this organization or owners can manage billing.");
        }
    }

    // Resolve Price ID based on Plan and Interval
    const planConfig = PLANS[planId];
    const priceId = interval === 'year' ? planConfig?.yearly : planConfig?.monthly;

    // Discovery plan or invalid plan handling
    if (!priceId && planId !== 'discovery') {
        // If it's not discovery and has no priceId, it's invalid or custom
        throw new HttpsError("invalid-argument", "Invalid Plan ID or Interval.");
    }

    // If it's the free plan, just update Firestore directly
    if (planId === 'discovery') {
        await orgRef.update({
            'subscription.planId': 'discovery',
            'subscription.status': 'active',
            'subscription.stripeSubscriptionId': null,
        });
        return { url: successUrl };
    }

    try {
        // 2. Get or Create Stripe Customer
        let customerId = orgData.subscription?.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: userData.email,
                metadata: {
                    organizationId: organizationId,
                    firebaseUid: request.auth.uid
                },
                name: orgData.name
            });
            customerId = customer.id;

            await orgRef.update({ 'subscription.stripeCustomerId': customerId });
        }

        // 3. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            allow_promotion_codes: true,
            subscription_data: {
                metadata: { organizationId }
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: organizationId
        });

        return { url: session.url };
    } catch (error) {
        logger.error("Stripe Checkout Error", error);
        throw new HttpsError("internal", "Unable to create checkout session.");
    }
});

/**
 * Create a Billing Portal Session for managing existing subscriptions.
 */
exports.createPortalSession = onCall({
    secrets: [stripeSecretKey]
}, async (request) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { organizationId, returnUrl } = request.data;

    if (!organizationId) {
        logger.error("No organizationId provided");
        throw new HttpsError("invalid-argument", "Organization ID is required");
    }

    logger.info(`Fetching organization: ${organizationId}`);
    const orgRef = admin.firestore().collection("organizations").doc(organizationId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
        logger.error(`Organization not found: ${organizationId}`);
        throw new HttpsError("not-found", `Organization not found: ${organizationId}`);
    }

    const orgData = orgSnap.data();

    // Check if user is admin or owner
    const userRef = admin.firestore().collection("users").doc(request.auth.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (orgData.ownerId !== request.auth.uid) {
        if (userData?.role !== 'admin' || userData?.organizationId !== organizationId) {
            throw new HttpsError("permission-denied", "Only admins of this organization or owners can access billing portal.");
        }
    }

    const customerId = orgData.subscription?.stripeCustomerId;
    if (!customerId) {
        throw new HttpsError("failed-precondition", "No billing account found.");
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        return { url: session.url };
    } catch (err) {
        logger.error("Portal Error", err);
        throw new HttpsError("internal", "Could not create portal session");
    }
});

/**
 * Stripe Webhook to sync subscription status with Firestore.
 */
// ... existing code ...

// ... existing code ...

// ... existing code ...



/**
 * Call Gemini AI for Content Generation
 */
exports.callGeminiGenerateContent = onCall({
    secrets: [geminiApiKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, modelName = "gemini-1.5-flash" } = request.data;

    try {
        const client = new GoogleGenAI({ apiKey: geminiApiKey.value() });
        const model = client.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        return { text };
    } catch (error) {
        logger.error("Gemini Generate Content Error:", error);
        throw new HttpsError('internal', 'AI Generation failed: ' + error.message);
    }
});

/**
 * Stripe Webhook to sync subscription status with Firestore.
 */
exports.stripeWebhook = onRequest({
    secrets: [stripeSecretKey, stripeWebhookSecret]
}, async (req, res) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    const signature = req.headers['stripe-signature'];
    const webhookSecret = stripeWebhookSecret.value();

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
        logger.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.created') {
        const subscription = event.data.object;
        const organizationId = subscription.metadata.organizationId;

        if (!organizationId) {
            logger.warn("Missing organizationId in subscription metadata");
            return res.json({ received: true });
        }

        const status = subscription.status;
        const priceId = subscription.items.data[0].price.id;
        let planId = 'discovery';

        // Check Professional
        if (priceId === PLANS.professional.monthly || priceId === PLANS.professional.yearly) {
            planId = 'professional';
        }
        // Check Enterprise
        if (priceId === PLANS.enterprise.monthly || priceId === PLANS.enterprise.yearly) {
            planId = 'enterprise';
        }

        await admin.firestore().collection('organizations').doc(organizationId).update({
            'subscription.status': status,
            'subscription.planId': planId,
            'subscription.stripeSubscriptionId': subscription.id,
            'subscription.currentPeriodEnd': admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
            'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end
        });

        logger.info(`Updated subscription for org ${organizationId} to ${status}`);
    }

    res.json({ received: true });
});

const mailFrom = defineString("MAIL_FROM", { default: '"Sentinel GRC" <no-reply@sentinel-grc.com>' });
const mailReplyTo = defineString("MAIL_REPLY_TO", { default: "" });

exports.processMailQueue = onDocumentCreated({
    document: "mail_queue/{docId}",
    maxInstances: 10,      // Increased to allow better scaling
    concurrency: 50,      // Allow this single instance to handle multiple requests
    retry: false,          // We handle retries manually with our scheduled function

    secrets: [sendGridApiKey]
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();

    // Prevent infinite loops or processing already handled docs
    if (data.status !== "PENDING") {
        return;
    }

    await attemptSendEmail(snap.ref, data);
});

/**
 * Helper function to attempt sending an email with retry logic.
 */
/**
 * Helper function to attempt sending an email with retry logic using SendGrid.
 */
async function attemptSendEmail(docRef, data) {
    try {
        sgMail.setApiKey(sendGridApiKey.value());

        logger.info(`Processing email for ${data.to} via SendGrid`);

        const msg = {
            from: mailFrom.value(),
            to: data.to,
            subject: data.message.subject,
            html: data.message.html,
        };

        if (mailReplyTo.value()) {
            msg.replyTo = mailReplyTo.value();
        }

        // Send email via SendGrid
        const [response] = await sgMail.send(msg);
        logger.info("Message sent via SendGrid");

        // Sanitize response for Firestore
        const safeResponse = {
            statusCode: response.statusCode,
            headers: response.headers,
            // body might be large or complex, keep it minimal
        };

        // Update Firestore document status
        return docRef.update({
            status: "SENT",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            deliveryInfo: safeResponse,
        });
    } catch (error) {
        logger.error("Error sending email:", error);

        // Determine if error is transient
        // SendGrid errors usually have a code or response.body.errors
        const responseCode = error.code;
        // 4xx are usually permanent (Bad Request, Auth), except 429 (Rate Limit)
        // 5xx are server errors (Transient)
        const isTransient = (responseCode >= 500) || (responseCode === 429);
        const currentAttempts = data.attempts || 0;
        const MAX_ATTEMPTS = 5;

        if (isTransient && currentAttempts < MAX_ATTEMPTS) {
            // Exponential backoff: 2, 4, 8, 16, 32 mins
            const retryDelayMinutes = Math.pow(2, currentAttempts + 1);
            const retryDate = new Date();
            retryDate.setMinutes(retryDate.getMinutes() + retryDelayMinutes);

            logger.info(`Transient error ${responseCode}. Scheduling retry #${currentAttempts + 1} in ${retryDelayMinutes} minutes.`);

            return docRef.update({
                status: "RETRY_PENDING",
                retryAt: admin.firestore.Timestamp.fromDate(retryDate),
                attempts: admin.firestore.FieldValue.increment(1),
                lastError: error.message
            });
        }

        return docRef.update({
            status: "ERROR",
            error: error.message,
            attempts: admin.firestore.FieldValue.increment(1),
        });
    }
}

exports.retryFailedEmails = onSchedule({
    schedule: "every 5 minutes",
    secrets: [sendGridApiKey]
}, async (event) => {
    const now = admin.firestore.Timestamp.now();

    // Query 1: Standard retries
    const retryQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'RETRY_PENDING')
        .where('retryAt', '<=', now)
        .limit(20)
        .get();

    // Query 2: Recover previously failed emails (Auto-healing for 454 errors)
    // Only retry if attempts are low to prevent infinite loops on permanent errors
    const errorQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'ERROR')
        .where('attempts', '<', 5) // Safety valve
        .limit(20)
        .get();

    // Query 3: Recover stuck PENDING emails (older than 10 mins)
    // Note: We fetch PENDING and filter in memory to avoid needing a composite index on status+createdAt
    const pendingQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'PENDING')
        .limit(50)
        .get();

    const [retrySnap, errorSnap, pendingSnap] = await Promise.all([retryQuery, errorQuery, pendingQuery]);

    // Filter pendingSnap for old items
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const stuckPendingDocs = pendingSnap.docs.filter(doc => {
        const data = doc.data();
        // Check createdAt. If missing, assume old.
        if (!data.createdAt) return true;
        const createdTime = data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
        return createdTime < tenMinutesAgo;
    });

    const docsToProcess = [...retrySnap.docs, ...errorSnap.docs, ...stuckPendingDocs];

    if (docsToProcess.length === 0) return;

    logger.info(`Retrying ${docsToProcess.length} emails (${retrySnap.size} pending retry, ${errorSnap.size} errors, ${stuckPendingDocs.length} stuck)...`);

    // Use a Map to deduplicate by ID just in case
    const uniqueDocs = new Map();
    docsToProcess.forEach(doc => uniqueDocs.set(doc.id, doc));

    const promises = Array.from(uniqueDocs.values()).map(doc => attemptSendEmail(doc.ref, doc.data()));
    await Promise.all(promises);
});

/**
 * Secure Callable Function to send emails from client
 */
exports.sendEmail = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to send emails.');
    }

    const { to, subject, html, type, metadata } = request.data;

    // Basic validation
    if (!to || !subject || !html) {
        throw new HttpsError('invalid-argument', 'Missing required email fields (to, subject, html).');
    }

    try {
        // Add to mail_queue (Admin SDK bypasses rules)
        await admin.firestore().collection('mail_queue').add({
            to,
            message: {
                subject,
                html,
            },
            type: type || 'GENERIC',
            metadata: {
                ...metadata,
                senderUid: request.auth.uid,
                senderEmail: request.auth.token.email
            },
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        logger.error('Error in sendEmail callable:', error);
        throw new HttpsError('internal', 'Failed to queue email.');
    }
});

/**
 * Secure Callable Function to log system events from client
 */
exports.logEvent = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to log events.');
    }

    const { action, resource, details, organizationId } = request.data;

    if (!action || !resource || !organizationId) {
        throw new HttpsError('invalid-argument', 'Missing required log fields.');
    }

    // SECURITY HARDENING: Verify user belongs to the organization
    // We trust the token claims which are signed by Firebase Auth
    const tokenOrgId = request.auth.token.organizationId;
    const isAdmin = request.auth.token.role === 'admin';

    // Allow if user's token matches orgId OR if user is admin (who might be acting on behalf of org)
    // Note: For strict multi-tenant, even admins should only log for their own org, 
    // but in some "super admin" scenarios (not yet fully implemented), cross-org might be valid. 
    // For now, we enforce strict token matching for standard users.

    // Exception: Onboarding. During onboarding, user might not have claims yet.
    // In that case, we might relax this check if the action is related to onboarding, 
    // OR we rely on the fact that `logAction` in frontend handles this gracefully.

    if (tokenOrgId && tokenOrgId !== organizationId) {
        logger.warn(`Security Alert: User ${request.auth.uid} attempted to log for org ${organizationId} but belongs to ${tokenOrgId}`);
        throw new HttpsError('permission-denied', 'You can only log events for your own organization.');
    }

    try {
        await admin.firestore().collection('system_logs').add({
            organizationId,
            userId: request.auth.uid,
            userEmail: request.auth.token.email,
            action,
            resource,
            details: details || '',
            timestamp: new Date().toISOString(),
            source: 'client_secure',
            ip: request.rawRequest.ip // Add IP for better audit trail
        });

        return { success: true };
    } catch (error) {
        logger.error('Error in logEvent callable:', error);
        throw new HttpsError('internal', 'Failed to log event.');
    }
});

/**
 * Secure Callable Function to schedule an email
 */
exports.scheduleEmail = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to schedule emails.');
    }

    const { to, subject, html, type, scheduledFor, metadata } = request.data;

    if (!to || !subject || !html || !scheduledFor) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    try {
        await admin.firestore().collection('scheduled_emails').add({
            to,
            message: {
                subject,
                html,
            },
            type: type || 'GENERIC',
            metadata: {
                ...metadata,
                senderUid: request.auth.uid,
                senderEmail: request.auth.token.email
            },
            status: 'SCHEDULED',
            scheduledFor: scheduledFor,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid
        });

        return { success: true };
    } catch (error) {
        logger.error('Error in scheduleEmail callable:', error);
        throw new HttpsError('internal', 'Failed to schedule email.');
    }
});

/**
 * Send Push Notification when a new notification is created in Firestore
 */
exports.onNotificationCreated = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data();
    const userId = notification.userId;

    if (!userId) {
        logger.info("No userId in notification");
        return;
    }

    try {
        // Get user's FCM tokens
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            logger.info(`User ${userId} not found`);
            return;
        }

        const userData = userDoc.data();
        const tokens = userData.fcmTokens;

        if (!tokens || tokens.length === 0) {
            logger.info(`No FCM tokens for user ${userId}`);
            return;
        }

        // Prepare the message
        const message = {
            notification: {
                title: notification.title,
                body: notification.message,
            },
            data: {
                url: notification.link || '/',
                notificationId: event.params.notificationId
            },
            tokens: tokens
        };

        // Send multicast message
        const response = await admin.messaging().sendMulticast(message);
        logger.info(`Sent ${response.successCount} notifications to user ${userId}`);

        // Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });

            if (failedTokens.length > 0) {
                await admin.firestore().collection('users').doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                });
                logger.info(`Removed ${failedTokens.length} invalid tokens`);
            }
        }
    } catch (error) {
        logger.error("Error sending push notification:", error);
    }
});

/**
 * Secure Callable Function to approve a join request
 */
exports.approveJoinRequest = onCall(async (request) => {
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

    // Verify caller is admin of the organization
    const callerId = request.auth.uid;
    const callerSnap = await db.collection('users').doc(callerId).get();
    const callerData = callerSnap.data();

    if (callerData.organizationId !== requestData.organizationId || callerData.role !== 'admin') {
        // Also allow owner
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

        // 1. Update User Profile
        const userRef = db.collection('users').doc(requestData.userId);
        batch.update(userRef, {
            organizationId: requestData.organizationId,
            organizationName: requestData.organizationName,
            role: 'user',
            onboardingCompleted: true
        });

        // 2. Update Request Status
        batch.update(requestRef, {
            status: 'approved',
            approvedBy: callerId,
            approvedAt: new Date().toISOString()
        });

        await batch.commit();

        // 3. Refresh claims for the user (optional, but good practice)
        // We can't easily refresh their token client-side, but we can set claims
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
 * Secure Callable Function to reject a join request
 */
exports.rejectJoinRequest = onCall(async (request) => {
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

    // Verify caller is admin of the organization
    const callerId = request.auth.uid;
    const callerSnap = await db.collection('users').doc(callerId).get();
    const callerData = callerSnap.data();

    if (callerData.organizationId !== requestData.organizationId || callerData.role !== 'admin') {
        // Also allow owner
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

// Export the API function
exports.api = require("./api").api;

function getUserSecretKey() {
    const raw = userSecretsKey.value();
    if (!raw) {
        throw new Error("USER_SECRETS_ENCRYPTION_KEY is missing");
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, "hex");
    }

    const utf8 = Buffer.from(raw, "utf8");
    if (utf8.length === 32) {
        return utf8;
    }

    if (utf8.length > 32) {
        return utf8.subarray(0, 32);
    }

    const padded = Buffer.alloc(32);
    utf8.copy(padded);
    return padded;
}

function encryptUserSecret(plainText) {
    const key = getUserSecretKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString("base64"),
        cipherText: encrypted.toString("base64"),
        tag: authTag.toString("base64")
    };
}

function decryptUserSecret(secretObject) {
    if (!secretObject || !secretObject.iv || !secretObject.cipherText || !secretObject.tag) {
        return null;
    }

    const key = getUserSecretKey();
    const iv = Buffer.from(secretObject.iv, "base64");
    const encrypted = Buffer.from(secretObject.cipherText, "base64");
    const authTag = Buffer.from(secretObject.tag, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
}

async function getGeminiClientForUser(uid, apiVersion) {
    const db = admin.firestore();
    const userKeysRef = db.collection('user_api_keys').doc(uid);
    const userKeysSnap = await userKeysRef.get();
    const userKeys = userKeysSnap.data() || {};

    let apiKey = null;

    // 1) Clé chiffrée stockée dans user_api_keys
    if (userKeys.gemini) {
        apiKey = decryptUserSecret(userKeys.gemini);
    }

    // 2) Migration progressive : clé en clair éventuelle dans users/{uid}.geminiApiKey
    if (!apiKey) {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            const userData = userSnap.data() || {};
            if (userData.geminiApiKey) {
                apiKey = userData.geminiApiKey;
                const updateData = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    gemini: encryptUserSecret(apiKey)
                };
                await userKeysRef.set(updateData, { merge: true });
                await userRef.set({ hasGeminiKey: true }, { merge: true });
            }
        }
    }

    // 3) Fallback : clé globale GEMINI_API_KEY (secret backend)
    if (!apiKey) {
        const globalKey = geminiApiKey.value();
        if (globalKey) {
            apiKey = globalKey.replace(/\s+/g, '');
        }
    }

    if (!apiKey) {
        throw new HttpsError('failed-precondition', 'Gemini API key not configured.');
    }

    return new GoogleGenerativeAI(apiKey);
}

/**
 * Transfer Organization Ownership
 * Callable function to safely transfer ownership to another member.
 */
exports.transferOwnership = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { organizationId, newOwnerId } = request.data;
    if (!organizationId || !newOwnerId) throw new HttpsError('invalid-argument', 'Missing parameters.');

    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(organizationId);
    const newOwnerRef = db.collection('users').doc(newOwnerId);
    const oldOwnerRef = db.collection('users').doc(uid);

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

            // Update Organization
            t.update(orgRef, { ownerId: newOwnerId });

            // Update New Owner Role to Admin (if not already)
            t.update(newOwnerRef, { role: 'admin' });

            // Update Old Owner Role (Optional: Keep as Admin or downgrade? Keeping as Admin is safer/friendlier)
            // We won't downgrade automatically to avoid locking them out of admin features they might still need.
            // They can change their role later if they want.
        });

        // Force token refresh for both users to update claims
        // We can't force it client-side for the other user, but we can update their claims here.
        await admin.auth().setCustomUserClaims(newOwnerId, {
            organizationId: organizationId,
            role: 'admin'
        });

        // Update old owner claims (keep as admin for now, but update logic might be needed if we downgraded)
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

exports.saveUserApiKeys = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    // ... existing implementation ...
}); // Note: This replacement is just to find the spot, I will insert the new function BEFORE this or after. 
// Actually, it's safer to append the new function at the end or in a logical place. 
// I'll add it after 'saveUserApiKeys' block ends, but I don't see the end of saveUserApiKeys in the view_file output. 
// Let's look for a better anchor. I'll add it before `exports.saveUserApiKeys`.

/**
 * Request a password reset email with a custom template.
 */
exports.requestPasswordReset = onCall(async (request) => {
    const email = request.data.email;
    if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required.');
    }

    try {
        // 1. Generate Password Reset Link
        const link = await admin.auth().generatePasswordResetLink(email);

        // 2. Get user details (optional, for personalization)
        let userName = 'Utilisateur';
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            userName = userRecord.displayName || 'Utilisateur';
        } catch (e) {
            // User might not exist, but for security we shouldn't reveal that.
            // However, generatePasswordResetLink throws if user doesn't exist.
            // So if we are here, user likely exists.
            logger.warn(`Could not fetch user details for ${email}`, e);
        }

        // 3. Queue Email
        await admin.firestore().collection('mail_queue').add({
            to: email,
            message: {
                subject: 'Réinitialisation de votre mot de passe - Sentinel GRC',
                html: getPasswordResetEmailHtml(userName, link)
            },
            type: 'PASSWORD_RESET',
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Password reset requested for ${email}`);
        return { success: true, message: 'Reset email sent.' };

    } catch (error) {
        logger.error('Error requesting password reset:', error);
        // Don't reveal if user exists or not for security, usually.
        // But invalid-email is thrown by generatePasswordResetLink if not found.
        if (error.code === 'auth/user-not-found') {
            // Mimic success to prevent enumeration? Or just throw standard error?
            // Standard practice often is "If email exists, email sent".
            // For now, let's return success to UI so it shows "Email sent".
            logger.warn(`Password reset requested for non-existent email: ${email}`);
            return { success: true, message: 'Reset email sent.' };
        }
        throw new HttpsError('internal', 'Internal error processing request.');
    }
});

exports.saveUserApiKeys = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const {
        geminiApiKey,
        shodanApiKey,
        hibpApiKey,
        safeBrowsingApiKey
    } = request.data || {};

    if (geminiApiKey === undefined && shodanApiKey === undefined && hibpApiKey === undefined && safeBrowsingApiKey === undefined) {
        return { success: true, updated: false };
    }

    try {
        const db = admin.firestore();
        const userKeysRef = db.collection('user_api_keys').doc(uid);
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const flags = {};

        if (geminiApiKey !== undefined) {
            if (geminiApiKey) {
                updateData.gemini = encryptUserSecret(geminiApiKey);
                flags.hasGeminiKey = true;
            } else {
                updateData.gemini = admin.firestore.FieldValue.delete();
                flags.hasGeminiKey = false;
            }
        }

        if (shodanApiKey !== undefined) {
            if (shodanApiKey) {
                updateData.shodan = encryptUserSecret(shodanApiKey);
                flags.hasShodanKey = true;
            } else {
                updateData.shodan = admin.firestore.FieldValue.delete();
                flags.hasShodanKey = false;
            }
        }

        if (hibpApiKey !== undefined) {
            if (hibpApiKey) {
                updateData.hibp = encryptUserSecret(hibpApiKey);
                flags.hasHibpKey = true;
            } else {
                updateData.hibp = admin.firestore.FieldValue.delete();
                flags.hasHibpKey = false;
            }
        }

        if (safeBrowsingApiKey !== undefined) {
            if (safeBrowsingApiKey) {
                updateData.safeBrowsing = encryptUserSecret(safeBrowsingApiKey);
                flags.hasSafeBrowsingKey = true;
            } else {
                updateData.safeBrowsing = admin.firestore.FieldValue.delete();
                flags.hasSafeBrowsingKey = false;
            }
        }

        await userKeysRef.set(updateData, { merge: true });

        if (Object.keys(flags).length > 0) {
            await db.collection('users').doc(uid).set(flags, { merge: true });
        }

        return { success: true, updated: true };
    } catch (error) {
        logger.error('saveUserApiKeys failed', error);
        throw new HttpsError('internal', 'Failed to save API keys');
    }
});

exports.scanAssetWithShodan = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const ip = request.data?.ip;
    if (!ip || typeof ip !== 'string') {
        throw new HttpsError('invalid-argument', 'IP address is required.');
    }

    try {
        const db = admin.firestore();
        const userKeysSnap = await db.collection('user_api_keys').doc(uid).get();
        const userKeys = userKeysSnap.data() || {};

        const shodanSecret = userKeys.shodan;
        const apiKey = decryptUserSecret(shodanSecret);

        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'Shodan API key not configured.');
        }

        const response = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${apiKey}`);
        if (!response.ok) {
            const text = await response.text();
            logger.error('Shodan API error', { status: response.status, body: text });
            throw new HttpsError('internal', 'Shodan API error');
        }

        const result = await response.json();
        return { result };
    } catch (error) {
        logger.error('scanAssetWithShodan failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to query Shodan');
    }
});

exports.checkBreachWithHIBP = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const email = request.data?.email;
    if (!email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'Email is required.');
    }

    try {
        const db = admin.firestore();
        const userKeysSnap = await db.collection('user_api_keys').doc(uid).get();
        const userKeys = userKeysSnap.data() || {};

        const hibpSecret = userKeys.hibp;
        const apiKey = decryptUserSecret(hibpSecret);

        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'HIBP API key not configured.');
        }

        const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
            headers: {
                'hibp-api-key': apiKey,
                'user-agent': 'Sentinel-GRC'
            }
        });

        if (response.status === 404) {
            return { breaches: [] };
        }

        if (!response.ok) {
            const text = await response.text();
            logger.error('HIBP API error', { status: response.status, body: text });
            throw new HttpsError('internal', 'HIBP API error');
        }

        const breaches = await response.json();
        return { breaches };
    } catch (error) {
        logger.error('checkBreachWithHIBP failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to query HIBP');
    }
});

exports.checkUrlReputationWithSafeBrowsing = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const url = request.data?.url;
    if (!url || typeof url !== 'string') {
        throw new HttpsError('invalid-argument', 'URL is required.');
    }

    try {
        const db = admin.firestore();
        const userKeysSnap = await db.collection('user_api_keys').doc(uid).get();
        const userKeys = userKeysSnap.data() || {};

        const safeSecret = userKeys.safeBrowsing;
        const apiKey = decryptUserSecret(safeSecret);

        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'Safe Browsing API key not configured.');
        }

        const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: { clientId: 'sentinel-grc', clientVersion: '1.0.0' },
                threatInfo: {
                    threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                    platformTypes: ['ANY_PLATFORM'],
                    threatEntryTypes: ['URL'],
                    threatEntries: [{ url }]
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            logger.error('Safe Browsing API error', { status: response.status, body: text });
            throw new HttpsError('internal', 'Safe Browsing API error');
        }

        const body = await response.json();
        const matches = Array.isArray(body.matches) ? body.matches : [];
        const safe = matches.length === 0;
        const threatType = safe ? undefined : matches[0].threatType;

        return { result: { safe, threatType } };
    } catch (error) {
        logger.error('checkUrlReputationWithSafeBrowsing failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to query Safe Browsing');
    }
});

exports.callGeminiGenerateContent = onCall({
    secrets: [userSecretsKey, geminiApiKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const prompt = request.data?.prompt;
    const modelName = request.data?.modelName || "gemini-3-pro-preview";

    if (!prompt || typeof prompt !== 'string') {
        throw new HttpsError('invalid-argument', 'Prompt is required.');
    }

    try {
        // Check and increment usage
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (userData?.organizationId) {
            await checkAndIncrementAiUsage(uid, userData.organizationId);
        }

        const apiVersion = modelName.includes('gemini-3') ? 'v1alpha' : undefined;
        const genAI = await getGeminiClientForUser(uid, apiVersion);

        const runGenerate = async (name) => {
            let config = {};
            if (name.includes("gemini-3")) {
                config.thinkingConfig = { thinkingLevel: "high" };
            }

            const model = genAI.getGenerativeModel({ model: name });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        };

        try {
            const text = await runGenerate(modelName);
            return { text };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('Primary Gemini model failed in callGeminiGenerateContent', { error: message });

            if (message.includes('404') || message.includes('not found') || message.includes('429') || message.includes('Too Many Requests')) {
                const fallbackModels = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];
                for (const name of fallbackModels) {
                    try {
                        const text = await runGenerate(name);
                        return { text, model: name };
                    } catch (fallbackError) {
                        logger.warn('Fallback Gemini model failed in callGeminiGenerateContent', {
                            model: name,
                            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                        });
                        continue;
                    }
                }
            }

            throw error;
        }
    } catch (error) {
        logger.error('callGeminiGenerateContent failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to call Gemini generateContent');
    }
});

exports.callGeminiChat = onCall({
    secrets: [userSecretsKey, geminiApiKey]
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const systemPrompt = request.data?.systemPrompt;
    const message = request.data?.message;
    const modelName = request.data?.modelName || "gemini-1.5-pro";

    if (!systemPrompt || typeof systemPrompt !== 'string' || !message || typeof message !== 'string') {
        throw new HttpsError('invalid-argument', 'systemPrompt and message are required.');
    }

    // Helper for delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // Check and increment usage (Throws resource-exhausted if daily limit met)
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (userData?.organizationId) {
            await checkAndIncrementAiUsage(uid, userData.organizationId);
        }

        const apiVersion = (modelName.includes('gemini-3') || modelName.includes('gemini-2.0')) ? 'v1alpha' : undefined;
        // Ensure this doesn't throw 500
        const genAI = await getGeminiClientForUser(uid, apiVersion);

        const runChat = async (name) => {
            // Determine required API version for this model
            const apiVersion = (name.includes('gemini-3') || name.includes('gemini-2.0')) ? 'v1alpha' : undefined;

            // Re-get client to ensure we have the right version/config
            // (getGeminiClientForUser handles efficient client creation)
            const client = await getGeminiClientForUser(uid, apiVersion);

            let config = {};
            // Enable thinking for newer models if supported/desired
            if (name.includes("gemini-3") || name.includes("gemini-2.0")) {
                // simple-2-0 doesn't always support thinking, but let's keep it safe or empty
                // config.thinkingConfig = { thinkingLevel: "high" }; 
            }

            const contents = [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Bien reçu. Je suis Sentinel AI, prêt à vous assister sur tous les sujets GRC." }] },
                // History is managed by adding previous messages to context if needed.
                // Current implementation favors single-turn with persistent system prompt.
                { role: "user", parts: [{ text: message }] }
            ];

            const model = client.getGenerativeModel({ model: name });
            const result = await model.generateContent({ contents });
            const response = await result.response;
            return response.text();
        };

        try {
            const text = await runChat(modelName);
            return { text };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.warn(`Primary Gemini chat model (${modelName}) failed: ${errMsg}`);

            // Widen retry conditions: Include common network/quota keywords
            const isTransient = errMsg.includes('429') ||
                errMsg.includes('Too Many Requests') ||
                errMsg.includes('resource exhausted') ||
                errMsg.includes('503') ||
                errMsg.includes('500') ||
                errMsg.includes('404') ||
                errMsg.includes('Not Found') ||
                errMsg.includes('fetch failed') ||
                errMsg.includes('network') ||
                errMsg.includes('quota');

            if (isTransient) {
                // FALLBACK STRATEGY: Try different models
                // We prioritize flash-exp (fast/new) then pro (smarter/slower) then flash again
                const fallbackModels = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];
                const backoffDelays = [1000, 2000, 4000];

                for (let i = 0; i < fallbackModels.length; i++) {
                    const fallbackModel = fallbackModels[i];
                    const waitTime = backoffDelays[i] || 3000;

                    // Don't retry the exact same failing model immediately if it's the first retry
                    if (fallbackModel === modelName && i === 0) continue;

                    logger.info(`Retrying with ${fallbackModel} after ${waitTime}ms... (Attempt ${i + 1})`);
                    await delay(waitTime);

                    try {
                        const text = await runChat(fallbackModel);
                        return { text, model: `${fallbackModel} (fallback)` };
                    } catch (retryError) {
                        const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
                        logger.warn(`Retry attempt ${i + 1} (${fallbackModel}) failed: ${retryMsg}`);
                        // Continue to next fallback model
                    }
                }

                // If all retries fail, return explicit Resource Exhausted error
                throw new HttpsError('resource-exhausted', 'Le service IA est actuellement surchargé. Veuillez réessayer plus tard.');
            }

            // Propagate original error message if not transient (e.g. 400 Bad Request)
            // But verify it's not a generic Error which maps to 500
            // We'll wrap it in HttpsError('internal') but with the MESSAGE so frontend sees it.
            // If it's already HttpsError from checkAndIncrementAiUsage, it will be caught by outer block.
            throw error;
        }
    } catch (error) {
        logger.error('callGeminiChat failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        // Return correct error message to help debugging
        throw new HttpsError('internal', `Erreur IA: ${error.message || 'Erreur inconnue'}`);
    }
});

// --- SCHEDULED NOTIFICATION CHECKS ---

// Email Templates for Scheduled Checks
const Templates = {
    getAuditReminderTemplate: (auditName, auditorName, scheduledDate, link) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
              Sentinel <span style="color: #2563eb;">GRC</span>
            </div>
          </div>
          <div style="padding: 32px 0;">
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">📋 Rappel d'Audit Planifié</h2>
            <p>Bonjour ${auditorName},</p>
            <p>Un audit est planifié dans les prochains jours et nécessite votre attention.</p>
            
            <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e40af;">${auditName}</h3>
              <p style="margin: 0; font-size: 14px; color: #1e3a8a;">Date prévue : <strong>${new Date(scheduledDate).toLocaleDateString()}</strong></p>
            </div>
    
            <p>Assurez-vous d'avoir préparé tous les documents et preuves nécessaires pour cet audit.</p>
    
            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Voir l'audit</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.</p>
            <p>Cet email est une notification automatique liée à votre conformité ISO 27001.</p>
          </div>
        </div>
    `,
    getDocumentReviewTemplate: (docTitle, ownerName, dueDate, link) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
              Sentinel <span style="color: #2563eb;">GRC</span>
            </div>
          </div>
          <div style="padding: 32px 0;">
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Révision Documentaire Requise</h2>
            <p>Bonjour ${ownerName},</p>
            <p>Le document <strong>"${docTitle}"</strong> arrive à échéance de révision.</p>
            <p>Conformément à la norme ISO 27001, les politiques et procédures doivent être revues périodiquement pour assurer leur pertinence.</p>
            
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date d'échéance</span>
              <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(dueDate).toLocaleDateString()}</div>
            </div>
    
            <p>Assurez-vous d'avoir préparé tous les documents et preuves nécessaires pour cette révision.</p>
    
            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Accéder au document</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.</p>
            <p>Cet email est une notification automatique liée à votre conformité ISO 27001.</p>
          </div>
        </div>
    `,
    getMaintenanceTemplate: (assetName, maintenanceDate, ownerName, link) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
              Sentinel <span style="color: #2563eb;">GRC</span>
            </div>
          </div>
          <div style="padding: 32px 0;">
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">🛠️ Maintenance Planifiée</h2>
            <p>Bonjour ${ownerName},</p>
            <p>Une maintenance est prévue prochainement pour l'actif <strong>${assetName}</strong>.</p>
            
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date de maintenance</span>
              <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(maintenanceDate).toLocaleDateString()}</div>
            </div>
    
            <p>Veuillez vous assurer que tout est prêt pour cette intervention.</p>
    
            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Voir l'actif</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.</p>
            <p>Cet email est une notification automatique liée à votre conformité ISO 27001.</p>
          </div>
        </div>
    `,
    getRiskTreatmentDueTemplate: (riskTitle, dueDate, responsiblePerson, link) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
              Sentinel <span style="color: #2563eb;">GRC</span>
            </div>
          </div>
          <div style="padding: 32px 0;">
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
              <h2 style="font-size: 18px; color: #d97706; margin: 0; font-weight: 700;">⏰ Échéance de Traitement de Risque</h2>
            </div>
            
            <p>Bonjour ${responsiblePerson},</p>
            <p>Le plan de traitement du risque suivant arrive à échéance :</p>
            
            <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 24px 0;">
              <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${riskTitle}</h3>
              <p style="margin: 8px 0 0 0; color: #64748b;">Date limite : <strong style="color: #d97706;">${new Date(dueDate).toLocaleDateString()}</strong></p>
            </div>
    
            <p>Veuillez mettre à jour le statut du traitement ou demander une extension si nécessaire.</p>
    
            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Gérer le risque</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.</p>
            <p>Cet email est une notification automatique liée à votre conformité ISO 27001.</p>
          </div>
        </div>
    `,
    getRiskReviewTemplate: (riskTitle, lastReviewDate, ownerName, link) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
              Sentinel <span style="color: #2563eb;">GRC</span>
            </div>
          </div>
          <div style="padding: 32px 0;">
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">🔍 Revue de Risque en Retard</h2>
            <p>Bonjour ${ownerName},</p>
            <p>Le risque suivant nécessite une revue périodique conformément à la méthode ISO 27005 :</p>
            
            <div style="border-left: 4px solid #f97316; padding-left: 16px; margin: 24px 0;">
              <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${riskTitle}</h3>
              <p style="margin: 8px 0 0 0; color: #64748b;">Dernière revue enregistrée : <strong style="color: #b45309;">${lastReviewDate ? new Date(lastReviewDate).toLocaleDateString() : 'Aucune revue enregistrée'}</strong></p>
            </div>
    
            <p>Pour respecter les bonnes pratiques de gestion des risques (ISO 27005), il est recommandé de revoir régulièrement la probabilité, l'impact et le plan de traitement associés.</p>
    
            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #f97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Revoir le risque</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.</p>
            <p>Cet email est une notification automatique liée à votre conformité ISO 27001.</p>
          </div>
        </div>
    `
};

exports.checkScheduledNotifications = onSchedule("every 24 hours", async (event) => {
    logger.info("Starting scheduled notification checks...");
    const db = admin.firestore();

    // Get all organizations
    const orgsSnapshot = await db.collection('users').get();
    const organizationIds = new Set();
    orgsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.organizationId) {
            organizationIds.add(data.organizationId);
        }
    });

    logger.info('Running checks for ' + organizationIds.size + ' organizations');

    for (const orgId of organizationIds) {
        await Promise.allSettled([
            checkUpcomingAudits(db, orgId),
            checkOverdueDocuments(db, orgId),
            checkUpcomingMaintenance(db, orgId),
            checkCriticalRisks(db, orgId),
            checkExpiringContracts(db, orgId),
            checkOverdueRisks(db, orgId)
        ]);
    }

    logger.info("Scheduled checks completed.");
});

// Helper Checks
async function checkUpcomingAudits(db, organizationId) {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const auditsSnap = await db.collection('audits')
        .where('organizationId', '==', organizationId)
        .where('status', 'in', ['Planifié', 'En cours'])
        .get();

    for (const doc of auditsSnap.docs) {
        const audit = doc.data();
        const auditDate = new Date(audit.dateScheduled);

        if (auditDate <= sevenDaysFromNow && auditDate > new Date()) {
            const daysUntil = Math.ceil((auditDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            // Find auditor
            const auditorSnap = await db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('displayName', '==', audit.auditor)
                .limit(1)
                .get();

            if (!auditorSnap.empty) {
                const auditorDoc = auditorSnap.docs[0];
                const auditorId = auditorDoc.id;
                const auditorData = auditorDoc.data();

                if (await shouldNotify(db, auditorId, '/audits', audit.name)) {
                    await sendNotificationAndEmail(db, {
                        organizationId,
                        userId: auditorId,
                        type: daysUntil <= 3 ? 'danger' : 'warning',
                        title: 'Audit à venir: ' + audit.name,
                        message: 'L\'audit est prévu dans ' + daysUntil + ' jour(s) - ' + new Date(audit.dateScheduled).toLocaleDateString(),
                        link: '/audits',
                        email: auditorData.email,
                        emailSubject: 'Rappel Audit : ' + audit.name,
                        emailHtml: Templates.getAuditReminderTemplate(
                            audit.name,
                            auditorData.displayName || 'Auditeur',
                            audit.dateScheduled,
                            appBaseUrl.value() + '/audits'
                        ),
                        emailType: 'AUDIT_REMINDER'
                    });
                }
            }
        }
    }
}

async function checkOverdueDocuments(db, organizationId) {
    const docsSnap = await db.collection('documents')
        .where('organizationId', '==', organizationId)
        .get();

    for (const doc of docsSnap.docs) {
        const document = doc.data();
        if (document.nextReviewDate && new Date(document.nextReviewDate) < new Date()) {
            // Find owner
            const ownerSnap = await db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('email', '==', document.owner)
                .limit(1)
                .get();

            if (!ownerSnap.empty) {
                const ownerDoc = ownerSnap.docs[0];
                const ownerId = ownerDoc.id;
                const ownerData = ownerDoc.data();

                if (await shouldNotify(db, ownerId, '/documents', document.title)) {
                    await sendNotificationAndEmail(db, {
                        organizationId,
                        userId: ownerId,
                        type: 'warning',
                        title: 'Document à réviser: ' + document.title,
                        message: 'La date de révision est dépassée depuis le ' + new Date(document.nextReviewDate).toLocaleDateString(),
                        link: '/documents',
                        email: ownerData.email,
                        emailSubject: 'Révision requise: ' + document.title,
                        emailHtml: Templates.getDocumentReviewTemplate(
                            document.title,
                            ownerData.displayName || 'Propriétaire',
                            document.nextReviewDate,
                            appBaseUrl.value() + '/documents'
                        ),
                        emailType: 'DOCUMENT_REVIEW'
                    });
                }
            }
        }
    }
}

async function checkUpcomingMaintenance(db, organizationId) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const assetsSnap = await db.collection('assets')
        .where('organizationId', '==', organizationId)
        .get();

    for (const doc of assetsSnap.docs) {
        const asset = doc.data();
        if (asset.nextMaintenance) {
            const maintenanceDate = new Date(asset.nextMaintenance);
            if (maintenanceDate <= thirtyDaysFromNow && maintenanceDate > new Date()) {
                const daysUntil = Math.ceil((maintenanceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                // Find owner
                const ownerSnap = await db.collection('users')
                    .where('organizationId', '==', organizationId)
                    .where('displayName', '==', asset.owner)
                    .limit(1)
                    .get();

                if (!ownerSnap.empty) {
                    const ownerDoc = ownerSnap.docs[0];
                    const ownerId = ownerDoc.id;
                    const ownerData = ownerDoc.data();

                    if (await shouldNotify(db, ownerId, '/assets', asset.name)) {
                        await sendNotificationAndEmail(db, {
                            organizationId,
                            userId: ownerId,
                            type: daysUntil <= 7 ? 'warning' : 'info',
                            title: 'Maintenance à prévoir : ' + asset.name,
                            message: 'Maintenance prévue dans ' + daysUntil + ' jour(s)',
                            link: '/assets',
                            email: ownerData.email,
                            emailSubject: 'Maintenance : ' + asset.name,
                            emailHtml: Templates.getMaintenanceTemplate(
                                asset.name,
                                asset.nextMaintenance,
                                ownerData.displayName || 'Propriétaire',
                                appBaseUrl.value() + '/assets'
                            ),
                            emailType: 'MAINTENANCE_ALERT'
                        });
                    }
                }
            }
        }
    }
}

async function checkOverdueRisks(db, organizationId) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const risksSnap = await db.collection('risks')
        .where('organizationId', '==', organizationId)
        .get();

    const overdueRisks = [];
    risksSnap.forEach(doc => {
        const risk = doc.data();
        if (risk.status && ['Ouvert', 'En cours'].includes(risk.status)) {
            if (!risk.lastReviewDate || new Date(risk.lastReviewDate) < oneYearAgo) {
                overdueRisks.push({ id: doc.id, ...risk });
            }
        }
    });

    for (const risk of overdueRisks) {
        let targetUserId = null;
        let targetUserData = null;

        // 1) Prefer explicit ownerId
        if (risk.ownerId) {
            const ownerSnap = await db.collection('users').doc(risk.ownerId).get();
            if (ownerSnap.exists) {
                targetUserId = ownerSnap.id;
                targetUserData = ownerSnap.data();
            }
        }

        // 2) Fallback on displayName match if owner is stored as a name
        if (!targetUserId && risk.owner) {
            const ownerByNameSnap = await db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('displayName', '==', risk.owner)
                .limit(1)
                .get();
            if (!ownerByNameSnap.empty) {
                const ownerDoc = ownerByNameSnap.docs[0];
                targetUserId = ownerDoc.id;
                targetUserData = ownerDoc.data();
            }
        }

        // 3) Fallback on admins if no owner identified
        let fallbackAdmins = [];
        if (!targetUserId) {
            const adminsSnap = await db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('role', '==', 'admin')
                .get();
            fallbackAdmins = adminsSnap.docs.map(d => ({ id: d.id, data: d.data() }));
        }

        const recipients = targetUserId && targetUserData
            ? [{ id: targetUserId, data: targetUserData }]
            : fallbackAdmins;

        for (const recipient of recipients) {
            const userId = recipient.id;
            const userData = recipient.data;

            if (!userData || !userData.email) continue;

            if (await shouldNotify(db, userId, '/risks', risk.threat)) {
                await sendNotificationAndEmail(db, {
                    organizationId,
                    userId,
                    type: 'warning',
                    title: 'Revue de risque en retard : ' + risk.threat,
                    message: 'La dernière revue du risque est dépassée ou non enregistrée.',
                    link: '/risks',
                    email: userData.email,
                    emailSubject: 'Revue Risque en Retard : ' + risk.threat,
                    emailHtml: Templates.getRiskReviewTemplate(
                        risk.threat,
                        risk.lastReviewDate || null,
                        userData.displayName || 'Responsable du risque',
                        appBaseUrl.value() + '/risks'
                    ),
                    emailType: 'RISK_REVIEW_DUE'
                });
            }
        }
    }
}

async function checkCriticalRisks(db, organizationId) {
    const risksSnap = await db.collection('risks')
        .where('organizationId', '==', organizationId)
        .get();

    const criticalRisksWithoutMitigation = [];
    risksSnap.forEach(doc => {
        const risk = doc.data();
        if (risk.score >= 15 && (!risk.mitigationControlIds || risk.mitigationControlIds.length === 0)) {
            criticalRisksWithoutMitigation.push(risk);
        }
    });

    if (criticalRisksWithoutMitigation.length > 0) {
        // Notify all admins
        const adminsSnap = await db.collection('users')
            .where('organizationId', '==', organizationId)
            .where('role', '==', 'admin')
            .get();

        for (const adminDoc of adminsSnap.docs) {
            const adminId = adminDoc.id;
            const adminData = adminDoc.data();

            if (await shouldNotify(db, adminId, '/risks', 'risque(s) critique(s)')) {
                await sendNotificationAndEmail(db, {
                    organizationId,
                    userId: adminId,
                    type: 'danger',
                    title: criticalRisksWithoutMitigation.length + ' risque(s) critique(s) sans atténuation',
                    message: 'Des risques critiques n\'ont pas de contrôles d\'atténuation associés',
                    link: '/risks',
                    email: adminData.email,
                    emailSubject: 'Action requise : ' + criticalRisksWithoutMitigation.length + ' Risques Critiques',
                    emailHtml: Templates.getRiskTreatmentDueTemplate(
                        'Risques Critiques non traités',
                        new Date().toISOString(),
                        adminData.displayName || 'Admin',
                        appBaseUrl.value() + '/risks'
                    ),
                    emailType: 'RISK_TREATMENT_DUE'
                });
            }
        }
    }
}

async function checkExpiringContracts(db, organizationId) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const suppliersSnap = await db.collection('suppliers')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'Actif')
        .get();

    for (const doc of suppliersSnap.docs) {
        const supplier = doc.data();
        if (supplier.contractEnd) {
            const endDate = new Date(supplier.contractEnd);
            if (endDate <= thirtyDaysFromNow && endDate > new Date()) {
                const daysUntil = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                if (supplier.ownerId) {
                    const ownerSnap = await db.collection('users').doc(supplier.ownerId).get();
                    if (ownerSnap.exists) {
                        const ownerData = ownerSnap.data();

                        if (await shouldNotify(db, supplier.ownerId, '/suppliers', supplier.name)) {
                            await sendNotificationAndEmail(db, {
                                organizationId,
                                userId: supplier.ownerId,
                                type: 'warning',
                                title: 'Fin de contrat : ' + supplier.name,
                                message: 'Le contrat expire dans ' + daysUntil + ' jour(s)',
                                link: '/suppliers',
                                email: ownerData.email,
                                emailSubject: 'Expiration Contrat : ' + supplier.name,
                                emailHtml: Templates.getSupplierReviewTemplate(
                                    supplier.name,
                                    supplier.criticality || 'Moyenne',
                                    supplier.contractEnd,
                                    appBaseUrl.value() + '/suppliers'
                                ),
                                emailType: 'SUPPLIER_REVIEW'
                            });
                        }
                    }
                }
            }
        }
    }
}

// Utility to check if notification was already sent in last 24h
async function shouldNotify(db, userId, link, contentMatch) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const notifsSnap = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('link', '==', link)
        .where('createdAt', '>=', yesterday)
        .get();

    let alreadyNotified = false;
    notifsSnap.forEach(doc => {
        const data = doc.data();
        if (data.title.includes(contentMatch) || data.message.includes(contentMatch)) {
            alreadyNotified = true;
        }
    });

    return !alreadyNotified;
}

async function sendNotificationAndEmail(db, params) {
    // 1. Create In-App Notification
    await db.collection('notifications').add({
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        read: false,
        createdAt: new Date().toISOString()
    });

    // 2. Queue Email
    if (params.email) {
        await db.collection('mail_queue').add({
            to: params.email,
            message: {
                subject: params.emailSubject,
                html: params.emailHtml
            },
            type: params.emailType,
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

exports.migrateUserKeys = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    const batches = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    let totalMigrated = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const updates = {};
        if (data.geminiApiKey) updates.geminiApiKey = admin.firestore.FieldValue.delete();
        if (data.shodanApiKey) updates.shodanApiKey = admin.firestore.FieldValue.delete();
        if (data.hibpApiKey) updates.hibpApiKey = admin.firestore.FieldValue.delete();
        if (data.safeBrowsingApiKey) updates.safeBrowsingApiKey = admin.firestore.FieldValue.delete();

        if (Object.keys(updates).length > 0) {
            currentBatch.update(doc.ref, updates);
            operationCount++;
            totalMigrated++;
            if (operationCount === 499) {
                batches.push(currentBatch.commit());
                currentBatch = db.batch();
                operationCount = 0;
            }
        }
    });

    if (operationCount > 0) {
        batches.push(currentBatch.commit());
    }

    await Promise.all(batches);

    return { success: true, migratedCount: totalMigrated };
});

exports.submitKioskAsset = onCall(async (request) => {
    // Note: Kiosk is unauthenticated by design (public terminal), so we don't check request.auth
    // In a real production environment, we should use App Check to verify the request comes from our app.

    const data = request.data;
    const { orgId, name, serialNumber, hardwareType, hardware, notes, userId, projectId } = data;

    if (!orgId || !name || !serialNumber) {
        throw new HttpsError('invalid-argument', 'Missing required fields (orgId, name, serialNumber).');
    }

    // Verify organization exists
    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
        throw new HttpsError('not-found', 'Organization not found.');
    }

    // Prepare asset data
    const assetData = {
        name,
        serialNumber,
        type: 'Matériel',
        hardwareType: hardwareType || 'Laptop',
        organizationId: orgId,
        hardware: hardware || {},
        status: 'En stock',
        criticality: 'Moyenne',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'Kiosk Intake',
        notes: notes || '',
        ownerId: userId || '',
        relatedProjectIds: projectId ? [projectId] : []
    };

    // If a user is selected, try to get their display name
    if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            assetData.owner = userDoc.data().displayName || '';
        }
    }

    try {
        const docRef = await db.collection('assets').add(assetData);
        return { success: true, assetId: docRef.id };
    } catch (error) {
        logger.error("Error creating kiosk asset", error);
        throw new HttpsError('internal', 'Failed to create asset.');
    }
});

/**
 * Trigger: Clean up user data when an Auth user is deleted.
 * This ensures that even if the client-side cleanup fails, the user document and avatar are removed.
 */
exports.onUserDeleted = require("firebase-functions/v1").auth.user().onDelete(async (user) => {
    const uid = user.uid;
    logger.info(`User deleted from Auth: ${uid}`);

    try {
        const db = admin.firestore();

        // 1. Delete user profile document
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            await userRef.delete();
            logger.info(`Deleted user document for ${uid}`);
        } else {
            logger.info(`User document for ${uid} already deleted or not found.`);
        }

        // 2. Delete avatar from storage
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
            // Continue cleanup even if storage fails
        }

        // 3. Optional: Remove from organization if they were a member?
        // The client-side logic handles org deletion if they were the last member.
        // Here we could add a check for orphaned organizations, but that might be expensive.
        // For now, we assume client-side logic or manual admin cleanup for edge cases.

    } catch (error) {
        logger.error(`Error cleaning up user ${uid}:`, error);
    }
});

// --- INTEGRATIONS ---

/**
 * Encrypts data using the USER_SECRETS_ENCRYPTION_KEY.
 */
function encryptData(text, secretKey) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts data using the USER_SECRETS_ENCRYPTION_KEY.
 */
function decryptData(text, secretKey) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

exports.connectIntegration = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { providerId, credentials, organizationId } = request.data;

    if (!organizationId || !providerId || !credentials) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    const allowedProviders = ['aws', 'azure', 'gcp', 'github', 'website_check', 'shodan', 'hibp'];
    if (!allowedProviders.includes(providerId)) {
        throw new HttpsError('invalid-argument', 'Unsupported providerId');
    }

    // Verify permissions (Admin or Owner)
    try {
        const userRef = admin.firestore().collection("users").doc(request.auth.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData) {
            throw new HttpsError('failed-precondition', 'User profile is missing.');
        }

        if (userData.organizationId !== organizationId || userData.role !== 'admin') {
            // Also check if owner of org
            const orgRef = admin.firestore().collection("organizations").doc(organizationId);
            const orgSnap = await orgRef.get();
            if (!orgSnap.exists || orgSnap.data().ownerId !== request.auth.uid) {
                throw new HttpsError('permission-denied', 'Only admins can manage integrations.');
            }
        }

        const encryptedCredentials = encryptData(JSON.stringify(credentials), userSecretsKey.value());

        await admin.firestore().collection('organizations').doc(organizationId)
            .collection('integrations').doc(providerId).set({
                id: providerId,
                status: 'connected',
                connectedAt: new Date().toISOString(),
                connectedBy: request.auth.uid,
                encryptedCredentials // Store encrypted
            }, { merge: true });

        return { success: true };
    } catch (error) {
        logger.error('Error connecting integration:', error);
        throw new HttpsError('internal', 'Failed to connect integration: ' + error.message);
    }
});

exports.fetchEvidence = onCall({
    secrets: [userSecretsKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { providerId, resourceId, organizationId } = request.data;

    if (request.data && request.data.isDemoMode) {
        throw new HttpsError('failed-precondition', 'Demo mode is disabled in production.');
    }

    if (!organizationId || !providerId || !resourceId) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    try {
        // Get credentials
        const doc = await admin.firestore().collection('organizations').doc(organizationId)
            .collection('integrations').doc(providerId).get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Integration not found.');
        }

        const data = doc.data();
        let apiKey = null;
        if (data.encryptedCredentials) {
            try {
                const creds = JSON.parse(decryptData(data.encryptedCredentials, userSecretsKey.value()));
                apiKey = creds.apiKey;
            } catch (e) {
                logger.warn('Failed to decrypt credentials', e);
            }
        }

        // --- REAL IMPLEMENTATION ---

        if (providerId === 'shodan') {
            if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key for Shodan');

            // resourceId should be an IP
            const response = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(resourceId)}?key=${apiKey}`);
            if (!response.ok) {
                if (response.status === 404) {
                    return { status: 'pass', details: 'IP not found in Shodan (Good sign)', lastSync: new Date().toISOString() };
                }
                throw new Error(`Shodan API Error: ${response.statusText}`);
            }
            const result = await response.json();
            const openPorts = result.ports || [];
            const vulns = result.vulns || [];

            if (vulns.length > 0) {
                return {
                    status: 'fail',
                    details: `Found ${vulns.length} vulnerabilities and open ports: ${openPorts.join(', ')}`,
                    lastSync: new Date().toISOString()
                };
            }

            return {
                status: 'pass',
                details: `No vulnerabilities found. Open ports: ${openPorts.join(', ')}`,
                lastSync: new Date().toISOString()
            };
        }

        if (providerId === 'hibp') {
            if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key for HIBP');

            // resourceId should be an email
            const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(resourceId)}`, {
                headers: {
                    'hibp-api-key': apiKey,
                    'user-agent': 'Sentinel-GRC'
                }
            });

            if (response.status === 404) {
                return { status: 'pass', details: 'No breaches found for this email.', lastSync: new Date().toISOString() };
            }

            if (!response.ok) throw new Error(`HIBP API Error: ${response.statusText}`);

            const breaches = await response.json();
            return {
                status: 'fail',
                details: `Found ${breaches.length} breaches: ${breaches.map(b => b.Name).join(', ')}`,
                lastSync: new Date().toISOString()
            };
        }

        if (providerId === 'website_check') {
            // No API key needed usually, just checking availability
            // resourceId should be a URL
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(resourceId, { method: 'HEAD', signal: controller.signal });
                clearTimeout(timeoutId);
                if (response.ok) {
                    return { status: 'pass', details: `Website is UP (Status: ${response.status})`, lastSync: new Date().toISOString() };
                } else {
                    return { status: 'fail', details: `Website returned status ${response.status}`, lastSync: new Date().toISOString() };
                }
            } catch (err) {
                const message = err && err.name === 'AbortError' ? 'Timeout (5s) reached' : (err.message || 'Unknown error');
                return { status: 'fail', details: `Website is DOWN or Unreachable: ${message}`, lastSync: new Date().toISOString() };
            }
        }

        throw new HttpsError('unimplemented', `Provider ${providerId} not supported yet.`);

    } catch (error) {
        logger.error('Error fetching evidence:', error);
        throw new HttpsError('internal', 'Failed to fetch evidence: ' + error.message);
    }
});
/**
 * Proxy function to fetch RSS feeds and avoid CORS issues.
 */
exports.fetchRssFeed = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const url = request?.data?.url;
    if (!url) {
        throw new HttpsError('invalid-argument', 'URL is required.');
    }

    // SSRF protection: only allow known RSS providers over HTTPS
    const allowedRssHosts = new Set([
        'www.cert.ssi.gouv.fr',
        'cert.ssi.gouv.fr',
        'www.cnil.fr',
        'cnil.fr'
    ]);

    const isPrivateOrLocalHost = (hostname) => {
        const h = String(hostname || '').toLowerCase();
        if (!h) return true;
        if (h === 'localhost' || h.endsWith('.local')) return true;
        if (h === '127.0.0.1' || h === '::1') return true;
        // Block common private IPv4 ranges
        const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h);
        if (isIpv4) {
            const parts = h.split('.').map(n => Number(n));
            if (parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
            if (parts[0] === 10) return true;
            if (parts[0] === 127) return true;
            if (parts[0] === 192 && parts[1] === 168) return true;
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
            if (parts[0] === 169 && parts[1] === 254) return true;
        }
        return false;
    };

    try {
        let parsed;
        try {
            parsed = new URL(String(url));
        } catch {
            throw new HttpsError('invalid-argument', 'Invalid URL');
        }

        if (parsed.protocol !== 'https:') {
            throw new HttpsError('invalid-argument', 'Only HTTPS URLs are allowed');
        }

        if (isPrivateOrLocalHost(parsed.hostname)) {
            throw new HttpsError('permission-denied', 'URL host is not allowed');
        }

        if (!allowedRssHosts.has(parsed.hostname)) {
            throw new HttpsError('permission-denied', 'RSS host not allowlisted');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Sentinel-GRC/1.0'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        return { content: text };
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching RSS feed:', { message, error });
        throw new HttpsError('internal', 'Failed to fetch RSS feed: ' + message);
    }
});

// --- AUDIT LOGGING AUTOMATION ---
exports.auditRisks = generateAuditTrigger('risks/{docId}', 'threat');
exports.auditIncidents = generateAuditTrigger('incidents/{docId}', 'title');
exports.auditAssets = generateAuditTrigger('assets/{docId}', 'name');
exports.auditDocuments = generateAuditTrigger('documents/{docId}', 'title');

// --- GDPR / CASCADING DELETION ---
exports.onOrganizationDeleted = onDocumentDeleted("organizations/{orgId}", async (event) => {
    const orgId = event.params.orgId;
    const db = admin.firestore();
    const batch = db.batch();

    logger.info(`Organization ${orgId} deleted. Starting cascading cleanup...`);

    try {
        // 1. Delete Users associated with Org
        // Warning: This deletes the user accounts entirely. 
        // If users can belong to multiple orgs, this logic needs adjustment (Sentinel is single-tenant per user for now).
        const usersSnap = await db.collection('users').where('organizationId', '==', orgId).get();
        const deletePromises = [];

        usersSnap.forEach(doc => {
            // Delete Auth User
            deletePromises.push(admin.auth().deleteUser(doc.id).catch(e => logger.warn(`Failed to delete auth user ${doc.id}`, e)));
            // Delete Firestore User Doc
            batch.delete(doc.ref);
        });

        // 2. Delete Subcollections logic (if hardcoded known subcollections exist)
        // Firestore doesn't support recursive delete in triggers easily without using firebase-tools helper
        // or listing all known collections.
        // For Critical Data: Risks, Incidents, Assets, Documents
        const commonCollections = ['risks', 'incidents', 'assets', 'documents', 'projects', 'audits'];

        for (const col of commonCollections) {
            const snap = await db.collection(col).where('organizationId', '==', orgId).get();
            snap.forEach(doc => batch.delete(doc.ref));
        }

        await batch.commit();
        await Promise.all(deletePromises);

        logger.info(`Cascading cleanup for ${orgId} complete.`);

    } catch (error) {
        logger.error(`Cascading delete failed for ${orgId}`, error);
    }
});


/**
 * Fetch Security Events from External Connectors (SIEM/EDR)
 * Requires 'connector_settings' in Firestore for configuration.
 */
exports.fetchExternalSecurityEvents = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { source } = request.data;
    const organizationId = request.auth.token.organizationId || request.auth.token.sub; // Fallback if custom claim missing

    if (!source) {
        throw new HttpsError('invalid-argument', 'Source is required.');
    }

    // 1. Fetch Connector Settings for this Org and Source
    const db = admin.firestore();
    const settingsDoc = await db.collection('organizations').doc(organizationId).collection('integrations').doc(source).get();

    if (!settingsDoc.exists) {
        // PRODUCTION BEHAVIOR: Throw error if not configured
        throw new HttpsError('failed-precondition', `Connector ${source} not configured for this organization.`);
    }

    const config = settingsDoc.data().config;
    if (!config) {
        throw new HttpsError('failed-precondition', `Connector ${source} configuration is empty.`);
    }

    // 2. Real API Calls
    if (!config.apiKey || !config.url) {
        throw new HttpsError('failed-precondition', `Connector ${source} configuration is incomplete (missing API Key or URL).`);
    }

    // Implementation logic for each source
    try {
        /* 
         * Example Real Implementation (Commented out):
         * if (source === 'splunk') {
         *    const response = await axios.get(`${config.url}/services/search/jobs/export`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
         *    return mapSplunkToSecurityEvents(response.data);
         * }
         */

        // Production behavior: no simulated data.
        // Implement per-connector API calls here (Splunk, Sentinel, CrowdStrike, etc.).
        throw new HttpsError('unimplemented', `Connector implementation for ${source} is not available.`);

    } catch (error) {
        logger.error(`External API call to ${source} failed`, error);
        throw new HttpsError('internal', `Failed to fetch events from ${source}: ${error.message}`);
    }
});

/**
 * Search Company (Pappers/Sirene Proxy)
 * Requires 'integration_settings' or 'pappers' config.
 */
exports.searchCompany = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    const { query } = request.data;
    const searchTerm = query || '';

    if (searchTerm.length < 3) {
        return [];
    }

    try {
        const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(searchTerm)}&per_page=10`);

        if (!response.ok) {
            logger.error(`Company API Error: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const results = data.results || [];

        return results.map(company => ({
            name: company.nom_complet,
            siren: company.siren,
            address: company.siege.adresse_complete || company.siege.geo_adresse,
            activity: `${company.activite_principale} - ${company.libelle_activite_principale}`
        }));

    } catch (error) {
        logger.error("Error calling api.gouv.fr", error);
        return [];
    }
});

/**
 * Validate VAT (VIES Proxy)
 */
exports.validateVat = onCall(async (request) => {
    const { vatNumber } = request.data;
    // Real implementation would call VIES SOAP/REST service
    // For now, we acknowledge the call but return unavailability if no external service is hooked up.
    throw new HttpsError('unimplemented', 'VIES Validation service not configured.');
});
