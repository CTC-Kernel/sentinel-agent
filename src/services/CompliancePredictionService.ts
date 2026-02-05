/**
 * CompliancePredictionService
 *
 * Service for AI-powered compliance predictions, trend analysis,
 * recommended actions, and remediation scripts.
 *
 * Sprint 7 - AI-Powered Features
 */

import {
 collection,
 onSnapshot,
 query,
 where,
 orderBy,
 getDocs,
 addDoc,
 Unsubscribe,
 limit,
 serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { TREND_THRESHOLD } from '../constants/complianceConfig';
import { sanitizeData } from '@/utils/dataSanitizer';
import {
 CompliancePrediction,
 TrendAnalysis,
 ScoreDataPoint,
 ScorePrediction,
 RecommendedAction,
 ActionImpactSummary,
 RemediationScript,
 ScriptExecutionRequest,
 ConfidenceLevel,
 TrendDirection,
 getConfidenceLevel,
 calculateQuickWinScore,
 formatPredictionMessage,
} from '../types/compliancePrediction';
import { RegulatoryFrameworkCode } from '../types/framework';

// Collection helpers
const getPredictionsCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'compliancePredictions');

const getActionsCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'recommendedActions');

const getScriptsCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'remediationScripts');

const getScoreHistoryCollection = (organizationId: string) =>
 collection(db, 'organizations', organizationId, 'complianceScoreHistory');

/**
 * Subscribe to compliance predictions
 */
export function subscribeToPredictions(
 organizationId: string,
 onPredictions: (predictions: CompliancePrediction[]) => void,
 onError?: (error: Error) => void,
 frameworkIds?: string[]
): Unsubscribe {
 let q = query(
 getPredictionsCollection(organizationId),
 orderBy('currentScore', 'asc')
 );

 if (frameworkIds?.length === 1) {
 q = query(q, where('frameworkId', '==', frameworkIds[0]));
 }

 return onSnapshot(
 q,
 (snapshot) => {
 let predictions = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as CompliancePrediction));

 // Client-side filter for multiple frameworks
 if (frameworkIds && frameworkIds.length > 1) {
 predictions = predictions.filter(p => frameworkIds.includes(p.frameworkId));
 }

 onPredictions(predictions);
 },
 (error) => {
 ErrorLogger.error(error, 'CompliancePredictionService.subscribeToPredictions', {
 component: 'CompliancePredictionService',
 action: 'subscribeToPredictions',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
}

/**
 * Subscribe to recommended actions
 */
export function subscribeToRecommendedActions(
 organizationId: string,
 onActions: (actions: RecommendedAction[]) => void,
 onError?: (error: Error) => void,
 options?: {
 frameworkId?: string;
 limit?: number;
 quickWinsOnly?: boolean;
 }
): Unsubscribe {
 let q = query(
 getActionsCollection(organizationId),
 orderBy('rank', 'asc')
 );

 if (options?.frameworkId) {
 q = query(q, where('frameworkIds', 'array-contains', options.frameworkId));
 }

 if (options?.limit) {
 q = query(q, limit(options.limit));
 }

 return onSnapshot(
 q,
 (snapshot) => {
 let actions = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as RecommendedAction));

 // Client-side filter for quick wins
 if (options?.quickWinsOnly) {
 actions = actions.filter(a => a.isQuickWin);
 }

 onActions(actions);
 },
 (error) => {
 ErrorLogger.error(error, 'CompliancePredictionService.subscribeToRecommendedActions', {
 component: 'CompliancePredictionService',
 action: 'subscribeToRecommendedActions',
 organizationId,
 });
 if (onError) onError(error);
 }
 );
}

/**
 * Get prediction for a specific framework
 */
export async function getPrediction(
 organizationId: string,
 frameworkId: string
): Promise<CompliancePrediction | null> {
 try {
 const q = query(
 getPredictionsCollection(organizationId),
 where('frameworkId', '==', frameworkId),
 limit(1)
 );

 const snapshot = await getDocs(q);

 if (snapshot.empty) {
 return null;
 }

 return {
 ...snapshot.docs[0].data(),
 id: snapshot.docs[0].id,
 } as CompliancePrediction;
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.getPrediction', {
 component: 'CompliancePredictionService',
 action: 'getPrediction',
 organizationId,
 metadata: { frameworkId },
 });
 throw error;
 }
}

/**
 * Get score history for trend analysis
 */
export async function getScoreHistory(
 organizationId: string,
 frameworkId: string,
 days: number = 90
): Promise<ScoreDataPoint[]> {
 try {
 const cutoffDate = new Date();
 cutoffDate.setDate(cutoffDate.getDate() - days);

 const q = query(
 getScoreHistoryCollection(organizationId),
 where('frameworkId', '==', frameworkId),
 where('timestamp', '>=', cutoffDate.toISOString()),
 orderBy('timestamp', 'asc')
 );

 const snapshot = await getDocs(q);

 return snapshot.docs.map(d => ({
 timestamp: d.data().timestamp,
 score: d.data().score,
 compliantCount: d.data().compliantCount,
 totalCount: d.data().totalCount,
 }));
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.getScoreHistory', {
 component: 'CompliancePredictionService',
 action: 'getScoreHistory',
 organizationId,
 metadata: { frameworkId, days },
 });
 throw error;
 }
}

/**
 * Calculate trend analysis from score history
 */
export function calculateTrend(
 history: ScoreDataPoint[],
 frameworkId: string,
 frameworkCode: RegulatoryFrameworkCode
): TrendAnalysis {
 const now = new Date();
 const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
 const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

 // Get current and historical scores
 const currentScore = history.length > 0 ? history[history.length - 1].score : 0;

 const weekAgoPoint = history.find(p => new Date(p.timestamp) >= weekAgo);
 const monthAgoPoint = history.find(p => new Date(p.timestamp) >= monthAgo);

 const score7DaysAgo = weekAgoPoint?.score ?? currentScore;
 const score30DaysAgo = monthAgoPoint?.score ?? currentScore;

 const weeklyChange = currentScore - score7DaysAgo;
 const monthlyChange = currentScore - score30DaysAgo;

 // Determine direction using percentage-based comparison
 const weeklyPercentChange = score7DaysAgo > 0
 ? Math.abs(weeklyChange / score7DaysAgo) * 100
 : (weeklyChange !== 0 ? 100 : 0);

 let direction: TrendDirection = 'stable';
 if (weeklyPercentChange > TREND_THRESHOLD) {
 direction = weeklyChange > 0 ? 'up' : 'down';
 }

 // Calculate velocity (points per day)
 const velocity = history.length >= 2
 ? (history[history.length - 1].score - history[0].score) /
 ((new Date(history[history.length - 1].timestamp).getTime() -
 new Date(history[0].timestamp).getTime()) / (24 * 60 * 60 * 1000))
 : 0;

 // Linear regression for trend line
 const trendLine = calculateLinearRegression(history);

 return {
 frameworkId,
 frameworkCode,
 currentScore,
 score7DaysAgo,
 score30DaysAgo,
 weeklyChange,
 monthlyChange,
 direction,
 velocity: Math.round(velocity * 100) / 100,
 history,
 trendLine,
 calculatedAt: now.toISOString(),
 };
}

/**
 * Calculate linear regression for trend line
 */
function calculateLinearRegression(
 points: ScoreDataPoint[]
): { slope: number; intercept: number; r2: number } {
 if (points.length < 2) {
 return { slope: 0, intercept: points[0]?.score ?? 0, r2: 0 };
 }

 const n = points.length;
 const startTime = new Date(points[0].timestamp).getTime();

 // Convert timestamps to days from start
 const x = points.map(p =>
 (new Date(p.timestamp).getTime() - startTime) / (24 * 60 * 60 * 1000)
 );
 const y = points.map(p => p.score);

 // Calculate means
 const xMean = x.reduce((a, b) => a + b, 0) / n;
 const yMean = y.reduce((a, b) => a + b, 0) / n;

 // Calculate slope and intercept
 let numerator = 0;
 let denominator = 0;

 for (let i = 0; i < n; i++) {
 numerator += (x[i] - xMean) * (y[i] - yMean);
 denominator += (x[i] - xMean) ** 2;
 }

 const slope = denominator !== 0 ? numerator / denominator : 0;
 const intercept = yMean - slope * xMean;

 // Calculate R² (coefficient of determination)
 const yPredicted = x.map(xi => slope * xi + intercept);
 const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPredicted[i]) ** 2, 0);
 const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
 const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

 return {
 slope: Math.round(slope * 1000) / 1000,
 intercept: Math.round(intercept * 100) / 100,
 r2: Math.round(r2 * 1000) / 1000,
 };
}

/**
 * Generate predictions for target scores
 */
export function generatePredictions(
 trend: TrendAnalysis,
 targets: { score: number; label: string; isPrimary: boolean }[]
): ScorePrediction[] {
 return targets.map(target => {
 const { score: targetScore, label: targetLabel } = target;

 // Check if already reached
 if (trend.currentScore >= targetScore) {
 return {
 targetScore,
 targetLabel,
 predictedDate: null,
 daysUntil: null,
 confidence: 'high' as ConfidenceLevel,
 confidenceProbability: 1,
 lowerBound: null,
 upperBound: null,
 isReached: true,
 isUnreachable: false,
 message: formatPredictionMessage(trend.currentScore, targetScore, null, true, false),
 };
 }

 // Check if trend is negative or stagnant
 if (trend.velocity <= 0) {
 return {
 targetScore,
 targetLabel,
 predictedDate: null,
 daysUntil: null,
 confidence: 'low' as ConfidenceLevel,
 confidenceProbability: 0.2,
 lowerBound: null,
 upperBound: null,
 isReached: false,
 isUnreachable: true,
 message: formatPredictionMessage(trend.currentScore, targetScore, null, false, true),
 };
 }

 // Calculate days until target
 const pointsNeeded = targetScore - trend.currentScore;
 const daysUntil = Math.ceil(pointsNeeded / trend.velocity);

 // Calculate confidence based on R² and data points
 const r2Confidence = Math.max(0, trend.trendLine.r2);
 const dataConfidence = Math.min(1, trend.history.length / 30);
 const confidenceProbability = r2Confidence * 0.6 + dataConfidence * 0.4;
 const confidence = getConfidenceLevel(confidenceProbability);

 // Calculate prediction bounds (±20% for medium confidence)
 const marginDays = Math.round(daysUntil * (1 - confidenceProbability) * 0.5);
 const predictedDate = new Date();
 predictedDate.setDate(predictedDate.getDate() + daysUntil);

 const lowerBoundDate = new Date();
 lowerBoundDate.setDate(lowerBoundDate.getDate() + Math.max(1, daysUntil - marginDays));

 const upperBoundDate = new Date();
 upperBoundDate.setDate(upperBoundDate.getDate() + daysUntil + marginDays);

 return {
 targetScore,
 targetLabel,
 predictedDate: predictedDate.toISOString(),
 daysUntil,
 confidence,
 confidenceProbability: Math.round(confidenceProbability * 100) / 100,
 lowerBound: lowerBoundDate.toISOString(),
 upperBound: upperBoundDate.toISOString(),
 isReached: false,
 isUnreachable: false,
 message: formatPredictionMessage(trend.currentScore, targetScore, daysUntil, false, false),
 };
 });
}

/**
 * Get impact summary for recommended actions
 */
export async function getActionImpactSummary(
 organizationId: string
): Promise<ActionImpactSummary> {
 try {
 const actionsSnapshot = await getDocs(
 query(getActionsCollection(organizationId))
 );

 const actions = actionsSnapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as RecommendedAction));

 // Calculate totals
 let totalPotentialIncrease = 0;
 let quickWinIncrease = 0;
 let quickWinCount = 0;
 let totalEstimatedHours = 0;
 let quickWinHours = 0;

 const categoryMap = new Map<string, { actionCount: number; totalImpact: number }>();

 for (const action of actions) {
 totalPotentialIncrease += action.scoreImpact;
 totalEstimatedHours += action.estimatedHours;

 if (action.isQuickWin) {
 quickWinIncrease += action.scoreImpact;
 quickWinCount++;
 quickWinHours += action.estimatedHours;
 }

 // Aggregate by category
 const catData = categoryMap.get(action.category) || { actionCount: 0, totalImpact: 0 };
 catData.actionCount++;
 catData.totalImpact += action.scoreImpact;
 categoryMap.set(action.category, catData);
 }

 return {
 totalPotentialIncrease,
 quickWinIncrease,
 quickWinCount,
 totalEstimatedHours,
 quickWinHours,
 byFramework: [], // Would need to fetch current scores
 byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
 category: category as RecommendedAction['category'],
 ...data,
 })),
 };
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.getActionImpactSummary', {
 component: 'CompliancePredictionService',
 action: 'getActionImpactSummary',
 organizationId,
 });
 throw error;
 }
}

/**
 * Get remediation scripts
 */
export async function getRemediationScripts(
 organizationId: string,
 options?: {
 platform?: string;
 checkId?: string;
 verifiedOnly?: boolean;
 }
): Promise<RemediationScript[]> {
 try {
 let q = query(
 getScriptsCollection(organizationId),
 orderBy('successRate', 'desc')
 );

 if (options?.platform) {
 q = query(q, where('platform', '==', options.platform));
 }

 if (options?.verifiedOnly) {
 q = query(q, where('isVerified', '==', true));
 }

 const snapshot = await getDocs(q);

 let scripts = snapshot.docs.map(d => ({
 ...d.data(),
 id: d.id,
 } as RemediationScript));

 // Client-side filter for check ID
 if (options?.checkId) {
 scripts = scripts.filter(s =>
 s.relatedCheckIds.includes(options.checkId!) ||
 s.relatedCisChecks.includes(options.checkId!)
 );
 }

 return scripts;
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.getRemediationScripts', {
 component: 'CompliancePredictionService',
 action: 'getRemediationScripts',
 organizationId,
 });
 throw error;
 }
}

/**
 * Request script execution
 */
export async function requestScriptExecution(
 organizationId: string,
 scriptId: string,
 targetAgentIds: string[],
 userId: string
): Promise<string> {
 try {
 const request: Omit<ScriptExecutionRequest, 'id'> = {
 organizationId,
 scriptId,
 targetAgentIds,
 requestedBy: userId,
 status: 'pending',
 createdAt: serverTimestamp() as unknown as string,
 };

 const docRef = await addDoc(
 collection(db, 'organizations', organizationId, 'scriptExecutionRequests'),
 sanitizeData(request)
 );

 return docRef.id;
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.requestScriptExecution', {
 component: 'CompliancePredictionService',
 action: 'requestScriptExecution',
 organizationId,
 metadata: { scriptId, targetAgentIds },
 });
 throw error;
 }
}

/**
 * Trigger prediction generation via Cloud Function
 */
export async function generatePredictionsForOrg(
 organizationId: string
): Promise<{ success: boolean; predictionsGenerated: number }> {
 try {
 const generatePredictions = httpsCallable(functions, 'generateCompliancePredictions');
 const result = await generatePredictions({ organizationId });
 return result.data as { success: boolean; predictionsGenerated: number };
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.generatePredictionsForOrg', {
 component: 'CompliancePredictionService',
 action: 'generatePredictionsForOrg',
 organizationId,
 });
 throw error;
 }
}

/**
 * Trigger action recommendations via Cloud Function
 */
export async function generateRecommendedActions(
 organizationId: string
): Promise<{ success: boolean; actionsGenerated: number }> {
 try {
 const generateActions = httpsCallable(functions, 'generateRecommendedActions');
 const result = await generateActions({ organizationId });
 return result.data as { success: boolean; actionsGenerated: number };
 } catch (error) {
 ErrorLogger.error(error as Error, 'CompliancePredictionService.generateRecommendedActions', {
 component: 'CompliancePredictionService',
 action: 'generateRecommendedActions',
 organizationId,
 });
 throw error;
 }
}

/**
 * Rank actions by quick win score
 */
export function rankActionsByQuickWin(actions: RecommendedAction[]): RecommendedAction[] {
 // Calculate quick win scores and sort
 const actionsWithScores = actions.map(action => ({
 action,
 quickWinScore: calculateQuickWinScore(action),
 }));

 actionsWithScores.sort((a, b) => b.quickWinScore - a.quickWinScore);

 return actionsWithScores.map(({ action }) => action);
}

/**
 * Get top N actions for maximum impact
 */
export function getTopImpactActions(
 actions: RecommendedAction[],
 count: number = 5
): RecommendedAction[] {
 return [...actions]
 .sort((a, b) => b.scoreImpact - a.scoreImpact)
 .slice(0, count);
}

// Export as service object
export const CompliancePredictionService = {
 subscribeToPredictions,
 subscribeToRecommendedActions,
 getPrediction,
 getScoreHistory,
 calculateTrend,
 generatePredictions,
 getActionImpactSummary,
 getRemediationScripts,
 requestScriptExecution,
 generatePredictionsForOrg,
 generateRecommendedActions,
 rankActionsByQuickWin,
 getTopImpactActions,
};
