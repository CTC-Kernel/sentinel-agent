/**
 * AgentPolicyService
 *
 * Service for agent groups, policies, inheritance resolution,
 * and policy distribution.
 *
 * Sprint 9 - Groups & Policies
 */

import {
    collection,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    Unsubscribe,
    limit,
    arrayUnion,
    arrayRemove,
    increment,
    runTransaction,
    writeBatch,
    serverTimestamp,
    QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
    AgentGroup,
    AgentPolicy,
    PolicyRule,
    EffectivePolicy,
    PolicyConflict,
    PolicyStats,
    PolicyHistoryEntry,
    GroupHierarchyNode,
    PolicyScope,
} from '../types/agentPolicy';
import {
    mergeRulesWithInheritance,
    rulesToAgentConfig,
    getPriorityWeight,
    createDefaultGroup,
    createDefaultGlobalPolicy,
} from '../types/agentPolicy';
import { isSafeRegex } from './OTConnectorService';
// AgentConfig is used implicitly via rulesToAgentConfig return type

// ============================================================================
// Collection Helpers
// ============================================================================

const getGroupsCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'agentGroups');

const getPoliciesCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'agentPolicies');

const getPolicyHistoryCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'policyHistory');

const getPolicyStatsDoc = (organizationId: string) =>
    doc(db, 'organizations', organizationId, 'stats', 'policies');

// ============================================================================
// Type-safe conversion helpers
// ============================================================================

function docToGroup(d: QueryDocumentSnapshot): AgentGroup {
    const data = d.data();
    return {
        ...data,
        id: d.id,
        agentIds: data.agentIds || [],
        policyIds: data.policyIds || [],
        membershipCriteria: data.membershipCriteria || [],
        agentCount: data.agentCount || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as AgentGroup;
}

function docToPolicy(d: QueryDocumentSnapshot): AgentPolicy {
    const data = d.data();
    return {
        id: d.id,
        organizationId: data.organizationId || '',
        name: data.name || '',
        description: data.description || '',
        scope: data.scope || 'global',
        priority: data.priority || 'medium',
        enforcement: data.enforcement || 'audit',
        rules: (data.rules || []) as PolicyRule[],
        version: data.version || 1,
        isEnabled: data.isEnabled ?? data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        targetGroupIds: data.targetGroupIds || [],
        targetAgentIds: data.targetAgentIds || [],
        deploymentStatus: data.deploymentStatus || 'draft',
        pendingAgentCount: data.pendingAgentCount || 0,
        appliedAgentCount: data.appliedAgentCount || 0,
        createdBy: data.createdBy || '',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as AgentPolicy;
}

// ============================================================================
// Group Subscriptions
// ============================================================================

/**
 * Subscribe to agent groups
 */
export function subscribeToGroups(
    organizationId: string,
    onGroups: (groups: AgentGroup[]) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    const q = query(
        getGroupsCollection(organizationId),
        orderBy('sortOrder', 'asc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const groups = snapshot.docs.map(d => docToGroup(d));
            onGroups(groups);
        },
        (error) => {
            ErrorLogger.error(error, 'AgentPolicyService.subscribeToGroups', {
                component: 'AgentPolicyService',
                action: 'subscribeToGroups',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Get group by ID
 */
export async function getGroup(
    organizationId: string,
    groupId: string
): Promise<AgentGroup | null> {
    try {
        const docRef = doc(getGroupsCollection(organizationId), groupId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        const data = snapshot.data();
        return {
            ...data,
            id: snapshot.id,
            agentIds: data.agentIds || [],
            policyIds: data.policyIds || [],
            membershipCriteria: data.membershipCriteria || [],
            agentCount: data.agentCount || 0,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as AgentGroup;
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.getGroup', {
            component: 'AgentPolicyService',
            action: 'getGroup',
            organizationId,
            groupId,
        });
        throw error;
    }
}

/**
 * Create a new group
 */
export async function createGroup(
    organizationId: string,
    group: Omit<AgentGroup, 'id' | 'createdAt' | 'updatedAt' | 'agentCount'>,
    userId: string
): Promise<string> {
    try {
        const docRef = await addDoc(getGroupsCollection(organizationId), sanitizeData({
            ...group,
            agentCount: group.agentIds?.length || 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
        }));

        return docRef.id;
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.createGroup', {
            component: 'AgentPolicyService',
            action: 'createGroup',
            organizationId,
        });
        throw error;
    }
}

/**
 * Update a group
 */
export async function updateGroup(
    organizationId: string,
    groupId: string,
    updates: Partial<AgentGroup>
): Promise<void> {
    try {
        const docRef = doc(getGroupsCollection(organizationId), groupId);
        const updateData: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
        if (updates.agentIds) {
            updateData.agentCount = updates.agentIds.length;
        }
        await updateDoc(docRef, sanitizeData(updateData));
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.updateGroup', {
            component: 'AgentPolicyService',
            action: 'updateGroup',
            organizationId,
            groupId,
        });
        throw error;
    }
}

/**
 * Delete a group
 */
export async function deleteGroup(
    organizationId: string,
    groupId: string
): Promise<void> {
    try {
        // Check if group is system group
        const group = await getGroup(organizationId, groupId);
        if (group?.isSystem) {
            throw new Error('Cannot delete system group');
        }

        const docRef = doc(getGroupsCollection(organizationId), groupId);
        await deleteDoc(docRef);
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.deleteGroup', {
            component: 'AgentPolicyService',
            action: 'deleteGroup',
            organizationId,
            groupId,
        });
        throw error;
    }
}

/**
 * Add agents to a group
 */
export async function addAgentsToGroup(
    organizationId: string,
    groupId: string,
    agentIds: string[]
): Promise<void> {
    try {
        const groupRef = doc(getGroupsCollection(organizationId), groupId);

        // Use transaction to compute actual delta and avoid count drift
        await runTransaction(db, async (transaction) => {
            const groupSnap = await transaction.get(groupRef);
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }
            const currentAgentIds: string[] = groupSnap.data().agentIds || [];
            const newAgents = agentIds.filter(id => !currentAgentIds.includes(id));
            if (newAgents.length === 0) return;

            transaction.update(groupRef, {
                agentIds: arrayUnion(...newAgents),
                agentCount: increment(newAgents.length),
                updatedAt: serverTimestamp(),
            });
        });
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.addAgentsToGroup', {
            component: 'AgentPolicyService',
            action: 'addAgentsToGroup',
            organizationId,
            groupId,
        });
        throw error;
    }
}

/**
 * Remove agents from a group
 */
export async function removeAgentsFromGroup(
    organizationId: string,
    groupId: string,
    agentIds: string[]
): Promise<void> {
    try {
        const groupRef = doc(getGroupsCollection(organizationId), groupId);

        // Use transaction to compute actual delta and avoid count drift
        await runTransaction(db, async (transaction) => {
            const groupSnap = await transaction.get(groupRef);
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }
            const currentAgentIds: string[] = groupSnap.data().agentIds || [];
            const removedAgents = agentIds.filter(id => currentAgentIds.includes(id));
            if (removedAgents.length === 0) return;

            transaction.update(groupRef, {
                agentIds: arrayRemove(...removedAgents),
                agentCount: increment(-removedAgents.length),
                updatedAt: serverTimestamp(),
            });
        });
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.removeAgentsFromGroup', {
            component: 'AgentPolicyService',
            action: 'removeAgentsFromGroup',
            organizationId,
            groupId,
        });
        throw error;
    }
}

/**
 * Build group hierarchy
 */
export function buildGroupHierarchy(groups: AgentGroup[]): GroupHierarchyNode[] {
    const groupMap = new Map(groups.map(g => [g.id, g]));
    const childrenMap = new Map<string | undefined, AgentGroup[]>();

    // Group by parent
    for (const group of groups) {
        const parentId = group.parentGroupId;
        if (!childrenMap.has(parentId)) {
            childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(group);
    }

    // Build tree recursively
    function buildNode(group: AgentGroup, depth: number, path: string[]): GroupHierarchyNode {
        const children = childrenMap.get(group.id) || [];
        const childNodes = children
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(child => buildNode(child, depth + 1, [...path, group.id]));

        // Calculate effective policies (own + inherited from ancestors)
        const effectivePolicyIds = [...group.policyIds];
        for (const ancestorId of path) {
            const ancestor = groupMap.get(ancestorId);
            if (ancestor) {
                for (const policyId of ancestor.policyIds) {
                    if (!effectivePolicyIds.includes(policyId)) {
                        effectivePolicyIds.push(policyId);
                    }
                }
            }
        }

        return {
            group,
            children: childNodes,
            depth,
            path,
            effectivePolicyIds,
        };
    }

    // Start from root groups (no parent)
    const rootGroups = childrenMap.get(undefined) || [];
    return rootGroups
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(group => buildNode(group, 0, []));
}

// ============================================================================
// Policy Subscriptions
// ============================================================================

/**
 * Subscribe to policies
 */
export function subscribeToPolicies(
    organizationId: string,
    onPolicies: (policies: AgentPolicy[]) => void,
    onError?: (error: Error) => void,
    scope?: PolicyScope
): Unsubscribe {
    let q = query(
        getPoliciesCollection(organizationId),
        orderBy('priority', 'desc')
    );

    if (scope) {
        q = query(q, where('scope', '==', scope));
    }

    return onSnapshot(
        q,
        (snapshot) => {
            const policies = snapshot.docs.map(d => docToPolicy(d));
            onPolicies(policies);
        },
        (error) => {
            ErrorLogger.error(error, 'AgentPolicyService.subscribeToPolicies', {
                component: 'AgentPolicyService',
                action: 'subscribeToPolicies',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Get policy by ID
 */
export async function getPolicy(
    organizationId: string,
    policyId: string
): Promise<AgentPolicy | null> {
    try {
        const docRef = doc(getPoliciesCollection(organizationId), policyId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        const data = snapshot.data();
        return {
            id: snapshot.id,
            organizationId: data.organizationId || organizationId,
            name: data.name || '',
            description: data.description || '',
            scope: data.scope || 'global',
            priority: data.priority || 'medium',
            enforcement: data.enforcement || 'audit',
            rules: (data.rules || []) as PolicyRule[],
            version: data.version || 1,
            isEnabled: data.isEnabled ?? data.isActive ?? true,
            isDefault: data.isDefault ?? false,
            targetGroupIds: data.targetGroupIds || [],
            targetAgentIds: data.targetAgentIds || [],
            deploymentStatus: data.deploymentStatus || 'draft',
            pendingAgentCount: data.pendingAgentCount || 0,
            appliedAgentCount: data.appliedAgentCount || 0,
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as AgentPolicy;
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.getPolicy', {
            component: 'AgentPolicyService',
            action: 'getPolicy',
            organizationId,
            policyId,
        });
        throw error;
    }
}

/**
 * Create a new policy
 */
export async function createPolicy(
    organizationId: string,
    policy: Omit<AgentPolicy, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    userId: string
): Promise<string> {
    try {
        const docRef = await addDoc(getPoliciesCollection(organizationId), sanitizeData({
            ...policy,
            version: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
        }));

        // Record history
        await addDoc(getPolicyHistoryCollection(organizationId), sanitizeData({
            policyId: docRef.id,
            changeType: 'created',
            previousVersion: 0,
            newVersion: 1,
            changedRules: [],
            changedBy: userId,
            changedAt: serverTimestamp(),
        }));

        return docRef.id;
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.createPolicy', {
            component: 'AgentPolicyService',
            action: 'createPolicy',
            organizationId,
        });
        throw error;
    }
}

/**
 * Update a policy
 */
export async function updatePolicy(
    organizationId: string,
    policyId: string,
    updates: Partial<AgentPolicy>,
    userId: string,
    reason?: string
): Promise<void> {
    try {
        const policyRef = doc(getPoliciesCollection(organizationId), policyId);
        await runTransaction(db, async (transaction) => {
            const policyDoc = await transaction.get(policyRef);
            if (!policyDoc.exists()) throw new Error('Policy not found');
            const existingPolicy = policyDoc.data();
            const newVersion = (existingPolicy.version || 0) + 1;

            // Find changed rules
            const changedRules: PolicyHistoryEntry['changedRules'] = [];
            if (updates.rules && existingPolicy.rules) {
                for (const newRule of updates.rules) {
                    const oldRule = (existingPolicy.rules as PolicyRule[]).find(r => r.key === newRule.key);
                    if (!oldRule || JSON.stringify(oldRule.value) !== JSON.stringify(newRule.value)) {
                        changedRules.push({
                            ruleKey: newRule.key,
                            previousValue: oldRule?.value,
                            newValue: newRule.value,
                        });
                    }
                }
            }

            transaction.update(policyRef, sanitizeData({
                ...updates,
                version: newVersion,
                updatedAt: serverTimestamp(),
                updatedBy: userId,
            }));

            // Add history entry in same transaction
            const historyRef = doc(collection(db, 'organizations', organizationId, 'policyHistory'));
            transaction.set(historyRef, sanitizeData({
                policyId,
                action: 'updated',
                changeType: 'updated',
                version: newVersion,
                previousVersion: existingPolicy.version || 0,
                newVersion,
                changedRules,
                changes: updates,
                changedBy: userId,
                changedAt: serverTimestamp(),
                reason,
            }));
        });
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.updatePolicy', {
            component: 'AgentPolicyService',
            action: 'updatePolicy',
            organizationId,
            policyId,
        });
        throw error;
    }
}

/**
 * Delete a policy
 */
export async function deletePolicy(
    organizationId: string,
    policyId: string,
    userId: string
): Promise<void> {
    try {
        const policyRef = doc(getPoliciesCollection(organizationId), policyId);
        const policySnap = await getDoc(policyRef);
        const policyData = policySnap.data();

        if (policyData?.isDefault) {
            throw new Error('Cannot delete default policy');
        }

        const batch = writeBatch(db);
        batch.delete(policyRef);
        const historyRef = doc(collection(db, 'organizations', organizationId, 'policyHistory'));
        batch.set(historyRef, sanitizeData({
            policyId,
            action: 'deleted',
            changeType: 'deleted',
            version: policyData?.version || 0,
            previousVersion: policyData?.version || 0,
            newVersion: 0,
            changedRules: [],
            changedBy: userId || 'unknown',
            changedAt: serverTimestamp(),
        }));
        await batch.commit();
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.deletePolicy', {
            component: 'AgentPolicyService',
            action: 'deletePolicy',
            organizationId,
            policyId,
        });
        throw error;
    }
}

/**
 * Enable/disable a policy
 */
export async function togglePolicy(
    organizationId: string,
    policyId: string,
    enabled: boolean,
    userId: string
): Promise<void> {
    try {
        const batch = writeBatch(db);
        const policyRef = doc(getPoliciesCollection(organizationId), policyId);
        batch.update(policyRef, sanitizeData({ isEnabled: enabled, updatedAt: serverTimestamp(), updatedBy: userId }));
        const historyRef = doc(collection(db, 'organizations', organizationId, 'policyHistory'));
        batch.set(historyRef, sanitizeData({
            policyId,
            action: enabled ? 'activated' : 'deactivated',
            changeType: enabled ? 'enabled' : 'disabled',
            previousVersion: 0,
            newVersion: 0,
            changedRules: [],
            changedAt: serverTimestamp(),
            changedBy: userId,
        }));
        await batch.commit();
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.togglePolicy', {
            component: 'AgentPolicyService',
            action: 'togglePolicy',
            organizationId,
            policyId,
        });
        throw error;
    }
}

// ============================================================================
// Policy Inheritance & Resolution
// ============================================================================

/**
 * Get effective policy for an agent
 */
export async function getEffectivePolicy(
    organizationId: string,
    agentId: string
): Promise<EffectivePolicy | null> {
    try {
        // Get all policies
        const policiesSnapshot = await getDocs(
            query(
                getPoliciesCollection(organizationId),
                where('isEnabled', '==', true)
            )
        );

        const policies = policiesSnapshot.docs.map(d => docToPolicy(d));

        // Get groups containing this agent (targeted query instead of full scan)
        const agentGroupsQuery = query(
            getGroupsCollection(organizationId),
            where('agentIds', 'array-contains', agentId)
        );
        const groupsSnapshot = await getDocs(agentGroupsQuery);
        const groups = groupsSnapshot.docs.map(d => docToGroup(d));

        // Also fetch default groups
        const defaultGroupsQuery = query(
            getGroupsCollection(organizationId),
            where('isDefault', '==', true)
        );
        const defaultGroupsSnapshot = await getDocs(defaultGroupsQuery);
        const defaultGroups = defaultGroupsSnapshot.docs.map(d => docToGroup(d));
        // Merge, avoiding duplicates
        const groupMap = new Map(groups.map(g => [g.id, g]));
        for (const dg of defaultGroups) {
            if (!groupMap.has(dg.id)) {
                groupMap.set(dg.id, dg);
            }
        }

        const allGroups = Array.from(groupMap.values());
        const agentGroupIds = allGroups
            .filter(g => g.agentIds.includes(agentId) || g.isDefault)
            .map(g => g.id);

        // Filter applicable policies
        const applicablePolicies = policies.filter(p => {
            if (p.scope === 'global') return true;
            if (p.scope === 'group') {
                return p.targetGroupIds.some(gid => agentGroupIds.includes(gid));
            }
            if (p.scope === 'agent') {
                return p.targetAgentIds.includes(agentId);
            }
            return false;
        });

        // Sort by scope (global first) then priority
        applicablePolicies.sort((a, b) => {
            const scopeOrder = { global: 0, group: 1, agent: 2 };
            const scopeDiff = scopeOrder[a.scope] - scopeOrder[b.scope];
            if (scopeDiff !== 0) return scopeDiff;
            return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        });

        if (applicablePolicies.length === 0) {
            return null;
        }

        // Merge rules with inheritance
        let mergedRules: PolicyRule[] = [];
        const sourcePolicies: EffectivePolicy['sourcePolicies'] = [];

        for (const policy of applicablePolicies) {
            if (mergedRules.length === 0) {
                mergedRules = [...policy.rules];
            } else {
                mergedRules = mergeRulesWithInheritance(
                    mergedRules,
                    policy.rules,
                    { id: policy.id, name: policy.name, scope: policy.scope }
                );
            }

            sourcePolicies.push({
                policyId: policy.id,
                policyName: policy.name,
                scope: policy.scope,
                priority: policy.priority,
            });
        }

        // Convert to agent config
        const agentConfig = rulesToAgentConfig(mergedRules);

        // Generate config hash
        const configHash = generateConfigHash(agentConfig as unknown as Record<string, unknown>);

        return {
            agentId,
            agentHostname: '', // Will be filled by caller
            rules: mergedRules,
            sourcePolicies,
            agentConfig,
            computedAt: new Date().toISOString(),
            configHash,
        };
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.getEffectivePolicy', {
            component: 'AgentPolicyService',
            action: 'getEffectivePolicy',
            organizationId,
            agentId,
        });
        throw error;
    }
}

/**
 * Detect policy conflicts
 */
export function detectPolicyConflicts(
    policies: AgentPolicy[]
): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];
    const rulesByKey = new Map<string, Array<{
        policyId: string;
        policyName: string;
        scope: PolicyScope;
        value: unknown;
        priority: number;
    }>>();

    // Group rules by key
    for (const policy of policies) {
        if (!policy.isEnabled) continue;

        for (const rule of policy.rules) {
            if (!rulesByKey.has(rule.key)) {
                rulesByKey.set(rule.key, []);
            }
            rulesByKey.get(rule.key)!.push({
                policyId: policy.id,
                policyName: policy.name,
                scope: policy.scope,
                value: rule.value,
                priority: getPriorityWeight(policy.priority),
            });
        }
    }

    // Find conflicts
    for (const [key, values] of rulesByKey) {
        const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
        if (uniqueValues.size > 1) {
            // Sort by scope then priority to find winner
            const sorted = [...values].sort((a, b) => {
                const scopeOrder = { global: 0, group: 1, agent: 2 };
                const scopeDiff = scopeOrder[b.scope] - scopeOrder[a.scope];
                if (scopeDiff !== 0) return scopeDiff;
                return b.priority - a.priority;
            });

            const winner = sorted[0];

            conflicts.push({
                ruleKey: key,
                ruleName: key, // Would need rule template to get proper name
                values: values.map(v => ({
                    policyId: v.policyId,
                    policyName: v.policyName,
                    scope: v.scope,
                    value: v.value,
                })),
                resolution: {
                    policyId: winner.policyId,
                    value: winner.value,
                    reason: `Politique "${winner.policyName}" (${winner.scope}, priorité haute)`,
                },
            });
        }
    }

    return conflicts;
}

// ============================================================================
// Policy Deployment
// ============================================================================

/**
 * Deploy a policy
 */
export async function deployPolicy(
    organizationId: string,
    policyId: string,
    userId: string
): Promise<void> {
    try {
        const deploy = httpsCallable(functions, 'deployAgentPolicy');
        await deploy({ organizationId, policyId, userId });
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.deployPolicy', {
            component: 'AgentPolicyService',
            action: 'deployPolicy',
            organizationId,
            policyId,
        });
        throw error;
    }
}

/**
 * Rollback a policy
 */
export async function rollbackPolicy(
    organizationId: string,
    policyId: string,
    toVersion: number,
    userId: string
): Promise<void> {
    try {
        const rollback = httpsCallable(functions, 'rollbackAgentPolicy');
        await rollback({ organizationId, policyId, toVersion, userId });
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.rollbackPolicy', {
            component: 'AgentPolicyService',
            action: 'rollbackPolicy',
            organizationId,
            policyId,
        });
        throw error;
    }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Subscribe to policy statistics
 */
export function subscribeToPolicyStats(
    organizationId: string,
    onStats: (stats: PolicyStats | null) => void,
    onError?: (error: Error) => void
): Unsubscribe {
    return onSnapshot(
        getPolicyStatsDoc(organizationId),
        (snapshot) => {
            if (snapshot.exists()) {
                onStats(snapshot.data() as PolicyStats);
            } else {
                onStats(null);
            }
        },
        (error) => {
            ErrorLogger.error(error, 'AgentPolicyService.subscribeToPolicyStats', {
                component: 'AgentPolicyService',
                action: 'subscribeToPolicyStats',
                organizationId,
            });
            if (onError) onError(error);
        }
    );
}

/**
 * Get policy history
 */
export async function getPolicyHistory(
    organizationId: string,
    policyId: string,
    limitCount: number = 20
): Promise<PolicyHistoryEntry[]> {
    try {
        const q = query(
            getPolicyHistoryCollection(organizationId),
            where('policyId', '==', policyId),
            orderBy('changedAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                id: d.id,
                changedAt: data.changedAt?.toDate?.()?.toISOString() || data.changedAt,
            } as PolicyHistoryEntry;
        });
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.getPolicyHistory', {
            component: 'AgentPolicyService',
            action: 'getPolicyHistory',
            organizationId,
            policyId,
        });
        throw error;
    }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize default group and policy for an organization
 */
export async function initializeDefaultsIfNeeded(
    organizationId: string,
    userId: string
): Promise<void> {
    try {
        // Check for existing default group
        const groupsSnapshot = await getDocs(
            query(
                getGroupsCollection(organizationId),
                where('isDefault', '==', true),
                limit(1)
            )
        );

        if (groupsSnapshot.empty) {
            const defaultGroup = createDefaultGroup(organizationId, userId);
            await addDoc(getGroupsCollection(organizationId), sanitizeData({
                ...defaultGroup,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }));
        }

        // Check for existing default global policy
        const policiesSnapshot = await getDocs(
            query(
                getPoliciesCollection(organizationId),
                where('scope', '==', 'global'),
                where('isDefault', '==', true),
                limit(1)
            )
        );

        if (policiesSnapshot.empty) {
            const defaultPolicy = createDefaultGlobalPolicy(organizationId, userId);
            await addDoc(getPoliciesCollection(organizationId), sanitizeData({
                ...defaultPolicy,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }));
        }
    } catch (error) {
        ErrorLogger.error(error, 'AgentPolicyService.initializeDefaultsIfNeeded', {
            component: 'AgentPolicyService',
            action: 'initializeDefaultsIfNeeded',
            organizationId,
        });
        throw error;
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a hash for config change detection
 */
function generateConfigHash(config: Record<string, unknown>): string {
    const sortedStr = JSON.stringify(config, Object.keys(config).sort());
    // Use a better hash - FNV-1a 32-bit
    let hash = 2166136261;
    for (let i = 0; i < sortedStr.length; i++) {
        hash ^= sortedStr.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Validate policy rules
 */
export function validatePolicyRules(rules: PolicyRule[]): string[] {
    const errors: string[] = [];

    for (const rule of rules) {
        // Check required rules
        if (rule.isRequired && (rule.value === undefined || rule.value === null || rule.value === '')) {
            errors.push(`La règle "${rule.name}" est requise`);
        }

        // Check number constraints
        if (rule.valueType === 'number' && typeof rule.value === 'number') {
            if (rule.minValue !== undefined && rule.value < rule.minValue) {
                errors.push(`${rule.name} doit être >= ${rule.minValue}`);
            }
            if (rule.maxValue !== undefined && rule.value > rule.maxValue) {
                errors.push(`${rule.name} doit être <= ${rule.maxValue}`);
            }
        }

        // Check allowed values
        if (rule.allowedValues && rule.allowedValues.length > 0) {
            const allowed = rule.allowedValues.map(v => v.value);
            if (!allowed.includes(rule.value)) {
                errors.push(`${rule.name} a une valeur non autorisée`);
            }
        }

        // Check validation pattern with ReDoS protection
        if (rule.validationPattern && typeof rule.value === 'string') {
            if (!isSafeRegex(rule.validationPattern)) {
                errors.push(`Rule "${rule.name}": unsafe regex pattern (too long or nested quantifiers)`);
                continue;
            }
            try {
                const regex = new RegExp(rule.validationPattern);
                if (!regex.test(rule.value)) {
                    errors.push(rule.validationMessage || `${rule.name} format invalide`);
                }
            } catch {
                errors.push(`Rule "${rule.name}": invalid regex pattern`);
            }
        }
    }

    return errors;
}
