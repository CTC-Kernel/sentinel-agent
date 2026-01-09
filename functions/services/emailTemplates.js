const { defineString } = require("firebase-functions/params");

// Define App URL - Reusing the param from index.js conceptual scope via arguments or recreating if needed.
// In this helper we will accept the appUrl as an argument to be pure, or use a hardcoded fallback/param if possible.
// Ideally, we'll keep it pure.

/**
 * Shared Styles & Layout
 */
const styles = {
  body: `
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    background-color: #f1f5f9; /* Slate 100 */
    color: #334155; /* Slate 700 */
    -webkit-font-smoothing: antialiased;
  `,
  wrapper: `
    width: 100%;
    background-color: #f1f5f9;
    padding: 40px 0;
  `,
  container: `
    margin: 0 auto;
    width: 600px;
    max-width: 90%;
    background-color: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: 1px solid #e2e8f0;
  `,
  header: `
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    padding: 40px;
    text-align: center;
  `,
  logoText: `
    color: #ffffff;
    font-size: 24px;
    font-weight: 700;
    text-decoration: none;
    letter-spacing: -0.5px;
  `,
  logoAccent: `
    color: #3b82f6; /* Blue 500 */
  `,
  content: `
    padding: 40px;
  `,
  title: `
    margin: 0 0 24px 0;
    color: #0f172a; /* Slate 900 */
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.3;
  `,
  text: `
    margin: 0 0 16px 0;
    font-size: 16px;
    color: #475569; /* Slate 600 */
  `,
  buttonContainer: `
    margin: 32px 0;
    text-align: center;
  `,
  button: `
    display: inline-block;
    padding: 16px 36px;
    background-color: #2563eb; /* Blue 600 */
    color: #ffffff;
    font-weight: 600;
    text-decoration: none;
    border-radius: 12px;
    font-size: 16px;
    transition: background-color 0.2s;
    text-align: center;
    mso-padding-alt: 0;
    border: none;
    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
  `,
  footer: `
    background-color: #f8fafc; /* Slate 50 */
    padding: 32px;
    text-align: center;
    border-top: 1px solid #e2e8f0;
  `,
  footerText: `
    margin: 0;
    font-size: 13px;
    color: #94a3b8; /* Slate 400 */
    line-height: 1.5;
  `,
  highlightBox: `
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    margin: 24px 0;
  `,
  alertBox: `
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
    border-left: 4px solid;
    background-color: #fffbeb; 
    border-color: #f59e0b; 
    color: #92400e;
  `
};

/**
 * Simple HTML Entry Helper
 */
const escapeHtml = (text) => {
  if (!text) return text;
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Base Email Generator
 */
const generateEmailHtml = ({ title, content, actionLabel, actionUrl, footerText }) => {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; border: none !important; }
      .content { padding: 24px !important; }
      .header { padding: 32px 24px !important; }
      .button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body style="${styles.body}">
  <div style="${styles.wrapper}">
    <center>
      <!-- Main Container -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="${styles.container}" class="container">
        
        <!-- Header -->
        <tr>
          <td style="${styles.header}" class="header">
            <a href="https://app.cyber-threat-consulting.com" style="${styles.logoText}">
              Sentinel <span style="${styles.logoAccent}">GRC</span>
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="${styles.content}" class="content">
            <h1 style="${styles.title}">${escapeHtml(title)}</h1>
            
            <div style="${styles.text}">
              ${content}
            </div>

            ${actionLabel && actionUrl ? `
            <div style="${styles.buttonContainer}">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(actionUrl)}" style="height:54px;v-text-anchor:middle;width:240px;" arcsize="22%" stroke="f" fillcolor="#2563eb">
                <w:anchorlock/>
                <center>
              <![endif]-->
                  <a href="${escapeHtml(actionUrl)}" class="button" style="${styles.button}">
                    ${escapeHtml(actionLabel)}
                  </a>
              <!--[if mso]>
                </center>
              </v:roundrect>
              <![endif]-->
            </div>
            ` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="${styles.footer}">
            <p style="${styles.footerText}">
              &copy; ${year} Cyber Threat Consulting. Sentinel GRC.<br>
              Tous droits réservés.
            </p>
            <p style="${styles.footerText}" style="margin-top: 12px;">
              ${escapeHtml(footerText) || 'Ce message vous a été envoyé automatiquement pour la gestion de votre conformité.'}
            </p>
            <p style="${styles.footerText}" style="margin-top: 12px; font-size: 11px;">
              avenue rosa parks 69009 Lyon • SIRET 91934079400024
            </p>
          </td>
        </tr>
      </table>
    </center>
  </div>
</body>
</html>
  `;
};

/**
 * Access Request Email (To Admin)
 */
const getJoinRequestEmailHtml = (requesterName, requesterEmail, orgName, link) => generateEmailHtml({
  title: "Une nouvelle demande d'accès nécessite votre attention",
  content: `
    <p style="${styles.text}">Bonjour,</p>
    <p style="${styles.text}"><strong>${escapeHtml(requesterName)}</strong> (${escapeHtml(requesterEmail)}) a demandé à rejoindre votre organisation <strong>${escapeHtml(orgName)}</strong> sur Sentinel GRC.</p>
    
    <div style="${styles.highlightBox}">
      <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 500;">Action requise</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #334155;">Veuillez examiner cette demande pour accorder ou refuser l'accès aux ressources de l'organisation.</p>
    </div>
  `,
  actionLabel: "Examiner la demande",
  actionUrl: link
});

/**
 * Request Approved Email (To User)
 */
const getApprovedEmailHtml = (userName, orgName, link) => generateEmailHtml({
  title: "Bienvenue dans l'équipe !",
  content: `
    <p style="${styles.text}">Bonjour <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="${styles.text}">Excellente nouvelle ! Votre demande pour rejoindre l'organisation <strong>${escapeHtml(orgName)}</strong> a été validée par un administrateur.</p>
    
    <div style="${styles.highlightBox}">
      <p style="margin: 0; font-size: 14px; color: #64748b;">Vous avez désormais accès à tous les outils de conformité et de gouvernance assignés à votre rôle.</p>
    </div>
    
    <p style="${styles.text}">Cliquez ci-dessous pour configurer votre profil et commencer.</p>
  `,
  actionLabel: "Accéder à mon espace",
  actionUrl: link
});

/**
 * Request Rejected Email (To User)
 */
const getRejectedEmailHtml = (userName, orgName) => generateEmailHtml({
  title: "Mise à jour de votre demande",
  content: `
    <p style="${styles.text}">Bonjour ${escapeHtml(userName)},</p>
    <p style="${styles.text}">Nous vous informons que votre demande pour rejoindre l'organisation <strong>${escapeHtml(orgName)}</strong> n'a pas pu être acceptée pour le moment.</p>
    
    <div style="${styles.alertBox}">
      <p style="margin: 0; font-size: 14px;"><strong>Note de l'administrateur :</strong> L'accès est restreint aux membres confirmés de l'organisation. Si vous pensez qu'il s'agit d'une erreur, veuillez contacter directement votre responsable sécurité.</p>
    </div>
  `
});

/**
 * Password Reset Email
 */
const getPasswordResetEmailHtml = (userName, link) => generateEmailHtml({
  title: "Réinitialisez votre mot de passe",
  content: `
    <p style="${styles.text}">Bonjour ${escapeHtml(userName)},</p>
    <p style="${styles.text}">Nous avons reçu une demande pour réinitialiser le mot de passe de votre compte Sentinel GRC.</p>
    
    <div style="${styles.highlightBox}">
      <p style="margin: 0; font-size: 14px; color: #64748b;">Si vous êtes à l'origine de cette demande, vous pouvez choisir un nouveau mot de passe sécurisé en cliquant sur le bouton ci-dessous.</p>
    </div>

    <p style="${styles.text}">Pour votre sécurité, ce lien expire dans 1 heure.</p>
  `,
  actionLabel: "Choisir un nouveau mot de passe",
  actionUrl: link,
  footerText: "Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail. Votre compte reste sécurisé."
});

/**
 * Welcome Email (New Org Creator)
 */
const getWelcomeEmailHtml = (userName, orgName, link) => generateEmailHtml({
  title: "Bienvenue sur Sentinel GRC",
  content: `
    <p style="${styles.text}">Bonjour <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="${styles.text}">Félicitations pour la création de votre organisation <strong>${escapeHtml(orgName)}</strong>.</p>
    <p style="${styles.text}">Sentinel GRC est prêt à orchestrer votre gouvernance. Vous disposez d'un accès administrateur complet pour inviter vos collaborateurs, cartographier vos actifs et piloter votre conformité ISO 27001.</p>
    
    <div style="${styles.highlightBox}">
      <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 500;">Prochaines étapes conseillées :</p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; color: #334155;">
        <li>Complétez les informations de votre organisation</li>
        <li>Invitez votre équipe</li>
        <li>Lancez votre premier audit</li>
      </ul>
    </div>
  `,
  actionLabel: "Démarrer maintenant",
  actionUrl: link
});

module.exports = {
  getJoinRequestEmailHtml,
  getApprovedEmailHtml,
  getRejectedEmailHtml,
  getPasswordResetEmailHtml,
  getWelcomeEmailHtml,

  // New templates ported from frontend
  getInvitationHtml: (inviterName, role, link) => generateEmailHtml({
    title: 'Invitation à rejoindre Sentinel GRC',
    content: `
      <p style="${styles.text}">Bonjour,</p>
      <p style="${styles.text}"><strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre l'espace de travail <strong>Sentinel GRC</strong> en tant que <strong>${escapeHtml(role)}</strong>.</p>
      <div style="${styles.highlightBox}">
        <p style="margin: 0; font-size: 14px; color: #64748b;">En acceptant cette invitation, vous accéderez à une plateforme de pilotage SSI dédiée à la gestion des risques, des contrôles ISO 27001 et des plans d'actions.</p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Ce lien est personnel et confidentiel. Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.</p>
    `,
    actionLabel: "Accepter l'invitation",
    actionUrl: link
  }),

  getIncidentAlertHtml: (title, severity, reporter, link) => {
    const alertColor = severity === 'Critique' ? '#dc2626' : severity === 'Élevée' ? '#ea580c' : '#0284c7';
    return generateEmailHtml({
      title: '⚠️ Nouvel Incident de Sécurité',
      content: `
        <div style="${styles.alertBox}; border-color: ${alertColor}; background-color: ${severity === 'Critique' ? '#fef2f2' : severity === 'Élevée' ? '#fff7ed' : '#f0f9ff'}; color: ${alertColor}">
          <h3 style="margin: 0; font-size: 16px;">Sévérité : ${escapeHtml(severity)}</h3>
        </div>
        <p style="${styles.text}">Un incident a été déclaré par <strong>${escapeHtml(reporter)}</strong>.</p>
        <p style="${styles.text}"><strong>Titre :</strong> ${escapeHtml(title)}</p>
        <p style="${styles.text}"><strong>Date :</strong> ${new Date().toLocaleString()}</p>
        <p style="${styles.text}">Une action immédiate ou une analyse peut être requise selon le niveau de criticité.</p>
      `,
      actionLabel: "Voir l'incident",
      actionUrl: link
    });
  },

  getDocumentReviewHtml: (docTitle, ownerName, dueDate, link) => generateEmailHtml({
    title: 'Révision Documentaire Requise',
    content: `
      <p style="${styles.text}">Bonjour ${escapeHtml(ownerName)},</p>
      <p style="${styles.text}">Le document <strong>"${escapeHtml(docTitle)}"</strong> arrive à échéance de révision.</p>
      <div style="${styles.highlightBox}; text-align: center;">
        <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date d'échéance</span>
        <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(dueDate).toLocaleDateString()}</div>
      </div>
      <p style="${styles.text}">Conformément à la norme ISO 27001, les politiques et procédures doivent être revues périodiquement pour assurer leur pertinence.</p>
    `,
    actionLabel: "Accéder au document",
    actionUrl: link
  }),

  getTaskAssignmentHtml: (taskTitle, projectName, manager, link) => generateEmailHtml({
    title: 'Nouvelle tâche assignée',
    content: `
      <p style="${styles.text}">Une nouvelle tâche vous a été assignée dans le projet <strong>${escapeHtml(projectName)}</strong> géré par ${escapeHtml(manager)}.</p>
      <div style="${styles.highlightBox}">
        <h3 style="margin: 0; font-size: 16px;">${escapeHtml(taskTitle)}</h3>
      </div>
    `,
    actionLabel: "Voir la tâche",
    actionUrl: link
  }),

  getAuditReminderHtml: (auditName, auditorName, scheduledDate, link) => generateEmailHtml({
    title: '📋 Rappel d\'Audit Planifié',
    content: `
      <p style="${styles.text}">Bonjour ${escapeHtml(auditorName)},</p>
      <p style="${styles.text}">Un audit est planifié dans les prochains jours et nécessite votre attention.</p>
      <div style="${styles.highlightBox}">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(auditName)}</h3>
        <p style="margin: 0; font-size: 14px;">Date prévue : <strong>${new Date(scheduledDate).toLocaleDateString()}</strong></p>
      </div>
      <p style="${styles.text}">Assurez-vous d'avoir préparé tous les documents et preuves nécessaires pour cet audit.</p>
    `,
    actionLabel: "Voir l'audit",
    actionUrl: link
  }),

  getRiskTreatmentDueHtml: (riskTitle, dueDate, responsiblePerson, link) => generateEmailHtml({
    title: '⏰ Échéance de Traitement de Risque',
    content: `
      <p style="${styles.text}">Bonjour ${escapeHtml(responsiblePerson)},</p>
      <p style="${styles.text}">Le plan de traitement du risque suivant arrive à échéance :</p>
      <div style="${styles.alertBox}">
        <h3 style="margin: 0; font-size: 16px;">${escapeHtml(riskTitle)}</h3>
        <p style="margin: 8px 0 0 0;">Date limite : <strong>${new Date(dueDate).toLocaleDateString()}</strong></p>
      </div>
      <p style="${styles.text}">Veuillez mettre à jour le statut du traitement ou demander une extension si nécessaire.</p>
    `,
    actionLabel: "Gérer le risque",
    actionUrl: link
  }),

  getComplianceAlertHtml: (controlCode, controlName, issue, link) => generateEmailHtml({
    title: '🚨 Alerte de Non-Conformité',
    content: `
      <div style="${styles.alertBox}; border-color: #dc2626; background-color: #fef2f2; color: #991b1b;">
        <h3 style="margin: 0; font-size: 16px;">Action requise</h3>
      </div>
      <p style="${styles.text}">Un contrôle ISO 27001 nécessite une action immédiate.</p>
      <p style="${styles.text}"><strong>Contrôle :</strong> ${escapeHtml(controlCode)} - ${escapeHtml(controlName)}</p>
      <p style="${styles.text}; color: #dc2626;"><strong>Problème :</strong> ${escapeHtml(issue)}</p>
      <p style="${styles.text}">La conformité ISO 27001 exige une résolution rapide de cette non-conformité.</p>
    `,
    actionLabel: "Voir le contrôle",
    actionUrl: link
  }),

  getMaintenanceHtml: (assetName, maintenanceDate, ownerName, link) => generateEmailHtml({
    title: '🛠️ Maintenance Planifiée',
    content: `
      <p style="${styles.text}">Bonjour ${escapeHtml(ownerName)},</p>
      <p style="${styles.text}">Une maintenance est prévue prochainement pour l'actif <strong>${escapeHtml(assetName)}</strong>.</p>
      <div style="${styles.highlightBox}; text-align: center;">
        <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date de maintenance</span>
        <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(maintenanceDate).toLocaleDateString()}</div>
      </div>
      <p style="${styles.text}">Veuillez vous assurer que tout est prêt pour cette intervention.</p>
    `,
    actionLabel: "Voir l'actif",
    actionUrl: link
  }),

  getAuditInvitationHtml: (inviterName, auditName, role, link) => generateEmailHtml({
    title: 'Invitation à collaborer sur un audit',
    content: `
      <p style="${styles.text}">Bonjour,</p>
      <p style="${styles.text}"><strong>${escapeHtml(inviterName)}</strong> vous invite à participer à l'audit <strong>"${escapeHtml(auditName)}"</strong> en tant que <strong>${escapeHtml(role)}</strong>.</p>
      <div style="${styles.highlightBox}">
        <p style="margin: 0; color: #64748b; font-size: 14px;">Vous aurez accès aux constats, aux preuves et à la checklist associée afin de contribuer à l'évaluation et à la conformité ISO 27001.</p>
      </div>
    `,
    actionLabel: "Accéder à l'audit",
    actionUrl: link
  }),

  getCertifierInvitationHtml: (tenantName, message, link) => generateEmailHtml({
    title: 'Invitation à collaborer',
    content: `
      <p style="${styles.text}">Bonjour,</p>
      <p style="${styles.text}">L'organisation <strong>${escapeHtml(tenantName)}</strong> vous invite à rejoindre son écosystème de certification sur Sentinel GRC.</p>
      ${message ? `<div style="${styles.highlightBox}; font-style: italic;">"${escapeHtml(message)}"</div>` : ''}
      <p style="${styles.text}">Cliquez sur le lien ci-dessous pour créer votre compte Auditeur/Certifieur.</p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 12px;">Si le lien ne fonctionne pas : ${escapeHtml(link)}</p>
    `,
    actionLabel: "Accepter l'invitation",
    actionUrl: link
  }),

  getAuditAssignmentHtml: (organizationId, link) => generateEmailHtml({
    title: 'Nouvel Audit Assigné',
    content: `
      <p style="${styles.text}">Bonjour,</p>
      <p style="${styles.text}">L'organisation <strong>${escapeHtml(organizationId)}</strong> vous a assigné un audit sur Sentinel GRC.</p>
      <div style="${styles.highlightBox}">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Connectez-vous à votre tableau de bord auditeur pour y accéder.</p>
      </div>
    `,
    actionLabel: "Accéder au Tableau de Bord",
    actionUrl: link
  }),

  getDrillOverdueHtml: (processName, link) => generateEmailHtml({
    title: 'Exercice PCA Requis',
    content: `
      <div style="${styles.alertBox}">
        <h3 style="margin: 0; font-size: 16px;">Action requise</h3>
      </div>
      <p style="${styles.text}">Le processus <strong>"${escapeHtml(processName)}"</strong> n'a pas été testé depuis plus d'un an.</p>
      <p style="${styles.text}">La conformité et la résilience exigent des tests réguliers des plans de continuité.</p>
      <div style="${styles.highlightBox}">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Veuillez planifier un nouvel exercice ou mettre à jour la date du dernier test.</p>
      </div>
    `,
    actionLabel: "Voir le processus",
    actionUrl: link
  })
};
