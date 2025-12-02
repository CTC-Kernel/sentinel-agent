/**
 * Service de notifications push navigateur via Firebase Cloud Messaging
 */
import { messaging, VAPID_KEY, db, auth } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';

export interface PushNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    actions?: { action: string; title: string }[];
}

export class PushNotificationService {
    /**
     * Initialise le service et demande la permission
     */
    static async initialize(): Promise<boolean> {
        if (!('serviceWorker' in navigator) || !messaging) {

            return false;
        }

        try {
            // Demander la permission
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                // Obtenir le token FCM
                if (!VAPID_KEY) {
                    ErrorLogger.warn('VAPID_KEY is not defined. Push notifications cannot be registered.', 'PushNotificationService.initialize');
                    return false;
                }

                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY
                });

                if (token) {
                    await this.saveTokenToDatabase(token);
                }

                // Écouter les messages au premier plan
                onMessage(messaging, (payload) => {

                    // On peut afficher un toast ou une notification locale ici si l'app est ouverte
                    if (payload.notification) {
                        new Notification(payload.notification.title || 'Notification', {
                            body: payload.notification.body,
                            icon: '/logo192.png'
                        });
                    }
                });

                return true;
            }
            return false;
        } catch (error) {
            ErrorLogger.error(error, 'PushNotificationService.initialize');
            return false;
        }
    }

    /**
     * Sauvegarde le token FCM dans Firestore pour l'utilisateur courant
     */
    private static async saveTokenToDatabase(token: string) {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);

        try {
            // Vérifier si le token existe déjà pour éviter les écritures inutiles
            const docSnap = await getDoc(userRef);
            const data = docSnap.data();

            if (data && data.fcmTokens && data.fcmTokens.includes(token)) {
                return;
            }

            await setDoc(userRef, {
                fcmTokens: arrayUnion(token)
            }, { merge: true });
        } catch (error) {
            ErrorLogger.error(error, 'PushNotificationService.saveTokenToDatabase');
        }
    }

    /**
     * Demande la permission pour les notifications
     */
    static async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            return 'denied';
        }
        return await Notification.requestPermission();
    }

    /**
     * Envoie une notification push locale (fallback ou test)
     */
    static async sendNotification(options: PushNotificationOptions): Promise<void> {
        if (Notification.permission === 'granted') {
            new Notification(options.title, {
                body: options.body,
                icon: options.icon || '/logo192.png',
                data: { url: options.url }
            });
        }
    }

    /**
     * Vérifie si les notifications sont supportées
     */
    static isSupported(): boolean {
        return 'Notification' in window && 'serviceWorker' in navigator && !!messaging;
    }

    /**
     * Vérifie si la permission est accordée
     */
    static hasPermission(): boolean {
        return Notification.permission === 'granted';
    }

    // --- Helpers pour les notifications spécifiques ---

    static async notifyIncidentCritique(_incidentTitle: string, _incidentId: string): Promise<void> {
        // Cette méthode est maintenant principalement gérée par le backend via Cloud Functions
        // Mais on peut l'utiliser pour des feedbacks locaux immédiats

    }

    static async notifyAuditImminent(_auditName: string, _daysRemaining: number): Promise<void> {

    }
}
