/**
 * OT Asset Import Service
 * Story 36-1: OT Asset Import Wizard
 *
 * Service for importing OT (Operational Technology) assets from CSV files
 * with validation, column mapping, and bulk creation.
 */

import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import type {
  Asset,
  NetworkSegment,
  OTCriticality,
  OTProtocol,
  OTDeviceType,
  OTDetails
} from '../types/assets';
import {
  OT_CSV_COLUMN_MAPPINGS,
  isValidNetworkSegment,
  isValidOTCriticality,
  isValidOTProtocol,
  isValidOTDeviceType,
  normalizeNetworkSegment,
  normalizeOTCriticality,
  OT_PROTOCOLS,
  OT_DEVICE_TYPES
} from '../data/otAssetConstants';

// ============================================================================
// Types
// ============================================================================

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface ColumnMapping {
  csvColumn: string;
  fieldName: string;
  confidence: number; // 0-1
}

export interface OTAssetRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isValid: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdAssets: Array<{ id: string; name: string }>;
  errors: Array<{ rowNumber: number; errors: ValidationError[] }>;
}

export interface OTImportContext {
  organizationId: string;
  userId: string;
  defaultLocation?: string;
  defaultNetworkSegment?: NetworkSegment;
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse CSV content into headers and rows
 */
export function parseCSV(content: string): CSVParseResult {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const headers = parseCSVLine(lines[0]);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      rows.push(parseCSVLine(line));
    }
  }

  return {
    headers,
    rows,
    rowCount: rows.length
  };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
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

// ============================================================================
// Column Mapping
// ============================================================================

/**
 * Auto-detect column mappings based on header names
 */
export function detectColumnMappings(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (const [fieldName, possibleNames] of Object.entries(OT_CSV_COLUMN_MAPPINGS)) {
    let bestMatch: { header: string; confidence: number } | null = null;

    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim().replace(/[_\s-]/g, '');

      for (const possibleName of possibleNames) {
        const normalizedPossible = possibleName.toLowerCase().replace(/[_\s-]/g, '');

        if (normalizedHeader === normalizedPossible) {
          bestMatch = { header, confidence: 1.0 };
          break;
        } else if (normalizedHeader.includes(normalizedPossible) || normalizedPossible.includes(normalizedHeader)) {
          const confidence = Math.min(normalizedHeader.length, normalizedPossible.length) /
            Math.max(normalizedHeader.length, normalizedPossible.length);
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { header, confidence };
          }
        }
      }

      if (bestMatch?.confidence === 1.0) break;
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      mappings.push({
        csvColumn: bestMatch.header,
        fieldName,
        confidence: bestMatch.confidence
      });
    }
  }

  return mappings;
}

/**
 * Apply column mappings to a row
 */
export function applyMappings(
  row: string[],
  headers: string[],
  mappings: ColumnMapping[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const mapping of mappings) {
    const columnIndex = headers.findIndex(
      h => h.toLowerCase() === mapping.csvColumn.toLowerCase()
    );
    if (columnIndex !== -1 && row[columnIndex]) {
      result[mapping.fieldName] = row[columnIndex];
    }
  }

  return result;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a single OT asset row
 */
export function validateOTAssetRow(
  rowNumber: number,
  data: Record<string, string>
): OTAssetRow {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required field: name
  if (!data.name || data.name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Asset name is required'
    });
  }

  // Validate network segment
  if (data.networkSegment) {
    const normalized = normalizeNetworkSegment(data.networkSegment);
    if (!normalized) {
      errors.push({
        field: 'networkSegment',
        message: 'Invalid network segment',
        value: data.networkSegment
      });
    } else {
      data.networkSegment = normalized;
    }
  } else {
    warnings.push({
      field: 'networkSegment',
      message: 'Network segment not specified',
      suggestion: 'Will default to OT'
    });
    data.networkSegment = 'OT';
  }

  // Validate OT criticality
  if (data.otCriticality) {
    const normalized = normalizeOTCriticality(data.otCriticality);
    if (!normalized) {
      errors.push({
        field: 'otCriticality',
        message: 'Invalid OT criticality level',
        value: data.otCriticality
      });
    } else {
      data.otCriticality = normalized;
    }
  } else {
    warnings.push({
      field: 'otCriticality',
      message: 'OT criticality not specified',
      suggestion: 'Will default to monitoring'
    });
    data.otCriticality = 'monitoring';
  }

  // Validate protocol if provided
  if (data.protocol && !isValidOTProtocol(data.protocol)) {
    const matchedProtocol = OT_PROTOCOLS.find(
      p => p.toLowerCase() === data.protocol?.toLowerCase()
    );
    if (matchedProtocol) {
      data.protocol = matchedProtocol;
    } else {
      warnings.push({
        field: 'protocol',
        message: `Unknown protocol: ${data.protocol}`,
        suggestion: 'Will be set to "Other"'
      });
      data.protocol = 'Other';
    }
  }

  // Validate device type if provided
  if (data.deviceType && !isValidOTDeviceType(data.deviceType)) {
    const matchedType = OT_DEVICE_TYPES.find(
      t => t.toLowerCase() === data.deviceType?.toLowerCase()
    );
    if (matchedType) {
      data.deviceType = matchedType;
    } else {
      warnings.push({
        field: 'deviceType',
        message: `Unknown device type: ${data.deviceType}`,
        suggestion: 'Will be set to "Other"'
      });
      data.deviceType = 'Other';
    }
  }

  // Validate IP address format if provided
  if (data.ipAddress) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(data.ipAddress)) {
      warnings.push({
        field: 'ipAddress',
        message: 'Invalid IP address format',
        suggestion: 'Expected format: xxx.xxx.xxx.xxx'
      });
    }
  }

  return {
    rowNumber,
    data,
    errors,
    warnings,
    isValid: errors.length === 0
  };
}

/**
 * Validate all rows
 */
export function validateAllRows(
  rows: string[][],
  headers: string[],
  mappings: ColumnMapping[]
): OTAssetRow[] {
  return rows.map((row, index) => {
    const data = applyMappings(row, headers, mappings);
    return validateOTAssetRow(index + 2, data); // +2 for 1-based index and header row
  });
}

// ============================================================================
// Asset Creation
// ============================================================================

/**
 * Convert validated row data to Asset object
 */
export function createAssetFromRow(
  data: Record<string, string>,
  context: OTImportContext
): Omit<Asset, 'id' | 'createdAt'> {
  const otDetails: OTDetails = {
    deviceType: (data.deviceType as OTDeviceType) || undefined,
    protocol: (data.protocol as OTProtocol) || undefined,
    manufacturer: data.manufacturer || undefined,
    model: data.model || undefined,
    firmwareVersion: data.firmwareVersion || undefined,
    networkSegment: (data.networkSegment as NetworkSegment) || 'OT',
    otCriticality: (data.otCriticality as OTCriticality) || 'monitoring',
    vlan: data.vlan || undefined,
    subnet: data.subnet || undefined,
    connectedToIT: data.networkSegment === 'DMZ'
  };

  return {
    organizationId: context.organizationId,
    name: data.name,
    type: 'Matériel', // OT assets are typically hardware
    owner: context.userId,
    confidentiality: 3, // Default medium
    integrity: 3,
    availability: otDetails.otCriticality === 'safety' ? 4 : 3,
    location: data.location || context.defaultLocation || '',
    ipAddress: data.ipAddress || undefined,
    notes: data.notes || undefined,
    networkSegment: otDetails.networkSegment,
    otDetails,
    scope: ['NIS2'], // OT assets typically fall under NIS2
    lifecycleStatus: 'En service'
  };
}

/**
 * Bulk import OT assets
 */
export async function importOTAssets(
  validatedRows: OTAssetRow[],
  context: OTImportContext
): Promise<ImportResult> {
  const validRows = validatedRows.filter(r => r.isValid);
  const invalidRows = validatedRows.filter(r => !r.isValid);

  const createdAssets: Array<{ id: string; name: string }> = [];
  const errors: Array<{ rowNumber: number; errors: ValidationError[] }> = [];

  // Add errors from invalid rows
  for (const row of invalidRows) {
    errors.push({
      rowNumber: row.rowNumber,
      errors: row.errors
    });
  }

  // Process valid rows in batches of 500 (Firestore limit)
  const batchSize = 500;
  const batches = Math.ceil(validRows.length / batchSize);

  try {
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const batch = writeBatch(db);
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, validRows.length);
      const batchRows = validRows.slice(startIndex, endIndex);

      for (const row of batchRows) {
        const assetData = createAssetFromRow(row.data, context);
        const assetRef = doc(collection(db, 'organizations', context.organizationId, 'assets'));

        const asset = {
          ...assetData,
          id: assetRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(assetRef, asset);
        createdAssets.push({ id: assetRef.id, name: row.data.name });
      }

      await batch.commit();
    }

    return {
      success: true,
      totalRows: validatedRows.length,
      successCount: createdAssets.length,
      errorCount: errors.length,
      createdAssets,
      errors
    };
  } catch (error) {
    ErrorLogger.error(error, 'OTAssetImportService.importOTAssets', {
      component: 'OTAssetImportService',
      action: 'importOTAssets',
      organizationId: context.organizationId
    });

    return {
      success: false,
      totalRows: validatedRows.length,
      successCount: createdAssets.length,
      errorCount: validatedRows.length - createdAssets.length,
      createdAssets,
      errors: [
        ...errors,
        {
          rowNumber: 0,
          errors: [{
            field: 'system',
            message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        }
      ]
    };
  }
}

// ============================================================================
// Export Service
// ============================================================================

export const OTAssetImportService = {
  // Parsing
  parseCSV,
  parseCSVLine,

  // Column mapping
  detectColumnMappings,
  applyMappings,

  // Validation
  validateOTAssetRow,
  validateAllRows,

  // Import
  createAssetFromRow,
  importOTAssets
};

export default OTAssetImportService;
