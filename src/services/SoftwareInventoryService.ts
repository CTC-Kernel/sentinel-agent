/**
 * SoftwareInventoryService
 *
 * Service for managing fleet-wide software inventory with authorization
 * tracking, risk assessment, and CIS benchmark compliance.
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
    deleteDoc,
    Timestamp,
    Unsubscribe,
    writeBatch,
    limit,
    getDoc,
    setDoc,
    QueryDocumentSnapshot,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import {
    SoftwareInventoryEntry,
    SoftwareVersion,
    SoftwareInventoryStats,
    SoftwareAuthorizationRequest,
    AuthorizationStatus,
    SoftwareCategory,
    RiskLevel,
    CISBaseline,
    CISFleetStats,
    CISCheckResult,
    AgentSoftwareItem,
    getRiskLevel,
    calculateSoftwareRiskScore,
    compareVersions,
} from '../types/softwareInventory';

// Collection helpers
const getSoftwareCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'softwareInventory');

const getAuthRequestsCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'softwareAuthRequests');

const getCISBaselinesCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'cisBaselines');

/**
 * Convert Firestore document to SoftwareInventoryEntry
 */
function docToSoftware(docId: string, data: Record<string, unknown>): SoftwareInventoryEntry {
    return {
        id: docId,
        organizationId: data.organizationId as string,
        name: data.name as string,
        vendor: data.vendor as string,
        category: data.category as SoftwareCategory,
        versions: data.versions as SoftwareVersion[],
        agentCount: data.agentCount as number,
        agentIds: data.agentIds as string[],
        authorizationStatus: data.authorizationStatus as AuthorizationStatus,
        authorizedBy: data.authorizedBy as string | undefined,
        authorizedAt: data.authorizedAt as string | undefined,
        authorizationNotes: data.authorizationNotes as string | undefined,
        riskLevel: data.riskLevel as RiskLevel,
        riskScore: data.riskScore as number,
        riskFactors: data.riskFactors as SoftwareInventoryEntry['riskFactors'],
        linkedCveIds: data.linkedCveIds as string[],
        hasVulnerabilities: data.hasVulnerabilities as boolean,
        vulnerabilitySummary: data.vulnerabilitySummary as SoftwareInventoryEntry['vulnerabilitySummary'],
        firstDiscovered: data.firstDiscovered as string,
        lastSeen: data.lastSeen as string,
        updatedAt: data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt as string,
        metadata: data.metadata as Record<string, unknown> | undefined,
    };
}

/**
 * Convert Firestore document to CISBaseline
 */
function docToCISBaseline(docId: string, data: Record<string, unknown>): CISBaseline {
    return {
        id: docId,
        agentId: data.agentId as string,
        organizationId: data.organizationId as string,
        benchmarkId: data.benchmarkId as string,
        benchmarkName: data.benchmarkName as string,
        complianceScore: data.complianceScore as number,
        summary: data.summary as CISBaseline['summary'],
        categoryResults: data.categoryResults as CISBaseline['categoryResults'],
        results: data.results as CISCheckResult[],
        lastScanAt: data.lastScanAt as string,
        previousScore: data.previousScore as number | undefined,
        scoreChange: data.scoreChange as number | undefined,
        scoreHistory: data.scoreHistory as CISBaseline['scoreHistory'],
    };
}

/**
 * Subscribe to software inventory
 */
export function subscribeToSoftwareInventory(
    organizationId: string,
    onSoftware: (software: SoftwareInventoryEntry[]) => void,
    onError?: (error: Error) => void,
    filters?: {
        authorizationStatus?: AuthorizationStatus[];
        riskLevel?: RiskLevel[];
        category?: SoftwareCategory[];
        hasVulnerabilities?: boolean;
        searchTerm?: string;
    }
): Unsubscribe {
    let q = query(
        getSoftwareCollection(organizationId),
        orderBy('riskScore', 'desc')
    );

    // Apply Firestore filters
    if (filters?.authorizationStatus?.length === 1) {
        q = query(q, where('authorizationStatus', '==', filters.authorizationStatus[0]));
    }
    if (filters?.hasVulnerabilities !== undefined) {
        q = query(q, where('hasVulnerabilities', '==', filters.hasVulnerabilities));
    }

    return onSnapshot(
        q,
        (snapshot) => {
            let software = snapshot.docs.map(d => docToSoftware(d.id, d.data()));

            // Apply client-side filters
            if (filters?.authorizationStatus && filters.authorizationStatus.length > 1) {
                software = software.filter(s =>
                    filters.authorizationStatus!.includes(s.authorizationStatus)
                );
            }
            if (filters?.riskLevel?.length) {
                software = software.filter(s =>
                    filters.riskLevel!.includes(s.riskLevel)
                );
            }
            if (filters?.category?.length) {
                software = software.filter(s =>
                    filters.category!.includes(s.category)
                );
            }
            if (filters?.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                software = software.filter(s =>
                    s.name.toLowerCase().includes(term) ||
                    s.vendor.toLowerCase().includes(term)
                );
            }

            onSoftware(software);
        },
        (error) => {
            ErrorLogger.error(error, 'SoftwareInventoryService.subscribeToSoftwareInventory', {
                component: 'SoftwareInventoryService',
                action: 'subscribeToSoftwareInventory',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Subscribe to CIS baselines for agents
 */
export function subscribeToCISBaselines(
    organizationId: string,
    onBaselines: (baselines: CISBaseline[]) => void,
    onError?: (error: Error) => void,
    agentIds?: string[]
): Unsubscribe {
    let q = query(
        getCISBaselinesCollection(organizationId),
        orderBy('complianceScore', 'asc')
    );

    if (agentIds?.length === 1) {
        q = query(q, where('agentId', '==', agentIds[0]));
    }

    return onSnapshot(
        q,
        (snapshot) => {
            let baselines = snapshot.docs.map(d => docToCISBaseline(d.id, d.data()));

            // Client-side filter for multiple agent IDs
            if (agentIds && agentIds.length > 1) {
                baselines = baselines.filter(b => agentIds.includes(b.agentId));
            }

            onBaselines(baselines);
        },
        (error) => {
            ErrorLogger.error(error, 'SoftwareInventoryService.subscribeToCISBaselines', {
                component: 'SoftwareInventoryService',
                action: 'subscribeToCISBaselines',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Get software inventory statistics
 */
export async function getSoftwareStats(
    organizationId: string
): Promise<SoftwareInventoryStats> {
    try {
        const softwareQuery = query(getSoftwareCollection(organizationId), limit(5000));
        const softwareSnapshot = await getDocs(softwareQuery);
        const software = softwareSnapshot.docs.map(d => docToSoftware(d.id, d.data()));

        // Get pending authorization requests
        const requestsQuery = query(
            getAuthRequestsCollection(organizationId),
            where('status', '==', 'pending')
        );
        const requestsSnapshot = await getDocs(requestsQuery);

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Initialize stats
        const byAuthorization = { authorized: 0, pending: 0, unauthorized: 0, blocked: 0 };
        const byRiskLevel = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
        const byCategory = {} as Record<SoftwareCategory, number>;

        let totalInstallations = 0;
        let withVulnerabilities = 0;
        let outdatedCount = 0;
        let newThisWeek = 0;
        const agentsScanned = new Set<string>();

        for (const sw of software) {
            // Authorization
            byAuthorization[sw.authorizationStatus]++;

            // Risk level
            byRiskLevel[sw.riskLevel]++;

            // Category
            byCategory[sw.category] = (byCategory[sw.category] || 0) + 1;

            // Installations
            totalInstallations += sw.agentCount;

            // Vulnerabilities
            if (sw.hasVulnerabilities) {
                withVulnerabilities++;
            }

            // Outdated
            const hasOutdated = sw.versions.some(v => v.isOutdated);
            if (hasOutdated) {
                outdatedCount++;
            }

            // New this week
            if (new Date(sw.firstDiscovered) >= weekAgo) {
                newThisWeek++;
            }

            // Agents
            for (const agentId of sw.agentIds) {
                agentsScanned.add(agentId);
            }
        }

        return {
            totalSoftware: software.length,
            totalInstallations,
            byAuthorization,
            byRiskLevel,
            byCategory,
            withVulnerabilities,
            outdatedCount,
            agentsScanned: agentsScanned.size,
            lastScanAt: new Date().toISOString(),
            newThisWeek,
            pendingRequests: requestsSnapshot.size,
        };
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.getSoftwareStats', {
            component: 'SoftwareInventoryService',
            action: 'getSoftwareStats',
            organizationId,
        });
        throw error;
    }
}

/**
 * Get CIS fleet statistics
 */
export async function getCISFleetStats(
    organizationId: string,
    benchmarkId: string
): Promise<CISFleetStats> {
    try {
        const baselinesQuery = query(
            getCISBaselinesCollection(organizationId),
            where('benchmarkId', '==', benchmarkId)
        );
        const baselinesSnapshot = await getDocs(baselinesQuery);
        const baselines = baselinesSnapshot.docs.map(d => docToCISBaseline(d.id, d.data()));

        if (baselines.length === 0) {
            return {
                benchmarkId,
                benchmarkName: '',
                averageScore: 0,
                agentsScanned: 0,
                scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
                topFailedChecks: [],
                categoryCompliance: [],
                lastUpdated: new Date().toISOString(),
            };
        }

        // Calculate average score
        const totalScore = baselines.reduce((sum, b) => sum + b.complianceScore, 0);
        const averageScore = Math.round(totalScore / baselines.length);

        // Score distribution
        const scoreDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
        for (const baseline of baselines) {
            if (baseline.complianceScore >= 90) scoreDistribution.excellent++;
            else if (baseline.complianceScore >= 70) scoreDistribution.good++;
            else if (baseline.complianceScore >= 50) scoreDistribution.fair++;
            else scoreDistribution.poor++;
        }

        // Top failed checks
        const failedChecks = new Map<string, { title: string; count: number }>();
        for (const baseline of baselines) {
            for (const result of baseline.results) {
                if (result.status === 'fail') {
                    const existing = failedChecks.get(result.checkId);
                    if (existing) {
                        existing.count++;
                    } else {
                        failedChecks.set(result.checkId, {
                            title: result.checkId, // Would need lookup for actual title
                            count: 1,
                        });
                    }
                }
            }
        }

        const topFailedChecks = Array.from(failedChecks.entries())
            .map(([checkId, data]) => ({
                checkId,
                title: data.title,
                failCount: data.count,
                failPercent: Math.round((data.count / baselines.length) * 100),
            }))
            .sort((a, b) => b.failCount - a.failCount)
            .slice(0, 10);

        // Category compliance
        const categoryStats = new Map<string, { total: number; sum: number }>();
        for (const baseline of baselines) {
            for (const cat of baseline.categoryResults) {
                const existing = categoryStats.get(cat.categoryId);
                if (existing) {
                    existing.total++;
                    existing.sum += cat.compliancePercent;
                } else {
                    categoryStats.set(cat.categoryId, {
                        total: 1,
                        sum: cat.compliancePercent,
                    });
                }
            }
        }

        const categoryCompliance = Array.from(categoryStats.entries()).map(([categoryId, data]) => ({
            categoryId,
            categoryName: categoryId, // Would need lookup for actual name
            averagePercent: Math.round(data.sum / data.total),
        }));

        return {
            benchmarkId,
            benchmarkName: baselines[0].benchmarkName,
            averageScore,
            agentsScanned: baselines.length,
            scoreDistribution,
            topFailedChecks,
            categoryCompliance,
            lastUpdated: new Date().toISOString(),
        };
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.getCISFleetStats', {
            component: 'SoftwareInventoryService',
            action: 'getCISFleetStats',
            organizationId,
        });
        throw error;
    }
}

/**
 * Upsert software from agent scan
 */
export async function upsertSoftwareFromAgent(
    organizationId: string,
    agentId: string,
    softwareItems: AgentSoftwareItem[]
): Promise<{ added: number; updated: number }> {
    try {
        let added = 0;
        let updated = 0;

        // Pre-fetch all existing software for this organization that include this agent
        const existingQuery = query(
            getSoftwareCollection(organizationId),
            where('agentIds', 'array-contains', agentId)
        );
        const existingSnapshot = await getDocs(existingQuery);
        const existingByName = new Map<string, QueryDocumentSnapshot>();
        existingSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const key = (data.name || '').toLowerCase().trim();
            existingByName.set(key, docSnap);
        });

        // Also pre-fetch by name for software that may belong to other agents
        const allSoftwareSnapshot = await getDocs(
            query(getSoftwareCollection(organizationId), limit(5000))
        );
        allSoftwareSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const key = (data.name || '').toLowerCase().trim();
            if (!existingByName.has(key)) {
                existingByName.set(key, docSnap);
            }
        });

        const BATCH_LIMIT = 400;
        const batches: Array<{ action: 'set' | 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

        for (const item of softwareItems) {
            // Normalize software name for matching
            const normalizedName = item.name.toLowerCase().trim();

            // Use Map lookup instead of query
            const existingDoc = existingByName.get(normalizedName);

            if (!existingDoc) {
                // Create new software entry
                const newSoftwareRef = doc(getSoftwareCollection(organizationId));
                const newEntry: Omit<SoftwareInventoryEntry, 'id'> = {
                    organizationId,
                    name: normalizedName,
                    vendor: item.vendor || 'Unknown',
                    category: detectCategory(normalizedName),
                    versions: [{
                        version: item.version,
                        agentCount: 1,
                        agentIds: [agentId],
                        isLatest: true,
                        isOutdated: false,
                        cveIds: [],
                        riskLevel: 'none',
                        firstSeen: new Date().toISOString(),
                        lastSeen: new Date().toISOString(),
                    }],
                    agentCount: 1,
                    agentIds: [agentId],
                    authorizationStatus: 'pending',
                    riskLevel: 'none',
                    riskScore: 0,
                    riskFactors: {
                        vulnerabilityScore: 0,
                        outdatedScore: 0,
                        unauthorizedScore: 15, // Pending = some risk
                        exposureScore: 0,
                        eolScore: 0,
                    },
                    linkedCveIds: [],
                    hasVulnerabilities: false,
                    vulnerabilitySummary: { critical: 0, high: 0, medium: 0, low: 0 },
                    firstDiscovered: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                batches.push({
                    action: 'set',
                    ref: newSoftwareRef,
                    data: { ...newEntry, updatedAt: serverTimestamp() },
                });
                added++;
            } else {
                // Update existing software entry
                const existingData = docToSoftware(existingDoc.id, existingDoc.data());

                // Check if agent already recorded
                const agentExists = existingData.agentIds.includes(agentId);

                // Update version info
                let versions = [...existingData.versions];
                const versionIndex = versions.findIndex(v => v.version === item.version);

                if (versionIndex >= 0) {
                    // Update existing version
                    if (!versions[versionIndex].agentIds.includes(agentId)) {
                        versions[versionIndex].agentIds.push(agentId);
                        versions[versionIndex].agentCount++;
                    }
                    versions[versionIndex].lastSeen = new Date().toISOString();
                } else {
                    // Add new version
                    versions.push({
                        version: item.version,
                        agentCount: 1,
                        agentIds: [agentId],
                        isLatest: false,
                        isOutdated: false,
                        cveIds: [],
                        riskLevel: 'none',
                        firstSeen: new Date().toISOString(),
                        lastSeen: new Date().toISOString(),
                    });
                }

                // Determine latest version
                versions = versions.sort((a, b) => compareVersions(b.version, a.version));
                versions = versions.map((v, i) => ({
                    ...v,
                    isLatest: i === 0,
                    isOutdated: i > 0,
                }));

                const newAgentIds = agentExists
                    ? existingData.agentIds
                    : [...existingData.agentIds, agentId];

                batches.push({
                    action: 'update',
                    ref: existingDoc.ref,
                    data: {
                        versions,
                        agentIds: newAgentIds,
                        agentCount: newAgentIds.length,
                        lastSeen: new Date().toISOString(),
                        updatedAt: serverTimestamp(),
                    },
                });
                updated++;
            }
        }

        // Commit in chunks to respect Firestore batch limit
        for (let i = 0; i < batches.length; i += BATCH_LIMIT) {
            const chunk = batches.slice(i, i + BATCH_LIMIT);
            const batch = writeBatch(db);
            for (const op of chunk) {
                if (op.action === 'set') {
                    batch.set(op.ref, sanitizeData(op.data));
                } else {
                    batch.update(op.ref, sanitizeData(op.data));
                }
            }
            await batch.commit();
        }

        return { added, updated };
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.upsertSoftwareFromAgent', {
            component: 'SoftwareInventoryService',
            action: 'upsertSoftwareFromAgent',
            organizationId,
            metadata: { agentId },
        });
        throw error;
    }
}

/**
 * Update software authorization status
 */
export async function updateAuthorizationStatus(
    organizationId: string,
    softwareId: string,
    status: AuthorizationStatus,
    userId: string,
    notes?: string,
    totalAgentCount?: number
): Promise<void> {
    try {
        const softwareRef = doc(getSoftwareCollection(organizationId), softwareId);
        const softwareDoc = await getDoc(softwareRef);

        if (!softwareDoc.exists()) {
            throw new Error(`Software ${softwareId} not found`);
        }

        const existingData = docToSoftware(softwareDoc.id, softwareDoc.data());

        // Recalculate risk score based on new authorization status
        const unauthorizedScore = status === 'unauthorized' ? 15 :
            status === 'blocked' ? 20 :
                status === 'pending' ? 10 : 0;

        const newRiskScore = calculateSoftwareRiskScore(
            existingData.vulnerabilitySummary,
            existingData.versions.some(v => v.isOutdated),
            status === 'unauthorized' || status === 'blocked',
            existingData.agentCount / (totalAgentCount || 1)
        );

        await updateDoc(softwareRef, sanitizeData({
            authorizationStatus: status,
            authorizedBy: userId,
            authorizedAt: serverTimestamp(),
            authorizationNotes: notes || null,
            riskScore: newRiskScore,
            riskLevel: getRiskLevel(newRiskScore),
            'riskFactors.unauthorizedScore': unauthorizedScore,
            updatedAt: serverTimestamp(),
        }));
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.updateAuthorizationStatus', {
            component: 'SoftwareInventoryService',
            action: 'updateAuthorizationStatus',
            organizationId,
            metadata: { softwareId, status },
        });
        throw error;
    }
}

/**
 * Create authorization request
 */
export async function createAuthorizationRequest(
    organizationId: string,
    softwareId: string,
    softwareName: string,
    userId: string,
    userEmail: string,
    justification: string
): Promise<string> {
    try {
        const request: Omit<SoftwareAuthorizationRequest, 'id'> = {
            organizationId,
            softwareId,
            softwareName,
            requestedBy: userId,
            requesterEmail: userEmail,
            justification,
            status: 'pending',
            createdAt: serverTimestamp() as unknown as string,
        };

        const docRef = await addDoc(getAuthRequestsCollection(organizationId), sanitizeData(request));
        return docRef.id;
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.createAuthorizationRequest', {
            component: 'SoftwareInventoryService',
            action: 'createAuthorizationRequest',
            organizationId,
            metadata: { softwareId },
        });
        throw error;
    }
}

/**
 * Review authorization request
 */
export async function reviewAuthorizationRequest(
    organizationId: string,
    requestId: string,
    approved: boolean,
    reviewerId: string,
    notes?: string
): Promise<void> {
    try {
        const requestRef = doc(getAuthRequestsCollection(organizationId), requestId);
        const requestDoc = await getDoc(requestRef);

        if (!requestDoc.exists()) {
            throw new Error(`Request ${requestId} not found`);
        }

        const requestData = requestDoc.data();

        // Update request
        await updateDoc(requestRef, sanitizeData({
            status: approved ? 'approved' : 'rejected',
            reviewedBy: reviewerId,
            reviewedAt: serverTimestamp(),
            reviewNotes: notes || null,
        }));

        // Update software authorization status
        await updateAuthorizationStatus(
            organizationId,
            requestData.softwareId,
            approved ? 'authorized' : 'unauthorized',
            reviewerId,
            notes
        );
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.reviewAuthorizationRequest', {
            component: 'SoftwareInventoryService',
            action: 'reviewAuthorizationRequest',
            organizationId,
            metadata: { requestId, approved },
        });
        throw error;
    }
}

/**
 * Link CVEs to software
 */
export async function linkCvesToSoftware(
    organizationId: string,
    softwareId: string,
    cveIds: string[],
    vulnerabilitySummary: SoftwareInventoryEntry['vulnerabilitySummary'],
    totalAgentCount?: number
): Promise<void> {
    try {
        const softwareRef = doc(getSoftwareCollection(organizationId), softwareId);
        const softwareDoc = await getDoc(softwareRef);

        if (!softwareDoc.exists()) {
            throw new Error(`Software ${softwareId} not found`);
        }

        const existingData = docToSoftware(softwareDoc.id, softwareDoc.data());

        // Merge CVE IDs
        const allCveIds = [...new Set([...existingData.linkedCveIds, ...cveIds])];

        // Recalculate risk score
        const newRiskScore = calculateSoftwareRiskScore(
            vulnerabilitySummary,
            existingData.versions.some(v => v.isOutdated),
            existingData.authorizationStatus === 'unauthorized' || existingData.authorizationStatus === 'blocked',
            existingData.agentCount / (totalAgentCount || 1)
        );

        await updateDoc(softwareRef, sanitizeData({
            linkedCveIds: allCveIds,
            hasVulnerabilities: allCveIds.length > 0,
            vulnerabilitySummary,
            riskScore: newRiskScore,
            riskLevel: getRiskLevel(newRiskScore),
            updatedAt: serverTimestamp(),
        }));
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.linkCvesToSoftware', {
            component: 'SoftwareInventoryService',
            action: 'linkCvesToSoftware',
            organizationId,
            metadata: { softwareId },
        });
        throw error;
    }
}

/**
 * Update CIS baseline for agent
 */
export async function updateCISBaseline(
    organizationId: string,
    agentId: string,
    benchmarkId: string,
    benchmarkName: string,
    results: CISCheckResult[]
): Promise<void> {
    try {
        const baselineRef = doc(getCISBaselinesCollection(organizationId), agentId);
        const existingDoc = await getDoc(baselineRef);

        // Calculate summary
        const summary = {
            pass: results.filter(r => r.status === 'pass').length,
            fail: results.filter(r => r.status === 'fail').length,
            manual: results.filter(r => r.status === 'manual').length,
            notApplicable: results.filter(r => r.status === 'not_applicable').length,
            error: results.filter(r => r.status === 'error').length,
            total: results.length,
        };

        const applicableCount = summary.pass + summary.fail;
        const complianceScore = applicableCount > 0
            ? Math.round((summary.pass / applicableCount) * 100)
            : 0;

        // Calculate category results
        const categoryMap = new Map<string, { pass: number; fail: number; total: number }>();
        for (const result of results) {
            const categoryId = result.checkId.split('.').slice(0, 2).join('.');
            const existing = categoryMap.get(categoryId) || { pass: 0, fail: 0, total: 0 };
            existing.total++;
            if (result.status === 'pass') existing.pass++;
            if (result.status === 'fail') existing.fail++;
            categoryMap.set(categoryId, existing);
        }

        const categoryResults = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
            categoryId,
            categoryName: categoryId,
            pass: data.pass,
            fail: data.fail,
            total: data.total,
            compliancePercent: data.total > 0 ? Math.round((data.pass / (data.pass + data.fail)) * 100) : 0,
        }));

        // Get previous data for trend
        let previousScore: number | undefined;
        let scoreHistory: CISBaseline['scoreHistory'] = [];

        if (existingDoc.exists()) {
            const existingData = docToCISBaseline(existingDoc.id, existingDoc.data());
            previousScore = existingData.complianceScore;
            scoreHistory = existingData.scoreHistory.slice(-30); // Keep last 30 entries
        }

        scoreHistory.push({
            timestamp: new Date().toISOString(),
            score: complianceScore,
        });

        const baseline: CISBaseline = {
            id: agentId,
            agentId,
            organizationId,
            benchmarkId,
            benchmarkName,
            complianceScore,
            summary,
            categoryResults,
            results,
            lastScanAt: new Date().toISOString(),
            previousScore,
            scoreChange: previousScore !== undefined ? complianceScore - previousScore : undefined,
            scoreHistory,
        };

        await setDoc(baselineRef, sanitizeData(baseline));
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.updateCISBaseline', {
            component: 'SoftwareInventoryService',
            action: 'updateCISBaseline',
            organizationId,
            metadata: { agentId, benchmarkId },
        });
        throw error;
    }
}

/**
 * Delete software entry
 */
export async function deleteSoftwareEntry(
    organizationId: string,
    softwareId: string
): Promise<void> {
    try {
        await deleteDoc(doc(getSoftwareCollection(organizationId), softwareId));
    } catch (error) {
        ErrorLogger.error(error as Error, 'SoftwareInventoryService.deleteSoftwareEntry', {
            component: 'SoftwareInventoryService',
            action: 'deleteSoftwareEntry',
            organizationId,
            metadata: { softwareId },
        });
        throw error;
    }
}

/**
 * Detect software category from name
 */
function detectCategory(name: string): SoftwareCategory {
    const lowerName = name.toLowerCase();

    // Development tools
    if (/vs\s?code|visual studio|intellij|pycharm|webstorm|eclipse|xcode|android studio|git|node|npm|yarn|docker|kubernetes/i.test(lowerName)) {
        return 'development';
    }

    // Security tools
    if (/antivirus|firewall|vpn|kaspersky|norton|mcafee|avast|bitdefender|malwarebytes|crowdstrike|sentinel|defender/i.test(lowerName)) {
        return 'security';
    }

    // Communication
    if (/slack|teams|zoom|discord|skype|webex|meet|telegram|whatsapp|signal/i.test(lowerName)) {
        return 'communication';
    }

    // Browsers
    if (/chrome|firefox|safari|edge|opera|brave|vivaldi/i.test(lowerName)) {
        return 'browser';
    }

    // Productivity
    if (/office|word|excel|powerpoint|outlook|notion|evernote|todoist|asana|trello|jira|confluence/i.test(lowerName)) {
        return 'productivity';
    }

    // Media
    if (/vlc|spotify|itunes|photoshop|premiere|final cut|audacity|obs|handbrake/i.test(lowerName)) {
        return 'media';
    }

    // System
    if (/driver|runtime|framework|\.net|java|python|ruby|redistributable|update|service pack/i.test(lowerName)) {
        return 'system';
    }

    // Utility
    if (/7-zip|winrar|ccleaner|notepad|sublime|atom|terminal|iterm|putty|filezilla|winscp/i.test(lowerName)) {
        return 'utility';
    }

    return 'other';
}

// Export as service object
export const SoftwareInventoryService = {
    subscribeToSoftwareInventory,
    subscribeToCISBaselines,
    getSoftwareStats,
    getCISFleetStats,
    upsertSoftwareFromAgent,
    updateAuthorizationStatus,
    createAuthorizationRequest,
    reviewAuthorizationRequest,
    linkCvesToSoftware,
    updateCISBaseline,
    deleteSoftwareEntry,
};
