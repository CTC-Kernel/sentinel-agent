/**
 * Scheduled Function: Access Review Alerts
 * NIS2 Article 21.2(i) - Access control compliance
 *
 * Provides three main functions:
 * 1. Dormant account detection - identifies users who haven't logged in
 * 2. Access review reminders - sends reminders for pending reviews
 * 3. Campaign deadline alerts - notifies of approaching campaign deadlines
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

// Dormant account thresholds (days)
const DORMANT_THRESHOLDS = {
    warning: 60,   // 60 days without login
    critical: 90   // 90 days without login
};

// Reminder thresholds (days before deadline)
const REMINDER_THRESHOLDS = [7, 3, 1];

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
 * Calculate days since a date
 */
function calculateDaysSince(date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);

    const diffTime = now.getTime() - parsedDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until a deadline
 */
function calculateDaysUntil(deadline) {
    const parsedDate = parseDate(deadline);
    if (!parsedDate) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);

    const diffTime = parsedDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Email template for dormant accounts alert
 */
function getDormantAccountsEmailTemplate(orgName, dormantAccounts, link) {
    const formatAccountRow = (account) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${escapeHtml(account.userName)}</td>
            <td style="padding: 12px;">${escapeHtml(account.userEmail)}</td>
            <td style="padding: 12px;">${escapeHtml(account.role || 'N/A')}</td>
            <td style="padding: 12px; text-align: center;">
                ${account.neverLoggedIn ?
                    '<span style="color: #dc2626; font-weight: 600;">Jamais</span>' :
                    `<span style="font-weight: 600; ${account.daysSinceLastLogin >= 90 ? 'color: #dc2626;' : 'color: #d97706;'}">${account.daysSinceLastLogin}j</span>`
                }
            </td>
            <td style="padding: 12px;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;
                    ${account.status === 'detected' ? 'background-color: #fef3c7; color: #d97706;' :
                      account.status === 'contacted' ? 'background-color: #dbeafe; color: #2563eb;' :
                      'background-color: #f1f5f9; color: #64748b;'}">
                    ${escapeHtml(account.status)}
                </span>
            </td>
        </tr>
    `;

    const accountRows = dormantAccounts.slice(0, 15).map(formatAccountRow).join('');
    const criticalCount = dormantAccounts.filter(a => a.daysSinceLastLogin >= 90 || a.neverLoggedIn).length;
    const warningCount = dormantAccounts.length - criticalCount;

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Sentinel <span style="color: #2563eb;">GRC</span>
                </div>
            </div>
            <div style="padding: 32px 0;">
                <div style="background-color: ${criticalCount > 0 ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${criticalCount > 0 ? '#dc2626' : '#f59e0b'}; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; color: ${criticalCount > 0 ? '#dc2626' : '#d97706'}; margin: 0; font-weight: 700;">Alerte NIS2 - Comptes Dormants</h2>
                </div>

                <p>Bonjour,</p>
                <p>Voici le récapitulatif des comptes utilisateurs dormants détectés (NIS2 Art. 21.2i - Contrôle d'accès).</p>

                <div style="display: flex; gap: 12px; margin: 24px 0; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 120px; background-color: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${criticalCount}</div>
                        <div style="font-size: 11px; color: #b91c1c; text-transform: uppercase; font-weight: 600;">Critique (&gt; 90j)</div>
                    </div>
                    <div style="flex: 1; min-width: 120px; background-color: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #d97706;">${warningCount}</div>
                        <div style="font-size: 11px; color: #b45309; text-transform: uppercase; font-weight: 600;">Attention (60-90j)</div>
                    </div>
                    <div style="flex: 1; min-width: 120px; background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; color: #64748b;">${dormantAccounts.length}</div>
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Total</div>
                    </div>
                </div>

                ${dormantAccounts.length > 0 ? `
                <h3 style="font-size: 16px; color: #0f172a; margin: 24px 0 12px;">Comptes à vérifier</h3>
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background-color: #e2e8f0;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Utilisateur</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Email</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Rôle</th>
                            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b;">Inactif</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${accountRows}
                    </tbody>
                </table>
                ${dormantAccounts.length > 15 ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;">... et ${dormantAccounts.length - 15} autre(s) compte(s)</p>` : ''}
                ` : ''}

                <div style="text-align: center; margin-top: 32px;">
                    <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Gérer les Comptes</a>
                </div>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <strong>Rappel NIS2 :</strong> L'article 21.2(i) de la directive NIS2 impose aux entités essentielles
                        de mettre en œuvre des politiques et procédures de contrôle d'accès, incluant la gestion des comptes
                        inactifs et la revue régulière des droits d'accès.
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
 * Email template for access review reminder
 */
function getReviewReminderEmailTemplate(reviewerName, reviews, daysUntilDeadline, link) {
    const formatReviewRow = (review) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${escapeHtml(review.userName)}</td>
            <td style="padding: 12px;">${escapeHtml(review.userEmail)}</td>
            <td style="padding: 12px;">${escapeHtml(review.userRole || 'N/A')}</td>
            <td style="padding: 12px; text-align: center;">${review.permissionCount || 0}</td>
        </tr>
    `;

    const reviewRows = reviews.slice(0, 10).map(formatReviewRow).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; line-height: 1.6; color: #334155; max-width: 700px; margin: 0 auto;">
            <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Sentinel <span style="color: #2563eb;">GRC</span>
                </div>
            </div>
            <div style="padding: 32px 0;">
                <div style="background-color: ${daysUntilDeadline <= 1 ? '#fee2e2' : daysUntilDeadline <= 3 ? '#fef3c7' : '#dbeafe'}; border-left: 4px solid ${daysUntilDeadline <= 1 ? '#dc2626' : daysUntilDeadline <= 3 ? '#f59e0b' : '#2563eb'}; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; color: ${daysUntilDeadline <= 1 ? '#dc2626' : daysUntilDeadline <= 3 ? '#d97706' : '#2563eb'}; margin: 0; font-weight: 700;">
                        Rappel - Revue d'Accès
                    </h2>
                </div>

                <p>Bonjour ${reviewerName},</p>
                <p>Vous avez <strong>${reviews.length} revue(s) d'accès</strong> en attente de validation.</p>

                <div style="background-color: ${daysUntilDeadline <= 1 ? '#fee2e2' : '#f8fafc'}; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Délai restant</div>
                    <div style="font-size: 36px; font-weight: 700; color: ${daysUntilDeadline <= 1 ? '#dc2626' : daysUntilDeadline <= 3 ? '#d97706' : '#2563eb'};">
                        ${daysUntilDeadline <= 0 ? 'Expiré' : `${daysUntilDeadline} jour${daysUntilDeadline > 1 ? 's' : ''}`}
                    </div>
                </div>

                ${reviews.length > 0 ? `
                <h3 style="font-size: 16px; color: #0f172a; margin: 24px 0 12px;">Utilisateurs à valider</h3>
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background-color: #e2e8f0;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Utilisateur</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Email</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Rôle</th>
                            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #64748b;">Permissions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reviewRows}
                    </tbody>
                </table>
                ${reviews.length > 10 ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;">... et ${reviews.length - 10} autre(s) revue(s)</p>` : ''}
                ` : ''}

                <div style="text-align: center; margin-top: 32px;">
                    <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Compléter mes Revues</a>
                </div>

                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <strong>Important :</strong> La revue régulière des accès est une exigence NIS2 (Article 21.2i).
                        Veuillez valider ou révoquer les accès des utilisateurs listés avant la date limite.
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
 * Detect dormant accounts for an organization
 */
async function detectDormantAccounts(db, orgId, thresholds = DORMANT_THRESHOLDS) {
    const usersSnap = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('status', '==', 'active')
        .get();

    if (usersSnap.empty) {
        return [];
    }

    const dormantAccounts = [];
    const now = new Date();

    for (const doc of usersSnap.docs) {
        const user = { id: doc.id, ...doc.data() };

        // Skip admin accounts
        if (user.role === 'admin' || user.role === 'rssi') continue;

        const lastLoginDate = parseDate(user.lastLoginAt);
        const neverLoggedIn = !lastLoginDate;
        const daysSinceLastLogin = neverLoggedIn ? 999 : calculateDaysSince(user.lastLoginAt);

        if (neverLoggedIn || daysSinceLastLogin >= thresholds.warning) {
            dormantAccounts.push({
                userId: user.id,
                userName: user.displayName || user.email?.split('@')[0] || 'Unknown',
                userEmail: user.email,
                role: user.role,
                lastLoginAt: lastLoginDate?.toISOString() || null,
                daysSinceLastLogin,
                neverLoggedIn,
                status: 'detected'
            });
        }
    }

    // Sort by days since last login (most dormant first)
    dormantAccounts.sort((a, b) => b.daysSinceLastLogin - a.daysSinceLastLogin);

    return dormantAccounts;
}

/**
 * Store detected dormant accounts in Firestore
 */
async function storeDormantAccounts(db, orgId, dormantAccounts) {
    if (dormantAccounts.length === 0) return;

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const account of dormantAccounts) {
        // Check if already tracked
        const existingSnap = await db.collection('dormant_accounts')
            .where('organizationId', '==', orgId)
            .where('userId', '==', account.userId)
            .where('status', 'in', ['detected', 'contacted'])
            .limit(1)
            .get();

        if (existingSnap.empty) {
            const docRef = db.collection('dormant_accounts').doc();
            batch.set(docRef, {
                ...account,
                organizationId: orgId,
                status: 'detected',
                createdAt: now
            });
        }
    }

    await batch.commit();
}

/**
 * Process dormant account detection for an organization
 */
async function processOrganizationDormantAccounts(db, orgId, orgName) {
    const dormantAccounts = await detectDormantAccounts(db, orgId);

    if (dormantAccounts.length === 0) {
        return { orgId, total: 0, processed: true };
    }

    // Store new dormant accounts
    await storeDormantAccounts(db, orgId, dormantAccounts);

    // Check if we've already sent a notification this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const existingNotifSnap = await db.collection('notifications')
        .where('organizationId', '==', orgId)
        .where('type', '==', 'nis2_dormant_accounts')
        .where('createdAt', '>=', weekAgo.toISOString())
        .limit(1)
        .get();

    if (!existingNotifSnap.empty) {
        logger.info(`Skipping dormant account notification for ${orgId} - sent within last week`);
        return { orgId, total: dormantAccounts.length, processed: false };
    }

    // Get admin users for notifications
    const adminsSnap = await db.collection('users')
        .where('organizationId', '==', orgId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    if (adminsSnap.empty) {
        return { orgId, total: dormantAccounts.length, processed: false };
    }

    const criticalCount = dormantAccounts.filter(a => a.daysSinceLastLogin >= 90 || a.neverLoggedIn).length;

    const notifTitle = criticalCount > 0
        ? `NIS2: ${criticalCount} compte(s) dormant(s) critique(s)`
        : `NIS2: ${dormantAccounts.length} compte(s) dormant(s) détecté(s)`;

    const notifMessage = `${dormantAccounts.length} compte(s) n'ont pas été utilisé(s) depuis plus de 60 jours.`;

    // Send notifications to admins
    for (const adminDoc of adminsSnap.docs) {
        await db.collection('notifications').add({
            organizationId: orgId,
            userId: adminDoc.id,
            type: 'nis2_dormant_accounts',
            title: notifTitle,
            message: notifMessage,
            link: '/nis2/access-review',
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                totalCount: dormantAccounts.length,
                criticalCount
            }
        });
    }

    logger.info(`Detected ${dormantAccounts.length} dormant accounts for organization ${orgId}`);

    return { orgId, total: dormantAccounts.length, criticalCount, processed: true };
}

/**
 * Send access review reminders
 */
async function sendAccessReviewReminders(db, orgId) {
    // Get active campaigns
    const campaignsSnap = await db.collection('access_review_campaigns')
        .where('organizationId', '==', orgId)
        .where('status', '==', 'active')
        .get();

    if (campaignsSnap.empty) {
        return { orgId, remindersSent: 0 };
    }

    let totalRemindersSent = 0;

    for (const campaignDoc of campaignsSnap.docs) {
        const campaign = { id: campaignDoc.id, ...campaignDoc.data() };
        const daysUntilDeadline = calculateDaysUntil(campaign.endDate);

        // Only send reminders at specific thresholds
        const shouldRemind = REMINDER_THRESHOLDS.includes(daysUntilDeadline);
        if (!shouldRemind && daysUntilDeadline > 0) continue;

        // Get pending reviews grouped by reviewer
        const pendingReviewsSnap = await db.collection('access_reviews')
            .where('organizationId', '==', orgId)
            .where('campaignId', '==', campaign.id)
            .where('status', '==', 'pending')
            .get();

        if (pendingReviewsSnap.empty) continue;

        // Group by reviewer
        const reviewsByReviewer = new Map();

        pendingReviewsSnap.docs.forEach(doc => {
            const review = doc.data();
            const reviewerId = review.reviewerId;

            if (!reviewsByReviewer.has(reviewerId)) {
                reviewsByReviewer.set(reviewerId, {
                    reviewerName: review.reviewerName,
                    reviewerEmail: review.reviewerEmail,
                    reviews: []
                });
            }

            reviewsByReviewer.get(reviewerId).reviews.push({
                id: doc.id,
                userName: review.userName,
                userEmail: review.userEmail,
                userRole: review.userRole,
                permissionCount: review.permissions?.length || 0
            });
        });

        // Send reminders
        const link = `${appBaseUrl.value()}/nis2/access-review`;

        for (const [reviewerId, data] of reviewsByReviewer) {
            // Check if reminder already sent today
            const today = new Date().toISOString().split('T')[0];
            const existingReminderSnap = await db.collection('notifications')
                .where('organizationId', '==', orgId)
                .where('userId', '==', reviewerId)
                .where('type', '==', 'nis2_review_reminder')
                .where('createdAt', '>=', today)
                .limit(1)
                .get();

            if (!existingReminderSnap.empty) continue;

            // Create in-app notification
            await db.collection('notifications').add({
                organizationId: orgId,
                userId: reviewerId,
                type: 'nis2_review_reminder',
                title: daysUntilDeadline <= 1
                    ? `Urgent: ${data.reviews.length} revue(s) d'accès à compléter`
                    : `Rappel: ${data.reviews.length} revue(s) d'accès en attente`,
                message: `Délai: ${daysUntilDeadline} jour(s) restant(s).`,
                link: '/nis2/access-review',
                read: false,
                createdAt: new Date().toISOString(),
                metadata: {
                    campaignId: campaign.id,
                    reviewCount: data.reviews.length,
                    daysUntilDeadline
                }
            });

            // Send email reminder
            if (data.reviewerEmail) {
                const subject = daysUntilDeadline <= 1
                    ? `[URGENT] Revue d'accès - Deadline demain`
                    : `[Rappel] ${data.reviews.length} revue(s) d'accès en attente - ${daysUntilDeadline}j`;

                await db.collection('mail_queue').add({
                    to: data.reviewerEmail,
                    message: {
                        subject,
                        html: getReviewReminderEmailTemplate(
                            data.reviewerName,
                            data.reviews,
                            daysUntilDeadline,
                            link
                        )
                    },
                    type: 'NIS2_REVIEW_REMINDER',
                    metadata: {
                        organizationId: orgId,
                        campaignId: campaign.id,
                        reviewerId,
                        reviewCount: data.reviews.length
                    },
                    status: 'PENDING',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // Update reminder count on reviews
            const batch = db.batch();
            for (const review of data.reviews) {
                const reviewRef = db.collection('access_reviews').doc(review.id);
                batch.update(reviewRef, {
                    remindersSent: admin.firestore.FieldValue.increment(1),
                    lastReminderAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            await batch.commit();

            totalRemindersSent++;
        }
    }

    return { orgId, remindersSent: totalRemindersSent };
}

/**
 * Weekly Dormant Account Detection
 * Runs every Monday at 6:00 AM UTC
 */
const weeklyDormantAccountDetection = onSchedule({
    schedule: '0 6 * * 1', // Every Monday at 6:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting weekly NIS2 dormant account detection');

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
                const result = await processOrganizationDormantAccounts(db, orgId, orgData.name || 'Organisation');
                results.push(result);
            } catch (error) {
                logger.error(`Error processing organization ${orgId}:`, error);
            }
        }

        const totalDormant = results.reduce((sum, r) => sum + (r.total || 0), 0);
        const processedCount = results.filter(r => r.processed).length;

        logger.info(`Weekly dormant account detection completed: ${processedCount} orgs processed, ${totalDormant} dormant accounts detected`);

        return {
            success: true,
            organizationsProcessed: processedCount,
            totalDormantAccounts: totalDormant
        };

    } catch (error) {
        logger.error('Error in weekly dormant account detection:', error);
        throw error;
    }
});

/**
 * Daily Access Review Reminders
 * Runs every day at 8:00 AM UTC
 */
const dailyAccessReviewReminders = onSchedule({
    schedule: '0 8 * * *', // Every day at 8:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting daily NIS2 access review reminders');

    try {
        const orgsSnap = await db.collection('organizations').get();

        if (orgsSnap.empty) {
            logger.info('No organizations found');
            return;
        }

        let totalRemindersSent = 0;

        for (const orgDoc of orgsSnap.docs) {
            const orgId = orgDoc.id;

            try {
                const result = await sendAccessReviewReminders(db, orgId);
                totalRemindersSent += result.remindersSent;
            } catch (error) {
                logger.error(`Error sending reminders for organization ${orgId}:`, error);
            }
        }

        logger.info(`Daily access review reminders completed: ${totalRemindersSent} reminders sent`);

        return {
            success: true,
            remindersSent: totalRemindersSent
        };

    } catch (error) {
        logger.error('Error in daily access review reminders:', error);
        throw error;
    }
});

/**
 * Weekly Dormant Accounts Email Digest
 * Runs every Monday at 9:00 AM UTC
 */
const weeklyDormantAccountsDigest = onSchedule({
    schedule: '0 9 * * 1', // Every Monday at 9:00 AM UTC
    region: 'europe-west1',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async (event) => {
    const db = admin.firestore();

    logger.info('Starting weekly NIS2 dormant accounts email digest');

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
                // Get active dormant accounts
                const dormantSnap = await db.collection('dormant_accounts')
                    .where('organizationId', '==', orgId)
                    .where('status', 'in', ['detected', 'contacted'])
                    .get();

                if (dormantSnap.empty) continue;

                const dormantAccounts = dormantSnap.docs.map(doc => doc.data());

                // Get admin users
                const adminsSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', 'in', ['admin', 'rssi'])
                    .get();

                if (adminsSnap.empty) continue;

                const link = `${appBaseUrl.value()}/nis2/access-review`;
                const criticalCount = dormantAccounts.filter(a => a.daysSinceLastLogin >= 90 || a.neverLoggedIn).length;

                for (const adminDoc of adminsSnap.docs) {
                    const adminData = adminDoc.data();

                    if (adminData.email) {
                        const subject = criticalCount > 0
                            ? `[NIS2] Alerte: ${criticalCount} compte(s) dormant(s) critique(s)`
                            : `[NIS2] ${dormantAccounts.length} compte(s) dormant(s) à traiter`;

                        await db.collection('mail_queue').add({
                            to: adminData.email,
                            message: {
                                subject,
                                html: getDormantAccountsEmailTemplate(
                                    orgData.name || 'Organisation',
                                    dormantAccounts,
                                    link
                                )
                            },
                            type: 'NIS2_DORMANT_ACCOUNTS',
                            metadata: {
                                organizationId: orgId,
                                totalCount: dormantAccounts.length,
                                criticalCount
                            },
                            status: 'PENDING',
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        totalEmailsSent++;
                    }
                }
            } catch (error) {
                logger.error(`Error processing email digest for ${orgId}:`, error);
            }
        }

        logger.info(`Weekly dormant accounts digest completed: ${totalEmailsSent} emails sent`);

        return {
            success: true,
            emailsSent: totalEmailsSent
        };

    } catch (error) {
        logger.error('Error in weekly dormant accounts digest:', error);
        throw error;
    }
});

/**
 * Callable function to manually detect dormant accounts
 */
const detectDormantAccountsCallable = onCall({
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
        throw new HttpsError('permission-denied', 'Only admins can detect dormant accounts.');
    }

    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User has no organization.');
    }

    const db = admin.firestore();

    try {
        const dormantAccounts = await detectDormantAccounts(db, organizationId);
        await storeDormantAccounts(db, organizationId, dormantAccounts);

        const criticalCount = dormantAccounts.filter(a => a.daysSinceLastLogin >= 90 || a.neverLoggedIn).length;

        return {
            success: true,
            total: dormantAccounts.length,
            criticalCount,
            accounts: dormantAccounts.slice(0, 20) // Return first 20 for preview
        };
    } catch (error) {
        logger.error('Error in detectDormantAccounts callable:', error);
        throw new HttpsError('internal', 'Failed to detect dormant accounts.');
    }
});

module.exports = {
    weeklyDormantAccountDetection,
    dailyAccessReviewReminders,
    weeklyDormantAccountsDigest,
    detectDormantAccountsCallable,
    // Export for testing
    detectDormantAccounts,
    calculateDaysSince,
    calculateDaysUntil,
    sendAccessReviewReminders,
    storeDormantAccounts,
    DORMANT_THRESHOLDS,
    REMINDER_THRESHOLDS
};
