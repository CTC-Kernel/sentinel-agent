/**
 * NIS2 Incident Notification Timer - AUDIT FIX
 *
 * Conformité NIS 2 Article 23: Notification des incidents significatifs
 * - Notification initiale: 24h après détection
 * - Rapport intermédiaire: 72h après détection
 * - Rapport final: 1 mois après résolution
 *
 * Cette fonction vérifie les incidents significatifs et envoie des alertes
 * pour garantir le respect des délais réglementaires.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

// Délais NIS2 en millisecondes
const NIS2_DEADLINES = {
    INITIAL_NOTIFICATION: 24 * 60 * 60 * 1000,      // 24 heures
    INTERMEDIATE_REPORT: 72 * 60 * 60 * 1000,       // 72 heures
    FINAL_REPORT: 30 * 24 * 60 * 60 * 1000,         // 30 jours
    WARNING_THRESHOLD: 6 * 60 * 60 * 1000           // Alerte 6h avant deadline
};

/**
 * Calcule le temps restant avant une deadline
 */
function getTimeRemaining(detectedAt, deadlineMs) {
    const detected = new Date(detectedAt).getTime();
    const deadline = detected + deadlineMs;
    const now = Date.now();
    return deadline - now;
}

/**
 * Formate le temps restant en texte lisible
 */
function formatTimeRemaining(ms) {
    if (ms <= 0) return 'DÉPASSÉ';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days}j ${hours % 24}h`;
    }
    return `${hours}h ${minutes}min`;
}

/**
 * Envoie une notification d'alerte NIS2
 */
async function sendNIS2Alert(incident, organizationId, alertType, timeRemaining) {
    const { NotificationManager } = require('../services/notificationManager');

    // Récupérer les RSSI et admins de l'organisation
    const usersSnap = await db.collection('users')
        .where('organizationId', '==', organizationId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    const recipientIds = usersSnap.docs.map(d => d.id);

    if (recipientIds.length === 0) {
        logger.warn(`No admin/rssi found for org ${organizationId}`);
        return;
    }

    const alertMessages = {
        'initial_warning': {
            title: `⚠️ NIS2: Notification initiale requise - ${incident.title}`,
            message: `L'incident "${incident.title}" nécessite une notification initiale aux autorités dans ${formatTimeRemaining(timeRemaining)}. Délai légal: 24h après détection.`
        },
        'initial_overdue': {
            title: `🚨 NIS2: Notification initiale EN RETARD - ${incident.title}`,
            message: `URGENT: L'incident "${incident.title}" a dépassé le délai de notification initiale de 24h. Action immédiate requise.`
        },
        'intermediate_warning': {
            title: `⚠️ NIS2: Rapport intermédiaire requis - ${incident.title}`,
            message: `L'incident "${incident.title}" nécessite un rapport intermédiaire dans ${formatTimeRemaining(timeRemaining)}. Délai légal: 72h après détection.`
        },
        'intermediate_overdue': {
            title: `🚨 NIS2: Rapport intermédiaire EN RETARD - ${incident.title}`,
            message: `URGENT: L'incident "${incident.title}" a dépassé le délai de rapport intermédiaire de 72h. Action immédiate requise.`
        }
    };

    const alert = alertMessages[alertType];
    if (!alert) return;

    try {
        await NotificationManager.createNotification({
            organizationId,
            recipientIds,
            type: 'nis2_compliance',
            priority: alertType.includes('overdue') ? 'critical' : 'high',
            title: alert.title,
            message: alert.message,
            link: `/incidents?id=${incident.id}`,
            metadata: {
                incidentId: incident.id,
                alertType,
                deadline: alertType.includes('initial') ? '24h' : '72h',
                timeRemaining: formatTimeRemaining(timeRemaining)
            }
        });

        logger.info(`NIS2 alert sent: ${alertType} for incident ${incident.id}`);
    } catch (error) {
        logger.error(`Failed to send NIS2 alert for ${incident.id}:`, error);
    }
}

/**
 * Scheduled function: Vérifie les délais NIS2 toutes les heures
 */
exports.nis2DeadlineChecker = onSchedule({
    schedule: "every 1 hours",
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1'
}, async (event) => {
    logger.info("Starting NIS2 deadline check...");

    try {
        // Récupérer tous les incidents significatifs non fermés
        const incidentsSnap = await db.collectionGroup('incidents')
            .where('isSignificant', '==', true)
            .where('status', 'not-in', ['Fermé'])
            .get();

        if (incidentsSnap.empty) {
            logger.info("No significant incidents requiring NIS2 monitoring.");
            return;
        }

        logger.info(`Checking ${incidentsSnap.size} significant incidents...`);

        for (const doc of incidentsSnap.docs) {
            const incident = { id: doc.id, ...doc.data() };
            const detectedAt = incident.detectedAt || incident.dateReported;

            if (!detectedAt) {
                logger.warn(`Incident ${incident.id} has no detection date`);
                continue;
            }

            // Vérifier notification initiale (24h)
            if (incident.notificationStatus === 'Pending' || !incident.notificationStatus) {
                const timeToInitial = getTimeRemaining(detectedAt, NIS2_DEADLINES.INITIAL_NOTIFICATION);

                if (timeToInitial <= 0) {
                    // Deadline dépassée
                    await sendNIS2Alert(incident, incident.organizationId, 'initial_overdue', timeToInitial);
                } else if (timeToInitial <= NIS2_DEADLINES.WARNING_THRESHOLD) {
                    // Alerte préventive
                    await sendNIS2Alert(incident, incident.organizationId, 'initial_warning', timeToInitial);
                }
            }

            // Vérifier rapport intermédiaire (72h)
            if (incident.notificationStatus === 'Reported' && !incident.intermediateReportSubmitted) {
                const timeToIntermediate = getTimeRemaining(detectedAt, NIS2_DEADLINES.INTERMEDIATE_REPORT);

                if (timeToIntermediate <= 0) {
                    await sendNIS2Alert(incident, incident.organizationId, 'intermediate_overdue', timeToIntermediate);
                } else if (timeToIntermediate <= NIS2_DEADLINES.WARNING_THRESHOLD) {
                    await sendNIS2Alert(incident, incident.organizationId, 'intermediate_warning', timeToIntermediate);
                }
            }

            // Mettre à jour le statut de deadline dans l'incident
            const timeToInitial = getTimeRemaining(detectedAt, NIS2_DEADLINES.INITIAL_NOTIFICATION);
            const timeToIntermediate = getTimeRemaining(detectedAt, NIS2_DEADLINES.INTERMEDIATE_REPORT);

            await doc.ref.update({
                nis2Deadlines: {
                    initialNotification: {
                        deadline: new Date(new Date(detectedAt).getTime() + NIS2_DEADLINES.INITIAL_NOTIFICATION).toISOString(),
                        remaining: timeToInitial,
                        status: timeToInitial <= 0 ? 'overdue' : (timeToInitial <= NIS2_DEADLINES.WARNING_THRESHOLD ? 'warning' : 'ok')
                    },
                    intermediateReport: {
                        deadline: new Date(new Date(detectedAt).getTime() + NIS2_DEADLINES.INTERMEDIATE_REPORT).toISOString(),
                        remaining: timeToIntermediate,
                        status: timeToIntermediate <= 0 ? 'overdue' : (timeToIntermediate <= NIS2_DEADLINES.WARNING_THRESHOLD ? 'warning' : 'ok')
                    },
                    lastChecked: new Date().toISOString()
                }
            });
        }

        logger.info("NIS2 deadline check completed.");

    } catch (error) {
        logger.error("Error in NIS2 deadline checker:", error);
    }
});

/**
 * Trigger: Quand un incident devient significatif
 * Configure automatiquement le suivi NIS2
 */
exports.onSignificantIncident = onDocumentUpdated({
    document: 'incidents/{incidentId}',
    region: 'europe-west1'
}, async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Vérifier si l'incident vient de devenir significatif
    if (!before.isSignificant && after.isSignificant) {
        logger.info(`Incident ${event.params.incidentId} marked as significant - initializing NIS2 tracking`);

        const detectedAt = after.detectedAt || after.dateReported || new Date().toISOString();

        await event.data.after.ref.update({
            detectedAt: detectedAt,
            notificationStatus: 'Pending',
            nis2Deadlines: {
                initialNotification: {
                    deadline: new Date(new Date(detectedAt).getTime() + NIS2_DEADLINES.INITIAL_NOTIFICATION).toISOString(),
                    status: 'pending'
                },
                intermediateReport: {
                    deadline: new Date(new Date(detectedAt).getTime() + NIS2_DEADLINES.INTERMEDIATE_REPORT).toISOString(),
                    status: 'pending'
                },
                initialized: new Date().toISOString()
            }
        });

        // Envoyer notification immédiate aux responsables
        await sendNIS2Alert(
            { id: event.params.incidentId, ...after },
            after.organizationId,
            'initial_warning',
            NIS2_DEADLINES.INITIAL_NOTIFICATION
        );
    }
});

/**
 * Trigger: Création d'un incident significatif
 */
exports.onNewSignificantIncident = onDocumentCreated({
    document: 'incidents/{incidentId}',
    region: 'europe-west1'
}, async (event) => {
    const incident = event.data.data();

    if (incident.isSignificant) {
        logger.info(`New significant incident ${event.params.incidentId} created - initializing NIS2 tracking`);

        const detectedAt = incident.detectedAt || incident.dateReported || new Date().toISOString();

        await event.data.ref.update({
            detectedAt: detectedAt,
            notificationStatus: 'Pending',
            nis2Deadlines: {
                initialNotification: {
                    deadline: new Date(new Date(detectedAt).getTime() + NIS2_DEADLINES.INITIAL_NOTIFICATION).toISOString(),
                    status: 'pending'
                },
                intermediateReport: {
                    deadline: new Date(new Date(detectedAt).getTime() + NIS2_DEADLINES.INTERMEDIATE_REPORT).toISOString(),
                    status: 'pending'
                },
                initialized: new Date().toISOString()
            }
        });
    }
});
