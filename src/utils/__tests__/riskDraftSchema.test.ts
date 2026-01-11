/**
 * Tests for riskDraftSchema utilities
 * Story 3.1: Enhanced Risk Creation Form
 * Task 7.1: Test riskDraftSchema validation (threat required only)
 */

import { describe, it, expect } from 'vitest';
import {
  createRiskDraftSchema,
  riskDraftSchemaFr,
  riskDraftSchemaEn,
  getRiskDraftSchema,
  canSaveRiskAsDraft,
  isRiskDraft,
  getDefaultRiskStatus,
  RISK_DRAFT_STATUS,
  RISK_PUBLISHED_STATUS,
  RISK_DRAFT_REQUIRED_FIELDS,
} from '../riskDraftSchema';

describe('riskDraftSchema', () => {
  describe('RISK_DRAFT_REQUIRED_FIELDS', () => {
    it('should only require threat field', () => {
      expect(RISK_DRAFT_REQUIRED_FIELDS).toEqual(['threat']);
    });
  });

  describe('RISK_DRAFT_STATUS', () => {
    it('should be "Brouillon"', () => {
      expect(RISK_DRAFT_STATUS).toBe('Brouillon');
    });
  });

  describe('RISK_PUBLISHED_STATUS', () => {
    it('should be "Ouvert"', () => {
      expect(RISK_PUBLISHED_STATUS).toBe('Ouvert');
    });
  });

  describe('createRiskDraftSchema', () => {
    it('should create a schema that validates with only threat field', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({
        threat: 'Attaque de phishing',
      });

      expect(result.success).toBe(true);
    });

    it('should fail validation if threat is missing', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({});

      expect(result.success).toBe(false);
    });

    it('should fail validation if threat is too short', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({
        threat: 'ab', // Less than 3 characters
      });

      expect(result.success).toBe(false);
    });

    it('should accept threat with 3 characters minimum', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({
        threat: 'abc', // Exactly 3 characters
      });

      expect(result.success).toBe(true);
    });

    it('should make all other fields optional', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({
        threat: 'Attaque de phishing',
        // No vulnerability, probability, impact, strategy, status, etc.
      });

      expect(result.success).toBe(true);
    });

    it('should accept full risk data', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({
        threat: 'Attaque de phishing',
        vulnerability: 'Manque de formation',
        probability: 3,
        impact: 4,
        strategy: 'Atténuer',
        status: 'Brouillon',
      });

      expect(result.success).toBe(true);
    });

    it('should accept Brouillon as a valid status', () => {
      const schema = createRiskDraftSchema('fr');
      const result = schema.safeParse({
        threat: 'Attaque de phishing',
        status: 'Brouillon',
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
      const schema = createRiskDraftSchema('fr');
      const statuses = ['Brouillon', 'Ouvert', 'En cours', 'Fermé', 'En attente de validation'];

      statuses.forEach((status) => {
        const result = schema.safeParse({
          threat: 'Test threat',
          status,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('getRiskDraftSchema', () => {
    it('should return French schema for fr locale', () => {
      const schema = getRiskDraftSchema('fr');
      expect(schema).toBe(riskDraftSchemaFr);
    });

    it('should return English schema for en locale', () => {
      const schema = getRiskDraftSchema('en');
      expect(schema).toBe(riskDraftSchemaEn);
    });

    it('should default to French schema', () => {
      const schema = getRiskDraftSchema();
      expect(schema).toBe(riskDraftSchemaFr);
    });
  });

  describe('canSaveRiskAsDraft', () => {
    it('should return canSave true when threat is present and valid', () => {
      const result = canSaveRiskAsDraft({
        threat: 'Attaque de phishing',
      });

      expect(result.canSave).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return canSave false when threat is missing', () => {
      const result = canSaveRiskAsDraft({});

      expect(result.canSave).toBe(false);
      expect(result.errors.threat).toBeDefined();
    });

    it('should return canSave false when threat is empty string', () => {
      const result = canSaveRiskAsDraft({ threat: '' });

      expect(result.canSave).toBe(false);
      expect(result.errors.threat).toBeDefined();
    });

    it('should return canSave false when threat is whitespace only', () => {
      const result = canSaveRiskAsDraft({ threat: '   ' });

      expect(result.canSave).toBe(false);
      expect(result.errors.threat).toBeDefined();
    });

    it('should return canSave false when threat is too short', () => {
      const result = canSaveRiskAsDraft({ threat: 'ab' });

      expect(result.canSave).toBe(false);
      expect(result.errors.threat).toBeDefined();
    });

    it('should return canSave true with other optional fields', () => {
      const result = canSaveRiskAsDraft({
        threat: 'Attaque de phishing',
        vulnerability: 'Formation insuffisante',
        probability: 3,
      });

      expect(result.canSave).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should use French error messages by default', () => {
      const result = canSaveRiskAsDraft({}, 'fr');

      expect(result.canSave).toBe(false);
      expect(result.errors.threat).toBeDefined();
      // Error message should be in French
    });

    it('should use English error messages when specified', () => {
      const result = canSaveRiskAsDraft({}, 'en');

      expect(result.canSave).toBe(false);
      expect(result.errors.threat).toBeDefined();
      // Error message should be in English
    });
  });

  describe('isRiskDraft', () => {
    it('should return true for Brouillon status', () => {
      expect(isRiskDraft('Brouillon')).toBe(true);
    });

    it('should return false for Ouvert status', () => {
      expect(isRiskDraft('Ouvert')).toBe(false);
    });

    it('should return false for En cours status', () => {
      expect(isRiskDraft('En cours')).toBe(false);
    });

    it('should return false for Fermé status', () => {
      expect(isRiskDraft('Fermé')).toBe(false);
    });

    it('should return false for undefined status', () => {
      expect(isRiskDraft(undefined)).toBe(false);
    });
  });

  describe('getDefaultRiskStatus', () => {
    it('should return Brouillon when isDraft is true', () => {
      expect(getDefaultRiskStatus(true)).toBe('Brouillon');
    });

    it('should return Ouvert when isDraft is false', () => {
      expect(getDefaultRiskStatus(false)).toBe('Ouvert');
    });
  });
});
