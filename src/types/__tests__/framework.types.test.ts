import { describe, it, expect } from 'vitest';
import {
  REGULATORY_FRAMEWORK_CODES,
  REQUIREMENT_CATEGORIES,
  CRITICALITY_LEVELS,
  CRITICALITY_WEIGHTS,
  JURISDICTIONS,
  COVERAGE_STATUSES,
  CATEGORY_LABELS,
  isRegulatoryFrameworkCode,
  isRequirementCategory,
  isCriticalityLevel,
  type RegulatoryFrameworkCode,
  type RequirementCategory,
  type CriticalityLevel,
  type RegulatoryFramework,
  type Requirement,
  type ControlMapping,
} from '../framework';

describe('Framework Types', () => {
  describe('Constants', () => {
    it('should have all expected regulatory framework codes', () => {
      expect(REGULATORY_FRAMEWORK_CODES).toContain('NIS2');
      expect(REGULATORY_FRAMEWORK_CODES).toContain('DORA');
      expect(REGULATORY_FRAMEWORK_CODES).toContain('RGPD');
      expect(REGULATORY_FRAMEWORK_CODES).toContain('AI_ACT');
      expect(REGULATORY_FRAMEWORK_CODES).toContain('ISO27001');
      expect(REGULATORY_FRAMEWORK_CODES.length).toBeGreaterThanOrEqual(10);
    });

    it('should have all expected requirement categories', () => {
      expect(REQUIREMENT_CATEGORIES).toContain('governance');
      expect(REQUIREMENT_CATEGORIES).toContain('risk_management');
      expect(REQUIREMENT_CATEGORIES).toContain('incident_management');
      expect(REQUIREMENT_CATEGORIES).toContain('data_protection');
      expect(REQUIREMENT_CATEGORIES.length).toBeGreaterThanOrEqual(15);
    });

    it('should have all criticality levels with correct weights', () => {
      expect(CRITICALITY_LEVELS).toEqual(['high', 'medium', 'low']);
      expect(CRITICALITY_WEIGHTS.high).toBe(3);
      expect(CRITICALITY_WEIGHTS.medium).toBe(2);
      expect(CRITICALITY_WEIGHTS.low).toBe(1);
    });

    it('should have all expected jurisdictions', () => {
      expect(JURISDICTIONS).toContain('EU');
      expect(JURISDICTIONS).toContain('FR');
      expect(JURISDICTIONS).toContain('DE');
      expect(JURISDICTIONS).toContain('GLOBAL');
    });

    it('should have all coverage statuses', () => {
      expect(COVERAGE_STATUSES).toEqual(['full', 'partial', 'none', 'not_assessed']);
    });

    it('should have category labels for all requirement categories', () => {
      for (const category of REQUIREMENT_CATEGORIES) {
        expect(CATEGORY_LABELS[category]).toBeDefined();
        expect(CATEGORY_LABELS[category].en).toBeDefined();
        expect(CATEGORY_LABELS[category].fr).toBeDefined();
        expect(CATEGORY_LABELS[category].de).toBeDefined();
      }
    });
  });

  describe('Type Guards', () => {
    describe('isRegulatoryFrameworkCode', () => {
      it('should return true for valid framework codes', () => {
        expect(isRegulatoryFrameworkCode('NIS2')).toBe(true);
        expect(isRegulatoryFrameworkCode('DORA')).toBe(true);
        expect(isRegulatoryFrameworkCode('RGPD')).toBe(true);
        expect(isRegulatoryFrameworkCode('AI_ACT')).toBe(true);
        expect(isRegulatoryFrameworkCode('ISO27001')).toBe(true);
      });

      it('should return false for invalid framework codes', () => {
        expect(isRegulatoryFrameworkCode('INVALID')).toBe(false);
        expect(isRegulatoryFrameworkCode('')).toBe(false);
        expect(isRegulatoryFrameworkCode(null)).toBe(false);
        expect(isRegulatoryFrameworkCode(undefined)).toBe(false);
        expect(isRegulatoryFrameworkCode(123)).toBe(false);
        expect(isRegulatoryFrameworkCode({})).toBe(false);
      });
    });

    describe('isRequirementCategory', () => {
      it('should return true for valid categories', () => {
        expect(isRequirementCategory('governance')).toBe(true);
        expect(isRequirementCategory('risk_management')).toBe(true);
        expect(isRequirementCategory('incident_management')).toBe(true);
        expect(isRequirementCategory('data_protection')).toBe(true);
      });

      it('should return false for invalid categories', () => {
        expect(isRequirementCategory('invalid_category')).toBe(false);
        expect(isRequirementCategory('')).toBe(false);
        expect(isRequirementCategory(null)).toBe(false);
        expect(isRequirementCategory(undefined)).toBe(false);
      });
    });

    describe('isCriticalityLevel', () => {
      it('should return true for valid criticality levels', () => {
        expect(isCriticalityLevel('high')).toBe(true);
        expect(isCriticalityLevel('medium')).toBe(true);
        expect(isCriticalityLevel('low')).toBe(true);
      });

      it('should return false for invalid criticality levels', () => {
        expect(isCriticalityLevel('critical')).toBe(false);
        expect(isCriticalityLevel('HIGH')).toBe(false);
        expect(isCriticalityLevel('')).toBe(false);
        expect(isCriticalityLevel(null)).toBe(false);
        expect(isCriticalityLevel(undefined)).toBe(false);
        expect(isCriticalityLevel(1)).toBe(false);
      });
    });
  });

  describe('Interface Shapes', () => {
    it('should accept valid RegulatoryFramework objects', () => {
      const framework: RegulatoryFramework = {
        id: 'nis2-v1',
        code: 'NIS2',
        name: 'NIS2 Directive',
        version: '2022/2555',
        jurisdiction: 'EU',
        effectiveDate: '2024-10-17',
        isActive: true,
        requirementCount: 21,
      };

      expect(framework.id).toBe('nis2-v1');
      expect(framework.code).toBe('NIS2');
      expect(framework.isActive).toBe(true);
    });

    it('should accept valid Requirement objects', () => {
      const requirement: Requirement = {
        id: 'nis2-art21',
        frameworkId: 'nis2-v1',
        articleRef: 'Article 21',
        title: 'Cybersecurity risk-management measures',
        description: 'Entities shall take appropriate measures...',
        category: 'risk_management',
        criticality: 'high',
        isMandatory: true,
      };

      expect(requirement.id).toBe('nis2-art21');
      expect(requirement.category).toBe('risk_management');
      expect(requirement.criticality).toBe('high');
    });

    it('should accept valid ControlMapping objects', () => {
      const mapping: ControlMapping = {
        id: 'mapping-1',
        organizationId: 'org-123',
        controlId: 'ctrl-001',
        requirementId: 'nis2-art21',
        frameworkId: 'nis2-v1',
        coveragePercentage: 80,
        coverageStatus: 'partial',
        isAutoSuggested: true,
        suggestionConfidence: 0.85,
        isValidated: false,
      };

      expect(mapping.id).toBe('mapping-1');
      expect(mapping.coveragePercentage).toBe(80);
      expect(mapping.coverageStatus).toBe('partial');
      expect(mapping.isAutoSuggested).toBe(true);
    });
  });
});
