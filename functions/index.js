
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");

const getJoinRequestEmailHtml = (requesterName, requesterEmail, orgName, link) => `
<div style="font-family: sans-serif; padding: 20px;">
  <h2>Nouvelle demande d'accès</h2>
  <p><strong>${requesterName}</strong> (${requesterEmail}) souhaite rejoindre <strong>${orgName}</strong>.</p>
  <a href="${link}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Gérer la demande</a>
</div>
`;

const getApprovedEmailHtml = (userName, orgName, link) => `
<div style="font-family: sans-serif; padding: 20px;">
  <h2>Demande approuvée !</h2>
  <p>Bonjour ${userName},</p>
  <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été acceptée.</p>
  <a href="${link}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Accéder à mon espace</a>
</div>
`;

const getRejectedEmailHtml = (userName, orgName) => `
<div style="font-family: sans-serif; padding: 20px;">
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
        console.log(`No admins found for org ${request.organizationId}`);
        return;
    }

    // 2. Queue Email for each admin
    const batch = admin.firestore().batch();
    const link = `https://sentinel-grc.web.app/team`; // Adjust base URL as needed

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
    console.log(`Queued join request emails for ${adminsSnap.size} admins.`);
});

exports.onJoinRequestUpdated = onDocumentUpdated("join_requests/{requestId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only react to status changes
    if (before.status === after.status) return;

    const link = `https://sentinel-grc.web.app/dashboard`;

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

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString, defineInt } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Define configuration parameters
const smtpHost = defineString("SMTP_HOST", { default: "smtp.ethereal.email" });
const smtpPort = defineInt("SMTP_PORT", { default: 587 });
const smtpUser = defineString("SMTP_USER", { default: "placeholder_user" });
const smtpPass = defineString("SMTP_PASS", { default: "placeholder_pass" });

// Global transporter for connection pooling
let transporter = null;

// Set custom claims when user document is created/updated
exports.setUserClaims = onDocumentCreated("users/{userId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    const userData = snap.data();
    const userId = event.params.userId;

    // Validate organizationId before setting claims
    if (!userData.organizationId) {
        console.warn(`User ${userId} has no organizationId - skipping claims creation`);
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
                console.log(`User ${userId} is owner of org ${userData.organizationId} - Enforcing ADMIN role`);
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

        console.log(`Custom claims set for user ${userId}: org=${userData.organizationId}, role=${role}`);
    } catch (error) {
        console.error(`Error setting custom claims for user ${userId}:`, error);
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
            console.warn(`User ${uid} has no organizationId - skipping token refresh`);
            return { success: false, message: 'User has no organization - onboarding required' };
        }

        // Update custom claims
        await admin.auth().setCustomUserClaims(uid, {
            organizationId: userData.organizationId,
            role: userData.role || 'user'
        });

        return { success: true, message: 'Token refreshed successfully' };
    } catch (error) {
        console.error('Error refreshing token:', error);
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
        console.error('HealMe failed', e);
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

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Define Plans mapping for backend
const PLANS = {
    'discovery': { monthly: null, yearly: null },
    'professional': {
        monthly: 'price_1SXOWoDKg6Juwz5xp4oBw1eM',
        yearly: 'price_1SXOWpDKg6Juwz5xk5puuJDg'
    },
    'enterprise': {
        monthly: 'price_1SXOWqDKg6Juwz5xaOzjO7IC',
        yearly: 'price_1SXOWrDKg6Juwz5xQGPV1309'
    }
};

/**
 * Create a Stripe Checkout Session for a subscription.
 */
exports.createCheckoutSession = onCall(async (request) => {
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
        console.error("Stripe Checkout Error", error);
        throw new HttpsError("internal", "Unable to create checkout session.");
    }
});

/**
 * Create a Billing Portal Session for managing existing subscriptions.
 */
exports.createPortalSession = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { organizationId, returnUrl } = request.data;

    if (!organizationId) {
        console.error("No organizationId provided");
        throw new HttpsError("invalid-argument", "Organization ID is required");
    }

    console.log(`Fetching organization: ${organizationId}`);
    const orgRef = admin.firestore().collection("organizations").doc(organizationId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
        console.error(`Organization not found: ${organizationId}`);
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
        console.error("Portal Error", err);
        throw new HttpsError("internal", "Could not create portal session");
    }
});

/**
 * Stripe Webhook to sync subscription status with Firestore.
 */
exports.stripeWebhook = onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.created') {
        const subscription = event.data.object;
        const organizationId = subscription.metadata.organizationId;

        if (!organizationId) {
            console.warn("Missing organizationId in subscription metadata");
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

        console.log(`Updated subscription for org ${organizationId} to ${status}`);
    }

    res.json({ received: true });
});

const mailFrom = defineString("MAIL_FROM", { default: '"Sentinel GRC" <no-reply@sentinel-grc.com>' });
const mailReplyTo = defineString("MAIL_REPLY_TO", { default: "" });

exports.processMailQueue = onDocumentCreated({
    document: "mail_queue/{docId}",
    maxInstances: 10,      // Increased to allow better scaling
    concurrency: 50,      // Allow this single instance to handle multiple requests
    retry: false          // We handle retries manually with our scheduled function
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
async function attemptSendEmail(docRef, data) {
    const host = smtpHost.value();
    const user = smtpUser.value();
    const pass = smtpPass.value();

    // Check for placeholder values
    if (host === "smtp.ethereal.email" && user === "placeholder_user") {
        const msg = "WARNING: Using placeholder SMTP settings. Configure SMTP_HOST, SMTP_USER, SMTP_PASS via Firebase secrets/params.";
        console.warn(msg);
        return docRef.update({
            status: "CONFIG_ERROR",
            error: msg,
            attempts: 0
        });
    }

    // Initialize transporter if not exists
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: host,
            port: smtpPort.value(),
            secure: smtpPort.value() === 465,
            pool: true, // Use pooled connections
            maxConnections: 3, // Limit concurrent connections to avoid 454
            rateLimit: 10, // Helper to pace sending
            auth: {
                user: user,
                pass: pass,
            },
        });
    }

    try {
        console.log(`Processing email for ${data.to}`);

        const mailOptions = {
            from: mailFrom.value(),
            to: data.to,
            subject: data.message.subject,
            html: data.message.html,
        };

        if (mailReplyTo.value()) {
            mailOptions.replyTo = mailReplyTo.value();
        }

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);

        // Update Firestore document status
        return docRef.update({
            status: "SENT",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            messageId: info.messageId,
            deliveryInfo: info.response,
        });
    } catch (error) {
        console.error("Error sending email:", error);

        // Determine if error is transient
        // 4xx errors are typically transient (e.g., 454, 421)
        const responseCode = error.responseCode || (error.message && parseInt(error.message.substring(0, 3)));
        const isTransient = responseCode && responseCode >= 400 && responseCode < 500;
        const currentAttempts = data.attempts || 0;
        const MAX_ATTEMPTS = 5;

        if (isTransient && currentAttempts < MAX_ATTEMPTS) {
            // Exponential backoff: 2, 4, 8, 16, 32 mins
            const retryDelayMinutes = Math.pow(2, currentAttempts + 1);
            const retryDate = new Date();
            retryDate.setMinutes(retryDate.getMinutes() + retryDelayMinutes);

            console.log(`Transient error ${responseCode}. Scheduling retry #${currentAttempts + 1} in ${retryDelayMinutes} minutes.`);

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

exports.retryFailedEmails = onSchedule("every 5 minutes", async (event) => {
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

    console.log(`Retrying ${docsToProcess.length} emails (${retrySnap.size} pending retry, ${errorSnap.size} errors, ${stuckPendingDocs.length} stuck)...`);

    // Use a Map to deduplicate by ID just in case
    const uniqueDocs = new Map();
    docsToProcess.forEach(doc => uniqueDocs.set(doc.id, doc));

    const promises = Array.from(uniqueDocs.values()).map(doc => attemptSendEmail(doc.ref, doc.data()));
    await Promise.all(promises);
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
        console.log("No userId in notification");
        return;
    }

    try {
        // Get user's FCM tokens
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            console.log(`User ${userId} not found`);
            return;
        }

        const userData = userDoc.data();
        const tokens = userData.fcmTokens;

        if (!tokens || tokens.length === 0) {
            console.log(`No FCM tokens for user ${userId}`);
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
        console.log(`Sent ${response.successCount} notifications to user ${userId}`);

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
                console.log(`Removed ${failedTokens.length} invalid tokens`);
            }
        }
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
});
