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
