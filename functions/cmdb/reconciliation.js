/**
 * CMDB Reconciliation Cloud Functions
 *
 * Handles agent sync data reconciliation with the CMDB.
 * Implements the Identification & Reconciliation Engine (IRE).
 *
 * @module functions/cmdb/reconciliation
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize MAC address to lowercase with colons
 */
function normalizeMacAddress(mac) {
  if (!mac) return null;
  return mac.toLowerCase().replace(/[:-]/g, ':').replace(/(.{2})(?=.)/g, '$1:');
}

/**
 * Normalize hostname (lowercase, no domain)
 */
function normalizeHostname(hostname) {
  if (!hostname) return null;
  return hostname.toLowerCase().split('.')[0];
}

/**
 * Generate fingerprint from agent data
 */
function generateFingerprint(agentData) {
  const system = agentData.system || {};
  const network = agentData.networkInterfaces?.[0] || {};

  return {
    serialNumber: system.serialNumber || null,
    primaryMacAddress: normalizeMacAddress(network.mac),
    hostname: normalizeHostname(system.hostname),
    fqdn: system.fqdn?.toLowerCase() || null,
    osFingerprint: system.os
      ? `${system.os.type}-${system.os.version}-${system.os.arch}`.toLowerCase()
      : null,
    cloudInstanceId: system.cloudInstanceId || null,
  };
}

/**
 * Calculate Data Quality Score (DQS) for a CI
 */
function calculateDQS(fingerprint, attributes) {
  let score = 0;
  let maxScore = 0;

  // Fingerprint fields (high weight)
  const fingerprintFields = [
    { field: 'serialNumber', weight: 20 },
    { field: 'primaryMacAddress', weight: 15 },
    { field: 'hostname', weight: 15 },
    { field: 'fqdn', weight: 10 },
    { field: 'osFingerprint', weight: 10 },
  ];

  for (const { field, weight } of fingerprintFields) {
    maxScore += weight;
    if (fingerprint[field]) {
      score += weight;
    }
  }

  // Attribute fields (lower weight)
  const attributeFields = [
    'cpuModel', 'ramGB', 'storageGB', 'primaryIpAddress',
    'manufacturer', 'model', 'biosVersion',
  ];

  for (const field of attributeFields) {
    maxScore += 5;
    if (attributes[field]) {
      score += 5;
    }
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Default identification rules with priority
 */
const DEFAULT_RULES = [
  {
    priority: 1,
    name: 'Serial Number Exact',
    field: 'fingerprint.serialNumber',
    matchType: 'exact',
    weight: 100,
    required: true,
  },
  {
    priority: 2,
    name: 'MAC Address Exact',
    field: 'fingerprint.primaryMacAddress',
    matchType: 'exact',
    weight: 90,
    required: true,
  },
  {
    priority: 3,
    name: 'Cloud Instance ID',
    field: 'fingerprint.cloudInstanceId',
    matchType: 'exact',
    weight: 95,
    required: true,
  },
  {
    priority: 4,
    name: 'Hostname + OS Combo',
    fields: ['fingerprint.hostname', 'fingerprint.osFingerprint'],
    matchType: 'combo',
    weight: 80,
    required: true,
  },
];

/**
 * Get nested field value from object
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Run identification rules against existing CIs
 */
async function runIdentificationRules(organizationId, fingerprint) {
  const candidates = [];

  // Get all CIs for the organization
  const cisSnapshot = await db
    .collection('cmdb_cis')
    .where('organizationId', '==', organizationId)
    .where('status', 'in', ['In_Use', 'In_Stock', 'In_Maintenance'])
    .get();

  if (cisSnapshot.empty) {
    return { ciId: null, confidence: 0, matchRule: 'none', candidates: [] };
  }

  for (const doc of cisSnapshot.docs) {
    const ci = { id: doc.id, ...doc.data() };
    let bestScore = 0;
    let bestRule = 'none';

    for (const rule of DEFAULT_RULES) {
      if (rule.matchType === 'exact') {
        const ciValue = getNestedValue(ci, rule.field);
        const fpValue = getNestedValue({ fingerprint }, rule.field);

        if (ciValue && fpValue && ciValue === fpValue) {
          if (rule.weight > bestScore) {
            bestScore = rule.weight;
            bestRule = rule.name;
          }
        }
      } else if (rule.matchType === 'combo') {
        const allMatch = rule.fields.every((field) => {
          const ciValue = getNestedValue(ci, field);
          const fpValue = getNestedValue({ fingerprint }, field);
          return ciValue && fpValue && ciValue === fpValue;
        });

        if (allMatch && rule.weight > bestScore) {
          bestScore = rule.weight;
          bestRule = rule.name;
        }
      }
    }

    if (bestScore > 0) {
      candidates.push({
        ciId: ci.id,
        confidence: bestScore,
        rule: bestRule,
      });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return { ciId: null, confidence: 0, matchRule: 'none', candidates: [] };
  }

  const best = candidates[0];
  return {
    ciId: best.ciId,
    confidence: best.confidence,
    matchRule: best.rule,
    candidates: candidates.slice(0, 5), // Top 5 candidates
  };
}

/**
 * Get reconciliation config for organization
 */
async function getReconciliationConfig(organizationId) {
  const configDoc = await db
    .collection('cmdb_reconciliation_config')
    .doc(organizationId)
    .get();

  if (configDoc.exists) {
    return configDoc.data();
  }

  // Return defaults
  return {
    autoCreateCI: false,
    autoMatchThreshold: 80,
    requireValidation: true,
    validationThreshold: 70,
  };
}

/**
 * Create CI from agent data
 */
function createCIFromAgentData(organizationId, agentId, agentData, fingerprint) {
  const system = agentData.system || {};
  const network = agentData.networkInterfaces?.[0] || {};
  const hardware = agentData.hardware || {};

  const attributes = {
    hardwareType: system.deviceType || 'Workstation',
    manufacturer: hardware.manufacturer || system.manufacturer || null,
    model: hardware.model || system.model || null,
    serialNumber: fingerprint.serialNumber,
    cpuModel: hardware.cpu?.model || null,
    cpuCores: hardware.cpu?.cores || null,
    cpuFrequencyMhz: hardware.cpu?.frequency || null,
    ramGB: hardware.memory?.totalGB || null,
    storageGB: hardware.storage?.totalGB || null,
    storageType: hardware.storage?.type || null,
    primaryIpAddress: network.ipv4?.[0] || null,
    primaryMacAddress: fingerprint.primaryMacAddress,
    hostname: fingerprint.hostname,
    fqdn: fingerprint.fqdn,
    biosVendor: hardware.bios?.vendor || null,
    biosVersion: hardware.bios?.version || null,
  };

  return {
    organizationId,
    ciClass: 'Hardware',
    ciType: 'Workstation',
    fingerprint,
    name: fingerprint.hostname || `Agent-${agentId.slice(0, 8)}`,
    description: `Discovered by Sentinel Agent`,
    status: 'In_Use',
    environment: 'Production',
    criticality: 'Medium',
    ownerId: 'system',
    dataQualityScore: calculateDQS(fingerprint, attributes),
    discoverySource: 'Agent',
    sourceAgentId: agentId,
    lastDiscoveredAt: Timestamp.now(),
    lastReconciliationAt: Timestamp.now(),
    attributes,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'system',
    updatedBy: 'system',
  };
}

/**
 * Update existing CI with agent data
 */
async function updateCIFromAgentData(ciId, agentId, agentData, fingerprint) {
  const system = agentData.system || {};
  const hardware = agentData.hardware || {};
  const network = agentData.networkInterfaces?.[0] || {};

  const updates = {
    lastDiscoveredAt: Timestamp.now(),
    lastReconciliationAt: Timestamp.now(),
    sourceAgentId: agentId,
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };

  // Update attributes if available
  const attributeUpdates = {};
  if (hardware.cpu?.model) attributeUpdates['attributes.cpuModel'] = hardware.cpu.model;
  if (hardware.cpu?.cores) attributeUpdates['attributes.cpuCores'] = hardware.cpu.cores;
  if (hardware.memory?.totalGB) attributeUpdates['attributes.ramGB'] = hardware.memory.totalGB;
  if (hardware.storage?.totalGB) attributeUpdates['attributes.storageGB'] = hardware.storage.totalGB;
  if (network.ipv4?.[0]) attributeUpdates['attributes.primaryIpAddress'] = network.ipv4[0];
  if (hardware.bios?.version) attributeUpdates['attributes.biosVersion'] = hardware.bios.version;

  await db.collection('cmdb_cis').doc(ciId).update({
    ...updates,
    ...attributeUpdates,
  });
}

// =============================================================================
// CLOUD FUNCTIONS
// =============================================================================

/**
 * Trigger: Agent sync data created
 * Runs reconciliation when new agent data arrives
 */
exports.onAgentSync = onDocumentCreated(
  {
    document: 'organizations/{orgId}/agents/{agentId}/results/{resultId}',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (event) => {
    const { orgId, agentId } = event.params;
    const data = event.data.data();

    // Only process system scans
    if (data.type !== 'system') {
      return;
    }

    console.log(`[CMDB] Processing agent sync: org=${orgId}, agent=${agentId}`);

    try {
      const agentData = data.data || {};
      const fingerprint = generateFingerprint(agentData);

      // Run identification rules
      const matchResult = await runIdentificationRules(orgId, fingerprint);
      console.log(`[CMDB] Match result: confidence=${matchResult.confidence}, rule=${matchResult.matchRule}`);

      // Get reconciliation config
      const config = await getReconciliationConfig(orgId);

      // High confidence match - auto-update
      if (matchResult.confidence >= config.autoMatchThreshold && matchResult.ciId) {
        console.log(`[CMDB] Auto-updating CI ${matchResult.ciId}`);
        await updateCIFromAgentData(matchResult.ciId, agentId, agentData, fingerprint);
        return;
      }

      // Medium confidence or no match - queue for validation
      if (config.requireValidation &&
          (matchResult.confidence < config.autoMatchThreshold || !matchResult.ciId)) {
        console.log(`[CMDB] Queueing for validation`);
        await db.collection('cmdb_validation_queue').add({
          organizationId: orgId,
          agentId,
          agentData,
          fingerprint,
          matchResult,
          status: 'Pending',
          createdAt: Timestamp.now(),
        });
        return;
      }

      // Auto-create new CI if enabled and no match
      if (config.autoCreateCI && !matchResult.ciId) {
        console.log(`[CMDB] Auto-creating new CI`);
        const newCI = createCIFromAgentData(orgId, agentId, agentData, fingerprint);
        await db.collection('cmdb_cis').add(newCI);
        return;
      }

      console.log(`[CMDB] No action taken - manual intervention required`);

    } catch (error) {
      console.error(`[CMDB] Reconciliation error:`, error);
      throw error;
    }
  }
);

/**
 * Callable: Process validation queue item
 * Allows admins to approve, reject, or merge validation items
 */
exports.processValidationItem = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { itemId, action, mergeTargetId, notes } = request.data;

    if (!itemId || !action) {
      throw new HttpsError('invalid-argument', 'itemId and action are required');
    }

    if (!['approve', 'reject', 'merge'].includes(action)) {
      throw new HttpsError('invalid-argument', 'Invalid action');
    }

    if (action === 'merge' && !mergeTargetId) {
      throw new HttpsError('invalid-argument', 'mergeTargetId required for merge action');
    }

    // Get validation item
    const itemDoc = await db.collection('cmdb_validation_queue').doc(itemId).get();
    if (!itemDoc.exists) {
      throw new HttpsError('not-found', 'Validation item not found');
    }

    const item = itemDoc.data();
    const orgId = item.organizationId;

    // Verify user belongs to organization
    const userOrgId = request.auth.token.organizationId;
    if (userOrgId !== orgId) {
      throw new HttpsError('permission-denied', 'Access denied');
    }

    const userId = request.auth.uid;
    const batch = db.batch();

    try {
      if (action === 'approve') {
        // Create new CI from agent data
        const newCI = createCIFromAgentData(
          orgId,
          item.agentId,
          item.agentData,
          item.fingerprint
        );
        const ciRef = db.collection('cmdb_cis').doc();
        batch.set(ciRef, newCI);
      } else if (action === 'merge') {
        // Update existing CI
        await updateCIFromAgentData(
          mergeTargetId,
          item.agentId,
          item.agentData,
          item.fingerprint
        );
      }

      // Update validation item status
      const updateData = {
        status: action === 'approve' ? 'Approved' : action === 'merge' ? 'Merged' : 'Rejected',
        processedAt: Timestamp.now(),
        processedBy: userId,
        notes: notes || null,
      };

      batch.update(itemDoc.ref, updateData);
      await batch.commit();

      return { success: true, action };

    } catch (error) {
      console.error('[CMDB] Process validation error:', error);
      throw new HttpsError('internal', 'Failed to process validation item');
    }
  }
);

/**
 * Callable: Get discovery statistics
 */
exports.getDiscoveryStats = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const orgId = request.auth.token.organizationId;
    if (!orgId) {
      throw new HttpsError('permission-denied', 'Organization not found');
    }

    try {
      const now = Timestamp.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(todayStart);

      // Get all CIs
      const cisSnapshot = await db
        .collection('cmdb_cis')
        .where('organizationId', '==', orgId)
        .get();

      // Get pending validations
      const pendingSnapshot = await db
        .collection('cmdb_validation_queue')
        .where('organizationId', '==', orgId)
        .where('status', '==', 'Pending')
        .get();

      let total = 0;
      let matched = 0;
      let missing = 0;
      let createdToday = 0;
      let updatedToday = 0;
      let totalDQS = 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysTimestamp = Timestamp.fromDate(thirtyDaysAgo);

      for (const doc of cisSnapshot.docs) {
        const ci = doc.data();
        total++;

        if (ci.sourceAgentId) matched++;
        if (ci.lastDiscoveredAt && ci.lastDiscoveredAt < thirtyDaysTimestamp) missing++;
        if (ci.createdAt >= todayTimestamp) createdToday++;
        if (ci.updatedAt >= todayTimestamp) updatedToday++;
        totalDQS += ci.dataQualityScore || 0;
      }

      return {
        total,
        pending: pendingSnapshot.size,
        matched,
        missing,
        createdToday,
        updatedToday,
        avgDataQualityScore: total > 0 ? Math.round(totalDQS / total) : 0,
      };

    } catch (error) {
      console.error('[CMDB] Get stats error:', error);
      throw new HttpsError('internal', 'Failed to get discovery stats');
    }
  }
);
