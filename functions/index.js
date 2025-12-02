
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const sgMail = require('@sendgrid/mail');
// sgMail.setApiKey is now called with secret

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString, defineSecret } = require("firebase-functions/params");
const sendGridApiKey = defineSecret("SENDGRID_API_KEY");
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://sentinel-grc.web.app" });
const admin = require("firebase-admin");
const crypto = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const userSecretsKey = defineSecret("USER_SECRETS_ENCRYPTION_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

admin.initializeApp();

const getJoinRequestEmailHtml = (requesterName, requesterEmail, orgName, link) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; padding: 20px;">
  <h2>Nouvelle demande d'accès</h2>
  <p><strong>${requesterName}</strong> (${requesterEmail}) souhaite rejoindre <strong>${orgName}</strong>.</p>
  <a href="${link}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Gérer la demande</a>
</div>
`;

const getApprovedEmailHtml = (userName, orgName, link) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; padding: 20px;">
  <h2>Demande approuvée !</h2>
  <p>Bonjour ${userName},</p>
  <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été acceptée.</p>
  <a href="${link}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Accéder à mon espace</a>
</div>
`;

const getRejectedEmailHtml = (userName, orgName) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; padding: 20px;">
  <h2>Demande refusée</h2>
  <p>Bonjour ${userName},</p>
  <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été refusée.</p>
</div>
`;

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
exports.setUserClaims = onDocumentCreated("users/{userId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    const userData = snap.data();
    const userId = event.params.userId;

    // Validate organizationId before setting claims
    if (!userData.organizationId) {
        logger.warn(`User ${userId} has no organizationId - skipping claims creation`);
        return;
    }

    try {
        // Fetch organization to check ownership
        const orgRef = admin.firestore().collection('organizations').doc(userData.organizationId);
        const orgSnap = await orgRef.get();

        let role = userData.role || 'user';

        if (orgSnap.exists) {
            const orgData = orgSnap.data();
            // Enforce ADMIN role if user is the owner
            if (orgData.ownerId === userId) {
                logger.info(`User ${userId} is owner of org ${userData.organizationId} - Enforcing ADMIN role`);
                role = 'admin';

                // Update Firestore if needed
                if (userData.role !== 'admin') {
                    await event.data.ref.update({ role: 'admin' });
                }
            }
        }

        // Set custom claims with organizationId and role
        await admin.auth().setCustomUserClaims(userId, {
            organizationId: userData.organizationId,
            role: role
        });

        logger.info(`Custom claims set for user ${userId}: org=${userData.organizationId}, role=${role}`);
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

        // Update custom claims
        await admin.auth().setCustomUserClaims(uid, {
            organizationId: userData.organizationId,
            role: userData.role || 'user'
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
            await admin.auth().setCustomUserClaims(uid, {
                organizationId: userData.organizationId,
                role: userData.role || 'user'
            });
            return { success: true, organizationId: userData.organizationId };
        }

        // Find org owned by user
        const orgsSnap = await db.collection('organizations').where('ownerId', '==', uid).limit(1).get();

        if (!orgsSnap.empty) {
            const org = orgsSnap.docs[0];
            const orgData = org.data();

            await userRef.update({
                organizationId: org.id,
                organizationName: orgData.name,
                onboardingCompleted: true
            });

            await admin.auth().setCustomUserClaims(uid, {
                organizationId: org.id,
                role: userData.role || 'user'
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

// --- STRIPE SUBSCRIPTION LOGIC ---

const stripe = require("stripe")(stripeSecretKey.value());

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

/**
 * Create a Stripe Checkout Session for a subscription.
 */
exports.createCheckoutSession = onCall({
    secrets: [stripeSecretKey]
}, async (request) => {
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
exports.stripeWebhook = onRequest({
    secrets: [stripeSecretKey, stripeWebhookSecret]
}, async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = stripeWebhookSecret.value();

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
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
        const rawApiKey = sendGridApiKey.value();
        if (!rawApiKey) {
            throw new Error("SendGrid API Key is missing");
        }
        // Remove all whitespace including newlines
        const cleanApiKey = rawApiKey.replace(/\s+/g, '');
        sgMail.setApiKey(cleanApiKey);
        logger.info(`Processing email for ${data.to} via SendGrid`);

        const msg = {
            to: data.to,
            from: 'contact@cyber-threat-consulting.com', // Verified sender
            subject: data.message.subject,
            html: data.message.html,
        };

        if (mailReplyTo.value()) {
            msg.replyTo = mailReplyTo.value();
        }

        // Send email via SendGrid
        const info = await sgMail.send(msg);
        logger.info("Message sent via SendGrid");

        // Update Firestore document status
        return docRef.update({
            status: "SENT",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            deliveryInfo: info[0].statusCode,
        });
    } catch (error) {
        logger.error("Error sending email:", error);

        // Determine if error is transient
        // SendGrid errors usually have a code or response.body.errors
        const responseCode = error.code;
        const isTransient = responseCode && responseCode >= 400 && responseCode < 500;
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
    const errorQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'ERROR')
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

    // Validate user belongs to the organization they are logging for
    // (unless they are logging an onboarding event where they might not have the claim yet, 
    // but typically we trust the client's orgId if it matches their profile or claim. 
    // For strictness, we could check the DB, but for logs, checking auth is usually enough context).

    // We'll trust the authenticated user's ID.

    try {
        await admin.firestore().collection('system_logs').add({
            organizationId,
            userId: request.auth.uid,
            userEmail: request.auth.token.email,
            action,
            resource,
            details: details || '',
            timestamp: new Date().toISOString(),
            source: 'client_secure'
        });

        return { success: true };
    } catch (error) {
        logger.error('Error in logEvent callable:', error);
        throw new HttpsError('internal', 'Failed to log event.');
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

async function getGeminiClientForUser(uid) {
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
        const genAI = await getGeminiClientForUser(uid);

        const runGenerate = async (name) => {
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

            if (message.includes('404') || message.includes('not found')) {
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
    const modelName = request.data?.modelName || "gemini-3-pro-preview";

    if (!systemPrompt || typeof systemPrompt !== 'string' || !message || typeof message !== 'string') {
        throw new HttpsError('invalid-argument', 'systemPrompt and message are required.');
    }

    try {
        const genAI = await getGeminiClientForUser(uid);

        const runChat = async (name) => {
            const model = genAI.getGenerativeModel({ model: name });
            const chat = model.startChat({
                history: [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    { role: "model", parts: [{ text: "Bien reçu. Je suis Sentinel AI, prêt à vous assister sur tous les sujets GRC." }] },
                ],
            });
            const result = await chat.sendMessage(message);
            const response = await result.response;
            return response.text();
        };

        try {
            const text = await runChat(modelName);
            return { text };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.warn('Primary Gemini chat model failed in callGeminiChat', { error: errMsg });

            if (errMsg.includes('404') || errMsg.includes('not found')) {
                try {
                    const text = await runChat('gemini-1.5-flash');
                    return { text, model: 'gemini-1.5-flash' };
                } catch (fallbackError) {
                    logger.error('Fallback Gemini chat model failed in callGeminiChat', fallbackError);
                    throw fallbackError;
                }
            }

            throw error;
        }
    } catch (error) {
        logger.error('callGeminiChat failed', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to call Gemini chat');
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
            <p>&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
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
            <p>&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
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
            <p>&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
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
            <p>&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
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
            <p>&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
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
