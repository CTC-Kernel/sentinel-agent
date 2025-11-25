const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const { defineString, defineInt } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Define configuration parameters
const smtpHost = defineString("SMTP_HOST", { default: "smtp.ethereal.email" });
const smtpPort = defineInt("SMTP_PORT", { default: 587 });
const smtpUser = defineString("SMTP_USER", { default: "placeholder_user" });
const smtpPass = defineString("SMTP_PASS", { default: "placeholder_pass" });

// Set custom claims when user document is created/updated
exports.setUserClaims = onDocumentCreated("users/{userId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    const userData = snap.data();
    const userId = event.params.userId;

    try {
        // Set custom claims with organizationId and role
        await admin.auth().setCustomUserClaims(userId, {
            organizationId: userData.organizationId,
            role: userData.role || 'user'
        });

        console.log(`Custom claims set for user ${userId}: org=${userData.organizationId}, role=${userData.role}`);
    } catch (error) {
        console.error(`Error setting custom claims for user ${userId}:`, error);
    }
});

// Callable function to refresh user token (force claims update)
exports.refreshUserToken = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new Error('User not authenticated');
    }

    try {
        // Get user data from Firestore
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new Error('User document not found');
        }

        const userData = userDoc.data();

        // Update custom claims
        await admin.auth().setCustomUserClaims(uid, {
            organizationId: userData.organizationId,
            role: userData.role || 'user'
        });

        return { success: true, message: 'Token refreshed successfully' };
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw new Error('Failed to refresh token');
    }
});

// ADMIN ONLY: Fix all existing users by adding organizationId and setting claims
exports.fixAllUsers = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new Error('User not authenticated');
    }

    try {
        // Check if caller is admin
        const callerDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
            throw new Error('Only admins can run this function');
        }

        console.log('Starting user migration...');
        const usersSnapshot = await admin.firestore().collection('users').get();
        const results = {
            total: usersSnapshot.size,
            fixed: 0,
            alreadyOk: 0,
            errors: []
        };

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;

            try {
                // Check if organizationId is missing
                if (!userData.organizationId) {
                    console.log(`Fixing user ${userId} - adding default organizationId`);

                    // Add organizationId to Firestore
                    await userDoc.ref.update({
                        organizationId: 'default-org'
                    });

                    // Set custom claims
                    await admin.auth().setCustomUserClaims(userId, {
                        organizationId: 'default-org',
                        role: userData.role || 'user'
                    });

                    results.fixed++;
                } else {
                    // Just ensure custom claims are set
                    await admin.auth().setCustomUserClaims(userId, {
                        organizationId: userData.organizationId,
                        role: userData.role || 'user'
                    });

                    results.alreadyOk++;
                }
            } catch (error) {
                console.error(`Error fixing user ${userId}:`, error);
                results.errors.push({ userId, error: error.message });
            }
        }

        console.log('Migration complete:', results);
        return { success: true, results };
    } catch (error) {
        console.error('Error in fixAllUsers:', error);
        throw new Error('Migration failed: ' + error.message);
    }
});

// --- STRIPE SUBSCRIPTION LOGIC ---

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "***REDACTED***");

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

  if (orgData.ownerId !== request.auth.uid && userData.role !== 'admin') {
    throw new HttpsError("permission-denied", "Only admins or owners can manage billing.");
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
  const orgRef = admin.firestore().collection("organizations").doc(organizationId);
  const orgSnap = await orgRef.get();
  
  if (!orgSnap.exists) {
      throw new HttpsError("not-found", "Organization not found");
  }

  const orgData = orgSnap.data();
  
  if (orgData.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized.");
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
  } catch(err) {
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
          return res.json({received: true});
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

  res.json({received: true});
});

exports.processMailQueue = onDocumentCreated("mail_queue/{docId}", async (event) => {
    const snap = event.data;
    if (!snap) {
        return;
    }

    const data = snap.data();

    // Prevent infinite loops or processing already handled docs
    if (data.status !== "PENDING") {
        return;
    }

    // Create transporter inside the function to ensure params are loaded
    const transporter = nodemailer.createTransport({
        host: smtpHost.value(),
        port: smtpPort.value(),
        secure: smtpPort.value() === 465,
        auth: {
            user: smtpUser.value(),
            pass: smtpPass.value(),
        },
    });

    try {
        console.log(`Processing email for ${data.to}`);

        const mailOptions = {
            from: '"Sentinel GRC" <no-reply@sentinel-grc.com>',
            to: data.to,
            subject: data.message.subject,
            html: data.message.html,
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);

        // Update Firestore document status
        return snap.ref.update({
            status: "SENT",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            messageId: info.messageId,
            deliveryInfo: info.response,
        });
    } catch (error) {
        console.error("Error sending email:", error);

        // Update Firestore document with error
        return snap.ref.update({
            status: "ERROR",
            error: error.message,
            attempts: admin.firestore.FieldValue.increment(1),
        });
    }
});
