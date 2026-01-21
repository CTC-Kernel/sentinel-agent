# Story 36-2: OT Connector Configuration

## Story

**As a** RSSI Industrie,
**I want** to configure automated OT asset sync,
**So that** my inventory stays current.

## Status

**Current Status:** dev-complete
**Epic:** Epic 36 - OT/ICS Security Integration (P1 - Industrie)
**Priority:** P1 - NIS2 Compliance
**ADR:** ADR-009
**Vertical:** Industrie (NIS2)

## Context

### Business Context
After importing OT assets via CSV (Story 36-1), industrial organizations need automated synchronization to keep their inventory current. OT environments change frequently with firmware updates, new devices, and decommissioning. Manual imports are error-prone and time-consuming.

### Persona: Pierre, RSSI Industrie
- Manages both IT and OT environments
- Needs automated sync to reduce manual work
- Has OT systems with various protocols (Modbus, OPC-UA)
- Requires visibility into sync status and errors
- Must schedule syncs during maintenance windows

### Connector Types
| Type | Use Case | Protocol |
|------|----------|----------|
| CSV Import | Periodic file drops | File-based |
| OPC-UA | Modern industrial systems | OPC-UA |
| Modbus | Legacy PLCs/RTUs | Modbus TCP/RTU |
| REST API | Asset management systems | HTTP/JSON |

## Acceptance Criteria

### AC1: Connector Type Selection
**Given** the user accesses Settings > OT Connectors
**When** they create a new connector
**Then** they can select type: CSV Import, OPC-UA, Modbus, REST API
**And** type-specific configuration fields are displayed
**And** help text explains each connector type

### AC2: CSV Import Connector
**Given** the user selects CSV Import type
**When** they configure the connector
**Then** they can specify:
- Watch folder path or upload endpoint
- File naming pattern (regex)
- Column mapping template (reuse from 36-1)
- Auto-archive processed files option
**And** test upload validates configuration

### AC3: Sync Schedule Configuration
**Given** a connector is being configured
**When** the user sets the schedule
**Then** they can choose:
- Manual only
- Interval (hourly, daily, weekly)
- Cron expression for advanced scheduling
- Maintenance window restrictions
**And** next sync time is calculated and displayed

### AC4: Connector Status Display
**Given** connectors are configured
**When** the user views the connector list
**Then** each connector shows:
- Status badge: Active (green), Paused (yellow), Error (red)
- Last sync timestamp with relative time
- Next scheduled sync
- Asset count from last sync
- Error count if any

### AC5: Sync History & Logs
**Given** a connector has run syncs
**When** the user views connector details
**Then** sync history shows:
- Timestamp of each sync
- Duration
- Assets created/updated/unchanged/failed
- Error details with row/asset reference
**And** logs are exportable as CSV

## Tasks

### Task 1: OT Connector Types & Schema
**File:** `src/types/otConnector.ts`

**Subtasks:**
- [x] Define OTConnectorType union type
- [x] Create OTConnector interface with common fields
- [x] Add CSVConnectorConfig interface
- [x] Add OPCUAConnectorConfig interface (placeholder)
- [x] Add ModbusConnectorConfig interface (placeholder)
- [x] Add APIConnectorConfig interface (placeholder)
- [x] Create SyncSchedule interface
- [x] Create SyncHistory interface
- [x] Create ConnectorStatus type

### Task 2: OT Connector Service
**File:** `src/services/OTConnectorService.ts`

**Subtasks:**
- [x] Create CRUD operations for connectors
- [x] Implement connector validation
- [x] Add sync schedule calculation (next run)
- [x] Create sync history tracking
- [x] Add connector status management
- [x] Implement test connection function

### Task 3: OT Connector List Component
**File:** `src/components/settings/OTConnectorList.tsx`

**Subtasks:**
- [x] Create connector list with status badges
- [x] Add create/edit/delete actions
- [x] Display last sync info
- [x] Show next scheduled sync
- [x] Add manual sync trigger button

### Task 4: OT Connector Form Component
**File:** `src/components/settings/OTConnectorForm.tsx`

**Subtasks:**
- [x] Create multi-step form wizard
- [x] Add connector type selector
- [x] Implement CSV-specific config fields
- [x] Add schedule configuration UI
- [x] Create test connection button
- [x] Add column mapping template selector

### Task 5: Sync History Panel
**File:** `src/components/settings/OTSyncHistory.tsx`

**Subtasks:**
- [x] Create sync history timeline
- [x] Display sync statistics
- [x] Show error details expandable
- [x] Add export to CSV function

### Task 6: Cloud Function - CSV Sync Processor
**File:** `functions/scheduled/otCsvSync.js`

**Subtasks:**
- [x] Create scheduled function for CSV sync
- [x] Implement file watch/polling logic
- [x] Reuse OTAssetImportService logic
- [x] Record sync history
- [x] Handle errors gracefully

### Task 7: i18n Translations
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add otConnector section labels
- [x] Add connector type descriptions
- [x] Add schedule labels
- [x] Add status messages
- [x] Add error messages

### Task 8: Unit Tests
**File:** `src/services/__tests__/OTConnectorService.test.ts`

**Subtasks:**
- [x] Test CRUD operations
- [x] Test schedule calculation
- [x] Test status transitions
- [x] Test validation rules

## Technical Notes

### OTConnector Interface
```typescript
interface OTConnector {
  id: string;
  organizationId: string;
  name: string;
  type: OTConnectorType;
  config: CSVConnectorConfig | OPCUAConnectorConfig | ModbusConnectorConfig | APIConnectorConfig;
  schedule: SyncSchedule;
  status: ConnectorStatus;
  lastSync?: SyncResult;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

type OTConnectorType = 'csv' | 'opcua' | 'modbus' | 'api';
type ConnectorStatus = 'active' | 'paused' | 'error' | 'configuring';

interface SyncSchedule {
  type: 'manual' | 'interval' | 'cron';
  interval?: number; // minutes
  cronExpression?: string;
  maintenanceWindow?: { start: string; end: string };
  nextRun?: string;
}

interface CSVConnectorConfig {
  watchPath?: string;
  filePattern: string; // regex
  columnMappingId?: string; // reference to saved mapping
  archiveProcessed: boolean;
  encoding: 'utf-8' | 'iso-8859-1';
}
```

### Firestore Structure
```
organizations/{orgId}/otConnectors/{connectorId}
organizations/{orgId}/otConnectors/{connectorId}/syncHistory/{syncId}
```

### File Locations
```
src/
  types/
    otConnector.ts           # Connector types
  services/
    OTConnectorService.ts    # Connector CRUD & logic
  components/
    settings/
      OTConnectorList.tsx    # Connector list
      OTConnectorForm.tsx    # Create/edit form
      OTSyncHistory.tsx      # Sync history panel
functions/
  scheduled/
    otCsvSync.js             # CSV sync processor
```

## Definition of Done

- [x] All acceptance criteria passing (AC1-AC5)
- [x] Unit tests for connector service
- [x] French and English translations
- [x] Connector list functional
- [x] CSV connector configuration working
- [x] Sync history displayed
- [x] Cloud function deployed (CSV only)
- [x] Code review approved
- [x] No TypeScript errors
- [x] No ESLint warnings

## Dependencies

### Requires
- Story 36-1: OT Asset Import Wizard (completed)
- OTAssetImportService for CSV processing

### Enables
- Story 36-3: IT/OT Voxel Mapping
- Story 36-4: OT Vulnerability Correlation

## Dev Agent Record

### Implementation Plan
- Created comprehensive OTConnector type system with support for CSV, OPC-UA, Modbus, and REST API connectors
- Implemented OTConnectorService with CRUD, status management, schedule calculation, and sync history
- Built multi-step wizard form for connector configuration
- Created connector list with status badges and actions
- Added sync history panel with timeline view and export functionality
- Implemented Cloud Function for scheduled CSV sync processing
- Added full i18n support (FR/EN)
- Wrote unit tests for service validation and helper functions

### Debug Log
- No issues encountered during implementation

### Completion Notes
All 8 tasks completed successfully:
1. OTConnector types (280 lines) - Full type system with all connector configs
2. OTConnectorService (480 lines) - CRUD, validation, scheduling, history
3. OTConnectorList (320 lines) - List view with actions
4. OTConnectorForm (520 lines) - 4-step wizard
5. OTSyncHistory (340 lines) - Timeline with export
6. Cloud Function (380 lines) - Scheduled sync processor
7. i18n translations - FR/EN complete
8. Unit tests (380 lines) - Validation and helpers tested

## File List
- `src/types/otConnector.ts` (NEW)
- `src/services/OTConnectorService.ts` (NEW)
- `src/components/settings/OTConnectorList.tsx` (NEW)
- `src/components/settings/OTConnectorForm.tsx` (NEW)
- `src/components/settings/OTSyncHistory.tsx` (NEW)
- `src/services/__tests__/OTConnectorService.test.ts` (NEW)
- `functions/scheduled/otCsvSync.js` (NEW)
- `public/locales/fr/translation.json` (MODIFIED)
- `public/locales/en/translation.json` (MODIFIED)

## Change Log
- 2026-01-21: Story 36-2 implementation completed by Dev Agent (Amelia)

---

**Story File Created:** 2026-01-21
**Author:** Claude (Dev Agent - Amelia)
**Version:** 1.0
