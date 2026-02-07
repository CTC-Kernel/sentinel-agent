/**
 * AgentEvidenceService
 *
 * Service for managing agent evidence and linking to compliance controls.
 * Handles evidence collection, confidence calculation, and framework coverage.
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
 limit,
 serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { AgentResult } from '../types/agent';
import {
 AgentEvidence,
 AgentCheckId,
 ControlEvidenceSummary,
 FrameworkEvidenceCoverage,
 EvidenceCollectionStats,
 CheckControlMapping,
 DEFAULT_CHECK_CONTROL_MAPPINGS,
 AGENT_CHECK_DEFINITIONS,
 calculateConfidenceDecay,
} from '../types/agentEvidence';
import { RegulatoryFrameworkCode } from '../types/framework';

// Collection helpers
const getEvidenceCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'agentEvidence');

/**
 * Convert Firestore document to AgentEvidence
 */
function docToEvidence(docId: string, data: Record<string, unknown>): AgentEvidence {
 const verifiedAt = data.verifiedAt instanceof Timestamp
 ? data.verifiedAt.toDate().toISOString()
 : data.verifiedAt as string;

 const createdAt = data.createdAt instanceof Timestamp
 ? data.createdAt.toDate().toISOString()
 : data.createdAt as string;

 const expiresAt = data.expiresAt instanceof Timestamp
 ? data.expiresAt.toDate().toISOString()
 : data.expiresAt as string;

 // Recalculate confidence based on time decay
 const baseScore = data.status === 'pass' ? 100 : 0;
 const confidenceScore = calculateConfidenceDecay(verifiedAt, baseScore);

 return {
 id: docId,
 organizationId: data.organizationId as string,
 resultId: data.resultId as string,
 agentId: data.agentId as string,
 checkId: data.checkId as AgentCheckId,
 controlId: data.controlId as string,
 requirementId: data.requirementId as string | undefined,
 frameworkCode: data.frameworkCode as RegulatoryFrameworkCode,
 articleReference: data.articleReference as string,
 status: data.status as AgentEvidence['status'],
 confidenceScore,
 evidence: data.evidence as Record<string, unknown>,
 summary: data.summary as string,
 verifiedAt,
 createdAt,
 expiresAt,
 reviewed: data.reviewed as boolean || false,
 reviewedBy: data.reviewedBy as string | undefined,
 reviewedAt: data.reviewedAt instanceof Timestamp
 ? data.reviewedAt.toDate().toISOString()
 : data.reviewedAt as string | undefined,
 reviewNotes: data.reviewNotes as string | undefined,
 };
}

/**
 * Subscribe to evidence for a specific control
 */
export function subscribeToControlEvidence(
 organizationId: string,
 controlId: string,
 onEvidence: (evidence: AgentEvidence[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 const q = query(
 getEvidenceCollection(organizationId),
 where('controlId', '==', controlId),
 orderBy('verifiedAt', 'desc'),
 limit(50)
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const evidence = snapshot.docs.map(doc =>
 docToEvidence(doc.id, doc.data())
 );
 onEvidence(evidence);
 },
 (error) => {
 ErrorLogger.error(error, 'AgentEvidenceService.subscribeToControlEvidence', {
 component: 'AgentEvidenceService',
 action: 'subscribeToControlEvidence',
 organizationId,
 metadata: { controlId }
 });
 if (onError) onError(error);
 }
 );
 return unsubscribe;
}

/**
 * Subscribe to evidence for a specific agent
 */
export function subscribeToAgentEvidence(
 organizationId: string,
 agentId: string,
 onEvidence: (evidence: AgentEvidence[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 const q = query(
 getEvidenceCollection(organizationId),
 where('agentId', '==', agentId),
 orderBy('verifiedAt', 'desc'),
 limit(100)
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const evidence = snapshot.docs.map(doc =>
 docToEvidence(doc.id, doc.data())
 );
 onEvidence(evidence);
 },
 (error) => {
 ErrorLogger.error(error, 'AgentEvidenceService.subscribeToAgentEvidence', {
 component: 'AgentEvidenceService',
 action: 'subscribeToAgentEvidence',
 organizationId,
 metadata: { agentId }
 });
 if (onError) onError(error);
 }
 );
 return unsubscribe;
}

/**
 * Subscribe to evidence for a specific framework
 */
export function subscribeToFrameworkEvidence(
 organizationId: string,
 frameworkCode: RegulatoryFrameworkCode,
 onEvidence: (evidence: AgentEvidence[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 const q = query(
 getEvidenceCollection(organizationId),
 where('frameworkCode', '==', frameworkCode),
 orderBy('verifiedAt', 'desc'),
 limit(200)
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const evidence = snapshot.docs.map(doc =>
 docToEvidence(doc.id, doc.data())
 );
 onEvidence(evidence);
 },
 (error) => {
 ErrorLogger.error(error, 'AgentEvidenceService.subscribeToFrameworkEvidence', {
 component: 'AgentEvidenceService',
 action: 'subscribeToFrameworkEvidence',
 organizationId,
 metadata: { frameworkCode }
 });
 if (onError) onError(error);
 }
 );
 return unsubscribe;
}

/**
 * Get evidence summary for a control
 */
export async function getControlEvidenceSummary(
 organizationId: string,
 controlId: string,
 controlCode: string,
 controlName: string
): Promise<ControlEvidenceSummary> {
 try {
 const q = query(
 getEvidenceCollection(organizationId),
 where('controlId', '==', controlId),
 orderBy('verifiedAt', 'desc')
 );

 const snapshot = await getDocs(q);
 const evidence = snapshot.docs.map(doc => docToEvidence(doc.id, doc.data()));

 // Calculate stats
 const passingEvidence = evidence.filter(e => e.status === 'pass').length;
 const failingEvidence = evidence.filter(e => e.status === 'fail').length;
 const averageConfidence = evidence.length > 0
 ? Math.round(evidence.reduce((sum, e) => sum + e.confidenceScore, 0) / evidence.length)
 : 0;
 const lastVerified = evidence.length > 0 ? evidence[0].verifiedAt : null;
 const agentIds = [...new Set(evidence.map(e => e.agentId))];

 // Group by check type
 const checkGroups = new Map<AgentCheckId, { status: 'pass' | 'fail' | 'mixed'; count: number; lastVerified: string }>();
 for (const e of evidence) {
 const existing = checkGroups.get(e.checkId);
 if (!existing) {
 checkGroups.set(e.checkId, {
  status: e.status === 'pass' ? 'pass' : 'fail',
  count: 1,
  lastVerified: e.verifiedAt
 });
 } else {
 existing.count++;
 if (existing.status !== 'mixed' && existing.status !== e.status) {
  existing.status = 'mixed';
 }
 if (e.verifiedAt > existing.lastVerified) {
  existing.lastVerified = e.verifiedAt;
 }
 }
 }

 // Determine compliance status
 let complianceStatus: ControlEvidenceSummary['complianceStatus'] = 'pending';
 if (evidence.length > 0) {
 if (failingEvidence === 0 && averageConfidence >= 70) {
 complianceStatus = 'verified';
 } else if (passingEvidence > failingEvidence) {
 complianceStatus = 'partial';
 } else {
 complianceStatus = 'non_compliant';
 }
 }

 return {
 controlId,
 controlCode,
 controlName,
 totalEvidence: evidence.length,
 passingEvidence,
 failingEvidence,
 averageConfidence,
 lastVerified,
 agentIds,
 evidenceByCheck: Array.from(checkGroups.entries()).map(([checkId, data]) => ({
 checkId,
 ...data
 })),
 complianceStatus,
 };
 } catch (error) {
 ErrorLogger.error(error as Error, 'AgentEvidenceService.getControlEvidenceSummary', {
 component: 'AgentEvidenceService',
 action: 'getControlEvidenceSummary',
 organizationId,
 metadata: { controlId }
 });
 throw error;
 }
}

/**
 * Get framework evidence coverage
 */
export async function getFrameworkEvidenceCoverage(
 organizationId: string,
 frameworkCode: RegulatoryFrameworkCode
): Promise<FrameworkEvidenceCoverage> {
 try {
 const q = query(
 getEvidenceCollection(organizationId),
 where('frameworkCode', '==', frameworkCode),
 limit(5000)
 );

 const snapshot = await getDocs(q);
 const evidence = snapshot.docs.map(doc => docToEvidence(doc.id, doc.data()));

 // Get unique requirements covered
 const coveredRequirements = new Set(evidence.map(e => e.requirementId).filter(Boolean));

 // Get total requirements from mappings
 const frameworkMappings = DEFAULT_CHECK_CONTROL_MAPPINGS.filter(
 m => m.frameworkCode === frameworkCode
 );
 const totalRequirements = new Set(frameworkMappings.map(m => m.requirementId)).size;

 // Calculate coverage
 const coveragePercent = totalRequirements > 0
 ? Math.round((coveredRequirements.size / totalRequirements) * 100)
 : 0;

 // Count by status
 const requirementStatuses = new Map<string, 'verified' | 'partial' | 'non_compliant' | 'pending'>();
 for (const e of evidence) {
 if (!e.requirementId) continue;
 const current = requirementStatuses.get(e.requirementId);
 if (!current) {
 requirementStatuses.set(e.requirementId, e.status === 'pass' ? 'verified' : 'non_compliant');
 } else if (current !== 'partial') {
 const newStatus = e.status === 'pass' ? 'verified' : 'non_compliant';
 if (current !== newStatus) {
  requirementStatuses.set(e.requirementId, 'partial');
 }
 }
 }

 const requirementsByStatus = {
 verified: 0,
 partial: 0,
 non_compliant: 0,
 pending: totalRequirements - coveredRequirements.size,
 };
 for (const status of requirementStatuses.values()) {
 requirementsByStatus[status]++;
 }

 // Average confidence
 const averageConfidence = evidence.length > 0
 ? Math.round(evidence.reduce((sum, e) => sum + e.confidenceScore, 0) / evidence.length)
 : 0;

 // Last updated
 const sortedEvidence = [...evidence].sort((a, b) =>
 new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
 );
 const lastUpdated = sortedEvidence.length > 0
 ? sortedEvidence[0].verifiedAt
 : new Date().toISOString();

 // Framework name mapping (only valid RegulatoryFrameworkCode values)
 const frameworkNames: Record<RegulatoryFrameworkCode, string> = {
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

 return {
 frameworkCode,
 frameworkName: frameworkNames[frameworkCode] || frameworkCode,
 totalRequirements,
 coveredRequirements: coveredRequirements.size,
 coveragePercent,
 requirementsByStatus,
 averageConfidence,
 lastUpdated,
 };
 } catch (error) {
 ErrorLogger.error(error as Error, 'AgentEvidenceService.getFrameworkEvidenceCoverage', {
 component: 'AgentEvidenceService',
 action: 'getFrameworkEvidenceCoverage',
 organizationId,
 metadata: { frameworkCode }
 });
 throw error;
 }
}

/**
 * Get evidence collection statistics
 */
export async function getEvidenceStats(
 organizationId: string
): Promise<EvidenceCollectionStats> {
 try {
 const q = query(getEvidenceCollection(organizationId), limit(5000));
 const snapshot = await getDocs(q);
 const evidence = snapshot.docs.map(doc => docToEvidence(doc.id, doc.data()));

 const now = new Date();
 const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
 const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

 const last24h = evidence.filter(e => new Date(e.createdAt) >= oneDayAgo).length;
 const last7d = evidence.filter(e => new Date(e.createdAt) >= sevenDaysAgo).length;

 const activeAgents = new Set(evidence.map(e => e.agentId)).size;
 const controlsCovered = new Set(evidence.map(e => e.controlId)).size;
 const frameworksCovered = new Set(evidence.map(e => e.frameworkCode)).size;

 const averageConfidence = evidence.length > 0
 ? Math.round(evidence.reduce((sum, e) => sum + e.confidenceScore, 0) / evidence.length)
 : 0;

 const pendingReview = evidence.filter(e => !e.reviewed).length;
 const expiredEvidence = evidence.filter(e => new Date(e.expiresAt) < now).length;

 return {
 totalEvidence: evidence.length,
 last24h,
 last7d,
 activeAgents,
 controlsCovered,
 frameworksCovered,
 averageConfidence,
 pendingReview,
 expiredEvidence,
 };
 } catch (error) {
 ErrorLogger.error(error as Error, 'AgentEvidenceService.getEvidenceStats', {
 component: 'AgentEvidenceService',
 action: 'getEvidenceStats',
 organizationId
 });
 throw error;
 }
}

/**
 * Create evidence from agent result
 * Called when a new agent check result is received
 */
export async function createEvidenceFromResult(
 organizationId: string,
 agentId: string,
 result: AgentResult,
 controlId: string
): Promise<AgentEvidence[]> {
 try {
 const checkId = result.checkId as AgentCheckId;
 const checkDef = AGENT_CHECK_DEFINITIONS[checkId];

 if (!checkDef) {
 ErrorLogger.warn(`Unknown check ID: ${checkId}`, 'AgentEvidenceService.createEvidenceFromResult');
 return [];
 }

 // Find all mappings for this check
 const mappings = DEFAULT_CHECK_CONTROL_MAPPINGS.filter(m => m.checkId === checkId);

 if (mappings.length === 0) {
 ErrorLogger.warn(`No framework mappings for check: ${checkId}`, 'AgentEvidenceService.createEvidenceFromResult');
 return [];
 }

 const createdEvidence: AgentEvidence[] = [];
 const now = new Date().toISOString();
 const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

 for (const mapping of mappings) {
 // Store as Timestamps in Firestore, return ISO strings to caller
 const evidenceData = {
 organizationId,
 resultId: result.id,
 agentId,
 checkId,
 controlId,
 requirementId: mapping.requirementId,
 frameworkCode: mapping.frameworkCode,
 articleReference: mapping.articleReference,
 status: result.status,
 confidenceScore: result.status === 'pass' ? 100 : 0,
 evidence: result.evidence,
 summary: `${checkDef.name}: ${result.status === 'pass' ? 'Conforme' : 'Non conforme'}`,
 verifiedAt: Timestamp.fromDate(new Date(result.timestamp)),
 createdAt: serverTimestamp(),
 expiresAt: Timestamp.fromDate(new Date(expiresAt)),
 reviewed: false,
 };

 const docRef = await addDoc(getEvidenceCollection(organizationId), sanitizeData(evidenceData));

 createdEvidence.push({
 ...evidenceData,
 id: docRef.id,
 verifiedAt: result.timestamp,
 createdAt: now,
 expiresAt: expiresAt,
 } as AgentEvidence);
 }

 return createdEvidence;
 } catch (error) {
 ErrorLogger.error(error as Error, 'AgentEvidenceService.createEvidenceFromResult', {
 component: 'AgentEvidenceService',
 action: 'createEvidenceFromResult',
 organizationId,
 metadata: { agentId, resultId: result.id }
 });
 throw error;
 }
}

/**
 * Mark evidence as reviewed
 */
export async function reviewEvidence(
 organizationId: string,
 evidenceId: string,
 reviewedBy: string,
 notes?: string
): Promise<void> {
 try {
 const evidenceRef = doc(getEvidenceCollection(organizationId), evidenceId);

 await updateDoc(evidenceRef, sanitizeData({
 reviewed: true,
 reviewedBy,
 reviewedAt: serverTimestamp(),
 reviewNotes: notes || null,
 }));
 } catch (error) {
 ErrorLogger.error(error as Error, 'AgentEvidenceService.reviewEvidence', {
 component: 'AgentEvidenceService',
 action: 'reviewEvidence',
 organizationId,
 metadata: { evidenceId }
 });
 throw error;
 }
}

/**
 * Get check-to-control mappings for a framework
 */
export function getCheckMappingsForFramework(
 frameworkCode: RegulatoryFrameworkCode
): CheckControlMapping[] {
 return DEFAULT_CHECK_CONTROL_MAPPINGS.filter(m => m.frameworkCode === frameworkCode);
}

/**
 * Get check-to-control mappings for a check
 */
export function getCheckMappingsForCheck(
 checkId: AgentCheckId
): CheckControlMapping[] {
 return DEFAULT_CHECK_CONTROL_MAPPINGS.filter(m => m.checkId === checkId);
}

// Export as service object for consistency
export const AgentEvidenceService = {
 subscribeToControlEvidence,
 subscribeToAgentEvidence,
 subscribeToFrameworkEvidence,
 getControlEvidenceSummary,
 getFrameworkEvidenceCoverage,
 getEvidenceStats,
 createEvidenceFromResult,
 reviewEvidence,
 getCheckMappingsForFramework,
 getCheckMappingsForCheck,
};
