/**
 * Notifications Module - Email and Push Notification Functions
 * Domain: Email Queue, Push Notifications, Scheduled Reminders
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString, defineSecret } = require("firebase-functions/params");

const sgMail = require('@sendgrid/mail');

// Import centralized risk threshold from calculateComplianceScore
const { CRITICAL_RISK_THRESHOLD } = require('../callable/calculateComplianceScore');

// Secrets
const sendGridApiKey = defineSecret("SENDGRID_API_KEY");
const mailFrom = defineString("MAIL_FROM", { default: '"Sentinel GRC" <no-reply@sentinel-grc.com>' });
const mailReplyTo = defineString("MAIL_REPLY_TO", { default: "" });
const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

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

        const [response] = await sgMail.send(msg);
        logger.info("Message sent via SendGrid");

        // Convert headers to a plain JavaScript object for Firestore compatibility
        // SendGrid returns a Headers object that is not serializable
        let headersObj = {};
        try {
            if (response.headers) {
                // Determine if it's a Headers instance (Web API) or a plain object
                if (typeof response.headers.entries === 'function') {
                    // Headers instance - convert using entries()
                    for (const [key, value] of response.headers.entries()) {
                        headersObj[key] = value;
                    }
                } else {
                    // Node-style headers or plain object
                    // Iterate and copy to ensure a fresh plain object with no hidden prototypes
                    Object.keys(response.headers).forEach(key => {
                        const val = response.headers[key];
                        // Only copy serializable values
                        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                            headersObj[key] = val;
                        } else if (Array.isArray(val)) {
                            headersObj[key] = val.filter(v => typeof v === 'string');
                        }
                    });
                }
            }
        } catch (headerError) {
            // If header conversion fails, just save an empty object
            logger.warn("Could not serialize response headers:", headerError.message);
            headersObj = {};
        }

        const safeResponse = {
            statusCode: response.statusCode,
            headers: headersObj,
        };

        return docRef.update({
            status: "SENT",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            deliveryInfo: safeResponse,
        });
    } catch (error) {
        logger.error("Error sending email:", error);

        const responseCode = error.code;
        const isTransient = (responseCode >= 500) || (responseCode === 429);
        const currentAttempts = data.attempts || 0;
        const MAX_ATTEMPTS = 5;

        if (isTransient && currentAttempts < MAX_ATTEMPTS) {
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

/**
 * Process mail queue when a new email is added
 */
exports.processMailQueue = onDocumentCreated({
    document: "mail_queue/{docId}",
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1',
    maxInstances: 10,
    concurrency: 50,
    retry: false,
    secrets: [sendGridApiKey]
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();

    if (data.status !== "PENDING") {
        return;
    }

    await attemptSendEmail(snap.ref, data);
});

/**
 * Retry failed emails on schedule
 */
exports.retryFailedEmails = onSchedule({
    schedule: "every 5 minutes",
    memory: '512MiB',
    timeoutSeconds: 120,
    region: 'europe-west1',
    secrets: [sendGridApiKey]
}, async (event) => {
    const now = admin.firestore.Timestamp.now();

    const retryQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'RETRY_PENDING')
        .where('retryAt', '<=', now)
        .limit(20)
        .get();

    const errorQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'ERROR')
        .where('attempts', '<', 5)
        .limit(20)
        .get();

    const pendingQuery = admin.firestore().collection('mail_queue')
        .where('status', '==', 'PENDING')
        .limit(50)
        .get();

    const [retrySnap, errorSnap, pendingSnap] = await Promise.all([retryQuery, errorQuery, pendingQuery]);

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const stuckPendingDocs = pendingSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return true;
        const createdTime = data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
        return createdTime < tenMinutesAgo;
    });

    const docsToProcess = [...retrySnap.docs, ...errorSnap.docs, ...stuckPendingDocs];

    if (docsToProcess.length === 0) return;

    logger.info(`Retrying ${docsToProcess.length} emails (${retrySnap.size} pending retry, ${errorSnap.size} errors, ${stuckPendingDocs.length} stuck)...`);

    const uniqueDocs = new Map();
    docsToProcess.forEach(doc => uniqueDocs.set(doc.id, doc));

    const promises = Array.from(uniqueDocs.values()).map(doc => attemptSendEmail(doc.ref, doc.data()));
    await Promise.all(promises);
});

/**
 * Secure Callable Function to send emails from client
 */
exports.sendEmail = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to send emails.');
    }

    const { to, subject, html, type, metadata } = request.data;

    if (!to || !subject || !html) {
        throw new HttpsError('invalid-argument', 'Missing required email fields (to, subject, html).');
    }

    try {
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
 * Secure Callable Function to schedule an email
 */
exports.scheduleEmail = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
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
exports.onNotificationCreated = onDocumentCreated({
    document: "notifications/{notificationId}",
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data();
    const userId = notification.userId;

    if (!userId) {
        logger.info("No userId in notification");
        return;
    }

    try {
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

        const response = await admin.messaging().sendMulticast(message);
        logger.info(`Sent ${response.successCount} notifications to user ${userId}`);

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
 * Scheduled notification checks (runs every 6 hours)
 */
exports.scheduledNotificationChecks = onSchedule({
    schedule: "every 6 hours",
    memory: '1GiB',
    timeoutSeconds: 300,
    region: 'europe-west1'
}, async (event) => {
    const { NotificationManager } = require('../services/notificationManager');
    await NotificationManager.runAutomatedChecks();
});

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
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Rappel d'Audit Planifie</h2>
            <p>Bonjour ${auditorName},</p>
            <p>Un audit est planifie dans les prochains jours et necessite votre attention.</p>

            <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e40af;">${auditName}</h3>
              <p style="margin: 0; font-size: 14px; color: #1e3a8a;">Date prevue : <strong>${new Date(scheduledDate).toLocaleDateString()}</strong></p>
            </div>

            <p>Assurez-vous d'avoir prepare tous les documents et preuves necessaires pour cet audit.</p>

            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Voir l'audit</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits reserves.</p>
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
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Revision Documentaire Requise</h2>
            <p>Bonjour ${ownerName},</p>
            <p>Le document <strong>"${docTitle}"</strong> arrive a echeance de revision.</p>

            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Date d'echeance</span>
              <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(dueDate).toLocaleDateString()}</div>
            </div>

            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Acceder au document</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits reserves.</p>
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
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Maintenance Planifiee</h2>
            <p>Bonjour ${ownerName},</p>
            <p>Une maintenance est prevue prochainement pour l'actif <strong>${assetName}</strong>.</p>

            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Date de maintenance</span>
              <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(maintenanceDate).toLocaleDateString()}</div>
            </div>

            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Voir l'actif</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits reserves.</p>
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
              <h2 style="font-size: 18px; color: #d97706; margin: 0; font-weight: 700;">Echeance de Traitement de Risque</h2>
            </div>

            <p>Bonjour ${responsiblePerson},</p>
            <p>Le plan de traitement du risque suivant arrive a echeance :</p>

            <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 24px 0;">
              <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${riskTitle}</h3>
              <p style="margin: 8px 0 0 0; color: #64748b;">Date limite : <strong style="color: #d97706;">${new Date(dueDate).toLocaleDateString()}</strong></p>
            </div>

            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Gerer le risque</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits reserves.</p>
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
            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Revue de Risque en Retard</h2>
            <p>Bonjour ${ownerName},</p>
            <p>Le risque suivant necessite une revue periodique conformement a la methode ISO 27005 :</p>

            <div style="border-left: 4px solid #f97316; padding-left: 16px; margin: 24px 0;">
              <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${riskTitle}</h3>
              <p style="margin: 8px 0 0 0; color: #64748b;">Derniere revue enregistree : <strong style="color: #b45309;">${lastReviewDate ? new Date(lastReviewDate).toLocaleDateString() : 'Aucune revue enregistree'}</strong></p>
            </div>

            <div style="text-align: center;">
              <a href="${link}" style="display: inline-block; background-color: #f97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 14px;">Revoir le risque</a>
            </div>
          </div>
          <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
            <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits reserves.</p>
          </div>
        </div>
    `
};

// Helper functions for scheduled checks
async function shouldNotify(db, userId, link, contentMatch) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const notifsSnap = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('link', '==', link)
        .where('createdAt', '>=', yesterday)
        .limit(1)
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

/**
 * Daily notification checks for audits, documents, risks, etc.
 */
exports.checkScheduledNotifications = onSchedule({
    schedule: "every 24 hours",
    memory: '1GiB',
    timeoutSeconds: 540,
    region: 'europe-west1'
}, async (event) => {
    logger.info("Starting scheduled notification checks...");
    const db = admin.firestore();

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
                        title: 'Audit a venir: ' + audit.name,
                        message: 'L\'audit est prevu dans ' + daysUntil + ' jour(s) - ' + new Date(audit.dateScheduled).toLocaleDateString(),
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
                        title: 'Document a reviser: ' + document.title,
                        message: 'La date de revision est depassee depuis le ' + new Date(document.nextReviewDate).toLocaleDateString(),
                        link: '/documents',
                        email: ownerData.email,
                        emailSubject: 'Revision requise: ' + document.title,
                        emailHtml: Templates.getDocumentReviewTemplate(
                            document.title,
                            ownerData.displayName || 'Proprietaire',
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
                            title: 'Maintenance a prevoir : ' + asset.name,
                            message: 'Maintenance prevue dans ' + daysUntil + ' jour(s)',
                            link: '/assets',
                            email: ownerData.email,
                            emailSubject: 'Maintenance : ' + asset.name,
                            emailHtml: Templates.getMaintenanceTemplate(
                                asset.name,
                                asset.nextMaintenance,
                                ownerData.displayName || 'Proprietaire',
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

        if (risk.ownerId) {
            const ownerSnap = await db.collection('users').doc(risk.ownerId).get();
            if (ownerSnap.exists) {
                targetUserId = ownerSnap.id;
                targetUserData = ownerSnap.data();
            }
        }

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
                    message: 'La derniere revue du risque est depassee ou non enregistree.',
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
        if (risk.score >= CRITICAL_RISK_THRESHOLD && (!risk.mitigationControlIds || risk.mitigationControlIds.length === 0)) {
            criticalRisksWithoutMitigation.push(risk);
        }
    });

    if (criticalRisksWithoutMitigation.length > 0) {
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
                    title: criticalRisksWithoutMitigation.length + ' risque(s) critique(s) sans attenuation',
                    message: 'Des risques critiques n\'ont pas de controles d\'attenuation associes',
                    link: '/risks',
                    email: adminData.email,
                    emailSubject: 'Action requise : ' + criticalRisksWithoutMitigation.length + ' Risques Critiques',
                    emailHtml: Templates.getRiskTreatmentDueTemplate(
                        'Risques Critiques non traites',
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
                                emailHtml: Templates.getDocumentReviewTemplate(
                                    supplier.name,
                                    ownerData.displayName || 'Proprietaire',
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
