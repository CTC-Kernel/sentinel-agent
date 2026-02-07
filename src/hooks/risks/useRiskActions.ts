import { useState } from 'react';
import { useStore } from '../../store';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';
import { ImportService } from '../../services/ImportService';
import { NotificationService } from '../../services/notificationService';
import { DependencyService } from '../../services/dependencyService';
import { riskSchema } from '../../schemas/riskSchema';
import { FunctionsService } from '../../services/FunctionsService';
import { sanitizeData } from '../../utils/dataSanitizer';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { UserProfile } from '../../types';
import { createRiskDraftSchema, RISK_DRAFT_STATUS, RISK_PUBLISHED_STATUS } from '../../utils/riskDraftSchema';
import { RiskService } from '../../services/RiskService';
import { AuditLogService, CreateAuditLogInput } from '../../services/auditLogService';
import { useLocale } from '../useLocale';
import { isValidRiskTransition, RiskStatus } from '../../types/risks';

export const useRiskActions = (onRefresh: () => void) => {
 const { t } = useStore();
 const { locale } = useLocale();
 const { user } = useAuth();
 const [submitting, setSubmitting] = useState(false);
 const [isGeneratingReport, setIsGeneratingReport] = useState(false);
 const [isExportingCSV, setIsExportingCSV] = useState(false);
 const [isImporting, setIsImporting] = useState(false);

 const validateRiskLogic = (data: Partial<Risk>): { valid: boolean; error?: string } => {
 // 1. Check Residual vs Inherent Risk
 // If we have full scoring data, ensure residual is not worse than inherent
 if (
 data.probability && data.impact &&
 data.residualProbability && data.residualImpact
 ) {
 const inherentScore = data.probability * data.impact;
 const residualScore = data.residualProbability * data.residualImpact;

 if (residualScore > inherentScore) {
 return {
  valid: false,
  error: t('risks.validation_residual_error') || "Le risque résiduel ne peut pas être supérieur au risque inhérent sans justification."
 };
 }
 }
 return { valid: true };
 };

 const createRisk = async (data: Partial<Risk>) => {
 if (!user) return false;
 if (!canEditResource(user as UserProfile, 'Risk')) {
 toast.error(t('common.accessDenied'));
 return false;
 }

 setSubmitting(true);
 try {
 const result = await RiskService.createRisk(user as UserProfile, data);

 if (result.success) {
 toast.success(t('common.riskCreated'));
 onRefresh();
 return result.id || true;
 } else {
 toast.error(result.error || t('common.error'));
 return false;
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.createRisk', 'CREATE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 const bulkCreateRisks = async (risksData: Partial<Risk>[]) => {
 if (!user?.organizationId) return false;
 if (!canEditResource(user as UserProfile, 'Risk')) {
 toast.error(t('common.accessDenied'));
 return false;
 }

 setSubmitting(true);
 const batch = writeBatch(db);
 const risksCollection = collection(db, 'risks');
 const auditEntries: CreateAuditLogInput[] = [];

 try {
 // Validate all risks first
 for (const riskItem of risksData) {
 const logicCheck = validateRiskLogic(riskItem);
 if (!logicCheck.valid) {
  toast.error(t('risks.batchValidationError', { name: riskItem.threat, error: logicCheck.error }));
  setSubmitting(false);
  return false;
 }
 }

 risksData.forEach(riskItem => {
 const newDocRef = doc(risksCollection);
 const sanitized = sanitizeData({
  ...riskItem,
  organizationId: user.organizationId,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  owner: user.uid,
  history: [{
  date: new Date().toISOString(),
  user: user.displayName || user.email,
  action: 'Création initiale (Batch)',
  changes: 'Créé via modèle ou import groupé',
  previousScore: 0,
  newScore: (riskItem.probability || 0) * (riskItem.impact || 0),
  changedBy: user.uid
  }]
 });
 batch.set(newDocRef, sanitized);

 // Prepare audit entry
 auditEntries.push({
  organizationId: user.organizationId!,
  userId: user.uid,
  userName: user.displayName || user.email || 'Unknown',
  userEmail: user.email || '',
  action: 'create',
  entityType: 'risk',
  entityId: newDocRef.id,
  entityName: riskItem.threat,
  after: sanitized,
  details: 'Création groupée'
 });
 });

 await batch.commit();

 // Async batch logging
 AuditLogService.logBatch(auditEntries).catch(err =>
 ErrorLogger.warn('Failed to log batch risk creation', 'useRiskActions.bulkCreateRisks', { error: err })
 );

 toast.success(t('risks.templateSuccess', { count: risksData.length }));
 onRefresh();
 return true;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.bulkCreateRisks', 'CREATE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 /**
 * Save a risk as draft with relaxed validation (only threat required).
 * Sets status to 'Brouillon' automatically.
 */
 const saveRiskAsDraft = async (data: Partial<Risk>) => {
 if (!user?.organizationId) return false;
 if (!canEditResource(user as UserProfile, 'Risk')) {
 toast.error(t('common.accessDenied'));
 return false;
 }

 setSubmitting(true);
 try {
 // Validation with draft schema (only threat required)
 const draftSchema = createRiskDraftSchema(locale);
 const validationResult = draftSchema.safeParse(data);
 if (!validationResult.success) {
 const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
 toast.error(errorMessage);
 ErrorLogger.warn('Risk draft validation failed', 'useRiskActions.saveRiskAsDraft', {
  metadata: { issues: validationResult.error.issues }
 });
 return false;
 }

 const riskData = sanitizeData({
 ...data,
 organizationId: user.organizationId,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 status: RISK_DRAFT_STATUS, // Always 'Brouillon' for drafts
 owner: user.uid,
 history: [{
  date: new Date().toISOString(),
  user: user.displayName || user.email,
  action: 'Création du brouillon',
  changes: 'Initialisation (brouillon)',
  previousScore: 0,
  newScore: 0,
  changedBy: user.uid
 }]
 });

 const docRef = await addDoc(collection(db, 'risks'), riskData);
 if (user && user.organizationId) {
 await AuditLogService.logCreate(
  user.organizationId,
  { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
  'risk',
  docRef.id,
  riskData,
  'Brouillon de risque'
 );
 }
 toast.success(t('common.draftSaved') || 'Brouillon enregistré');
 onRefresh();
 return docRef.id;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.saveRiskAsDraft', 'CREATE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 /**
 * Update an existing draft risk.
 */
 const updateRiskDraft = async (id: string, data: Partial<Risk>, riskOrganizationId?: string) => {
 if (!canEditResource(user as UserProfile, 'Risk')) return false;

 // SECURITY: IDOR protection - verify risk belongs to user's organization
 if (riskOrganizationId && riskOrganizationId !== user?.organizationId) {
 ErrorLogger.warn('IDOR attempt: risk draft update across organizations', 'useRiskActions.updateRiskDraft', {
 metadata: { attemptedBy: user?.uid, targetRisk: id, targetOrg: riskOrganizationId, callerOrg: user?.organizationId }
 });
 toast.error(t('risks.notFound') || 'Risque non trouvé');
 return false;
 }

 setSubmitting(true);
 try {
 // Validation with draft schema
 const draftSchema = createRiskDraftSchema(locale);
 const validationResult = draftSchema.safeParse(data);
 if (!validationResult.success) {
 const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
 toast.error(errorMessage);
 return false;
 }

 const riskRef = doc(db, 'risks', id);
 await updateDoc(riskRef, sanitizeData({
 ...data,
 status: RISK_DRAFT_STATUS,
 updatedAt: serverTimestamp()
 }));

 if (user && user.organizationId) {
 await AuditLogService.logUpdate(
  user.organizationId,
  { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
  'risk',
  id,
  { status: 'Brouillon_old' }, // Pseudo-state
  data as Record<string, unknown>,
  data.threat
 );
 }

 toast.success(t('common.draftSaved') || 'Brouillon enregistré');
 onRefresh();
 return true;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.updateRiskDraft', 'UPDATE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 /**
 * Publish a draft risk - converts from 'Brouillon' to 'Ouvert'.
 * Requires full validation to succeed.
 */
 const publishDraft = async (id: string, data: Partial<Risk>, currentRisk?: Risk) => {
 if (!canEditResource(user as UserProfile, 'Risk')) return false;

 // SECURITY: IDOR protection - verify risk belongs to user's organization
 if (currentRisk?.organizationId && currentRisk.organizationId !== user?.organizationId) {
 ErrorLogger.warn('IDOR attempt: risk publish across organizations', 'useRiskActions.publishDraft', {
 metadata: { attemptedBy: user?.uid, targetRisk: id, targetOrg: currentRisk.organizationId, callerOrg: user?.organizationId }
 });
 toast.error(t('risks.notFound') || 'Risque non trouvé');
 return false;
 }

 setSubmitting(true);
 try {
 // Business Logic Validation
 const logicCheck = validateRiskLogic({ ...currentRisk, ...data });
 if (!logicCheck.valid) {
 toast.error(logicCheck.error || t('common.invalidData'));
 return false;
 }

 // Full validation required for publishing
 const validationResult = riskSchema.safeParse(data);
 if (!validationResult.success) {
 const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
 toast.error(errorMessage);
 ErrorLogger.warn('Risk publish validation failed', 'useRiskActions.publishDraft', {
  metadata: { issues: validationResult.error.issues }
 });
 return false;
 }

 const riskRef = doc(db, 'risks', id);
 await updateDoc(riskRef, sanitizeData({
 ...data,
 status: RISK_PUBLISHED_STATUS, // 'Ouvert'
 updatedAt: serverTimestamp()
 }));

 if (user && user.organizationId) {
 await AuditLogService.logStatusChange(
  user.organizationId,
  { id: user.uid, name: user.displayName || user.email || '', email: user.email || '' },
  'risk',
  id,
  currentRisk?.threat || 'Risk',
  RISK_DRAFT_STATUS,
  RISK_PUBLISHED_STATUS
 );
 }

 toast.success(t('common.published') || 'Risque publié');
 onRefresh();

 // Notify owner if different from publisher
 if (data.ownerId && data.ownerId !== user?.uid) {
 await NotificationService.notifyRiskAssigned(data as unknown as Risk, data.ownerId, user?.displayName || user?.email || 'Admin');
 }
 return true;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.publishDraft', 'UPDATE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 const updateRisk = async (id: string, data: Partial<Risk>, currentRisk?: Risk) => {
 if (!user) return false;
 if (!canEditResource(user as UserProfile, 'Risk')) {
 toast.error(t('common.accessDenied'));
 return false;
 }
 setSubmitting(true);
 try {
 // Validate risk status transition if status is changing
 if (data.status && currentRisk?.status && data.status !== currentRisk.status) {
 if (!isValidRiskTransition(currentRisk.status as RiskStatus, data.status as RiskStatus)) {
  toast.error(`Transition de statut invalide : ${currentRisk.status} vers ${data.status}`);
  setSubmitting(false);
  return false;
 }
 }

 const result = await RiskService.updateRisk(user as UserProfile, id, data, currentRisk);

 if (result.success) {
 toast.success(t('common.riskUpdated'));
 onRefresh();
 return true;
 } else {
 toast.error(result.error || t('common.error'));
 return false;
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.updateRisk', 'UPDATE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 const checkDependencies = async (riskId: string) => {
 if (!user?.organizationId) return { hasDependencies: false, dependencies: [] };

 // Use the new service
 const result = await DependencyService.checkRiskDependencies(riskId, user.organizationId);

 return {
 hasDependencies: result.hasDependencies,
 dependencies: result.dependencies
 };
 };

 const deleteRisk = async (id: string, _name?: string, riskOrganizationId?: string) => {
 if (!user) return false;
 if (!canDeleteResource(user as UserProfile, 'Risk')) {
 toast.error(t('common.accessDenied'));
 return false;
 }
 setSubmitting(true);
 try {
 // Need a proper risk object for verification, creating a shim if only ID provided
 // ideally we pass the full risk object, but for backward compatibility we handle id
 const riskVerify = riskOrganizationId ? { organizationId: riskOrganizationId } as Risk : undefined;

 const result = await RiskService.deleteRisk(user as UserProfile, id, riskVerify);

 if (result.success) {
 toast.success(t('risks.deleted', { defaultValue: 'Risque supprimé. Consultez le registre pour mettre à jour vos priorités.' }));
 onRefresh();
 return true;
 } else {
 toast.error(result.error || t('common.error'));
 return false;
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.deleteRisk', 'DELETE_FAILED');
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 const exportRisks = (risks: Risk[], format: 'csv' | 'pdf') => {
 return new Promise<void>((resolve, reject) => {
 try {
 if (format === 'csv') {
  // Generate CSV content
  const headers = ['ID', 'Menace/Nom', 'Scénario', 'Statut', 'Score', 'Probabilité', 'Impact', 'Propriétaire', 'Créé le'];
  const rows = risks.map(r => [
  r.id,
  `"${r.threat.replace(/"/g, '""')}"`, // Escape quotes
  `"${(r.scenario || '').replace(/"/g, '""')}"`,
  r.status,
  (r.probability * r.impact).toString(),
  r.probability.toString(),
  r.impact.toString(),
  r.owner || '',
  r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '-'
  ]);

  const csvContent = [
  headers.join(','),
  ...rows.map(r => r.join(','))
  ].join('\n');

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `risks_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast.success(t('common.exportSuccess'));
  resolve();
 } else {
  // PDF Not implemented yet
  toast.info(t('risks.pdfExportComingSoon') || 'Export PDF bientôt disponible');
  resolve();
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.exportRisks', 'UNKNOWN_ERROR');
 toast.error(t('common.exportError'));
 reject(error);
 }
 });
 };

 const exportCSV = async (risks: Risk[]) => {
 setIsExportingCSV(true);
 try {
 await exportRisks(risks, 'csv');
 } finally {
 setIsExportingCSV(false);
 }
 };

 const bulkDeleteRisks = async (ids: string[]) => {
 setSubmitting(true);
 if (!user?.organizationId || !canEditResource(user as UserProfile, 'Risk')) {
 toast.error(t('common.accessDenied'));
 setSubmitting(false);
 return;
 }

 try {
 let successCount = 0;
 let blockedCount = 0;
 const errors: string[] = [];
 const deletedIds: string[] = [];

 // Process sequentially or semi-parallel to track individual results
 await Promise.all(ids.map(async (id) => {
 try {
  await FunctionsService.deleteResource('risks', id);
  successCount++;
  deletedIds.push(id);
 } catch (error: unknown) {
  ErrorLogger.error(error, 'useRiskActions.bulkDelete');
  blockedCount++;
  const errWithMsg = error as { message?: string } | null;
  if (errWithMsg?.message) errors.push(errWithMsg.message);
 }
 }));

 if (successCount > 0) {
 if (user && user.organizationId) {
  // Log the bulk deletion
  await AuditLogService.log({
  organizationId: user.organizationId,
  userId: user.uid,
  userName: user.displayName || user.email || 'Unknown',
  userEmail: user.email || '',
  action: 'delete',
  entityType: 'risk',
  entityId: 'bulk',
  details: `Suppression multiple: ${successCount} risques`,
  before: {
  deletedIds,
  count: successCount
  }
  });
 }
 toast.success(t('common.risksDeleted', { count: successCount }) + (blockedCount > 0 ? ` (${blockedCount} bloqués)` : ''));
 onRefresh();
 }

 if (blockedCount > 0) {
 // Show first error as example
 const firstError = errors.length > 0 ? errors[0] : t('risks.existingDependencies') || 'Dépendances existantes';
 toast.error(t('risks.bulkDeletePartialError', { count: blockedCount, error: firstError }) || `Certains risques n'ont pas pu être supprimés (${blockedCount}). Exemple: ${firstError}`);
 }

 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.bulkDeleteRisks', 'DELETE_FAILED');
 toast.error(t('common.bulkDeleteError'));
 } finally {
 setSubmitting(false);
 }
 };

 const importRisks = async (csvContent: string) => {
 if (!canEditResource(user as UserProfile, 'Risk')) return false;
 setIsImporting(true);
 try {
 const { data, errors } = ImportService.parseRisks(csvContent);

 if (errors.length > 0) {
 toast.error(t('risks.importValidationErrors', { count: errors.length, details: errors.slice(0, 3).join(', ') }) || `Erreurs de validation (${errors.length}): ${errors.slice(0, 3).join(', ')}`);
 if (data.length === 0) return false;
 }

 let importedCount = 0;
 for (const item of data) {
 // Using internal createRisk for consistency
 await createRisk({
  ...item,
  strategy: item.strategy as Risk['strategy'],
  status: item.status as Risk['status'],
  framework: item.framework as Risk['framework'],
  probability: Number(item.probability) as 1 | 2 | 3 | 4 | 5,
  impact: Number(item.impact) as 1 | 2 | 3 | 4 | 5
 });
 importedCount++;
 }

 toast.success(t('common.importSuccess', { count: importedCount }));
 onRefresh();
 return true;
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useRiskActions.importRisks', 'UNKNOWN_ERROR');
 toast.error(t('common.importError') || "Erreur critique lors de l'import");
 return false;
 } finally {
 setSubmitting(false);
 }
 };

 return {
 createRisk,
 saveRiskAsDraft,
 updateRiskDraft,
 publishDraft,
 updateRisk,
 deleteRisk,
 exportCSV,
 bulkDeleteRisks,
 bulkCreateRisks,
 importRisks,
 checkDependencies,
 isGeneratingReport,
 setIsGeneratingReport,
 isExportingCSV,
 isImporting,
 submitting
 };
};
