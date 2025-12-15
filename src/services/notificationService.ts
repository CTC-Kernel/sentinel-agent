import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, limit, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Audit, Document as GRCDocument, Asset, Risk, ProjectTask, Incident, Control, Supplier } from '../types';
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

export interface Notification {
    id: string;
    organizationId: string;
    userId: string;
    type: 'warning' | 'danger' | 'info' | 'success';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
    expiresAt?: string;
}

export class NotificationService {
    /**
     * Create a new notification
     */
    static async create(
        user: UserProfile,
        type: Notification['type'],
        title: string,
        message: string,
        link?: string,
        expiresInDays?: number
    ): Promise<void> {
        if (!user.organizationId) return;

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
            createdAt: new Date().toISOString(),
            expiresAt,
        }));
    }

    /**
     * Create notification for all users in an organization
     */
    static async createForOrganization(
        organizationId: string,
        type: Notification['type'],
        title: string,
        message: string,
        link?: string
    ): Promise<void> {
        const usersSnap = await getDocs(
            query(collection(db, 'users'), where('organizationId', '==', organizationId))
        );

        const promises = usersSnap.docs.map((userDoc) =>
            addDoc(collection(db, 'notifications'), sanitizeData({
                organizationId,
                userId: userDoc.id,
                type,
                title,
                message,
                link,
                read: false,
                createdAt: new Date().toISOString(),
            }))
        );

        await Promise.all(promises);
    }

    /**
     * Get unread notifications for a user
     */
    static async getUnread(userId: string): Promise<Notification[]> {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('read', '==', false),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const snap = await getDocs(q);
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Notification));
    }

    /**
     * Get all notifications for a user
     */
    static async getAll(userId: string, limitCount: number = 50): Promise<Notification[]> {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snap = await getDocs(q);
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Notification));
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId: string): Promise<void> {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true,
        });
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllAsRead(userId: string): Promise<void> {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snap = await getDocs(q);
        const promises = snap.docs.map((doc) =>
            updateDoc(doc.ref, { read: true })
        );

        await Promise.all(promises);
    }

    /**
     * Subscribe to notifications for a user (Real-time)
     */
    static subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            } as Notification));
            callback(notifications);
        }, (error) => {
            ErrorLogger.error(error, 'NotificationService.subscribeToNotifications');
        });
    }

    /**
     * Check for upcoming audits and create notifications
     */
    static async checkUpcomingAudits(organizationId: string): Promise<void> {
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
                            createdAt: new Date().toISOString(),
                        }));

                        // Send Email
                        const auditorData = auditorSnap.docs[0].data();
                        if (auditorData.email) {
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
    }

    /**
     * Check for overdue document reviews
     */
    static async checkOverdueDocuments(organizationId: string): Promise<void> {
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
                            createdAt: new Date().toISOString(),
                        }));

                        // Send Email
                        const ownerData = ownerSnap.docs[0].data();
                        if (ownerData.email) {
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
    }

    /**
     * Check for upcoming maintenance
     */
    static async checkUpcomingMaintenance(organizationId: string): Promise<void> {
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
                                createdAt: new Date().toISOString(),
                            }));

                            // Send Email
                            const ownerData = ownerSnap.docs[0].data();
                            if (ownerData.email) {
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
    }

    /**
     * Check for critical risks without mitigation
     */
    static async checkCriticalRisks(organizationId: string): Promise<void> {
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
                    await addDoc(collection(db, 'notifications'), sanitizeData({
                        organizationId,
                        userId: adminDoc.id,
                        type: 'danger',
                        title: `${criticalRisksWithoutMitigation.length} risque(s) critique(s) sans atténuation`,
                        message: `Des risques critiques n'ont pas de contrôles d'atténuation associés`,
                        link: '/risks',
                        read: false,
                        createdAt: new Date().toISOString(),
                    }));

                    // Send Email
                    const adminData = adminDoc.data();
                    if (adminData.email) {
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
            { uid: assigneeId, organizationId: task.organizationId } as UserProfile,
            'info',
            'Nouvelle tâche assignée',
            `On vous a assigné la tâche : ${task.title}`,
            '/projects'
        );

        // 3. Send Email
        if (userData && userData.email) {
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
            `/incidents?id=${incident.id}`
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

            const emailPromises = adminsSnap.docs.map(adminDoc => {
                const adminData = adminDoc.data();
                if (adminData.email) {
                    return sendEmail(null, {
                        to: adminData.email,
                        subject: `🚨 Incident : ${incident.title}`,
                        html: getIncidentAlertTemplate(
                            incident.title,
                            incident.severity,
                            incident.reporter || 'Un utilisateur',
                            buildAppUrl(`/incidents?id=${incident.id}`)
                        ),
                        type: 'INCIDENT_ALERT'
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(emailPromises);
        } catch (e) { ErrorLogger.error(e, 'NotificationService.notifyNewIncident'); }
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
            { uid: assigneeId, organizationId: control.organizationId } as UserProfile,
            'info',
            'Contrôle assigné',
            `On vous a assigné le contrôle : ${control.code} - ${control.name}`,
            '/compliance'
        );

        // 3. Send Email
        if (userData && userData.email) {
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
     * Run all automated checks
     */
    static async runAutomatedChecks(organizationId: string): Promise<void> {
        const results = await Promise.allSettled([
            this.checkUpcomingAudits(organizationId),
            this.checkOverdueDocuments(organizationId),
            this.checkUpcomingMaintenance(organizationId),
            this.checkCriticalRisks(organizationId),
            this.checkExpiringContracts(organizationId),
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const methods = ['checkUpcomingAudits', 'checkOverdueDocuments', 'checkUpcomingMaintenance', 'checkCriticalRisks', 'checkExpiringContracts'];
                ErrorLogger.error(result.reason, `NotificationService.${methods[index]}`);
            }
        });
    }

    /**
     * Check for expiring supplier contracts
     */
    static async checkExpiringContracts(organizationId: string): Promise<void> {
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
                                createdAt: new Date().toISOString(),
                            }));

                            // Send Email
                            try {
                                const userSnap = await getDoc(doc(db, 'users', supplier.ownerId));
                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    if (userData.email) {
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
    }
}
