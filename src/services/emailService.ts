import { logAction } from './logger';
import { ErrorLogger } from './errorLogger';
import DOMPurify from 'dompurify';

// Types d'emails supportés
export type EmailType =
 | 'INVITATION'
 | 'INCIDENT_ALERT'
 | 'DOCUMENT_REVIEW'
 | 'TASK_ASSIGNMENT'
 | 'AUDIT_REMINDER'
 | 'RISK_TREATMENT_DUE'
 | 'COMPLIANCE_ALERT'
 | 'PASSWORD_RESET'
 | 'WELCOME_EMAIL'
 | 'WEEKLY_DIGEST'
 | 'SUPPLIER_REVIEW'
 | 'JOIN_REQUEST'
 | 'JOIN_REQUEST_APPROVED'
 | 'JOIN_REQUEST_REJECTED'
 | 'AUDIT_INVITATION'
 | 'MAINTENANCE_ALERT'
 | 'GENERIC';

export interface EmailPayload {
 to: string;
 subject: string;
 html: string;
 type: EmailType;
 metadata?: Record<string, unknown>;
}

/**
 * Service centralisé d'envoi d'email.
 * Dans une architecture Firebase classique, cela écrit dans une collection 'mail_queue'.
 * Une Cloud Function (non incluse ici) écouterait cette collection pour envoyer le mail via SendGrid/Mailgun.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// ... imports

/**
 * Service centralisé d'envoi d'email.
 * Utilise une Cloud Function sécurisée 'sendEmail' pour mettre en file d'attente.
 */
export const sendEmail = async (
 user: { uid: string; email: string } | null,
 payload: EmailPayload,
 simulatePreview: boolean = false
) => {
 try {
 // 1. Appel de la Cloud Function sécurisée
 const sendEmailFn = httpsCallable(functions, 'sendEmail');
 await sendEmailFn({
 to: payload.to,
 subject: payload.subject,
 html: payload.html,
 type: payload.type,
 metadata: payload.metadata || {}
 });

 // 2. Log système (via le nouveau logger sécurisé si possible, sinon l'ancien logger qui sera aussi migré)
 // Note: logAction sera aussi migré pour utiliser une Cloud Function
 await logAction(user, 'EMAIL_QUEUED', 'System', `Email '${payload.type}' envoyé à ${payload.to}`);

 // 3. Simulation visuelle pour la démo / le dev
 if (simulatePreview) {
 previewEmailInNewWindow(payload);
 }

 return true;
 } catch (error) {
 ErrorLogger.error(error, 'emailService.sendEmail', { metadata: { to: payload.to, type: payload.type } });
 return false;
 }
};

/**
 * Sanitize HTML to prevent XSS attacks using DOMPurify
 */
const sanitizeHtml = (html: string): string => {
 return DOMPurify.sanitize(html);
};

/**
 * Ouvre une fenêtre pop-up pour montrer à l'utilisateur à quoi ressemble l'email.
 * Utile pour le développement et la démo sans serveur SMTP réel.
 */
const previewEmailInNewWindow = (payload: EmailPayload) => {
 const win = window.open('', '_blank', 'width=600,height=800');
 if (win) {
 // Sanitize HTML content to prevent XSS
 const sanitizedHtml = sanitizeHtml(payload.html);
 const sanitizedSubject = payload.subject.replace(/[<>"'&]/g, (c) => ({
 '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
 }[c] || c));

 win.document.write(`
 <html>
 <head>
 <title>Prévisualisation Email: ${sanitizedSubject}</title>
 <style>body { background-color: #f8fafc; margin: 0; padding: 40px; }</style>
 </head>
 <body>
 <div style="background: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border-radius: 16px; overflow: hidden;">
 ${sanitizedHtml}
 </div>
 <div style="text-align: center; margin-top: 20px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; font-size: 12px;">
 Ceci est une simulation d'envoi. En production, cet email partirait via SendGrid/Mailgun.
 </div>
 </body>
 </html>
 `);
 win.document.close();
 }
};

/**
 * Envoie plusieurs emails en une seule opération.
 * Utile pour les notifications de masse (ex: rappels d'audit à toute l'équipe).
 */
export const sendBulkEmail = async (
 user: { uid: string; email: string } | null,
 recipients: string[],
 payload: Omit<EmailPayload, 'to'>,
 simulatePreview: boolean = false
) => {
 try {
 const promises = recipients.map(recipient =>
 sendEmail(user, { ...payload, to: recipient }, simulatePreview)
 );

 await Promise.all(promises);
 await logAction(user, 'BULK_EMAIL_QUEUED', 'System', `${recipients.length} emails '${payload.type}' envoyés`);
 return true;
 } catch (error) {
 ErrorLogger.error(error, 'emailService.sendBulkEmail', { metadata: { count: recipients.length, type: payload.type } });
 return false;
 }
};

/**
 * Programme l'envoi d'un email à une date future.
 * Stocke l'email avec un timestamp de déclenchement.
 */
export const scheduleEmail = async (
 user: { uid: string; email: string } | null,
 payload: EmailPayload,
 scheduledFor: Date
) => {
 try {
 const scheduleEmailFn = httpsCallable(functions, 'scheduleEmail');
 await scheduleEmailFn({
 to: payload.to,
 subject: payload.subject,
 html: payload.html,
 type: payload.type,
 scheduledFor: scheduledFor.toISOString(),
 metadata: payload.metadata || {}
 });

 await logAction(user, 'EMAIL_SCHEDULED', 'System', `Email '${payload.type}' programmé pour ${scheduledFor.toLocaleString('fr-FR')}`);
 return true;
 } catch (error) {
 ErrorLogger.error(error, 'emailService.scheduleEmail', { metadata: { to: payload.to, type: payload.type, scheduledFor } });
 return false;
 }
};

