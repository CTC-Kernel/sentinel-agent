import { EmailTemplateService } from './EmailTemplateService';

/**
 * Moteur de templates d'emails pour Sentinel GRC.
 * Génère du HTML compatible avec les clients mails (Outlook, Gmail, Apple Mail) via EmailTemplateService.
 */

export const getInvitationTemplate = (inviterName: string, role: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Invitation à rejoindre Sentinel GRC',
    content: `
      <p>Bonjour,</p>
      <p><strong>${inviterName}</strong> vous invite à rejoindre l'espace de travail <strong>Sentinel GRC</strong> en tant que <strong>${role}</strong>.</p>
      <p>En acceptant cette invitation, vous accéderez à une plateforme de pilotage SSI dédiée à la gestion des risques, des contrôles ISO 27001 et des plans d'actions.</p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Ce lien est personnel et confidentiel. Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.</p>
    `,
    actionLabel: "Accepter l'invitation",
    actionUrl: link
  });
};

export const getIncidentAlertTemplate = (title: string, severity: string, reporter: string, link: string) => {
  const severityColor = severity === 'Critique' ? '#ef4444' : severity === 'Élevée' ? '#f97316' : '#3b82f6';

  return EmailTemplateService.generateHtml({
    title: '⚠️ Nouvel Incident de Sécurité',
    content: `
      <div style="background-color: ${severityColor}15; border-left: 4px solid ${severityColor}; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <h3 style="margin: 0; color: ${severityColor}; font-size: 16px;">Sévérité : ${severity}</h3>
      </div>
      <p>Un incident a été déclaré par <strong>${reporter}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Titre</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${title}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
      <p>Une action immédiate ou une analyse peut être requise selon le niveau de criticité.</p>
    `,
    actionLabel: "Voir l'incident",
    actionUrl: link
  });
};

export const getDocumentReviewTemplate = (docTitle: string, ownerName: string, dueDate: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Révision Documentaire Requise',
    content: `
      <p>Bonjour ${ownerName},</p>
      <p>Le document <strong>"${docTitle}"</strong> arrive à échéance de révision.</p>
      <p>Conformément à la norme ISO 27001, les politiques et procédures doivent être revues périodiquement pour assurer leur pertinence.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date d'échéance</span>
        <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(dueDate).toLocaleDateString()}</div>
      </div>
    `,
    actionLabel: "Accéder au document",
    actionUrl: link
  });
};

export const getTaskAssignmentTemplate = (taskTitle: string, projectName: string, manager: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Nouvelle tâche assignée',
    content: `
      <p>Une nouvelle tâche vous a été assignée dans le projet <strong>${projectName}</strong> géré par ${manager}.</p>
      <div style="border-left: 4px solid #4F46E5; padding-left: 16px; margin: 24px 0;">
        <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${taskTitle}</h3>
      </div>
    `,
    actionLabel: "Voir la tâche",
    actionUrl: link
  });
};

export const getAuditReminderTemplate = (auditName: string, auditorName: string, scheduledDate: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: '📋 Rappel d\'Audit Planifié',
    content: `
      <p>Bonjour ${auditorName},</p>
      <p>Un audit est planifié dans les prochains jours et nécessite votre attention.</p>
      <div style="background-color: #e0e7ff; border-left: 4px solid #4F46E5; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #3730a3;">${auditName}</h3>
        <p style="margin: 0; font-size: 14px; color: #3730a3;">Date prévue : <strong>${new Date(scheduledDate).toLocaleDateString()}</strong></p>
      </div>
      <p>Assurez-vous d'avoir préparé tous les documents et preuves nécessaires pour cet audit.</p>
    `,
    actionLabel: "Voir l'audit",
    actionUrl: link
  });
};

export const getRiskTreatmentDueTemplate = (riskTitle: string, dueDate: string, responsiblePerson: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: '⏰ Échéance de Traitement de Risque',
    content: `
      <p>Bonjour ${responsiblePerson},</p>
      <p>Le plan de traitement du risque suivant arrive à échéance :</p>
      <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 24px 0;">
        <h3 style="margin: 0; font-size: 16px; color: #0f172a;">${riskTitle}</h3>
        <p style="margin: 8px 0 0 0; color: #64748b;">Date limite : <strong style="color: #d97706;">${new Date(dueDate).toLocaleDateString()}</strong></p>
      </div>
      <p>Veuillez mettre à jour le statut du traitement ou demander une extension si nécessaire.</p>
    `,
    actionLabel: "Gérer le risque",
    actionUrl: link
  });
};

export const getComplianceAlertTemplate = (controlCode: string, controlName: string, issue: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: '🚨 Alerte de Non-Conformité',
    content: `
      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <h3 style="margin: 0; color: #dc2626; font-size: 16px;">Action requise</h3>
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
    `,
    actionLabel: "Voir le contrôle",
    actionUrl: link
  });
};

export const getPasswordResetTemplate = (userName: string, resetLink: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Réinitialisation de votre mot de passe',
    content: `
      <p>Bonjour ${userName},</p>
      <p>Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte Sentinel GRC.</p>
      <div style="background-color: #fef3c7; padding: 16px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">Pour des raisons de sécurité, ce lien est valide pendant 1 heure uniquement et ne peut être utilisé qu'une seule fois.</p>
      </div>
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email. Votre mot de passe actuel restera inchangé.</p>
    `,
    actionLabel: "Choisir un nouveau mot de passe",
    actionUrl: resetLink
  });
};

export const getWelcomeEmailTemplate = (userName: string, organizationName: string, role: string, dashboardLink: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Bienvenue sur Sentinel GRC',
    content: `
      <p style="text-align: center; margin: 0 0 24px 0; color: #4b5563;">Votre espace de pilotage de la sécurité et de la conformité est prêt.</p>
      <p>Bonjour ${userName},</p>
      <p>Votre compte Sentinel GRC a été créé avec succès. Vous pouvez dès à présent structurer votre programme SSI, suivre vos risques et piloter vos audits ISO 27001.</p>
      <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin: 24px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Organisation</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a; text-align: right;">${organizationName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rôle</td>
            <td style="padding: 8px 0; font-weight: 600; color: #4F46E5; text-align: right;">${role}</td>
          </tr>
        </table>
      </div>
      <p>Depuis votre tableau de bord, vous accédez aux actifs, aux risques, aux contrôles ISO 27001, aux audits et aux plans d'actions associés.</p>
    `,
    actionLabel: "Ouvrir le tableau de bord",
    actionUrl: dashboardLink
  });
};

export const getWeeklyDigestTemplate = (userName: string, stats: { newRisks: number; newIncidents: number; tasksCompleted: number; upcomingAudits: number }, link: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Résumé hebdomadaire',
    content: `
      <p>Bonjour ${userName},</p>
      <p>Voici les principaux indicateurs de la semaine sur Sentinel GRC :</p>
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
    `,
    actionLabel: "Voir le tableau de bord",
    actionUrl: link
  });
};

export const getSupplierReviewTemplate = (supplierName: string, criticality: string, lastReviewDate: string, link: string) => {
  const criticalityColor = criticality === 'Critique' ? '#dc2626' : criticality === 'Élevée' ? '#f59e0b' : '#22c55e';

  return EmailTemplateService.generateHtml({
    title: '🏢 Révision Fournisseur Requise',
    content: `
      <p>Un fournisseur critique nécessite une révision de sécurité.</p>
      <div style="background-color: ${criticalityColor}15; border-left: 4px solid ${criticalityColor}; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">${supplierName}</h3>
        <p style="margin: 0; font-size: 14px; color: #64748b;">Criticité : <strong style="color: ${criticalityColor};">${criticality}</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">Dernière révision : ${new Date(lastReviewDate).toLocaleDateString()}</p>
      </div>
      <p>Conformément à la politique de gestion des tiers, une révision annuelle est requise pour tous les fournisseurs critiques.</p>
    `,
    actionLabel: "Accéder aux fournisseurs",
    actionUrl: link
  });
};

export const getContactMessageTemplate = (name: string, email: string, subject: string, message: string) => {
  return EmailTemplateService.generateHtml({
    title: `Nouveau message de contact : ${subject}`,
    content: `
      <p><strong>Nom:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Sujet:</strong> ${subject}</p>
      <br/>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `,
    footerText: "Ce message a été envoyé via le formulaire de contact de l'application."
  });
};

export const getJoinRequestTemplate = (requesterName: string, requesterEmail: string, orgName: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: '👤 Nouvelle demande d\'accès',
    content: `
      <p>Bonjour,</p>
      <p><strong>${requesterName}</strong> (${requesterEmail}) souhaite rejoindre votre organisation <strong>${orgName}</strong>.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #64748b; font-size: 14px;">Veuillez examiner cette demande dans votre tableau de bord.</p>
      </div>
    `,
    actionLabel: "Gérer la demande",
    actionUrl: link
  });
};

export const getJoinRequestApprovedTemplate = (userName: string, orgName: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: '✅ Demande approuvée !',
    content: `
      <p>Bonjour ${userName},</p>
      <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été acceptée.</p>
      <p>Vous avez maintenant accès à l'espace de travail de l'organisation.</p>
    `,
    actionLabel: "Accéder à mon espace",
    actionUrl: link
  });
};

export const getJoinRequestRejectedTemplate = (userName: string, orgName: string) => {
  return EmailTemplateService.generateHtml({
    title: '❌ Demande refusée',
    content: `
      <p>Bonjour ${userName},</p>
      <p>Votre demande pour rejoindre <strong>${orgName}</strong> a été refusée par un administrateur.</p>
      <p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter directement l'administrateur de l'organisation.</p>
    `
  });
};

export const getMaintenanceTemplate = (assetName: string, maintenanceDate: string, ownerName: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: '🛠️ Maintenance Planifiée',
    content: `
      <p>Bonjour ${ownerName},</p>
      <p>Une maintenance est prévue prochainement pour l'actif <strong>${assetName}</strong>.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date de maintenance</span>
        <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(maintenanceDate).toLocaleDateString()}</div>
      </div>
      <p>Veuillez vous assurer que tout est prêt pour cette intervention.</p>
    `,
    actionLabel: "Voir l'actif",
    actionUrl: link
  });
};

export const getAuditInvitationTemplate = (inviterName: string, auditName: string, role: string, link: string) => {
  return EmailTemplateService.generateHtml({
    title: 'Invitation à collaborer sur un audit',
    content: `
      <p>Bonjour,</p>
      <p><strong>${inviterName}</strong> vous invite à participer à l'audit <strong>"${auditName}"</strong> en tant que <strong>${role}</strong>.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #64748b; font-size: 14px;">Vous aurez accès aux constats, aux preuves et à la checklist associée afin de contribuer à l'évaluation et à la conformité ISO 27001.</p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Si vous n'avez pas encore de compte, vous serez invité(e) à en créer un de manière sécurisée avant d'accéder aux informations d'audit.</p>
    `,
    actionLabel: "Accéder à l'audit",
    actionUrl: link
  });
};
