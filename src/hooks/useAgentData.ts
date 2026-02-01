import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useAuth } from './useAuth';
import { subscribeToAgents } from '../services/AgentService';
import { SentinelAgent, AgentResult } from '../types/agent';
import { ErrorLogger } from '../services/errorLogger';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export interface AgentDataSummary {
    /** Total number of enrolled agents */
    totalAgents: number;
    /** Number of agents currently active (heartbeat within 3 min) */
    activeAgents: number;
    /** Number of agents offline */
    offlineAgents: number;
    /** Number of agents in error state */
    errorAgents: number;
    /** Average compliance score across all agents (0-100) */
    averageComplianceScore: number | null;
    /** Aggregated check results across all agents */
    checkResultsSummary: {
        total: number;
        pass: number;
        fail: number;
        error: number;
        not_applicable: number;
    };
    /** Whether any agents are enrolled */
    hasAgents: boolean;
    /** List of agents */
    agents: SentinelAgent[];
    /** Recent check results (last 50) */
    recentResults: AgentResult[];
    /** Loading state */
    loading: boolean;
    /** Error if any */
    error: Error | null;
}

export interface UseAgentDataOptions {
    /** Subscribe to real-time agent updates */
    realtime?: boolean;
    /** Include recent check results */
    includeResults?: boolean;
    /** Max number of results to fetch */
    resultsLimit?: number;
}

/**
 * Hook to access agent data across the application
 * Provides summary statistics and real-time updates for agents
 */
export function useAgentData(options: UseAgentDataOptions = {}): AgentDataSummary {
    const { realtime = true, includeResults = true, resultsLimit = 50 } = options;
    const { user, demoMode } = useStore();
    const { claimsSynced } = useAuth();
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [recentResults, setRecentResults] = useState<AgentResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Subscribe to agents
    // IMPORTANT: Wait for claimsSynced to be true before subscribing
    // This prevents "permission-denied" errors when the Firebase Auth token
    // hasn't been refreshed yet with the organizationId custom claim
    useEffect(() => {
        if (demoMode) {
            // In demo mode, provide mock agent data asynchronously to avoid cascading renders
            Promise.resolve().then(() => {
                setAgents([
                    {
                        id: 'demo-agent-1',
                        name: 'DESKTOP-DEMO-01',
                        os: 'windows',
                        osVersion: '11 Pro',
                        status: 'active',
                        version: '1.0.0',
                        lastHeartbeat: new Date().toISOString(),
                        hostname: 'DESKTOP-DEMO-01',
                        organizationId: 'demo',
                        complianceScore: 87,
                        lastCheckAt: new Date().toISOString(),
                    },
                    {
                        id: 'demo-agent-2',
                        name: 'MacBook-Pro-Demo',
                        os: 'darwin',
                        osVersion: 'macOS 14.2',
                        status: 'active',
                        version: '1.0.0',
                        lastHeartbeat: new Date().toISOString(),
                        hostname: 'MacBook-Pro-Demo',
                        organizationId: 'demo',
                        complianceScore: 92,
                        lastCheckAt: new Date().toISOString(),
                    },
                    {
                        id: 'demo-agent-3',
                        name: 'WORKSTATION-03',
                        os: 'windows',
                        osVersion: '10 Enterprise',
                        status: 'offline',
                        version: '1.0.0',
                        lastHeartbeat: new Date(Date.now() - 3600000).toISOString(),
                        hostname: 'WORKSTATION-03',
                        organizationId: 'demo',
                        complianceScore: 65,
                        lastCheckAt: new Date(Date.now() - 3600000).toISOString(),
                    }
                ]);
                setLoading(false);
            });
            return;
        }

        if (!user?.organizationId || !realtime) {
            Promise.resolve().then(() => setLoading(false));
            return;
        }

        // Wait for custom claims to be synced before subscribing to prevent permission errors
        if (!claimsSynced) {
            Promise.resolve().then(() => setLoading(true));
            return;
        }

        const unsubscribe = subscribeToAgents(
            user.organizationId,
            (newAgents) => {
                setAgents(newAgents);
                setLoading(false);
                setError(null);
            },
            (err) => {
                ErrorLogger.error(err, 'useAgentData.subscribeToAgents', {
                    component: 'useAgentData',
                    organizationId: user.organizationId
                });
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.organizationId, realtime, demoMode, claimsSynced]);

    // Subscribe to recent results
    // Also needs to wait for claimsSynced for organization subcollections
    // Uses org-scoped agent paths instead of collectionGroup to prevent cross-tenant queries
    useEffect(() => {
        if (demoMode) {
            // Demo mode: provide mock results asynchronously to avoid cascading renders
            Promise.resolve().then(() => {
                setRecentResults([
                    {
                        id: 'demo-result-1',
                        checkId: 'firewall-enabled',
                        framework: 'ISO27001',
                        controlId: 'A.13.1.1',
                        status: 'pass',
                        evidence: { enabled: true },
                        timestamp: new Date().toISOString(),
                        durationMs: 150,
                    },
                    {
                        id: 'demo-result-2',
                        checkId: 'antivirus-active',
                        framework: 'ISO27001',
                        controlId: 'A.12.2.1',
                        status: 'pass',
                        evidence: { active: true, name: 'Windows Defender' },
                        timestamp: new Date().toISOString(),
                        durationMs: 200,
                    },
                    {
                        id: 'demo-result-3',
                        checkId: 'disk-encryption',
                        framework: 'ISO27001',
                        controlId: 'A.8.3.1',
                        status: 'fail',
                        evidence: { encrypted: false },
                        timestamp: new Date().toISOString(),
                        durationMs: 300,
                    },
                ]);
            });
            return;
        }

        if (!user?.organizationId || !includeResults) return;

        // Wait for custom claims to be synced before subscribing
        if (!claimsSynced) return;

        // Wait for agents to load before querying their results subcollections
        if (agents.length === 0) return;

        let cancelled = false;

        // Query results from each agent's org-scoped subcollection
        // Path: organizations/{orgId}/agents/{agentId}/results
        const fetchResults = async () => {
            try {
                const allResults: AgentResult[] = [];
                const perAgentLimit = Math.max(5, Math.ceil(resultsLimit / agents.length));

                await Promise.all(agents.map(async (agent) => {
                    try {
                        const resultsRef = collection(
                            db,
                            'organizations',
                            user.organizationId!,
                            'agents',
                            agent.id,
                            'results'
                        );
                        const resultsQuery = query(
                            resultsRef,
                            orderBy('createdAt', 'desc'),
                            limit(perAgentLimit)
                        );
                        const snapshot = await getDocs(resultsQuery);
                        snapshot.docs.forEach(docSnap => {
                            const data = docSnap.data();
                            allResults.push({
                                id: docSnap.id,
                                checkId: data.checkId,
                                framework: data.framework,
                                controlId: data.controlId,
                                status: data.status,
                                evidence: data.evidence || {},
                                timestamp: data.timestamp instanceof Timestamp
                                    ? data.timestamp.toDate().toISOString()
                                    : data.timestamp,
                                durationMs: data.durationMs || 0,
                                createdAt: data.createdAt instanceof Timestamp
                                    ? data.createdAt.toDate().toISOString()
                                    : data.createdAt,
                            } as AgentResult);
                        });
                    } catch (err) {
                        // Individual agent failure should not break the entire results fetch
                        ErrorLogger.error(err, 'useAgentData.fetchAgentResults', {
                            component: 'useAgentData',
                            metadata: { agentId: agent.id }
                        });
                    }
                }));

                if (!cancelled) {
                    // Sort by createdAt descending and limit total results
                    allResults.sort((a, b) => {
                        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return timeB - timeA;
                    });
                    setRecentResults(allResults.slice(0, resultsLimit));
                }
            } catch (err) {
                if (!cancelled) {
                    ErrorLogger.error(err, 'useAgentData.fetchResults', {
                        component: 'useAgentData',
                        organizationId: user.organizationId
                    });
                }
            }
        };

        fetchResults();

        return () => { cancelled = true; };
    }, [user?.organizationId, includeResults, resultsLimit, demoMode, claimsSynced, agents]);

    // Compute summary statistics
    const summary = useMemo((): AgentDataSummary => {
        const activeAgents = agents.filter(a => a.status === 'active').length;
        const offlineAgents = agents.filter(a => a.status === 'offline').length;
        const errorAgents = agents.filter(a => a.status === 'error').length;

        // Calculate average compliance score
        const agentsWithScore = agents.filter(a => a.complianceScore !== null && a.complianceScore !== undefined);
        const averageComplianceScore = agentsWithScore.length > 0
            ? Math.round(agentsWithScore.reduce((sum, a) => sum + (a.complianceScore || 0), 0) / agentsWithScore.length)
            : null;

        // Aggregate check results
        const checkResultsSummary = recentResults.reduce(
            (acc, result) => {
                acc.total++;
                if (result.status === 'pass') acc.pass++;
                else if (result.status === 'fail') acc.fail++;
                else if (result.status === 'error') acc.error++;
                else if (result.status === 'not_applicable') acc.not_applicable++;
                return acc;
            },
            { total: 0, pass: 0, fail: 0, error: 0, not_applicable: 0 }
        );

        return {
            totalAgents: agents.length,
            activeAgents,
            offlineAgents,
            errorAgents,
            averageComplianceScore,
            checkResultsSummary,
            hasAgents: agents.length > 0,
            agents,
            recentResults,
            loading,
            error,
        };
    }, [agents, recentResults, loading, error]);

    return summary;
}

/**
 * Get agent results mapped by control ID for compliance integration
 */
export function useAgentResultsByControl(framework?: string): Map<string, AgentResult[]> {
    const { recentResults } = useAgentData({ includeResults: true, resultsLimit: 200 });

    return useMemo(() => {
        const resultsByControl = new Map<string, AgentResult[]>();

        for (const result of recentResults) {
            // Filter by framework if specified
            if (framework && result.framework !== framework) continue;

            const existing = resultsByControl.get(result.controlId) || [];
            existing.push(result);
            resultsByControl.set(result.controlId, existing);
        }

        return resultsByControl;
    }, [recentResults, framework]);
}

/**
 * Check if a specific control has been verified by an agent
 */
export function useControlAgentVerification(controlId: string, framework?: string): {
    verified: boolean;
    status: 'pass' | 'fail' | 'error' | 'not_applicable' | null;
    lastCheck: string | null;
    evidence: Record<string, unknown> | null;
} {
    const resultsByControl = useAgentResultsByControl(framework);

    return useMemo(() => {
        const results = resultsByControl.get(controlId);
        if (!results || results.length === 0) {
            return { verified: false, status: null, lastCheck: null, evidence: null };
        }

        // Get most recent result
        const latestResult = results.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        return {
            verified: true,
            status: latestResult.status,
            lastCheck: latestResult.timestamp,
            evidence: latestResult.evidence,
        };
    }, [resultsByControl, controlId]);
}

export default useAgentData;
