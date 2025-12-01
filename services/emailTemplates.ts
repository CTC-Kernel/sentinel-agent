
/**
 * Moteur de templates d'emails pour Sentinel GRC.
 * Génère du HTML compatible avec les clients mails (Outlook, Gmail, Apple Mail).
 */

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  line-height: 1.6;
  font-size: 15px;
  color: #0f172a;
  max-width: 640px;
  margin: 0 auto;
  background-color: #f5f5f7;
  padding: 32px 24px;
  border-radius: 16px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.1);
`;

const BUTTON_STYLE = `
  display: inline-block;
  background-color: #111827;
  color: #ffffff;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 999px;
  font-weight: 600;
  margin-top: 20px;
  font-size: 14px;
  letter-spacing: -0.01em;
`;

const HEADER = `
  <div style="text-align: center; padding: 16px 0 12px 0; border-bottom: 1px solid #e5e7eb;">
    <div style="font-size: 22px; font-weight: 700; color: #020617; letter-spacing: -0.03em;">
      Sentinel <span style="color: #2563eb;">GRC</span>
    </div>
    <div style="margin-top: 4px; font-size: 13px; color: #6b7280;">
      Plateforme de pilotage de la sécurité et de conformité ISO 27001
    </div>
  </div>
`;

const FOOTER = `
  <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; border-top: 1px solid #e5e7eb; margin-top: 32px;">
    <p style="margin: 0 0 4px 0;">&copy; ${new Date().getFullYear()} Sentinel GRC by Cyber Threat Consulting. Tous droits réservés.</p>
    <p style="margin: 4px 0;">Vous recevez cet email dans le cadre de l'utilisation de Sentinel GRC pour le suivi de votre programme SSI et de votre conformité ISO 27001.</p>
    <p style="margin: 4px 0;">Si vous pensez avoir reçu ce message par erreur, contactez votre administrateur Sentinel GRC.</p>
  </div>
`;

export const getInvitationTemplate = (inviterName: string, role: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 22px; color: #020617; margin-bottom: 12px; letter-spacing: -0.02em;">Invitation à rejoindre Sentinel GRC</h2>
        <p style="margin: 0 0 8px 0; color: #4b5563;">Bonjour,</p>
        <p style="margin: 0 0 8px 0;"><strong>${inviterName}</strong> vous invite à rejoindre l'espace de travail <strong>Sentinel GRC</strong> en tant que <strong>${role}</strong>.</p>
        <p style="margin: 0 0 16px 0; color: #4b5563;">En acceptant cette invitation, vous accéderez à une plateforme de pilotage SSI dédiée à la gestion des risques, des contrôles ISO 27001 et des plans d'actions.</p>
        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Accepter l'invitation</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Ce lien est personnel et confidentiel. Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.</p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>${link}</p>
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

export const getAuditReminderTemplate = (auditName: string, auditorName: string, scheduledDate: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">📋 Rappel d'Audit Planifié</h2>
        <p>Bonjour ${auditorName},</p>
        <p>Un audit est planifié dans les prochains jours et nécessite votre attention.</p>
        
        <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e40af;">${auditName}</h3>
          <p style="margin: 0; font-size: 14px; color: #1e3a8a;">Date prévue : <strong>${new Date(scheduledDate).toLocaleDateString()}</strong></p>
        </div>

        <p>Assurez-vous d'avoir préparé tous les documents et preuves nécessaires pour cet audit.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Voir l'audit</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getRiskTreatmentDueTemplate = (riskTitle: string, dueDate: string, responsiblePerson: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #d97706; margin: 0; font-weight: 700;">⏰ Échéance de Traitement de Risque</h2>
        </div>
        
        <p>Bonjour ${responsiblePerson},</p>
        <p>Le plan de traitement du risque suivant arrive à échéance :</p>
        
        <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 24px 0;">
          <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${riskTitle}</h3>
          <p style="margin: 8px 0 0 0; color: #64748b;">Date limite : <strong style="color: #d97706;">${new Date(dueDate).toLocaleDateString()}</strong></p>
        </div>

        <p>Veuillez mettre à jour le statut du traitement ou demander une extension si nécessaire.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE} background-color: #f59e0b;">Gérer le risque</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getComplianceAlertTemplate = (controlCode: string, controlName: string, issue: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #dc2626; margin: 0; font-weight: 700;">🚨 Alerte de Non-Conformité</h2>
        </div>
        
        <p>Un contrôle ISO 27001 nécessite une action immédiate.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Contrôle</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${controlCode} - ${controlName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Problème</td>
            <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${issue}</td>
          </tr>
        </table>

        <p>La conformité ISO 27001 exige une résolution rapide de cette non-conformité.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE} background-color: #dc2626;">Voir le contrôle</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getPasswordResetTemplate = (userName: string, resetLink: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 22px; color: #020617; margin-bottom: 12px; letter-spacing: -0.02em;">Réinitialisation de votre mot de passe</h2>
        <p style="margin: 0 0 8px 0;">Bonjour ${userName},</p>
        <p style="margin: 0 0 16px 0; color: #4b5563;">Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte Sentinel GRC.</p>
        
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 12px; margin: 24px 0;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">Pour des raisons de sécurité, ce lien est valide pendant 1 heure uniquement et ne peut être utilisé qu'une seule fois.</p>
        </div>

        <div style="text-align: center;">
          <a href="${resetLink}" style="${BUTTON_STYLE}">Choisir un nouveau mot de passe</a>
        </div>

        <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email. Votre mot de passe actuel restera inchangé.</p>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Sentinel GRC ne vous demandera jamais votre mot de passe par email.</p>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getWelcomeEmailTemplate = (userName: string, organizationName: string, role: string, dashboardLink: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 24px; color: #020617; margin-bottom: 12px; text-align: center; letter-spacing: -0.03em;">Bienvenue sur Sentinel GRC</h2>
        <p style="text-align: center; margin: 0 0 24px 0; color: #4b5563;">Votre espace de pilotage de la sécurité et de la conformité est prêt.</p>
        <p>Bonjour ${userName},</p>
        <p style="margin: 0 0 16px 0; color: #4b5563;">Votre compte Sentinel GRC a été créé avec succès. Vous pouvez dès à présent structurer votre programme SSI, suivre vos risques et piloter vos audits ISO 27001.</p>
        
        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin: 24px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Organisation</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a; text-align: right;">${organizationName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rôle</td>
              <td style="padding: 8px 0; font-weight: 600; color: #2563eb; text-align: right;">${role}</td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 16px 0; color: #4b5563;">Depuis votre tableau de bord, vous accédez aux actifs, aux risques, aux contrôles ISO 27001, aux audits et aux plans d'actions associés.</p>

        <div style="text-align: center;">
          <a href="${dashboardLink}" style="${BUTTON_STYLE}">Ouvrir le tableau de bord</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getWeeklyDigestTemplate = (userName: string, stats: { newRisks: number; newIncidents: number; tasksCompleted: number; upcomingAudits: number }, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #020617; margin-bottom: 12px; letter-spacing: -0.02em;">Résumé hebdomadaire de votre programme SSI</h2>
        <p style="margin: 0 0 8px 0;">Bonjour ${userName},</p>
        <p style="margin: 0 0 16px 0; color: #4b5563;">Voici les principaux indicateurs de la semaine sur Sentinel GRC :</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
          <div style="background-color: #fee2e2; padding: 16px; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 800; color: #dc2626;">${stats.newRisks}</div>
            <div style="font-size: 12px; color: #991b1b; font-weight: 600; text-transform: uppercase;">Nouveaux Risques</div>
          </div>
          <div style="background-color: #fef3c7; padding: 16px; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 800; color: #d97706;">${stats.newIncidents}</div>
            <div style="font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase;">Incidents</div>
          </div>
          <div style="background-color: #d1fae5; padding: 16px; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 800; color: #059669;">${stats.tasksCompleted}</div>
            <div style="font-size: 12px; color: #065f46; font-weight: 600; text-transform: uppercase;">Tâches Terminées</div>
          </div>
          <div style="background-color: #dbeafe; padding: 16px; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 800; color: #2563eb;">${stats.upcomingAudits}</div>
            <div style="font-size: 12px; color: #1e40af; font-weight: 600; text-transform: uppercase;">Audits à Venir</div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Voir le tableau de bord</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getSupplierReviewTemplate = (supplierName: string, criticality: string, lastReviewDate: string, link: string) => {
  const criticalityColor = criticality === 'Critique' ? '#dc2626' : criticality === 'Élevée' ? '#f59e0b' : '#22c55e';

  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">🏢 Révision Fournisseur Requise</h2>
        <p>Un fournisseur critique nécessite une révision de sécurité.</p>
        
        <div style="background-color: ${criticalityColor}15; border-left: 4px solid ${criticalityColor}; padding: 16px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">${supplierName}</h3>
          <p style="margin: 0; font-size: 14px; color: #64748b;">Criticité : <strong style="color: ${criticalityColor};">${criticality}</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">Dernière révision : ${new Date(lastReviewDate).toLocaleDateString()}</p>
        </div>

        <p>Conformément à la politique de gestion des tiers, une révision annuelle est requise pour tous les fournisseurs critiques.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Réviser le fournisseur</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};


export const getJoinRequestTemplate = (requesterName: string, requesterEmail: string, orgName: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">👤 Nouvelle demande d'accès</h2>
        <p>Bonjour,</p>
        <p><strong>${requesterName}</strong> (${requesterEmail}) souhaite rejoindre votre organisation <strong>${orgName}</strong>.</p>
        
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">Veuillez examiner cette demande dans votre tableau de bord.</p>
        </div>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Gérer la demande</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getJoinRequestApprovedTemplate = (userName: string, orgName: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">✅ Demande approuvée !</h2>
        <p>Bonjour ${userName},</p>
        <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été acceptée.</p>
        <p>Vous avez maintenant accès à l'espace de travail de l'organisation.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Accéder à mon espace</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getJoinRequestRejectedTemplate = (userName: string, orgName: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">❌ Demande refusée</h2>
        <p>Bonjour ${userName},</p>
        <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été refusée par un administrateur.</p>
        <p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter directement l'administrateur de l'organisation.</p>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getMaintenanceTemplate = (assetName: string, maintenanceDate: string, ownerName: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">🛠️ Maintenance Planifiée</h2>
        <p>Bonjour ${ownerName},</p>
        <p>Une maintenance est prévue prochainement pour l'actif <strong>${assetName}</strong>.</p>
        
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date de maintenance</span>
          <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(maintenanceDate).toLocaleDateString()}</div>
        </div>

        <p>Veuillez vous assurer que tout est prêt pour cette intervention.</p>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Voir l'actif</a>
        </div>
      </div>
      ${FOOTER}
    </div>
  `;
};

export const getAuditInvitationTemplate = (inviterName: string, auditName: string, role: string, link: string) => {
  return `
    <div style="${BASE_STYLES}">
      ${HEADER}
      <div style="padding: 32px 0;">
        <h2 style="font-size: 20px; color: #020617; margin-bottom: 12px; letter-spacing: -0.02em;">Invitation à collaborer sur un audit</h2>
        <p style="margin: 0 0 8px 0; color: #4b5563;">Bonjour,</p>
        <p style="margin: 0 0 16px 0;"><strong>${inviterName}</strong> vous invite à participer à l'audit <strong>"${auditName}"</strong> en tant que <strong>${role}</strong>.</p>
        
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">Vous aurez accès aux constats, aux preuves et à la checklist associée afin de contribuer à l'évaluation et à la conformité ISO 27001.</p>
        </div>

        <div style="text-align: center;">
          <a href="${link}" style="${BUTTON_STYLE}">Accéder à l'audit</a>
        </div>
        
        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Si vous n'avez pas encore de compte, vous serez invité(e) à en créer un de manière sécurisée avant d'accéder aux informations d'audit.</p>
      </div>
      ${FOOTER}
    </div>
  `;
};
