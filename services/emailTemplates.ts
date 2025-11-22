
/**
 * Moteur de templates d'emails pour Sentinel GRC.
 * Génère du HTML compatible avec les clients mails (Outlook, Gmail, Apple Mail).
 */

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #334155;
  max-width: 600px;
  margin: 0 auto;
`;

const BUTTON_STYLE = `
  display: inline-block;
  background-color: #2563eb;
  color: #ffffff;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  margin-top: 20px;
  font-size: 14px;
`;

const HEADER = `
  <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
    <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
      Sentinel <span style="color: #2563eb;">GRC</span>
    </div>
  </div>
`;

const FOOTER = `
  <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 32px;">
    <p>&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
    <p>Cet email est une notification automatique liée à votre conformité ISO 27001.</p>
  </div>
`;

export const getInvitationTemplate = (inviterName: string, role: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Bienvenue dans l'équipe !</h2>
        <p>Bonjour,</p>
        <p><strong>${inviterName}</strong> vous invite à rejoindre la plateforme <strong>Sentinel GRC</strong> en tant que <strong>${role}</strong>.</p>
        <p>Vous aurez accès aux outils de gestion des risques et de conformité pour collaborer avec l'équipe sécurité.</p>
        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Accepter l'invitation</a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Si le bouton ne fonctionne pas, copiez ce lien : <br/>${link}</p>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getIncidentAlertTemplate = (title: string, severity: string, reporter: string, link: string) => {
  const severityColor = severity === 'Critique' ? '#ef4444' : severity === 'Élevée' ? '#f97316' : '#3b82f6';
  
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <div style="background-color: ${severityColor}15; border-left: 4px solid ${severityColor}; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: ${severityColor}; margin: 0; font-weight: 700;">⚠️ Nouvel Incident de Sécurité</h2>
        </div>
        
        <p>Un incident a été déclaré par <strong>${reporter}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Titre</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Sévérité</td>
            <td style="padding: 8px 0; font-weight: 600; color: ${severityColor};">${severity}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${new Date().toLocaleString()}</td>
          </tr>
        </table>

        <p>Une action immédiate ou une analyse peut être requise selon le niveau de criticité.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE} background-color: #0f172a;">Voir l'incident</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getDocumentReviewTemplate = (docTitle: string, ownerName: string, dueDate: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Révision Documentaire Requise</h2>
        <p>Bonjour ${ownerName},</p>
        <p>Le document <strong>"${docTitle}"</strong> arrive à échéance de révision.</p>
        <p>Conformément à la norme ISO 27001, les politiques et procédures doivent être revues périodiquement pour assurer leur pertinence.</p>
        
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date d'échéance</span>
          <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(dueDate).toLocaleDateString()}</div>
        </div>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Accéder au document</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getTaskAssignmentTemplate = (taskTitle: string, projectName: string, manager: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Nouvelle tâche assignée</h2>
        <p>Une nouvelle tâche vous a été assignée dans le projet <strong>${projectName}</strong> géré par ${manager}.</p>
        
        <div style="border-left: 4px solid #2563eb; padding-left: 16px; margin: 24px 0;">
          <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${taskTitle}</h3>
        </div>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Voir la tâche</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};
