/**
 * HomologationService
 *
 * Service for ANSSI Homologation level determination and dossier management.
 * Implements ADR-011: ANSSI Homologation Templates for Public Sector.
 */

import {
 collection,
 doc,
 getDoc,
 getDocs,
 setDoc,
 updateDoc,
 deleteDoc,
 query,
 where,
 orderBy,
 Timestamp,
 serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
 HomologationDossier,
 HomologationLevel,
 HomologationStatus,
 HomologationDocumentType,
 LevelDeterminationAnswer,
 LevelRecommendation,
 HomologationDocumentRef,
 CreateHomologationDossierInput,
 UpdateHomologationDossierInput,
 EbiosLinkSnapshot,
 EbiosLinkHistoryEntry
} from '../types/homologation';
import type { EbiosAnalysis, SelectedRiskSource, OperationalScenario } from '../types/ebios';
import { EbiosService } from './ebiosService';
import {
 LEVEL_THRESHOLDS,
 REQUIRED_DOCUMENTS,
 DEFAULT_VALIDITY_YEARS,
 LEVEL_INFO
} from '../types/homologation';
import {
 getQuestionById,
 getHigherLevel,
 isLevelHigherOrEqual
} from '../data/homologationQuestions';

// ============================================================================
// Level Calculation
// ============================================================================

/**
 * Calculate the total weighted score from answers
 */
export function calculateTotalScore(answers: LevelDeterminationAnswer[]): number {
 let totalWeightedScore = 0;
 let totalWeight = 0;

 for (const answer of answers) {
 const question = getQuestionById(answer.questionId);
 if (!question) continue;

 totalWeightedScore += answer.score * question.weight;
 totalWeight += question.weight * 100; // Max score per question is 100
 }

 // Normalize to 0-100 scale
 if (totalWeight === 0) return 0;
 return Math.round((totalWeightedScore / totalWeight) * 100);
}

/**
 * Determine level from score
 */
export function getLevelFromScore(score: number): HomologationLevel {
 if (score <= LEVEL_THRESHOLDS.etoile.max) return 'etoile';
 if (score <= LEVEL_THRESHOLDS.simple.max) return 'simple';
 if (score <= LEVEL_THRESHOLDS.standard.max) return 'standard';
 return 'renforce';
}

/**
 * Find the highest escalation level from answers
 */
export function findEscalationLevel(answers: LevelDeterminationAnswer[]): HomologationLevel | null {
 let highestEscalation: HomologationLevel | null = null;

 for (const answer of answers) {
 if (answer.escalatesTo) {
 if (!highestEscalation) {
 highestEscalation = answer.escalatesTo;
 } else {
 highestEscalation = getHigherLevel(highestEscalation, answer.escalatesTo);
 }
 }
 }

 return highestEscalation;
}

/**
 * Get key factors that influenced the recommendation
 */
export function getKeyFactors(answers: LevelDeterminationAnswer[]): string[] {
 const factors: string[] = [];

 for (const answer of answers) {
 const question = getQuestionById(answer.questionId);
 if (!question) continue;

 // Add factors for high scores
 if (answer.score >= 40) {
 const selectedValue = Array.isArray(answer.value) ? answer.value[0] : answer.value;
 const option = question.options.find((o) => o.value === selectedValue);
 if (option) {
 factors.push(`${question.question.replace('?', '')}: ${option.label}`);
 }
 }

 // Add escalation factors
 if (answer.escalatesTo) {
 const selectedValue = Array.isArray(answer.value) ? answer.value[0] : answer.value;
 const option = question.options.find((o) => o.value === selectedValue);
 if (option) {
 factors.push(`${option.label} (niveau minimum: ${LEVEL_INFO[answer.escalatesTo].label})`);
 }
 }
 }

 return factors.slice(0, 5); // Limit to 5 key factors
}

/**
 * Generate justification text
 */
export function generateJustification(
 level: HomologationLevel,
 score: number,
 escalationLevel: HomologationLevel | null,
 keyFactors: string[]
): string {
 const levelLabel = LEVEL_INFO[level].label;
 const parts: string[] = [];

 if (escalationLevel && isLevelHigherOrEqual(escalationLevel, level)) {
 parts.push(
 `Niveau ${levelLabel} requis en raison de critères d'escalade automatique (score: ${score}/100).`
 );
 } else {
 parts.push(`Niveau ${levelLabel} recommandé sur la base d'un score de ${score}/100.`);
 }

 if (keyFactors.length > 0) {
 parts.push(`Facteurs clés: ${keyFactors.slice(0, 3).join('; ')}.`);
 }

 return parts.join(' ');
}

/**
 * Calculate level recommendation from determination answers
 */
export function calculateLevelRecommendation(
 answers: LevelDeterminationAnswer[]
): LevelRecommendation {
 // Calculate base score
 const score = calculateTotalScore(answers);
 const scoredLevel = getLevelFromScore(score);

 // Check for escalation rules
 const escalationLevel = findEscalationLevel(answers);
 let finalLevel = scoredLevel;
 let escalationReason: string | undefined;

 if (escalationLevel && !isLevelHigherOrEqual(scoredLevel, escalationLevel)) {
 finalLevel = escalationLevel;
 escalationReason = `Niveau minimum ${LEVEL_INFO[escalationLevel].label} requis par critères de sécurité`;
 }

 // Get key factors
 const keyFactors = getKeyFactors(answers);

 // Generate justification
 const justification = generateJustification(finalLevel, score, escalationLevel, keyFactors);

 // Get required documents
 const requiredDocuments = getRequiredDocuments(finalLevel);

 return {
 recommendedLevel: finalLevel,
 score,
 justification,
 keyFactors,
 escalationReason,
 requiredDocuments
 };
}

/**
 * Process an answer to calculate its score
 */
export function processAnswer(
 questionId: string,
 value: string | string[]
): LevelDeterminationAnswer {
 const question = getQuestionById(questionId);
 if (!question) {
 return { questionId, value, score: 0 };
 }

 let totalScore = 0;
 let escalatesTo: HomologationLevel | undefined;

 const values = Array.isArray(value) ? value : [value];

 for (const v of values) {
 const option = question.options.find((o) => o.value === v);
 if (option) {
 totalScore += option.score;
 if (option.escalatesTo) {
 if (!escalatesTo) {
 escalatesTo = option.escalatesTo;
 } else {
 escalatesTo = getHigherLevel(escalatesTo, option.escalatesTo);
 }
 }
 }
 }

 // For multiple choice, average the scores
 if (Array.isArray(value) && values.length > 1) {
 totalScore = Math.round(totalScore / values.length);
 }

 return { questionId, value, score: totalScore, escalatesTo };
}

// ============================================================================
// Document Management
// ============================================================================

/**
 * Get required documents for a level
 */
export function getRequiredDocuments(level: HomologationLevel): HomologationDocumentType[] {
 return REQUIRED_DOCUMENTS[level];
}

/**
 * Initialize document references for a dossier
 */
export function initializeDocuments(level: HomologationLevel): HomologationDocumentRef[] {
 const requiredDocs = getRequiredDocuments(level);
 return requiredDocs.map((type) => ({
 type,
 status: 'not_started'
 }));
}

// ============================================================================
// Dossier CRUD Operations
// ============================================================================

/**
 * Get homologation collection reference
 */
function getHomologationCollection(organizationId: string) {
 return collection(db, 'organizations', organizationId, 'homologations');
}

/**
 * Get homologation document reference
 */
function getHomologationDoc(organizationId: string, dossierId: string) {
 return doc(db, 'organizations', organizationId, 'homologations', dossierId);
}

/**
 * Create a new homologation dossier
 */
export async function createDossier(
 organizationId: string,
 userId: string,
 input: CreateHomologationDossierInput
): Promise<HomologationDossier> {
 const collectionRef = getHomologationCollection(organizationId);
 const docRef = doc(collectionRef);

 const now = new Date().toISOString();
 const validityYears = input.validityYears ?? DEFAULT_VALIDITY_YEARS[input.level];

 const dossier: HomologationDossier = {
 id: docRef.id,
 organizationId,
 name: input.name,
 description: input.description,
 systemScope: input.systemScope,
 level: input.level,
 levelJustification: input.levelJustification,
 levelOverridden: input.levelOverridden,
 originalRecommendation: input.originalRecommendation,
 determinationAnswers: input.determinationAnswers,
 recommendationScore: input.recommendationScore,
 status: 'draft',
 validityYears,
 linkedEbiosAnalysisId: input.linkedEbiosAnalysisId,
 linkedSystemId: input.linkedSystemId,
 responsibleId: input.responsibleId,
 documents: initializeDocuments(input.level),
 renewalAlertDays: [90, 60, 30],
 createdAt: now,
 createdBy: userId,
 updatedAt: now,
 updatedBy: userId
 };

 await setDoc(docRef, sanitizeData({
 ...dossier,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp()
 }));

 return dossier;
}

/**
 * Get all dossiers for an organization
 */
export async function getDossiers(organizationId: string): Promise<HomologationDossier[]> {
 const collectionRef = getHomologationCollection(organizationId);
 const q = query(collectionRef, orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(q);

 return snapshot.docs.map((doc) => {
 const data = doc.data();
 return {
 ...data,
 id: doc.id,
 createdAt:
 data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
 updatedAt:
 data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
 } as HomologationDossier;
 });
}

/**
 * Get a single dossier
 */
export async function getDossier(
 organizationId: string,
 dossierId: string
): Promise<HomologationDossier | null> {
 const docRef = getHomologationDoc(organizationId, dossierId);
 const snapshot = await getDoc(docRef);

 if (!snapshot.exists()) return null;

 const data = snapshot.data();
 return {
 ...data,
 id: snapshot.id,
 createdAt:
 data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
 updatedAt:
 data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
 } as HomologationDossier;
}

/**
 * Get dossiers by status
 */
export async function getDossiersByStatus(
 organizationId: string,
 status: HomologationStatus
): Promise<HomologationDossier[]> {
 const collectionRef = getHomologationCollection(organizationId);
 const q = query(collectionRef, where('status', '==', status), orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(q);

 return snapshot.docs.map((doc) => {
 const data = doc.data();
 return {
 ...data,
 id: doc.id,
 createdAt:
 data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
 updatedAt:
 data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
 } as HomologationDossier;
 });
}

/**
 * Update a dossier
 */
export async function updateDossier(
 organizationId: string,
 dossierId: string,
 userId: string,
 input: UpdateHomologationDossierInput
): Promise<void> {
 const docRef = getHomologationDoc(organizationId, dossierId);

 await updateDoc(docRef, sanitizeData({
 ...input,
 updatedAt: serverTimestamp(),
 updatedBy: userId
 }));
}

/**
 * Update dossier status
 */
export async function updateDossierStatus(
 organizationId: string,
 dossierId: string,
 userId: string,
 status: HomologationStatus
): Promise<void> {
 const docRef = getHomologationDoc(organizationId, dossierId);

 const updates: Record<string, unknown> = {
 status,
 updatedAt: serverTimestamp(),
 updatedBy: userId
 };

 // Set validity dates when homologated
 if (status === 'homologated') {
 const dossier = await getDossier(organizationId, dossierId);
 if (dossier) {
 const startDate = new Date();
 const endDate = new Date();
 endDate.setFullYear(endDate.getFullYear() + dossier.validityYears);

 updates.validityStartDate = startDate.toISOString();
 updates.validityEndDate = endDate.toISOString();
 updates.decisionDate = startDate.toISOString();
 }
 }

 await updateDoc(docRef, sanitizeData(updates));
}

/**
 * Update document status within a dossier
 */
export async function updateDocumentStatus(
 organizationId: string,
 dossierId: string,
 userId: string,
 documentType: HomologationDocumentType,
 status: 'not_started' | 'in_progress' | 'completed' | 'validated',
 documentId?: string
): Promise<void> {
 const dossier = await getDossier(organizationId, dossierId);
 if (!dossier) throw new Error('Dossier not found');

 const updatedDocuments = dossier.documents.map((doc) => {
 if (doc.type === documentType) {
 return {
 ...doc,
 status,
 documentId: documentId ?? doc.documentId,
 ...(status === 'validated' ? { validatedAt: new Date().toISOString(), validatedBy: userId } : {})
 };
 }
 return doc;
 });

 await updateDoc(getHomologationDoc(organizationId, dossierId), sanitizeData({
 documents: updatedDocuments,
 updatedAt: serverTimestamp(),
 updatedBy: userId
 }));
}

/**
 * Delete a dossier
 */
export async function deleteDossier(organizationId: string, dossierId: string): Promise<void> {
 const docRef = getHomologationDoc(organizationId, dossierId);
 await deleteDoc(docRef);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate level override
 * Returns error message if invalid, null if valid
 */
export function validateLevelOverride(
 recommendedLevel: HomologationLevel,
 selectedLevel: HomologationLevel,
 justification: string
): string | null {
 // Justification always required for override
 if (recommendedLevel !== selectedLevel && (!justification || justification.trim().length < 20)) {
 return 'Une justification d\'au moins 20 caractères est requise pour modifier le niveau recommandé';
 }

 // Downgrade warning (not blocking, but should be explicit)
 if (!isLevelHigherOrEqual(selectedLevel, recommendedLevel)) {
 // This is a warning case, not an error
 return null;
 }

 return null;
}

/**
 * Check if all required documents are completed
 */
export function areAllDocumentsCompleted(dossier: HomologationDossier): boolean {
 return dossier.documents.every(
 (doc) => doc.status === 'completed' || doc.status === 'validated'
 );
}

/**
 * Check if dossier can transition to pending_decision status
 */
export function canSubmitForDecision(dossier: HomologationDossier): { valid: boolean; reason?: string } {
 if (dossier.status !== 'draft' && dossier.status !== 'in_progress') {
 return { valid: false, reason: 'Le dossier doit être en cours de rédaction' };
 }

 if (!areAllDocumentsCompleted(dossier)) {
 return { valid: false, reason: 'Tous les documents requis doivent être complétés' };
 }

 if (!dossier.authorityId) {
 return { valid: false, reason: "L'autorité d'homologation doit être désignée" };
 }

 return { valid: true };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get dossier statistics for an organization
 */
export async function getDossierStats(
 organizationId: string
): Promise<{
 total: number;
 byStatus: Record<HomologationStatus, number>;
 byLevel: Record<HomologationLevel, number>;
 expiringSoon: number;
 expired: number;
}> {
 const dossiers = await getDossiers(organizationId);
 const now = new Date();
 const thirtyDaysFromNow = new Date();
 thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

 const stats = {
 total: dossiers.length,
 byStatus: {
 draft: 0,
 in_progress: 0,
 pending_decision: 0,
 homologated: 0,
 expired: 0,
 revoked: 0
 } as Record<HomologationStatus, number>,
 byLevel: {
 etoile: 0,
 simple: 0,
 standard: 0,
 renforce: 0
 } as Record<HomologationLevel, number>,
 expiringSoon: 0,
 expired: 0
 };

 for (const dossier of dossiers) {
 stats.byStatus[dossier.status]++;
 stats.byLevel[dossier.level]++;

 if (dossier.validityEndDate) {
 const endDate = new Date(dossier.validityEndDate);
 if (endDate < now) {
 stats.expired++;
 } else if (endDate <= thirtyDaysFromNow) {
 stats.expiringSoon++;
 }
 }
 }

 return stats;
}

// ============================================================================
// Validity Tracking (Story 38-3)
// ============================================================================

/**
 * Validity state for a homologation
 */
export type ValidityState = 'active' | 'expiring_soon' | 'critical' | 'expired' | 'not_set';

/**
 * Calculate days until expiration
 */
export function calculateDaysUntilExpiration(endDate: string | undefined): number | null {
 if (!endDate) return null;

 const end = new Date(endDate);
 const now = new Date();
 const diffTime = end.getTime() - now.getTime();
 return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get validity state based on days remaining
 */
export function getValidityState(daysRemaining: number | null): ValidityState {
 if (daysRemaining === null) return 'not_set';
 if (daysRemaining < 0) return 'expired';
 if (daysRemaining <= 30) return 'critical';
 if (daysRemaining <= 90) return 'expiring_soon';
 return 'active';
}

/**
 * Get dossiers expiring within a certain number of days
 */
export async function getExpiringDossiers(
 organizationId: string,
 withinDays: number = 90
): Promise<HomologationDossier[]> {
 const dossiers = await getDossiers(organizationId);
 const now = new Date();
 const threshold = new Date();
 threshold.setDate(threshold.getDate() + withinDays);

 return dossiers.filter((dossier) => {
 if (dossier.status !== 'homologated') return false;
 if (!dossier.validityEndDate) return false;

 const endDate = new Date(dossier.validityEndDate);
 return endDate > now && endDate <= threshold;
 }).sort((a, b) => {
 const dateA = new Date(a.validityEndDate!);
 const dateB = new Date(b.validityEndDate!);
 return dateA.getTime() - dateB.getTime();
 });
}

/**
 * Get dossiers that need renewal alerts based on their alert configuration
 */
export async function getDossiersNeedingRenewal(
 organizationId: string
): Promise<Array<{ dossier: HomologationDossier; daysRemaining: number; alertLevel: 'warning' | 'urgent' | 'critical' }>> {
 const dossiers = await getDossiers(organizationId);
 const results: Array<{ dossier: HomologationDossier; daysRemaining: number; alertLevel: 'warning' | 'urgent' | 'critical' }> = [];

 for (const dossier of dossiers) {
 if (dossier.status !== 'homologated') continue;
 if (!dossier.validityEndDate) continue;

 const daysRemaining = calculateDaysUntilExpiration(dossier.validityEndDate);
 if (daysRemaining === null || daysRemaining < 0) continue;

 const alertDays = dossier.renewalAlertDays || [90, 60, 30];
 const [warning, urgent, critical] = alertDays.sort((a, b) => b - a);

 let alertLevel: 'warning' | 'urgent' | 'critical' | null = null;

 if (daysRemaining <= critical) {
 alertLevel = 'critical';
 } else if (daysRemaining <= urgent) {
 alertLevel = 'urgent';
 } else if (daysRemaining <= warning) {
 alertLevel = 'warning';
 }

 if (alertLevel) {
 results.push({ dossier, daysRemaining, alertLevel });
 }
 }

 return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Initialize a renewal dossier based on an existing one
 */
export async function initializeRenewal(
 organizationId: string,
 userId: string,
 existingDossierId: string
): Promise<HomologationDossier> {
 const existingDossier = await getDossier(organizationId, existingDossierId);
 if (!existingDossier) {
 throw new Error('Dossier not found');
 }

 // Create new dossier with data from existing one
 const renewalInput: CreateHomologationDossierInput = {
 name: `${existingDossier.name} - Renouvellement`,
 description: `Renouvellement de l'homologation: ${existingDossier.name}. Précédente période: ${existingDossier.validityStartDate || 'N/A'} - ${existingDossier.validityEndDate || 'N/A'}`,
 systemScope: existingDossier.systemScope,
 level: existingDossier.level,
 levelJustification: `Renouvellement du niveau ${LEVEL_INFO[existingDossier.level].label} - ${existingDossier.levelJustification}`,
 levelOverridden: false,
 originalRecommendation: existingDossier.level,
 determinationAnswers: existingDossier.determinationAnswers,
 recommendationScore: existingDossier.recommendationScore,
 responsibleId: existingDossier.responsibleId,
 validityYears: existingDossier.validityYears,
 linkedEbiosAnalysisId: existingDossier.linkedEbiosAnalysisId,
 linkedSystemId: existingDossier.linkedSystemId,
 organizationId,
 userId
 };

 const newDossier = await createDossier(organizationId, userId, renewalInput);

 // Link to previous dossier (add a reference in description or metadata)
 await updateDossier(organizationId, newDossier.id, userId, {
 description: `${renewalInput.description}\n\nDossier précédent: ${existingDossierId}`
 });

 return { ...newDossier, description: `${renewalInput.description}\n\nDossier précédent: ${existingDossierId}` };
}

/**
 * Get detailed validity statistics
 */
export async function getValidityStats(
 organizationId: string
): Promise<{
 totalHomologated: number;
 active: number;
 expiringSoon: number;
 critical: number;
 expired: number;
 averageDaysRemaining: number | null;
 upcomingExpirations: Array<{ dossier: HomologationDossier; daysRemaining: number; state: ValidityState }>;
}> {
 const dossiers = await getDossiers(organizationId);

 let totalHomologated = 0;
 let active = 0;
 let expiringSoon = 0;
 let critical = 0;
 let expired = 0;
 let totalDaysRemaining = 0;
 let countWithDays = 0;
 const upcomingExpirations: Array<{ dossier: HomologationDossier; daysRemaining: number; state: ValidityState }> = [];

 for (const dossier of dossiers) {
 if (dossier.status === 'homologated' || dossier.status === 'expired') {
 totalHomologated++;

 const daysRemaining = calculateDaysUntilExpiration(dossier.validityEndDate);
 const state = getValidityState(daysRemaining);

 if (daysRemaining !== null) {
 if (daysRemaining >= 0) {
 totalDaysRemaining += daysRemaining;
 countWithDays++;
 }

 upcomingExpirations.push({ dossier, daysRemaining, state });
 }

 switch (state) {
 case 'active':
 active++;
 break;
 case 'expiring_soon':
 expiringSoon++;
 break;
 case 'critical':
 critical++;
 break;
 case 'expired':
 expired++;
 break;
 }
 }
 }

 // Sort by days remaining (soonest first)
 upcomingExpirations.sort((a, b) => a.daysRemaining - b.daysRemaining);

 return {
 totalHomologated,
 active,
 expiringSoon,
 critical,
 expired,
 averageDaysRemaining: countWithDays > 0 ? Math.round(totalDaysRemaining / countWithDays) : null,
 upcomingExpirations: upcomingExpirations.slice(0, 10) // Top 10
 };
}

/**
 * Update renewal alert configuration for a dossier
 */
export async function updateRenewalAlertDays(
 organizationId: string,
 dossierId: string,
 userId: string,
 alertDays: number[]
): Promise<void> {
 // Validate alert days (must be positive and in descending order)
 const sortedDays = [...alertDays].sort((a, b) => b - a);
 if (sortedDays.some(d => d <= 0)) {
 throw new Error('Alert days must be positive numbers');
 }

 await updateDossier(organizationId, dossierId, userId, {
 renewalAlertDays: sortedDays
 });
}

/**
 * Check and update expired dossiers
 * Should be called periodically (e.g., daily cron job)
 */
export async function checkAndUpdateExpiredDossiers(
 organizationId: string,
 systemUserId: string = 'system'
): Promise<number> {
 const dossiers = await getDossiers(organizationId);
 const now = new Date();
 let updatedCount = 0;

 for (const dossier of dossiers) {
 if (dossier.status === 'homologated' && dossier.validityEndDate) {
 const endDate = new Date(dossier.validityEndDate);
 if (endDate < now) {
 await updateDossierStatus(organizationId, dossier.id, systemUserId, 'expired');
 updatedCount++;
 }
 }
 }

 return updatedCount;
}

// ============================================================================
// EBIOS Link Management (Story 38-4)
// ============================================================================

/**
 * Create a hash from EBIOS analysis data for change detection
 * Uses cyrb53 algorithm for high-quality non-cryptographic hashing
 */
export function createEbiosDataHash(analysis: EbiosAnalysis): string {
 const dataString = JSON.stringify({
 status: analysis.status,
 completionPercentage: analysis.completionPercentage,
 updatedAt: analysis.updatedAt,
 workshops: Object.entries(analysis.workshops).map(([num, ws]) => ({
 num,
 status: ws.status,
 data: ws.data
 }))
 });

 // cyrb53 hash function - high-quality 53-bit hash with excellent distribution
 // Reference: https://stackoverflow.com/a/52171480 (bryc's cyrb53)
 const seed = 0;
 let h1 = 0xdeadbeef ^ seed;
 let h2 = 0x41c6ce57 ^ seed;
 for (let i = 0; i < dataString.length; i++) {
 const ch = dataString.charCodeAt(i);
 h1 = Math.imul(h1 ^ ch, 2654435761);
 h2 = Math.imul(h2 ^ ch, 1597334677);
 }
 h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
 h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
 h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
 h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

 // Combine into 53-bit hash and convert to hex
 return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Count items from EBIOS workshop data
 */
export function countEbiosItems(analysis: EbiosAnalysis): {
 fearedEventsCount: number;
 riskSourcesCount: number;
 strategicScenariosCount: number;
 operationalScenariosCount: number;
 treatmentItemsCount: number;
} {
 const workshop1 = analysis.workshops[1]?.data;
 const workshop2 = analysis.workshops[2]?.data;
 const workshop3 = analysis.workshops[3]?.data;
 const workshop4 = analysis.workshops[4]?.data;
 const workshop5 = analysis.workshops[5]?.data;

 return {
 fearedEventsCount: workshop1?.fearedEvents?.length ?? 0,
 riskSourcesCount: workshop2?.selectedRiskSources?.length ?? 0,
 strategicScenariosCount: workshop3?.strategicScenarios?.length ?? 0,
 operationalScenariosCount: workshop4?.operationalScenarios?.length ?? 0,
 treatmentItemsCount: workshop5?.treatmentPlan?.length ?? 0
 };
}

/**
 * Create a snapshot of EBIOS analysis for tracking
 */
export function createEbiosSnapshot(analysis: EbiosAnalysis): EbiosLinkSnapshot {
 const counts = countEbiosItems(analysis);

 return {
 analysisId: analysis.id,
 analysisName: analysis.name,
 snapshotAt: new Date().toISOString(),
 workshopStatuses: {
 1: analysis.workshops[1]?.status ?? 'not_started',
 2: analysis.workshops[2]?.status ?? 'not_started',
 3: analysis.workshops[3]?.status ?? 'not_started',
 4: analysis.workshops[4]?.status ?? 'not_started',
 5: analysis.workshops[5]?.status ?? 'not_started'
 },
 completionPercentage: analysis.completionPercentage ?? 0,
 ...counts,
 dataHash: createEbiosDataHash(analysis)
 };
}

/**
 * Get eligible EBIOS analyses for linking (completed or in_progress with high completion)
 */
export async function getEligibleEbiosAnalyses(
 organizationId: string
): Promise<Array<{ analysis: EbiosAnalysis; eligible: boolean; reason?: string }>> {
 const analyses = await EbiosService.listAnalyses(organizationId);

 return analyses.map(analysis => {
 // Analysis must be at least in_progress
 if (analysis.status === 'draft') {
 return { analysis, eligible: false, reason: 'analysis_draft' };
 }

 // Must have at least Workshop 1 completed for basic risk analysis
 const workshop1Status = analysis.workshops[1]?.status;
 if (workshop1Status !== 'completed' && workshop1Status !== 'validated') {
 return { analysis, eligible: false, reason: 'workshop1_incomplete' };
 }

 return { analysis, eligible: true };
 }).sort((a, b) => {
 // Eligible first, then by name
 if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
 return a.analysis.name.localeCompare(b.analysis.name);
 });
}

/**
 * Link an EBIOS analysis to a homologation dossier
 */
export async function linkEbiosAnalysis(
 organizationId: string,
 dossierId: string,
 userId: string,
 analysisId: string,
 note?: string
): Promise<void> {
 // Get the EBIOS analysis
 const analysis = await EbiosService.getAnalysis(organizationId, analysisId);
 if (!analysis) {
 throw new Error('EBIOS analysis not found');
 }

 // Get the current dossier
 const dossier = await getDossier(organizationId, dossierId);
 if (!dossier) {
 throw new Error('Dossier not found');
 }

 // Create snapshot
 const snapshot = createEbiosSnapshot(analysis);

 // Create history entry
 const historyEntry: EbiosLinkHistoryEntry = {
 action: 'linked',
 analysisId,
 analysisName: analysis.name,
 timestamp: new Date().toISOString(),
 userId,
 snapshot,
 note
 };

 // Update dossier
 const currentHistory = dossier.ebiosLinkHistory ?? [];

 await updateDossier(organizationId, dossierId, userId, {
 linkedEbiosAnalysisId: analysisId,
 ebiosSnapshot: snapshot,
 ebiosLastSyncedAt: new Date().toISOString(),
 ebiosReviewRequired: false,
 ebiosLinkHistory: [...currentHistory, historyEntry]
 });
}

/**
 * Unlink EBIOS analysis from a homologation dossier
 */
export async function unlinkEbiosAnalysis(
 organizationId: string,
 dossierId: string,
 userId: string,
 note?: string
): Promise<void> {
 // Get the current dossier
 const dossier = await getDossier(organizationId, dossierId);
 if (!dossier) {
 throw new Error('Dossier not found');
 }

 if (!dossier.linkedEbiosAnalysisId) {
 throw new Error('No EBIOS analysis linked');
 }

 // Create history entry
 const historyEntry: EbiosLinkHistoryEntry = {
 action: 'unlinked',
 analysisId: dossier.linkedEbiosAnalysisId,
 analysisName: dossier.ebiosSnapshot?.analysisName ?? 'Unknown',
 timestamp: new Date().toISOString(),
 userId,
 note
 };

 // Update dossier
 const currentHistory = dossier.ebiosLinkHistory ?? [];
 const docRef = getHomologationDoc(organizationId, dossierId);

 await updateDoc(docRef, sanitizeData({
 linkedEbiosAnalysisId: null,
 ebiosSnapshot: null,
 ebiosLastSyncedAt: null,
 ebiosReviewRequired: false,
 ebiosLinkHistory: [...currentHistory, historyEntry],
 updatedAt: serverTimestamp(),
 updatedBy: userId
 }));
}

/**
 * Check if EBIOS analysis has changed since it was linked
 */
export async function checkEbiosChanges(
 organizationId: string,
 dossierId: string
): Promise<{
 hasChanges: boolean;
 currentSnapshot?: EbiosLinkSnapshot;
 changes?: {
 completionChanged: boolean;
 workshopStatusChanged: boolean;
 itemCountsChanged: boolean;
 details: string[];
 };
}> {
 const dossier = await getDossier(organizationId, dossierId);
 if (!dossier?.linkedEbiosAnalysisId || !dossier.ebiosSnapshot) {
 return { hasChanges: false };
 }

 const analysis = await EbiosService.getAnalysis(organizationId, dossier.linkedEbiosAnalysisId);
 if (!analysis) {
 return { hasChanges: true, changes: {
 completionChanged: false,
 workshopStatusChanged: false,
 itemCountsChanged: false,
 details: ['EBIOS analysis no longer exists']
 }};
 }

 const currentSnapshot = createEbiosSnapshot(analysis);
 const storedSnapshot = dossier.ebiosSnapshot;

 // Quick hash comparison
 if (currentSnapshot.dataHash === storedSnapshot.dataHash) {
 return { hasChanges: false, currentSnapshot };
 }

 // Detailed change detection
 const details: string[] = [];

 const completionChanged = currentSnapshot.completionPercentage !== storedSnapshot.completionPercentage;
 if (completionChanged) {
 details.push(`Completion: ${storedSnapshot.completionPercentage}% → ${currentSnapshot.completionPercentage}%`);
 }

 let workshopStatusChanged = false;
 for (const ws of [1, 2, 3, 4, 5] as const) {
 if (currentSnapshot.workshopStatuses[ws] !== storedSnapshot.workshopStatuses[ws]) {
 workshopStatusChanged = true;
 details.push(`Workshop ${ws}: ${storedSnapshot.workshopStatuses[ws]} → ${currentSnapshot.workshopStatuses[ws]}`);
 }
 }

 let itemCountsChanged = false;
 if (currentSnapshot.fearedEventsCount !== storedSnapshot.fearedEventsCount) {
 itemCountsChanged = true;
 details.push(`Feared events: ${storedSnapshot.fearedEventsCount} → ${currentSnapshot.fearedEventsCount}`);
 }
 if (currentSnapshot.riskSourcesCount !== storedSnapshot.riskSourcesCount) {
 itemCountsChanged = true;
 details.push(`Risk sources: ${storedSnapshot.riskSourcesCount} → ${currentSnapshot.riskSourcesCount}`);
 }
 if (currentSnapshot.strategicScenariosCount !== storedSnapshot.strategicScenariosCount) {
 itemCountsChanged = true;
 details.push(`Strategic scenarios: ${storedSnapshot.strategicScenariosCount} → ${currentSnapshot.strategicScenariosCount}`);
 }
 if (currentSnapshot.operationalScenariosCount !== storedSnapshot.operationalScenariosCount) {
 itemCountsChanged = true;
 details.push(`Operational scenarios: ${storedSnapshot.operationalScenariosCount} → ${currentSnapshot.operationalScenariosCount}`);
 }
 if (currentSnapshot.treatmentItemsCount !== storedSnapshot.treatmentItemsCount) {
 itemCountsChanged = true;
 details.push(`Treatment items: ${storedSnapshot.treatmentItemsCount} → ${currentSnapshot.treatmentItemsCount}`);
 }

 return {
 hasChanges: completionChanged || workshopStatusChanged || itemCountsChanged,
 currentSnapshot,
 changes: {
 completionChanged,
 workshopStatusChanged,
 itemCountsChanged,
 details
 }
 };
}

/**
 * Sync EBIOS data to update the snapshot (acknowledge changes)
 */
export async function syncEbiosData(
 organizationId: string,
 dossierId: string,
 userId: string,
 note?: string
): Promise<void> {
 const dossier = await getDossier(organizationId, dossierId);
 if (!dossier?.linkedEbiosAnalysisId) {
 throw new Error('No EBIOS analysis linked');
 }

 const analysis = await EbiosService.getAnalysis(organizationId, dossier.linkedEbiosAnalysisId);
 if (!analysis) {
 throw new Error('EBIOS analysis not found');
 }

 // Create new snapshot
 const snapshot = createEbiosSnapshot(analysis);

 // Create history entry
 const historyEntry: EbiosLinkHistoryEntry = {
 action: 'synced',
 analysisId: analysis.id,
 analysisName: analysis.name,
 timestamp: new Date().toISOString(),
 userId,
 snapshot,
 note
 };

 // Update dossier
 const currentHistory = dossier.ebiosLinkHistory ?? [];

 await updateDossier(organizationId, dossierId, userId, {
 ebiosSnapshot: snapshot,
 ebiosLastSyncedAt: new Date().toISOString(),
 ebiosReviewRequired: false,
 ebiosLinkHistory: [...currentHistory, historyEntry]
 });
}

/**
 * Mark dossier as needing EBIOS review
 */
export async function markEbiosReviewRequired(
 organizationId: string,
 dossierId: string,
 userId: string
): Promise<void> {
 await updateDossier(organizationId, dossierId, userId, {
 ebiosReviewRequired: true
 });
}

/**
 * Get EBIOS data formatted for homologation documents
 */
export async function getEbiosDataForDocument(
 organizationId: string,
 analysisId: string
): Promise<{
 fearedEvents: Array<{ name: string; description?: string; impactType: string; gravity: number }>;
 riskSources: Array<{ name: string; description?: string; motivation?: string; resources?: string }>;
 strategicScenarios: Array<{ name: string; description?: string; attackPath: string; gravity: number }>;
 operationalScenarios: Array<{ name: string; description?: string; likelihood: number; riskLevel: string }>;
 treatmentPlan: Array<{ measure: string; status: string; controlId?: string; deadline?: string }>;
} | null> {
 const analysis = await EbiosService.getAnalysis(organizationId, analysisId);
 if (!analysis) return null;

 const workshop1 = analysis.workshops[1]?.data;
 const workshop2 = analysis.workshops[2]?.data;
 const workshop3 = analysis.workshops[3]?.data;
 const workshop4 = analysis.workshops[4]?.data;
 const workshop5 = analysis.workshops[5]?.data;

 return {
 fearedEvents: (workshop1?.fearedEvents ?? []).map((fe: { name: string; description?: string; impactType: string; gravity: number }) => ({
 name: fe.name,
 description: fe.description,
 impactType: fe.impactType,
 gravity: fe.gravity
 })),
 riskSources: (workshop2?.selectedRiskSources ?? []).map((rs: SelectedRiskSource) => ({
 name: rs.riskSourceId,
 description: rs.relevanceJustification
 })),
 strategicScenarios: (workshop3?.strategicScenarios ?? []).map((ss: { name: string; description?: string; attackPath?: string; gravity?: number }) => ({
 name: ss.name,
 description: ss.description,
 attackPath: ss.attackPath ?? '',
 gravity: ss.gravity ?? 0
 })),
 operationalScenarios: (workshop4?.operationalScenarios ?? []).map((os: OperationalScenario) => ({
 name: os.name,
 description: os.description,
 likelihood: os.likelihood ?? 0,
 riskLevel: String(os.riskLevel ?? 0)
 })),
 treatmentPlan: (workshop5?.treatmentPlan ?? []).map((tp: { measure?: string; status?: string; controlId?: string; deadline?: string }) => ({
 measure: tp.measure ?? '',
 status: tp.status ?? 'pending',
 controlId: tp.controlId,
 deadline: tp.deadline
 }))
 };
}

// ============================================================================
// Export Service
// ============================================================================

export const HomologationService = {
 // Level calculation
 calculateLevelRecommendation,
 calculateTotalScore,
 getLevelFromScore,
 findEscalationLevel,
 getKeyFactors,
 generateJustification,
 processAnswer,

 // Document management
 getRequiredDocuments,
 initializeDocuments,

 // CRUD
 createDossier,
 getDossiers,
 getDossier,
 getDossiersByStatus,
 updateDossier,
 updateDossierStatus,
 updateDocumentStatus,
 deleteDossier,

 // Validation
 validateLevelOverride,
 areAllDocumentsCompleted,
 canSubmitForDecision,

 // Statistics
 getDossierStats,

 // Validity tracking (Story 38-3)
 calculateDaysUntilExpiration,
 getValidityState,
 getExpiringDossiers,
 getDossiersNeedingRenewal,
 initializeRenewal,
 getValidityStats,
 updateRenewalAlertDays,
 checkAndUpdateExpiredDossiers,

 // EBIOS Link Management (Story 38-4)
 createEbiosDataHash,
 countEbiosItems,
 createEbiosSnapshot,
 getEligibleEbiosAnalyses,
 linkEbiosAnalysis,
 unlinkEbiosAnalysis,
 checkEbiosChanges,
 syncEbiosData,
 markEbiosReviewRequired,
 getEbiosDataForDocument
};

export default HomologationService;
