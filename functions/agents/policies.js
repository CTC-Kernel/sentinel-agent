/**
 * Agent Policies - Handles policy management and distribution
 *
 * Supports the 3-tier inheritance model:
 * Global Policy (org-wide) → Group Policy (department) → Agent Policy (override)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Escape special regex characters to prevent ReDoS attacks
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deploy a policy to target agents
 * This creates a deployment record and updates agent configs
 */
exports.deployAgentPolicy = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { policyId } = request.data;

    if (!policyId || !organizationId) {
      throw new HttpsError('invalid-argument', 'policyId and organizationId are required');
    }


    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    if (!userData.role || !['admin', 'manager'].includes(userData.role)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions for this operation');
    }

    try {
      // Get the policy
      const policyRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agentPolicies')
        .doc(policyId);

      const policyDoc = await policyRef.get();
      if (!policyDoc.exists) {
        throw new HttpsError('not-found', 'Policy not found');
      }

      const policy = policyDoc.data();

      // Determine target agents based on policy scope
      let targetAgentIds = [];

      if (policy.scope === 'global') {
        // All agents in organization
        const agentsSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .get();
        targetAgentIds = agentsSnapshot.docs.map(doc => doc.id);
      } else if (policy.scope === 'group' && policy.targetGroupIds?.length > 0) {
        // Agents in specified groups
        const agentIdsSet = new Set();

        for (const groupId of policy.targetGroupIds) {
          const groupDoc = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentGroups')
            .doc(groupId)
            .get();

          if (groupDoc.exists) {
            const group = groupDoc.data();
            (group.agentIds || []).forEach(id => agentIdsSet.add(id));
          }
        }
        targetAgentIds = Array.from(agentIdsSet);
      } else if (policy.scope === 'agent' && policy.targetAgentIds?.length > 0) {
        // Specific agents
        targetAgentIds = policy.targetAgentIds;
      }

      // Create deployment record
      const deploymentRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('policyDeployments')
        .doc();

      const deployment = {
        id: deploymentRef.id,
        policyId,
        policyName: policy.name,
        policyVersion: policy.version || 1,
        targetAgentIds,
        status: 'deploying',
        deployedBy: auth.uid,
        deployedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAgents: [],
        failedAgents: [],
      };

      await deploymentRef.set(deployment);

      // Convert policy rules to agent config format
      const configOverrides = rulesToAgentConfig(policy.rules || []);

      // Update each target agent's pending config
      const batch = db.batch();
      const batchSize = 500;
      let currentBatch = [];

      for (const agentId of targetAgentIds) {
        const agentRef = db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .doc(agentId);

        currentBatch.push(
          agentRef.update({
            pendingPolicyId: policyId,
            pendingConfig: configOverrides,
            pendingConfigAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        );

        // Commit batch if size limit reached
        if (currentBatch.length >= batchSize) {
          await Promise.all(currentBatch);
          currentBatch = [];
        }
      }

      // Commit remaining updates
      if (currentBatch.length > 0) {
        await Promise.all(currentBatch);
      }

      // Update policy deployment status
      await policyRef.update({
        lastDeployedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastDeployedBy: auth.uid,
        lastDeploymentId: deploymentRef.id,
        deploymentCount: admin.firestore.FieldValue.increment(1),
      });

      // Update deployment status
      await deploymentRef.update({
        status: 'pending_ack',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log audit entry
      await db
        .collection('organizations')
        .doc(organizationId)
        .collection('auditLogs')
        .add({
          type: 'policy_deployed',
          policyId,
          policyName: policy.name,
          targetAgentCount: targetAgentIds.length,
          userId: auth.uid,
          deploymentId: deploymentRef.id,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        success: true,
        deploymentId: deploymentRef.id,
        targetAgentCount: targetAgentIds.length,
      };
    } catch (error) {
      logger.error('Deploy policy error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to deploy policy');
    }
  }
);

/**
 * Rollback a policy deployment
 */
exports.rollbackAgentPolicy = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { deploymentId } = request.data;

    if (!deploymentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'deploymentId and organizationId are required');
    }


    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
      // Get the deployment
      const deploymentRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('policyDeployments')
        .doc(deploymentId);

      const deploymentDoc = await deploymentRef.get();
      if (!deploymentDoc.exists) {
        throw new HttpsError('not-found', 'Deployment not found');
      }

      const deployment = deploymentDoc.data();

      // Clear pending config from target agents (batched to stay under 500 limit)
      const BATCH_SIZE = 400;
      for (let i = 0; i < deployment.targetAgentIds.length; i += BATCH_SIZE) {
        const chunk = deployment.targetAgentIds.slice(i, i + BATCH_SIZE);
        const rollbackBatch = db.batch();
        for (const agentId of chunk) {
          const agentRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId);
          rollbackBatch.update(agentRef, {
            pendingPolicyId: admin.firestore.FieldValue.delete(),
            pendingConfig: admin.firestore.FieldValue.delete(),
            pendingConfigAt: admin.firestore.FieldValue.delete(),
          });
        }
        await rollbackBatch.commit();
      }

      // Update deployment status
      await deploymentRef.update({
        status: 'rolled_back',
        rolledBackBy: auth.uid,
        rolledBackAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log audit entry
      await db
        .collection('organizations')
        .doc(organizationId)
        .collection('auditLogs')
        .add({
          type: 'policy_rolled_back',
          deploymentId,
          policyId: deployment.policyId,
          policyName: deployment.policyName,
          userId: auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return { success: true };
    } catch (error) {
      logger.error('Rollback policy error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to rollback policy');
    }
  }
);

/**
 * Get effective policy for an agent (resolving inheritance)
 */
exports.getEffectivePolicy = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { agentId } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
      // Get the agent
      const agentDoc = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .get();

      if (!agentDoc.exists) {
        throw new HttpsError('not-found', 'Agent not found');
      }

      const agent = agentDoc.data();

      // Get all enabled policies ordered by priority
      const policiesSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agentPolicies')
        .where('isEnabled', '==', true)
        .orderBy('priority', 'asc')
        .get();

      const policies = policiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Get agent's groups
      const agentGroupIds = agent.groupIds || [];

      // Filter applicable policies (global, matching groups, or specific agent)
      const applicablePolicies = policies.filter(policy => {
        if (policy.scope === 'global') return true;
        if (policy.scope === 'group' && policy.targetGroupIds?.some(gid => agentGroupIds.includes(gid))) return true;
        if (policy.scope === 'agent' && policy.targetAgentIds?.includes(agentId)) return true;
        return false;
      });

      // Merge rules with inheritance (lower priority first, higher priority overwrites)
      const mergedRules = {};
      const ruleOrigins = {};

      for (const policy of applicablePolicies) {
        for (const rule of policy.rules || []) {
          if (rule.enabled) {
            mergedRules[rule.key] = rule.value;
            ruleOrigins[rule.key] = {
              policyId: policy.id,
              policyName: policy.name,
              scope: policy.scope,
              priority: policy.priority,
            };
          }
        }
      }

      return {
        effectiveRules: mergedRules,
        ruleOrigins,
        appliedPolicies: applicablePolicies.map(p => ({
          id: p.id,
          name: p.name,
          scope: p.scope,
          priority: p.priority,
        })),
        agentConfig: rulesToAgentConfig(
          Object.entries(mergedRules).map(([key, value]) => ({
            key,
            value,
            enabled: true,
          }))
        ),
      };
    } catch (error) {
      logger.error('Get effective policy error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to get effective policy');
    }
  }
);

/**
 * Auto-assign agents to groups based on membership criteria
 * Runs every 15 minutes
 */
exports.autoAssignAgentsToGroups = onSchedule(
  {
    schedule: 'every 15 minutes',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async () => {
    logger.log('Starting auto-assign agents to groups...');

    try {
      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get();

      for (const orgDoc of orgsSnapshot.docs) {
        const organizationId = orgDoc.id;

        // Get all groups with dynamic membership criteria
        const groupsSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agentGroups')
          .get();

        const dynamicGroups = groupsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(group => {
            const criteria = group.membershipCriteria;
            const isManual = Array.isArray(criteria)
              ? criteria.some(c => c.type === 'manual')
              : criteria?.type === 'manual';
            return criteria && !isManual;
          });

        if (dynamicGroups.length === 0) continue;

        // Get all agents
        const agentsSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .get();

        const agents = agentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Evaluate each dynamic group
        for (const group of dynamicGroups) {
          const matchingAgentIds = [];

          for (const agent of agents) {
            if (evaluateAllCriteria(agent, group.membershipCriteria)) {
              matchingAgentIds.push(agent.id);
            }
          }

          // Update group if membership changed using arrayUnion/arrayRemove to avoid race conditions
          const currentAgentIds = group.agentIds || [];
          const newAgentIds = matchingAgentIds.filter(id => !currentAgentIds.includes(id));
          const removedAgentIds = currentAgentIds.filter(id => !matchingAgentIds.includes(id));
          const groupRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentGroups')
            .doc(group.id);

          if (newAgentIds.length > 0) {
            await groupRef.update({
              agentIds: admin.firestore.FieldValue.arrayUnion(...newAgentIds),
              lastAutoAssignAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          if (removedAgentIds.length > 0) {
            await groupRef.update({
              agentIds: admin.firestore.FieldValue.arrayRemove(...removedAgentIds),
              lastAutoAssignAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          if (newAgentIds.length > 0 || removedAgentIds.length > 0) {
            logger.log(
              `Updated group ${group.name} in org ${organizationId}: +${newAgentIds.length} -${removedAgentIds.length} agents`
            );
          }
        }
      }

      logger.log('Auto-assign agents to groups completed');
    } catch (error) {
      logger.error('Auto-assign agents error:', error);
    }
  }
);

/**
 * Trigger: Update agent's groups when agent data changes
 */
exports.onAgentUpdated = onDocumentWritten(
  {
    document: 'organizations/{organizationId}/agents/{agentId}',
    region: 'europe-west1',
  },
  async (event) => {
    const organizationId = event.params.organizationId;
    const agentId = event.params.agentId;

    // Null check for event.data
    if (!event.data) return;

    // Skip if agent was deleted
    if (!event.data.after.exists) return;

    const afterData = event.data.after.data();

    // Debounce guard: skip if updated within 5 seconds to prevent infinite loops
    const lastGroupUpdate = afterData.lastGroupUpdateAt?.toMillis?.() || 0;
    if (Date.now() - lastGroupUpdate < 5000) return;

    try {
      // Get all dynamic groups
      const groupsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agentGroups')
        .get();

      const dynamicGroups = groupsSnapshot.docs
        .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
        .filter(group => {
          const criteria = group.membershipCriteria;
          const isManual = Array.isArray(criteria)
            ? criteria.some(c => c.type === 'manual')
            : criteria?.type === 'manual';
          return criteria && !isManual;
        });

      // Evaluate membership for each dynamic group
      for (const group of dynamicGroups) {
        const shouldBeMember = evaluateAllCriteria(afterData, group.membershipCriteria);
        const currentMembers = group.agentIds || [];
        const isMember = currentMembers.includes(agentId);

        if (shouldBeMember && !isMember) {
          // Add to group
          await group.ref.update({
            agentIds: admin.firestore.FieldValue.arrayUnion(agentId),
          });
        } else if (!shouldBeMember && isMember) {
          // Remove from group
          await group.ref.update({
            agentIds: admin.firestore.FieldValue.arrayRemove(agentId),
          });
        }
      }

      // Update agent's groupIds field
      const memberGroups = [];
      for (const group of groupsSnapshot.docs) {
        const groupData = group.data();
        if ((groupData.agentIds || []).includes(agentId)) {
          memberGroups.push(group.id);
        }
      }

      const currentGroupIds = (afterData.groupIds || []).sort();
      const newGroupIds = memberGroups.sort();
      if (JSON.stringify(currentGroupIds) === JSON.stringify(newGroupIds)) return null;

      await event.data.after.ref.update({
        groupIds: memberGroups,
        lastGroupUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error('On agent updated error:', error);
    }
  }
);

/**
 * Validate policy rules before save
 */
exports.validatePolicyRules = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { rules } = request.data;

    if (!rules || !Array.isArray(rules)) {
      throw new HttpsError('invalid-argument', 'rules array is required');
    }

    const errors = [];
    const warnings = [];

    for (const rule of rules) {
      // Validate required fields
      if (!rule.key) {
        errors.push({ rule: rule.key || 'unknown', message: 'Rule key is required' });
        continue;
      }

      // Validate value type matches expected
      const typeValidation = validateRuleValueType(rule);
      if (!typeValidation.valid) {
        errors.push({ rule: rule.key, message: typeValidation.message });
      }

      // Warn about potentially dangerous values
      if (rule.key === 'check_interval_secs' && rule.value < 300) {
        warnings.push({ rule: rule.key, message: 'Interval less than 5 minutes may impact performance' });
      }

      if (rule.key === 'log_level' && rule.value === 'debug') {
        warnings.push({ rule: rule.key, message: 'Debug logging increases resource usage' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
);

/**
 * Helper: Convert policy rules to agent config format
 */
function rulesToAgentConfig(rules) {
  const config = {};

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Map rule keys to config structure
    switch (rule.key) {
      case 'check_interval_secs':
      case 'heartbeat_interval_secs':
      case 'offline_mode_days':
        config[rule.key] = parseInt(rule.value, 10);
        break;
      case 'log_level':
        config[rule.key] = String(rule.value);
        break;
      case 'enabled_checks':
        config[rule.key] = Array.isArray(rule.value) ? rule.value : [rule.value];
        break;
      case 'disabled_checks':
        config[rule.key] = Array.isArray(rule.value) ? rule.value : [rule.value];
        break;
      case 'enable_realtime_monitoring':
      case 'enable_process_monitoring':
      case 'enable_network_monitoring':
      case 'enable_auto_remediation':
      case 'enable_software_inventory':
      case 'enable_cis_benchmarks':
        config[rule.key] = Boolean(rule.value);
        break;
      default:
        // Store as-is for custom rules
        config[rule.key] = rule.value;
    }
  }

  return config;
}

/**
 * Helper: Evaluate all membership criteria (handles array or single object)
 */
function evaluateAllCriteria(agent, criteriaArray) {
  if (!criteriaArray || (Array.isArray(criteriaArray) && criteriaArray.length === 0)) {
    return false;
  }
  if (!Array.isArray(criteriaArray)) {
    // Handle single object for backward compatibility
    if (criteriaArray && typeof criteriaArray === 'object') {
      return evaluateMembershipCriteria(agent, criteriaArray);
    }
    return false;
  }
  // Default to AND logic: all criteria must match
  return criteriaArray.every(c => evaluateMembershipCriteria(agent, c));
}

/**
 * Helper: Evaluate if an agent matches a single membership criterion
 */
function evaluateMembershipCriteria(agent, criteria) {
  if (!criteria || criteria.type === 'manual') return false;

  switch (criteria.type) {
    case 'os':
      return agent.os?.toLowerCase() === criteria.value?.toLowerCase() ||
             agent.os?.toLowerCase().includes(criteria.value?.toLowerCase());

    case 'hostname_pattern': {
      if (!criteria.value || criteria.value.length > 200) return false;
      try {
        const regex = new RegExp(escapeRegExp(criteria.value), 'i');
        return regex.test(agent.hostname || '');
      } catch (e) {
        logger.warn('Invalid regex pattern in membership criteria', { pattern: criteria.value });
        return false;
      }
    }

    case 'ip_range':
      return isIpInRange(agent.ipAddress, criteria.value);

    case 'tag': {
      const agentTags = agent.tags || [];
      return agentTags.includes(criteria.value);
    }

    case 'department':
      return agent.department?.toLowerCase() === criteria.value?.toLowerCase();

    default:
      return false;
  }
}

/**
 * Helper: Check if IP is in CIDR range
 */
function isIpInRange(ip, cidr) {
  if (!ip || !cidr) return false;

  try {
    const [range, bits] = cidr.split('/');
    const mask = (~(2 ** (32 - parseInt(bits, 10)) - 1)) >>> 0;

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * Helper: Convert IP to number for comparison
 */
function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Helper: Validate rule value matches expected type
 */
function validateRuleValueType(rule) {
  const typeMap = {
    check_interval_secs: 'number',
    heartbeat_interval_secs: 'number',
    offline_mode_days: 'number',
    log_level: 'string',
    enabled_checks: 'array',
    disabled_checks: 'array',
    enable_realtime_monitoring: 'boolean',
    enable_process_monitoring: 'boolean',
    enable_network_monitoring: 'boolean',
    enable_auto_remediation: 'boolean',
    enable_software_inventory: 'boolean',
    enable_cis_benchmarks: 'boolean',
  };

  const expectedType = typeMap[rule.key];
  if (!expectedType) {
    // Custom rule, accept any type
    return { valid: true };
  }

  const actualType = Array.isArray(rule.value) ? 'array' : typeof rule.value;

  if (actualType !== expectedType) {
    return {
      valid: false,
      message: `Expected ${expectedType} but got ${actualType}`,
    };
  }

  // Additional validations
  if (expectedType === 'number' && (isNaN(rule.value) || rule.value < 0)) {
    return { valid: false, message: 'Value must be a positive number' };
  }

  return { valid: true };
}
