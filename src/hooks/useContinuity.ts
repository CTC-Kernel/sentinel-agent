import { useCallback, useRef, useState } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, writeBatch, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { logAction } from '../services/logger';
import { BcpDrill } from '../types';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ImportService } from '../services/ImportService';
import { sanitizeData } from '../utils/dataSanitizer';
import { hasPermission } from '../utils/permissions';

export const useContinuity = () => {
 const { user, addToast, t } = useStore();
 const [loading, setLoading] = useState(false);
 const isSubmittingRef = useRef(false);

 const addProcess = useCallback(async (data: BusinessProcessFormData) => {
 if (!user?.organizationId) return;
 if (isSubmittingRef.current) return;
 isSubmittingRef.current = true;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'BusinessProcess', 'create')) {
 ErrorLogger.warn('Unauthorized business process creation attempt', 'useContinuity.addProcess', {
 metadata: { attemptedBy: user?.uid }
 });
 addToast(t('continuity.toast.noCreateProcessPermission', { defaultValue: "Vous n'avez pas les droits pour créer un processus" }), 'error');
 return;
 }

 setLoading(true);
 try {
 const newProcess = {
 ...data,
 organizationId: user.organizationId,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 status: 'Draft',
 lastTestDate: null
 };

 const docRef = await addDoc(collection(db, 'business_processes'), sanitizeData(newProcess));
 await logAction(user, 'CREATE', 'BusinessProcess', `Created process: ${data.name}`);
 addToast(t('continuity.toastCreated'), 'success');
 return { id: docRef.id, ...newProcess };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.addProcess', 'CREATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 isSubmittingRef.current = false;
 }
 }, [user, addToast, t]);

 const updateProcess = useCallback(async (id: string, data: Partial<BusinessProcessFormData>, processOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'BusinessProcess', 'update')) {
 ErrorLogger.warn('Unauthorized business process update attempt', 'useContinuity.updateProcess', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noUpdateProcessPermission', { defaultValue: "Vous n'avez pas les droits pour modifier ce processus" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (processOrganizationId && processOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: business process update across organizations', 'useContinuity.updateProcess', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: processOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.processNotFound', { defaultValue: 'Processus non trouvé' }), 'error');
 return;
 }

 setLoading(true);
 try {
 await updateDoc(doc(db, 'business_processes', id), sanitizeData({
 ...data,
 updatedAt: serverTimestamp()
 }));
 await logAction(user, 'UPDATE', 'BusinessProcess', `Updated process: ${data.name || id}`);
 addToast(t('continuity.toastUpdated'), 'success');
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.updateProcess', 'UPDATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const deleteProcess = useCallback(async (id: string, processOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'BusinessProcess', 'delete')) {
 ErrorLogger.warn('Unauthorized business process deletion attempt', 'useContinuity.deleteProcess', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noDeleteProcessPermission', { defaultValue: "Vous n'avez pas les droits pour supprimer ce processus" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (processOrganizationId && processOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: business process deletion across organizations', 'useContinuity.deleteProcess', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: processOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.processNotFound', { defaultValue: 'Processus non trouvé' }), 'error');
 return;
 }

 setLoading(true);
 try {
 // Cascade delete: clean up related drills
 const drillsQuery = query(
 collection(db, 'bcp_drills'),
 where('processId', '==', id),
 where('organizationId', '==', user.organizationId)
 );
 const drillsSnap = await getDocs(drillsQuery);
 if (!drillsSnap.empty) {
 const BATCH_LIMIT = 450;
 let batch = writeBatch(db);
 let batchCount = 0;
 for (const drillDoc of drillsSnap.docs) {
  batch.delete(drillDoc.ref);
  batchCount++;
  if (batchCount >= BATCH_LIMIT) {
   await batch.commit();
   batch = writeBatch(db);
   batchCount = 0;
  }
 }
 if (batchCount > 0) {
  await batch.commit();
 }
 }

 await deleteDoc(doc(db, 'business_processes', id));
 await logAction(user, 'DELETE', 'BusinessProcess', `Deleted process: ${id}`);
 addToast(t('continuity.toastDeleted'), 'success');
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.deleteProcess', 'DELETE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const addDrill = useCallback(async (data: Partial<BcpDrill>) => {
 if (!user?.organizationId) return;
 if (isSubmittingRef.current) return;
 isSubmittingRef.current = true;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'BcpDrill', 'create')) {
 ErrorLogger.warn('Unauthorized drill creation attempt', 'useContinuity.addDrill', {
 metadata: { attemptedBy: user?.uid }
 });
 addToast(t('continuity.toast.noCreateDrillPermission', { defaultValue: "Vous n'avez pas les droits pour créer un exercice" }), 'error');
 return;
 }

 setLoading(true);
 try {
 const batch = writeBatch(db);

 // 1. Create Drill
 const drillRef = doc(collection(db, 'bcp_drills'));
 const newDrill = {
 ...data,
 organizationId: user.organizationId,
 createdAt: serverTimestamp()
 };
 batch.set(drillRef, sanitizeData(newDrill));

 // 2. Update Process lastTestDate if applicable
 if (data.processId) {
 const processRef = doc(db, 'business_processes', data.processId);
 batch.update(processRef, {
  lastTestDate: data.date,
  updatedAt: serverTimestamp()
 });
 }

 await batch.commit();
 await logAction(user, 'CREATE', 'BcpDrill', `Logged drill for process: ${data.processId || 'General'}`);
 addToast(t('continuity.toastDrill'), 'success');
 return { id: drillRef.id, ...newDrill };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.addDrill', 'CREATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 isSubmittingRef.current = false;
 }
 }, [user, addToast, t]);

 const updateDrill = useCallback(async (id: string, data: Partial<BcpDrill>, drillOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'BcpDrill', 'update')) {
 ErrorLogger.warn('Unauthorized drill update attempt', 'useContinuity.updateDrill', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noUpdateDrillPermission', { defaultValue: "Vous n'avez pas les droits pour modifier cet exercice" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (drillOrganizationId && drillOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: drill update across organizations', 'useContinuity.updateDrill', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: drillOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.drillNotFound', { defaultValue: 'Exercice non trouvé' }), 'error');
 return;
 }

 setLoading(true);
 try {
 await updateDoc(doc(db, 'bcp_drills', id), sanitizeData({
 ...data,
 updatedAt: serverTimestamp()
 }));
 addToast(t('continuity.toastDrillUpdated'), 'success');
 } catch (e) {
 ErrorLogger.handleErrorWithToast(e, 'useContinuity.updateDrill', 'UPDATE_FAILED');
 throw e;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const deleteDrill = useCallback(async (id: string, drillOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'BcpDrill', 'delete')) {
 ErrorLogger.warn('Unauthorized drill deletion attempt', 'useContinuity.deleteDrill', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noDeleteDrillPermission', { defaultValue: "Vous n'avez pas les droits pour supprimer cet exercice" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (drillOrganizationId && drillOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: drill deletion across organizations', 'useContinuity.deleteDrill', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: drillOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.drillNotFound', { defaultValue: 'Exercice non trouvé' }), 'error');
 return;
 }

 setLoading(true);
 try {
 await deleteDoc(doc(db, 'bcp_drills', id));
 addToast(t('continuity.toastDrillDeleted'), 'success');
 } catch (e) {
 ErrorLogger.handleErrorWithToast(e, 'useContinuity.deleteDrill', 'DELETE_FAILED');
 throw e;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const importProcesses = useCallback(async (csvContent: string) => {
 if (!user?.organizationId) return;
 setLoading(true);
 try {
 const lines = ImportService.parseCSV(csvContent);
 if (lines.length === 0) {
 addToast(t('common.toast.emptyOrInvalidFile', { defaultValue: "Fichier vide ou invalide" }), "error");
 setLoading(false);
 return;
 }

 const BATCH_SIZE = 450;
 let batch = writeBatch(db);
 let count = 0;
 let batchCount = 0;

 for (const row of lines) {
 if (!row.Nom) continue;

 const newRef = doc(collection(db, 'business_processes'));
 const processData = {
  organizationId: user.organizationId,
  name: row.Nom,
  description: row.Description || '',
  owner: row.Responsable || user.displayName || '',
  priority: row.Priorite || 'Medium',
  rto: row.RTO || '4h',
  rpo: row.RPO || '1h',
  status: 'Draft',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastTestDate: null
 };

 batch.set(newRef, sanitizeData(processData));
 count++;
 batchCount++;

 if (batchCount >= BATCH_SIZE) {
  await batch.commit();
  batch = writeBatch(db);
  batchCount = 0;
 }
 }

 if (count > 0 && batchCount > 0) {
 await batch.commit();
 await logAction(user, 'IMPORT', 'BusinessProcess', `Imported ${count} processes`);
 addToast(t('continuity.toastImported', { count }), 'success');
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.importProcesses');
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const addTlptCampaign = useCallback(async (data: Partial<import('../types/tlpt').TlptCampaign>) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'TlptCampaign', 'create')) {
 ErrorLogger.warn('Unauthorized TLPT campaign creation attempt', 'useContinuity.addTlptCampaign', {
 metadata: { attemptedBy: user?.uid }
 });
 addToast(t('continuity.toast.noCreateTlptPermission', { defaultValue: "Vous n'avez pas les droits pour créer une campagne TLPT" }), 'error');
 return;
 }

 setLoading(true);
 try {
 const newCampaign = {
 ...data,
 organizationId: user.organizationId,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 status: data.status || 'Planned'
 };
 const docRef = await addDoc(collection(db, 'tlpt_campaigns'), sanitizeData(newCampaign));
 await logAction(user, 'CREATE', 'TlptCampaign', `Created TLPT Campaign: ${data.name}`);
 addToast(t('continuity.toast.tlptCreated', { defaultValue: "Campagne TLPT créée" }), 'success');
 return { id: docRef.id, ...newCampaign };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.addTlptCampaign', 'CREATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const updateTlptCampaign = useCallback(async (id: string, data: Partial<import('../types/tlpt').TlptCampaign>, campaignOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'TlptCampaign', 'update')) {
 ErrorLogger.warn('Unauthorized TLPT campaign update attempt', 'useContinuity.updateTlptCampaign', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noUpdateTlptPermission', { defaultValue: "Vous n'avez pas les droits pour modifier cette campagne" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (campaignOrganizationId && campaignOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: TLPT campaign update across organizations', 'useContinuity.updateTlptCampaign', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: campaignOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.campaignNotFound', { defaultValue: 'Campagne non trouvée' }), 'error');
 return;
 }

 setLoading(true);
 try {
 await updateDoc(doc(db, 'tlpt_campaigns', id), sanitizeData({
 ...data,
 updatedAt: serverTimestamp()
 }));
 addToast(t('continuity.toast.tlptUpdated', { defaultValue: "Campagne mise à jour" }), 'success');
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.updateTlptCampaign', 'UPDATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const deleteTlptCampaign = useCallback(async (id: string, campaignOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'TlptCampaign', 'delete')) {
 ErrorLogger.warn('Unauthorized TLPT campaign deletion attempt', 'useContinuity.deleteTlptCampaign', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noDeleteTlptPermission', { defaultValue: "Vous n'avez pas les droits pour supprimer cette campagne" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (campaignOrganizationId && campaignOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: TLPT campaign deletion across organizations', 'useContinuity.deleteTlptCampaign', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: campaignOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.campaignNotFound', { defaultValue: 'Campagne non trouvée' }), 'error');
 return;
 }

 setLoading(true);
 try {
 await deleteDoc(doc(db, 'tlpt_campaigns', id));
 await logAction(user, 'DELETE', 'TlptCampaign', `Deleted TLPT Campaign: ${id}`);
 addToast(t('continuity.toast.tlptDeleted', { defaultValue: "Campagne supprimée" }), 'success');
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.deleteTlptCampaign', 'DELETE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const addRecoveryPlan = useCallback(async (data: import('../schemas/continuitySchema').RecoveryPlanFormData) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'RecoveryPlan', 'create')) {
 ErrorLogger.warn('Unauthorized recovery plan creation attempt', 'useContinuity.addRecoveryPlan', {
 metadata: { attemptedBy: user?.uid }
 });
 addToast(t('continuity.toast.noCreateRecoveryPermission', { defaultValue: "Vous n'avez pas les droits pour créer un plan de reprise" }), 'error');
 return;
 }

 setLoading(true);
 try {
 const newPlan = {
 ...data,
 organizationId: user.organizationId,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 status: data.status || 'Draft',
 lastTestedAt: null
 };

 const docRef = await addDoc(collection(db, 'recovery_plans'), sanitizeData(newPlan));
 await logAction(user, 'CREATE', 'RecoveryPlan', `Created PRA: ${data.title}`);
 addToast(t('continuity.toast.recoveryCreated', { defaultValue: "Plan de reprise créé" }), 'success');
 return { id: docRef.id, ...newPlan };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.addRecoveryPlan', 'CREATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const updateRecoveryPlan = useCallback(async (id: string, data: Partial<import('../schemas/continuitySchema').RecoveryPlanFormData>, planOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'RecoveryPlan', 'update')) {
 ErrorLogger.warn('Unauthorized recovery plan update attempt', 'useContinuity.updateRecoveryPlan', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noUpdateRecoveryPermission', { defaultValue: "Vous n'avez pas les droits pour modifier ce plan" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (planOrganizationId && planOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: recovery plan update across organizations', 'useContinuity.updateRecoveryPlan', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: planOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.planNotFound', { defaultValue: 'Plan non trouvé' }), 'error');
 return;
 }

 setLoading(true);
 try {
 await updateDoc(doc(db, 'recovery_plans', id), sanitizeData({
 ...data,
 updatedAt: serverTimestamp()
 }));
 await logAction(user, 'UPDATE', 'RecoveryPlan', `Updated PRA: ${data.title || id}`);
 addToast(t('continuity.toast.recoveryUpdated', { defaultValue: "Plan de reprise mis à jour" }), 'success');
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.updateRecoveryPlan', 'UPDATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const deleteRecoveryPlan = useCallback(async (id: string, planOrganizationId?: string) => {
 if (!user?.organizationId) return;

 // SECURITY: Authorization check
 if (!hasPermission(user, 'RecoveryPlan', 'delete')) {
 ErrorLogger.warn('Unauthorized recovery plan deletion attempt', 'useContinuity.deleteRecoveryPlan', {
 metadata: { attemptedBy: user?.uid, targetId: id }
 });
 addToast(t('continuity.toast.noDeleteRecoveryPermission', { defaultValue: "Vous n'avez pas les droits pour supprimer ce plan" }), 'error');
 return;
 }

 // SECURITY: IDOR protection
 if (planOrganizationId && planOrganizationId !== user.organizationId) {
 ErrorLogger.warn('IDOR attempt: recovery plan deletion across organizations', 'useContinuity.deleteRecoveryPlan', {
 metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: planOrganizationId, callerOrg: user.organizationId }
 });
 addToast(t('continuity.toast.planNotFound', { defaultValue: 'Plan non trouvé' }), 'error');
 return;
 }

 setLoading(true);
 try {
 // Cascade: clean up business_processes that reference this recovery plan via drpDocumentId
 const processesQuery = query(
 collection(db, 'business_processes'),
 where('organizationId', '==', user.organizationId),
 where('drpDocumentId', '==', id)
 );
 const processesSnap = await getDocs(processesQuery);
 if (!processesSnap.empty) {
 const BATCH_LIMIT = 450;
 let batch = writeBatch(db);
 let batchCount = 0;
 for (const processDoc of processesSnap.docs) {
  batch.update(processDoc.ref, { drpDocumentId: null, updatedAt: serverTimestamp() });
  batchCount++;
  if (batchCount >= BATCH_LIMIT) {
   await batch.commit();
   batch = writeBatch(db);
   batchCount = 0;
  }
 }
 if (batchCount > 0) {
  await batch.commit();
 }
 }

 await deleteDoc(doc(db, 'recovery_plans', id));
 await logAction(user, 'DELETE', 'RecoveryPlan', `Deleted PRA: ${id}`);
 addToast(t('continuity.toast.recoveryDeleted', { defaultValue: "Plan de reprise supprimé" }), 'success');
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useContinuity.deleteRecoveryPlan', 'DELETE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 return {
 addProcess,
 updateProcess,
 deleteProcess,
 addDrill,
 updateDrill,
 deleteDrill,
 importProcesses,
 addTlptCampaign,
 updateTlptCampaign,
 deleteTlptCampaign,
 addRecoveryPlan,
 updateRecoveryPlan,
 deleteRecoveryPlan,
 loading
 };
};
