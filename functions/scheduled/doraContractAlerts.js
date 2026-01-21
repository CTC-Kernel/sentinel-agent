/**
 * Scheduled Function: DORA Contract Expiration Alerts
 * Story 35-4: Contract Expiration Alerts
 *
 * Runs daily to:
 * 1. Identify ICT provider contracts expiring within 90 days
 * 2. Classify urgency (critical: 30d, warning: 60d, notice: 90d)
 * 3. Send notifications to organization admins
 * 4. Send weekly email digest
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString } = require("firebase-functions/params");

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

// Expiration thresholds
const DEFAULT_THRESHOLDS = {
    critical: 30,
    warning: 60,
    notice: 90
};

/**
 * Parse date from various formats
 */
function parseDate(dateValue) {
    if (!dateValue) return null;

    if (dateValue.toDate) {
        return dateValue.toDate();
    } else if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? null : date;
    } else if (dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
    } else if (typeof dateValue === 'number') {
        return new Date(dateValue);
    }

    return null;
}

/**
 * Calculate days remaining until expiration
 */
function calculateDaysRemaining(endDate) {
    const date = parseDate(endDate);
    if (!date) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Classify urgency based on days remaining
 */
function classifyUrgency(daysRemaining, thresholds = DEFAULT_THRESHOLDS) {
    if (daysRemaining <= 0) return 'expired';
    if (daysRemaining <= thresholds.critical) return 'critical';
    if (daysRemaining <= thresholds.warning) return 'warning';
    if (daysRemaining <= thresholds.notice) return 'notice';
    return null;
}

/**
 * Email template for contract expiration alert
 */
function getContractExpirationEmailTemplate(orgName, expiringContracts, link) {
    const { expired, critical, warning, notice } = expiringContracts;

    const formatProviderRow = (contract) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${contract.providerName}</td>
            <td style="padding: 12px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;
                    ${contract.category === 'critical' ? 'background-color: #fee2e2; color: #dc2626;' :
                      contract.category === 'important' ? 'background-color: #fef3c7; color: #d97706;' :
                      'background-color: #f1f5f9; color: #64748b;'}">
                    ${contract.category}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                ${contract.daysRemaining <= 0 ?
                    '<span style="color: #6b7280; font-weight: 600;">Expiré</span>' :
                    `<span style="font-weight: 600; ${contract.daysRemaining <= 30 ? 'color: #dc2626;' : contract.daysRemaining <= 60 ? 'color: #d97706;' : 'color: #ca8a04;'}">${contract.daysRemaining}j</span>`
                }
            </td>
            <td style="padding: 12px;">${contract.endDate}</td>
            <td style="padding: 12px;">
                ${contract.hasExitStrategy ? '<span style="color: #10b981;">✓</span>' : '<span style="color: #dc2626;">✗</span>'}
            </td>
        </tr>
    `;

    const allContracts = [...expired, ...critical, ...warning, ...notice];
    const providerRows = allContracts.slice(0, 10).map(formatProviderRow).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Sentinel <span style="color: #2563eb;">GRC</span>
                </div>
            </div>
            <div style="padding: 32px 0;">
                <div style="background-color: ${expired.length > 0 || critical.length > 0 ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${expired.length > 0 || critical.length > 0 ? '#dc2626' : '#f59e0b'}; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; color: ${expired.length > 0 || critical.length > 0 ? '#dc2626' : '#d97706'}; margin: 0; font-weight: 700;">Alerte DORA - Contrats ICT</h2>
                </div>

                <p>Bonjour,</p>
                <p>Voici le récapitulatif des contrats fournisseurs ICT nécessitant votre attention (DORA Art. 28).</p>

                <div style="display: flex; gap: 12px; margin: 24px 0; flex-wrap: wrap;">
                    ${expired.length > 0 ? `
                    <div style="flex: 1; min-width: 100px; background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #64748b;">${expired.length}</div>
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Expiré(s)</div>
                    </div>
                    ` : ''}
                    <div style="flex: 1; min-width: 100px; background-color: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${critical.length}</div>
                        <div style="font-size: 11px; color: #b91c1c; text-transform: uppercase; font-weight: 600;">&lt; 30 jours</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; background-color: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #d97706;">${warning.length}</div>
                        <div style="font-size: 11px; color: #b45309; text-transform: uppercase; font-weight: 600;">&lt; 60 jours</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; background-color: #fef9c3; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #ca8a04;">${notice.length}</div>
                        <div style="font-size: 11px; color: #a16207; text-transform: uppercase; font-weight: 600;">&lt; 90 jours</div>
                    </div>
                </div>

                ${allContracts.length > 0 ? `
                <h3 style="font-size: 16px; color: #0f172a; margin: 24px 0 12px;">Contrats à renouveler</h3>
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background-color: #e2e8f0;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Fournisseur</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Catégorie</th>
                            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b;">Délai</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Fin Contrat</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Exit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${providerRows}
                    </tbody>
                </table>
                ${allContracts.length > 10 ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;">... et ${allContracts.length - 10} autre(s) contrat(s)</p>` : ''}
                ` : ''}

                <div style="text-align: center; margin-top: 32px;">
                    <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Gérer les Contrats ICT</a>
                </div>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <strong>Rappel DORA :</strong> L'article 28 du règlement DORA impose aux entités financières de maintenir
                        des arrangements contractuels appropriés avec leurs fournisseurs de services ICT, incluant des stratégies
                        de sortie documentées.
                    </p>
                </div>
            </div>
            <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
                <p>&copy; ${new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.</p>
            </div>
        </div>
    `;
}

/**
 * Process contract expiration alerts for a single organization
 */
async function processOrganizationContractAlerts(db, orgId, orgName, thresholds = DEFAULT_THRESHOLDS) {
    const providersSnap = await db.collection('ict_providers')
        .where('organizationId', '==', orgId)
        .where('status', '==', 'active')
        .get();

    if (providersSnap.empty) {
        return { orgId, total: 0, processed: false };
    }

    const expiringContracts = {
        expired: [],
        critical: [],
        warning: [],
        notice: []
    };

    providersSnap.docs.forEach(doc => {
        const provider = { id: doc.id, ...doc.data() };
        const endDate = provider.contractInfo?.endDate;

        if (!endDate) return;

        const daysRemaining = calculateDaysRemaining(endDate);
        if (daysRemaining === null) return;

        const urgency = classifyUrgency(daysRemaining, thresholds);
        if (!urgency) return;

        const contract = {
            providerId: provider.id,
            providerName: provider.name,
            category: provider.category,
            endDate: parseDate(endDate)?.toISOString().split('T')[0] || '',
            daysRemaining,
            urgency,
            hasExitStrategy: !!provider.contractInfo?.exitStrategy,
            hasAuditRights: provider.contractInfo?.auditRights || false
        };

        expiringContracts[urgency].push(contract);
    });

    const total = expiringContracts.expired.length +
        expiringContracts.critical.length +
        expiringContracts.warning.length +
        expiringContracts.notice.length;

    // Only send notifications if there are expiring contracts
    if (total === 0) {
        return { orgId, total: 0, processed: true };
    }

    // Sort by days remaining
    Object.values(expiringContracts).forEach(group => {
        group.sort((a, b) => a.daysRemaining - b.daysRemaining);
    });

    // Get admin users for this organization
    const adminsSnap = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    if (adminsSnap.empty) {
        logger.warn(`No admin users found for organization ${orgId}`);
        return { orgId, ...expiringContracts, total, processed: false };
    }

    const link = `${appBaseUrl.value()}/dora/providers`;
    const hasUrgent = expiringContracts.expired.length > 0 || expiringContracts.critical.length > 0;

    // Check if we've already sent a notification today
    const today = new Date().toISOString().split('T')[0];
    const existingNotifSnap = await db.collection('notifications')
        .where('organizationId', '==', orgId)
        .where('type', '==', 'dora_contract_expiring')
        .where('createdAt', '>=', today)
        .limit(1)
        .get();

    if (!existingNotifSnap.empty) {
        logger.info(`Skipping organization ${orgId} - notification already sent today`);
        return { orgId, ...expiringContracts, total, processed: false };
    }

    // Determine notification title based on urgency
    let notifTitle, notifMessage;
    if (expiringContracts.expired.length > 0) {
        notifTitle = `DORA: ${expiringContracts.expired.length} contrat(s) expiré(s)`;
        notifMessage = `${total} contrat(s) nécessitent une attention immédiate.`;
    } else if (expiringContracts.critical.length > 0) {
        notifTitle = `DORA: ${expiringContracts.critical.length} contrat(s) expire(nt) sous 30j`;
        notifMessage = `${total} contrat(s) à renouveler prochainement.`;
    } else {
        notifTitle = `DORA: ${total} contrat(s) expire(nt) sous 90j`;
        notifMessage = `Planifiez les renouvellements à venir.`;
    }

    // Send notifications to admins
    for (const adminDoc of adminsSnap.docs) {
        const adminId = adminDoc.id;

        await db.collection('notifications').add({
            organizationId: orgId,
            userId: adminId,
            type: 'dora_contract_expiring',
            title: notifTitle,
            message: notifMessage,
            link: '/dora/providers',
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                expiredCount: expiringContracts.expired.length,
                criticalCount: expiringContracts.critical.length,
                warningCount: expiringContracts.warning.length,
                noticeCount: expiringContracts.notice.length
            }
        });
    }

    logger.info(`Sent contract expiration notifications for organization ${orgId}: ${total} expiring contracts`);

    return {
        orgId,
        expired: expiringContracts.expired.length,
        critical: expiringContracts.critical.length,
        warning: expiringContracts.warning.length,
        notice: expiringContracts.notice.length,
        total,
        processed: true
    };
}

/**
 * Process weekly email digest for contract expirations
 */
async function processWeeklyEmailDigest(db, orgId, orgName, thresholds = DEFAULT_THRESHOLDS) {
    const providersSnap = await db.collection('ict_providers')
        .where('organizationId', '==', orgId)
        .where('status', '==', 'active')
        .get();

    if (providersSnap.empty) {
        return { orgId, emailsSent: 0 };
    }

    const expiringContracts = {
        expired: [],
        critical: [],
        warning: [],
        notice: []
    };

    providersSnap.docs.forEach(doc => {
        const provider = { id: doc.id, ...doc.data() };
        const endDate = provider.contractInfo?.endDate;

        if (!endDate) return;

        const daysRemaining = calculateDaysRemaining(endDate);
        if (daysRemaining === null) return;

        const urgency = classifyUrgency(daysRemaining, thresholds);
        if (!urgency) return;

        const contract = {
            providerId: provider.id,
            providerName: provider.name,
            category: provider.category,
            endDate: parseDate(endDate)?.toISOString().split('T')[0] || '',
            daysRemaining,
            urgency,
            hasExitStrategy: !!provider.contractInfo?.exitStrategy
        };

        expiringContracts[urgency].push(contract);
    });

    const total = Object.values(expiringContracts).reduce((sum, arr) => sum + arr.length, 0);

    if (total === 0) {
        return { orgId, emailsSent: 0 };
    }

    // Get admin users for email
    const adminsSnap = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    if (adminsSnap.empty) {
        return { orgId, emailsSent: 0 };
    }

    const link = `${appBaseUrl.value()}/dora/providers`;
    let emailsSent = 0;

    for (const adminDoc of adminsSnap.docs) {
        const adminData = adminDoc.data();

        if (adminData.email) {
            const urgentCount = expiringContracts.expired.length + expiringContracts.critical.length;
            const subject = urgentCount > 0
                ? `[DORA] Alerte: ${urgentCount} contrat(s) ICT urgent(s) à renouveler`
                : `[DORA] ${total} contrat(s) ICT à renouveler prochainement`;

            await db.collection('mail_queue').add({
                to: adminData.email,
                message: {
                    subject,
                    html: getContractExpirationEmailTemplate(
                        orgName,
                        expiringContracts,
                        link
                    )
                },
                type: 'DORA_CONTRACT_EXPIRATION',
                metadata: {
                    organizationId: orgId,
                    total,
                    expiredCount: expiringContracts.expired.length,
                    criticalCount: expiringContracts.critical.length
                },
                status: 'PENDING',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            emailsSent++;
        }
    }

    return { orgId, emailsSent, total };
}

/**
 * Daily Contract Expiration Check
 * Runs every day at 7:00 AM UTC
 */
const dailyContractExpirationCheck = onSchedule({
    schedule: '0 7 * * *', // Every day at 7:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting daily DORA contract expiration check');

    try {
        const orgsSnap = await db.collection('organizations').get();

        if (orgsSnap.empty) {
            logger.info('No organizations found');
            return;
        }

        const results = [];

        for (const orgDoc of orgsSnap.docs) {
            const orgId = orgDoc.id;
            const orgData = orgDoc.data();

            try {
                const result = await processOrganizationContractAlerts(db, orgId, orgData.name || 'Organisation');
                results.push(result);
            } catch (error) {
                logger.error(`Error processing organization ${orgId}:`, error);
            }
        }

        const totalExpiring = results.reduce((sum, r) => sum + (r.total || 0), 0);
        const processedCount = results.filter(r => r.processed).length;

        logger.info(`Daily contract expiration check completed: ${processedCount} orgs processed, ${totalExpiring} total expiring contracts`);

        return {
            success: true,
            organizationsProcessed: processedCount,
            totalExpiringContracts: totalExpiring
        };

    } catch (error) {
        logger.error('Error in daily contract expiration check:', error);
        throw error;
    }
});

/**
 * Weekly Contract Expiration Email Digest
 * Runs every Monday at 8:30 AM UTC (after risk alerts)
 */
const weeklyContractExpirationDigest = onSchedule({
    schedule: '30 8 * * 1', // Every Monday at 8:30 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting weekly DORA contract expiration email digest');

    try {
        const orgsSnap = await db.collection('organizations').get();

        if (orgsSnap.empty) {
            logger.info('No organizations found');
            return;
        }

        let totalEmailsSent = 0;

        for (const orgDoc of orgsSnap.docs) {
            const orgId = orgDoc.id;
            const orgData = orgDoc.data();

            try {
                const result = await processWeeklyEmailDigest(db, orgId, orgData.name || 'Organisation');
                totalEmailsSent += result.emailsSent;
            } catch (error) {
                logger.error(`Error processing email digest for ${orgId}:`, error);
            }
        }

        logger.info(`Weekly contract expiration digest completed: ${totalEmailsSent} emails sent`);

        return {
            success: true,
            emailsSent: totalEmailsSent
        };

    } catch (error) {
        logger.error('Error in weekly contract expiration digest:', error);
        throw error;
    }
});

/**
 * Callable function to manually check contract expirations
 */
const checkContractExpirations = onCall({
    memory: '256MiB',
    timeoutSeconds: 120,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = request.auth.token.organizationId;
    const role = request.auth.token.role;

    if (role !== 'admin' && role !== 'rssi') {
        throw new HttpsError('permission-denied', 'Only admins can check contract expirations.');
    }

    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User has no organization.');
    }

    const db = admin.firestore();

    try {
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgName = orgDoc.exists ? orgDoc.data().name : 'Organisation';

        const result = await processOrganizationContractAlerts(db, organizationId, orgName);

        return {
            success: true,
            expired: result.expired || 0,
            critical: result.critical || 0,
            warning: result.warning || 0,
            notice: result.notice || 0,
            total: result.total || 0,
            notificationsSent: result.processed
        };
    } catch (error) {
        logger.error('Error in checkContractExpirations callable:', error);
        throw new HttpsError('internal', 'Failed to check contract expirations.');
    }
});

module.exports = {
    dailyContractExpirationCheck,
    weeklyContractExpirationDigest,
    checkContractExpirations,
    // Export for testing
    calculateDaysRemaining,
    classifyUrgency,
    processOrganizationContractAlerts,
    processWeeklyEmailDigest,
    DEFAULT_THRESHOLDS
};
