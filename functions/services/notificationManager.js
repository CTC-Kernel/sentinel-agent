const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");
const {
    getAuditReminderHtml,
    getDocumentReviewHtml,
    getRiskTreatmentDueHtml,
    getMaintenanceHtml,
    getDrillOverdueHtml
} = require('./emailTemplates');

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

// In-memory user cache to avoid redundant auth().getUser() calls within the same function invocation
const userCache = new Map();
async function getCachedUser(userId) {
    if (userCache.has(userId)) return userCache.get(userId);
    const user = await admin.auth().getUser(userId);
    userCache.set(userId, user);
    return user;
}

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
                    this.checkAssetMaintenance(db, orgId, orgName),
                    this.checkOverdueDrills(db, orgId)
                ]);
            });

            await Promise.all(promises);
            logger.info(`Completed checks for ${orgsSnap.size} organizations.`);

        } catch (error) {
            logger.error("Error running automated checks", error);
        }
    }

    /**
     * Helper to check if a notification was already sent recently (24h)
     */
    static async checkIfAlreadyNotified(db, userId, link, type) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const snap = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('link', '==', link)
            .where('type', '==', type)
            .where('createdAt', '>=', yesterday)
            .limit(1)
            .get();
        return !snap.empty;
    }

    /**
     * 1. Check Upcoming Audits (7 days and 1 day before)
     */
    static async checkUpcomingAudits(db, orgId, orgName) {
        const today = new Date();
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(today.getDate() + 7);
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

            // H2: batch chunking to avoid 500-op limit
            const BATCH_LIMIT = 450;
            let batch = db.batch();
            let batchCount = 0;

            for (const doc of auditsSnap.docs) {
                const audit = doc.data();
                const auditDate = new Date(audit.date);
                const diffTime = Math.abs(auditDate - today);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 7 || diffDays === 1) {
                    if (audit.auditorId) {
                        const link = `/audits/${doc.id}`;
                        const type = 'AUDIT_REMINDER';

                        const alreadySent = await this.checkIfAlreadyNotified(db, audit.auditorId, link, type);
                        if (alreadySent) continue;

                        const opsAdded = await this.queueNotification(batch, db, {
                            userId: audit.auditorId,
                            organizationId: orgId,
                            title: "Rappel d'Audit",
                            message: `L'audit "${audit.name}" est prévu pour le ${audit.date}.`,
                            link,
                            type,
                            emailHtml: getAuditReminderHtml(audit.name, "Auditeur", audit.date, `${appBaseUrl.value()}/audits/${doc.id}`)
                        });
                        batchCount += opsAdded;

                        if (batchCount >= BATCH_LIMIT) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    }
                }
            }
            if (batchCount > 0) await batch.commit();

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
                .where('status', 'in', ['Brouillon', 'Publié']) // Only relevant statuses
                .where('nextReviewDate', '<=', today)
                .get();

            if (docsSnap.empty) return;

            // H2: batch chunking to avoid 500-op limit
            const BATCH_LIMIT = 450;
            let batch = db.batch();
            let batchCount = 0;

            for (const doc of docsSnap.docs) {
                const document = doc.data();
                if (document.ownerId) {
                    // Check if overdue or exactly today
                    if (document.nextReviewDate <= today) {
                        const link = `/documents/${doc.id}?view=preview`;
                        const type = 'DOC_REVIEW';

                        const alreadySent = await this.checkIfAlreadyNotified(db, document.ownerId, link, type);
                        if (alreadySent) continue;

                        const opsAdded = await this.queueNotification(batch, db, {
                            userId: document.ownerId,
                            organizationId: orgId,
                            title: "Révision Documentaire",
                            message: `Le document "${document.title}" doit être révisé.`,
                            link,
                            type,
                            emailHtml: getDocumentReviewHtml(document.title, "Propriétaire", document.nextReviewDate, `${appBaseUrl.value()}/documents/${doc.id}`)
                        });
                        batchCount += opsAdded;

                        if (batchCount >= BATCH_LIMIT) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    }
                }
            }
            if (batchCount > 0) await batch.commit();

        } catch (error) {
            logger.error(`Error checking docs for org ${orgId}`, error);
        }
    }

    /**
     * 3. Check Risk Treatments Due & Enforce SLA
     */
    static async checkRiskTreatments(db, orgId, orgName) {
        const today = new Date().toISOString().split('T')[0];

        try {
            const risksSnap = await db.collection('risks')
                .where('organizationId', '==', orgId)
                .where('status', 'in', ['Ouvert', 'En cours'])
                .get();

            if (risksSnap.empty) return;

            // H2: batch chunking to avoid 500-op limit
            const BATCH_LIMIT = 450;
            let batch = db.batch();
            let batchCount = 0;
            let updatesCount = 0;

            for (const doc of risksSnap.docs) {
                const risk = doc.data();
                if (risk.treatment) {
                    const treatment = risk.treatment;

                    if (!treatment.dueDate || !treatment.ownerId) continue;

                    const link = `/risk-assessment`;

                    // CASE 1: OVERDUE (Enforce SLA)
                    if (treatment.dueDate < today && treatment.status !== 'Terminé' && treatment.status !== 'Retard') {
                        // Update Risk Document
                        const riskRef = db.collection('risks').doc(doc.id);
                        batch.update(riskRef, {
                            'treatment.status': 'Retard',
                            'treatment.slaStatus': 'Dépassé',
                            'updatedAt': new Date().toISOString()
                        });
                        batchCount++;
                        updatesCount++;

                        const type = 'RISK_SLA_BREACH';
                        const alreadySent = await this.checkIfAlreadyNotified(db, treatment.ownerId, link, type);
                        if (!alreadySent) {
                            const opsAdded = await this.queueNotification(batch, db, {
                                userId: treatment.ownerId,
                                organizationId: orgId,
                                title: "Traitement en Retard (SLA Rompu)",
                                message: `Le plan de traitement pour "${risk.name}" est en retard. Statut mis à jour.`,
                                link,
                                type,
                                emailHtml: getRiskTreatmentDueHtml(risk.name, treatment.dueDate, "Responsable", `${appBaseUrl.value()}/risk-assessment`)
                            });
                            batchCount += opsAdded;
                        }

                        if (batchCount >= BATCH_LIMIT) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    }

                    // CASE 2: DUE TODAY (Reminder)
                    else if (treatment.dueDate === today && treatment.status !== 'Terminé') {
                        const type = 'RISK_TREATMENT_DUE';
                        const alreadySent = await this.checkIfAlreadyNotified(db, treatment.ownerId, link, type);
                        if (!alreadySent) {
                            const opsAdded = await this.queueNotification(batch, db, {
                                userId: treatment.ownerId,
                                organizationId: orgId,
                                title: "Échéance de Traitement Aujourd'hui",
                                message: `Le plan de traitement pour "${risk.name}" doit être terminé ce soir.`,
                                link,
                                type,
                                emailHtml: getRiskTreatmentDueHtml(risk.name, treatment.dueDate, "Responsable", `${appBaseUrl.value()}/risk-assessment`)
                            });
                            batchCount += opsAdded;

                            if (batchCount >= BATCH_LIMIT) {
                                await batch.commit();
                                batch = db.batch();
                                batchCount = 0;
                            }
                        }
                    }
                }
            }

            if (batchCount > 0) await batch.commit();
            if (updatesCount > 0) {
                logger.info(`Updated ${updatesCount} overdue risks for org ${orgId}`);
            }

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

            // H2: batch chunking to avoid 500-op limit
            const BATCH_LIMIT = 450;
            let batch = db.batch();
            let batchCount = 0;

            for (const doc of assetsSnap.docs) {
                const asset = doc.data();
                if (asset.ownerId) {
                    const link = `/asset-inventory`;
                    const type = 'ASSET_MAINTENANCE';
                    const alreadySent = await this.checkIfAlreadyNotified(db, asset.ownerId, link, type);

                    if (!alreadySent) {
                        const opsAdded = await this.queueNotification(batch, db, {
                            userId: asset.ownerId,
                            organizationId: orgId,
                            title: "Maintenance à venir",
                            message: `Maintenance prévue pour "${asset.name}" le ${asset.nextMaintenanceDate}.`,
                            link,
                            type,
                            emailHtml: getMaintenanceHtml(asset.name, asset.nextMaintenanceDate, "Propriétaire", `${appBaseUrl.value()}/asset-inventory`)
                        });
                        batchCount += opsAdded;

                        if (batchCount >= BATCH_LIMIT) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    }
                }
            }

            if (batchCount > 0) await batch.commit();

        } catch (error) {
            logger.error(`Error checking assets for org ${orgId}`, error);
        }
    }

    /**
     * Checks for Business Continuity Plans/Processes that haven't been tested in over a year.
     * @param {admin.firestore.Firestore} db
     * @param {string} organizationId
     */
    static async checkOverdueDrills(db, organizationId) {
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        const processesRef = db.collection('business_processes')
            .where('organizationId', '==', organizationId);

        try {
            const snapshot = await processesRef.get();
            if (snapshot.empty) return;

            // H2: batch chunking to avoid 500-op limit
            const BATCH_LIMIT = 450;
            let batch = db.batch();
            let batchCount = 0;
            let notificationCount = 0;

            for (const doc of snapshot.docs) {
                const process = doc.data();
                let shouldNotify = false;

                // Check if never tested and created > 1 year ago
                if (!process.lastTestDate) {
                    const createdAt = process.createdAt ? new Date(process.createdAt) : null;
                    if (createdAt && createdAt < oneYearAgo) {
                        shouldNotify = true;
                    }
                } else {
                    // Check if last test > 1 year ago
                    const lastTest = new Date(process.lastTestDate);
                    if (lastTest < oneYearAgo) {
                        shouldNotify = true;
                    }
                }

                if (shouldNotify && process.owner) {
                    // Notify organization admins
                    const adminsSnapshot = await db.collection('users')
                        .where('organizationId', '==', organizationId)
                        .where('role', 'in', ['admin', 'owner'])
                        .get();

                    for (const adminDoc of adminsSnapshot.docs) {
                        const adminUser = adminDoc.data();

                        // IDEMPOTENCY CHECK
                        const alreadyNotified = await this.checkIfAlreadyNotified(db, adminUser.uid, '/continuity', 'DRILL_OVERDUE', `drill_overdue_${process.id}_${new Date().toDateString()}`);

                        if (!alreadyNotified) {
                            const opsAdded = await this.queueNotification(batch, db, {
                                userId: adminUser.uid,
                                organizationId,
                                title: 'Exercice PCA Requis',
                                message: `Le processus "${process.name}" n'a pas été testé depuis plus d'un an. Une revue est nécessaire.`,
                                link: '/continuity',
                                type: 'DRILL_OVERDUE',
                                emailHtml: getDrillOverdueHtml(process.name, `${appBaseUrl.value()}/continuity`)
                            });
                            batchCount += opsAdded;
                            notificationCount++;

                            if (batchCount >= BATCH_LIMIT) {
                                await batch.commit();
                                batch = db.batch();
                                batchCount = 0;
                            }
                        }
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            if (notificationCount > 0) {
                logger.info(`Queued ${notificationCount} overdue drill notifications for org ${organizationId}`);
            }
        } catch (error) {
            logger.error(`Error checking drills for org ${organizationId}`, error);
        }
    }

    /**
     * Helper to add notification and email to batch.
     * H2: Returns operation count added so callers can track batch size.
     */
    static async queueNotification(batch, db, { userId, organizationId, title, message, link, type, emailHtml }) {
        if (!userId) return 0;

        let opsAdded = 0;

        // 1. Add In-App Notification
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            organizationId: organizationId || null,
            userId,
            title,
            message,
            link,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: type || 'SYSTEM'
        });
        opsAdded++;

        // 2. Add Email to Queue
        if (emailHtml) {
            try {
                // Fetch user to get email
                const userRecord = await getCachedUser(userId);
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
                    opsAdded++;
                }
            } catch (error) {
                logger.warn(`Could not find user ${userId} for email notification`, error);
            }
        }

        return opsAdded;
    }
}

module.exports = { NotificationManager };
