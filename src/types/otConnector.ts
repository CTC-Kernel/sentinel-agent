/**
 * OT Connector Types
 * Story 36-2: OT Connector Configuration
 *
 * Types for configuring automated OT asset synchronization
 * from various sources (CSV, OPC-UA, Modbus, REST API).
 */

// ============================================================================
// Connector Types
// ============================================================================

/**
 * Supported OT connector types
 */
export type OTConnectorType = 'csv' | 'opcua' | 'modbus' | 'api';

/**
 * Connector operational status
 */
export type ConnectorStatus = 'active' | 'paused' | 'error' | 'configuring';

// ============================================================================
// Schedule Types
// ============================================================================

/**
 * Sync schedule type
 */
export type ScheduleType = 'manual' | 'interval' | 'cron';

/**
 * Maintenance window for scheduling syncs
 */
export interface MaintenanceWindow {
 /** Start time in HH:MM format */
 start: string;
 /** End time in HH:MM format */
 end: string;
 /** Days of week (0=Sunday, 6=Saturday) */
 daysOfWeek?: number[];
}

/**
 * Sync schedule configuration
 */
export interface SyncSchedule {
 type: ScheduleType;
 /** Interval in minutes (for interval type) */
 interval?: number;
 /** Cron expression (for cron type) */
 cronExpression?: string;
 /** Optional maintenance window restriction */
 maintenanceWindow?: MaintenanceWindow;
 /** Calculated next run timestamp */
 nextRun?: string;
 /** Timezone for schedule */
 timezone?: string;
}

// ============================================================================
// Connector Configurations (per type)
// ============================================================================

/**
 * CSV Import connector configuration
 */
export interface CSVConnectorConfig {
 /** Watch folder path (for file-based sync) */
 watchPath?: string;
 /** File naming pattern (regex) */
 filePattern: string;
 /** Reference to saved column mapping from 36-1 */
 columnMappingId?: string;
 /** Archive processed files */
 archiveProcessed: boolean;
 /** Archive folder path */
 archivePath?: string;
 /** File encoding */
 encoding: 'utf-8' | 'iso-8859-1' | 'windows-1252';
 /** Delete source file after processing */
 deleteAfterProcess?: boolean;
 /** Default network segment for imported assets */
 defaultNetworkSegment?: 'IT' | 'OT' | 'DMZ';
 /** Default OT criticality */
 defaultOTCriticality?: 'safety' | 'production' | 'operations' | 'monitoring';
}

/**
 * OPC-UA connector configuration (placeholder for future)
 */
export interface OPCUAConnectorConfig {
 /** OPC-UA server endpoint URL */
 endpointUrl: string;
 /** Security mode */
 securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
 /** Security policy */
 securityPolicy?: string;
 /** Username for authentication */
 username?: string;
 /** Password (encrypted) */
 password?: string;
 /** Certificate path */
 certificatePath?: string;
 /** Node IDs to browse */
 nodeIds?: string[];
 /** Browse depth */
 browseDepth?: number;
}

/**
 * Modbus connector configuration (placeholder for future)
 */
export interface ModbusConnectorConfig {
 /** Connection type */
 connectionType: 'tcp' | 'rtu';
 /** Host address (for TCP) */
 host?: string;
 /** Port (for TCP, default 502) */
 port?: number;
 /** Serial port (for RTU) */
 serialPort?: string;
 /** Baud rate (for RTU) */
 baudRate?: number;
 /** Slave ID */
 slaveId: number;
 /** Register definitions */
 registers?: ModbusRegister[];
}

/**
 * Modbus register definition
 */
export interface ModbusRegister {
 /** Register address */
 address: number;
 /** Register type */
 type: 'coil' | 'discrete' | 'holding' | 'input';
 /** Data type */
 dataType: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32';
 /** Field name to map to */
 fieldName: string;
}

/**
 * REST API connector configuration (placeholder for future)
 */
export interface APIConnectorConfig {
 /** API base URL */
 baseUrl: string;
 /** Authentication type */
 authType: 'none' | 'basic' | 'bearer' | 'apiKey';
 /** API key (if authType is apiKey) */
 apiKey?: string;
 /** API key header name */
 apiKeyHeader?: string;
 /** Bearer token (if authType is bearer) */
 bearerToken?: string;
 /** Username (if authType is basic) */
 username?: string;
 /** Password (if authType is basic) */
 password?: string;
 /** Endpoint path for asset list */
 assetsEndpoint: string;
 /** HTTP method */
 method: 'GET' | 'POST';
 /** Request headers */
 headers?: Record<string, string>;
 /** Response mapping (JSONPath expressions) */
 responseMapping?: Record<string, string>;
 /** Pagination configuration */
 pagination?: {
 type: 'offset' | 'cursor' | 'page';
 pageParam?: string;
 limitParam?: string;
 limit?: number;
 };
}

/**
 * Union type for all connector configurations
 */
export type ConnectorConfig =
 | CSVConnectorConfig
 | OPCUAConnectorConfig
 | ModbusConnectorConfig
 | APIConnectorConfig;

// ============================================================================
// Sync History & Results
// ============================================================================

/**
 * Single sync result
 */
export interface SyncResult {
 /** Sync ID */
 id: string;
 /** Connector ID */
 connectorId: string;
 /** Start timestamp */
 startedAt: string;
 /** End timestamp */
 completedAt?: string;
 /** Duration in milliseconds */
 durationMs?: number;
 /** Sync status */
 status: 'running' | 'success' | 'partial' | 'failed';
 /** Statistics */
 stats: SyncStats;
 /** Errors encountered */
 errors: SyncError[];
 /** Triggered by */
 triggeredBy: 'schedule' | 'manual' | 'webhook';
 /** User who triggered (if manual) */
 triggeredByUserId?: string;
}

/**
 * Sync statistics
 */
export interface SyncStats {
 /** Total rows/records processed */
 totalProcessed: number;
 /** Assets created */
 created: number;
 /** Assets updated */
 updated: number;
 /** Assets unchanged (no changes detected) */
 unchanged: number;
 /** Assets failed to process */
 failed: number;
 /** Assets skipped (validation errors) */
 skipped: number;
}

/**
 * Sync error details
 */
export interface SyncError {
 /** Error code */
 code: string;
 /** Error message */
 message: string;
 /** Row/record reference */
 rowNumber?: number;
 /** Asset name or identifier */
 assetIdentifier?: string;
 /** Field that caused the error */
 field?: string;
 /** Original value */
 value?: string;
 /** Severity */
 severity: 'error' | 'warning';
}

// ============================================================================
// Main Connector Interface
// ============================================================================

/**
 * OT Connector entity
 */
export interface OTConnector {
 /** Unique identifier */
 id: string;
 /** Organization ID */
 organizationId: string;
 /** Connector display name */
 name: string;
 /** Optional description */
 description?: string;
 /** Connector type */
 type: OTConnectorType;
 /** Type-specific configuration */
 config: ConnectorConfig;
 /** Sync schedule */
 schedule: SyncSchedule;
 /** Current status */
 status: ConnectorStatus;
 /** Last sync result summary */
 lastSync?: {
 id: string;
 completedAt: string;
 status: SyncResult['status'];
 stats: SyncStats;
 };
 /** Error message if status is 'error' */
 errorMessage?: string;
 /** Created timestamp */
 createdAt: string;
 /** Updated timestamp */
 updatedAt: string;
 /** Created by user ID */
 createdBy: string;
 /** Enabled flag */
 enabled: boolean;
 /** Tags for organization */
 tags?: string[];
}

// ============================================================================
// Form & Validation Types
// ============================================================================

/**
 * Connector form data (for create/edit)
 */
export interface OTConnectorFormData {
 name: string;
 description?: string;
 type: OTConnectorType;
 config: Partial<ConnectorConfig>;
 schedule: Partial<SyncSchedule>;
 enabled: boolean;
 tags?: string[];
}

/**
 * Connector validation result
 */
export interface ConnectorValidationResult {
 valid: boolean;
 errors: Array<{
 field: string;
 message: string;
 }>;
}

/**
 * Test connection result
 */
export interface TestConnectionResult {
 success: boolean;
 message: string;
 details?: {
 /** For CSV: file count found */
 filesFound?: number;
 /** For API/OPC-UA: response time in ms */
 responseTimeMs?: number;
 /** Sample data preview */
 sampleData?: unknown[];
 };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default sync intervals in minutes
 */
export const SYNC_INTERVALS = [
 { value: 60, label: 'Hourly' },
 { value: 360, label: 'Every 6 hours' },
 { value: 720, label: 'Every 12 hours' },
 { value: 1440, label: 'Daily' },
 { value: 10080, label: 'Weekly' }
] as const;

/**
 * Connector type labels
 */
export const CONNECTOR_TYPE_LABELS: Record<OTConnectorType, { fr: string; en: string }> = {
 csv: { fr: 'Import CSV', en: 'CSV Import' },
 opcua: { fr: 'OPC-UA', en: 'OPC-UA' },
 modbus: { fr: 'Modbus TCP/RTU', en: 'Modbus TCP/RTU' },
 api: { fr: 'API REST', en: 'REST API' }
};

/**
 * Connector type descriptions
 */
export const CONNECTOR_TYPE_DESCRIPTIONS: Record<OTConnectorType, { fr: string; en: string }> = {
 csv: {
 fr: 'Import périodique depuis des fichiers CSV déposés dans un dossier',
 en: 'Periodic import from CSV files dropped in a folder'
 },
 opcua: {
 fr: 'Connexion directe aux serveurs OPC-UA pour synchronisation temps réel',
 en: 'Direct connection to OPC-UA servers for real-time sync'
 },
 modbus: {
 fr: 'Lecture des registres Modbus TCP ou RTU depuis les équipements',
 en: 'Read Modbus TCP or RTU registers from equipment'
 },
 api: {
 fr: 'Intégration avec des systèmes de gestion d\'actifs via API REST',
 en: 'Integration with asset management systems via REST API'
 }
};

/**
 * Connector status labels
 */
export const CONNECTOR_STATUS_LABELS: Record<ConnectorStatus, { fr: string; en: string }> = {
 active: { fr: 'Actif', en: 'Active' },
 paused: { fr: 'En pause', en: 'Paused' },
 error: { fr: 'Erreur', en: 'Error' },
 configuring: { fr: 'Configuration', en: 'Configuring' }
};

/**
 * Status badge colors
 */
export const CONNECTOR_STATUS_COLORS: Record<ConnectorStatus, string> = {
 active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
 paused: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
 error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
 configuring: 'bg-info-bg text-info-text'
};
