/**
 * AutoPopulationService
 *
 * Service for auto-populating compliance questionnaires from agent evidence.
 * Generates suggestions, manages sessions, and calculates coverage.
 */

import {
 collection,
 doc,
 onSnapshot,
 query,
 where,
 orderBy,
 getDocs,
 addDoc,
 updateDoc,
 Timestamp,
 Unsubscribe,
 writeBatch,
 serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '@/utils/dataSanitizer';
import { RegulatoryFrameworkCode } from '../types/framework';
import {
 PopulationSuggestion,
 PopulationSession,
 FrameworkPopulationSummary,
 PopulationStats,
 CrossFrameworkEntry,
 SuggestionStatus,
 getConfidenceLevel,
 getSuggestedStatus,
 calculateSuggestedScore,
} from '../types/autoPopulation';
import {
 AgentEvidence,
 DEFAULT_CHECK_CONTROL_MAPPINGS,
 AGENT_CHECK_DEFINITIONS,
 AgentCheckId,
} from '../types/agentEvidence';
import { AgentEvidenceService } from './AgentEvidenceService';

// Collection helpers
const getSessionsCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'populationSessions');

const getSuggestionsCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'populationSuggestions');

// Framework names mapping
const FRAMEWORK_NAMES: Record<RegulatoryFrameworkCode, string> = {
 NIS2: 'NIS 2',
 DORA: 'DORA',
 ISO27001: 'ISO 27001',
 ISO22301: 'ISO 22301',
 SOC2: 'SOC 2',
 RGPD: 'RGPD',
 AI_ACT: 'AI Act',
 HDS: 'HDS',
 PCI_DSS: 'PCI DSS',
 NIST_CSF: 'NIST CSF',
 SECNUMCLOUD: 'SecNumCloud',
};

/**
 * Convert Firestore document to PopulationSession
 */
function docToSession(docId: string, data: Record<string, unknown>): PopulationSession {
 return {
 id: docId,
 organizationId: data.organizationId as string,
 frameworkCode: data.frameworkCode as RegulatoryFrameworkCode,
 frameworkName: data.frameworkName as string,
 status: data.status as PopulationSession['status'],
 totalRequirements: data.totalRequirements as number,
 suggestedRequirements: data.suggestedRequirements as number,
 populationPercent: data.populationPercent as number,
 suggestionsByStatus: data.suggestionsByStatus as PopulationSession['suggestionsByStatus'],
 averageConfidence: data.averageConfidence as number,
 agentCount: data.agentCount as number,
 createdBy: data.createdBy as string,
 createdAt: data.createdAt instanceof Timestamp
 ? data.createdAt.toDate().toISOString()
 : data.createdAt as string,
 completedAt: data.completedAt instanceof Timestamp
 ? data.completedAt.toDate().toISOString()
 : data.completedAt as string | undefined,
 completedBy: data.completedBy as string | undefined,
 initialScore: data.initialScore as number,
 finalScore: data.finalScore as number | undefined,
 scoreImprovement: data.scoreImprovement as number | undefined,
 };
}

/**
 * Convert Firestore document to PopulationSuggestion
 */
function docToSuggestion(docId: string, data: Record<string, unknown>): PopulationSuggestion {
 return {
 id: docId,
 organizationId: data.organizationId as string,
 sessionId: data.sessionId as string,
 frameworkCode: data.frameworkCode as RegulatoryFrameworkCode,
 requirementId: data.requirementId as string,
 requirementReference: data.requirementReference as string,
 requirementText: data.requirementText as string,
 controlId: data.controlId as string | undefined,
 suggestedStatus: data.suggestedStatus as PopulationSuggestion['suggestedStatus'],
 suggestedScore: data.suggestedScore as number,
 suggestedAnswer: data.suggestedAnswer as string,
 confidenceScore: data.confidenceScore as number,
 confidenceLevel: data.confidenceLevel as PopulationSuggestion['confidenceLevel'],
 sourceCheckIds: data.sourceCheckIds as AgentCheckId[],
 evidenceIds: data.evidenceIds as string[],
 agentCount: data.agentCount as number,
 lastVerified: data.lastVerified as string,
 status: data.status as SuggestionStatus,
 reviewedBy: data.reviewedBy as string | undefined,
 reviewedAt: data.reviewedAt instanceof Timestamp
 ? data.reviewedAt.toDate().toISOString()
 : data.reviewedAt as string | undefined,
 modifiedAnswer: data.modifiedAnswer as string | undefined,
 modifiedStatus: data.modifiedStatus as PopulationSuggestion['modifiedStatus'],
 reviewNotes: data.reviewNotes as string | undefined,
 createdAt: data.createdAt instanceof Timestamp
 ? data.createdAt.toDate().toISOString()
 : data.createdAt as string,
 };
}

/**
 * Subscribe to population sessions
 */
export function subscribeToSessions(
 organizationId: string,
 onSessions: (sessions: PopulationSession[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 const q = query(
 getSessionsCollection(organizationId),
 orderBy('createdAt', 'desc')
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const sessions = snapshot.docs.map(doc =>
 docToSession(doc.id, doc.data())
 );
 onSessions(sessions);
 },
 (error) => {
 ErrorLogger.error(error, 'AutoPopulationService.subscribeToSessions', {
 component: 'AutoPopulationService',
 action: 'subscribeToSessions',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
 return unsubscribe;
}

/**
 * Subscribe to suggestions for a session
 */
export function subscribeToSessionSuggestions(
 organizationId: string,
 sessionId: string,
 onSuggestions: (suggestions: PopulationSuggestion[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 const q = query(
 getSuggestionsCollection(organizationId),
 where('sessionId', '==', sessionId),
 orderBy('confidenceScore', 'desc')
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const suggestions = snapshot.docs.map(doc =>
 docToSuggestion(doc.id, doc.data())
 );
 onSuggestions(suggestions);
 },
 (error) => {
 ErrorLogger.error(error, 'AutoPopulationService.subscribeToSessionSuggestions', {
 component: 'AutoPopulationService',
 action: 'subscribeToSessionSuggestions',
 organizationId,
 metadata: { sessionId }
 });
 if (onError) onError(error);
 }
 );
 return unsubscribe;
}

/**
 * Get framework population summary
 */
export async function getFrameworkPopulationSummary(
 organizationId: string,
 frameworkCode: RegulatoryFrameworkCode
): Promise<FrameworkPopulationSummary> {
 try {
 // Get evidence coverage for this framework
 const coverage = await AgentEvidenceService.getFrameworkEvidenceCoverage(
 organizationId,
 frameworkCode
 );

 // Get latest session for this framework
 const sessionsQuery = query(
 getSessionsCollection(organizationId),
 where('frameworkCode', '==', frameworkCode),
 orderBy('createdAt', 'desc')
 );
 const sessionsSnapshot = await getDocs(sessionsQuery);
 const latestSession = sessionsSnapshot.docs.length > 0
 ? docToSession(sessionsSnapshot.docs[0].id, sessionsSnapshot.docs[0].data())
 : undefined;

 // Calculate potential score
 const potentialScore = Math.min(
 100,
 coverage.coveragePercent * (coverage.averageConfidence / 100)
 );

 return {
 frameworkCode,
 frameworkName: FRAMEWORK_NAMES[frameworkCode] || frameworkCode,
 totalRequirements: coverage.totalRequirements,
 agentCoveredRequirements: coverage.coveredRequirements,
 coveragePercent: coverage.coveragePercent,
 requirementsByStatus: {
 verified: coverage.requirementsByStatus.verified,
 partial: coverage.requirementsByStatus.partial,
 notCovered: coverage.requirementsByStatus.pending + coverage.requirementsByStatus.non_compliant,
 },
 averageConfidence: coverage.averageConfidence,
 potentialScore: Math.round(potentialScore),
 activeAgents: 0, // Would need to query agents
 lastSession: latestSession ? {
 id: latestSession.id,
 createdAt: latestSession.createdAt,
 status: latestSession.status,
 populationPercent: latestSession.populationPercent,
 } : undefined,
 };
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.getFrameworkPopulationSummary', {
 component: 'AutoPopulationService',
 action: 'getFrameworkPopulationSummary',
 organizationId,
 metadata: { frameworkCode }
 });
 throw error;
 }
}

/**
 * Create a new population session
 */
export async function createPopulationSession(
 organizationId: string,
 frameworkCode: RegulatoryFrameworkCode,
 userId: string,
 initialScore: number = 0
): Promise<PopulationSession> {
 try {
 // Get framework mappings
 const mappings = DEFAULT_CHECK_CONTROL_MAPPINGS.filter(
 m => m.frameworkCode === frameworkCode
 );
 const totalRequirements = new Set(mappings.map(m => m.requirementId)).size;

 const sessionData = {
 organizationId,
 frameworkCode,
 frameworkName: FRAMEWORK_NAMES[frameworkCode] || frameworkCode,
 status: 'in_progress',
 totalRequirements,
 suggestedRequirements: 0,
 populationPercent: 0,
 suggestionsByStatus: {
 pending: 0,
 approved: 0,
 rejected: 0,
 modified: 0,
 expired: 0,
 },
 averageConfidence: 0,
 agentCount: 0,
 createdBy: userId,
 createdAt: serverTimestamp(),
 initialScore,
 };

 const docRef = await addDoc(getSessionsCollection(organizationId), sanitizeData(sessionData));

 const session: PopulationSession = {
 id: docRef.id,
 organizationId,
 frameworkCode,
 frameworkName: FRAMEWORK_NAMES[frameworkCode] || frameworkCode,
 status: 'in_progress',
 totalRequirements,
 suggestedRequirements: 0,
 populationPercent: 0,
 suggestionsByStatus: {
 pending: 0,
 approved: 0,
 rejected: 0,
 modified: 0,
 expired: 0,
 },
 averageConfidence: 0,
 agentCount: 0,
 createdBy: userId,
 createdAt: new Date(Date.now()).toISOString(),
 initialScore,
 };

 // Generate suggestions for this session
 await generateSuggestionsForSession(organizationId, session);

 return session;
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.createPopulationSession', {
 component: 'AutoPopulationService',
 action: 'createPopulationSession',
 organizationId,
 metadata: { frameworkCode, userId }
 });
 throw error;
 }
}

/**
 * Generate suggestions for a session based on agent evidence
 */
async function generateSuggestionsForSession(
 organizationId: string,
 session: PopulationSession
): Promise<void> {
 try {
 // Get all evidence for this framework
 const evidenceQuery = query(
 collection(db, 'organizations', organizationId, 'agentEvidence'),
 where('frameworkCode', '==', session.frameworkCode)
 );
 const evidenceSnapshot = await getDocs(evidenceQuery);
 const evidence = evidenceSnapshot.docs.map(doc => ({
 id: doc.id,
 ...doc.data()
 })) as AgentEvidence[];

 // Group evidence by requirement
 const evidenceByRequirement = new Map<string, AgentEvidence[]>();
 for (const e of evidence) {
 if (!e.requirementId) continue;
 const existing = evidenceByRequirement.get(e.requirementId) || [];
 evidenceByRequirement.set(e.requirementId, [...existing, e]);
 }

 // Get mappings for this framework
 const mappings = DEFAULT_CHECK_CONTROL_MAPPINGS.filter(
 m => m.frameworkCode === session.frameworkCode
 );

 // Create suggestions - use batch chunking to respect 500 op limit
 const BATCH_LIMIT = 450;
 let batch = writeBatch(db);
 let batchCount = 0;
 const suggestions: PopulationSuggestion[] = [];
 let totalConfidence = 0;
 const agentIds = new Set<string>();

 for (const [requirementId, reqEvidence] of evidenceByRequirement.entries()) {
 const mapping = mappings.find(m => m.requirementId === requirementId);
 if (!mapping) continue;

 // Aggregate evidence status
 const passCount = reqEvidence.filter(e => e.status === 'pass').length;
 const failCount = reqEvidence.filter(e => e.status === 'fail').length;
 const evidenceStatus: 'pass' | 'fail' | 'mixed' =
 failCount === 0 ? 'pass' :
 passCount === 0 ? 'fail' : 'mixed';

 // Calculate average confidence
 const avgConfidence = Math.round(
 reqEvidence.reduce((sum, e) => sum + e.confidenceScore, 0) / reqEvidence.length
 );

 // Get unique checks and agents
 const checkIds = [...new Set(reqEvidence.map(e => e.checkId))];
 const reqAgentIds = [...new Set(reqEvidence.map(e => e.agentId))];
 reqAgentIds.forEach(id => agentIds.add(id));

 // Get latest verification
 const sortedEvidence = [...reqEvidence].sort(
 (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
 );
 const lastVerified = sortedEvidence[0].verifiedAt;

 // Check if evidence is expired (>30 days old)
 const isExpired = new Date(lastVerified).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000;

 // Generate suggestion
 const checkDef = AGENT_CHECK_DEFINITIONS[checkIds[0]];
 const suggestedStatus = getSuggestedStatus(evidenceStatus, avgConfidence);
 const suggestedScore = calculateSuggestedScore(evidenceStatus, avgConfidence, mapping.weight);

 const suggestion: Omit<PopulationSuggestion, 'id'> = {
 organizationId,
 sessionId: session.id,
 frameworkCode: session.frameworkCode,
 requirementId,
 requirementReference: mapping.articleReference,
 requirementText: `Exigence ${mapping.articleReference}`, // Would need real requirement text
 controlId: undefined,
 suggestedStatus,
 suggestedScore,
 suggestedAnswer: generateSuggestionText(checkDef?.name || checkIds[0], evidenceStatus, avgConfidence, reqAgentIds.length),
 confidenceScore: avgConfidence,
 confidenceLevel: getConfidenceLevel(avgConfidence),
 sourceCheckIds: checkIds,
 evidenceIds: reqEvidence.map(e => e.id),
 agentCount: reqAgentIds.length,
 lastVerified,
 status: isExpired ? 'expired' : 'pending',
 createdAt: new Date(Date.now()).toISOString(),
 };

 const suggestionRef = doc(getSuggestionsCollection(organizationId));
 batch.set(suggestionRef, sanitizeData({
 ...suggestion,
 createdAt: serverTimestamp(),
 }));
 batchCount++;

 if (batchCount >= BATCH_LIMIT) {
   await batch.commit();
   batch = writeBatch(db);
   batchCount = 0;
 }

 suggestions.push({ ...suggestion, id: suggestionRef.id });
 totalConfidence += avgConfidence;
 }

 // Update session with suggestion stats
 const sessionRef = doc(getSessionsCollection(organizationId), session.id);
 const pendingCount = suggestions.filter(s => s.status === 'pending').length;
 const expiredCount = suggestions.filter(s => s.status === 'expired').length;

 batch.update(sessionRef, sanitizeData({
 suggestedRequirements: suggestions.length,
 populationPercent: session.totalRequirements > 0
 ? Math.round((suggestions.length / session.totalRequirements) * 100)
 : 0,
 suggestionsByStatus: {
 pending: pendingCount,
 approved: 0,
 rejected: 0,
 modified: 0,
 expired: expiredCount,
 },
 averageConfidence: suggestions.length > 0
 ? Math.round(totalConfidence / suggestions.length)
 : 0,
 agentCount: agentIds.size,
 }));

 await batch.commit();
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.generateSuggestionsForSession', {
 component: 'AutoPopulationService',
 action: 'generateSuggestionsForSession',
 organizationId,
 metadata: { sessionId: session.id }
 });
 throw error;
 }
}

/**
 * Generate human-readable suggestion text
 */
function generateSuggestionText(
 checkName: string,
 status: 'pass' | 'fail' | 'mixed',
 confidence: number,
 agentCount: number
): string {
 const agentText = agentCount === 1 ? '1 agent' : `${agentCount} agents`;

 if (status === 'pass') {
 return `Vérifié automatiquement via ${checkName}. ${agentText} en conformité avec un niveau de confiance de ${confidence}%.`;
 }
 if (status === 'fail') {
 return `Non conforme - ${checkName} en échec sur ${agentText}. Action corrective recommandée.`;
 }
 return `Conformité partielle - ${checkName} avec résultats mixtes sur ${agentText}. Vérification manuelle recommandée.`;
}

/**
 * Update suggestion status (approve/reject/modify)
 */
export async function updateSuggestionStatus(
 organizationId: string,
 suggestionId: string,
 status: SuggestionStatus,
 userId: string,
 options?: {
 modifiedAnswer?: string;
 modifiedStatus?: PopulationSuggestion['modifiedStatus'];
 reviewNotes?: string;
 }
): Promise<void> {
 try {
 const suggestionRef = doc(getSuggestionsCollection(organizationId), suggestionId);

 await updateDoc(suggestionRef, sanitizeData({
 status,
 reviewedBy: userId,
 reviewedAt: serverTimestamp(),
 ...(options?.modifiedAnswer && { modifiedAnswer: options.modifiedAnswer }),
 ...(options?.modifiedStatus && { modifiedStatus: options.modifiedStatus }),
 ...(options?.reviewNotes && { reviewNotes: options.reviewNotes }),
 }));
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.updateSuggestionStatus', {
 component: 'AutoPopulationService',
 action: 'updateSuggestionStatus',
 organizationId,
 metadata: { suggestionId, status }
 });
 throw error;
 }
}

/**
 * Complete a population session
 */
export async function completeSession(
 organizationId: string,
 sessionId: string,
 userId: string,
 finalScore: number
): Promise<void> {
 try {
 // Get session to calculate improvement
 const sessionsQuery = query(
 getSessionsCollection(organizationId),
 where('__name__', '==', sessionId)
 );
 const sessionSnapshot = await getDocs(sessionsQuery);

 if (sessionSnapshot.empty) {
 throw new Error('Session not found');
 }

 const session = docToSession(sessionSnapshot.docs[0].id, sessionSnapshot.docs[0].data());
 const scoreImprovement = finalScore - session.initialScore;

 // Update suggestions count by status
 const suggestionsQuery = query(
 getSuggestionsCollection(organizationId),
 where('sessionId', '==', sessionId)
 );
 const suggestionsSnapshot = await getDocs(suggestionsQuery);

 const suggestionsByStatus = {
 pending: 0,
 approved: 0,
 rejected: 0,
 modified: 0,
 expired: 0,
 };

 suggestionsSnapshot.docs.forEach(doc => {
 const status = doc.data().status as SuggestionStatus;
 suggestionsByStatus[status]++;
 });

 // Update session
 const sessionRef = doc(getSessionsCollection(organizationId), sessionId);
 await updateDoc(sessionRef, sanitizeData({
 status: 'completed',
 completedAt: serverTimestamp(),
 completedBy: userId,
 finalScore,
 scoreImprovement,
 suggestionsByStatus,
 }));
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.completeSession', {
 component: 'AutoPopulationService',
 action: 'completeSession',
 organizationId,
 metadata: { sessionId }
 });
 throw error;
 }
}

/**
 * Get cross-framework matrix entries
 */
export async function getCrossFrameworkMatrix(
 organizationId: string
): Promise<CrossFrameworkEntry[]> {
 try {
 // Get all evidence
 const evidenceQuery = query(
 collection(db, 'organizations', organizationId, 'agentEvidence')
 );
 const evidenceSnapshot = await getDocs(evidenceQuery);
 const evidence = evidenceSnapshot.docs.map(doc => ({
 id: doc.id,
 ...doc.data()
 })) as AgentEvidence[];

 // Group evidence by check
 const evidenceByCheck = new Map<AgentCheckId, AgentEvidence[]>();
 for (const e of evidence) {
 const existing = evidenceByCheck.get(e.checkId) || [];
 evidenceByCheck.set(e.checkId, [...existing, e]);
 }

 // Build matrix entries
 const entries: CrossFrameworkEntry[] = [];

 for (const [checkId, checkEvidence] of evidenceByCheck.entries()) {
 const checkDef = AGENT_CHECK_DEFINITIONS[checkId];
 const mappings = DEFAULT_CHECK_CONTROL_MAPPINGS.filter(m => m.checkId === checkId);

 // Group evidence by framework
 const evidenceByFramework = new Map<RegulatoryFrameworkCode, AgentEvidence[]>();
 for (const e of checkEvidence) {
 const existing = evidenceByFramework.get(e.frameworkCode) || [];
 evidenceByFramework.set(e.frameworkCode, [...existing, e]);
 }

 // Build framework mappings
 const frameworkMappings = mappings.map(mapping => {
 const fwEvidence = evidenceByFramework.get(mapping.frameworkCode) || [];
 const hasEvidence = fwEvidence.length > 0;

 let evidenceStatus: 'pass' | 'fail' | 'mixed' | undefined;
 let lastVerified: string | undefined;

 if (hasEvidence) {
  const passCount = fwEvidence.filter(e => e.status === 'pass').length;
  const failCount = fwEvidence.filter(e => e.status === 'fail').length;
  evidenceStatus = failCount === 0 ? 'pass' : passCount === 0 ? 'fail' : 'mixed';

  const sorted = [...fwEvidence].sort(
  (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
  );
  lastVerified = sorted[0].verifiedAt;
 }

 return {
  frameworkCode: mapping.frameworkCode,
  frameworkName: FRAMEWORK_NAMES[mapping.frameworkCode] || mapping.frameworkCode,
  requirementId: mapping.requirementId,
  requirementReference: mapping.articleReference,
  coverageType: mapping.coverageType,
  weight: mapping.weight,
  hasEvidence,
  evidenceStatus,
  lastVerified,
 };
 });

 // Determine overall status
 const hasAnyEvidence = frameworkMappings.some(m => m.hasEvidence);
 const allPassing = frameworkMappings.every(m => !m.hasEvidence || m.evidenceStatus === 'pass');
 const overallStatus: CrossFrameworkEntry['overallStatus'] =
 !hasAnyEvidence ? 'missing' :
 allPassing ? 'verified' : 'partial';

 entries.push({
 checkId,
 checkName: checkDef?.name || checkId,
 checkCategory: checkDef?.category || 'unknown',
 frameworkMappings,
 overallStatus,
 });
 }

 return entries;
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.getCrossFrameworkMatrix', {
 component: 'AutoPopulationService',
 action: 'getCrossFrameworkMatrix',
 organizationId,
 });
 throw error;
 }
}

/**
 * Get population statistics
 */
export async function getPopulationStats(
 organizationId: string
): Promise<PopulationStats> {
 try {
 // Get all sessions
 const sessionsQuery = query(getSessionsCollection(organizationId));
 const sessionsSnapshot = await getDocs(sessionsQuery);
 const sessions = sessionsSnapshot.docs.map(doc =>
 docToSession(doc.id, doc.data())
 );

 // Get all suggestions
 const suggestionsQuery = query(getSuggestionsCollection(organizationId));
 const suggestionsSnapshot = await getDocs(suggestionsQuery);

 // Calculate stats
 const now = new Date();
 const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

 const sessionsThisMonth = sessions.filter(
 s => new Date(s.createdAt) >= monthAgo
 ).length;

 const completedSessions = sessions.filter(s => s.status === 'completed');
 const averagePopulationRate = completedSessions.length > 0
 ? Math.round(
 completedSessions.reduce((sum, s) => sum + s.populationPercent, 0) /
 completedSessions.length
 )
 : 0;

 const totalSuggestions = suggestionsSnapshot.size;
 const suggestionsApproved = suggestionsSnapshot.docs.filter(
 doc => doc.data().status === 'approved'
 ).length;

 const approvalRate = totalSuggestions > 0
 ? Math.round((suggestionsApproved / totalSuggestions) * 100)
 : 0;

 const averageScoreImprovement = completedSessions.length > 0
 ? Math.round(
 completedSessions.reduce((sum, s) => sum + (s.scoreImprovement || 0), 0) /
 completedSessions.length
 )
 : 0;

 const frameworksCovered = new Set(sessions.map(s => s.frameworkCode)).size;

 // Estimate time saved (5 minutes per suggestion)
 const timeSavedHours = Math.round((suggestionsApproved * 5) / 60);

 return {
 totalSessions: sessions.length,
 sessionsThisMonth,
 averagePopulationRate,
 totalSuggestions,
 suggestionsApproved,
 approvalRate,
 averageScoreImprovement,
 frameworksCovered,
 timeSavedHours,
 };
 } catch (error) {
 ErrorLogger.error(error as Error, 'AutoPopulationService.getPopulationStats', {
 component: 'AutoPopulationService',
 action: 'getPopulationStats',
 organizationId,
 });
 throw error;
 }
}

// Export as service object
export const AutoPopulationService = {
 subscribeToSessions,
 subscribeToSessionSuggestions,
 getFrameworkPopulationSummary,
 createPopulationSession,
 updateSuggestionStatus,
 completeSession,
 getCrossFrameworkMatrix,
 getPopulationStats,
};
