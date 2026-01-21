# Story 36-1: OT Asset Import Wizard

## Story

**As a** RSSI Industrie,
**I want** to import my SCADA/ICS inventory,
**So that** I have visibility on OT assets.

## Status

**Current Status:** dev-complete
**Epic:** Epic 36 - OT/ICS Security Integration (P1 - Industrie)
**Priority:** P1 - NIS2 Compliance
**ADR:** ADR-009
**Vertical:** Industrie (NIS2)

## Context

### Business Context
Industrial organizations need to inventory and manage their OT (Operational Technology) assets alongside IT assets. OT assets include PLCs, RTUs, HMIs, SCADA systems, and other industrial control equipment. NIS2 requires critical infrastructure operators to maintain accurate inventories of all systems.

### Persona: Pierre, RSSI Industrie
- Manages both IT and OT environments
- Has existing SCADA/ICS inventory in CSV/Excel
- Needs to import OT assets with specific metadata
- Must maintain network segmentation visibility
- Requires criticality assessment for production systems

### OT Asset Categories
| Category | Examples | Criticality |
|----------|----------|-------------|
| Safety Systems | SIS, ESD | Critical (Safety) |
| Control Systems | PLC, DCS, RTU | Critical (Production) |
| HMI/SCADA | Operator stations, historians | High (Operations) |
| Network Equipment | Industrial switches, firewalls | High (Infrastructure) |
| Sensors/Actuators | Field devices | Medium (Monitoring) |

## Acceptance Criteria

### AC1: CSV Import
**Given** the user accesses Assets > OT Import
**When** they upload a CSV with OT assets
**Then** the file is parsed and validated
**And** column mapping is suggested automatically
**And** preview shows first 10 rows
**And** validation errors are highlighted

### AC2: OT Metadata Capture
**Given** assets are being imported
**When** the import processes each asset
**Then** OT-specific fields are captured:
- Protocol (Modbus, OPC-UA, BACnet, DNP3, EtherNet/IP, Profinet)
- Manufacturer (Siemens, Schneider, Rockwell, ABB, etc.)
- Model
- Firmware version
- Network segment (IT/OT/DMZ)
- OT criticality (safety/production/operations/monitoring)

### AC3: Network Segment Assignment
**Given** an OT asset is being imported
**When** network information is available
**Then** segment is assigned (IT, OT, or DMZ)
**And** VLAN/subnet info is captured if provided
**And** connectivity to IT network is flagged

### AC4: Criticality Assessment
**Given** an OT asset is imported
**When** criticality is assessed
**Then** OT-specific criticality levels apply:
- Safety: Safety-critical systems (SIS, ESD)
- Production: Systems affecting production
- Operations: Operator interfaces, historians
- Monitoring: Sensors, non-critical devices

### AC5: Import Summary
**Given** import is complete
**When** the user views the summary
**Then** success/error counts are displayed
**And** created assets are listed with links
**And** errors show specific row/field details
**And** option to retry failed rows is available

## Tasks

### Task 1: Extend Asset Types for OT
**File:** `src/types/assets.ts`

**Subtasks:**
- [x] Add NetworkSegment type ('IT' | 'OT' | 'DMZ')
- [x] Add OTCriticality type ('safety' | 'production' | 'operations' | 'monitoring')
- [x] Add OTProtocol type
- [x] Add OTDetails interface to Asset
- [x] Update Asset interface with OT fields

### Task 2: OT Import Service
**File:** `src/services/OTAssetImportService.ts`

**Subtasks:**
- [x] Create CSV parser for OT assets
- [x] Implement column auto-detection
- [x] Add validation rules for OT fields
- [x] Create bulk import function
- [x] Handle partial success/failure

### Task 3: OT Import Wizard Component
**File:** `src/components/assets/OTAssetImportWizard.tsx`

**Subtasks:**
- [x] Create multi-step wizard (Upload, Map, Preview, Import)
- [x] Add file upload with drag-drop
- [x] Implement column mapping UI
- [x] Create preview table with validation
- [x] Add import progress indicator

### Task 4: OT Constants and Templates
**File:** `src/data/otAssetConstants.ts`

**Subtasks:**
- [x] Define OT protocols list
- [x] Define OT manufacturers list
- [x] Define network segments
- [x] Define OT criticality levels
- [x] Create CSV template

### Task 5: i18n Translations
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add OT import wizard labels
- [x] Add OT field labels
- [x] Add validation messages
- [x] Add success/error messages

### Task 6: Unit Tests
**File:** `src/services/__tests__/OTAssetImportService.test.ts`

**Subtasks:**
- [x] Test CSV parsing
- [x] Test column detection
- [x] Test validation rules
- [x] Test bulk import

## Technical Notes

### OT Asset CSV Format
```csv
name,type,protocol,manufacturer,model,firmware,network_segment,ot_criticality,ip_address,location,notes
PLC-001,PLC,Modbus,Siemens,S7-1500,V2.8,OT,production,192.168.100.10,Building A,Main controller
HMI-001,HMI,OPC-UA,Schneider,Vijeo,5.0,DMZ,operations,192.168.50.20,Control Room,Operator station
```

### OTDetails Interface
```typescript
interface OTDetails {
  protocol?: OTProtocol;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  networkSegment: NetworkSegment;
  otCriticality: OTCriticality;
  vlan?: string;
  subnet?: string;
  connectedToIT?: boolean;
  lastPatchDate?: string;
  patchingConstraints?: string;
}
```

### Network Segment Validation
- OT: Industrial network, no direct internet
- DMZ: Demilitarized zone between IT/OT
- IT: Corporate network

### File Locations
```
src/
  types/
    assets.ts              # Extended with OT types
  data/
    otAssetConstants.ts    # OT-specific constants
  services/
    OTAssetImportService.ts # Import logic
  components/
    assets/
      OTAssetImportWizard.tsx # Import wizard
```

## Definition of Done

- [x] All acceptance criteria passing (AC1-AC5)
- [x] Unit tests for import service (53 tests passing)
- [x] French and English translations
- [x] Import wizard functional
- [x] CSV template downloadable
- [ ] Code review approved
- [x] No TypeScript errors
- [x] No ESLint warnings
- [ ] Manual QA on staging

## Dependencies

### Requires
- Existing Asset module (brownfield)
- File upload functionality

### Enables
- Story 36-2: OT Connector Configuration
- Story 36-3: IT/OT Voxel Mapping
- Story 36-4: OT Vulnerability Correlation

---

**Story File Created:** 2026-01-21
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
