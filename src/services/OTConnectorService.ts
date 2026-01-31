/**
 * OT Connector Service
 * Story 36-2: OT Connector Configuration
 *
 * Service for managing OT connectors - CRUD operations,
 * sync scheduling, status management, and sync history.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import type {
  OTConnector,
  OTConnectorType,
  OTConnectorFormData,
  ConnectorConfig,
  ConnectorStatus,
  SyncSchedule,
  SyncResult,
  SyncStats,
  ConnectorValidationResult,
  TestConnectionResult,
  CSVConnectorConfig
} from '../types/otConnector';

// ============================================================================
// Regex Safety Helper
// ============================================================================

/**
 * Check if a regex pattern is safe from ReDoS attacks.
 * Rejects patterns with nested quantifiers and excessive length.
 */
export function isSafeRegex(pattern: string): boolean {
  if (pattern.length > 200) return false;

  // Detect nested quantifiers that can cause catastrophic backtracking
  // Patterns like (.*)+, (.+)+, (a*)*,  (a+)+, (a|a)*, etc.
  const nestedQuantifierPatterns = [
    /\(.*[*+]\).*[*+]/, // (something*)+  or (something+)*
    /\([^)]*\|[^)]*\)\*/, // (a|a)*
    /\(\.\*\)\+/, // (.*)+
    /\(\.\+\)\+/, // (.+)+
    /\([^)]*[*+][^)]*\)[*+?]/, // (a*)+, (a+)*, (a+)+, (a*)?, etc.
  ];

  for (const dangerousPattern of nestedQuantifierPatterns) {
    if (dangerousPattern.test(pattern)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Collection References
// ============================================================================

const getConnectorsCollection = (organizationId: string) =>
  collection(db, 'organizations', organizationId, 'otConnectors');

const getSyncHistoryCollection = (organizationId: string, connectorId: string) =>
  collection(db, 'organizations', organizationId, 'otConnectors', connectorId, 'syncHistory');

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all connectors for an organization
 */
export async function getConnectors(organizationId: string): Promise<OTConnector[]> {
  try {
    const q = query(
      getConnectorsCollection(organizationId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as OTConnector));
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.getConnectors', {
      component: 'OTConnectorService',
      action: 'getConnectors',
      organizationId
    });
    throw error;
  }
}

/**
 * Get a single connector by ID
 */
export async function getConnector(
  organizationId: string,
  connectorId: string
): Promise<OTConnector | null> {
  try {
    const docRef = doc(getConnectorsCollection(organizationId), connectorId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    } as OTConnector;
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.getConnector', {
      component: 'OTConnectorService',
      action: 'getConnector',
      organizationId,
      metadata: { connectorId }
    });
    throw error;
  }
}

/**
 * Create a new connector
 */
export async function createConnector(
  organizationId: string,
  userId: string,
  data: OTConnectorFormData
): Promise<OTConnector> {
  try {
    // Validate before creating
    const validation = validateConnector(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const docRef = doc(getConnectorsCollection(organizationId));
    const now = new Date().toISOString();

    // Calculate next run if schedule is not manual
    const schedule: SyncSchedule = {
      ...data.schedule,
      type: data.schedule.type || 'manual',
      nextRun: data.schedule.type !== 'manual' ? calculateNextRun(data.schedule as SyncSchedule) : undefined
    };

    const connector: Omit<OTConnector, 'id'> = {
      organizationId,
      name: data.name,
      description: data.description,
      type: data.type,
      config: buildConnectorConfig(data.type, data.config),
      schedule,
      status: 'configuring',
      enabled: data.enabled,
      tags: data.tags,
      createdAt: now,
      updatedAt: now,
      createdBy: userId
    };

    await setDoc(docRef, {
      ...connector,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      id: docRef.id,
      ...connector
    };
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.createConnector', {
      component: 'OTConnectorService',
      action: 'createConnector',
      organizationId
    });
    throw error;
  }
}

/**
 * Update an existing connector
 */
export async function updateConnector(
  organizationId: string,
  connectorId: string,
  data: Partial<OTConnectorFormData>
): Promise<void> {
  try {
    const docRef = doc(getConnectorsCollection(organizationId), connectorId);

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.tags !== undefined) updateData.tags = data.tags;

    if (data.config !== undefined) {
      // Get current connector to merge config
      const current = await getConnector(organizationId, connectorId);
      if (current) {
        updateData.config = { ...current.config, ...data.config };
      }
    }

    if (data.schedule !== undefined) {
      const schedule: SyncSchedule = {
        type: data.schedule.type || 'manual',
        ...data.schedule,
        nextRun: data.schedule.type !== 'manual'
          ? calculateNextRun(data.schedule as SyncSchedule)
          : undefined
      };
      updateData.schedule = schedule;
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.updateConnector', {
      component: 'OTConnectorService',
      action: 'updateConnector',
      organizationId,
      metadata: { connectorId }
    });
    throw error;
  }
}

/**
 * Delete a connector
 */
export async function deleteConnector(
  organizationId: string,
  connectorId: string
): Promise<void> {
  try {
    const docRef = doc(getConnectorsCollection(organizationId), connectorId);
    await deleteDoc(docRef);
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.deleteConnector', {
      component: 'OTConnectorService',
      action: 'deleteConnector',
      organizationId,
      metadata: { connectorId }
    });
    throw error;
  }
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Update connector status
 */
export async function updateConnectorStatus(
  organizationId: string,
  connectorId: string,
  status: ConnectorStatus,
  errorMessage?: string
): Promise<void> {
  try {
    const docRef = doc(getConnectorsCollection(organizationId), connectorId);

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp()
    };

    if (status === 'error' && errorMessage) {
      updateData.errorMessage = errorMessage;
    } else if (status !== 'error') {
      updateData.errorMessage = null;
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.updateConnectorStatus', {
      component: 'OTConnectorService',
      action: 'updateConnectorStatus',
      organizationId,
      metadata: { connectorId }
    });
    throw error;
  }
}

/**
 * Pause a connector
 */
export async function pauseConnector(
  organizationId: string,
  connectorId: string
): Promise<void> {
  await updateConnectorStatus(organizationId, connectorId, 'paused');
}

/**
 * Activate a connector
 */
export async function activateConnector(
  organizationId: string,
  connectorId: string
): Promise<void> {
  const connector = await getConnector(organizationId, connectorId);
  if (!connector) throw new Error('Connector not found');

  // Recalculate next run
  if (connector.schedule.type !== 'manual') {
    await updateDoc(doc(getConnectorsCollection(organizationId), connectorId), {
      status: 'active',
      'schedule.nextRun': calculateNextRun(connector.schedule),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateConnectorStatus(organizationId, connectorId, 'active');
  }
}

// ============================================================================
// Sync History
// ============================================================================

/**
 * Get sync history for a connector
 */
export async function getSyncHistory(
  organizationId: string,
  connectorId: string,
  limitCount = 50
): Promise<SyncResult[]> {
  try {
    const q = query(
      getSyncHistoryCollection(organizationId, connectorId),
      orderBy('startedAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SyncResult));
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.getSyncHistory', {
      component: 'OTConnectorService',
      action: 'getSyncHistory',
      organizationId,
      metadata: { connectorId }
    });
    throw error;
  }
}

/**
 * Record a sync result
 */
export async function recordSyncResult(
  organizationId: string,
  connectorId: string,
  result: Omit<SyncResult, 'id' | 'connectorId'>
): Promise<string> {
  try {
    const docRef = doc(getSyncHistoryCollection(organizationId, connectorId));

    await setDoc(docRef, {
      ...result,
      connectorId,
      startedAt: result.startedAt
    });

    // Update connector with last sync info
    await updateDoc(doc(getConnectorsCollection(organizationId), connectorId), {
      lastSync: {
        id: docRef.id,
        completedAt: result.completedAt,
        status: result.status,
        stats: result.stats
      },
      status: result.status === 'failed' ? 'error' : 'active',
      errorMessage: result.status === 'failed' && result.errors.length > 0
        ? result.errors[0].message
        : null,
      updatedAt: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.recordSyncResult', {
      component: 'OTConnectorService',
      action: 'recordSyncResult',
      organizationId,
      metadata: { connectorId }
    });
    throw error;
  }
}

// ============================================================================
// Schedule Calculation
// ============================================================================

/**
 * Calculate next run time based on schedule
 */
export function calculateNextRun(schedule: SyncSchedule): string {
  const now = new Date();

  switch (schedule.type) {
    case 'manual':
      return '';

    case 'interval': {
      const intervalMs = (schedule.interval || 60) * 60 * 1000;
      const nextRun = new Date(now.getTime() + intervalMs);
      return applyMaintenanceWindow(nextRun, schedule.maintenanceWindow);
    }

    case 'cron': {
      // Simplified cron parsing - just handle common cases
      // For production, use a proper cron library
      if (schedule.cronExpression) {
        const parts = schedule.cronExpression.split(' ');
        if (parts.length >= 5) {
          const [minute, hour] = parts;
          const nextRun = new Date(now);
          nextRun.setHours(parseInt(hour) || 0, parseInt(minute) || 0, 0, 0);
          if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
          return applyMaintenanceWindow(nextRun, schedule.maintenanceWindow);
        }
      }
      // Fallback to next hour
      const fallback = new Date(now);
      fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
      return fallback.toISOString();
    }

    default:
      return '';
  }
}

/**
 * Apply maintenance window restrictions to next run time
 */
function applyMaintenanceWindow(
  nextRun: Date,
  window?: { start: string; end: string; daysOfWeek?: number[] }
): string {
  if (!window) {
    return nextRun.toISOString();
  }

  const [startHour, startMinute] = window.start.split(':').map(Number);
  const [endHour, endMinute] = window.end.split(':').map(Number);

  const runHour = nextRun.getHours();
  const runMinute = nextRun.getMinutes();
  const runDay = nextRun.getDay();

  // Check if day is allowed
  if (window.daysOfWeek && !window.daysOfWeek.includes(runDay)) {
    // Find next allowed day
    const sortedDays = [...window.daysOfWeek].sort((a, b) => a - b);
    let nextAllowedDay = sortedDays.find(d => d > runDay);
    if (nextAllowedDay === undefined) {
      nextAllowedDay = sortedDays[0];
      nextRun.setDate(nextRun.getDate() + (7 - runDay + nextAllowedDay));
    } else {
      nextRun.setDate(nextRun.getDate() + (nextAllowedDay - runDay));
    }
    nextRun.setHours(startHour, startMinute, 0, 0);
    return nextRun.toISOString();
  }

  // Check if time is within window
  const runTime = runHour * 60 + runMinute;
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (runTime < startTime) {
    nextRun.setHours(startHour, startMinute, 0, 0);
  } else if (runTime > endTime) {
    // Move to next day's start time
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(startHour, startMinute, 0, 0);
  }

  return nextRun.toISOString();
}

/**
 * Get connectors due for sync
 */
export async function getConnectorsDueForSync(organizationId: string): Promise<OTConnector[]> {
  try {
    const connectors = await getConnectors(organizationId);
    const now = new Date().toISOString();

    return connectors.filter(c =>
      c.enabled &&
      c.status === 'active' &&
      c.schedule.type !== 'manual' &&
      c.schedule.nextRun &&
      c.schedule.nextRun <= now
    );
  } catch (error) {
    ErrorLogger.error(error, 'OTConnectorService.getConnectorsDueForSync', {
      component: 'OTConnectorService',
      action: 'getConnectorsDueForSync',
      organizationId
    });
    throw error;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate connector data
 */
export function validateConnector(data: OTConnectorFormData): ConnectorValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  // Name validation
  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Connector name is required' });
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Connector name must be less than 100 characters' });
  }

  // Type validation
  if (!data.type) {
    errors.push({ field: 'type', message: 'Connector type is required' });
  }

  // Type-specific config validation
  if (data.type === 'csv') {
    const csvConfig = data.config as Partial<CSVConnectorConfig>;
    if (!csvConfig.filePattern) {
      errors.push({ field: 'config.filePattern', message: 'File pattern is required for CSV connector' });
    }
  }

  // Schedule validation
  if (data.schedule.type === 'interval' && !data.schedule.interval) {
    errors.push({ field: 'schedule.interval', message: 'Interval is required for interval schedule' });
  }

  if (data.schedule.type === 'cron' && !data.schedule.cronExpression) {
    errors.push({ field: 'schedule.cronExpression', message: 'Cron expression is required for cron schedule' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Test connector connection
 */
export async function testConnection(
  _organizationId: string, // Will be used for real connection testing
  data: OTConnectorFormData
): Promise<TestConnectionResult> {
  try {
    // For now, only CSV connector testing is implemented
    if (data.type === 'csv') {
      const csvConfig = data.config as Partial<CSVConnectorConfig>;

      // Validate file pattern regex with ReDoS protection
      if (csvConfig.filePattern) {
        if (csvConfig.filePattern.length > 100) {
          return {
            success: false,
            message: 'File pattern too long (max 100 characters)'
          };
        }

        if (!isSafeRegex(csvConfig.filePattern)) {
          return {
            success: false,
            message: 'File pattern contains potentially unsafe regex constructs'
          };
        }

        try {
          new RegExp(csvConfig.filePattern);
        } catch {
          return {
            success: false,
            message: 'Invalid file pattern regex'
          };
        }
      }

      // In a real implementation, we would:
      // 1. Check if watch path is accessible
      // 2. List files matching pattern
      // 3. Return sample of found files

      return {
        success: true,
        message: 'CSV connector configuration is valid',
        details: {
          filesFound: 0 // Would be actual count in real implementation
        }
      };
    }

    // Placeholder for other connector types
    return {
      success: false,
      message: `${data.type} connector testing not yet implemented`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build connector config with defaults
 */
function buildConnectorConfig(
  type: OTConnectorType,
  config: Partial<ConnectorConfig>
): ConnectorConfig {
  switch (type) {
    case 'csv':
      return {
        filePattern: '.*\\.csv$',
        archiveProcessed: true,
        encoding: 'utf-8',
        defaultNetworkSegment: 'OT',
        defaultOTCriticality: 'monitoring',
        ...config
      } as CSVConnectorConfig;

    case 'opcua':
      return {
        endpointUrl: '',
        securityMode: 'None',
        ...config
      };

    case 'modbus':
      return {
        connectionType: 'tcp',
        port: 502,
        slaveId: 1,
        ...config
      };

    case 'api':
      return {
        baseUrl: '',
        authType: 'none',
        assetsEndpoint: '/assets',
        method: 'GET',
        ...config
      };

    default:
      return config as ConnectorConfig;
  }
}

/**
 * Format sync stats for display
 */
export function formatSyncStats(stats: SyncStats): string {
  const parts: string[] = [];
  if (stats.created > 0) parts.push(`+${stats.created} created`);
  if (stats.updated > 0) parts.push(`~${stats.updated} updated`);
  if (stats.failed > 0) parts.push(`!${stats.failed} failed`);
  if (parts.length === 0) parts.push('No changes');
  return parts.join(', ');
}

/**
 * Get relative time string
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Export Service
// ============================================================================

export const OTConnectorService = {
  // CRUD
  getConnectors,
  getConnector,
  createConnector,
  updateConnector,
  deleteConnector,

  // Status
  updateConnectorStatus,
  pauseConnector,
  activateConnector,

  // Sync History
  getSyncHistory,
  recordSyncResult,

  // Schedule
  calculateNextRun,
  getConnectorsDueForSync,

  // Validation
  validateConnector,
  testConnection,

  // Helpers
  formatSyncStats,
  getRelativeTime
};

export default OTConnectorService;
