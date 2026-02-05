import { collection, query, where, getDocs, doc, writeBatch, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { } from '../types';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { serverTimestamp } from 'firebase/firestore';
import { FunctionsService } from './FunctionsService';

export interface ProjectDependency {
 id: string;
 name: string;
 type: string;
}

export interface ProjectDependencies {
 hasDependencies: boolean;
 dependencies: ProjectDependency[];
}

export interface SyncProjectLinksOptions {
 projectId: string;
 relatedRiskIds?: string[];
 relatedControlIds?: string[];
 relatedAssetIds?: string[];
 relatedAuditIds?: string[];
 oldRiskIds?: string[];
 oldControlIds?: string[];
 oldAssetIds?: string[];
 oldAuditIds?: string[];
}

export class ProjectService {
 /**
 * Check dependencies for a project across risks, controls, assets, and audits
 */
 static async checkDependencies(
 projectId: string,
 organizationId: string
 ): Promise<ProjectDependencies> {
 try {
 const [rSnap, cSnap, aSnap, auSnap] = await Promise.all([
 getDocs(
  query(
  collection(db, 'risks'),
  where('organizationId', '==', organizationId),
  where('relatedProjectIds', 'array-contains', projectId),
  limit(20)
  )
 ),
 getDocs(
  query(
  collection(db, 'controls'),
  where('organizationId', '==', organizationId),
  where('relatedProjectIds', 'array-contains', projectId),
  limit(20)
  )
 ),
 getDocs(
  query(
  collection(db, 'assets'),
  where('organizationId', '==', organizationId),
  where('relatedProjectIds', 'array-contains', projectId),
  limit(20)
  )
 ),
 getDocs(
  query(
  collection(db, 'audits'),
  where('organizationId', '==', organizationId),
  where('relatedProjectIds', 'array-contains', projectId),
  limit(20)
  )
 )
 ]);

 const dependencies: ProjectDependency[] = [
 ...rSnap.docs.map(d => ({
  id: d.id,
  name: d.data().threat || 'Risque',
  type: 'Risque'
 })),
 ...cSnap.docs.map(d => ({
  id: d.id,
  name: d.data().code || d.data().name || 'Contrôle',
  type: 'Contrôle'
 })),
 ...aSnap.docs.map(d => ({
  id: d.id,
  name: d.data().name || 'Actif',
  type: 'Actif'
 })),
 ...auSnap.docs.map(d => ({
  id: d.id,
  name: d.data().name || 'Audit',
  type: 'Audit'
 }))
 ];

 return {
 hasDependencies: dependencies.length > 0,
 dependencies
 };
 } catch (error) {
 ErrorLogger.error(error, 'ProjectService.checkDependencies');
 throw error;
 }
 }

 /**
 * Delete project with cascade cleanup of relationships
 * Implements chunking to respect Firestore's 500 operations per batch limit
 */
 /**
 * Securely delete project (Server-side enforced integrity)
 * Replaces client-side cascade unlinking with strict blocking if dependencies exist.
 */
 static async deleteProjectWithCascade(
 projectId: string,
 _organizationId: string
 ): Promise<void> {
 try {
 await FunctionsService.deleteResource('projects', projectId);
 } catch (error) {
 ErrorLogger.error(error, 'ProjectService.deleteProjectWithCascade');
 throw error;
 }
 }

 /**
 * Sync project links across related collections
 * Used during create/update to maintain bidirectional relationships
 */
 static syncProjectLinks(
 batch: ReturnType<typeof writeBatch>,
 options: SyncProjectLinksOptions
 ): void {
 const {
 projectId,
 relatedRiskIds = [],
 relatedControlIds = [],
 relatedAssetIds = [],
 relatedAuditIds = [],
 oldRiskIds = [],
 oldControlIds = [],
 oldAssetIds = [],
 oldAuditIds = []
 } = options;

 // Helper to sync a collection's links
 const syncLinks = (
 collectionName: string,
 newIds: string[],
 oldIds: string[]
 ) => {
 const added = newIds.filter(id => !oldIds.includes(id));
 const removed = oldIds.filter(id => !newIds.includes(id));

 added.forEach(id => {
 batch.update(doc(db, collectionName, id), {
  relatedProjectIds: arrayUnion(projectId)
 });
 });

 removed.forEach(id => {
 batch.update(doc(db, collectionName, id), {
  relatedProjectIds: arrayRemove(projectId)
 });
 });
 };

 syncLinks('risks', relatedRiskIds, oldRiskIds);
 syncLinks('controls', relatedControlIds, oldControlIds);
 syncLinks('assets', relatedAssetIds, oldAssetIds);
 syncLinks('audits', relatedAuditIds, oldAuditIds);
 }

 /**
 * Sync project links for new project creation
 */
 static syncNewProjectLinks(
 batch: ReturnType<typeof writeBatch>,
 projectId: string,
 relatedRiskIds?: string[],
 relatedControlIds?: string[],
 relatedAssetIds?: string[],
 relatedAuditIds?: string[]
 ): void {
 const syncNew = (collectionName: string, ids: string[]) => {
 ids.forEach(id => {
 batch.update(doc(db, collectionName, id), {
  relatedProjectIds: arrayUnion(projectId)
 });
 });
 };

 if (relatedRiskIds) syncNew('risks', relatedRiskIds);
 if (relatedControlIds) syncNew('controls', relatedControlIds);
 if (relatedAssetIds) syncNew('assets', relatedAssetIds);
 if (relatedAuditIds) syncNew('audits', relatedAuditIds);
 }
 /**
 * Import projects from CSV data
 */
 static async importProjectsFromCSV(
 data: Record<string, string>[],
 organizationId: string,
 userId: string,
 userDisplayName: string
 ): Promise<number> {
 try {
 const BATCH_SIZE = 450;
 let batch = writeBatch(db);
 let count = 0;
 let batchCount = 0;

 // Import schema once outside loop
 const { projectSchema } = await import('../schemas/projectSchema');

 for (const row of data) {
 const name = row.Nom || row.name;
 if (!name) continue;

 const projectData = {
  organizationId,
  name,
  description: row.Description || row.description || '',
  status: row.Statut || row.status || 'Nouveau',
  priority: row.Priorité || row['Priorite'] || row.priority || 'Moyenne',
  manager: { id: userId, label: row.Responsable || row.responsable || userDisplayName },
  progress: 0,
  tasks: [],
  dueDate: row.Echéance || row['Echeance'] || row.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: serverTimestamp(),
  tags: ['Import CSV']
 };

 // VALIDATION: Ensure imported data respects projectSchema
 const validation = projectSchema.safeParse(projectData);
 if (!validation.success) {
  ErrorLogger.warn('Project import validation failed for row', 'ProjectService.importProjectsFromCSV', {
  metadata: { row, issues: validation.error.issues }
  });
  continue; // Skip invalid row
 }

 const newRef = doc(collection(db, 'projects'));
 const sanitized = sanitizeData(projectData);
 batch.set(newRef, sanitized);
 count++;
 batchCount++;

 if (batchCount >= BATCH_SIZE) {
  await batch.commit();
  batch = writeBatch(db);
  batchCount = 0;
 }
 }

 if (batchCount > 0) {
 await batch.commit();
 }

 return count;
 } catch (error) {
 ErrorLogger.error(error, 'ProjectService.importProjectsFromCSV');
 throw error;
 }
 }
}
