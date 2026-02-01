/**
 * Scheduled Function: Certificate Expiration Alerts
 * NIS2 Article 21.2(h) - Cryptography compliance
 *
 * Runs daily to:
 * 1. Identify certificates expiring within configured thresholds
 * 2. Classify urgency (critical: 7d, warning: 30d, notice: 90d)
 * 3. Send in-app notifications to certificate owners and admins
 * 4. Send weekly email digest
 * 5. Update certificate status automatically
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { defineString } = require("firebase-functions/params");

const appBaseUrl = defineString("APP_BASE_URL", { default: "https://app.cyber-threat-consulting.com" });

/**
 * Escape HTML special characters to prevent XSS in email templates (H1 fix)
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Expiration thresholds (days)
const DEFAULT_THRESHOLDS = {
    critical: 7,
    warning: 30,
    notice: 90
};

// Alert thresholds for notifications (days before expiry)
const ALERT_THRESHOLDS = [90, 60, 30, 14, 7, 3, 1];

/**
 * Parse Firestore Timestamp or date string to Date
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
function calculateDaysRemaining(expiryDate) {
    const date = parseDate(expiryDate);
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
 * Determine certificate status based on expiry
 */
function determineCertificateStatus(daysRemaining) {
    if (daysRemaining <= 0) return 'expired';
    if (daysRemaining <= 30) return 'expiring_soon';
    return 'valid';
}

/**
 * Check if alert should be sent for this threshold
 */
function shouldSendAlert(daysRemaining, alertsSent = {}) {
    for (const threshold of ALERT_THRESHOLDS) {
        if (daysRemaining <= threshold && !alertsSent[`${threshold}d`]) {
            return { send: true, threshold };
        }
    }
    return { send: false, threshold: null };
}

/**
 * Email template for certificate expiration alert
 */
function getCertificateExpirationEmailTemplate(orgName, expiringCerts, link) {
    const { expired, critical, warning, notice } = expiringCerts;

    const formatCertRow = (cert) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${escapeHtml(cert.name)}</td>
            <td style="padding: 12px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;
                    ${cert.type === 'ssl_tls' ? 'background-color: #dbeafe; color: #2563eb;' :
                      cert.type === 'code_signing' ? 'background-color: #f3e8ff; color: #7c3aed;' :
                      'background-color: #f1f5f9; color: #64748b;'}">
                    ${escapeHtml(cert.type)}
                </span>
            </td>
            <td style="padding: 12px;">${escapeHtml(cert.commonName)}</td>
            <td style="padding: 12px; text-align: center;">
                ${cert.daysRemaining <= 0 ?
                    '<span style="color: #6b7280; font-weight: 600;">Expiré</span>' :
                    `<span style="font-weight: 600; ${cert.daysRemaining <= 7 ? 'color: #dc2626;' : cert.daysRemaining <= 30 ? 'color: #d97706;' : 'color: #ca8a04;'}">${cert.daysRemaining}j</span>`
                }
            </td>
            <td style="padding: 12px;">${cert.validTo}</td>
        </tr>
    `;

    const allCerts = [...expired, ...critical, ...warning, ...notice];
    const certRows = allCerts.slice(0, 10).map(formatCertRow).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Sentinel <span style="color: #2563eb;">GRC</span>
                </div>
            </div>
            <div style="padding: 32px 0;">
                <div style="background-color: ${expired.length > 0 || critical.length > 0 ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${expired.length > 0 || critical.length > 0 ? '#dc2626' : '#f59e0b'}; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; color: ${expired.length > 0 || critical.length > 0 ? '#dc2626' : '#d97706'}; margin: 0; font-weight: 700;">Alerte NIS2 - Certificats</h2>
                </div>

                <p>Bonjour,</p>
                <p>Voici le récapitulatif des certificats nécessitant votre attention (NIS2 Art. 21.2h - Cryptographie).</p>

                <div style="display: flex; gap: 12px; margin: 24px 0; flex-wrap: wrap;">
                    ${expired.length > 0 ? `
                    <div style="flex: 1; min-width: 100px; background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #64748b;">${expired.length}</div>
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Expiré(s)</div>
                    </div>
                    ` : ''}
                    <div style="flex: 1; min-width: 100px; background-color: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${critical.length}</div>
                        <div style="font-size: 11px; color: #b91c1c; text-transform: uppercase; font-weight: 600;">&lt; 7 jours</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; background-color: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #d97706;">${warning.length}</div>
                        <div style="font-size: 11px; color: #b45309; text-transform: uppercase; font-weight: 600;">&lt; 30 jours</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; background-color: #fef9c3; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #ca8a04;">${notice.length}</div>
                        <div style="font-size: 11px; color: #a16207; text-transform: uppercase; font-weight: 600;">&lt; 90 jours</div>
                    </div>
                </div>

                ${allCerts.length > 0 ? `
                <h3 style="font-size: 16px; color: #0f172a; margin: 24px 0 12px;">Certificats à renouveler</h3>
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background-color: #e2e8f0;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Nom</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Type</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Common Name</th>
                            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b;">Délai</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Expiration</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${certRows}
                    </tbody>
                </table>
                ${allCerts.length > 10 ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;">... et ${allCerts.length - 10} autre(s) certificat(s)</p>` : ''}
                ` : ''}

                <div style="text-align: center; margin-top: 32px;">
                    <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Gérer les Certificats</a>
                </div>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <strong>Rappel NIS2 :</strong> L'article 21.2(h) de la directive NIS2 impose aux entités essentielles
                        de mettre en œuvre des politiques et procédures relatives à l'utilisation de la cryptographie et,
                        le cas échéant, du chiffrement.
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
 * Process certificate expiration alerts for a single organization
 */
async function processOrganizationCertificateAlerts(db, orgId, orgName, thresholds = DEFAULT_THRESHOLDS) {
    const certsSnap = await db.collection('certificates')
        .where('organizationId', '==', orgId)
        .where('status', 'in', ['valid', 'expiring_soon'])
        .get();

    if (certsSnap.empty) {
        return { orgId, total: 0, processed: false };
    }

    const expiringCerts = {
        expired: [],
        critical: [],
        warning: [],
        notice: []
    };

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of certsSnap.docs) {
        const cert = { id: doc.id, ...doc.data() };
        const daysRemaining = calculateDaysRemaining(cert.validTo);

        if (daysRemaining === null) continue;

        const urgency = classifyUrgency(daysRemaining, thresholds);
        const newStatus = determineCertificateStatus(daysRemaining);

        // Update status if changed
        if (cert.status !== newStatus) {
            batch.update(doc.ref, {
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            batchCount++;
        }

        // Check if we should send an alert
        const alertCheck = shouldSendAlert(daysRemaining, cert.alertsSent || {});

        if (alertCheck.send) {
            // Mark alert as sent
            const alertsSent = cert.alertsSent || {};
            alertsSent[`${alertCheck.threshold}d`] = new Date().toISOString();

            batch.update(doc.ref, {
                alertsSent,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            batchCount++;
        }

        if (!urgency) continue;

        const certInfo = {
            certId: cert.id,
            name: cert.name,
            type: cert.type,
            commonName: cert.commonName,
            validTo: parseDate(cert.validTo)?.toISOString().split('T')[0] || '',
            daysRemaining,
            urgency,
            owner: cert.owner || null,
            ownerEmail: cert.ownerEmail || null,
            autoRenew: cert.autoRenew || false
        };

        expiringCerts[urgency].push(certInfo);
    }

    // Commit batch updates
    if (batchCount > 0) {
        await batch.commit();
    }

    const total = expiringCerts.expired.length +
        expiringCerts.critical.length +
        expiringCerts.warning.length +
        expiringCerts.notice.length;

    if (total === 0) {
        return { orgId, total: 0, processed: true };
    }

    // Sort by days remaining
    Object.values(expiringCerts).forEach(group => {
        group.sort((a, b) => a.daysRemaining - b.daysRemaining);
    });

    // Get admin users for this organization
    const adminsSnap = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    if (adminsSnap.empty) {
        logger.warn(`No admin users found for organization ${orgId}`);
        return { orgId, ...expiringCerts, total, processed: false };
    }

    // Check if we've already sent a notification today
    const today = new Date().toISOString().split('T')[0];
    const existingNotifSnap = await db.collection('notifications')
        .where('organizationId', '==', orgId)
        .where('type', '==', 'nis2_certificate_expiring')
        .where('createdAt', '>=', today)
        .limit(1)
        .get();

    if (!existingNotifSnap.empty) {
        logger.info(`Skipping organization ${orgId} - notification already sent today`);
        return { orgId, ...expiringCerts, total, processed: false };
    }

    // Determine notification title based on urgency
    let notifTitle, notifMessage;
    if (expiringCerts.expired.length > 0) {
        notifTitle = `NIS2: ${expiringCerts.expired.length} certificat(s) expiré(s)`;
        notifMessage = `${total} certificat(s) nécessitent une attention immédiate.`;
    } else if (expiringCerts.critical.length > 0) {
        notifTitle = `NIS2: ${expiringCerts.critical.length} certificat(s) expire(nt) sous 7j`;
        notifMessage = `${total} certificat(s) à renouveler de toute urgence.`;
    } else {
        notifTitle = `NIS2: ${total} certificat(s) expire(nt) sous 90j`;
        notifMessage = `Planifiez les renouvellements à venir.`;
    }

    // Send notifications to admins
    for (const adminDoc of adminsSnap.docs) {
        const adminId = adminDoc.id;

        await db.collection('notifications').add({
            organizationId: orgId,
            userId: adminId,
            type: 'nis2_certificate_expiring',
            title: notifTitle,
            message: notifMessage,
            link: '/nis2/certificates',
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                expiredCount: expiringCerts.expired.length,
                criticalCount: expiringCerts.critical.length,
                warningCount: expiringCerts.warning.length,
                noticeCount: expiringCerts.notice.length
            }
        });
    }

    logger.info(`Sent certificate expiration notifications for organization ${orgId}: ${total} expiring certificates`);

    return {
        orgId,
        expired: expiringCerts.expired.length,
        critical: expiringCerts.critical.length,
        warning: expiringCerts.warning.length,
        notice: expiringCerts.notice.length,
        total,
        processed: true
    };
}

/**
 * Process weekly email digest for certificate expirations
 */
async function processWeeklyEmailDigest(db, orgId, orgName, thresholds = DEFAULT_THRESHOLDS) {
    const certsSnap = await db.collection('certificates')
        .where('organizationId', '==', orgId)
        .where('status', 'in', ['valid', 'expiring_soon', 'expired'])
        .get();

    if (certsSnap.empty) {
        return { orgId, emailsSent: 0 };
    }

    const expiringCerts = {
        expired: [],
        critical: [],
        warning: [],
        notice: []
    };

    certsSnap.docs.forEach(doc => {
        const cert = { id: doc.id, ...doc.data() };
        const daysRemaining = calculateDaysRemaining(cert.validTo);

        if (daysRemaining === null) return;

        const urgency = classifyUrgency(daysRemaining, thresholds);
        if (!urgency) return;

        const certInfo = {
            certId: cert.id,
            name: cert.name,
            type: cert.type,
            commonName: cert.commonName,
            validTo: parseDate(cert.validTo)?.toISOString().split('T')[0] || '',
            daysRemaining,
            urgency
        };

        expiringCerts[urgency].push(certInfo);
    });

    const total = Object.values(expiringCerts).reduce((sum, arr) => sum + arr.length, 0);

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

    const link = `${appBaseUrl.value()}/nis2/certificates`;
    let emailsSent = 0;

    for (const adminDoc of adminsSnap.docs) {
        const adminData = adminDoc.data();

        if (adminData.email) {
            const urgentCount = expiringCerts.expired.length + expiringCerts.critical.length;
            const subject = urgentCount > 0
                ? `[NIS2] Alerte: ${urgentCount} certificat(s) critique(s) à renouveler`
                : `[NIS2] ${total} certificat(s) à renouveler prochainement`;

            await db.collection('mail_queue').add({
                to: adminData.email,
                message: {
                    subject,
                    html: getCertificateExpirationEmailTemplate(
                        orgName,
                        expiringCerts,
                        link
                    )
                },
                type: 'NIS2_CERTIFICATE_EXPIRATION',
                metadata: {
                    organizationId: orgId,
                    total,
                    expiredCount: expiringCerts.expired.length,
                    criticalCount: expiringCerts.critical.length
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
 * Daily Certificate Expiration Check
 * Runs every day at 6:00 AM UTC
 */
const dailyCertificateExpirationCheck = onSchedule({
    schedule: '0 6 * * *', // Every day at 6:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting daily NIS2 certificate expiration check');

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
                const result = await processOrganizationCertificateAlerts(db, orgId, orgData.name || 'Organisation');
                results.push(result);
            } catch (error) {
                logger.error(`Error processing organization ${orgId}:`, error);
            }
        }

        const totalExpiring = results.reduce((sum, r) => sum + (r.total || 0), 0);
        const processedCount = results.filter(r => r.processed).length;

        logger.info(`Daily certificate expiration check completed: ${processedCount} orgs processed, ${totalExpiring} total expiring certificates`);

        return {
            success: true,
            organizationsProcessed: processedCount,
            totalExpiringCertificates: totalExpiring
        };

    } catch (error) {
        logger.error('Error in daily certificate expiration check:', error);
        throw error;
    }
});

/**
 * Weekly Certificate Expiration Email Digest
 * Runs every Monday at 7:00 AM UTC
 */
const weeklyCertificateExpirationDigest = onSchedule({
    schedule: '0 7 * * 1', // Every Monday at 7:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting weekly NIS2 certificate expiration email digest');

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

        logger.info(`Weekly certificate expiration digest completed: ${totalEmailsSent} emails sent`);

        return {
            success: true,
            emailsSent: totalEmailsSent
        };

    } catch (error) {
        logger.error('Error in weekly certificate expiration digest:', error);
        throw error;
    }
});

/**
 * Callable function to manually check certificate expirations
 */
const checkCertificateExpirations = onCall({
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
        throw new HttpsError('permission-denied', 'Only admins can check certificate expirations.');
    }

    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User has no organization.');
    }

    const db = admin.firestore();

    try {
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgName = orgDoc.exists ? orgDoc.data().name : 'Organisation';

        const result = await processOrganizationCertificateAlerts(db, organizationId, orgName);

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
        logger.error('Error in checkCertificateExpirations callable:', error);
        throw new HttpsError('internal', 'Failed to check certificate expirations.');
    }
});

module.exports = {
    dailyCertificateExpirationCheck,
    weeklyCertificateExpirationDigest,
    checkCertificateExpirations,
    // Export for testing
    calculateDaysRemaining,
    classifyUrgency,
    determineCertificateStatus,
    shouldSendAlert,
    processOrganizationCertificateAlerts,
    processWeeklyEmailDigest,
    DEFAULT_THRESHOLDS,
    ALERT_THRESHOLDS
};
