import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export interface Dependency {
 id: string;
 name: string;
 type: 'Contrôle' | 'Projet' | 'Audit' | 'Risque';
 collectionName: 'controls' | 'projects' | 'audits' | 'risks';
}

export interface DependencyCheckResult {
 hasDependencies: boolean;
 dependencies: Dependency[];
 canDelete: boolean;
 blockingReasons: string[];
}

export class DependencyService {
 /**
 * Checks for dependencies linked to a Risk.
 * @param riskId The ID of the risk to check
 * @param organizationId The organization ID (for security scoping)
 */
 static async checkRiskDependencies(riskId: string, organizationId: string): Promise<DependencyCheckResult> {
 if (!riskId || !organizationId) {
 return { hasDependencies: false, dependencies: [], canDelete: true, blockingReasons: [] };
 }

 try {
 const [controlsSnap, projectsSnap, auditsSnap] = await Promise.all([
 getDocs(query(collection(db, 'controls'), where('organizationId', '==', organizationId), where('relatedRiskIds', 'array-contains', riskId), limit(100))),
 getDocs(query(collection(db, 'projects'), where('organizationId', '==', organizationId), where('relatedRiskIds', 'array-contains', riskId), limit(100))),
 getDocs(query(collection(db, 'audits'), where('organizationId', '==', organizationId), where('relatedRiskIds', 'array-contains', riskId), limit(100)))
 ]);

 const dependencies: Dependency[] = [
 ...controlsSnap.docs.map(d => {
  const data = d.data();
  return {
  id: d.id,
  name: data.code || data.name || 'Contrôle sans nom',
  type: 'Contrôle',
  collectionName: 'controls'
  } as Dependency;
 }),
 ...projectsSnap.docs.map(d => {
  const data = d.data();
  return {
  id: d.id,
  name: data.name || 'Projet sans nom',
  type: 'Projet',
  collectionName: 'projects'
  } as Dependency;
 }),
 ...auditsSnap.docs.map(d => {
  const data = d.data();
  return {
  id: d.id,
  name: data.name || 'Audit sans nom',
  type: 'Audit',
  collectionName: 'audits'
  } as Dependency;
 })
 ];

 // Define blocking rules (e.g., if a risk is linked to active audits, maybe we shouldn't delete?)
 // For now, we will flag them but allow deletion if handling cleanup, but strict mode might block.
 // The request says "corruption de données" implies we must handle them.
 // Safe approach: Block if linked to closed audits (history), or handle cleanup gracefully.
 // The requirement specifically mentioned: "L'application permet la suppression... sans vérification".
 // We will return information so the UI can decide (or the hook).

 return {
 hasDependencies: dependencies.length > 0,
 dependencies,
 canDelete: dependencies.length === 0, // STRICT BLOCK: Cannot delete if risk has dependencies
 blockingReasons: dependencies.length > 0 ? [`Ce risque est lié à ${dependencies.length} élément(s). Veuillez supprimer ou détacher ces liens avant la suppression.`] : []
 };

 } catch (error) {
 ErrorLogger.error(error, 'DependencyService.checkRiskDependencies');
 // Fail safe: assume dependencies exist if error to prevent accidental deletion
 return {
 hasDependencies: true,
 dependencies: [],
 canDelete: false,
 blockingReasons: ['Erreur lors de la vérification des dépendances.']
 };
 }
 }

 /**
 * Checks for dependencies linked to an Asset.
 */
 static async checkAssetDependencies(assetId: string, organizationId: string): Promise<DependencyCheckResult> {
 if (!assetId || !organizationId) {
 return { hasDependencies: false, dependencies: [], canDelete: true, blockingReasons: [] };
 }

 try {
 // Check Risks linked to this asset
 const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('assetId', '==', assetId), limit(100)));

 const dependencies: Dependency[] = risksSnap.docs.map(d => ({
 id: d.id,
 name: d.data().threat || 'Risque sans nom',
 type: 'Risque',
 collectionName: 'risks'
 } as Dependency));

 return {
 hasDependencies: dependencies.length > 0,
 dependencies,
 canDelete: dependencies.length === 0, // STRICT BLOCK
 blockingReasons: dependencies.length > 0 ? [`Cet actif est lié à ${dependencies.length} risque(s). Veuillez d'abord supprimer ces risques.`] : []
 };
 } catch (error) {
 ErrorLogger.error(error, 'DependencyService.checkAssetDependencies');
 return { hasDependencies: true, dependencies: [], canDelete: false, blockingReasons: ['Erreur lors de la vérification.'] };
 }
 }

 /**
 * Checks for dependencies linked to a Control.
 */
 static async checkControlDependencies(controlId: string, organizationId: string): Promise<DependencyCheckResult> {
 if (!controlId || !organizationId) {
 return { hasDependencies: false, dependencies: [], canDelete: true, blockingReasons: [] };
 }

 try {
 const [risksSnap, auditsSnap] = await Promise.all([
 getDocs(query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('mitigationControlIds', 'array-contains', controlId), limit(100))),
 getDocs(query(collection(db, 'audits'), where('organizationId', '==', organizationId), where('relatedControlIds', 'array-contains', controlId), limit(100)))
 ]);

 const dependencies: Dependency[] = [
 ...risksSnap.docs.map(d => ({
  id: d.id,
  name: d.data().threat || 'Risque sans nom',
  type: 'Risque',
  collectionName: 'risks'
 } as Dependency)),
 ...auditsSnap.docs.map(d => ({
  id: d.id,
  name: d.data().name || 'Audit sans nom',
  type: 'Audit',
  collectionName: 'audits'
 } as Dependency))
 ];

 return {
 hasDependencies: dependencies.length > 0,
 dependencies,
 canDelete: dependencies.length === 0, // STRICT BLOCK
 blockingReasons: dependencies.length > 0 ? [`Ce contrôle est lié à ${dependencies.length} élément(s).`] : []
 };
 } catch (error) {
 ErrorLogger.error(error, 'DependencyService.checkControlDependencies');
 return { hasDependencies: true, dependencies: [], canDelete: false, blockingReasons: ['Erreur lors de la vérification.'] };
 }
 }
}
