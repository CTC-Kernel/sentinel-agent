/**
 * Stripe Module - Payment and Subscription Functions
 * Domain: Checkout, Billing Portal, Webhooks
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { validate, z } = require('../utils/validation');

// Secrets
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

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

// Helper to get Stripe Price ID
function getPriceId(planId, interval) {
    const planConfig = PLANS[planId];
    if (!planConfig) {
        throw new HttpsError("invalid-argument", `Invalid planId: ${planId}`);
    }
    const priceId = interval === 'year' ? planConfig.yearly : planConfig.monthly;
    if (!priceId) {
        throw new HttpsError("invalid-argument", `No price configured for plan ${planId} with interval ${interval}`);
    }
    return priceId;
}

/**
 * Create a Stripe Checkout Session for a subscription.
 */
exports.createCheckoutSession = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    secrets: [stripeSecretKey]
}, async (request) => {
    const stripe = require('stripe')(stripeSecretKey.value());
    const db = admin.firestore();

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { planId, organizationId, successUrl, cancelUrl, interval } = validate(z.object({
        planId: z.enum(['discovery', 'professional', 'enterprise']),
        organizationId: z.string(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
        interval: z.enum(['month', 'year']).default('month')
    }), request.data);

    // If it's the free plan, just update Firestore directly
    if (planId === 'discovery') {
        const orgRef = db.collection("organizations").doc(organizationId);
        const orgSnap = await orgRef.get();
        if (!orgSnap.exists) {
            throw new HttpsError("not-found", "Organization not found.");
        }
        const orgData = orgSnap.data();

        const userDoc = await db.collection("users").doc(request.auth.uid).get();
        const userData = userDoc.data();

        if (orgData.ownerId !== request.auth.uid) {
            if (userData.role !== 'admin' || userData.organizationId !== organizationId) {
                throw new HttpsError("permission-denied", "Only admins of this organization or owners can manage billing.");
            }
        }

        await orgRef.update({
            'subscription.planId': 'discovery',
            'subscription.status': 'active',
            'subscription.stripeSubscriptionId': null,
            'subscription.currentPeriodEnd': null,
            'subscription.cancelAtPeriodEnd': false
        });
        return { url: successUrl };
    }

    // Verify user belongs to organization and is admin/owner
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    const userData = userDoc.data();

    const orgRef = db.collection("organizations").doc(organizationId);
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

    try {
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

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ["card"],
            line_items: [
                {
                    price: getPriceId(planId, interval),
                    quantity: 1,
                },
            ],
            mode: "subscription",
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
        logger.error("Stripe Checkout Error:", error);
        throw new HttpsError("internal", "Unable to create checkout session.");
    }
});

/**
 * Create a Billing Portal Session for managing existing subscriptions.
 */
exports.createPortalSession = onCall({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
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
exports.stripeWebhook = onRequest({
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
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
