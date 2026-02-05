import { useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Vulnerability } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ThreatFeedService } from '../services/ThreatFeedService';
import { logAction } from '../services/logger';
import { useFirestoreCollection } from './useFirestore';
import { hasPermission } from '../utils/permissions';

export const useVulnerabilities = () => {
 const { user, addToast, demoMode, t } = useStore();
 const initialLoadRef = useRef(false);
 const isSubmittingRef = useRef(false);

 // Use useFirestoreCollection for stable subscription
 const constraints = useMemo(() => {
 if (!user?.organizationId) return [];
 return [where('organizationId', '==', user.organizationId)];
 }, [user?.organizationId]);

 const { data: vulnerabilities, loading, error } = useFirestoreCollection<Vulnerability>(
 'vulnerabilities',
 constraints,
 {
 realtime: true,
 enabled: !!user?.organizationId
 }
 );

 useEffect(() => {
 if (error) {
 addToast(t('vulnerabilities.toast.loadError', { defaultValue: 'Erreur lors du chargement des vulnérabilités' }), 'error');
 }
 }, [error, addToast, t]);

 const seedCisaKev = useCallback(async () => {
 if (!user?.organizationId || demoMode) return;
 if (!hasPermission(user, 'Vulnerability', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
 return;
 }
 try {
 const kevVulns = await ThreatFeedService.fetchCisaKev();
 if (kevVulns.length > 0) {
 const batch = writeBatch(db);
 kevVulns.slice(0, 20).forEach(v => {
  const ref = doc(collection(db, 'vulnerabilities'));
  batch.set(ref, sanitizeData({
  ...v,
  organizationId: user.organizationId,
  createdAt: serverTimestamp(),
  severity: 'High',
  status: 'Open',
  assetName: 'External Interest'
  }));
 });
 await batch.commit();
 logAction(user, 'AUTO_SEED', 'Vulnerabilities', `Seeded ${kevVulns.length} vulnerabilities from CISA KEV`);
 addToast(t('vulnerabilities.toast.cisaKevSynced', { defaultValue: "Flux CISA KEV synchronisé" }), "success");
 }
 } catch (error) {
 ErrorLogger.warn((error as Error).message, 'useVulnerabilities.seedCisaKev');
 addToast(t('vulnerabilities.seedFailed', { defaultValue: 'Échec du chargement des données CISA KEV' }), 'error');
 }
 }, [user, addToast, demoMode, t]);

 // Auto-seed CISA KEV
 useEffect(() => {
 if (!loading && vulnerabilities.length === 0 && !initialLoadRef.current && user?.organizationId && !demoMode) {
 initialLoadRef.current = true;
 seedCisaKev();
 }
 }, [loading, vulnerabilities.length, user?.organizationId, seedCisaKev, demoMode]);

 const addVulnerability = async (vuln: Partial<Vulnerability>) => {
 if (!user?.organizationId) return;
 if (demoMode) {
 addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
 return;
 }
 if (!hasPermission(user, 'Vulnerability', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
 return;
 }
 if (isSubmittingRef.current) return;
 isSubmittingRef.current = true;
 try {
 const dataToSave = sanitizeData({
 ...vuln,
 organizationId: user.organizationId,
 createdAt: serverTimestamp()
 });
 await addDoc(collection(db, 'vulnerabilities'), dataToSave);
 logAction(user, 'CREATE', 'Vulnerabilities', `Created Vulnerability ${vuln.cveId}`);
 addToast(t('vulnerabilities.toast.created', { defaultValue: "Vulnérabilité créée" }), "success");
 return true;
 } catch (error) {
 ErrorLogger.error(error as Error, 'useVulnerabilities.add');
 addToast(t('vulnerabilities.toast.createError', { defaultValue: "Erreur lors de la création" }), "error");
 throw error;
 } finally {
 isSubmittingRef.current = false;
 }
 };

 const updateVulnerability = async (id: string, updates: Partial<Vulnerability>) => {
 if (demoMode) {
 addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
 return;
 }

 // SECURITY: Check authorization
 if (!hasPermission(user, 'Vulnerability', 'update')) {
 ErrorLogger.warn('Unauthorized vulnerability update attempt', 'useVulnerabilities.update', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('vulnerabilities.toast.noUpdatePermission', { defaultValue: "Vous n'avez pas les droits pour modifier cette vulnérabilité" }), "error");
 return false;
 }

 // SECURITY: Verify vulnerability belongs to user's organization (IDOR protection)
 const targetVuln = vulnerabilities.find(v => v.id === id);
 if (!targetVuln || targetVuln.organizationId !== user?.organizationId) {
 ErrorLogger.warn('IDOR attempt: vulnerability modification across organizations', 'useVulnerabilities.update', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: targetVuln?.organizationId, callerOrg: user?.organizationId }
 });
 addToast(t('vulnerabilities.toast.notFound', { defaultValue: "Vulnérabilité non trouvée" }), "error");
 return false;
 }

 try {
 const { id: _unused, ...safeUpdates } = updates;
 const dataToSave = sanitizeData({
 ...safeUpdates,
 updatedAt: serverTimestamp()
 });

 await updateDoc(doc(db, 'vulnerabilities', id), dataToSave);

 // Business Logic: If status changed to Resolved/Patch Applied, update ALL related Risks
 if (updates.status && (updates.status === 'Resolved' || updates.status === 'Patch Applied') && user?.organizationId) {
 const riskQuery = query(
  collection(db, 'risks'),
  where('organizationId', '==', user.organizationId),
  where('relatedVulnerabilityId', '==', id)
 );
 const riskSnap = await getDocs(riskQuery);

 if (!riskSnap.empty) {
  const batch = writeBatch(db);
  riskSnap.docs.forEach(riskDoc => {
  batch.update(doc(db, 'risks', riskDoc.id), sanitizeData({
  status: 'Fermé',
  updatedAt: serverTimestamp()
  }));
  });
  await batch.commit();
  const count = riskSnap.docs.length;
  addToast(t('vulnerabilities.toast.relatedRisksResolved', { defaultValue: "{{count}} risque(s) associé(s) fermé(s)", count }), "success");
 }
 }

 logAction(user!, 'UPDATE', 'Vulnerabilities', `Updated Vulnerability ${updates.cveId}`);
 addToast(t('vulnerabilities.toast.updated', { defaultValue: "Vulnérabilité mise à jour" }), "success");
 return true;
 } catch (error) {
 ErrorLogger.error(error as Error, 'useVulnerabilities.update');
 addToast(t('vulnerabilities.toast.updateError', { defaultValue: "Erreur lors de la modification" }), "error");
 throw error;
 }
 };

 const deleteVulnerability = async (id: string) => {
 if (demoMode) {
 addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
 return;
 }

 // SECURITY: Check authorization
 if (!hasPermission(user, 'Vulnerability', 'delete')) {
 ErrorLogger.warn('Unauthorized vulnerability deletion attempt', 'useVulnerabilities.delete', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('vulnerabilities.toast.noDeletePermission', { defaultValue: "Vous n'avez pas les droits pour supprimer cette vulnérabilité" }), "error");
 return false;
 }

 // SECURITY: Verify vulnerability belongs to user's organization (IDOR protection)
 const targetVuln = vulnerabilities.find(v => v.id === id);
 if (!targetVuln || targetVuln.organizationId !== user?.organizationId) {
 ErrorLogger.warn('IDOR attempt: vulnerability deletion across organizations', 'useVulnerabilities.delete', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: targetVuln?.organizationId, callerOrg: user?.organizationId }
 });
 addToast(t('vulnerabilities.toast.notFound', { defaultValue: "Vulnérabilité non trouvée" }), "error");
 return false;
 }

 try {
 await deleteDoc(doc(db, 'vulnerabilities', id));

 // Cascade: clean up risk references pointing to this vulnerability (scoped to org)
 const riskQuery = query(
 collection(db, 'risks'),
 where('organizationId', '==', user!.organizationId),
 where('relatedVulnerabilityId', '==', id)
 );
 const riskSnap = await getDocs(riskQuery);
 if (!riskSnap.empty) {
 const batch = writeBatch(db);
 riskSnap.docs.forEach(riskDoc => {
  batch.update(doc(db, 'risks', riskDoc.id), sanitizeData({
  relatedVulnerabilityId: null,
  updatedAt: serverTimestamp()
  }));
 });
 await batch.commit();
 }

 logAction(user!, 'DELETE', 'Vulnerabilities', `Deleted Vulnerability ID: ${id}`);
 addToast(t('vulnerabilities.toast.deleted', { defaultValue: "Supprimé avec succès" }), "success");
 return true;
 } catch (error) {
 ErrorLogger.error(error as Error, 'useVulnerabilities.delete');
 addToast(t('vulnerabilities.toast.deleteError', { defaultValue: "Erreur lors de la suppression" }), "error");
 throw error;
 }
 };

 const createRiskFromVuln = async (vuln: Vulnerability) => {
 if (!user?.organizationId || !vuln.id) return;
 if (demoMode) {
 addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
 return;
 }
 if (!hasPermission(user, 'Vulnerability', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
 return;
 }
 if (!hasPermission(user, 'Risk', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
 return;
 }
 try {
 const riskData = {
 organizationId: user.organizationId,
 assetId: vuln.assetId || '',
 threat: `Exploitation de ${vuln.cveId}`,
 vulnerability: vuln.description || vuln.title,
 probability: 3,
 impact: vuln.severity === 'Critical' ? 5 : vuln.severity === 'High' ? 4 : 3,
 score: (vuln.severity === 'Critical' ? 5 : 3) * 3,
 status: 'Ouvert',
 strategy: 'Atténuer',
 owner: user.email,
 ownerId: user.uid,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 framework: 'ISO27005',
 relatedVulnerabilityId: vuln.id
 };

 const riskRef = await addDoc(collection(db, 'risks'), sanitizeData(riskData));

 // Bidirectional linking
 await updateDoc(doc(db, 'vulnerabilities', vuln.id), sanitizeData({
 relatedRiskId: riskRef.id,
 status: 'In Progress'
 }));

 logAction(user, 'CREATE_RISK', 'Vulnerabilities', `Created Risk for Vuln ${vuln.cveId}`);
 addToast(t('vulnerabilities.toast.riskCreatedAndLinked', { defaultValue: "Risque créé et lié avec succès" }), "success");
 return true;
 } catch (error) {
 ErrorLogger.error(error as Error, 'useVulnerabilities.createRisk');
 addToast(t('vulnerabilities.toast.riskCreateError', { defaultValue: "Erreur création risque" }), "error");
 throw error;
 }
 };

 const importVulnerabilities = async (vulns: Partial<Vulnerability>[]) => {
 if (!user?.organizationId) return;
 if (demoMode) {
 addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
 return;
 }
 if (!hasPermission(user, 'Vulnerability', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
 return;
 }
 try {
 // Firestore batches support max 500 operations; chunk if needed
 const chunks = [];
 for (let i = 0; i < vulns.length; i += 500) {
 chunks.push(vulns.slice(i, i + 500));
 }
 for (const chunk of chunks) {
 const batch = writeBatch(db);
 chunk.forEach(v => {
  const ref = doc(collection(db, 'vulnerabilities'));
  batch.set(ref, {
  ...sanitizeData(v),
  organizationId: user.organizationId,
  createdAt: serverTimestamp(),
  status: 'Open'
  });
 });
 await batch.commit();
 }
 logAction(user, 'IMPORT', 'Vulnerabilities', `Imported ${vulns.length} vulnerabilities from scanner`);
 addToast(t('vulnerabilities.toast.imported', { defaultValue: "{{count}} vulnérabilités importées", count: vulns.length }), "success");
 return true;
 } catch (error) {
 ErrorLogger.error(error as Error, 'useVulnerabilities.import');
 addToast(t('vulnerabilities.toast.importError', { defaultValue: "Erreur lors de l'import" }), "error");
 throw error;
 }
 };

 return {
 vulnerabilities,
 loading,
 addVulnerability,
 updateVulnerability,
 deleteVulnerability,
 createRiskFromVuln,
 importVulnerabilities
 };
};
