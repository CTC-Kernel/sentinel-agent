/**
 * EBIOS Library Data Tests
 * Tests for EBIOS RM standard library data integrity
 *
 * Story: EBIOS RM Test Coverage
 */

import { describe, it, expect } from 'vitest';
import {
 ANSSI_RISK_SOURCES,
 ANSSI_TARGETED_OBJECTIVES,
 RISK_SOURCE_CATEGORY_LABELS,
 IMPACT_TYPE_LABELS,
 GRAVITY_SCALE,
 LIKELIHOOD_SCALE,
 TRUST_LEVEL_SCALE,
 WORKSHOP_STATUS_LABELS,
 WORKSHOP_INFO,
 RISK_MATRIX_CONFIG,
 SECTOR_PROFILES,
 getRecommendedSourcesForSector,
 getRecommendedObjectivesForSector,
} from '../ebiosLibrary';
import { RISK_SOURCE_CATEGORIES } from '../../types/ebios';

// ============================================================================
// ANSSI Risk Sources Tests
// ============================================================================

describe('ANSSI_RISK_SOURCES', () => {
 it('should contain all 20 ANSSI standard risk sources', () => {
 expect(ANSSI_RISK_SOURCES.length).toBe(20);
 });

 it('should have unique codes', () => {
 const codes = ANSSI_RISK_SOURCES.map((s) => s.code);
 const uniqueCodes = new Set(codes);
 expect(uniqueCodes.size).toBe(codes.length);
 });

 it('should have codes following SR-XX pattern', () => {
 ANSSI_RISK_SOURCES.forEach((source) => {
 expect(source.code).toMatch(/^SR-\d{2}$/);
 });
 });

 it('should have valid categories', () => {
 ANSSI_RISK_SOURCES.forEach((source) => {
 expect(RISK_SOURCE_CATEGORIES).toContain(source.category);
 });
 });

 it('should all be marked as ANSSI standard', () => {
 ANSSI_RISK_SOURCES.forEach((source) => {
 expect(source.isANSSIStandard).toBe(true);
 });
 });

 it('should have required fields', () => {
 ANSSI_RISK_SOURCES.forEach((source) => {
 expect(source.code).toBeDefined();
 expect(source.category).toBeDefined();
 expect(source.name).toBeDefined();
 expect(source.description).toBeDefined();
 expect(typeof source.name).toBe('string');
 expect(source.name.length).toBeGreaterThan(0);
 });
 });

 it('should cover all risk source categories', () => {
 const categoriesInSources = new Set(ANSSI_RISK_SOURCES.map((s) => s.category));
 RISK_SOURCE_CATEGORIES.forEach((category) => {
 expect(categoriesInSources.has(category)).toBe(true);
 });
 });

 describe('category distribution', () => {
 it('should have state_sponsored sources', () => {
 const stateSponsored = ANSSI_RISK_SOURCES.filter(
 (s) => s.category === 'state_sponsored'
 );
 expect(stateSponsored.length).toBeGreaterThanOrEqual(2);
 });

 it('should have organized_crime sources', () => {
 const organizedCrime = ANSSI_RISK_SOURCES.filter(
 (s) => s.category === 'organized_crime'
 );
 expect(organizedCrime.length).toBeGreaterThanOrEqual(2);
 });

 it('should have insider sources (malicious and negligent)', () => {
 const insiderMalicious = ANSSI_RISK_SOURCES.filter(
 (s) => s.category === 'insider_malicious'
 );
 const insiderNegligent = ANSSI_RISK_SOURCES.filter(
 (s) => s.category === 'insider_negligent'
 );
 expect(insiderMalicious.length).toBeGreaterThanOrEqual(2);
 expect(insiderNegligent.length).toBeGreaterThanOrEqual(2);
 });
 });
});

// ============================================================================
// ANSSI Targeted Objectives Tests
// ============================================================================

describe('ANSSI_TARGETED_OBJECTIVES', () => {
 it('should contain all 18 ANSSI standard objectives', () => {
 expect(ANSSI_TARGETED_OBJECTIVES.length).toBe(18);
 });

 it('should have unique codes', () => {
 const codes = ANSSI_TARGETED_OBJECTIVES.map((o) => o.code);
 const uniqueCodes = new Set(codes);
 expect(uniqueCodes.size).toBe(codes.length);
 });

 it('should have codes following OV-X## pattern', () => {
 ANSSI_TARGETED_OBJECTIVES.forEach((objective) => {
 expect(objective.code).toMatch(/^OV-[CIA]\d{2}$/);
 });
 });

 it('should have valid impact types', () => {
 const validTypes = ['confidentiality', 'integrity', 'availability'];
 ANSSI_TARGETED_OBJECTIVES.forEach((objective) => {
 expect(validTypes).toContain(objective.impactType);
 });
 });

 it('should all be marked as ANSSI standard', () => {
 ANSSI_TARGETED_OBJECTIVES.forEach((objective) => {
 expect(objective.isANSSIStandard).toBe(true);
 });
 });

 it('should have required fields', () => {
 ANSSI_TARGETED_OBJECTIVES.forEach((objective) => {
 expect(objective.code).toBeDefined();
 expect(objective.name).toBeDefined();
 expect(objective.description).toBeDefined();
 expect(objective.impactType).toBeDefined();
 });
 });

 describe('impact type distribution', () => {
 it('should have confidentiality objectives', () => {
 const confidentiality = ANSSI_TARGETED_OBJECTIVES.filter(
 (o) => o.impactType === 'confidentiality'
 );
 expect(confidentiality.length).toBe(6);
 // Verify codes start with OV-C
 confidentiality.forEach((o) => {
 expect(o.code).toMatch(/^OV-C/);
 });
 });

 it('should have integrity objectives', () => {
 const integrity = ANSSI_TARGETED_OBJECTIVES.filter(
 (o) => o.impactType === 'integrity'
 );
 expect(integrity.length).toBe(6);
 // Verify codes start with OV-I
 integrity.forEach((o) => {
 expect(o.code).toMatch(/^OV-I/);
 });
 });

 it('should have availability objectives', () => {
 const availability = ANSSI_TARGETED_OBJECTIVES.filter(
 (o) => o.impactType === 'availability'
 );
 expect(availability.length).toBe(6);
 // Verify codes start with OV-A
 availability.forEach((o) => {
 expect(o.code).toMatch(/^OV-A/);
 });
 });
 });
});

// ============================================================================
// Label Constants Tests
// ============================================================================

describe('RISK_SOURCE_CATEGORY_LABELS', () => {
 it('should have labels for all categories', () => {
 RISK_SOURCE_CATEGORIES.forEach((category) => {
 expect(RISK_SOURCE_CATEGORY_LABELS[category]).toBeDefined();
 });
 });

 it('should have fr and en labels for each category', () => {
 Object.values(RISK_SOURCE_CATEGORY_LABELS).forEach((label) => {
 expect(label.fr).toBeDefined();
 expect(label.en).toBeDefined();
 expect(typeof label.fr).toBe('string');
 expect(typeof label.en).toBe('string');
 });
 });
});

describe('IMPACT_TYPE_LABELS', () => {
 it('should have labels for all impact types', () => {
 expect(IMPACT_TYPE_LABELS.confidentiality).toBeDefined();
 expect(IMPACT_TYPE_LABELS.integrity).toBeDefined();
 expect(IMPACT_TYPE_LABELS.availability).toBeDefined();
 });

 it('should have fr, en, icon, and color for each type', () => {
 Object.values(IMPACT_TYPE_LABELS).forEach((label) => {
 expect(label.fr).toBeDefined();
 expect(label.en).toBeDefined();
 expect(label.icon).toBeDefined();
 expect(label.color).toBeDefined();
 });
 });
});

// ============================================================================
// Scale Tests
// ============================================================================

describe('GRAVITY_SCALE', () => {
 it('should have 4 levels', () => {
 expect(GRAVITY_SCALE.length).toBe(4);
 });

 it('should have levels 1-4', () => {
 const levels = GRAVITY_SCALE.map((s) => s.level);
 expect(levels).toEqual([1, 2, 3, 4]);
 });

 it('should have fr and en labels', () => {
 GRAVITY_SCALE.forEach((scale) => {
 expect(scale.fr).toBeDefined();
 expect(scale.en).toBeDefined();
 expect(scale.description.fr).toBeDefined();
 expect(scale.description.en).toBeDefined();
 });
 });

 it('should have valid colors', () => {
 const validColors = ['green', 'yellow', 'orange', 'red'];
 GRAVITY_SCALE.forEach((scale) => {
 expect(validColors).toContain(scale.color);
 });
 });
});

describe('LIKELIHOOD_SCALE', () => {
 it('should have 4 levels', () => {
 expect(LIKELIHOOD_SCALE.length).toBe(4);
 });

 it('should have levels 1-4', () => {
 const levels = LIKELIHOOD_SCALE.map((s) => s.level);
 expect(levels).toEqual([1, 2, 3, 4]);
 });

 it('should have fr and en labels', () => {
 LIKELIHOOD_SCALE.forEach((scale) => {
 expect(scale.fr).toBeDefined();
 expect(scale.en).toBeDefined();
 expect(scale.description.fr).toBeDefined();
 expect(scale.description.en).toBeDefined();
 });
 });
});

describe('TRUST_LEVEL_SCALE', () => {
 it('should have 5 levels', () => {
 expect(TRUST_LEVEL_SCALE.length).toBe(5);
 });

 it('should have levels 1-5', () => {
 const levels = TRUST_LEVEL_SCALE.map((s) => s.level);
 expect(levels).toEqual([1, 2, 3, 4, 5]);
 });

 it('should have fr and en labels', () => {
 TRUST_LEVEL_SCALE.forEach((scale) => {
 expect(scale.fr).toBeDefined();
 expect(scale.en).toBeDefined();
 expect(scale.description.fr).toBeDefined();
 expect(scale.description.en).toBeDefined();
 });
 });
});

// ============================================================================
// Workshop Status and Info Tests
// ============================================================================

describe('WORKSHOP_STATUS_LABELS', () => {
 it('should have all status labels', () => {
 expect(WORKSHOP_STATUS_LABELS.not_started).toBeDefined();
 expect(WORKSHOP_STATUS_LABELS.in_progress).toBeDefined();
 expect(WORKSHOP_STATUS_LABELS.completed).toBeDefined();
 expect(WORKSHOP_STATUS_LABELS.validated).toBeDefined();
 });

 it('should have fr, en, and color for each status', () => {
 Object.values(WORKSHOP_STATUS_LABELS).forEach((status) => {
 expect(status.fr).toBeDefined();
 expect(status.en).toBeDefined();
 expect(status.color).toBeDefined();
 });
 });
});

describe('WORKSHOP_INFO', () => {
 it('should have info for all 5 workshops', () => {
 expect(WORKSHOP_INFO[1]).toBeDefined();
 expect(WORKSHOP_INFO[2]).toBeDefined();
 expect(WORKSHOP_INFO[3]).toBeDefined();
 expect(WORKSHOP_INFO[4]).toBeDefined();
 expect(WORKSHOP_INFO[5]).toBeDefined();
 });

 it('should have name, shortName, description, and objectives for each workshop', () => {
 [1, 2, 3, 4, 5].forEach((num) => {
 const info = WORKSHOP_INFO[num as 1 | 2 | 3 | 4 | 5];
 expect(info.name.fr).toBeDefined();
 expect(info.name.en).toBeDefined();
 expect(info.shortName.fr).toBeDefined();
 expect(info.shortName.en).toBeDefined();
 expect(info.description.fr).toBeDefined();
 expect(info.description.en).toBeDefined();
 expect(info.objectives.fr).toBeDefined();
 expect(info.objectives.en).toBeDefined();
 expect(Array.isArray(info.objectives.fr)).toBe(true);
 expect(Array.isArray(info.objectives.en)).toBe(true);
 });
 });
});

// ============================================================================
// Risk Matrix Tests
// ============================================================================

describe('RISK_MATRIX_CONFIG', () => {
 it('should have 4 risk levels', () => {
 expect(RISK_MATRIX_CONFIG.levels.low).toBeDefined();
 expect(RISK_MATRIX_CONFIG.levels.medium).toBeDefined();
 expect(RISK_MATRIX_CONFIG.levels.high).toBeDefined();
 expect(RISK_MATRIX_CONFIG.levels.critical).toBeDefined();
 });

 it('should have ascending max values', () => {
 expect(RISK_MATRIX_CONFIG.levels.low.max).toBeLessThan(
 RISK_MATRIX_CONFIG.levels.medium.max
 );
 expect(RISK_MATRIX_CONFIG.levels.medium.max).toBeLessThan(
 RISK_MATRIX_CONFIG.levels.high.max
 );
 expect(RISK_MATRIX_CONFIG.levels.high.max).toBeLessThan(
 RISK_MATRIX_CONFIG.levels.critical.max
 );
 });

 describe('getRiskLevel', () => {
 it('should return low for low gravity and likelihood', () => {
 expect(RISK_MATRIX_CONFIG.getRiskLevel(1, 1)).toBe('low'); // 1
 expect(RISK_MATRIX_CONFIG.getRiskLevel(1, 2)).toBe('low'); // 2
 expect(RISK_MATRIX_CONFIG.getRiskLevel(2, 1)).toBe('low'); // 2
 expect(RISK_MATRIX_CONFIG.getRiskLevel(2, 2)).toBe('low'); // 4
 });

 it('should return medium for moderate risk scores', () => {
 expect(RISK_MATRIX_CONFIG.getRiskLevel(2, 3)).toBe('medium'); // 6
 expect(RISK_MATRIX_CONFIG.getRiskLevel(3, 2)).toBe('medium'); // 6
 expect(RISK_MATRIX_CONFIG.getRiskLevel(2, 4)).toBe('medium'); // 8
 expect(RISK_MATRIX_CONFIG.getRiskLevel(4, 2)).toBe('medium'); // 8
 });

 it('should return high for higher risk scores', () => {
 expect(RISK_MATRIX_CONFIG.getRiskLevel(3, 3)).toBe('high'); // 9
 expect(RISK_MATRIX_CONFIG.getRiskLevel(3, 4)).toBe('high'); // 12
 expect(RISK_MATRIX_CONFIG.getRiskLevel(4, 3)).toBe('high'); // 12
 });

 it('should return critical for maximum risk scores', () => {
 expect(RISK_MATRIX_CONFIG.getRiskLevel(4, 4)).toBe('critical'); // 16
 });

 it('should handle boundary cases correctly', () => {
 // Score of exactly 4 should be low
 expect(RISK_MATRIX_CONFIG.getRiskLevel(1, 4)).toBe('low');
 expect(RISK_MATRIX_CONFIG.getRiskLevel(4, 1)).toBe('low');
 // Score of exactly 8 should be medium
 expect(RISK_MATRIX_CONFIG.getRiskLevel(2, 4)).toBe('medium');
 // Score of exactly 12 should be high
 expect(RISK_MATRIX_CONFIG.getRiskLevel(3, 4)).toBe('high');
 });
 });
});

// ============================================================================
// Sector Profiles Tests
// ============================================================================

describe('SECTOR_PROFILES', () => {
 const expectedSectors = [
 'finance',
 'health',
 'energy',
 'telecom',
 'defense',
 'retail',
 'public_sector',
 'technology',
 'manufacturing',
 'transport',
 ];

 it('should have all expected sectors', () => {
 expectedSectors.forEach((sector) => {
 expect(SECTOR_PROFILES[sector]).toBeDefined();
 });
 });

 it('should have required fields for each sector', () => {
 Object.values(SECTOR_PROFILES).forEach((profile) => {
 expect(profile.id).toBeDefined();
 expect(profile.name.fr).toBeDefined();
 expect(profile.name.en).toBeDefined();
 expect(profile.description.fr).toBeDefined();
 expect(profile.description.en).toBeDefined();
 expect(Array.isArray(profile.recommendedSourceCodes)).toBe(true);
 expect(Array.isArray(profile.recommendedObjectiveCodes)).toBe(true);
 });
 });

 it('should have valid source codes in recommendations', () => {
 const validSourceCodes = ANSSI_RISK_SOURCES.map((s) => s.code);
 Object.values(SECTOR_PROFILES).forEach((profile) => {
 profile.recommendedSourceCodes.forEach((code) => {
 expect(validSourceCodes).toContain(code);
 });
 });
 });

 it('should have valid objective codes in recommendations', () => {
 const validObjectiveCodes = ANSSI_TARGETED_OBJECTIVES.map((o) => o.code);
 Object.values(SECTOR_PROFILES).forEach((profile) => {
 profile.recommendedObjectiveCodes.forEach((code) => {
 expect(validObjectiveCodes).toContain(code);
 });
 });
 });

 it('should have non-empty recommendations', () => {
 Object.values(SECTOR_PROFILES).forEach((profile) => {
 expect(profile.recommendedSourceCodes.length).toBeGreaterThan(0);
 expect(profile.recommendedObjectiveCodes.length).toBeGreaterThan(0);
 });
 });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getRecommendedSourcesForSector', () => {
 it('should return sources for valid sector', () => {
 const sources = getRecommendedSourcesForSector('finance');
 expect(sources.length).toBeGreaterThan(0);
 expect(sources.every((s) => s.isANSSIStandard === true)).toBe(true);
 });

 it('should return empty array for invalid sector', () => {
 const sources = getRecommendedSourcesForSector('invalid-sector');
 expect(sources).toEqual([]);
 });

 it('should return correct sources for each sector', () => {
 Object.entries(SECTOR_PROFILES).forEach(([sectorId, profile]) => {
 const sources = getRecommendedSourcesForSector(sectorId);
 expect(sources.length).toBe(profile.recommendedSourceCodes.length);
 sources.forEach((source) => {
 expect(profile.recommendedSourceCodes).toContain(source.code);
 });
 });
 });
});

describe('getRecommendedObjectivesForSector', () => {
 it('should return objectives for valid sector', () => {
 const objectives = getRecommendedObjectivesForSector('health');
 expect(objectives.length).toBeGreaterThan(0);
 expect(objectives.every((o) => o.isANSSIStandard === true)).toBe(true);
 });

 it('should return empty array for invalid sector', () => {
 const objectives = getRecommendedObjectivesForSector('invalid-sector');
 expect(objectives).toEqual([]);
 });

 it('should return correct objectives for each sector', () => {
 Object.entries(SECTOR_PROFILES).forEach(([sectorId, profile]) => {
 const objectives = getRecommendedObjectivesForSector(sectorId);
 expect(objectives.length).toBe(profile.recommendedObjectiveCodes.length);
 objectives.forEach((objective) => {
 expect(profile.recommendedObjectiveCodes).toContain(objective.code);
 });
 });
 });
});

// ============================================================================
// Data Quality Tests
// ============================================================================

describe('Data Quality', () => {
 it('should have no empty strings in risk source names', () => {
 ANSSI_RISK_SOURCES.forEach((source) => {
 expect(source.name.trim()).not.toBe('');
 });
 });

 it('should have no empty strings in objective names', () => {
 ANSSI_TARGETED_OBJECTIVES.forEach((objective) => {
 expect(objective.name.trim()).not.toBe('');
 });
 });

 it('should have meaningful descriptions (min 20 chars)', () => {
 ANSSI_RISK_SOURCES.forEach((source) => {
 expect(source.description.length).toBeGreaterThanOrEqual(20);
 });
 ANSSI_TARGETED_OBJECTIVES.forEach((objective) => {
 expect(objective.description.length).toBeGreaterThanOrEqual(20);
 });
 });

 it('should have consistent naming conventions for French labels', () => {
 // Gravity scale should use capital first letter
 GRAVITY_SCALE.forEach((scale) => {
 expect(scale.fr[0]).toBe(scale.fr[0].toUpperCase());
 });
 // Likelihood scale should use capital first letter
 LIKELIHOOD_SCALE.forEach((scale) => {
 expect(scale.fr[0]).toBe(scale.fr[0].toUpperCase());
 });
 });
});
