/**
 * OT CSV Sync Cloud Functions
 * Story 36-2: OT Connector Configuration
 *
 * Scheduled and callable functions for processing CSV-based
 * OT asset synchronization.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// H3: db initialized inside handlers to avoid module-level initialization issues
// Removed redundant admin.initializeApp() - handled by main index.js

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 500;
const DEFAULT_NETWORK_SEGMENT = 'OT';
const DEFAULT_OT_CRITICALITY = 'monitoring';

// Column mapping - same as frontend otAssetConstants.ts
const OT_CSV_COLUMN_MAPPINGS = {
  name: ['name', 'nom', 'asset_name', 'device_name', 'hostname'],
  deviceType: ['device_type', 'type', 'asset_type', 'category'],
  protocol: ['protocol', 'protocole', 'communication_protocol'],
  manufacturer: ['manufacturer', 'fabricant', 'vendor', 'make', 'brand'],
  model: ['model', 'modèle', 'part_number'],
  firmwareVersion: ['firmware', 'firmware_version', 'version', 'sw_version'],
  networkSegment: ['network_segment', 'segment', 'zone', 'network_zone'],
  otCriticality: ['criticality', 'criticité', 'ot_criticality', 'priority'],
  ipAddress: ['ip_address', 'ip', 'address', 'ip_addr'],
  location: ['location', 'emplacement', 'site', 'building'],
  vlan: ['vlan', 'vlan_id'],
  subnet: ['subnet', 'network', 'cidr'],
  notes: ['notes', 'description', 'comments', 'remarques']
};

const NETWORK_SEGMENT_ALIASES = {
  IT: ['it', 'corporate', 'office', 'entreprise', 'bureau'],
  OT: ['ot', 'industrial', 'scada', 'ics', 'industriel', 'production'],
  DMZ: ['dmz', 'demilitarized', 'perimeter']
};

const OT_CRITICALITY_ALIASES = {
  safety: ['safety', 'sécurité', 'critique', 'critical', 'sis'],
  production: ['production', 'process', 'manufacturing'],
  operations: ['operations', 'opérations', 'control'],
  monitoring: ['monitoring', 'surveillance', 'display', 'hmi']
};

// ============================================================================
// Scheduled Function - Process Due Syncs
// ============================================================================

/**
 * Scheduled function that runs every 15 minutes to process
 * connectors that are due for sync.
 */
exports.processOTConnectorSyncs = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Europe/Paris',
    memory: '512MiB',
    timeoutSeconds: 300
  },
  async (event) => {
    logger.log('Starting OT Connector sync check');
    const db = getFirestore();

    try {
      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get();

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;

        // Get connectors due for sync
        const connectorsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('otConnectors')
          .where('enabled', '==', true)
          .where('status', '==', 'active')
          .get();

        const now = new Date().toISOString();

        for (const connectorDoc of connectorsSnapshot.docs) {
          const connector = connectorDoc.data();

          // Check if due for sync
          if (
            connector.schedule?.type !== 'manual' &&
            connector.schedule?.nextRun &&
            connector.schedule.nextRun <= now
          ) {
            logger.log(`Processing sync for connector: ${connector.name} (${connectorDoc.id})`);

            try {
              await processCSVSync(orgId, connectorDoc.id, connector, 'schedule');
            } catch (error) {
              logger.error(`Sync failed for ${connectorDoc.id}:`, error);

              // Update connector status to error
              await connectorDoc.ref.update({
                status: 'error',
                errorMessage: error.message,
                updatedAt: FieldValue.serverTimestamp()
              });
            }
          }
        }
      }

      logger.log('OT Connector sync check completed');
    } catch (error) {
      logger.error('OT Connector sync check failed:', error);
      throw error;
    }
  }
);

// ============================================================================
// Callable Function - Manual Sync Trigger
// ============================================================================

/**
 * Callable function to trigger a manual sync for a connector.
 */
exports.triggerOTSync = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1'
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Verify organizationId from token claims instead of request.data
    const tokenOrgId = request.auth.token.organizationId;
    const requestedOrgId = request.data.organizationId;
    if (requestedOrgId && requestedOrgId !== tokenOrgId) {
      throw new HttpsError('permission-denied', 'Organization mismatch');
    }
    const organizationId = tokenOrgId || requestedOrgId;

    const { connectorId } = request.data;

    if (!organizationId || !connectorId) {
      throw new HttpsError('invalid-argument', 'organizationId and connectorId are required');
    }

    const db = getFirestore();

    // Get connector
    const connectorRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('otConnectors')
      .doc(connectorId);

    const connectorDoc = await connectorRef.get();

    if (!connectorDoc.exists) {
      throw new HttpsError('not-found', 'Connector not found');
    }

    const connector = connectorDoc.data();

    // Verify connector type is CSV
    if (connector.type !== 'csv') {
      throw new HttpsError('unimplemented', `Sync not implemented for ${connector.type} connectors`);
    }

    try {
      const result = await processCSVSync(
        organizationId,
        connectorId,
        connector,
        'manual',
        request.auth.uid
      );

      return result;
    } catch (error) {
      logger.error('OT sync trigger error:', error);
      throw new HttpsError('internal', 'An internal error occurred during OT sync.');
    }
  }
);

// ============================================================================
// CSV Processing Logic
// ============================================================================

/**
 * Process a CSV sync for a connector.
 * In a real implementation, this would read from cloud storage or
 * a configured watch path. For now, it's a placeholder that
 * demonstrates the sync result recording.
 */
async function processCSVSync(
  organizationId,
  connectorId,
  connector,
  triggeredBy,
  triggeredByUserId = null
) {
  const db = getFirestore();
  const startTime = Date.now();
  const syncId = db
    .collection('organizations')
    .doc(organizationId)
    .collection('otConnectors')
    .doc(connectorId)
    .collection('syncHistory')
    .doc().id;

  const stats = {
    totalProcessed: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0
  };

  const errors = [];

  try {
    // In a real implementation:
    // 1. List files matching connector.config.filePattern in watch path
    // 2. Download and parse each CSV file
    // 3. Map columns using detectColumnMappings logic
    // 4. Validate each row
    // 5. Create/update assets
    // 6. Archive processed files if configured

    // Placeholder: simulate a successful empty sync
    logger.log(`CSV sync for connector ${connectorId}: No files to process`);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Record sync result
    const syncResult = {
      id: syncId,
      connectorId,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
      durationMs,
      status: errors.length > 0 ? (stats.created > 0 ? 'partial' : 'failed') : 'success',
      stats,
      errors,
      triggeredBy,
      triggeredByUserId
    };

    // Save sync history
    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('otConnectors')
      .doc(connectorId)
      .collection('syncHistory')
      .doc(syncId)
      .set(syncResult);

    // Update connector with last sync info and next run
    const updateData = {
      lastSync: {
        id: syncId,
        completedAt: syncResult.completedAt,
        status: syncResult.status,
        stats
      },
      status: syncResult.status === 'failed' ? 'error' : 'active',
      errorMessage: syncResult.status === 'failed' && errors.length > 0
        ? errors[0].message
        : null,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Calculate next run if scheduled
    if (connector.schedule?.type !== 'manual') {
      updateData['schedule.nextRun'] = calculateNextRun(connector.schedule);
    }

    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('otConnectors')
      .doc(connectorId)
      .update(updateData);

    return syncResult;
  } catch (error) {
    logger.error('CSV sync processing error:', error);

    // Record failed sync
    const endTime = Date.now();
    const syncResult = {
      id: syncId,
      connectorId,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
      durationMs: endTime - startTime,
      status: 'failed',
      stats,
      errors: [
        {
          code: 'SYNC_ERROR',
          message: error.message,
          severity: 'error'
        }
      ],
      triggeredBy,
      triggeredByUserId
    };

    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('otConnectors')
      .doc(connectorId)
      .collection('syncHistory')
      .doc(syncId)
      .set(syncResult);

    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate next run time based on schedule.
 */
function calculateNextRun(schedule) {
  const now = new Date();

  switch (schedule.type) {
    case 'manual':
      return null;

    case 'interval': {
      const intervalMs = (schedule.interval || 60) * 60 * 1000;
      const nextRun = new Date(now.getTime() + intervalMs);
      return nextRun.toISOString();
    }

    case 'cron': {
      // Simplified cron handling - just add 1 day for daily crons
      // In production, use a proper cron library like cron-parser
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(2, 0, 0, 0); // Default to 2 AM
      return nextRun.toISOString();
    }

    default:
      return null;
  }
}

/**
 * Normalize network segment value.
 */
function normalizeNetworkSegment(value) {
  if (!value) return DEFAULT_NETWORK_SEGMENT;

  const normalized = value.toLowerCase().trim();

  for (const [segment, aliases] of Object.entries(NETWORK_SEGMENT_ALIASES)) {
    if (aliases.includes(normalized) || normalized === segment.toLowerCase()) {
      return segment;
    }
  }

  return DEFAULT_NETWORK_SEGMENT;
}

/**
 * Normalize OT criticality value.
 */
function normalizeOTCriticality(value) {
  if (!value) return DEFAULT_OT_CRITICALITY;

  const normalized = value.toLowerCase().trim();

  for (const [criticality, aliases] of Object.entries(OT_CRITICALITY_ALIASES)) {
    if (aliases.includes(normalized) || normalized === criticality) {
      return criticality;
    }
  }

  return DEFAULT_OT_CRITICALITY;
}

/**
 * Parse CSV content into rows.
 */
function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      rows.push(parseCSVLine(line));
    }
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quoted values.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Auto-detect column mappings based on header names.
 */
function detectColumnMappings(headers) {
  const mappings = [];

  for (const [fieldName, possibleNames] of Object.entries(OT_CSV_COLUMN_MAPPINGS)) {
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim().replace(/[_\s-]/g, '');

      for (const possibleName of possibleNames) {
        const normalizedPossible = possibleName.toLowerCase().replace(/[_\s-]/g, '');

        if (normalizedHeader === normalizedPossible ||
            normalizedHeader.includes(normalizedPossible) ||
            normalizedPossible.includes(normalizedHeader)) {
          mappings.push({
            csvColumn: header,
            fieldName,
            confidence: normalizedHeader === normalizedPossible ? 1.0 : 0.7
          });
          break;
        }
      }
    }
  }

  return mappings;
}
