const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");
const {
    getAuditReminderHtml,
    getDocumentReviewHtml,
    getRiskTreatmentDueHtml,
    getMaintenanceHtml
} = require('./emailTemplates');

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

/**
 * Notification Manager Class
 * Handles automated checks and notification dispatch via Firestore triggers (Mail Queue & Notification Collection)
 */
class NotificationManager {

    /**
     * Run all automated checks for all organizations
     * Ideally, this should use valid cursors or be sharded for very large datasets.
     * For now, we iterate over all organizations.
     */
    static async runAutomatedChecks() {
        const db = admin.firestore();
        const now = new Date();

        logger.info("Starting automated notification checks...");

        try {
            // Get all organizations
            const orgsSnap = await db.collection('organizations').get();

            if (orgsSnap.empty) {
                logger.info("No organizations found.");
                return;
            }

            const promises = orgsSnap.docs.map(async (orgDoc) => {
                const orgId = orgDoc.id;
                const orgName = orgDoc.data().name;

                // Run checks concurrently for this org
                await Promise.all([
                    this.checkUpcomingAudits(db, orgId, orgName),
                    this.checkOverdueDocuments(db, orgId, orgName),
                    this.checkRiskTreatments(db, orgId, orgName),
                    this.checkAssetMaintenance(db, orgId, orgName)
                ]);
            });

            await Promise.all(promises);
            logger.info(`Completed checks for ${orgsSnap.size} organizations.`);

        } catch (error) {
            logger.error("Error running automated checks", error);
        }
    }

    /**
     * 1. Check Upcoming Audits (7 days and 1 day before)
     */
    static async checkUpcomingAudits(db, orgId, orgName) {
        const today = new Date();
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(today.getDate() + 7);
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        // Date ranges for querying (simple string comparison works for ISO dates YYYY-MM-DD)
        const rangeStart = today.toISOString().split('T')[0];
        const rangeEnd = sevenDaysLater.toISOString().split('T')[0];

        try {
            const auditsSnap = await db.collection('audits')
                .where('organizationId', '==', orgId)
                .where('status', '==', 'Planifié')
                .where('date', '>=', rangeStart)
                .where('date', '<=', rangeEnd)
                .get();

            if (auditsSnap.empty) return;

            const batch = db.batch();

            for (const doc of auditsSnap.docs) {
                const audit = doc.data();
                // Check if we already notified for this specific check (e.g. store in separate collection or array)
                // For simplicity here, we assume idempotency via 'lastNotifiedAt' or similar, but simplified for this implementation.
                // A robust system would track `notificationSent_7d`, `notificationSent_1d`.

                // We'll just check if it's exactly 7 days or 1 day away to avoid spamming every run (assuming daily run)
                const auditDate = new Date(audit.date);
                const diffTime = Math.abs(auditDate - today);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 7 || diffDays === 1) {
                    if (audit.auditorId) {
                        await this.queueNotification(batch, db, {
                            userId: audit.auditorId,
                            title: "Rappel d'Audit",
                            message: `L'audit "${audit.name}" est prévu pour le ${audit.date}.`,
                            link: `/audits/${doc.id}`,
                            type: 'AUDIT_REMINDER',
                            emailHtml: getAuditReminderHtml(audit.name, "Auditeur", audit.date, `${appBaseUrl.value()}/audits/${doc.id}`)
                        });
                    }
                }
            }
            await batch.commit();

        } catch (error) {
            logger.error(`Error checking audits for org ${orgId}`, error);
        }
    }

    /**
     * 2. Check Overdue Documents (Review Date Passed or Coming Up)
     */
    static async checkOverdueDocuments(db, orgId, orgName) {
        const today = new Date().toISOString().split('T')[0];

        try {
            const docsSnap = await db.collection('documents')
                .where('organizationId', '==', orgId)
                .where('status', 'in', ['published', 'draft']) // Only relevant statuses
                .where('nextReviewDate', '<=', today)
                .get();

            if (docsSnap.empty) return;

            const batch = db.batch();

            for (const doc of docsSnap.docs) {
                const document = doc.data();
                if (document.ownerId) {
                    // Check if already notified recently to prevent spam
                    // Skipping for MVP, assuming daily run catches it once if we filter strictly or update a 'lastNotified' field.
                    // IMPORTANT: To prevent spam on "Overdue", we should check a flag.
                    // For now, let's notify only if it matches today exactly (notification on due date).
                    if (document.nextReviewDate === today) {
                        await this.queueNotification(batch, db, {
                            userId: document.ownerId,
                            title: "Révision Documentaire",
                            message: `Le document "${document.title}" doit être révisé aujourd'hui.`,
                            link: `/documents/${doc.id}?view=preview`,
                            type: 'DOC_REVIEW',
                            emailHtml: getDocumentReviewHtml(document.title, "Propriétaire", document.nextReviewDate, `${appBaseUrl.value()}/documents/${doc.id}`)
                        });
                    }
                }
            }
            await batch.commit();

        } catch (error) {
            logger.error(`Error checking docs for org ${orgId}`, error);
        }
    }

    /**
     * 3. Check Risk Treatments Due
     */
    static async checkRiskTreatments(db, orgId, orgName) {
        const today = new Date().toISOString().split('T')[0];

        try {
            // Risks are stored, and treatments might be in a subcollection or array.
            // If treatments are in an array inside the risk document:
            const risksSnap = await db.collection('risks')
                .where('organizationId', '==', orgId)
                .where('status', 'in', ['Ouvert', 'En cours'])
                .get();

            if (risksSnap.empty) return;

            const batch = db.batch();

            for (const doc of risksSnap.docs) {
                const risk = doc.data();
                if (risk.treatmentPlan) {
                    // Check main due date
                    if (risk.treatmentPlan.dueDate === today && risk.treatmentPlan.ownerId) {
                        await this.queueNotification(batch, db, {
                            userId: risk.treatmentPlan.ownerId,
                            title: "Échéance de Traitement",
                            message: `Le plan de traitement pour "${risk.name}" arrive à échéance.`,
                            link: `/risk-assessment`, // Or specific risk link
                            type: 'RISK_TREATMENT',
                            emailHtml: getRiskTreatmentDueHtml(risk.name, risk.treatmentPlan.dueDate, "Responsable", `${appBaseUrl.value()}/risk-assessment`)
                        });
                    }
                }
            }
            await batch.commit();

        } catch (error) {
            logger.error(`Error checking risks for org ${orgId}`, error);
        }
    }

    /**
     * 4. Check Asset Maintenance
     */
    static async checkAssetMaintenance(db, orgId, orgName) {
        const today = new Date();
        const threeDaysLater = new Date();
        threeDaysLater.setDate(today.getDate() + 3);
        const targetDate = threeDaysLater.toISOString().split('T')[0];

        try {
            const assetsSnap = await db.collection('assets')
                .where('organizationId', '==', orgId)
                .where('nextMaintenanceDate', '==', targetDate) // Notify 3 days before
                .get();

            if (assetsSnap.empty) return;

            const batch = db.batch();

            for (const doc of assetsSnap.docs) {
                const asset = doc.data();
                if (asset.ownerId) {
                    await this.queueNotification(batch, db, {
                        userId: asset.ownerId,
                        title: "Maintenance à venir",
                        message: `Maintenance prévue pour "${asset.name}" le ${asset.nextMaintenanceDate}.`,
                        link: `/asset-inventory`,
                        type: 'ASSET_MAINTENANCE',
                        emailHtml: getMaintenanceHtml(asset.name, asset.nextMaintenanceDate, "Propriétaire", `${appBaseUrl.value()}/asset-inventory`)
                    });
                }
            }

            await batch.commit();

        } catch (error) {
            logger.error(`Error checking assets for org ${orgId}`, error);
        }
    }


    /**
     * Helper to add notification and email to batch
     */
    static async queueNotification(batch, db, { userId, title, message, link, type, emailHtml }) {
        if (!userId) return;

        // 1. Add In-App Notification
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            userId,
            title,
            message,
            link,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: type || 'SYSTEM'
        });

        // 2. Add Email to Queue
        if (emailHtml) {
            try {
                // Fetch user to get email
                const userRecord = await admin.auth().getUser(userId);
                if (userRecord.email) {
                    const mailRef = db.collection('mail_queue').doc();
                    batch.set(mailRef, {
                        to: userRecord.email,
                        message: {
                            subject: title,
                            html: emailHtml
                        },
                        type: type || 'SYSTEM_EMAIL',
                        status: 'PENDING',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (error) {
                logger.warn(`Could not find user ${userId} for email notification`, error);
            }
        }
    }
}

module.exports = { NotificationManager };
