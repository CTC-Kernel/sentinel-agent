import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, limit, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Audit, Document as GRCDocument, Asset, Risk, ProjectTask, Incident, Control, Supplier, NotificationPreferences, NotificationChannelPreferences } from '../types';
import { sendEmail } from './emailService';
import {
    getTaskAssignmentTemplate,
    getIncidentAlertTemplate,
    getAuditReminderTemplate,
    getDocumentReviewTemplate,
    getRiskTreatmentDueTemplate,
    getComplianceAlertTemplate,
    getMaintenanceTemplate,
    getSupplierReviewTemplate
} from './emailTemplates';
import { ErrorLogger } from './errorLogger';
import { buildAppUrl } from '../config/appConfig';
import { sanitizeData } from '../utils/dataSanitizer';

import { Notification as GRCNotification } from '../types/notification';

// Re-export for backward compatibility if needed, or just use the imported one
export type Notification = GRCNotification;

export class NotificationService {
    /**
     * Create a new notification
     */
    static async create(
        user: { uid: string; organizationId: string } | UserProfile,
        type: Notification['type'],
        title: string,
        message: string,
        link?: string,
        expiresInDays?: number,
        category: keyof NotificationPreferences = 'system'
    ): Promise<void> {
        try {
            if (!user.organizationId) return;

            let preferences = (user as UserProfile).notificationPreferences;

            if (!preferences) {
                // Fetch target user to check preferences if not provided
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as UserProfile;
                        preferences = userData.notificationPreferences;
                    }
                } catch (e) {
                    // Ignore fetch errors for preferences, proceed with defaults or just log check failure
                    ErrorLogger.warn('Failed to fetch preferences', 'NotificationService.create.fetchPreferences', { metadata: { error: e } });
                }
            }

            if (preferences) {
                // Check In-App preference
                if (preferences[category] && !preferences[category].inApp) {
                    return; // Skip if disabled
                }
            }

            const expiresAt = expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
                : undefined;

            await addDoc(collection(db, 'notifications'), sanitizeData({
                organizationId: user.organizationId,
                userId: user.uid,
                type,
                title,
                message,
                link,
                read: false,
                createdAt: serverTimestamp(),
                expiresAt,
            }));
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.create');
        }
    }

    /**
     * Check if a notification should be sent based on user preferences
     */
    static shouldNotify(user: UserProfile, category: keyof NotificationPreferences, channel: keyof NotificationChannelPreferences): boolean {
        if (!user.notificationPreferences) return true; // Default to true (opt-out)
        return user.notificationPreferences[category]?.[channel] ?? true;
    }

    /**
     * Create notification for all users in an organization
     */
    static async createForOrganization(
        organizationId: string,
        type: Notification['type'],
        title: string,
        message: string,
        link?: string,
        category: keyof NotificationPreferences = 'system'
    ): Promise<void> {
        try {
            const usersSnap = await getDocs(
                query(collection(db, 'users'), where('organizationId', '==', organizationId))
            );

            const promises = usersSnap.docs
                .map(doc => ({ uid: doc.id, ...doc.data() } as unknown as UserProfile))
                .filter(user => this.shouldNotify(user, category, 'inApp'))
                .map((user) =>
                    addDoc(collection(db, 'notifications'), sanitizeData({
                        organizationId,
                        userId: user.uid,
                        type,
                        title,
                        message,
                        link,
                        read: false,
                        createdAt: serverTimestamp(),
                    })).catch(e => ErrorLogger.error(e, 'NotificationService.createForOrganization.addDoc'))
                );

            await Promise.all(promises);
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.createForOrganization');
        }
    }

    /**
     * Get unread notifications for a user
     */
    static async getUnread(userId: string): Promise<Notification[]> {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                where('read', '==', false),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snap = await getDocs(q);
            return snap.docs.map((doc) => {
                const data = doc.data();
                let createdAt = data.createdAt;
                if (createdAt && typeof createdAt.toDate === 'function') {
                    createdAt = createdAt.toDate().toISOString();
                } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
                    createdAt = new Date(createdAt.seconds * 1000).toISOString();
                }
                return { id: doc.id, ...data, createdAt: createdAt || new Date().toISOString() } as Notification;
            });
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.getUnread');
            return [];
        }
    }

    /**
     * Get all notifications for a user
     */
    static async getAll(userId: string, limitCount: number = 50): Promise<Notification[]> {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );

            const snap = await getDocs(q);
            return snap.docs.map((doc) => {
                const data = doc.data();
                let createdAt = data.createdAt;
                if (createdAt && typeof createdAt.toDate === 'function') {
                    createdAt = createdAt.toDate().toISOString();
                } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
                    createdAt = new Date(createdAt.seconds * 1000).toISOString();
                }
                return { id: doc.id, ...data, createdAt: createdAt || new Date().toISOString() } as Notification;
            });
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.getAll');
            return [];
        }
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true,
            });
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.markAsRead');
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllAsRead(userId: string): Promise<void> {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                where('read', '==', false)
            );

            const snap = await getDocs(q);
            // Process individually to avoid total failure
            const promises = snap.docs.map((doc) =>
                updateDoc(doc.ref, { read: true }).catch(err => ErrorLogger.error(err, `NotificationService.markAllAsRead.${doc.id}`))
            );

            await Promise.all(promises);
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.markAllAsRead');
        }
    }

    /**
     * Subscribe to notifications for a user (Real-time)
     */
    static subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(100)
            );

            return onSnapshot(q, (snapshot) => {
                const notifications = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    let createdAt = data.createdAt;
                    if (createdAt && typeof createdAt.toDate === 'function') {
                        createdAt = createdAt.toDate().toISOString();
                    } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
                        // Handle raw timestamp object if toDate is missing
                        createdAt = new Date(createdAt.seconds * 1000).toISOString();
                    }

                    return {
                        id: doc.id,
                        ...data,
                        createdAt: createdAt || new Date().toISOString()
                    } as Notification;
                });
                callback(notifications);
            }, (error) => {
                ErrorLogger.error(error, 'NotificationService.subscribeToNotifications.onSnapshot');
            });
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.subscribeToNotifications');
            return () => { };
        }
    }

    /**
     * Check for upcoming audits and create notifications
     */
    static async checkUpcomingAudits(organizationId: string): Promise<void> {
        try {
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

            const q = query(
                collection(db, 'audits'),
                where('organizationId', '==', organizationId),
                where('status', 'in', ['Planifié', 'En cours'])
            );

            const snap = await getDocs(q);
            const audits = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Audit));

            for (const audit of audits) {
                const auditDate = new Date(audit.dateScheduled);
                if (auditDate <= sevenDaysFromNow && auditDate > new Date()) {
                    const daysUntil = Math.ceil((auditDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                    // Find the auditor user
                    const auditorSnap = await getDocs(
                        query(
                            collection(db, 'users'),
                            where('organizationId', '==', organizationId),
                            where('displayName', '==', audit.auditor)
                        )
                    );

                    if (!auditorSnap.empty) {
                        const auditorId = auditorSnap.docs[0].id;

                        // Idempotency check: Check if a similar notification was sent in the last 24h
                        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                        const existingNotifs = await getDocs(query(
                            collection(db, 'notifications'),
                            where('userId', '==', auditorId),
                            where('link', '==', '/audits'),
                            where('createdAt', '>=', yesterday)
                        ));

                        const alreadyNotified = existingNotifs.docs.some(d => d.data().message.includes(audit.name));

                        if (!alreadyNotified) {
                            await addDoc(collection(db, 'notifications'), sanitizeData({
                                organizationId,
                                userId: auditorId,
                                type: daysUntil <= 3 ? 'danger' : 'warning',
                                title: `Audit à venir : ${audit.name}`,
                                message: `L'audit est prévu dans ${daysUntil} jour(s) - ${new Date(audit.dateScheduled).toLocaleDateString()}`,
                                link: '/audits',
                                read: false,
                                createdAt: serverTimestamp(),
                            }));

                            // Send Email
                            const auditorData = auditorSnap.docs[0].data() as UserProfile;
                            if (auditorData.email && this.shouldNotify(auditorData, 'audits', 'email')) {
                                await sendEmail(null, {
                                    to: auditorData.email,
                                    subject: `Rappel Audit : ${audit.name}`,
                                    html: getAuditReminderTemplate(
                                        audit.name,
                                        auditorData.displayName || 'Auditeur',
                                        audit.dateScheduled,
                                        buildAppUrl('/audits')
                                    ),
                                    type: 'AUDIT_REMINDER'
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.checkUpcomingAudits');
        }
    }

    /**
     * Check for overdue document reviews
     */
    static async checkOverdueDocuments(organizationId: string): Promise<void> {
        try {
            const q = query(
                collection(db, 'documents'),
                where('organizationId', '==', organizationId),
                where('status', '==', 'Publié')
            );

            const snap = await getDocs(q);
            const documents = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as GRCDocument));

            for (const doc of documents) {
                if (doc.nextReviewDate && new Date(doc.nextReviewDate) < new Date()) {
                    // Find the owner
                    const ownerSnap = await getDocs(
                        query(
                            collection(db, 'users'),
                            where('organizationId', '==', organizationId),
                            where('email', '==', doc.owner)
                        )
                    );

                    if (!ownerSnap.empty) {
                        const ownerId = ownerSnap.docs[0].id;

                        // Idempotency check
                        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                        const existingNotifs = await getDocs(query(
                            collection(db, 'notifications'),
                            where('userId', '==', ownerId),
                            where('link', '==', '/documents'),
                            where('createdAt', '>=', yesterday)
                        ));

                        const alreadyNotified = existingNotifs.docs.some(d => d.data().title.includes(doc.title));

                        if (!alreadyNotified) {
                            await addDoc(collection(db, 'notifications'), sanitizeData({
                                organizationId,
                                userId: ownerId,
                                type: 'warning',
                                title: `Document à réviser : ${doc.title}`,
                                message: `La date de révision est dépassée depuis le ${new Date(doc.nextReviewDate).toLocaleDateString()}`,
                                link: '/documents',
                                read: false,
                                createdAt: serverTimestamp(),
                            }));

                            // Send Email
                            const ownerData = ownerSnap.docs[0].data() as UserProfile;
                            if (ownerData.email && this.shouldNotify(ownerData, 'tasks', 'email')) {
                                await sendEmail(null, {
                                    to: ownerData.email,
                                    subject: `Révision requise : ${doc.title}`,
                                    html: getDocumentReviewTemplate(
                                        doc.title,
                                        ownerData.displayName || 'Propriétaire',
                                        doc.nextReviewDate,
                                        buildAppUrl('/documents')
                                    ),
                                    type: 'DOCUMENT_REVIEW'
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.checkOverdueDocuments');
        }
    }

    /**
     * Check for upcoming maintenance
     */
    static async checkUpcomingMaintenance(organizationId: string): Promise<void> {
        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const q = query(
                collection(db, 'assets'),
                where('organizationId', '==', organizationId)
            );

            const snap = await getDocs(q);
            const assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Asset));

            for (const asset of assets) {
                if (asset.nextMaintenance) {
                    const maintenanceDate = new Date(asset.nextMaintenance);
                    if (maintenanceDate <= thirtyDaysFromNow && maintenanceDate > new Date()) {
                        const daysUntil = Math.ceil((maintenanceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                        // Find the owner
                        const ownerSnap = await getDocs(
                            query(
                                collection(db, 'users'),
                                where('organizationId', '==', organizationId),
                                where('displayName', '==', asset.owner)
                            )
                        );

                        if (!ownerSnap.empty) {
                            const ownerId = ownerSnap.docs[0].id;

                            // Idempotency check
                            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                            const existingNotifs = await getDocs(query(
                                collection(db, 'notifications'),
                                where('userId', '==', ownerId),
                                where('link', '==', '/assets'),
                                where('createdAt', '>=', yesterday)
                            ));

                            const alreadyNotified = existingNotifs.docs.some(d => d.data().title.includes(asset.name));

                            if (!alreadyNotified) {
                                await addDoc(collection(db, 'notifications'), sanitizeData({
                                    organizationId,
                                    userId: ownerId,
                                    type: daysUntil <= 7 ? 'warning' : 'info',
                                    title: `Maintenance à prévoir : ${asset.name}`,
                                    message: `Maintenance prévue dans ${daysUntil} jour(s)`,
                                    link: '/assets',
                                    read: false,
                                    createdAt: serverTimestamp(),
                                }));

                                // Send Email
                                const ownerData = ownerSnap.docs[0].data() as UserProfile;
                                if (ownerData.email && this.shouldNotify(ownerData, 'system', 'email')) {
                                    await sendEmail(null, {
                                        to: ownerData.email,
                                        subject: `Maintenance : ${asset.name}`,
                                        html: getMaintenanceTemplate(
                                            asset.name,
                                            asset.nextMaintenance,
                                            ownerData.displayName || 'Propriétaire',
                                            buildAppUrl('/assets')
                                        ),
                                        type: 'MAINTENANCE_ALERT'
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.checkUpcomingMaintenance');
        }
    }

    /**
     * Check for critical risks without mitigation
     */
    static async checkCriticalRisks(organizationId: string): Promise<void> {
        try {
            const q = query(
                collection(db, 'risks'),
                where('organizationId', '==', organizationId)
            );

            const snap = await getDocs(q);
            const risks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Risk));

            const criticalRisksWithoutMitigation = risks.filter(
                (risk) => risk.score >= 15 && (!risk.mitigationControlIds || risk.mitigationControlIds.length === 0)
            );

            if (criticalRisksWithoutMitigation.length > 0) {
                // Notify all admins
                const adminsSnap = await getDocs(
                    query(
                        collection(db, 'users'),
                        where('organizationId', '==', organizationId),
                        where('role', '==', 'admin')
                    )
                );

                for (const adminDoc of adminsSnap.docs) {
                    // Idempotency check
                    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    const existingNotifs = await getDocs(query(
                        collection(db, 'notifications'),
                        where('userId', '==', adminDoc.id),
                        where('link', '==', '/risks'),
                        where('createdAt', '>=', yesterday)
                    ));

                    const alreadyNotified = existingNotifs.docs.some(d => d.data().title.includes('risque(s) critique(s)'));

                    if (!alreadyNotified) {
                        const adminData = adminDoc.data() as UserProfile;

                        await this.create(
                            adminData,
                            'danger',
                            `${criticalRisksWithoutMitigation.length} risque(s) critique(s) sans atténuation`,
                            `Des risques critiques n'ont pas de contrôles d'atténuation associés`,
                            '/risks',
                            undefined,
                            'risks'
                        );

                        // Send Email
                        if (adminData.email && this.shouldNotify(adminData, 'risks', 'email')) {
                            await sendEmail(null, {
                                to: adminData.email,
                                subject: `Action requise : ${criticalRisksWithoutMitigation.length} Risques Critiques`,
                                html: getRiskTreatmentDueTemplate(
                                    'Risques Critiques non traités',
                                    new Date().toISOString(),
                                    adminData.displayName || 'Admin',
                                    buildAppUrl('/risks')
                                ),
                                type: 'RISK_TREATMENT_DUE'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.checkCriticalRisks');
        }
    }

    /**
     * Notify user about a new task assignment
     */
    static async notifyTaskAssigned(task: ProjectTask & { organizationId: string; projectName?: string }, assigneeId: string): Promise<void> {
        // 1. Fetch User Profile to get email
        let userData: UserProfile | undefined;
        try {
            const userSnap = await getDoc(doc(db, 'users', assigneeId));
            if (userSnap.exists()) {
                userData = userSnap.data() as UserProfile;
            }
        } catch (e) { ErrorLogger.error(e, 'NotificationService.notifyTaskAssigned'); }

        // 2. Create Notification
        await this.create(
            userData || { uid: assigneeId, organizationId: task.organizationId } as UserProfile,
            'info',
            'Nouvelle tâche assignée',
            `On vous a assigné la tâche : ${task.title}`,
            '/projects',
            undefined,
            'tasks'
        );

        // 3. Send Email
        if (userData && userData.email && this.shouldNotify(userData, 'tasks', 'email')) {
            await sendEmail(null, {
                to: userData.email,
                subject: `Nouvelle tâche : ${task.title}`,
                html: getTaskAssignmentTemplate(
                    task.title,
                    task.projectName || 'Projet',
                    'Gestionnaire',
                    buildAppUrl('/projects')
                ),
                type: 'TASK_ASSIGNMENT'
            });
        }
    }

    /**
     * Notify admins about a new incident
     */
    static async notifyNewIncident(incident: Incident): Promise<void> {
        // 1. Notify all users (Push + In-App)
        await this.createForOrganization(
            incident.organizationId,
            'danger',
            'Nouvel Incident Signalé',
            `${incident.title} (${incident.severity})`,
            `/incidents?id=${incident.id}`,
            'risks'
        );

        // 2. Send Email to Admins
        try {
            const adminsSnap = await getDocs(
                query(
                    collection(db, 'users'),
                    where('organizationId', '==', incident.organizationId),
                    where('role', 'in', ['admin', 'rssi'])
                )
            );

            const emailPromises = adminsSnap.docs
                .map(doc => doc.data() as UserProfile)
                .filter(admin => admin.email && this.shouldNotify(admin, 'risks', 'email'))
                .map(admin => sendEmail(null, {
                    to: admin.email,
                    subject: `🚨 Incident : ${incident.title}`,
                    html: getIncidentAlertTemplate(
                        incident.title,
                        incident.severity,
                        incident.reporter || 'Un utilisateur',
                        buildAppUrl(`/incidents?id=${incident.id}`)
                    ),
                    type: 'INCIDENT_ALERT'
                }));

            await Promise.all(emailPromises);
        } catch (e) { ErrorLogger.error(e, 'NotificationService.notifyNewIncident.sendEmail'); }
    }

    /**
     * Notify user about a control assignment
     */
    static async notifyControlAssigned(control: Control, assigneeId: string): Promise<void> {
        // 1. Fetch User
        let userData: UserProfile | undefined;
        try {
            const userSnap = await getDoc(doc(db, 'users', assigneeId));
            if (userSnap.exists()) {
                userData = userSnap.data() as UserProfile;
            }
        } catch (e) { ErrorLogger.error(e, 'NotificationService.notifyControlAssigned'); }

        // 2. Create Notification
        await this.create(
            userData || { uid: assigneeId, organizationId: control.organizationId } as UserProfile,
            'info',
            'Contrôle assigné',
            `On vous a assigné le contrôle : ${control.code} - ${control.name}`,
            '/compliance',
            undefined,
            'audits' // Using 'audits' for compliance/controls
        );

        // 3. Send Email
        if (userData && userData.email && this.shouldNotify(userData, 'audits', 'email')) {
            await sendEmail(null, {
                to: userData.email,
                subject: `Contrôle assigné : ${control.code}`,
                html: getComplianceAlertTemplate(
                    control.code,
                    control.name,
                    "Vous avez été désigné responsable de ce contrôle.",
                    buildAppUrl('/compliance')
                ),
                type: 'COMPLIANCE_ALERT'
            });
        }
    }

    /**
     * Check for upcoming risk treatment deadlines and notify owners
     */
    static async checkRiskTreatmentSLA(organizationId: string): Promise<void> {
        try {
            // Fetch open risks
            const q = query(
                collection(db, 'risks'),
                where('organizationId', '==', organizationId),
                where('status', 'in', ['Ouvert', 'En cours'])
            );

            const snap = await getDocs(q);
            const risks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Risk));

            for (const risk of risks) {
                // Only if treatment data exists and not Accepted (Accepted risks have no treatment deadline usually)
                if (!risk.treatmentDeadline || risk.strategy === 'Accepter') continue;

                const deadline = new Date(risk.treatmentDeadline);
                const now = new Date();
                const diffTime = deadline.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Alert logic:
                // 1. Overdue (diffDays < 0)
                // 2. Due soon (diffDays <= 7)
                if (diffDays <= 7) {
                    // Determine Owner (Prefer treatment owner, fallback to risk owner)
                    const ownerId = risk.treatmentOwnerId || risk.ownerId; // Note: ownerId might be empty if not assigned
                    if (!ownerId) continue;

                    // Idempotency: Check if notified in last 24h
                    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    // Construct a unique-ish link or rely on title parsing
                    const notifLink = `/risks?id=${risk.id}`; // Assuming we can deep link

                    const existingNotifs = await getDocs(query(
                        collection(db, 'notifications'),
                        where('userId', '==', ownerId),
                        where('link', '==', notifLink),
                        where('createdAt', '>=', yesterday)
                    ));

                    const msgTag = diffDays < 0 ? 'Retard traitement' : 'Échéance traitement';
                    const alreadyNotified = existingNotifs.docs.some(d => d.data().title.includes(msgTag));

                    if (!alreadyNotified) {
                        const isOverdue = diffDays < 0;
                        await addDoc(collection(db, 'notifications'), sanitizeData({
                            organizationId,
                            userId: ownerId,
                            type: isOverdue ? 'danger' : 'warning',
                            title: `${msgTag} : ${risk.threat}`,
                            message: isOverdue
                                ? `Le traitement est en retard de ${Math.abs(diffDays)} jours`
                                : `Le traitement arrive à échéance dans ${diffDays} jours`,
                            link: notifLink,
                            read: false,
                            createdAt: serverTimestamp()
                        }));

                        // Send Email
                        try {
                            const userSnap = await getDoc(doc(db, 'users', ownerId));
                            if (userSnap.exists()) {
                                const userData = userSnap.data() as UserProfile;
                                if (userData.email && this.shouldNotify(userData, 'risks', 'email')) {
                                    await sendEmail(null, {
                                        to: userData.email,
                                        subject: `${msgTag} : ${risk.threat}`,
                                        html: getRiskTreatmentDueTemplate(
                                            risk.threat,
                                            risk.treatmentDeadline,
                                            userData.displayName || 'Propriétaire',
                                            buildAppUrl('/risks')
                                        ),
                                        type: 'RISK_TREATMENT_DUE'
                                    });
                                }
                            }
                        } catch (e) { ErrorLogger.error(e, 'NotificationService.checkRiskTreatmentSLA.sendEmail'); }
                    }
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.checkRiskTreatmentSLA');
        }
    }

    /**
     * Run all automated checks
     */
    static async runAutomatedChecks(organizationId: string): Promise<void> {
        const results = await Promise.allSettled([
            this.checkUpcomingAudits(organizationId),
            this.checkOverdueDocuments(organizationId),
            this.checkUpcomingMaintenance(organizationId),
            this.checkCriticalRisks(organizationId),
            this.checkExpiringContracts(organizationId),
            this.checkRiskTreatmentSLA(organizationId),
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const methods = [
                    'checkUpcomingAudits',
                    'checkOverdueDocuments',
                    'checkUpcomingMaintenance',
                    'checkCriticalRisks',
                    'checkExpiringContracts',
                    'checkRiskTreatmentSLA'
                ];
                ErrorLogger.error(result.reason, `NotificationService.${methods[index]}`);
            }
        });
    }

    /**
     * Check for expiring supplier contracts
     */
    static async checkExpiringContracts(organizationId: string): Promise<void> {
        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const q = query(
                collection(db, 'suppliers'),
                where('organizationId', '==', organizationId),
                where('status', '==', 'Actif')
            );

            const snap = await getDocs(q);
            const suppliers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Supplier));

            for (const supplier of suppliers) {
                if (supplier.contractEnd) {
                    const endDate = new Date(supplier.contractEnd);
                    if (endDate <= thirtyDaysFromNow && endDate > new Date()) {
                        const daysUntil = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                        // Notify Owner
                        if (supplier.ownerId) {
                            // Idempotency check
                            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                            const existingNotifs = await getDocs(query(
                                collection(db, 'notifications'),
                                where('userId', '==', supplier.ownerId),
                                where('link', '==', '/suppliers'),
                                where('createdAt', '>=', yesterday)
                            ));

                            const alreadyNotified = existingNotifs.docs.some(d => d.data().title.includes(supplier.name));

                            if (!alreadyNotified) {
                                await addDoc(collection(db, 'notifications'), sanitizeData({
                                    organizationId,
                                    userId: supplier.ownerId,
                                    type: 'warning',
                                    title: `Fin de contrat : ${supplier.name}`,
                                    message: `Le contrat expire dans ${daysUntil} jour(s)`,
                                    link: '/suppliers',
                                    read: false,
                                    createdAt: serverTimestamp(),
                                }));

                                // Send Email
                                try {
                                    const userSnap = await getDoc(doc(db, 'users', supplier.ownerId));
                                    if (userSnap.exists()) {
                                        const userData = userSnap.data() as UserProfile;
                                        if (userData.email && this.shouldNotify(userData, 'system', 'email')) {
                                            await sendEmail(null, {
                                                to: userData.email,
                                                subject: `Expiration Contrat : ${supplier.name}`,
                                                html: getSupplierReviewTemplate(
                                                    supplier.name,
                                                    supplier.criticality || 'Moyenne',
                                                    supplier.contractEnd,
                                                    buildAppUrl('/suppliers')
                                                ),
                                                type: 'SUPPLIER_REVIEW'
                                            });
                                        }
                                    }
                                } catch (e) { ErrorLogger.error(e, 'NotificationService.checkExpiringContracts.sendEmail'); }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'NotificationService.checkExpiringContracts');
        }
    }

    /**
     * Notify user about a risk assignment
     */
    static async notifyRiskAssigned(risk: Partial<Risk>, assigneeId: string, assignerName: string): Promise<void> {
        // 1. Fetch User Profile
        let userData: UserProfile | undefined;
        try {
            const userSnap = await getDoc(doc(db, 'users', assigneeId));
            if (userSnap.exists()) {
                userData = userSnap.data() as UserProfile;
            }
        } catch (e) { ErrorLogger.error(e, 'NotificationService.notifyRiskAssigned'); }

        // 2. Create Notification
        if (!userData && risk.organizationId) {
            // Fallback if userData fetch failed or didn't need full profile for basic notif
            userData = { uid: assigneeId, organizationId: risk.organizationId } as UserProfile;
        }

        if (userData) {
            await this.create(
                userData,
                'info',
                'Nouveau Risque Assigné',
                `Un nouveau risque vous a été assigné par ${assignerName}`,
                '/risks'
            );

            // 3. Send Email
            if (userData.email && this.shouldNotify(userData, 'risks', 'email')) {
                await sendEmail(null, {
                    to: userData.email,
                    subject: `Risque assigné : ${risk.threat || 'Nouveau risque'}`,
                    html: getRiskTreatmentDueTemplate(
                        risk.threat || 'Nouveau risque',
                        new Date().toISOString(),
                        userData.displayName || 'Propriétaire',
                        buildAppUrl('/risks')
                    ),
                    type: 'RISK_TREATMENT_DUE'
                });
            }
        }
    }

    /**
     * Notify user about an audit assignment
     */
    static async notifyAuditAssigned(audit: Partial<Audit>, assigneeId: string, assignerName: string): Promise<void> {
        // 1. Fetch User Profile
        let userData: UserProfile | undefined;
        try {
            const userSnap = await getDoc(doc(db, 'users', assigneeId));
            if (userSnap.exists()) {
                userData = userSnap.data() as UserProfile;
            }
        } catch (e) { ErrorLogger.error(e, 'NotificationService.notifyAuditAssigned'); }

        // 2. Create Notification
        if (!userData && audit.organizationId) {
            userData = { uid: assigneeId, organizationId: audit.organizationId } as UserProfile;
        }

        if (userData) {
            await this.create(
                userData,
                'info',
                'Nouvel Audit Assigné',
                `On vous a assigné l'audit : ${audit.name} par ${assignerName}`,
                '/audits'
            );

            // 3. Send Email
            if (userData.email && this.shouldNotify(userData, 'audits', 'email')) {
                await sendEmail(null, {
                    to: userData.email,
                    subject: `[Sentinel] Nouvel audit assigné: ${audit.name}`,
                    html: getAuditReminderTemplate(
                        audit.name || 'Audit',
                        userData.displayName || 'Auditeur',
                        audit.dateScheduled || '',
                        buildAppUrl('/audits')
                    ),
                    type: 'AUDIT_REMINDER'
                });
            }
        }
    }
}
