/**
 * AgentAnomalyService
 *
 * Service for agent behavioral anomaly detection, baseline management,
 * threshold configuration, and alert handling.
 *
 * Sprint 8 - Anomaly Detection
 */

import {
 collection,
 doc,
 onSnapshot,
 query,
 where,
 orderBy,
 getDocs,
 updateDoc,
 Unsubscribe,
 limit,
 writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
 DetectedAnomaly,
 AnomalyType,
 AnomalySeverity,
 AnomalyStatus,
 AgentBaseline,
 MetricBaseline,
 BaselineMetric,
 BaselineWindow,
 AnomalyThresholdConfig,
 AnomalyStats,
 AnomalyTimelineEntry,
} from '../types/anomalyDetection';

// ============================================================================
// Collection Helpers
// ============================================================================

const getAnomaliesCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'agentAnomalies');

const getBaselinesCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'agentBaselines');

const getThresholdsCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'anomalyThresholds');

const getAnomalyStatsDoc = (organizationId: string) =>
 doc(db, 'organizations', organizationId, 'stats', 'agentAnomalies');

// ============================================================================
// Anomaly Subscriptions
// ============================================================================

/**
 * Subscribe to detected anomalies
 */
export function subscribeToAgentAnomalies(
 organizationId: string,
 onAnomalies: (anomalies: DetectedAnomaly[]) => void,
 onError?: (error: Error) => void,
 filters?: {
 status?: AnomalyStatus[];
 severity?: AnomalySeverity[];
 type?: AnomalyType[];
 agentId?: string;
 limit?: number;
 }
): Unsubscribe {
 let q = query(
 getAnomaliesCollection(organizationId),
 orderBy('detectedAt', 'desc')
 );

 if (filters?.agentId) {
 q = query(q, where('agentId', '==', filters.agentId));
 }

 if (filters?.limit) {
 q = query(q, limit(filters.limit));
 }

 return onSnapshot(
 q,
 (snapshot) => {
 let anomalies = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as DetectedAnomaly));

 // Client-side filtering for complex queries
 if (filters?.status?.length) {
 anomalies = anomalies.filter(a => filters.status!.includes(a.status));
 }
 if (filters?.severity?.length) {
 anomalies = anomalies.filter(a => filters.severity!.includes(a.severity));
 }
 if (filters?.type?.length) {
 anomalies = anomalies.filter(a => filters.type!.includes(a.type));
 }

 onAnomalies(anomalies);
 },
 (error) => {
 ErrorLogger.error(error, 'AgentAnomalyService.subscribeToAgentAnomalies', {
 component: 'AgentAnomalyService',
 action: 'subscribeToAgentAnomalies',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
}

/**
 * Subscribe to active anomalies only
 */
export function subscribeToActiveAnomalies(
 organizationId: string,
 onAnomalies: (anomalies: DetectedAnomaly[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 return subscribeToAgentAnomalies(
 organizationId,
 onAnomalies,
 onError,
 { status: ['new', 'acknowledged', 'investigating'] }
 );
}

/**
 * Subscribe to anomaly statistics
 */
export function subscribeToAnomalyStats(
 organizationId: string,
 onStats: (stats: AnomalyStats | null) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 return onSnapshot(
 getAnomalyStatsDoc(organizationId),
 (snapshot) => {
 if (snapshot.exists()) {
 onStats(snapshot.data() as AnomalyStats);
 } else {
 onStats(null);
 }
 },
 (error) => {
 ErrorLogger.error(error, 'AgentAnomalyService.subscribeToAnomalyStats', {
 component: 'AgentAnomalyService',
 action: 'subscribeToAnomalyStats',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
}

// ============================================================================
// Baseline Subscriptions
// ============================================================================

/**
 * Subscribe to agent baselines
 */
export function subscribeToBaselines(
 organizationId: string,
 onBaselines: (baselines: AgentBaseline[]) => void,
 onError?: (error: Error) => void,
 agentId?: string
): Unsubscribe {
 let q = query(
 getBaselinesCollection(organizationId),
 orderBy('lastRecalculated', 'desc')
 );

 if (agentId) {
 q = query(q, where('agentId', '==', agentId));
 }

 return onSnapshot(
 q,
 (snapshot) => {
 const baselines = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as AgentBaseline));
 onBaselines(baselines);
 },
 (error) => {
 ErrorLogger.error(error, 'AgentAnomalyService.subscribeToBaselines', {
 component: 'AgentAnomalyService',
 action: 'subscribeToBaselines',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
}

/**
 * Get baseline for a specific agent
 */
export async function getAgentBaseline(
 organizationId: string,
 agentId: string
): Promise<AgentBaseline | null> {
 try {
 const q = query(
 getBaselinesCollection(organizationId),
 where('agentId', '==', agentId),
 limit(1)
 );
 const snapshot = await getDocs(q);

 if (snapshot.empty) return null;

 const docSnap = snapshot.docs[0];
 return { ...docSnap.data(), id: docSnap.id } as AgentBaseline;
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.getAgentBaseline', {
 component: 'AgentAnomalyService',
 action: 'getAgentBaseline',
 organizationId,
 agentId,
 });
 throw error;
 }
}

// ============================================================================
// Threshold Configuration
// ============================================================================

/**
 * Subscribe to threshold configurations
 */
export function subscribeToThresholds(
 organizationId: string,
 onThresholds: (thresholds: AnomalyThresholdConfig[]) => void,
 onError?: (error: Error) => void
): Unsubscribe {
 const q = query(
 getThresholdsCollection(organizationId),
 orderBy('createdAt', 'desc')
 );

 return onSnapshot(
 q,
 (snapshot) => {
 const thresholds = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as AnomalyThresholdConfig));
 onThresholds(thresholds);
 },
 (error) => {
 ErrorLogger.error(error, 'AgentAnomalyService.subscribeToThresholds', {
 component: 'AgentAnomalyService',
 action: 'subscribeToThresholds',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
}

/**
 * Get default threshold configuration
 */
export async function getDefaultThreshold(
 organizationId: string
): Promise<AnomalyThresholdConfig | null> {
 try {
 const q = query(
 getThresholdsCollection(organizationId),
 where('isDefault', '==', true),
 limit(1)
 );
 const snapshot = await getDocs(q);

 if (snapshot.empty) return null;

 const docSnap = snapshot.docs[0];
 return { ...docSnap.data(), id: docSnap.id } as AnomalyThresholdConfig;
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.getDefaultThreshold', {
 component: 'AgentAnomalyService',
 action: 'getDefaultThreshold',
 organizationId,
 });
 throw error;
 }
}

/**
 * Save threshold configuration
 */
export async function saveThresholdConfig(
 organizationId: string,
 config: Omit<AnomalyThresholdConfig, 'id' | 'createdAt' | 'updatedAt'>,
 userId: string
): Promise<string> {
 try {
 const now = new Date().toISOString();

 // Use a single batch for atomicity
 const batch = writeBatch(db);

 if (config.isDefault) {
 const existingDefaults = await getDocs(
 query(
  getThresholdsCollection(organizationId),
  where('isDefault', '==', true)
 )
 );

 // Clear existing defaults in batch
 existingDefaults.forEach(docSnap => {
 batch.update(docSnap.ref, sanitizeData({ isDefault: false, updatedAt: now }));
 });
 }

 // Add new config in same batch
 const newRef = doc(getThresholdsCollection(organizationId));
 batch.set(newRef, sanitizeData({
 ...config,
 isDefault: config.isDefault || false,
 createdAt: now,
 updatedAt: now,
 createdBy: userId,
 }));
 await batch.commit();

 return newRef.id;
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.saveThresholdConfig', {
 component: 'AgentAnomalyService',
 action: 'saveThresholdConfig',
 organizationId,
 });
 throw error;
 }
}

/**
 * Update threshold configuration
 */
export async function updateThresholdConfig(
 organizationId: string,
 configId: string,
 updates: Partial<AnomalyThresholdConfig>
): Promise<void> {
 try {
 const docRef = doc(getThresholdsCollection(organizationId), configId);
 await updateDoc(docRef, sanitizeData({
 ...updates,
 updatedAt: new Date().toISOString(),
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.updateThresholdConfig', {
 component: 'AgentAnomalyService',
 action: 'updateThresholdConfig',
 organizationId,
 configId,
 });
 throw error;
 }
}

// ============================================================================
// Anomaly Actions
// ============================================================================

/**
 * Acknowledge an anomaly
 */
export async function acknowledgeAnomaly(
 organizationId: string,
 anomalyId: string,
 userId: string
): Promise<void> {
 try {
 const docRef = doc(getAnomaliesCollection(organizationId), anomalyId);
 await updateDoc(docRef, sanitizeData({
 status: 'acknowledged',
 acknowledgedBy: userId,
 acknowledgedAt: new Date().toISOString(),
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.acknowledgeAnomaly', {
 component: 'AgentAnomalyService',
 action: 'acknowledgeAnomaly',
 organizationId,
 anomalyId,
 });
 throw error;
 }
}

/**
 * Start investigating an anomaly
 */
export async function investigateAnomaly(
 organizationId: string,
 anomalyId: string,
 userId: string
): Promise<void> {
 try {
 const docRef = doc(getAnomaliesCollection(organizationId), anomalyId);
 await updateDoc(docRef, sanitizeData({
 status: 'investigating',
 acknowledgedBy: userId,
 acknowledgedAt: new Date().toISOString(),
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.investigateAnomaly', {
 component: 'AgentAnomalyService',
 action: 'investigateAnomaly',
 organizationId,
 anomalyId,
 });
 throw error;
 }
}

/**
 * Resolve an anomaly
 */
export async function resolveAnomaly(
 organizationId: string,
 anomalyId: string,
 userId: string,
 notes?: string
): Promise<void> {
 try {
 const docRef = doc(getAnomaliesCollection(organizationId), anomalyId);
 await updateDoc(docRef, sanitizeData({
 status: 'resolved',
 resolvedBy: userId,
 resolvedAt: new Date().toISOString(),
 resolutionNotes: notes || null,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.resolveAnomaly', {
 component: 'AgentAnomalyService',
 action: 'resolveAnomaly',
 organizationId,
 anomalyId,
 });
 throw error;
 }
}

/**
 * Mark anomaly as false positive
 */
export async function markFalsePositive(
 organizationId: string,
 anomalyId: string,
 userId: string,
 notes?: string
): Promise<void> {
 try {
 const docRef = doc(getAnomaliesCollection(organizationId), anomalyId);
 await updateDoc(docRef, sanitizeData({
 status: 'false_positive',
 resolvedBy: userId,
 resolvedAt: new Date().toISOString(),
 resolutionNotes: notes || 'Marqué comme faux positif',
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.markFalsePositive', {
 component: 'AgentAnomalyService',
 action: 'markFalsePositive',
 organizationId,
 anomalyId,
 });
 throw error;
 }
}

/**
 * Bulk acknowledge anomalies
 */
export async function bulkAcknowledge(
 organizationId: string,
 anomalyIds: string[],
 userId: string
): Promise<void> {
 try {
 const BATCH_LIMIT = 400;
 const now = new Date().toISOString();
 const updateData = sanitizeData({
 status: 'acknowledged',
 acknowledgedBy: userId,
 acknowledgedAt: now,
 });

 for (let i = 0; i < anomalyIds.length; i += BATCH_LIMIT) {
 const chunk = anomalyIds.slice(i, i + BATCH_LIMIT);
 const batch = writeBatch(db);
 for (const id of chunk) {
 const ref = doc(getAnomaliesCollection(organizationId), id);
 batch.update(ref, updateData);
 }
 await batch.commit();
 }
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.bulkAcknowledge', {
 component: 'AgentAnomalyService',
 action: 'bulkAcknowledge',
 organizationId,
 count: anomalyIds.length,
 });
 throw error;
 }
}

/**
 * Bulk resolve anomalies
 */
export async function bulkResolve(
 organizationId: string,
 anomalyIds: string[],
 userId: string,
 notes?: string
): Promise<void> {
 try {
 const BATCH_LIMIT = 400;
 const now = new Date().toISOString();
 const updateData = sanitizeData({
 status: 'resolved',
 resolvedBy: userId,
 resolvedAt: now,
 resolutionNotes: notes || null,
 });

 for (let i = 0; i < anomalyIds.length; i += BATCH_LIMIT) {
 const chunk = anomalyIds.slice(i, i + BATCH_LIMIT);
 const batch = writeBatch(db);
 for (const id of chunk) {
 const ref = doc(getAnomaliesCollection(organizationId), id);
 batch.update(ref, updateData);
 }
 await batch.commit();
 }
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.bulkResolve', {
 component: 'AgentAnomalyService',
 action: 'bulkResolve',
 organizationId,
 count: anomalyIds.length,
 });
 throw error;
 }
}

// ============================================================================
// Baseline Management
// ============================================================================

/**
 * Whitelist a process for an agent
 */
export async function whitelistProcess(
 organizationId: string,
 agentId: string,
 processName: string
): Promise<void> {
 try {
 const baseline = await getAgentBaseline(organizationId, agentId);
 if (!baseline) {
 throw new Error('Baseline not found for agent');
 }

 const updatedProcesses = baseline.knownProcesses.map(p =>
 p.name === processName ? { ...p, isWhitelisted: true } : p
 );

 if (!updatedProcesses.find(p => p.name === processName)) {
 updatedProcesses.push({
 name: processName,
 typicalCpu: 0,
 typicalMemory: 0,
 firstSeen: new Date().toISOString(),
 seenCount: 1,
 isSystem: false,
 isWhitelisted: true,
 });
 }

 const docRef = doc(getBaselinesCollection(organizationId), baseline.id);
 await updateDoc(docRef, sanitizeData({
 knownProcesses: updatedProcesses,
 lastRecalculated: new Date().toISOString(),
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.whitelistProcess', {
 component: 'AgentAnomalyService',
 action: 'whitelistProcess',
 organizationId,
 agentId,
 processName,
 });
 throw error;
 }
}

/**
 * Whitelist a connection for an agent
 */
export async function whitelistConnection(
 organizationId: string,
 agentId: string,
 remoteAddress: string,
 remotePort: number,
 protocol: 'tcp' | 'udp'
): Promise<void> {
 try {
 const baseline = await getAgentBaseline(organizationId, agentId);
 if (!baseline) {
 throw new Error('Baseline not found for agent');
 }

 const pattern = remoteAddress;
 const existingIdx = baseline.knownConnections.findIndex(
 c => c.remotePattern === pattern && c.remotePort === remotePort
 );

 const updatedConnections = [...baseline.knownConnections];

 if (existingIdx >= 0) {
 updatedConnections[existingIdx] = {
 ...updatedConnections[existingIdx],
 isWhitelisted: true,
 };
 } else {
 updatedConnections.push({
 remotePattern: pattern,
 remotePort,
 protocol,
 firstSeen: new Date().toISOString(),
 seenCount: 1,
 isWhitelisted: true,
 });
 }

 const docRef = doc(getBaselinesCollection(organizationId), baseline.id);
 await updateDoc(docRef, sanitizeData({
 knownConnections: updatedConnections,
 lastRecalculated: new Date().toISOString(),
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.whitelistConnection', {
 component: 'AgentAnomalyService',
 action: 'whitelistConnection',
 organizationId,
 agentId,
 });
 throw error;
 }
}

// ============================================================================
// Statistics & Analytics
// ============================================================================

/**
 * Get anomaly timeline for charting
 */
export async function getAnomalyTimeline(
 organizationId: string,
 days: number = 7
): Promise<AnomalyTimelineEntry[]> {
 try {
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);

 const q = query(
 getAnomaliesCollection(organizationId),
 where('detectedAt', '>=', startDate.toISOString()),
 orderBy('detectedAt', 'asc')
 );

 const snapshot = await getDocs(q);
 const anomalies = snapshot.docs.map(d => d.data() as DetectedAnomaly);

 const hourlyMap = new Map<string, AnomalyTimelineEntry>();

 for (const anomaly of anomalies) {
 const date = new Date(anomaly.detectedAt);
 const hourKey = `${date.toISOString().split('T')[0]}-${date.getHours()}`;

 if (!hourlyMap.has(hourKey)) {
 // Avoid mutating `date` - create a new truncated date
 const truncated = new Date(date.getTime());
 truncated.setMinutes(0, 0, 0);
 hourlyMap.set(hourKey, {
  timestamp: truncated.toISOString(),
  hour: truncated.getHours(),
  bySeverity: {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  },
  total: 0,
 });
 }

 const entry = hourlyMap.get(hourKey)!;
 entry.bySeverity[anomaly.severity]++;
 entry.total++;
 }

 return Array.from(hourlyMap.values()).sort(
 (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
 );
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.getAnomalyTimeline', {
 component: 'AgentAnomalyService',
 action: 'getAnomalyTimeline',
 organizationId,
 days,
 });
 throw error;
 }
}

/**
 * Calculate anomaly statistics
 */
export async function calculateAnomalyStats(
 organizationId: string
): Promise<AnomalyStats> {
 try {
 const now = new Date();
 const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
 const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

 const snapshot = await getDocs(query(getAnomaliesCollection(organizationId), limit(5000)));
 const anomalies = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as DetectedAnomaly));

 const stats: AnomalyStats = {
 totalAnomalies: anomalies.length,
 activeAnomalies: 0,
 byStatus: {
 new: 0,
 acknowledged: 0,
 investigating: 0,
 resolved: 0,
 false_positive: 0,
 },
 bySeverity: {
 critical: 0,
 high: 0,
 medium: 0,
 low: 0,
 info: 0,
 },
 byType: {} as Record<AnomalyType, number>,
 last24h: 0,
 last7d: 0,
 trend: 'stable',
 meanTimeToAcknowledge: 0,
 meanTimeToResolve: 0,
 topAffectedAgents: [],
 calculatedAt: now.toISOString(),
 };

 const anomalyTypes: AnomalyType[] = [
 'cpu_spike', 'memory_spike', 'disk_spike', 'network_spike',
 'new_process', 'suspicious_connection', 'unusual_login_time',
 'config_change', 'compliance_drop'
 ];
 for (const type of anomalyTypes) {
 stats.byType[type] = 0;
 }

 const agentCounts = new Map<string, { hostname: string; count: number }>();
 let totalAckTime = 0;
 let ackCount = 0;
 let totalResolveTime = 0;
 let resolveCount = 0;

 for (const anomaly of anomalies) {
 stats.byStatus[anomaly.status]++;
 stats.bySeverity[anomaly.severity]++;
 stats.byType[anomaly.type]++;

 if (['new', 'acknowledged', 'investigating'].includes(anomaly.status)) {
 stats.activeAnomalies++;
 }

 const detectedDate = new Date(anomaly.detectedAt);
 if (detectedDate >= yesterday) {
 stats.last24h++;
 }
 if (detectedDate >= lastWeek) {
 stats.last7d++;
 }

 const existing = agentCounts.get(anomaly.agentId);
 if (existing) {
 existing.count++;
 } else {
 agentCounts.set(anomaly.agentId, {
  hostname: anomaly.agentHostname,
  count: 1,
 });
 }

 if (anomaly.acknowledgedAt) {
 const ackTime = new Date(anomaly.acknowledgedAt).getTime() - detectedDate.getTime();
 totalAckTime += ackTime;
 ackCount++;
 }

 if (anomaly.resolvedAt) {
 const resolveTime = new Date(anomaly.resolvedAt).getTime() - detectedDate.getTime();
 totalResolveTime += resolveTime;
 resolveCount++;
 }
 }

 if (ackCount > 0) {
 stats.meanTimeToAcknowledge = totalAckTime / ackCount / (1000 * 60 * 60);
 }
 if (resolveCount > 0) {
 stats.meanTimeToResolve = totalResolveTime / resolveCount / (1000 * 60 * 60);
 }

 stats.topAffectedAgents = Array.from(agentCounts.entries())
 .map(([agentId, data]) => ({
 agentId,
 hostname: data.hostname,
 anomalyCount: data.count,
 }))
 .sort((a, b) => b.anomalyCount - a.anomalyCount)
 .slice(0, 5);

 const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
 const previous24h = anomalies.filter(a => {
 const date = new Date(a.detectedAt);
 return date >= twoDaysAgo && date < yesterday;
 }).length;

 if (stats.last24h > previous24h * 1.2) {
 stats.trend = 'increasing';
 } else if (stats.last24h < previous24h * 0.8) {
 stats.trend = 'decreasing';
 }

 return stats;
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.calculateAnomalyStats', {
 component: 'AgentAnomalyService',
 action: 'calculateAnomalyStats',
 organizationId,
 });
 throw error;
 }
}

// ============================================================================
// Cloud Function Triggers
// ============================================================================

/**
 * Trigger baseline recalculation for an agent
 */
export async function recalculateBaseline(
 organizationId: string,
 agentId: string,
 window: BaselineWindow = '7d'
): Promise<void> {
 try {
 const recalculate = httpsCallable(functions, 'recalculateAgentBaseline');
 await recalculate({ organizationId, agentId, window });
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.recalculateBaseline', {
 component: 'AgentAnomalyService',
 action: 'recalculateBaseline',
 organizationId,
 agentId,
 });
 throw error;
 }
}

/**
 * Trigger anomaly detection scan
 */
export async function triggerAnomalyScan(
 organizationId: string,
 agentIds?: string[]
): Promise<void> {
 try {
 const scan = httpsCallable(functions, 'runAnomalyDetection');
 await scan({ organizationId, agentIds });
 } catch (error) {
 ErrorLogger.error(error, 'AgentAnomalyService.triggerAnomalyScan', {
 component: 'AgentAnomalyService',
 action: 'triggerAnomalyScan',
 organizationId,
 });
 throw error;
 }
}

// ============================================================================
// Statistical Helpers
// ============================================================================

/**
 * Calculate moving average from data points
 */
export function calculateMovingAverage(values: number[], window: number): number[] {
 const result: number[] = [];

 for (let i = 0; i < values.length; i++) {
 const start = Math.max(0, i - window + 1);
 const slice = values.slice(start, i + 1);
 const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
 result.push(avg);
 }

 return result;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
 if (values.length === 0) return 0;

 const mean = values.reduce((a, b) => a + b, 0) / values.length;
 const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
 const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

 return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate percentile
 */
export function calculatePercentile(values: number[], percentile: number): number {
 if (values.length === 0) return 0;

 const sorted = [...values].sort((a, b) => a - b);
 const index = (percentile / 100) * (sorted.length - 1);
 const lower = Math.floor(index);
 const upper = Math.ceil(index);

 if (lower === upper) return sorted[lower];

 const fraction = index - lower;
 return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * Build metric baseline from historical values
 */
export function buildMetricBaseline(
 metric: BaselineMetric,
 values: number[]
): MetricBaseline {
 const sorted = [...values].sort((a, b) => a - b);
 const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

 return {
 metric,
 mean,
 stdDev: calculateStdDev(values),
 min: sorted[0] || 0,
 max: sorted[sorted.length - 1] || 0,
 median: calculatePercentile(values, 50),
 p95: calculatePercentile(values, 95),
 p99: calculatePercentile(values, 99),
 dataPoints: values.length,
 lastUpdated: new Date().toISOString(),
 };
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Create default threshold configuration
 */
export function createDefaultThresholdConfig(
 organizationId: string,
 userId: string
): Omit<AnomalyThresholdConfig, 'id' | 'createdAt' | 'updatedAt'> {
 return {
 organizationId,
 name: 'Configuration par défaut',
 description: 'Seuils de détection standard pour tous les agents',
 isDefault: true,
 agentGroupIds: [],
 metricThresholds: [
 {
 metric: 'cpu_percent',
 enabled: true,
 stdDevMultiplier: 2,
 absoluteThreshold: 95,
 minimumSeverity: 'medium',
 sustainedDuration: 60,
 cooldownSeconds: 300,
 },
 {
 metric: 'memory_percent',
 enabled: true,
 stdDevMultiplier: 2,
 absoluteThreshold: 90,
 minimumSeverity: 'medium',
 sustainedDuration: 60,
 cooldownSeconds: 300,
 },
 {
 metric: 'disk_percent',
 enabled: true,
 stdDevMultiplier: 2,
 absoluteThreshold: 85,
 minimumSeverity: 'high',
 sustainedDuration: 300,
 cooldownSeconds: 3600,
 },
 {
 metric: 'network_in_bytes',
 enabled: true,
 stdDevMultiplier: 3,
 minimumSeverity: 'low',
 sustainedDuration: 120,
 cooldownSeconds: 600,
 },
 {
 metric: 'network_out_bytes',
 enabled: true,
 stdDevMultiplier: 3,
 minimumSeverity: 'low',
 sustainedDuration: 120,
 cooldownSeconds: 600,
 },
 {
 metric: 'compliance_score',
 enabled: true,
 stdDevMultiplier: 2,
 minimumSeverity: 'high',
 sustainedDuration: 0,
 cooldownSeconds: 3600,
 },
 ],
 processDetection: {
 detectNewProcesses: true,
 minimumRunTime: 30,
 ignoreSystemProcesses: true,
 ignorePatterns: [
 '^System$',
 '^kernel_task$',
 '^launchd$',
 '^WindowServer$',
 '^svchost\\.exe$',
 ],
 alertPatterns: [
 'mimikatz',
 'nc\\.exe',
 'netcat',
 'psexec',
 'powershell.*-enc',
 ],
 },
 connectionDetection: {
 detectNewOutbound: true,
 detectNewListening: true,
 ignoreLocal: true,
 trustedPatterns: [
 '\\.microsoft\\.com$',
 '\\.apple\\.com$',
 '\\.googleapis\\.com$',
 '\\.cloudflare\\.com$',
 ],
 suspiciousPatterns: [
 '\\.onion$',
 '\\.ru$',
 '\\.cn$',
 ],
 suspiciousPorts: [4444, 5555, 6666, 31337, 12345],
 },
 alertSettings: {
 aggregateSimilar: true,
 aggregationWindow: 300,
 escalationThreshold: 10,
 autoResolveHours: 72,
 notificationChannels: [
 {
  type: 'in_app',
  enabled: true,
  minimumSeverity: 'low',
  target: '',
 },
 ],
 },
 createdBy: userId,
 };
}
