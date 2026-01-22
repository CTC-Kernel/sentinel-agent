/**
 * OTAssetImportService Unit Tests
 * Story 36-1: OT Asset Import Wizard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase before importing service
vi.mock('../../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-asset-id' })),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  }))
}));

vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn()
  }
}));

// Import after mocks
import {
  parseCSV,
  detectColumnMappings,
  applyMappings,
  validateOTAssetRow,
  validateAllRows,
  createAssetFromRow,
  importOTAssets,
  type ColumnMapping,
  type OTImportContext
} from '../OTAssetImportService';

import {
  normalizeNetworkSegment,
  normalizeOTCriticality
} from '../../data/otAssetConstants';
import { Criticality } from '../../types/common';

describe('OTAssetImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // CSV Parsing Tests
  // ============================================================================

  describe('parseCSV', () => {
    it('should parse simple CSV content', () => {
      const csv = 'name,type,protocol\nPLC-001,PLC,Modbus\nHMI-001,HMI,OPC-UA';

      const result = parseCSV(csv);

      expect(result.headers).toEqual(['name', 'type', 'protocol']);
      expect(result.rows).toHaveLength(2);
      expect(result.rowCount).toBe(2);
      expect(result.rows[0]).toEqual(['PLC-001', 'PLC', 'Modbus']);
      expect(result.rows[1]).toEqual(['HMI-001', 'HMI', 'OPC-UA']);
    });

    it('should handle empty CSV', () => {
      const result = parseCSV('');

      // Empty string splits to [''], so headers will be ['']
      expect(result.headers).toEqual(['']);
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle CSV with only headers', () => {
      const result = parseCSV('name,type,protocol');

      expect(result.headers).toEqual(['name', 'type', 'protocol']);
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle quoted values with commas', () => {
      const csv = 'name,description\n"PLC-001","Main controller, Zone A"';

      const result = parseCSV(csv);

      expect(result.rows[0]).toEqual(['PLC-001', 'Main controller, Zone A']);
    });

    it('should handle escaped quotes inside quoted values', () => {
      const csv = 'name,notes\n"PLC-001","Uses ""standard"" protocol"';

      const result = parseCSV(csv);

      expect(result.rows[0][1]).toBe('Uses "standard" protocol');
    });

    it('should handle Windows line endings (CRLF)', () => {
      const csv = 'name,type\r\nPLC-001,PLC\r\nHMI-001,HMI';

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(2);
    });

    it('should skip empty lines', () => {
      const csv = 'name,type\n\nPLC-001,PLC\n\nHMI-001,HMI\n';

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(2);
    });

    it('should trim whitespace from values', () => {
      const csv = 'name,type\n  PLC-001  ,  PLC  ';

      const result = parseCSV(csv);

      expect(result.rows[0]).toEqual(['PLC-001', 'PLC']);
    });
  });

  // ============================================================================
  // Column Mapping Detection Tests
  // ============================================================================

  describe('detectColumnMappings', () => {
    it('should detect exact match column names', () => {
      const headers = ['name', 'device_type', 'protocol', 'manufacturer'];

      const mappings = detectColumnMappings(headers);

      expect(mappings.find(m => m.fieldName === 'name')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'deviceType')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'protocol')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'manufacturer')).toBeDefined();
    });

    it('should detect French column names', () => {
      const headers = ['nom', 'protocole', 'fabricant', 'emplacement'];

      const mappings = detectColumnMappings(headers);

      expect(mappings.find(m => m.fieldName === 'name')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'protocol')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'manufacturer')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'location')).toBeDefined();
    });

    it('should handle case-insensitive matching', () => {
      const headers = ['NAME', 'DeviceType', 'PROTOCOL'];

      const mappings = detectColumnMappings(headers);

      expect(mappings.find(m => m.fieldName === 'name')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'protocol')).toBeDefined();
    });

    it('should handle variations with underscores and spaces', () => {
      const headers = ['asset_name', 'network segment', 'ip-address'];

      const mappings = detectColumnMappings(headers);

      expect(mappings.find(m => m.fieldName === 'name')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'networkSegment')).toBeDefined();
      expect(mappings.find(m => m.fieldName === 'ipAddress')).toBeDefined();
    });

    it('should return confidence scores', () => {
      const headers = ['name', 'device_type'];

      const mappings = detectColumnMappings(headers);

      const nameMapping = mappings.find(m => m.fieldName === 'name');
      expect(nameMapping?.confidence).toBe(1.0); // Exact match
    });

    it('should return empty array for unrecognized headers', () => {
      const headers = ['xyz123', 'unknown_field', 'random'];

      const mappings = detectColumnMappings(headers);

      expect(mappings).toHaveLength(0);
    });
  });

  // ============================================================================
  // Apply Mappings Tests
  // ============================================================================

  describe('applyMappings', () => {
    it('should apply column mappings to a row', () => {
      const headers = ['name', 'type', 'protocol'];
      const row = ['PLC-001', 'PLC', 'Modbus'];
      const mappings: ColumnMapping[] = [
        { csvColumn: 'name', fieldName: 'name', confidence: 1 },
        { csvColumn: 'type', fieldName: 'deviceType', confidence: 1 },
        { csvColumn: 'protocol', fieldName: 'protocol', confidence: 1 }
      ];

      const result = applyMappings(row, headers, mappings);

      expect(result).toEqual({
        name: 'PLC-001',
        deviceType: 'PLC',
        protocol: 'Modbus'
      });
    });

    it('should handle missing values', () => {
      const headers = ['name', 'type'];
      const row = ['PLC-001', ''];
      const mappings: ColumnMapping[] = [
        { csvColumn: 'name', fieldName: 'name', confidence: 1 },
        { csvColumn: 'type', fieldName: 'deviceType', confidence: 1 }
      ];

      const result = applyMappings(row, headers, mappings);

      expect(result.name).toBe('PLC-001');
      expect(result.deviceType).toBeUndefined();
    });

    it('should handle case-insensitive header matching', () => {
      const headers = ['NAME', 'TYPE'];
      const row = ['PLC-001', 'PLC'];
      const mappings: ColumnMapping[] = [
        { csvColumn: 'name', fieldName: 'name', confidence: 1 }
      ];

      const result = applyMappings(row, headers, mappings);

      expect(result.name).toBe('PLC-001');
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validateOTAssetRow', () => {
    it('should validate a complete valid row', () => {
      const data = {
        name: 'PLC-001',
        networkSegment: 'OT',
        otCriticality: 'production',
        protocol: 'Modbus',
        deviceType: 'PLC',
        ipAddress: '192.168.100.10'
      };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require name field', () => {
      const data = {
        networkSegment: 'OT',
        otCriticality: 'production'
      };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should reject empty name', () => {
      const data = {
        name: '   ',
        networkSegment: 'OT'
      };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(false);
      expect(result.errors.find(e => e.field === 'name')).toBeDefined();
    });

    it('should validate and normalize network segment', () => {
      const data = { name: 'PLC-001', networkSegment: 'dmz' };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(true);
      expect(result.data.networkSegment).toBe('DMZ');
    });

    it('should reject invalid network segment', () => {
      const data = { name: 'PLC-001', networkSegment: 'INVALID' };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'networkSegment' })
      );
    });

    it('should default network segment to OT with warning', () => {
      const data = { name: 'PLC-001' };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(true);
      expect(result.data.networkSegment).toBe('OT');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'networkSegment' })
      );
    });

    it('should validate and normalize OT criticality', () => {
      const data = { name: 'PLC-001', otCriticality: 'SAFETY' };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(true);
      expect(result.data.otCriticality).toBe('safety');
    });

    it('should default OT criticality to monitoring with warning', () => {
      const data = { name: 'PLC-001' };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(true);
      expect(result.data.otCriticality).toBe('monitoring');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'otCriticality' })
      );
    });

    it('should normalize protocol to matching value', () => {
      const data = { name: 'PLC-001', protocol: 'modbus' };

      const result = validateOTAssetRow(2, data);

      expect(result.data.protocol).toBe('Modbus');
    });

    it('should set unknown protocol to Other with warning', () => {
      const data = { name: 'PLC-001', protocol: 'UnknownProtocol' };

      const result = validateOTAssetRow(2, data);

      expect(result.data.protocol).toBe('Other');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'protocol' })
      );
    });

    it('should normalize device type to matching value', () => {
      const data = { name: 'PLC-001', deviceType: 'plc' };

      const result = validateOTAssetRow(2, data);

      expect(result.data.deviceType).toBe('PLC');
    });

    it('should set unknown device type to Other with warning', () => {
      const data = { name: 'PLC-001', deviceType: 'UnknownDevice' };

      const result = validateOTAssetRow(2, data);

      expect(result.data.deviceType).toBe('Other');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'deviceType' })
      );
    });

    it('should warn on invalid IP address format', () => {
      const data = { name: 'PLC-001', ipAddress: 'not.an.ip' };

      const result = validateOTAssetRow(2, data);

      expect(result.isValid).toBe(true); // IP is not required
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ field: 'ipAddress' })
      );
    });

    it('should accept valid IP address', () => {
      const data = { name: 'PLC-001', ipAddress: '192.168.1.100' };

      const result = validateOTAssetRow(2, data);

      expect(result.warnings.find(w => w.field === 'ipAddress')).toBeUndefined();
    });

    it('should preserve row number in result', () => {
      const data = { name: 'PLC-001' };

      const result = validateOTAssetRow(5, data);

      expect(result.rowNumber).toBe(5);
    });
  });

  describe('validateAllRows', () => {
    it('should validate multiple rows', () => {
      const headers = ['name', 'type'];
      const rows = [
        ['PLC-001', 'PLC'],
        ['HMI-001', 'HMI'],
        ['', 'RTU'] // Invalid - no name
      ];
      const mappings: ColumnMapping[] = [
        { csvColumn: 'name', fieldName: 'name', confidence: 1 },
        { csvColumn: 'type', fieldName: 'deviceType', confidence: 1 }
      ];

      const results = validateAllRows(rows, headers, mappings);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });

    it('should use correct row numbers (accounting for header)', () => {
      const headers = ['name'];
      const rows = [['PLC-001'], ['HMI-001']];
      const mappings: ColumnMapping[] = [
        { csvColumn: 'name', fieldName: 'name', confidence: 1 }
      ];

      const results = validateAllRows(rows, headers, mappings);

      expect(results[0].rowNumber).toBe(2); // First data row (after header)
      expect(results[1].rowNumber).toBe(3);
    });
  });

  // ============================================================================
  // Asset Creation Tests
  // ============================================================================

  describe('createAssetFromRow', () => {
    const context: OTImportContext = {
      organizationId: 'org-123',
      userId: 'user-456',
      defaultLocation: 'Building A',
      defaultNetworkSegment: 'OT'
    };

    it('should create asset with all OT details', () => {
      const data = {
        name: 'PLC-001',
        deviceType: 'PLC',
        protocol: 'Modbus',
        manufacturer: 'Siemens',
        model: 'S7-1500',
        firmwareVersion: '2.8.3',
        networkSegment: 'OT',
        otCriticality: 'production',
        ipAddress: '192.168.100.10',
        location: 'Line 1',
        vlan: '100',
        subnet: '192.168.100.0/24',
        notes: 'Main production controller'
      };

      const asset = createAssetFromRow(data, context);

      expect(asset.organizationId).toBe('org-123');
      expect(asset.name).toBe('PLC-001');
      expect(asset.type).toBe('Matériel');
      expect(asset.owner).toBe('user-456');
      expect(asset.networkSegment).toBe('OT');
      expect(asset.ipAddress).toBe('192.168.100.10');
      expect(asset.location).toBe('Line 1');
      expect(asset.notes).toBe('Main production controller');
      expect(asset.scope).toContain('NIS2');

      expect(asset.otDetails).toEqual({
        deviceType: 'PLC',
        protocol: 'Modbus',
        manufacturer: 'Siemens',
        model: 'S7-1500',
        firmwareVersion: '2.8.3',
        networkSegment: 'OT',
        otCriticality: 'production',
        vlan: '100',
        subnet: '192.168.100.0/24',
        connectedToIT: false
      });
    });

    it('should use default location from context', () => {
      const data = { name: 'PLC-001', networkSegment: 'OT', otCriticality: 'monitoring' };

      const asset = createAssetFromRow(data, context);

      expect(asset.location).toBe('Building A');
    });

    it('should set connectedToIT true for DMZ segment', () => {
      const data = { name: 'PLC-001', networkSegment: 'DMZ', otCriticality: 'monitoring' };

      const asset = createAssetFromRow(data, context);

      expect(asset.otDetails?.connectedToIT).toBe(true);
    });

    it('should set higher availability for safety-critical assets', () => {
      const data = { name: 'SIS-001', networkSegment: 'OT', otCriticality: 'safety' };

      const asset = createAssetFromRow(data, context);

      expect(asset.availability).toBe(Criticality.HIGH);
    });

    it('should set default availability for non-safety assets', () => {
      const data = { name: 'PLC-001', networkSegment: 'OT', otCriticality: 'production' };

      const asset = createAssetFromRow(data, context);

      expect(asset.availability).toBe(Criticality.MEDIUM);
    });

    it('should set lifecycle status to En service', () => {
      const data = { name: 'PLC-001', networkSegment: 'OT', otCriticality: 'monitoring' };

      const asset = createAssetFromRow(data, context);

      expect(asset.lifecycleStatus).toBe('En service');
    });
  });

  // ============================================================================
  // Import Tests
  // ============================================================================

  describe('importOTAssets', () => {
    const context: OTImportContext = {
      organizationId: 'org-123',
      userId: 'user-456'
    };

    it('should return success for valid rows', async () => {
      const validatedRows = [
        {
          rowNumber: 2,
          data: { name: 'PLC-001', networkSegment: 'OT', otCriticality: 'production' },
          errors: [],
          warnings: [],
          isValid: true
        },
        {
          rowNumber: 3,
          data: { name: 'HMI-001', networkSegment: 'OT', otCriticality: 'operations' },
          errors: [],
          warnings: [],
          isValid: true
        }
      ];

      const result = await importOTAssets(validatedRows, context);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.createdAssets).toHaveLength(2);
    });

    it('should separate valid and invalid rows', async () => {
      const validatedRows = [
        {
          rowNumber: 2,
          data: { name: 'PLC-001', networkSegment: 'OT', otCriticality: 'production' },
          errors: [],
          warnings: [],
          isValid: true
        },
        {
          rowNumber: 3,
          data: { name: '', networkSegment: 'OT', otCriticality: '' } as Record<string, string>,
          errors: [{ field: 'name', message: 'Asset name is required' }],
          warnings: [],
          isValid: false
        }
      ];

      const result = await importOTAssets(validatedRows, context);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rowNumber).toBe(3);
    });

    it('should handle empty input', async () => {
      const result = await importOTAssets([], context);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(0);
      expect(result.successCount).toBe(0);
    });

    it('should return created asset IDs and names', async () => {
      const validatedRows = [
        {
          rowNumber: 2,
          data: { name: 'TestAsset', networkSegment: 'OT', otCriticality: 'monitoring' },
          errors: [],
          warnings: [],
          isValid: true
        }
      ];

      const result = await importOTAssets(validatedRows, context);

      expect(result.createdAssets).toContainEqual(
        expect.objectContaining({ name: 'TestAsset' })
      );
    });
  });

  // ============================================================================
  // Normalization Helper Tests
  // ============================================================================

  describe('normalization helpers', () => {
    describe('normalizeNetworkSegment', () => {
      it('should normalize IT segment', () => {
        expect(normalizeNetworkSegment('it')).toBe('IT');
        expect(normalizeNetworkSegment('IT')).toBe('IT');
        expect(normalizeNetworkSegment('CORPORATE')).toBe('IT');
        expect(normalizeNetworkSegment('entreprise')).toBe('IT');
      });

      it('should normalize OT segment', () => {
        expect(normalizeNetworkSegment('ot')).toBe('OT');
        expect(normalizeNetworkSegment('OT')).toBe('OT');
        expect(normalizeNetworkSegment('INDUSTRIAL')).toBe('OT');
        expect(normalizeNetworkSegment('industriel')).toBe('OT');
      });

      it('should normalize DMZ segment', () => {
        expect(normalizeNetworkSegment('dmz')).toBe('DMZ');
        expect(normalizeNetworkSegment('DMZ')).toBe('DMZ');
      });

      it('should return null for invalid segment', () => {
        expect(normalizeNetworkSegment('invalid')).toBeNull();
        expect(normalizeNetworkSegment('')).toBeNull();
      });
    });

    describe('normalizeOTCriticality', () => {
      it('should normalize safety criticality', () => {
        expect(normalizeOTCriticality('safety')).toBe('safety');
        expect(normalizeOTCriticality('SAFETY')).toBe('safety');
        expect(normalizeOTCriticality('sécurité')).toBe('safety');
        expect(normalizeOTCriticality('critique')).toBe('safety');
      });

      it('should normalize production criticality', () => {
        expect(normalizeOTCriticality('production')).toBe('production');
        expect(normalizeOTCriticality('PRODUCTION')).toBe('production');
      });

      it('should normalize operations criticality', () => {
        expect(normalizeOTCriticality('operations')).toBe('operations');
        expect(normalizeOTCriticality('opérations')).toBe('operations');
      });

      it('should normalize monitoring criticality', () => {
        expect(normalizeOTCriticality('monitoring')).toBe('monitoring');
        expect(normalizeOTCriticality('surveillance')).toBe('monitoring');
      });

      it('should return null for invalid criticality', () => {
        expect(normalizeOTCriticality('invalid')).toBeNull();
        expect(normalizeOTCriticality('')).toBeNull();
      });
    });
  });
});
