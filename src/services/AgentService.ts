import {
    collection,
    onSnapshot,
    query,
    orderBy,
    Unsubscribe,
    Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';
import {
    SentinelAgent,
    AgentEnrollmentToken,
    AgentDetails,
    AgentResult,
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
 * Convert Firestore document to SentinelAgent
 */
function docToAgent(docId: string, data: Record<string, unknown>, organizationId: string): SentinelAgent {
    const lastHeartbeat = data.lastHeartbeat instanceof Timestamp
        ? data.lastHeartbeat.toDate()
        : data.lastHeartbeat ? new Date(data.lastHeartbeat as string) : null;

    const enrolledAt = data.enrolledAt instanceof Timestamp
        ? data.enrolledAt.toDate().toISOString()
        : data.enrolledAt as string | undefined;

    return {
        id: docId,
        name: (data.name as string) || (data.hostname as string) || docId,
        os: (data.os as SentinelAgent['os']) || 'linux',
        osVersion: data.osVersion as string | undefined,
        status: computeAgentStatus(lastHeartbeat),
        version: (data.version as string) || '0.0.0',
        lastHeartbeat: lastHeartbeat?.toISOString() || new Date(0).toISOString(),
        ipAddress: data.ipAddress as string | undefined,
        hostname: data.hostname as string | undefined,
        organizationId,
        machineId: data.machineId as string | undefined,
        complianceScore: data.complianceScore as number | null | undefined,
        lastCheckAt: data.lastCheckAt as string | null | undefined,
        enrolledAt,
        cpuPercent: data.cpuPercent as number | undefined,
        memoryBytes: data.memoryBytes as number | undefined,
        config: data.config as AgentConfig | undefined,
        configVersion: data.configVersion as number | undefined,
        rulesVersion: data.rulesVersion as number | undefined,
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
                    tokenPreview: `${data.token?.slice(0, 4)}...${data.token?.slice(-4)}`,
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

export const AgentService = {
    subscribeToAgents,
    subscribeToTokens,
    getAgentDetails,
    getAgentMetricsHistory,
    deleteAgent,
    generateEnrollmentToken,
    revokeEnrollmentToken,
    updateAgentConfig,
    getAgentResults,
};

export default AgentService;
