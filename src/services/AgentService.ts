import {
    collection,
    onSnapshot,
    query,
    orderBy,
    Unsubscribe,
    Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import { ErrorLogger } from './errorLogger';
import {
    SentinelAgent,
    AgentEnrollmentToken,
    AgentDetails,
    AgentResult,
    AgentCheckResult,
    AgentConfig,
    AgentStatus,
    AgentMetricsHistory
} from '../types/agent';

// Offline threshold: 3 missed heartbeats (3 minutes with 60s interval)
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;

const getAgentsCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'agents');

const getTokensCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'enrollmentTokens');

/**
 * Compute agent status based on last heartbeat
 */
function computeAgentStatus(lastHeartbeat: Date | null): AgentStatus {
    if (!lastHeartbeat) return 'offline';
    const now = Date.now();
    const diff = now - lastHeartbeat.getTime();
    return diff < OFFLINE_THRESHOLD_MS ? 'active' : 'offline';
}

/**
 * Validate and normalize agent metrics for reliability
 * Logs anomalous values for debugging
 */
function validateAgentMetrics(data: any): any {
    const validated = { ...data };
    
    // Validate CPU - log if value exceeds 100% (indicates agent bug)
    if (typeof data.cpuPercent === 'number') {
        if (data.cpuPercent > 100) {
            console.warn(`[AgentService] Anomalous CPU value detected: ${data.cpuPercent}% (agent: ${data.hostname || data.machineId}) - capping at 100%`);
        }
        validated.cpuPercent = Math.min(100, Math.max(0, data.cpuPercent));
    }
    
    // Validate Memory - log if value exceeds 100%
    if (typeof data.memoryPercent === 'number') {
        if (data.memoryPercent > 100) {
            console.warn(`[AgentService] Anomalous memory value detected: ${data.memoryPercent}% (agent: ${data.hostname || data.machineId}) - capping at 100%`);
        }
        validated.memoryPercent = Math.min(100, Math.max(0, data.memoryPercent));
    }
    
    // Validate Disk - log if value exceeds 100%
    if (typeof data.diskPercent === 'number') {
        if (data.diskPercent > 100) {
            console.warn(`[AgentService] Anomalous disk value detected: ${data.diskPercent}% (agent: ${data.hostname || data.machineId}) - capping at 100%`);
        }
        validated.diskPercent = Math.min(100, Math.max(0, data.diskPercent));
    }
    
    return validated;
}

/**
 * Convert Firestore document to SentinelAgent
 */
function docToAgent(docId: string, data: Record<string, unknown>, organizationId: string): SentinelAgent {
    const validatedData = validateAgentMetrics(data);
    const lastHeartbeat = validatedData.lastHeartbeat instanceof Timestamp
        ? validatedData.lastHeartbeat.toDate()
        : validatedData.lastHeartbeat ? new Date(validatedData.lastHeartbeat as string) : null;

    const enrolledAt = validatedData.enrolledAt instanceof Timestamp
        ? validatedData.enrolledAt.toDate().toISOString()
        : validatedData.enrolledAt as string | undefined;

    return {
        id: docId,
        name: (data.name as string) || (data.hostname as string) || docId,
        os: (data.os as SentinelAgent['os']) || 'linux',
        osVersion: data.osVersion as string | undefined,
        status: computeAgentStatus(lastHeartbeat),
        version: (validatedData.version as string) || '0.0.0',
        lastHeartbeat: lastHeartbeat
            ? lastHeartbeat.toISOString()
            : ((validatedData.lastHeartbeat as string) || null) as unknown as string,
        ipAddress: validatedData.ipAddress as string | undefined,
        hostname: validatedData.hostname as string | undefined,
        organizationId,
        machineId: validatedData.machineId as string | undefined,
        complianceScore: validatedData.complianceScore as number | null | undefined,
        lastCheckAt: validatedData.lastCheckAt instanceof Timestamp
            ? validatedData.lastCheckAt.toDate().toISOString()
            : (validatedData.lastCheckAt as string | null | undefined) ?? null,
        enrolledAt,
        cpuPercent: validatedData.cpuPercent,
        memoryBytes: validatedData.memoryBytes as number | undefined,
        memoryPercent: validatedData.memoryPercent,
        memoryTotalBytes: validatedData.memoryTotalBytes as number | undefined,
        diskPercent: validatedData.diskPercent,
        diskUsedBytes: validatedData.diskUsedBytes as number | undefined,
        diskTotalBytes: validatedData.diskTotalBytes as number | undefined,
        uptimeSeconds: validatedData.uptimeSeconds as number | undefined,
        config: validatedData.config as AgentConfig | undefined,
        configVersion: validatedData.configVersion as number | undefined,
        rulesVersion: validatedData.rulesVersion as number | undefined,
    };
}

/**
 * Subscribe to agents in real-time
 */
export function subscribeToAgents(
    organizationId: string,
    onAgents: (agents: SentinelAgent[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const q = query(
        getAgentsCollection(organizationId),
        orderBy('lastHeartbeat', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const agents = snapshot.docs.map(doc =>
                docToAgent(doc.id, doc.data(), organizationId)
            );
            onAgents(agents);
        },
        (error) => {
            ErrorLogger.error(error, 'AgentService.subscribeToAgents', {
                component: 'AgentService',
                action: 'subscribeToAgents',
                organizationId
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Subscribe to enrollment tokens in real-time
 */
export function subscribeToTokens(
    organizationId: string,
    onTokens: (tokens: AgentEnrollmentToken[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const q = query(
        getTokensCollection(organizationId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const now = new Date();
            const tokens = snapshot.docs.map(doc => {
                const data = doc.data();
                const expiresAt = data.expiresAt instanceof Timestamp
                    ? data.expiresAt.toDate()
                    : new Date(data.expiresAt);
                const createdAt = data.createdAt instanceof Timestamp
                    ? data.createdAt.toDate().toISOString()
                    : data.createdAt;
                const lastUsedAt = data.lastUsedAt instanceof Timestamp
                    ? data.lastUsedAt.toDate().toISOString()
                    : data.lastUsedAt || null;

                const isExpired = expiresAt < now;
                const isExhausted = data.maxUses && data.usedCount >= data.maxUses;
                const status = data.revoked
                    ? 'revoked'
                    : isExpired
                        ? 'expired'
                        : isExhausted
                            ? 'exhausted'
                            : 'active';

                return {
                    id: doc.id,
                    name: data.name,
                    tokenPreview: data.token
                        ? `${data.token.slice(0, 4)}...${data.token.slice(-4)}`
                        : '****',
                    expiresAt: expiresAt.toISOString(),
                    createdAt,
                    maxUses: data.maxUses || null,
                    usedCount: data.usedCount || 0,
                    status,
                    revoked: data.revoked || false,
                    lastUsedAt,
                    organizationId,
                } as AgentEnrollmentToken;
            });
            onTokens(tokens);
        },
        (error) => {
            ErrorLogger.error(error, 'AgentService.subscribeToTokens', {
                component: 'AgentService',
                action: 'subscribeToTokens',
                organizationId
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Get agent details via Cloud Function
 */
export async function getAgentDetails(
    organizationId: string,
    agentId: string
): Promise<AgentDetails> {
    try {
        const getAgentDetailsFn = httpsCallable<
            { organizationId: string; agentId: string },
            AgentDetails
        >(functions, 'getAgentDetails');

        const result = await getAgentDetailsFn({ organizationId, agentId });
        return result.data;
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.getAgentDetails', {
            component: 'AgentService',
            action: 'getAgentDetails',
            organizationId,
            metadata: { agentId }
        });
        throw error;
    }
}

/**
 * Delete an agent via Cloud Function
 */
export async function deleteAgent(
    organizationId: string,
    agentId: string,
    deleteResults = false
): Promise<void> {
    try {
        const deleteAgentFn = httpsCallable<
            { organizationId: string; agentId: string; deleteResults: boolean },
            { success: boolean }
        >(functions, 'deleteAgent');

        await deleteAgentFn({ organizationId, agentId, deleteResults });
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.deleteAgent', {
            component: 'AgentService',
            action: 'deleteAgent',
            organizationId,
            metadata: { agentId }
        });
        throw error;
    }
}

/**
 * Generate a new enrollment token via Cloud Function
 */
export async function generateEnrollmentToken(
    organizationId: string,
    name?: string,
    expiresInDays = 30,
    maxUses: number | null = null
): Promise<AgentEnrollmentToken> {
    try {
        const generateTokenFn = httpsCallable<
            { organizationId: string; name?: string; expiresInDays: number; maxUses: number | null },
            { id: string; token: string; name: string; expiresAt: string; maxUses: number | null }
        >(functions, 'generateEnrollmentToken');

        const result = await generateTokenFn({
            organizationId,
            name,
            expiresInDays,
            maxUses
        });

        return {
            id: result.data.id,
            token: result.data.token,
            name: result.data.name,
            expiresAt: result.data.expiresAt,
            maxUses: result.data.maxUses,
            createdAt: new Date().toISOString(),
            revoked: false,
            lastUsedAt: null,
            usedCount: 0,
            status: 'active',
            organizationId,
        };
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.generateEnrollmentToken', {
            component: 'AgentService',
            action: 'generateEnrollmentToken',
            organizationId
        });
        throw error;
    }
}

/**
 * Revoke an enrollment token via Cloud Function
 */
export async function revokeEnrollmentToken(
    organizationId: string,
    tokenId: string
): Promise<void> {
    try {
        const revokeTokenFn = httpsCallable<
            { organizationId: string; tokenId: string },
            { success: boolean }
        >(functions, 'revokeEnrollmentToken');

        await revokeTokenFn({ organizationId, tokenId });
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.revokeEnrollmentToken', {
            component: 'AgentService',
            action: 'revokeEnrollmentToken',
            organizationId,
            metadata: { tokenId }
        });
        throw error;
    }
}

/**
 * Update agent configuration via Cloud Function
 */
export async function updateAgentConfig(
    organizationId: string,
    agentId: string,
    config: Partial<AgentConfig>
): Promise<void> {
    try {
        const updateConfigFn = httpsCallable<
            { organizationId: string; agentId: string; config: Partial<AgentConfig> },
            { success: boolean }
        >(functions, 'updateAgentConfig');

        await updateConfigFn({ organizationId, agentId, config });
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.updateAgentConfig', {
            component: 'AgentService',
            action: 'updateAgentConfig',
            organizationId,
            metadata: { agentId }
        });
        throw error;
    }
}

/**
 * Get agent results via Cloud Function
 */
export async function getAgentResults(
    organizationId: string,
    agentId: string,
    options?: { framework?: string; limit?: number; startAfter?: string }
): Promise<{ results: AgentResult[]; hasMore: boolean; lastId: string | null }> {
    try {
        const getResultsFn = httpsCallable<
            { organizationId: string; agentId: string; framework?: string; limit?: number; startAfter?: string },
            { results: AgentResult[]; hasMore: boolean; lastId: string | null }
        >(functions, 'getAgentResults');

        const result = await getResultsFn({
            organizationId,
            agentId,
            ...options
        });

        return result.data;
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.getAgentResults', {
            component: 'AgentService',
            action: 'getAgentResults',
            organizationId,
            metadata: { agentId }
        });
        throw error;
    }
}

/**
 * Get agent metrics history for charts
 */
export async function getAgentMetricsHistory(
    organizationId: string,
    agentId: string,
    hours: number = 24
): Promise<AgentMetricsHistory> {
    try {
        const getMetricsFn = httpsCallable<
            { organizationId: string; agentId: string; hours: number },
            AgentMetricsHistory
        >(functions, 'getAgentMetricsHistory');

        const result = await getMetricsFn({ organizationId, agentId, hours });
        return result.data;
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.getAgentMetricsHistory', {
            component: 'AgentService',
            action: 'getAgentMetricsHistory',
            organizationId,
            metadata: { agentId, hours }
        });
        throw error;
    }
}

/**
 * Get compliance check results for all agents (for heatmap)
 */
export async function getAgentComplianceResults(
    organizationId: string
): Promise<Map<string, AgentCheckResult[]>> {
    try {
        const getResultsFn = httpsCallable<
            { organizationId: string },
            { resultsByAgent: Record<string, AgentCheckResult[]> }
        >(functions, 'getAgentComplianceResults');

        const result = await getResultsFn({ organizationId });
        const map = new Map<string, AgentCheckResult[]>();
        for (const [agentId, results] of Object.entries(result.data.resultsByAgent)) {
            map.set(agentId, results);
        }
        return map;
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.getAgentComplianceResults', {
            component: 'AgentService',
            action: 'getAgentComplianceResults',
            organizationId
        });
        throw error; // Don't swallow
    }
}

/**
 * Agent download manifest type
 */
export type AgentPlatform = 'macos' | 'windows' | 'linux_deb' | 'linux_rpm';

export interface AgentDownloadInfo {
    platform: AgentPlatform;
    version: string;
    filename: string;
    downloadUrl: string;
    size: number;
    sha256: string;
}

/**
 * Get download URL for agent installer
 */
export async function getAgentDownloadUrl(
    platform: AgentPlatform
): Promise<AgentDownloadInfo> {
    try {
        // Get manifest first
        const manifestRef = ref(storage, 'releases/agents/manifest.json');
        const manifestUrl = await getDownloadURL(manifestRef);

        const response = await fetch(manifestUrl);
        const manifest = await response.json();

        const platformInfo = manifest.agents[platform];
        if (!platformInfo) {
            throw new Error(`No agent available for platform: ${platform}`);
        }

        // Get download URL for the agent file from the platform-specific folder
        const agentRef = ref(storage, `releases/agent/${platform}/${platformInfo.filename}`);
        const downloadUrl = await getDownloadURL(agentRef);

        return {
            platform,
            version: platformInfo.version,
            filename: platformInfo.filename,
            downloadUrl,
            size: platformInfo.size,
            sha256: platformInfo.sha256,
        };
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.getAgentDownloadUrl', {
            component: 'AgentService',
            action: 'getAgentDownloadUrl',
            metadata: { platform }
        });
        throw error;
    }
}

/**
 * Get all available agent downloads
 */
export async function getAgentDownloads(): Promise<AgentDownloadInfo[]> {
    const platforms: AgentPlatform[] = ['macos', 'windows', 'linux_deb', 'linux_rpm'];

    const results = await Promise.allSettled(
        platforms.map(platform => getAgentDownloadUrl(platform))
    );

    return results
        .filter((r): r is PromiseFulfilledResult<AgentDownloadInfo> => {
            if (r.status === 'rejected') {
                ErrorLogger.warn(
                    `Failed to get download for platform: ${r.reason instanceof Error ? r.reason.message : 'Unknown error'}`,
                    'AgentService.getAgentDownloads',
                    {
                        component: 'AgentService',
                        action: 'getAgentDownloads',
                    }
                );
            }
            return r.status === 'fulfilled';
        })
        .map(r => r.value);
}

export const AgentService = {
    subscribeToAgents,
    subscribeToTokens,
    getAgentDetails,
    getAgentMetricsHistory,
    getAgentComplianceResults,
    deleteAgent,
    generateEnrollmentToken,
    revokeEnrollmentToken,
    updateAgentConfig,
    getAgentResults,
    getAgentDownloadUrl,
    getAgentDownloads,
};

export default AgentService;
