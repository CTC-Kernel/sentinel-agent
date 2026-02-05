import { collection, getDocs, query, where } from 'firebase/firestore';
import { UserProfile, Risk } from '../types';
import { db } from '../firebase';
import { sendEmail } from './emailService';
import {
 getAuditReminderTemplate,
 getRiskTreatmentDueTemplate,
 getDocumentReviewTemplate,
 getWeeklyDigestTemplate,
 getSupplierReviewTemplate
} from './emailTemplates';
import { buildAppUrl } from '../config/appConfig';
import { ErrorLogger } from './errorLogger';

/**
 * Service pour gérer les emails planifiés et récurrents.
 * Ce service doit être exécuté par une Cloud Function programmée (ex: tous les jours à 9h).
 */

/**
 * Envoie des rappels d'audit 7 jours avant la date prévue.
 */
export const sendAuditReminders = async (organizationId: string) => {
 try {
 const sevenDaysFromNow = new Date();
 sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
 const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

 const auditsSnap = await getDocs(
 query(
 collection(db, 'audits'),
 where('organizationId', '==', organizationId),
 where('status', 'in', ['Planifié', 'En cours'])
 )
 );

 const usersSnap = await getDocs(
 query(collection(db, 'users'), where('organizationId', '==', organizationId))
 );
 const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[];

 let sentCount = 0;

 for (const auditDoc of auditsSnap.docs) {
 const audit = auditDoc.data();
 const auditDate = audit.dateScheduled?.split('T')[0];

 if (auditDate === sevenDaysStr) {
 const auditor = users.find(u => u.displayName === audit.auditor || u.email === audit.auditor);

 if (auditor?.email) {
  const htmlContent = getAuditReminderTemplate(
  audit.name,
  auditor.displayName || auditor.email,
  audit.dateScheduled,
  buildAppUrl('/audits')
  );

  await sendEmail(null, {
  to: auditor.email,
  subject: `[Rappel] Audit planifié dans 7 jours : ${audit.name}`,
  html: htmlContent,
  type: 'AUDIT_REMINDER',
  metadata: { auditId: auditDoc.id }
  }, false);

  sentCount++;
 }
 }
 }

 return sentCount;
 } catch (error) {
 ErrorLogger.error(error as Error, 'scheduledEmailService.sendAuditReminders');
 return 0;
 }
};

/**
 * Envoie des rappels pour les traitements de risques arrivant à échéance.
 */
export const sendRiskTreatmentReminders = async (organizationId: string) => {
 try {
 const threeDaysFromNow = new Date();
 threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
 const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

 const risksSnap = await getDocs(
 query(
 collection(db, 'risks'),
 where('organizationId', '==', organizationId),
 where('status', 'in', ['Ouvert', 'En cours'])
 )
 );

 const usersSnap = await getDocs(
 query(collection(db, 'users'), where('organizationId', '==', organizationId))
 );
 const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[];

 let sentCount = 0;

 for (const riskDoc of risksSnap.docs) {
 const risk = riskDoc.data() as Risk;
 const treatment = risk.treatment as { dueDate?: string; ownerId?: string; status?: string } | undefined;
 if (!treatment?.dueDate || !treatment.ownerId) continue;

 const dueDate = treatment.dueDate.split('T')[0];

 if (dueDate === threeDaysStr && (treatment.status === 'Planifié' || treatment.status === 'En cours' || !treatment.status)) {
 const responsible = users.find(u => u.uid === treatment.ownerId);

 if (responsible?.email) {
  const htmlContent = getRiskTreatmentDueTemplate(
  risk.threat,
  treatment.dueDate,
  responsible.displayName || responsible.email,
  buildAppUrl('/risks')
  );

  await sendEmail(null, {
  to: responsible.email,
  subject: `[Échéance] Traitement de risque dans 3 jours : ${risk.threat}`,
  html: htmlContent,
  type: 'RISK_TREATMENT_DUE',
  metadata: { riskId: riskDoc.id }
  }, false);

  sentCount++;
 }
 }
 }

 return sentCount;
 } catch (error) {
 ErrorLogger.error(error as Error, 'scheduledEmailService.sendRiskTreatmentReminders');
 return 0;
 }
};

/**
 * Envoie des rappels pour les révisions de documents.
 */
export const sendDocumentReviewReminders = async (organizationId: string) => {
 try {
 const fourteenDaysFromNow = new Date();
 fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
 const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];

 const docsSnap = await getDocs(
 query(
 collection(db, 'documents'),
 where('organizationId', '==', organizationId),
 where('status', '==', 'Publié')
 )
 );

 const usersSnap = await getDocs(
 query(collection(db, 'users'), where('organizationId', '==', organizationId))
 );
 const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[];

 let sentCount = 0;

 for (const docDoc of docsSnap.docs) {
 const doc = docDoc.data();
 const reviewDate = doc.nextReviewDate?.split('T')[0];

 if (reviewDate === fourteenDaysStr && doc.owner) {
 const owner = users.find(u => u.email === doc.owner);

 if (owner?.email) {
  const htmlContent = getDocumentReviewTemplate(
  doc.title,
  owner.displayName || owner.email,
  doc.nextReviewDate,
  buildAppUrl('/documents')
  );

  await sendEmail(null, {
  to: owner.email,
  subject: `[Révision] Document à réviser dans 14 jours : ${doc.title}`,
  html: htmlContent,
  type: 'DOCUMENT_REVIEW',
  metadata: { documentId: docDoc.id }
  }, false);

  sentCount++;
 }
 }
 }

 return sentCount;
 } catch (error) {
 ErrorLogger.error(error as Error, 'scheduledEmailService.sendDocumentReviewReminders');
 return 0;
 }
};

/**
 * Envoie des rappels pour les révisions de fournisseurs critiques.
 */
export const sendSupplierReviewReminders = async (organizationId: string) => {
 try {
 const now = new Date();
 const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

 const suppliersSnap = await getDocs(
 query(
 collection(db, 'suppliers'),
 where('organizationId', '==', organizationId),
 where('criticality', 'in', ['Critique', 'Élevée'])
 )
 );

 const usersSnap = await getDocs(
 query(collection(db, 'users'), where('organizationId', '==', organizationId), where('role', 'in', ['admin', 'rssi']))
 );
 const admins = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[];

 let sentCount = 0;

 for (const supplierDoc of suppliersSnap.docs) {
 const supplier = supplierDoc.data();
 const lastReview = supplier.lastSecurityReview ? new Date(supplier.lastSecurityReview) : null;

 if (!lastReview || lastReview < oneYearAgo) {
 for (const admin of admins) {
  if (admin.email) {
  const htmlContent = getSupplierReviewTemplate(
  supplier.name,
  supplier.criticality,
  supplier.lastSecurityReview || 'Jamais',
  buildAppUrl('/suppliers')
  );

  await sendEmail(null, {
  to: admin.email,
  subject: `[Action Requise] Révision fournisseur critique : ${supplier.name}`,
  html: htmlContent,
  type: 'SUPPLIER_REVIEW',
  metadata: { supplierId: supplierDoc.id }
  }, false);

  sentCount++;
  }
 }
 }
 }

 return sentCount;
 } catch (error) {
 ErrorLogger.error(error as Error, 'scheduledEmailService.sendSupplierReviewReminders');
 return 0;
 }
};

/**
 * Envoie un digest hebdomadaire à tous les utilisateurs actifs.
 * À exécuter tous les lundis matin.
 */
export const sendWeeklyDigest = async (organizationId: string) => {
 try {
 const oneWeekAgo = new Date();
 oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

 // Récupérer les stats de la semaine
 const [risksSnap, incidentsSnap, auditsSnap, usersSnap] = await Promise.all([
 getDocs(query(collection(db, 'risks'), where('organizationId', '==', organizationId))),
 getDocs(query(collection(db, 'incidents'), where('organizationId', '==', organizationId))),
 getDocs(query(collection(db, 'audits'), where('organizationId', '==', organizationId))),
 getDocs(query(collection(db, 'users'), where('organizationId', '==', organizationId)))
 ]);

 const risks = risksSnap.docs.map(d => d.data());
 const incidents = incidentsSnap.docs.map(d => d.data());
 const audits = auditsSnap.docs.map(d => d.data());
 const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[];

 const newRisks = risks.filter(r => new Date(r.createdAt) > oneWeekAgo).length;
 const newIncidents = incidents.filter(i => new Date(i.dateReported) > oneWeekAgo).length;
 const upcomingAudits = audits.filter(a => {
 const auditDate = new Date(a.dateScheduled);
 const twoWeeksFromNow = new Date();
 twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
 return auditDate < twoWeeksFromNow && a.status !== 'Terminé';
 }).length;

 const stats = {
 newRisks,
 newIncidents,
 tasksCompleted: 0, // À calculer depuis les projets si nécessaire
 upcomingAudits
 };

 let sentCount = 0;

 for (const user of users) {
 if (user.email && user.role !== 'user') { // Envoyer uniquement aux rôles actifs
 const htmlContent = getWeeklyDigestTemplate(
  user.displayName || user.email,
  stats,
  buildAppUrl('/dashboard')
 );

 await sendEmail(null, {
  to: user.email,
  subject: `📊 Résumé hebdomadaire Sentinel GRC`,
  html: htmlContent,
  type: 'WEEKLY_DIGEST',
  metadata: { organizationId }
 }, false);

 sentCount++;
 }
 }

 return sentCount;
 } catch (error) {
 ErrorLogger.error(error as Error, 'scheduledEmailService.sendWeeklyDigest');
 return 0;
 }
};

/**
 * Fonction principale à appeler quotidiennement par une Cloud Function.
 */
export const runDailyEmailTasks = async (organizationId: string) => {
 const results = await Promise.allSettled([
 sendAuditReminders(organizationId),
 sendRiskTreatmentReminders(organizationId),
 sendDocumentReviewReminders(organizationId),
 sendSupplierReviewReminders(organizationId)
 ]);

 const totalSent = results.reduce((acc, result) => {
 if (result.status === 'fulfilled') {
 return acc + result.value;
 }
 return acc;
 }, 0);

 return totalSent;
};
