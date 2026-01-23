import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { subscribeToAgents } from '../services/AgentService';
import { SentinelAgent, AgentResult } from '../types/agent';
import { ErrorLogger } from '../services/errorLogger';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
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
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [recentResults, setRecentResults] = useState<AgentResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Subscribe to agents
    useEffect(() => {
        if (demoMode) {
            // In demo mode, provide mock agent data
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
            return;
        }

        if (!user?.organizationId || !realtime) {
            setLoading(false);
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
    }, [user?.organizationId, realtime, demoMode]);

    // Subscribe to recent results
    useEffect(() => {
        if (demoMode) {
            // Demo mode: provide mock results
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
            return;
        }

        if (!user?.organizationId || !includeResults) return;

        // Query results from all agents (using collectionGroup would be ideal,
        // but we'll query the main results collection)
        const resultsQuery = query(
            collection(db, 'organizations', user.organizationId, 'agentResults'),
            orderBy('timestamp', 'desc'),
            limit(resultsLimit)
        );

        const unsubscribe = onSnapshot(
            resultsQuery,
            (snapshot) => {
                const results = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
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
                    } as AgentResult;
                });
                setRecentResults(results);
            },
            (err) => {
                // Silently fail for results - not critical
                ErrorLogger.error(err, 'useAgentData.subscribeToResults', {
                    component: 'useAgentData',
                    organizationId: user.organizationId
                });
            }
        );

        return () => unsubscribe();
    }, [user?.organizationId, includeResults, resultsLimit, demoMode]);

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
