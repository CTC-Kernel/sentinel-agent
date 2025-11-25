import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { UserProfile } from '../types';

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

        await addDoc(collection(db, 'notifications'), {
            organizationId: user.organizationId,
            userId: user.uid,
            type,
            title,
            message,
            link,
            read: false,
            createdAt: new Date().toISOString(),
            expiresAt,
        });
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
            addDoc(collection(db, 'notifications'), {
                organizationId,
                userId: userDoc.id,
                type,
                title,
                message,
                link,
                read: false,
                createdAt: new Date().toISOString(),
            })
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
        const audits = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

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
                        await addDoc(collection(db, 'notifications'), {
                            organizationId,
                            userId: auditorId,
                            type: daysUntil <= 3 ? 'danger' : 'warning',
                            title: `Audit à venir : ${audit.name}`,
                            message: `L'audit est prévu dans ${daysUntil} jour(s) - ${new Date(audit.dateScheduled).toLocaleDateString()}`,
                            link: '/audits',
                            read: false,
                            createdAt: new Date().toISOString(),
                        });
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
        const documents = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

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
                        await addDoc(collection(db, 'notifications'), {
                            organizationId,
                            userId: ownerId,
                            type: 'warning',
                            title: `Document à réviser : ${doc.title}`,
                            message: `La date de révision est dépassée depuis le ${new Date(doc.nextReviewDate).toLocaleDateString()}`,
                            link: '/documents',
                            read: false,
                            createdAt: new Date().toISOString(),
                        });
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
        const assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

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
                            await addDoc(collection(db, 'notifications'), {
                                organizationId,
                                userId: ownerId,
                                type: daysUntil <= 7 ? 'warning' : 'info',
                                title: `Maintenance à prévoir : ${asset.name}`,
                                message: `Maintenance prévue dans ${daysUntil} jour(s)`,
                                link: '/assets',
                                read: false,
                                createdAt: new Date().toISOString(),
                            });
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
        const risks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

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
                    await addDoc(collection(db, 'notifications'), {
                        organizationId,
                        userId: adminDoc.id,
                        type: 'danger',
                        title: `${criticalRisksWithoutMitigation.length} risque(s) critique(s) sans atténuation`,
                        message: `Des risques critiques n'ont pas de contrôles d'atténuation associés`,
                        link: '/risks',
                        read: false,
                        createdAt: new Date().toISOString(),
                    });
                }
            }
        }
    }

    /**
     * Run all automated checks
     */
    static async runAutomatedChecks(organizationId: string): Promise<void> {
        await Promise.allSettled([
            this.checkUpcomingAudits(organizationId),
            this.checkOverdueDocuments(organizationId),
            this.checkUpcomingMaintenance(organizationId),
            this.checkCriticalRisks(organizationId),
        ]);
    }
}
