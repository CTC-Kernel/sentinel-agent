import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc, DocumentData } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export interface DataExportOptions {
 organizationId: string;
 planId?: string;
 hasApiAccess?: boolean;
 onUpgradeRequired?: (message: string) => void;
 onError?: (error: unknown) => void;
}

export interface GDPRExportOptions {
 userId: string;
 organizationId: string;
 onError?: (error: unknown) => void;
}

export class DataExportService {
 static async exportOrganizationData(options: DataExportOptions): Promise<void> {
 const { organizationId, planId = 'discovery', hasApiAccess = false, onUpgradeRequired, onError } = options;
 
 // Vérifier les limites du plan
 if (!hasApiAccess) {
 const upgradeMessage = planId === 'discovery' 
 ? 'L\'export de données complètes nécessite le plan Enterprise (499€/mois). Le plan Discovery permet uniquement les exports partiels.'
 : 'L\'export de données complètes nécessite le plan Enterprise.';
 
 if (onUpgradeRequired) {
 onUpgradeRequired(upgradeMessage);
 return;
 }
 
 // Continuer avec un export limité si pas de callback d'upgrade
 return this.exportLimitedData(organizationId, planId);
 }

 const zip = new JSZip();
 const collections = ['assets', 'risks', 'controls', 'documents', 'audits', 'incidents'];

 try {
 const exportData: Record<string, DocumentData[]> = {};

 await Promise.all(collections.map(async (colName) => {
 const q = query(collection(db, colName), where('organizationId', '==', organizationId));
 const snapshot = await getDocs(q);
 exportData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

 // Add to ZIP as individual JSON files
 zip.file(`${colName}.json`, JSON.stringify(exportData[colName], null, 2));
 }));

 // Add README with plan information
 const readmeContent = this.generateDataExportReadme(planId, true);
 zip.file('README.txt', readmeContent);

 // Generate ZIP
 const content = await zip.generateAsync({ type: 'blob' });

 // Save file
 const timestamp = new Date().toISOString().split('T')[0];
 saveAs(content, `sentinel_export_${organizationId}_${timestamp}.zip`);

 } catch (error) {
 ErrorLogger.error(error, 'DataExportService.exportOrganizationData');
 if (onError) onError(error);
 throw error;
 }
 }

 private static async exportLimitedData(organizationId: string, planId: string): Promise<void> {
 const zip = new JSZip();
 const limitedCollections = ['assets', 'risks']; // Collections limitées pour Discovery

 try {
 const exportData: Record<string, DocumentData[]> = {};

 await Promise.all(limitedCollections.map(async (colName) => {
 const q = query(collection(db, colName), where('organizationId', '==', organizationId));
 const snapshot = await getDocs(q);
 exportData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

 // Add to ZIP as individual JSON files
 zip.file(`${colName}.json`, JSON.stringify(exportData[colName], null, 2));
 }));

 // Add README with limitations information
 const readmeContent = this.generateDataExportReadme(planId, false);
 zip.file('README.txt', readmeContent);

 // Generate ZIP
 const content = await zip.generateAsync({ type: 'blob' });

 // Save file with limited indicator
 const timestamp = new Date().toISOString().split('T')[0];
 saveAs(content, `sentinel_export_limited_${organizationId}_${timestamp}.zip`);

 } catch (error) {
 ErrorLogger.error(error, 'DataExportService.exportLimitedData');
 throw error;
 }
 }

 private static generateDataExportReadme(planId: string, isFullExport: boolean): string {
 const currentDate = new Date().toISOString();

 let content = `Export de Données Sentinel GRC\n`;
 content += `Généré le: ${currentDate}\n`;
 content += `Plan: ${planId.toUpperCase()}\n`;
 content += `Type d'export: ${isFullExport ? 'Complet' : 'Limité'}\n\n`;

 if (!isFullExport) {
 content += `=== IMPORTANT ===\n`;
 content += `Cet export est limité en raison des restrictions du plan ${planId}.\n`;
 content += `Pour un export complet de toutes vos données, passez au plan Enterprise.\n`;
 content += `URL: https://sentinel-grc.fr/pricing\n\n`;
 }

 content += `=== Structure du ZIP ===\n`;
 if (isFullExport) {
 content += `- assets.json: Tous les actifs de l'organisation\n`;
 content += `- risks.json: Tous les risques identifiés\n`;
 content += `- controls.json: Tous les contrôles de sécurité\n`;
 content += `- documents.json: Tous les documents et preuves\n`;
 content += `- audits.json: Toutes les audits et évaluations\n`;
 content += `- incidents.json: Tous les incidents de sécurité\n`;
 } else {
 content += `- assets.json: Actifs (limité)\n`;
 content += `- risks.json: Risques (limité)\n`;
 content += `- README.txt: Ce fichier d'information\n`;
 }

 content += `\n=== À propos de Sentinel GRC ===\n`;
 content += `Sentinel GRC est une plateforme de Gouvernance, Risques et Conformité\n`;
 content += `conçue pour les organisations cherchant à obtenir et maintenir\n`;
 content += `leur certification ISO 27001.\n`;
 content += `https://sentinel-grc.fr\n`;

 return content;
 }

 /**
 * GDPR Article 20 - Right to Data Portability
 * This export is ALWAYS available regardless of subscription plan.
 * Exports all personal data associated with a user.
 */
 static async exportGDPRData(options: GDPRExportOptions): Promise<void> {
 const { userId, organizationId, onError } = options;

 const zip = new JSZip();

 try {
 // User profile data
 const userDoc = await getDoc(doc(db, 'users', userId));
 if (userDoc.exists()) {
 const userData = { id: userDoc.id, ...userDoc.data() };
 // Remove sensitive fields that shouldn't be exported
 delete (userData as Record<string, unknown>).passwordHash;
 zip.file('profile.json', JSON.stringify(userData, null, 2));
 }

 // Activity logs (user's own actions)
 const logsQuery = query(
 collection(db, 'auditLogs'),
 where('userId', '==', userId)
 );
 const logsSnapshot = await getDocs(logsQuery);
 const logs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 zip.file('activity_logs.json', JSON.stringify(logs, null, 2));

 // Consent records
 const consentsQuery = query(
 collection(db, 'consents'),
 where('userId', '==', userId)
 );
 const consentsSnapshot = await getDocs(consentsQuery);
 const consents = consentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 zip.file('consent_records.json', JSON.stringify(consents, null, 2));

 // User's comments/notes
 const commentsQuery = query(
 collection(db, 'comments'),
 where('authorId', '==', userId)
 );
 const commentsSnapshot = await getDocs(commentsQuery);
 const comments = commentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 zip.file('my_comments.json', JSON.stringify(comments, null, 2));

 // Items created by user (in organization scope)
 const createdByCollections = ['risks', 'controls', 'incidents', 'documents'];
 for (const colName of createdByCollections) {
 const createdQuery = query(
  collection(db, colName),
  where('organizationId', '==', organizationId),
  where('createdBy', '==', userId)
 );
 const createdSnapshot = await getDocs(createdQuery);
 const created = createdSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 if (created.length > 0) {
  zip.file(`my_${colName}.json`, JSON.stringify(created, null, 2));
 }
 }

 // GDPR-specific README
 const readmeContent = this.generateGDPRExportReadme(userId);
 zip.file('README.txt', readmeContent);

 // Generate ZIP
 const content = await zip.generateAsync({ type: 'blob' });

 // Save file
 const timestamp = new Date().toISOString().split('T')[0];
 saveAs(content, `gdpr_export_${userId}_${timestamp}.zip`);

 } catch (error) {
 ErrorLogger.error(error, 'DataExportService.exportGDPRData');
 if (onError) onError(error);
 throw error;
 }
 }

 private static generateGDPRExportReadme(userId: string): string {
 const currentDate = new Date().toISOString();

 let content = `=== EXPORT RGPD - DROIT À LA PORTABILITÉ ===\n\n`;
 content += `Export de données personnelles conformément au RGPD Article 20\n`;
 content += `Généré le: ${currentDate}\n`;
 content += `Utilisateur: ${userId}\n\n`;

 content += `=== CONTENU DE L'EXPORT ===\n`;
 content += `- profile.json: Votre profil utilisateur\n`;
 content += `- activity_logs.json: Historique de vos actions\n`;
 content += `- consent_records.json: Vos consentements enregistrés\n`;
 content += `- my_comments.json: Vos commentaires\n`;
 content += `- my_*.json: Éléments que vous avez créés\n\n`;

 content += `=== VOS DROITS ===\n`;
 content += `En vertu du RGPD, vous disposez des droits suivants :\n`;
 content += `- Droit d'accès (Art. 15)\n`;
 content += `- Droit de rectification (Art. 16)\n`;
 content += `- Droit à l'effacement (Art. 17)\n`;
 content += `- Droit à la limitation du traitement (Art. 18)\n`;
 content += `- Droit à la portabilité (Art. 20)\n`;
 content += `- Droit d'opposition (Art. 21)\n\n`;

 content += `=== CONTACT DPO ===\n`;
 content += `Pour exercer vos droits ou pour toute question :\n`;
 content += `Email: contact@cyber-threat-consulting.com\n`;
 content += `Cyber Threat Consulting - Avenue Rosa Parks, 69009 Lyon\n`;

 return content;
 }
}
