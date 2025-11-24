/**
 * Service de notifications push navigateur
 */

export interface PushNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    actions?: { action: string; title: string }[];
}

export class PushNotificationService {
    private static registration: ServiceWorkerRegistration | null = null;

    /**
     * Initialise le service worker et demande la permission
     */
    static async initialize(): Promise<boolean> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return false;
        }

        try {
            // Enregistrer le service worker
            this.registration = await navigator.serviceWorker.register('/sw.js');

            // Demander la permission
            const permission = await this.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Failed to initialize push notifications:', error);
            return false;
        }
    }

    /**
     * Demande la permission pour les notifications
     */
    static async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission !== 'denied') {
            return await Notification.requestPermission();
        }

        return Notification.permission;
    }

    /**
     * Envoie une notification push locale
     */
    static async sendNotification(options: PushNotificationOptions): Promise<void> {
        const permission = await this.requestPermission();

        if (permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }

        if (!this.registration) {
            await this.initialize();
        }

        if (!this.registration) {
            throw new Error('Service worker not registered');
        }

        await this.registration.showNotification(options.title, {
            body: options.body,
            icon: options.icon || '/logo192.png',
            badge: '/logo192.png',
            data: {
                url: options.url || '/',
                timestamp: Date.now()
            }
        } as any); // Type assertion needed for extended notification options
    }

    /**
     * Vérifie si les notifications sont supportées
     */
    static isSupported(): boolean {
        return 'Notification' in window && 'serviceWorker' in navigator;
    }

    /**
     * Vérifie si la permission est accordée
     */
    static hasPermission(): boolean {
        return Notification.permission === 'granted';
    }

    /**
     * Notifications prédéfinies pour différents événements
     */
    static async notifyIncidentCritique(incidentTitle: string, incidentId: string): Promise<void> {
        await this.sendNotification({
            title: '🚨 Incident Critique',
            body: `Nouvel incident critique: ${incidentTitle}`,
            url: `/incidents?id=${incidentId}`,
            actions: [
                { action: 'open', title: 'Voir l\'incident' },
                { action: 'close', title: 'Plus tard' }
            ]
        });
    }

    static async notifyAuditImminent(auditName: string, daysRemaining: number): Promise<void> {
        await this.sendNotification({
            title: '📅 Audit Imminent',
            body: `L'audit "${auditName}" commence dans ${daysRemaining} jour(s)`,
            url: '/audits',
            actions: [
                { action: 'open', title: 'Préparer' },
                { action: 'close', title: 'OK' }
            ]
        });
    }

    static async notifyRisqueNonTraite(riskThreat: string, riskId: string): Promise<void> {
        await this.sendNotification({
            title: '⚠️ Risque Non Traité',
            body: `Le risque "${riskThreat}" nécessite votre attention`,
            url: `/risks?id=${riskId}`,
            actions: [
                { action: 'open', title: 'Traiter' },
                { action: 'close', title: 'Ignorer' }
            ]
        });
    }

    static async notifyDocumentRevision(documentTitle: string, documentId: string): Promise<void> {
        await this.sendNotification({
            title: '📄 Document à Réviser',
            body: `Le document "${documentTitle}" doit être révisé`,
            url: `/documents?id=${documentId}`,
            actions: [
                { action: 'open', title: 'Réviser' },
                { action: 'close', title: 'Plus tard' }
            ]
        });
    }

    static async notifyConformiteAmelioration(percentage: number): Promise<void> {
        await this.sendNotification({
            title: '✅ Amélioration de Conformité',
            body: `Votre taux de conformité est maintenant à ${percentage}%`,
            url: '/compliance'
        });
    }
}
