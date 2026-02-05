/**
 * EBIOS Analysis Service
 * Implements ADR-E001: EBIOS RM State Machine
 *
 * Service for managing EBIOS Risk Manager analyses and workshops
 */

import {
 doc,
 getDoc,
 setDoc,
 updateDoc,
 deleteDoc,
 collection,
 query,
 where,
 orderBy,
 limit,
 getDocs,
 onSnapshot,
 serverTimestamp,
 Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
 EbiosAnalysis,
 EbiosWorkshopNumber,
 Workshop1Data,
 Workshop2Data,
 Workshop3Data,
 Workshop4Data,
 Workshop5Data,
 RiskSource,
 TargetedObjective,
 SMSIProgram,
 Milestone,
 MilestoneStatus,
 PDCAPhase,
 PDCAPhaseData,
 RiskContext,
} from '../types/ebios';

// Import the functions from types
import {
 createDefaultEbiosWorkshops as createWorkshops,
 calculateEbiosCompletionPercentage as calculateCompletion,
 canProceedToWorkshop,
} from '../types/ebios';

type WorkshopData = Workshop1Data | Workshop2Data | Workshop3Data | Workshop4Data | Workshop5Data;

/**
 * Service for EBIOS RM Analysis operations
 */
export class EbiosService {
 // ============================================================================
 // Analysis CRUD Operations
 // ============================================================================

 /**
 * Create a new EBIOS RM analysis
 */
 static async createAnalysis(
 organizationId: string,
 data: {
 name: string;
 description?: string;
 targetCertificationDate?: string;
 sector?: string;
 },
 userId: string
 ): Promise<EbiosAnalysis> {
 try {
 const analysisRef = doc(collection(db, 'organizations', organizationId, 'ebiosAnalyses'));

 const analysis: EbiosAnalysis = {
 id: analysisRef.id,
 organizationId,
 name: data.name,
 description: data.description,
 status: 'draft',
 currentWorkshop: 1,
 workshops: createWorkshops(),
 completionPercentage: 0,
 createdAt: serverTimestamp() as unknown as string,
 createdBy: userId,
 updatedAt: serverTimestamp() as unknown as string,
 updatedBy: userId,
 targetCertificationDate: data.targetCertificationDate,
 sector: data.sector,
 contributesToGlobalScore: true,
 };

 await setDoc(analysisRef, sanitizeData(analysis));

 return analysis;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.createAnalysis', {
 component: 'EbiosService',
 action: 'createAnalysis',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Get an EBIOS analysis by ID
 */
 static async getAnalysis(
 organizationId: string,
 analysisId: string
 ): Promise<EbiosAnalysis | null> {
 try {
 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);
 const analysisSnap = await getDoc(analysisRef);

 if (!analysisSnap.exists()) {
 return null;
 }

 return analysisSnap.data() as EbiosAnalysis;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.getAnalysis', {
 component: 'EbiosService',
 action: 'getAnalysis',
 organizationId,
 metadata: { analysisId },
 });
 throw error;
 }
 }

 /**
 * List all EBIOS analyses for an organization
 */
 static async listAnalyses(
 organizationId: string,
 options?: {
 status?: string;
 limit?: number;
 }
 ): Promise<EbiosAnalysis[]> {
 try {
 let q = query(
 collection(db, 'organizations', organizationId, 'ebiosAnalyses')
 );

 if (options?.status) {
 q = query(q, where('status', '==', options.status));
 }

 if (options?.limit) {
 q = query(q, limit(options.limit));
 }

 const snapshot = await getDocs(q);
 const analyses: EbiosAnalysis[] = [];

 snapshot.forEach((docSnap) => {
 analyses.push(docSnap.data() as EbiosAnalysis);
 });

 return analyses;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.listAnalyses', {
 component: 'EbiosService',
 action: 'listAnalyses',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Update an EBIOS analysis
 */
 static async updateAnalysis(
 organizationId: string,
 analysisId: string,
 data: Partial<Pick<EbiosAnalysis, 'name' | 'description' | 'targetCertificationDate' | 'sector' | 'status'>>,
 userId: string
 ): Promise<void> {
 try {
 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);

 await updateDoc(analysisRef, sanitizeData({
 ...data,
 updatedAt: new Date().toISOString(),
 updatedBy: userId,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.updateAnalysis', {
 component: 'EbiosService',
 action: 'updateAnalysis',
 organizationId,
 metadata: { analysisId },
 });
 throw error;
 }
 }

 /**
 * Delete an EBIOS analysis
 */
 static async deleteAnalysis(
 organizationId: string,
 analysisId: string
 ): Promise<void> {
 try {
 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);

 // Cascade: clean up potential subcollections under the analysis doc
 const subcollectionNames = ['threatSources', 'attackScenarios'];
 for (const subcollName of subcollectionNames) {
 const subcollRef = collection(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId, subcollName);
 const subcollSnap = await getDocs(subcollRef);
 if (!subcollSnap.empty) {
 const deletePromises = subcollSnap.docs.map(subDoc => deleteDoc(subDoc.ref));
 await Promise.all(deletePromises);
 }
 }

 // Cascade: nullify references in homologation dossiers
 const homologationsRef = collection(db, 'organizations', organizationId, 'homologations');
 const homologationsQuery = query(homologationsRef, where('linkedEbiosAnalysisId', '==', analysisId));
 const homologationsSnap = await getDocs(homologationsQuery);
 if (!homologationsSnap.empty) {
 const updatePromises = homologationsSnap.docs.map(hDoc =>
 updateDoc(hDoc.ref, { linkedEbiosAnalysisId: null })
 );
 await Promise.all(updatePromises);
 }

 await deleteDoc(analysisRef);
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.deleteAnalysis', {
 component: 'EbiosService',
 action: 'deleteAnalysis',
 organizationId,
 metadata: { analysisId },
 });
 throw error;
 }
 }

 /**
 * Subscribe to real-time updates for an analysis
 */
 static subscribeToAnalysis(
 organizationId: string,
 analysisId: string,
 callback: (analysis: EbiosAnalysis | null, error?: Error) => void
 ): Unsubscribe {
 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);

 return onSnapshot(
 analysisRef,
 (snapshot) => {
 if (!snapshot.exists()) {
 callback(null);
 return;
 }
 callback(snapshot.data() as EbiosAnalysis);
 },
 (error) => {
 ErrorLogger.error(error, 'EbiosService.subscribeToAnalysis', {
 component: 'EbiosService',
 action: 'subscribeToAnalysis',
 organizationId,
 });
 callback(null, error);
 }
 );
 }

 // ============================================================================
 // Workshop Operations
 // ============================================================================

 /**
 * Save workshop data (auto-save)
 */
 static async saveWorkshopData<T extends WorkshopData>(
 organizationId: string,
 analysisId: string,
 workshopNumber: EbiosWorkshopNumber,
 data: Partial<T>,
 userId: string
 ): Promise<void> {
 try {
 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);
 const analysis = await this.getAnalysis(organizationId, analysisId);

 if (!analysis) {
 throw new Error('Analysis not found');
 }

 // Merge data with existing workshop data
 const currentData = analysis.workshops[workshopNumber].data;
 const mergedData = { ...currentData, ...data };

 // Update workshop status to in_progress if not started
 const currentStatus = analysis.workshops[workshopNumber].status;
 const newStatus = currentStatus === 'not_started' ? 'in_progress' : currentStatus;

 await updateDoc(analysisRef, sanitizeData({
 [`workshops.${workshopNumber}.data`]: mergedData,
 [`workshops.${workshopNumber}.status`]: newStatus,
 [`workshops.${workshopNumber}.startedAt`]: currentStatus === 'not_started'
 ? new Date().toISOString()
 : analysis.workshops[workshopNumber].startedAt,
 status: analysis.status === 'draft' ? 'in_progress' : analysis.status,
 updatedAt: new Date().toISOString(),
 updatedBy: userId,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.saveWorkshopData', {
 component: 'EbiosService',
 action: 'saveWorkshopData',
 organizationId,
 metadata: { analysisId, workshopNumber },
 });
 throw error;
 }
 }

 /**
 * Complete a workshop
 */
 static async completeWorkshop(
 organizationId: string,
 analysisId: string,
 workshopNumber: EbiosWorkshopNumber,
 userId: string
 ): Promise<void> {
 try {
 const analysis = await this.getAnalysis(organizationId, analysisId);

 if (!analysis) {
 throw new Error('Analysis not found');
 }

 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);
 const now = new Date().toISOString();

 // Update workshop status
 const updatedWorkshops = { ...analysis.workshops };
 // @ts-expect-error - TypeScript can't narrow the workshop type based on workshopNumber
 updatedWorkshops[workshopNumber] = {
 ...updatedWorkshops[workshopNumber],
 status: 'completed' as const,
 completedAt: now,
 };

 // Calculate new completion percentage
 const completionPercentage = calculateCompletion(updatedWorkshops);

 // Determine next workshop
 const nextWorkshop = workshopNumber < 5
 ? (workshopNumber + 1) as EbiosWorkshopNumber
 : workshopNumber;

 // Determine analysis status
 const analysisStatus = workshopNumber === 5 ? 'completed' : 'in_progress';

 await updateDoc(analysisRef, sanitizeData({
 workshops: updatedWorkshops,
 currentWorkshop: nextWorkshop,
 completionPercentage,
 status: analysisStatus,
 updatedAt: now,
 updatedBy: userId,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.completeWorkshop', {
 component: 'EbiosService',
 action: 'completeWorkshop',
 organizationId,
 metadata: { analysisId, workshopNumber },
 });
 throw error;
 }
 }

 /**
 * Validate a workshop (after review)
 */
 static async validateWorkshop(
 organizationId: string,
 analysisId: string,
 workshopNumber: EbiosWorkshopNumber,
 userId: string
 ): Promise<void> {
 try {
 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);
 const now = new Date().toISOString();

 await updateDoc(analysisRef, sanitizeData({
 [`workshops.${workshopNumber}.status`]: 'validated',
 [`workshops.${workshopNumber}.validatedBy`]: userId,
 [`workshops.${workshopNumber}.validatedAt`]: now,
 updatedAt: now,
 updatedBy: userId,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.validateWorkshop', {
 component: 'EbiosService',
 action: 'validateWorkshop',
 organizationId,
 metadata: { analysisId, workshopNumber },
 });
 throw error;
 }
 }

 /**
 * Navigate to a different workshop
 */
 static async navigateToWorkshop(
 organizationId: string,
 analysisId: string,
 targetWorkshop: EbiosWorkshopNumber,
 userId: string
 ): Promise<void> {
 try {
 const analysis = await this.getAnalysis(organizationId, analysisId);

 if (!analysis) {
 throw new Error('Analysis not found');
 }

 // Check if navigation is valid
 if (!canProceedToWorkshop(analysis.workshops, targetWorkshop)) {
 throw new Error(`Cannot navigate to workshop ${targetWorkshop}. Previous workshop must be completed.`);
 }

 const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', analysisId);

 await updateDoc(analysisRef, sanitizeData({
 currentWorkshop: targetWorkshop,
 updatedAt: new Date().toISOString(),
 updatedBy: userId,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.navigateToWorkshop', {
 component: 'EbiosService',
 action: 'navigateToWorkshop',
 organizationId,
 metadata: { analysisId, targetWorkshop },
 });
 throw error;
 }
 }

 // ============================================================================
 // Risk Source Library Operations
 // ============================================================================

 /**
 * Get all risk sources (ANSSI standard + custom)
 */
 static async getRiskSources(organizationId: string): Promise<RiskSource[]> {
 try {
 // Get ANSSI standard sources
 const standardQuery = query(
 collection(db, 'ebiosLibrary', 'riskSources', 'items'),
 where('isANSSIStandard', '==', true)
 );
 const standardSnap = await getDocs(standardQuery);
 const standardSources: RiskSource[] = [];
 standardSnap.forEach((docSnap) => {
 standardSources.push({ id: docSnap.id, ...docSnap.data() } as RiskSource);
 });

 // Get custom sources for this organization
 const customQuery = query(
 collection(db, 'organizations', organizationId, 'riskSources')
 );
 const customSnap = await getDocs(customQuery);
 const customSources: RiskSource[] = [];
 customSnap.forEach((docSnap) => {
 customSources.push({ id: docSnap.id, ...docSnap.data() } as RiskSource);
 });

 return [...standardSources, ...customSources];
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.getRiskSources', {
 component: 'EbiosService',
 action: 'getRiskSources',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Create a custom risk source
 */
 static async createCustomRiskSource(
 organizationId: string,
 data: Omit<RiskSource, 'id' | 'createdAt' | 'organizationId' | 'isANSSIStandard'>
 ): Promise<RiskSource> {
 try {
 const sourceRef = doc(collection(db, 'organizations', organizationId, 'riskSources'));
 const now = new Date().toISOString();

 const source: RiskSource = {
 id: sourceRef.id,
 ...data,
 isANSSIStandard: false,
 organizationId,
 createdAt: now,
 };

 await setDoc(sourceRef, sanitizeData(source));

 return source;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.createCustomRiskSource', {
 component: 'EbiosService',
 action: 'createCustomRiskSource',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Get all targeted objectives (ANSSI standard + custom)
 */
 static async getTargetedObjectives(organizationId: string): Promise<TargetedObjective[]> {
 try {
 // Get ANSSI standard objectives
 const standardQuery = query(
 collection(db, 'ebiosLibrary', 'targetedObjectives', 'items'),
 where('isANSSIStandard', '==', true)
 );
 const standardSnap = await getDocs(standardQuery);
 const standardObjectives: TargetedObjective[] = [];
 standardSnap.forEach((docSnap) => {
 standardObjectives.push({ id: docSnap.id, ...docSnap.data() } as TargetedObjective);
 });

 // Get custom objectives for this organization
 const customQuery = query(
 collection(db, 'organizations', organizationId, 'targetedObjectives')
 );
 const customSnap = await getDocs(customQuery);
 const customObjectives: TargetedObjective[] = [];
 customSnap.forEach((docSnap) => {
 customObjectives.push({ id: docSnap.id, ...docSnap.data() } as TargetedObjective);
 });

 return [...standardObjectives, ...customObjectives];
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.getTargetedObjectives', {
 component: 'EbiosService',
 action: 'getTargetedObjectives',
 organizationId,
 });
 throw error;
 }
 }

 // ============================================================================
 // SMSI Program Operations (ISO 27003)
 // ============================================================================

 /**
 * Get or create SMSI Program for an organization
 */
 static async getSMSIProgram(organizationId: string): Promise<SMSIProgram | null> {
 try {
 const programRef = doc(db, 'organizations', organizationId, 'smsiProgram', 'current');
 const programSnap = await getDoc(programRef);

 if (!programSnap.exists()) {
 return null;
 }

 return programSnap.data() as SMSIProgram;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.getSMSIProgram', {
 component: 'EbiosService',
 action: 'getSMSIProgram',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Create SMSI Program
 */
 static async createSMSIProgram(
 organizationId: string,
 data: {
 name: string;
 description?: string;
 targetCertificationDate?: string;
 template?: 'standard' | 'fast-track' | 'maintenance';
 },
 userId: string
 ): Promise<SMSIProgram> {
 try {
 const programRef = doc(db, 'organizations', organizationId, 'smsiProgram', 'current');
 const now = new Date().toISOString();

 const program: SMSIProgram = {
 id: 'current',
 organizationId,
 name: data.name,
 description: data.description,
 targetCertificationDate: data.targetCertificationDate,
 currentPhase: 'plan',
 phases: {
 plan: { status: 'not_started', progress: 0 },
 do: { status: 'not_started', progress: 0 },
 check: { status: 'not_started', progress: 0 },
 act: { status: 'not_started', progress: 0 },
 },
 overallProgress: 0,
 status: 'active',
 createdAt: now,
 updatedAt: now,
 createdBy: userId,
 };

 await setDoc(programRef, sanitizeData(program));

 // Generate milestones based on template
 await this.generateMilestonesForTemplate(organizationId, data.template || 'standard');

 return program;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.createSMSIProgram', {
 component: 'EbiosService',
 action: 'createSMSIProgram',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Get milestones for SMSI Program
 */
 static async getMilestones(organizationId: string): Promise<Milestone[]> {
 try {
 const milestonesQuery = query(
 collection(db, 'organizations', organizationId, 'smsiProgram', 'current', 'milestones'),
 orderBy('dueDate', 'asc')
 );

 const snapshot = await getDocs(milestonesQuery);
 const milestones: Milestone[] = [];

 snapshot.forEach((docSnap) => {
 milestones.push({ id: docSnap.id, ...docSnap.data() } as Milestone);
 });

 return milestones;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.getMilestones', {
 component: 'EbiosService',
 action: 'getMilestones',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Create a milestone
 */
 static async createMilestone(
 organizationId: string,
 data: Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt' | 'status'>
 ): Promise<Milestone> {
 try {
 const milestoneRef = doc(collection(db, 'organizations', organizationId, 'smsiProgram', 'current', 'milestones'));
 const now = new Date().toISOString();

 const milestone: Milestone = {
 id: milestoneRef.id,
 programId: 'current',
 organizationId,
 ...data,
 status: 'pending',
 createdAt: now,
 };

 await setDoc(milestoneRef, sanitizeData(milestone));

 return milestone;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.createMilestone', {
 component: 'EbiosService',
 action: 'createMilestone',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Update milestone status
 */
 static async updateMilestoneStatus(
 organizationId: string,
 milestoneId: string,
 status: MilestoneStatus
 ): Promise<void> {
 try {
 const milestoneRef = doc(
 db,
 'organizations',
 organizationId,
 'smsiProgram',
 'current',
 'milestones',
 milestoneId
 );

 const updates: Partial<Milestone> = {
 status,
 updatedAt: new Date().toISOString(),
 };

 if (status === 'completed') {
 updates.completedAt = new Date().toISOString();
 }

 await updateDoc(milestoneRef, sanitizeData(updates));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.updateMilestoneStatus', {
 component: 'EbiosService',
 action: 'updateMilestoneStatus',
 organizationId,
 metadata: { milestoneId },
 });
 throw error;
 }
 }

 /**
 * Update milestone (full update for editing)
 */
 static async updateMilestone(
 organizationId: string,
 milestoneId: string,
 data: Partial<Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt'>>
 ): Promise<Milestone> {
 try {
 const milestoneRef = doc(
 db,
 'organizations',
 organizationId,
 'smsiProgram',
 'current',
 'milestones',
 milestoneId
 );

 const updates = {
 ...data,
 updatedAt: new Date().toISOString(),
 };

 await updateDoc(milestoneRef, sanitizeData(updates));

 const updatedDoc = await getDoc(milestoneRef);
 return { id: updatedDoc.id, ...updatedDoc.data() } as Milestone;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.updateMilestone', {
 component: 'EbiosService',
 action: 'updateMilestone',
 organizationId,
 metadata: { milestoneId },
 });
 throw error;
 }
 }

 /**
 * Update SMSI Program phase
 */
 static async updateSMSIProgramPhase(
 organizationId: string,
 phase: PDCAPhase,
 phaseData?: Partial<PDCAPhaseData>
 ): Promise<void> {
 try {
 const programRef = doc(db, 'organizations', organizationId, 'smsiProgram', 'current');

 const updates: Record<string, unknown> = {
 currentPhase: phase,
 updatedAt: new Date().toISOString(),
 };

 if (phaseData) {
 updates[`phases.${phase}`] = phaseData;
 }

 await updateDoc(programRef, sanitizeData(updates));
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.updateSMSIProgramPhase', {
 component: 'EbiosService',
 action: 'updateSMSIProgramPhase',
 organizationId,
 metadata: { phase },
 });
 throw error;
 }
 }

 /**
 * Update SMSI Program details
 */
 static async updateSMSIProgram(
 organizationId: string,
 data: Partial<Pick<SMSIProgram, 'name' | 'description' | 'targetCertificationDate' | 'status'>>
 ): Promise<SMSIProgram> {
 try {
 const programRef = doc(db, 'organizations', organizationId, 'smsiProgram', 'current');

 await updateDoc(programRef, sanitizeData({
 ...data,
 updatedAt: new Date().toISOString(),
 }));

 const updatedSnap = await getDoc(programRef);
 return updatedSnap.data() as SMSIProgram;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.updateSMSIProgram', {
 component: 'EbiosService',
 action: 'updateSMSIProgram',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Delete SMSI Program and all associated milestones
 */
 static async deleteSMSIProgram(organizationId: string): Promise<void> {
 try {
 // Delete all milestones first (using correct path under smsiProgram/current/milestones)
 const milestonesRef = collection(db, 'organizations', organizationId, 'smsiProgram', 'current', 'milestones');
 const milestonesSnap = await getDocs(milestonesRef);
 const deletePromises = milestonesSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
 await Promise.all(deletePromises);

 // Delete the program
 const programRef = doc(db, 'organizations', organizationId, 'smsiProgram', 'current');
 await deleteDoc(programRef);
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.deleteSMSIProgram', {
 component: 'EbiosService',
 action: 'deleteSMSIProgram',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Delete a milestone
 */
 static async deleteMilestone(organizationId: string, milestoneId: string): Promise<void> {
 try {
 const milestoneRef = doc(db, 'organizations', organizationId, 'smsiProgram', 'current', 'milestones', milestoneId);
 await deleteDoc(milestoneRef);
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.deleteMilestone', {
 component: 'EbiosService',
 action: 'deleteMilestone',
 organizationId,
 metadata: { milestoneId },
 });
 throw error;
 }
 }

 // ============================================================================
 // Risk Context Operations (ISO 27005)
 // ============================================================================

 /**
 * Get Risk Context for an organization
 */
 static async getRiskContext(organizationId: string): Promise<RiskContext | null> {
 try {
 const contextRef = doc(db, 'organizations', organizationId, 'riskContext', 'current');
 const contextSnap = await getDoc(contextRef);

 if (!contextSnap.exists()) {
 return null;
 }

 return contextSnap.data() as RiskContext;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.getRiskContext', {
 component: 'EbiosService',
 action: 'getRiskContext',
 organizationId,
 });
 throw error;
 }
 }

 // ============================================================================
 // Helper Methods
 // ============================================================================

 /**
 * Generate milestones based on the selected template
 */
 private static async generateMilestonesForTemplate(
 organizationId: string,
 template: 'standard' | 'fast-track' | 'maintenance'
 ): Promise<void> {
 const milestones: Array<Omit<Milestone, 'id' | 'programId' | 'organizationId' | 'createdAt' | 'status'>> = [];
 const now = new Date();

 const addDays = (date: Date, days: number) => {
 const result = new Date(date);
 result.setDate(result.getDate() + days);
 return result.toISOString();
 };

 if (template === 'standard') {
 // PLAN
 milestones.push(
 { phase: 'plan', name: 'Définition du périmètre SMSI', description: 'Identifier les limites organisationnelles et physiques.', dueDate: addDays(now, 7) },
 { phase: 'plan', name: 'Politique de Sécurité (PSSI)', description: 'Rédaction et validation par la direction.', dueDate: addDays(now, 14) },
 { phase: 'plan', name: 'Appréciation des Risques', description: 'Méthodologie EBIOS RM et identification des risques.', dueDate: addDays(now, 30) }
 );
 // DO
 milestones.push(
 { phase: 'do', name: 'Plan de Traitement des Risques (PTR)', description: 'Sélection et implémentation des mesures.', dueDate: addDays(now, 45) },
 { phase: 'do', name: 'Déclaration d\'Applicabilité (DDA)', description: 'Justification des contrôles ISO 27001.', dueDate: addDays(now, 60) },
 { phase: 'do', name: 'Sensibilisation des collaborateurs', description: 'Campagne de formation et simulation phishing.', dueDate: addDays(now, 75) }
 );
 // CHECK
 milestones.push(
 { phase: 'check', name: 'Audit Interne', description: 'Vérification de la conformité du SMSI.', dueDate: addDays(now, 90) },
 { phase: 'check', name: 'Indicateurs & Métriques', description: 'Revue des KPIs de sécurité.', dueDate: addDays(now, 100) }
 );
 // ACT
 milestones.push(
 { phase: 'act', name: 'Revue de Direction', description: 'Validation de l\'efficacité du SMSI par le COMEX.', dueDate: addDays(now, 110) },
 { phase: 'act', name: 'Audit de Certification', description: 'Audit externe par l\'organisme certificateur.', dueDate: addDays(now, 120) }
 );
 } else if (template === 'fast-track') {
 // Focus on essentials for startups
 milestones.push(
 { phase: 'plan', name: 'Identification des actifs critiques', description: 'Inventaire des données et systèmes majeurs.', dueDate: addDays(now, 5) },
 { phase: 'plan', name: 'Analyse des risques flash', description: 'Focus sur les Top 10 risques.', dueDate: addDays(now, 10) },
 { phase: 'do', name: 'Sécurité Postes & Accès', description: 'MFA, Chiffrement, Antivirus.', dueDate: addDays(now, 20) },
 { phase: 'do', name: 'Charte IT', description: 'Règles d\'or pour les employés.', dueDate: addDays(now, 25) },
 { phase: 'check', name: 'Revue des incidents', description: 'Analyse des incidents passés.', dueDate: addDays(now, 45) },
 { phase: 'act', name: 'Plan d\'amélioration', description: 'Roadmap sécurité S2.', dueDate: addDays(now, 60) }
 );
 } else if (template === 'maintenance') {
 // Annual cycle for certified orgs
 milestones.push(
 { phase: 'plan', name: 'Mise à jour de l\'analyse de risques', description: 'Réévaluation annuelle.', dueDate: addDays(now, 30) },
 { phase: 'do', name: 'Mise à jour des politiques', description: 'Adaptation aux nouvelles menaces.', dueDate: addDays(now, 60) },
 { phase: 'check', name: 'Audit de surveillance', description: 'Préparation audit n+1.', dueDate: addDays(now, 200) },
 { phase: 'act', name: 'Correction des non-conformités', description: 'Traitement des écarts d\'audit.', dueDate: addDays(now, 240) }
 );
 }

 // Batch create milestones
 // Note: In a real batch transaction we would use writeBatch, but for now we iterate
 // to reuse the helper logic inside createMilestone or just create refs manually.
 // To match current architecture, let's just loop sequentially or parallelize.

 await Promise.all(milestones.map(m => this.createMilestone(organizationId, m)));
 }

 /**
 * Save Risk Context
 */
 static async saveRiskContext(
 organizationId: string,
 data: Omit<RiskContext, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
 ): Promise<RiskContext> {
 try {
 const contextRef = doc(db, 'organizations', organizationId, 'riskContext', 'current');
 const now = new Date().toISOString();

 const existingContext = await this.getRiskContext(organizationId);

 const context: RiskContext = {
 id: 'current',
 organizationId,
 ...data,
 createdAt: existingContext?.createdAt || now,
 updatedAt: now,
 };

 await setDoc(contextRef, sanitizeData(context));

 return context;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.saveRiskContext', {
 component: 'EbiosService',
 action: 'saveRiskContext',
 organizationId,
 });
 throw error;
 }
 }

 /**
 * Duplicate an EBIOS analysis
 */
 static async duplicateAnalysis(
 organizationId: string,
 analysisId: string,
 userId: string
 ): Promise<EbiosAnalysis> {
 try {
 const original = await this.getAnalysis(organizationId, analysisId);
 if (!original) throw new Error('Analysis not found');

 const analysisRef = doc(collection(db, 'organizations', organizationId, 'ebiosAnalyses'));
 const now = new Date().toISOString();

 const newAnalysis: EbiosAnalysis = {
 ...original,
 id: analysisRef.id,
 name: `${original.name} (Copy)`,
 status: 'draft',
 createdAt: now,
 createdBy: userId,
 updatedAt: now,
 updatedBy: userId,
 // Reset validation info if desired, or keep progress?
 // Usually duplication implies starting fresh or forking. 
 // For EBIOS, we probably want to keep the content but maybe reset validation status?
 // For simplicity and "functional" request, keeping content is better.
 // I will reset the status to draft but keep the workshops content.
 workshops: original.workshops
 };

 await setDoc(analysisRef, sanitizeData(newAnalysis));
 return newAnalysis;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosService.duplicateAnalysis', {
 component: 'EbiosService',
 action: 'duplicateAnalysis',
 organizationId,
 metadata: { analysisId }
 });
 throw error;
 }
 }
}
