import { EmailTemplateService } from './EmailTemplateService';

/**
 * Moteur de templates d'emails pour Sentinel GRC.
 * Génère du HTML compatible avec les clients mails (Outlook, Gmail, Apple Mail) via EmailTemplateService.
 */

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str: string): string {
 if (!str) return '';
 return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export const getInvitationTemplate = (inviterName: string, role: string, link: string) => {
 return EmailTemplateService.generateHtml({
 title: 'Invitation à rejoindre Sentinel GRC',
 content: `
 <p>Bonjour,</p>
 <p><strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre l'espace de travail <strong>Sentinel GRC</strong> en tant que <strong>${escapeHtml(role)}</strong>.</p>
 <div class="highlight-box">
 <p style="margin: 0; font-size: 14px; color: #64748b;">En acceptant cette invitation, vous accéderez à une plateforme de pilotage SSI dédiée à la gestion des risques, des contrôles ISO 27001 et des plans d'actions.</p>
 </div>
 <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Ce lien est personnel et confidentiel. Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.</p>
 `,
 actionLabel: "Accepter l'invitation",
 actionUrl: link
 });
};

export const getIncidentAlertTemplate = (title: string, severity: string, reporter: string, link: string) => {
 const alertClass = severity === 'Critique' ? 'alert-danger' : severity === 'Élevée' ? 'alert-warning' : 'alert-info';

 return EmailTemplateService.generateHtml({
 title: '⚠️ Nouvel Incident de Sécurité',
 content: `
 <div class="alert-box ${alertClass}">
 <h3 style="margin: 0; font-size: 16px;">Sévérité : ${escapeHtml(severity)}</h3>
 </div>
 <p>Un incident a été déclaré par <strong>${escapeHtml(reporter)}</strong>.</p>
 <table class="data-table">
 <tr>
 <td>Titre</td>
 <td>${escapeHtml(title)}</td>
 </tr>
 <tr>
 <td>Date</td>
 <td>${new Date().toLocaleString()}</td>
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
 <p>Bonjour ${escapeHtml(ownerName)},</p>
 <p>Le document <strong>"${escapeHtml(docTitle)}"</strong> arrive à échéance de révision.</p>
 <div class="highlight-box" style="text-align: center;">
 <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Date d'échéance</span>
 <div style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px;">${new Date(dueDate).toLocaleDateString()}</div>
 </div>
 <p>Conformément à la norme ISO 27001, les politiques et procédures doivent être revues périodiquement pour assurer leur pertinence.</p>
 `,
 actionLabel: "Accéder au document",
 actionUrl: link
 });
};

export const getTaskAssignmentTemplate = (taskTitle: string, projectName: string, manager: string, link: string) => {
 return EmailTemplateService.generateHtml({
 title: 'Nouvelle tâche assignée',
 content: `
 <p>Une nouvelle tâche vous a été assignée dans le projet <strong>${escapeHtml(projectName)}</strong> géré par ${escapeHtml(manager)}.</p>
 <div class="alert-box alert-info">
 <h3 style="margin: 0; font-size: 16px;">${escapeHtml(taskTitle)}</h3>
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
 <p>Bonjour ${escapeHtml(auditorName)},</p>
 <p>Un audit est planifié dans les prochains jours et nécessite votre attention.</p>
 <div class="alert-box alert-info">
 <h3 style="margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(auditName)}</h3>
 <p style="margin: 0; font-size: 14px;">Date prévue : <strong>${new Date(scheduledDate).toLocaleDateString()}</strong></p>
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
 <p>Bonjour ${escapeHtml(responsiblePerson)},</p>
 <p>Le plan de traitement du risque suivant arrive à échéance :</p>
 <div class="alert-box alert-warning">
 <h3 style="margin: 0; font-size: 16px;">${escapeHtml(riskTitle)}</h3>
 <p style="margin: 8px 0 0 0;">Date limite : <strong>${new Date(dueDate).toLocaleDateString()}</strong></p>
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
 <div class="alert-box alert-danger">
 <h3 style="margin: 0; font-size: 16px;">Action requise</h3>
 </div>
 <p>Un contrôle ISO 27001 nécessite une action immédiate.</p>
 <table class="data-table">
 <tr>
 <td>Contrôle</td>
 <td>${escapeHtml(controlCode)} - ${escapeHtml(controlName)}</td>
 </tr>
 <tr>
 <td>Problème</td>
 <td style="color: #dc2626;">${escapeHtml(issue)}</td>
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
 <p>Bonjour ${escapeHtml(userName)},</p>
 <p>Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte Sentinel GRC.</p>
 <div class="alert-box alert-warning">
 <p style="margin: 0; font-size: 13px;">Pour des raisons de sécurité, ce lien est valide pendant 1 heure uniquement et ne peut être utilisé qu'une seule fois.</p>
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
 <p>Bonjour ${escapeHtml(userName)},</p>
 <p>Votre compte Sentinel GRC a été créé avec succès. Vous pouvez dès à présent structurer votre programme SSI, suivre vos risques et piloter vos audits ISO 27001.</p>
 <div class="highlight-box">
 <table class="data-table" style="margin: 0;">
 <tr>
 <td>Organisation</td>
 <td>${escapeHtml(organizationName)}</td>
 </tr>
 <tr>
 <td>Rôle</td>
 <td style="color: #4F46E5;">${escapeHtml(role)}</td>
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
 <p>Bonjour ${escapeHtml(userName)},</p>
 <p>Voici les principaux indicateurs de la semaine sur Sentinel GRC :</p>
 <table width="100%" style="margin: 24px 0; border-spacing: 12px;">
 <tr>
 <td width="50%" style="background-color: #fef2f2; padding: 16px; border-radius: 12px; text-align: center;">
 <div style="font-size: 24px; font-weight: 800; color: #dc2626;">${stats.newRisks}</div>
 <div style="font-size: 11px; color: #991b1b; font-weight: 600; text-transform: uppercase;">Nouveaux Risques</div>
 </td>
 <td width="50%" style="background-color: #fffbeb; padding: 16px; border-radius: 12px; text-align: center;">
 <div style="font-size: 24px; font-weight: 800; color: #d97706;">${stats.newIncidents}</div>
 <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase;">Incidents</div>
 </td>
 </tr>
 <tr>
 <td width="50%" style="background-color: #ecfdf5; padding: 16px; border-radius: 12px; text-align: center;">
 <div style="font-size: 24px; font-weight: 800; color: #059669;">${stats.tasksCompleted}</div>
 <div style="font-size: 11px; color: #065f46; font-weight: 600; text-transform: uppercase;">Tâches Terminées</div>
 </td>
 <td width="50%" style="background-color: #eff6ff; padding: 16px; border-radius: 12px; text-align: center;">
 <div style="font-size: 24px; font-weight: 800; color: #2563eb;">${stats.upcomingAudits}</div>
 <div style="font-size: 11px; color: #1e40af; font-weight: 600; text-transform: uppercase;">Audits à Venir</div>
 </td>
 </tr>
 </table>
 `,
 actionLabel: "Voir le tableau de bord",
 actionUrl: link
 });
};

export const getSupplierReviewTemplate = (supplierName: string, criticality: string, lastReviewDate: string, link: string) => {
 const alertClass = criticality === 'Critique' ? 'alert-danger' : criticality === 'Élevée' ? 'alert-warning' : 'alert-success';

 return EmailTemplateService.generateHtml({
 title: '🏢 Révision Fournisseur Requise',
 content: `
 <p>Un fournisseur critique nécessite une révision de sécurité.</p>
 <div class="alert-box ${alertClass}">
 <h3 style="margin: 0 0 8px 0; font-size: 18px;">${escapeHtml(supplierName)}</h3>
 <p style="margin: 0; font-size: 14px;">Criticité : <strong>${escapeHtml(criticality)}</strong></p>
 <p style="margin: 8px 0 0 0; font-size: 14px;">Dernière révision : ${new Date(lastReviewDate).toLocaleDateString()}</p>
 </div>
 <p>Conformément à la politique de gestion des tiers, une révision annuelle est requise pour tous les fournisseurs critiques.</p>
 `,
 actionLabel: "Accéder aux fournisseurs",
 actionUrl: link
 });
};

export const getContactMessageTemplate = (name: string, email: string, subject: string, message: string) => {
 return EmailTemplateService.generateHtml({
 title: `Nouveau message de contact : ${escapeHtml(subject)}`,
 content: `
 <p><strong>Nom:</strong> ${escapeHtml(name)}</p>
 <p><strong>Email:</strong> ${escapeHtml(email)}</p>
 <p><strong>Sujet:</strong> ${escapeHtml(subject)}</p>
 <br/>
 <p><strong>Message:</strong></p>
 <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
 `,
 footerText: "Ce message a été envoyé via le formulaire de contact de l'application."
 });
};

export const getJoinRequestTemplate = (requesterName: string, requesterEmail: string, orgName: string, link: string) => {
 return EmailTemplateService.generateHtml({
 title: '👤 Nouvelle demande d\'accès',
 content: `
 <p>Bonjour,</p>
 <p><strong>${escapeHtml(requesterName)}</strong> (${escapeHtml(requesterEmail)}) souhaite rejoindre votre organisation <strong>${escapeHtml(orgName)}</strong>.</p>
 <div class="highlight-box">
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
 <p>Bonjour ${escapeHtml(userName)},</p>
 <p>Votre demande pour rejoindre <strong>${escapeHtml(orgName)}</strong> a été acceptée.</p>
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
 <p>Bonjour ${escapeHtml(userName)},</p>
 <p>Votre demande pour rejoindre <strong>${escapeHtml(orgName)}</strong> a été refusée par un administrateur.</p>
 <p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter directement l'administrateur de l'organisation.</p>
 `
 });
};

export const getMaintenanceTemplate = (assetName: string, maintenanceDate: string, ownerName: string, link: string) => {
 return EmailTemplateService.generateHtml({
 title: '🛠️ Maintenance Planifiée',
 content: `
 <p>Bonjour ${escapeHtml(ownerName)},</p>
 <p>Une maintenance est prévue prochainement pour l'actif <strong>${escapeHtml(assetName)}</strong>.</p>
 <div class="highlight-box" style="text-align: center;">
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
 <p><strong>${escapeHtml(inviterName)}</strong> vous invite à participer à l'audit <strong>"${escapeHtml(auditName)}"</strong> en tant que <strong>${escapeHtml(role)}</strong>.</p>
 <div class="highlight-box">
 <p style="margin: 0; color: #64748b; font-size: 14px;">Vous aurez accès aux constats, aux preuves et à la checklist associée afin de contribuer à l'évaluation et à la conformité ISO 27001.</p>
 </div>
 <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Si vous n'avez pas encore de compte, vous serez invité(e) à en créer un de manière sécurisée avant d'accéder aux informations d'audit.</p>
 `,
 actionLabel: "Accéder à l'audit",
 actionUrl: link
 });
};
