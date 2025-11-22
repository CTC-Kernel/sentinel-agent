
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { logAction } from './logger';

// Types d'emails supportés
type EmailType = 'INVITATION' | 'INCIDENT_ALERT' | 'DOCUMENT_REVIEW' | 'TASK_ASSIGNMENT';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  type: EmailType;
  metadata?: any;
}

/**
 * Service centralisé d'envoi d'email.
 * Dans une architecture Firebase classique, cela écrit dans une collection 'mail_queue'.
 * Une Cloud Function (non incluse ici) écouterait cette collection pour envoyer le mail via SendGrid/Mailgun.
 */
export const sendEmail = async (
  user: { uid: string; email: string } | null,
  payload: EmailPayload,
  simulatePreview: boolean = true
) => {
  try {
    // 1. Écriture dans la file d'attente (Pattern standard Firebase Extension)
    await addDoc(collection(db, 'mail_queue'), {
      to: payload.to,
      message: {
        subject: payload.subject,
        html: payload.html,
      },
      type: payload.type,
      metadata: payload.metadata || {},
      status: 'PENDING', // Sera passé à 'SENT' par le backend
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'system'
    });

    // 2. Log système
    await logAction(user, 'EMAIL_QUEUED', 'System', `Email '${payload.type}' envoyé à ${payload.to}`);

    // 3. Simulation visuelle pour la démo / le dev
    if (simulatePreview) {
      previewEmailInNewWindow(payload);
    }

    return true;
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email", error);
    return false;
  }
};

/**
 * Ouvre une fenêtre pop-up pour montrer à l'utilisateur à quoi ressemble l'email.
 * Utile pour le développement et la démo sans serveur SMTP réel.
 */
const previewEmailInNewWindow = (payload: EmailPayload) => {
  const win = window.open('', '_blank', 'width=600,height=800');
  if (win) {
    win.document.write(`
      <html>
        <head>
          <title>Prévisualisation Email: ${payload.subject}</title>
          <style>body { background-color: #f8fafc; margin: 0; padding: 40px; }</style>
        </head>
        <body>
          <div style="background: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border-radius: 16px; overflow: hidden;">
            ${payload.html}
          </div>
          <div style="text-align: center; margin-top: 20px; color: #64748b; font-family: sans-serif; font-size: 12px;">
            Ceci est une simulation d'envoi. En production, cet email partirait via SendGrid/Mailgun.
          </div>
        </body>
      </html>
    `);
    win.document.close();
  }
};
