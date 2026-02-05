import { collection, query, where, getDocs, getDoc, deleteDoc, doc, writeBatch, arrayRemove, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Finding, AuditChecklist, Audit } from '../types';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { AuditLogService } from './auditLogService';

export interface AuditDetails {
 findings: Finding[];
 checklist: AuditChecklist | null;
}

export interface AuditDependency {
 id: string;
 name: string;
 type: string;
}

export interface AuditDependencies {
 hasDependencies: boolean;
 dependencies: AuditDependency[];
}

export interface DeleteAuditOptions {
 auditId: string;
 auditName: string;
 organizationId: string;
 userId: string;
 userEmail: string;
}

export class AuditService {
 /**
 * Fetch findings and checklist for a specific audit
 */
 static async getAuditDetails(
 auditId: string,
 organizationId: string
 ): Promise<AuditDetails> {
 try {
 const [findingsSnap, checklistSnap] = await Promise.all([
 getDocs(
  query(
  collection(db, 'findings'),
  where('organizationId', '==', organizationId),
  where('auditId', '==', auditId)
  )
 ),
 getDocs(
  query(
  collection(db, 'audit_checklists'),
  where('organizationId', '==', organizationId),
  where('auditId', '==', auditId)
  )
 )
 ]);

 const findings = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Finding));
 const checklist = checklistSnap.empty
 ? null
 : { id: checklistSnap.docs[0].id, ...checklistSnap.docs[0].data() } as AuditChecklist;

 return { findings, checklist };
 } catch (error) {
 ErrorLogger.error(error, 'AuditService.getAuditDetails');
 throw error;
 }
 }

 /**
 * Check for dependencies (projects, documents, risks, controls linking to this audit)
 */
 static async checkDependencies(
 auditId: string,
 organizationId: string
 ): Promise<AuditDependencies> {
 try {
 // Check all entity types that can reference audits
 const [projectsSnap, documentsSnap, risksSnap, controlsSnap] = await Promise.all([
 getDocs(
  query(
  collection(db, 'projects'),
  where('organizationId', '==', organizationId),
  where('relatedAuditIds', 'array-contains', auditId)
  )
 ),
 getDocs(
  query(
  collection(db, 'documents'),
  where('organizationId', '==', organizationId),
  where('relatedAuditIds', 'array-contains', auditId)
  )
 ),
 getDocs(
  query(
  collection(db, 'risks'),
  where('organizationId', '==', organizationId),
  where('relatedAuditIds', 'array-contains', auditId)
  )
 ),
 getDocs(
  query(
  collection(db, 'controls'),
  where('organizationId', '==', organizationId),
  where('relatedAuditIds', 'array-contains', auditId)
  )
 )
 ]);

 const dependencies: AuditDependency[] = [
 ...projectsSnap.docs.map(d => ({
  id: d.id,
  name: d.data().name || 'Projet',
  type: 'Projet'
 })),
 ...documentsSnap.docs.map(d => ({
  id: d.id,
  name: d.data().title || 'Document',
  type: 'Document'
 })),
 ...risksSnap.docs.map(d => ({
  id: d.id,
  name: d.data().threat || 'Risque',
  type: 'Risque'
 })),
 ...controlsSnap.docs.map(d => ({
  id: d.id,
  name: d.data().name || 'Contrôle',
  type: 'Contrôle'
 }))
 ];

 return {
 hasDependencies: dependencies.length > 0,
 dependencies
 };
 } catch (error) {
 ErrorLogger.error(error, 'AuditService.checkDependencies');
 throw error;
 }
 }

 /**
 * Delete audit with cascade deletion of findings and dependency cleanup
 * Uses atomic batch operations for consistency
 */
 static async deleteAuditWithCascade(options: DeleteAuditOptions): Promise<void> {
 const { auditId, organizationId } = options;

 try {
 // 0. Verify audit belongs to organization (IDOR protection)
 const auditRef = doc(db, 'audits', auditId);
 const auditSnap = await getDoc(auditRef);
 if (!auditSnap.exists() || auditSnap.data().organizationId !== organizationId) {
 throw new Error('Audit not found or access denied');
 }

 // 1. Check dependencies
 const { hasDependencies, dependencies } = await this.checkDependencies(auditId, organizationId);

 // 2. Cleanup all dependencies (projects, documents, risks, controls)
 if (hasDependencies && dependencies.length > 0) {
 const cleanupPromises: Promise<void>[] = [];

 // Cleanup project references
 const projectDeps = dependencies.filter(d => d.type === 'Projet');
 projectDeps.forEach(dep => {
  cleanupPromises.push(
  updateDoc(doc(db, 'projects', dep.id), {
  relatedAuditIds: arrayRemove(auditId)
  }).catch((err: unknown) => {
  ErrorLogger.warn(`Failed to remove audit from project ${dep.id}: ${String(err)}`, 'AuditService.deleteAuditWithCascade');
  })
  );
 });

 // Cleanup document references
 const documentDeps = dependencies.filter(d => d.type === 'Document');
 documentDeps.forEach(dep => {
  cleanupPromises.push(
  updateDoc(doc(db, 'documents', dep.id), {
  relatedAuditIds: arrayRemove(auditId)
  }).catch((err: unknown) => {
  ErrorLogger.warn(`Failed to remove audit from document ${dep.id}: ${String(err)}`, 'AuditService.deleteAuditWithCascade');
  })
  );
 });

 // Cleanup risk references
 const riskDeps = dependencies.filter(d => d.type === 'Risque');
 riskDeps.forEach(dep => {
  cleanupPromises.push(
  updateDoc(doc(db, 'risks', dep.id), {
  relatedAuditIds: arrayRemove(auditId)
  }).catch((err: unknown) => {
  ErrorLogger.warn(`Failed to remove audit from risk ${dep.id}: ${String(err)}`, 'AuditService.deleteAuditWithCascade');
  })
  );
 });

 // Cleanup control references
 const controlDeps = dependencies.filter(d => d.type === 'Contrôle');
 controlDeps.forEach(dep => {
  cleanupPromises.push(
  updateDoc(doc(db, 'controls', dep.id), {
  relatedAuditIds: arrayRemove(auditId)
  }).catch((err: unknown) => {
  ErrorLogger.warn(`Failed to remove audit from control ${dep.id}: ${String(err)}`, 'AuditService.deleteAuditWithCascade');
  })
  );
 });

 await Promise.all(cleanupPromises);
 }

 // 3. Cascade delete findings
 const findingsQ = query(
 collection(db, 'findings'),
 where('organizationId', '==', organizationId),
 where('auditId', '==', auditId)
 );
 const findingsSnap = await getDocs(findingsQ);
 const findingsDeletions = findingsSnap.docs.map(d =>
 deleteDoc(doc(db, 'findings', d.id))
 );
 await Promise.all(findingsDeletions);

 // 4. Cascade delete audit checklist
 const checklistQ = query(
 collection(db, 'audit_checklists'),
 where('organizationId', '==', organizationId),
 where('auditId', '==', auditId)
 );
 const checklistSnap = await getDocs(checklistQ);
 const checklistDeletions = checklistSnap.docs.map(d =>
 deleteDoc(doc(db, 'audit_checklists', d.id))
 );
 await Promise.all(checklistDeletions);

 // 5. Delete the audit itself
 await deleteDoc(doc(db, 'audits', auditId));

 // 6. Audit log for the deletion
 await AuditLogService.logDelete(
 organizationId,
 { id: options.userId, name: options.userEmail, email: options.userEmail },
 'audit',
 auditId,
 { name: options.auditName, deletedAt: new Date().toISOString() },
 options.auditName
 );

 } catch (error) {
 ErrorLogger.error(error, 'AuditService.deleteAuditWithCascade');
 throw error;
 }
 }

 /**
 * Batch create audits (used for AI-generated audit plans)
 * Implements chunking to respect Firestore's 500 operations per batch limit
 */
 static async batchCreateAudits(
 audits: Partial<Audit>[],
 organizationId: string,
 defaultAuditor: string
 ): Promise<void> {
 try {
 const BATCH_SIZE = 450;

 // Split audits into chunks of 500
 for (let i = 0; i < audits.length; i += BATCH_SIZE) {
 const chunk = audits.slice(i, i + BATCH_SIZE);
 const batch = writeBatch(db);

 chunk.forEach(auditData => {
  const newAuditRef = doc(collection(db, 'audits'));
  batch.set(newAuditRef, sanitizeData({
  ...auditData,
  organizationId,
  status: 'Planifié',
  findingsCount: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  auditor: auditData.auditor || defaultAuditor,
  relatedProjectIds: auditData.relatedProjectIds || [],
  relatedControlIds: auditData.relatedControlIds || []
  }));
 });

 await batch.commit();
 }
 } catch (error) {
 ErrorLogger.error(error, 'AuditService.batchCreateAudits');
 throw error;
 }
 }
 /**
 * Batch import audits from CSV data
 */
 static async importAuditsFromCSV(
 lines: Record<string, string>[],
 organizationId: string,
 userId: string
 ): Promise<number> {
 try {
 const BATCH_SIZE = 450;
 let batch = writeBatch(db);
 let count = 0;
 let batchCount = 0;

 for (const row of lines) {
 const values = Object.values(row) as string[];
 const name = row['Nom'] || row['Name'] || values[0] || 'Nouvel Audit';
 const type = row['Type'] || values[1] || 'Interne';
 const status = row['Statut'] || row['Status'] || values[2] || 'Planifié';
 const auditor = row['Auditeur'] || row['Auditor'] || values[3] || '';
 const dateStr = row['Date'] || values[4];
 const description = row['Description'] || values[5] || '';

 if (name) {
  const newRef = doc(collection(db, 'audits'));
  const newAuditData = {
  organizationId,
  name: name.trim(),
  type: (type.trim() || 'Interne') as Audit['type'],
  status: (status.trim() || 'Planifié') as Audit['status'],
  auditor: auditor.trim(),
  dateScheduled: dateStr ? new Date(dateStr).toISOString() : undefined,
  scope: description.trim(),
  findingsCount: 0,
  createdBy: userId,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  relatedProjectIds: [],
  relatedControlIds: []
  };
  batch.set(newRef, sanitizeData(newAuditData));
  count++;
  batchCount++;

  if (batchCount >= BATCH_SIZE) {
  await batch.commit();
  batch = writeBatch(db);
  batchCount = 0;
  }
 }
 }

 if (batchCount > 0) {
 await batch.commit();
 }
 return count;
 } catch (error) {
 ErrorLogger.error(error, 'AuditService.importAuditsFromCSV');
 throw error;
 }
 }
}
