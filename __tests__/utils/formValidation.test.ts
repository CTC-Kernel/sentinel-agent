import { describe, it, expect } from 'vitest';
import { validateAsset, validateRisk } from '@/utils/formValidation';

describe('formValidation', () => {
  describe('validateAsset', () => {
    it('should validate complete asset', () => {
      const validAsset = {
        name: 'Server 01',
        category: 'Hardware',
        criticality: 'High',
        value: 5000,
        owner: 'IT Department',
        location: 'Data Center A'
      };

      const errors = validateAsset(validAsset);
      expect(errors).toHaveLength(0);
    });

    it('should reject asset with missing required fields', () => {
      const invalidAsset = {
        name: '',
        category: '',
        criticality: '',
        value: -100
      };

      const errors = validateAsset(invalidAsset);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'name')).toBe(true);
      expect(errors.some(e => e.field === 'category')).toBe(true);
      expect(errors.some(e => e.field === 'criticality')).toBe(true);
      expect(errors.some(e => e.field === 'value')).toBe(true);
    });

    it('should reject asset with short name', () => {
      const invalidAsset = {
        name: 'AB',
        category: 'Hardware',
        criticality: 'High'
      };

      const errors = validateAsset(invalidAsset);
      expect(errors.some(e => e.field === 'name' && e.message.includes('3 caractères'))).toBe(true);
    });
  });

  describe('validateRisk', () => {
    it('should validate complete risk', () => {
      const validRisk = {
        threat: 'Malware infection',
        vulnerability: 'Outdated antivirus',
        probability: 3 as const,
        impact: 4 as const,
        category: 'Security'
      };

      const errors = validateRisk(validRisk);
      expect(errors).toHaveLength(0);
    });

    it('should reject risk with missing required fields', () => {
      const invalidRisk = {
        threat: '',
        vulnerability: '',
        probability: 5 as const, // valid range but missing threat
        impact: 1 as const, // valid range but missing threat
        category: ''
      };

      const errors = validateRisk(invalidRisk);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'threat')).toBe(true);
      expect(errors.some(e => e.field === 'category')).toBe(true);
    });

    it('should validate probability and impact ranges', () => {
      const risk = {
        threat: 'Data breach',
        vulnerability: 'Weak encryption',
        probability: 2 as const,
        impact: 5 as const,
        category: 'Security'
      };

      const errors = validateRisk(risk);
      expect(errors).toHaveLength(0);
    });
  });
});
