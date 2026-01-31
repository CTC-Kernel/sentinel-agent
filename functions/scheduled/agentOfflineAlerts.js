/**
 * Scheduled Function: Agent Offline Alerts
 * Sprint 1 - Task 1.3
 *
 * Runs every 5 minutes to:
 * 1. Identify agents that haven't sent heartbeat in > 3 minutes (offline)
 * 2. Identify agents that transitioned from online to offline since last check
 * 3. Send notifications to organization admins
 * 4. Create in-app notifications
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString } = require("firebase-functions/params");

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

// Thresholds
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes - same as frontend
const ERROR_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes - escalate to error

/**
 * Compute agent status from lastHeartbeat
 */
function computeAgentStatus(lastHeartbeat) {
    if (!lastHeartbeat) return 'offline';

    const now = Date.now();
    let heartbeatTime;

    if (lastHeartbeat.toDate) {
        heartbeatTime = lastHeartbeat.toDate().getTime();
    } else if (typeof lastHeartbeat === 'string') {
        heartbeatTime = new Date(lastHeartbeat).getTime();
    } else if (lastHeartbeat.seconds) {
        heartbeatTime = lastHeartbeat.seconds * 1000;
    } else {
        return 'offline';
    }

    const diff = now - heartbeatTime;

    if (diff >= ERROR_THRESHOLD_MS) return 'error';
    if (diff >= OFFLINE_THRESHOLD_MS) return 'offline';
    return 'active';
}

/**
 * Format time since last heartbeat
 */
function formatTimeSince(lastHeartbeat) {
    if (!lastHeartbeat) return 'jamais';

    let heartbeatTime;
    if (lastHeartbeat.toDate) {
        heartbeatTime = lastHeartbeat.toDate().getTime();
    } else if (typeof lastHeartbeat === 'string') {
        heartbeatTime = new Date(lastHeartbeat).getTime();
    } else if (lastHeartbeat.seconds) {
        heartbeatTime = lastHeartbeat.seconds * 1000;
    } else {
        return 'inconnu';
    }

    const diff = Date.now() - heartbeatTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}min`;
    }
    return `${minutes} min`;
}

/**
 * Email template for agent offline alert
 */
function getAgentOfflineAlertTemplate(orgName, offlineAgents, link) {
    const agentRows = offlineAgents.slice(0, 10).map(agent => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${agent.hostname || agent.name || agent.id}</td>
            <td style="padding: 12px;">${agent.os || 'N/A'}</td>
            <td style="padding: 12px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;
                    ${agent.computedStatus === 'error' ? 'background-color: #fee2e2; color: #dc2626;' : 'background-color: #fef3c7; color: #d97706;'}">
                    ${agent.computedStatus === 'error' ? 'Erreur' : 'Hors ligne'}
                </span>
            </td>
            <td style="padding: 12px; color: #64748b;">${agent.timeSince}</td>
        </tr>
    `).join('');

    const moreText = offlineAgents.length > 10
        ? `<p style="color: #64748b; font-size: 14px;">... et ${offlineAgents.length - 10} autre(s) agent(s)</p>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
                ⚠️ Alerte Agents Hors Ligne
            </h1>
        </div>

        <!-- Content -->
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Bonjour,
            </p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                <strong>${offlineAgents.length} agent(s)</strong> de l'organisation <strong>${orgName}</strong>
                ${offlineAgents.length === 1 ? "n'a" : "n'ont"} pas envoyé de signal depuis plus de 3 minutes.
            </p>

            <!-- Agents Table -->
            <div style="margin: 24px 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f8fafc;">
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Agent</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">OS</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Statut</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Dernier signal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${agentRows}
                    </tbody>
                </table>
                ${moreText}
            </div>

            <!-- Warning Box -->
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⚠️ Impact potentiel :</strong> Les agents hors ligne ne peuvent pas remonter les données de conformité.
                    Vérifiez que les machines sont allumées et connectées au réseau.
                </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Voir les agents →
                </a>
            </div>

            <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 32px;">
                Cette alerte est envoyée automatiquement par Sentinel GRC lorsqu'un agent ne répond plus.
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Sentinel GRC - Cyber Threat Consulting</p>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Scheduled check for offline agents - runs every 5 minutes
 */
const checkAgentOfflineAlerts = onSchedule(
    {
        schedule: "every 5 minutes",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 120,
    },
    async () => {
        const db = admin.firestore();
        const now = Date.now();

        logger.info("Starting agent offline check...");

        try {
            // Get all organizations
            const orgsSnapshot = await db.collection("organizations").get();

            for (const orgDoc of orgsSnapshot.docs) {
                const orgId = orgDoc.id;
                const orgData = orgDoc.data();
                const orgName = orgData.name || orgData.companyName || "Organisation";

                // Get all agents for this organization
                const agentsSnapshot = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("agents")
                    .get();

                if (agentsSnapshot.empty) continue;

                // Find newly offline agents
                const offlineAgents = [];
                const BATCH_LIMIT = 499;
                let batch = db.batch();
                let batchCount = 0;

                for (const agentDoc of agentsSnapshot.docs) {
                    const agent = agentDoc.data();
                    const computedStatus = computeAgentStatus(agent.lastHeartbeat);
                    const previousStatus = agent.alertedStatus || 'active';

                    // Check if agent just went offline (wasn't already alerted)
                    if ((computedStatus === 'offline' || computedStatus === 'error') && previousStatus === 'active') {
                        offlineAgents.push({
                            id: agentDoc.id,
                            ...agent,
                            computedStatus,
                            timeSince: formatTimeSince(agent.lastHeartbeat),
                        });

                        // Update alertedStatus to prevent duplicate alerts
                        batch.update(agentDoc.ref, {
                            alertedStatus: computedStatus,
                            alertedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        batchCount++;
                    }
                    // Reset alertedStatus if agent came back online
                    else if (computedStatus === 'active' && previousStatus !== 'active') {
                        batch.update(agentDoc.ref, {
                            alertedStatus: 'active',
                            alertedAt: null,
                        });
                        batchCount++;
                    }

                    // Firestore batch limit is 500 operations; commit and reset if approaching limit
                    if (batchCount >= BATCH_LIMIT) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }

                // Commit remaining batch updates
                if (batchCount > 0) {
                    await batch.commit();
                }

                // Send alerts if there are newly offline agents
                if (offlineAgents.length > 0) {
                    logger.info(`Found ${offlineAgents.length} newly offline agents for org ${orgId}`);

                    // Get org admins
                    const adminsSnapshot = await db
                        .collection("users")
                        .where("organizationId", "==", orgId)
                        .where("role", "in", ["admin", "rssi"])
                        .get();

                    const adminEmails = adminsSnapshot.docs
                        .map(doc => doc.data().email)
                        .filter(email => email);

                    if (adminEmails.length === 0) {
                        logger.warn(`No admins found for org ${orgId}, skipping email notification`);
                    } else {
                        // Queue email notification
                        const link = `${appBaseUrl.value()}/#/settings?tab=agents`;

                        for (const adminEmail of adminEmails) {
                            await db.collection("mail").add({
                                to: adminEmail,
                                message: {
                                    subject: `⚠️ Sentinel GRC - ${offlineAgents.length} agent(s) hors ligne`,
                                    html: getAgentOfflineAlertTemplate(orgName, offlineAgents, link),
                                },
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                status: "PENDING",
                            });
                        }

                        logger.info(`Queued email alerts to ${adminEmails.length} admins`);
                    }

                    // Create in-app notifications for all org admins
                    for (const adminDoc of adminsSnapshot.docs) {
                        await db
                            .collection("users")
                            .doc(adminDoc.id)
                            .collection("notifications")
                            .add({
                                type: "agent_offline",
                                title: `${offlineAgents.length} agent(s) hors ligne`,
                                message: `Les agents suivants ne répondent plus : ${offlineAgents.slice(0, 3).map(a => a.hostname || a.name || a.id).join(", ")}${offlineAgents.length > 3 ? ` et ${offlineAgents.length - 3} autre(s)` : ""}`,
                                link: "/settings?tab=agents",
                                read: false,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                data: {
                                    agentIds: offlineAgents.map(a => a.id),
                                    count: offlineAgents.length,
                                },
                            });
                    }

                    logger.info(`Created in-app notifications for org ${orgId}`);
                }
            }

            logger.info("Agent offline check completed");
        } catch (error) {
            logger.error("Error in agent offline check:", error);
            throw error;
        }
    }
);

module.exports = {
    checkAgentOfflineAlerts,
};
