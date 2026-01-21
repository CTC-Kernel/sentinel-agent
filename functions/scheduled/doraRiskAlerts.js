/**
 * Scheduled Function: DORA ICT Provider Risk Alerts
 * Story 35-2: ICT Risk Assessment
 *
 * Runs weekly to:
 * 1. Identify high-risk ICT providers (concentration > 70 or critical with > 50)
 * 2. Identify providers with reassessments due (> 365 days since last assessment)
 * 3. Send notifications to organization admins
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString } = require("firebase-functions/params");

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

// Risk thresholds
const HIGH_RISK_CONCENTRATION_THRESHOLD = 70;
const CRITICAL_CONCENTRATION_THRESHOLD = 50;
const REASSESSMENT_THRESHOLD_DAYS = 365;

/**
 * Check if reassessment is due for a provider
 */
function isReassessmentDue(provider) {
    const lastAssessment = provider.riskAssessment?.lastAssessment;
    if (!lastAssessment) return true; // No assessment = overdue

    let date;
    if (lastAssessment.toDate) {
        date = lastAssessment.toDate();
    } else if (typeof lastAssessment === 'string') {
        date = new Date(lastAssessment);
    } else if (lastAssessment.seconds) {
        date = new Date(lastAssessment.seconds * 1000);
    } else {
        return true;
    }

    if (isNaN(date.getTime())) return true;

    const daysSince = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= REASSESSMENT_THRESHOLD_DAYS;
}

/**
 * Check if provider is high risk
 */
function isHighRisk(provider) {
    const concentration = provider.riskAssessment?.concentration || 0;
    return concentration > HIGH_RISK_CONCENTRATION_THRESHOLD ||
        (provider.category === 'critical' && concentration > CRITICAL_CONCENTRATION_THRESHOLD);
}

/**
 * Calculate overall risk score for a provider
 */
function calculateOverallRisk(provider) {
    const categoryWeight = { critical: 1.5, important: 1.2, standard: 1.0 };
    const substitutabilityImpact = { low: 20, medium: 10, high: 0 };

    const baseScore = provider.riskAssessment?.concentration || 0;
    const categoryMultiplier = categoryWeight[provider.category] || 1.0;
    const substitutabilityBonus = substitutabilityImpact[provider.riskAssessment?.substitutability || 'medium'];

    return Math.min(100, Math.round((baseScore * categoryMultiplier) + substitutabilityBonus));
}

/**
 * Email template for DORA risk alert
 */
function getDORARiskAlertTemplate(orgName, highRiskCount, reassessmentCount, providers, link) {
    const providerRows = providers.slice(0, 5).map(p => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${p.name}</td>
            <td style="padding: 12px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;
                    ${p.category === 'critical' ? 'background-color: #fee2e2; color: #dc2626;' :
                      p.category === 'important' ? 'background-color: #fef3c7; color: #d97706;' :
                      'background-color: #f1f5f9; color: #64748b;'}">
                    ${p.category}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">${p.riskAssessment?.concentration || 0}%</td>
            <td style="padding: 12px;">
                ${p.isHighRisk ? '<span style="color: #dc2626; font-weight: 600;">High Risk</span>' : ''}
                ${p.isReassessmentDue ? '<span style="color: #d97706; font-weight: 600;">Reassessment Due</span>' : ''}
            </td>
        </tr>
    `).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Sentinel <span style="color: #2563eb;">GRC</span>
                </div>
            </div>
            <div style="padding: 32px 0;">
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; color: #d97706; margin: 0; font-weight: 700;">Alerte DORA - Risques ICT</h2>
                </div>

                <p>Bonjour,</p>
                <p>Voici le rapport hebdomadaire des risques liés à vos fournisseurs ICT (DORA Art. 28).</p>

                <div style="display: flex; gap: 16px; margin: 24px 0;">
                    <div style="flex: 1; background-color: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: 700; color: #dc2626;">${highRiskCount}</div>
                        <div style="font-size: 12px; color: #b91c1c; text-transform: uppercase; font-weight: 600;">Fournisseurs à Haut Risque</div>
                    </div>
                    <div style="flex: 1; background-color: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: 700; color: #d97706;">${reassessmentCount}</div>
                        <div style="font-size: 12px; color: #b45309; text-transform: uppercase; font-weight: 600;">Réévaluations Requises</div>
                    </div>
                </div>

                ${providers.length > 0 ? `
                <h3 style="font-size: 16px; color: #0f172a; margin: 24px 0 12px;">Fournisseurs nécessitant une attention</h3>
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background-color: #e2e8f0;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Nom</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Catégorie</th>
                            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b;">Concentration</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${providerRows}
                    </tbody>
                </table>
                ${providers.length > 5 ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;">... et ${providers.length - 5} autre(s) fournisseur(s)</p>` : ''}
                ` : ''}

                <div style="text-align: center; margin-top: 32px;">
                    <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Voir le Registre ICT DORA</a>
                </div>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <strong>Rappel DORA :</strong> Le règlement DORA (Art. 28) exige une évaluation régulière des risques de concentration
                        et de dépendance envers les fournisseurs de services ICT critiques ou importants.
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
 * Process risk alerts for a single organization
 */
async function processOrganizationAlerts(db, orgId, orgName) {
    const providersSnap = await db.collection('ict_providers')
        .where('organizationId', '==', orgId)
        .where('status', '==', 'active')
        .get();

    if (providersSnap.empty) {
        return { orgId, highRiskCount: 0, reassessmentCount: 0, processed: false };
    }

    const highRiskProviders = [];
    const reassessmentDueProviders = [];
    const flaggedProviders = [];

    providersSnap.docs.forEach(doc => {
        const provider = { id: doc.id, ...doc.data() };
        const highRisk = isHighRisk(provider);
        const reassessmentDue = isReassessmentDue(provider);

        if (highRisk) {
            highRiskProviders.push(provider);
        }
        if (reassessmentDue) {
            reassessmentDueProviders.push(provider);
        }
        if (highRisk || reassessmentDue) {
            flaggedProviders.push({
                ...provider,
                isHighRisk: highRisk,
                isReassessmentDue: reassessmentDue,
                overallRisk: calculateOverallRisk(provider)
            });
        }
    });

    // Sort by overall risk (highest first)
    flaggedProviders.sort((a, b) => b.overallRisk - a.overallRisk);

    // Only send notifications if there are issues
    if (flaggedProviders.length === 0) {
        return { orgId, highRiskCount: 0, reassessmentCount: 0, processed: true };
    }

    // Get admin users for this organization
    const adminsSnap = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    if (adminsSnap.empty) {
        logger.warn(`No admin users found for organization ${orgId}`);
        return { orgId, highRiskCount: highRiskProviders.length, reassessmentCount: reassessmentDueProviders.length, processed: false };
    }

    const link = `${appBaseUrl.value()}/dora/providers`;

    // Check if we've already sent a notification this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const existingNotifSnap = await db.collection('notifications')
        .where('organizationId', '==', orgId)
        .where('type', '==', 'dora_risk_alert')
        .where('createdAt', '>=', oneWeekAgo)
        .limit(1)
        .get();

    if (!existingNotifSnap.empty) {
        logger.info(`Skipping organization ${orgId} - notification already sent this week`);
        return { orgId, highRiskCount: highRiskProviders.length, reassessmentCount: reassessmentDueProviders.length, processed: false };
    }

    // Send notifications to admins
    for (const adminDoc of adminsSnap.docs) {
        const adminId = adminDoc.id;
        const adminData = adminDoc.data();

        // Create in-app notification
        await db.collection('notifications').add({
            organizationId: orgId,
            userId: adminId,
            type: 'dora_risk_alert',
            title: `Alerte DORA: ${highRiskProviders.length} fournisseur(s) à haut risque`,
            message: `${reassessmentDueProviders.length} réévaluation(s) requise(s). Consultez le registre ICT.`,
            link: '/dora/providers',
            read: false,
            createdAt: new Date().toISOString()
        });

        // Queue email
        if (adminData.email) {
            await db.collection('mail_queue').add({
                to: adminData.email,
                message: {
                    subject: `[DORA] Alerte Risques ICT - ${highRiskProviders.length} fournisseur(s) à haut risque`,
                    html: getDORARiskAlertTemplate(
                        orgName,
                        highRiskProviders.length,
                        reassessmentDueProviders.length,
                        flaggedProviders,
                        link
                    )
                },
                type: 'DORA_RISK_ALERT',
                metadata: {
                    organizationId: orgId,
                    highRiskCount: highRiskProviders.length,
                    reassessmentCount: reassessmentDueProviders.length
                },
                status: 'PENDING',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    logger.info(`Sent DORA risk alerts for organization ${orgId}: ${highRiskProviders.length} high-risk, ${reassessmentDueProviders.length} reassessment due`);

    return {
        orgId,
        highRiskCount: highRiskProviders.length,
        reassessmentCount: reassessmentDueProviders.length,
        processed: true
    };
}

/**
 * Weekly DORA Risk Alert Function
 * Runs every Monday at 8:00 AM UTC
 */
const weeklyDORARiskAlerts = onSchedule({
    schedule: '0 8 * * 1', // Every Monday at 8:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting weekly DORA ICT risk alerts check');

    try {
        // Get all organizations
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
                const result = await processOrganizationAlerts(db, orgId, orgData.name || 'Organisation');
                results.push(result);
            } catch (error) {
                logger.error(`Error processing organization ${orgId}:`, error);
            }
        }

        const totalHighRisk = results.reduce((sum, r) => sum + r.highRiskCount, 0);
        const totalReassessment = results.reduce((sum, r) => sum + r.reassessmentCount, 0);
        const processedCount = results.filter(r => r.processed).length;

        logger.info(`Weekly DORA risk alerts completed: ${processedCount} orgs processed, ${totalHighRisk} total high-risk, ${totalReassessment} total reassessments due`);

        return {
            success: true,
            organizationsProcessed: processedCount,
            totalHighRiskProviders: totalHighRisk,
            totalReassessmentsDue: totalReassessment
        };

    } catch (error) {
        logger.error('Error in weekly DORA risk alerts:', error);
        throw error;
    }
});

/**
 * Callable function to manually trigger DORA risk check for an organization
 */
const checkDORARisks = onCall({
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
        throw new HttpsError('permission-denied', 'Only admins can trigger risk checks.');
    }

    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User has no organization.');
    }

    const db = admin.firestore();

    try {
        // Get organization name
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgName = orgDoc.exists ? orgDoc.data().name : 'Organisation';

        const result = await processOrganizationAlerts(db, organizationId, orgName);

        return {
            success: true,
            highRiskCount: result.highRiskCount,
            reassessmentCount: result.reassessmentCount,
            alertsSent: result.processed
        };
    } catch (error) {
        logger.error('Error in checkDORARisks callable:', error);
        throw new HttpsError('internal', 'Failed to check DORA risks.');
    }
});

module.exports = {
    weeklyDORARiskAlerts,
    checkDORARisks,
    // Export for testing
    isReassessmentDue,
    isHighRisk,
    calculateOverallRisk,
    processOrganizationAlerts,
    HIGH_RISK_CONCENTRATION_THRESHOLD,
    CRITICAL_CONCENTRATION_THRESHOLD,
    REASSESSMENT_THRESHOLD_DAYS
};
