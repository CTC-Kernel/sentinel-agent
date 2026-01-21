/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * VendorPortalService Tests
 * Story 37-2: Vendor Self-Service Portal
 *
 * Tests the portal access, validation, and questionnaire progress utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isPortalAccessExpired,
  canEditPortalAccess,
  getPortalAccessStatusMessage,
  getPortalErrorMessage,
  calculateSectionProgress,
  calculateQuestionnaireProgress,
  hasValidAnswer,
  generateSecureToken,
  generateVerificationCode,
} from '../../types/vendorPortal';
import type {
  PortalAccessStatus,
  PortalAccessError,
  QuestionAnswer,
} from '../../types/vendorPortal';

describe('VendorPortalService - Portal Access Utilities', () => {
  describe('isPortalAccessExpired', () => {
    it('should return true for status=expired', () => {
      const access = {
        status: 'expired' as PortalAccessStatus,
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // future date
      };
      expect(isPortalAccessExpired(access)).toBe(true);
    });

    it('should return true when expiresAt is in the past', () => {
      const access = {
        status: 'active' as PortalAccessStatus,
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
      };
      expect(isPortalAccessExpired(access)).toBe(true);
    });

    it('should return false for active access with future expiry', () => {
      const access = {
        status: 'active' as PortalAccessStatus,
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      };
      expect(isPortalAccessExpired(access)).toBe(false);
    });

    it('should return false for submitted access with future expiry', () => {
      const access = {
        status: 'submitted' as PortalAccessStatus,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      expect(isPortalAccessExpired(access)).toBe(false);
    });
  });

  describe('canEditPortalAccess', () => {
    it('should return true for active access with future expiry', () => {
      const access = {
        status: 'active' as PortalAccessStatus,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      expect(canEditPortalAccess(access)).toBe(true);
    });

    it('should return false for submitted access', () => {
      const access = {
        status: 'submitted' as PortalAccessStatus,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      expect(canEditPortalAccess(access)).toBe(false);
    });

    it('should return false for revoked access', () => {
      const access = {
        status: 'revoked' as PortalAccessStatus,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      expect(canEditPortalAccess(access)).toBe(false);
    });

    it('should return false for expired access', () => {
      const access = {
        status: 'expired' as PortalAccessStatus,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      };
      expect(canEditPortalAccess(access)).toBe(false);
    });

    it('should return false for active access with past expiry', () => {
      const access = {
        status: 'active' as PortalAccessStatus,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      };
      expect(canEditPortalAccess(access)).toBe(false);
    });
  });

  describe('getPortalAccessStatusMessage', () => {
    it('should return expired message when isExpired is true', () => {
      const message = getPortalAccessStatusMessage('active', true);
      expect(message).toContain('expired');
    });

    it('should return active message for active status', () => {
      const message = getPortalAccessStatusMessage('active', false);
      expect(message).toContain('active');
    });

    it('should return submitted message for submitted status', () => {
      const message = getPortalAccessStatusMessage('submitted', false);
      expect(message).toContain('submitted');
    });

    it('should return revoked message for revoked status', () => {
      const message = getPortalAccessStatusMessage('revoked', false);
      expect(message).toContain('revoked');
    });

    it('should return expired message for expired status', () => {
      const message = getPortalAccessStatusMessage('expired', false);
      expect(message).toContain('expired');
    });
  });

  describe('getPortalErrorMessage', () => {
    const errorCases: PortalAccessError[] = [
      'invalid_token',
      'expired_token',
      'already_submitted',
      'access_revoked',
      'rate_limited',
      'verification_required',
      'verification_failed',
    ];

    errorCases.forEach((error) => {
      it(`should return a non-empty message for ${error}`, () => {
        const message = getPortalErrorMessage(error);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(10);
      });
    });

    it('should return message mentioning organization for invalid_token', () => {
      const message = getPortalErrorMessage('invalid_token');
      expect(message.toLowerCase()).toContain('organization');
    });

    it('should return message about expiration for expired_token', () => {
      const message = getPortalErrorMessage('expired_token');
      expect(message.toLowerCase()).toContain('expired');
    });

    it('should return message about verification for verification_required', () => {
      const message = getPortalErrorMessage('verification_required');
      expect(message.toLowerCase()).toContain('verify');
    });
  });
});

describe('VendorPortalService - Answer Validation', () => {
  describe('hasValidAnswer', () => {
    it('should return false for null', () => {
      expect(hasValidAnswer(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(hasValidAnswer(undefined as any)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasValidAnswer('')).toBe(false);
    });

    it('should return false for whitespace-only string', () => {
      expect(hasValidAnswer('   ')).toBe(false);
    });

    it('should return true for non-empty string', () => {
      expect(hasValidAnswer('answer')).toBe(true);
    });

    it('should return true for boolean true', () => {
      expect(hasValidAnswer(true)).toBe(true);
    });

    it('should return true for boolean false', () => {
      expect(hasValidAnswer(false)).toBe(true);
    });

    it('should return true for number 0', () => {
      expect(hasValidAnswer(0)).toBe(true);
    });

    it('should return true for positive number', () => {
      expect(hasValidAnswer(42)).toBe(true);
    });

    it('should return true for negative number', () => {
      expect(hasValidAnswer(-5)).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(hasValidAnswer([])).toBe(false);
    });

    it('should return true for non-empty array', () => {
      expect(hasValidAnswer(['option1', 'option2'])).toBe(true);
    });
  });
});

describe('VendorPortalService - Section Progress Calculation', () => {
  describe('calculateSectionProgress', () => {
    it('should calculate progress for section with no answers', () => {
      const questions = [
        { id: 'q1', required: true },
        { id: 'q2', required: false },
        { id: 'q3', required: true },
      ];
      const answers: Record<string, QuestionAnswer> = {};

      const progress = calculateSectionProgress('section1', questions, answers);

      expect(progress.sectionId).toBe('section1');
      expect(progress.totalQuestions).toBe(3);
      expect(progress.answeredQuestions).toBe(0);
      expect(progress.requiredQuestions).toBe(2);
      expect(progress.answeredRequired).toBe(0);
      expect(progress.isComplete).toBe(false);
    });

    it('should calculate progress for section with all required answered', () => {
      const questions = [
        { id: 'q1', required: true },
        { id: 'q2', required: false },
        { id: 'q3', required: true },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: 'yes', answeredAt: new Date().toISOString() },
        q3: { questionId: 'q3', value: 'no', answeredAt: new Date().toISOString() },
      };

      const progress = calculateSectionProgress('section1', questions, answers);

      expect(progress.answeredQuestions).toBe(2);
      expect(progress.answeredRequired).toBe(2);
      expect(progress.isComplete).toBe(true);
    });

    it('should calculate progress for section with all questions answered', () => {
      const questions = [
        { id: 'q1', required: true },
        { id: 'q2', required: false },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: 'answer1', answeredAt: new Date().toISOString() },
        q2: { questionId: 'q2', value: 'answer2', answeredAt: new Date().toISOString() },
      };

      const progress = calculateSectionProgress('section1', questions, answers);

      expect(progress.answeredQuestions).toBe(2);
      expect(progress.answeredRequired).toBe(1);
      expect(progress.isComplete).toBe(true);
    });

    it('should handle section with no required questions', () => {
      const questions = [
        { id: 'q1', required: false },
        { id: 'q2', required: false },
      ];
      const answers: Record<string, QuestionAnswer> = {};

      const progress = calculateSectionProgress('section1', questions, answers);

      expect(progress.requiredQuestions).toBe(0);
      expect(progress.answeredRequired).toBe(0);
      expect(progress.isComplete).toBe(true); // 0 >= 0
    });

    it('should not count empty string answers as valid', () => {
      const questions = [
        { id: 'q1', required: true },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: '', answeredAt: new Date().toISOString() },
      };

      const progress = calculateSectionProgress('section1', questions, answers);

      expect(progress.answeredQuestions).toBe(0);
      expect(progress.answeredRequired).toBe(0);
      expect(progress.isComplete).toBe(false);
    });
  });
});

describe('VendorPortalService - Questionnaire Progress Calculation', () => {
  describe('calculateQuestionnaireProgress', () => {
    it('should calculate progress for empty questionnaire', () => {
      const sections = [
        { id: 's1', questions: [{ id: 'q1', required: true }] },
        { id: 's2', questions: [{ id: 'q2', required: false }] },
      ];
      const answers: Record<string, QuestionAnswer> = {};

      const progress = calculateQuestionnaireProgress('assess1', sections, answers);

      expect(progress.assessmentId).toBe('assess1');
      expect(progress.totalQuestions).toBe(2);
      expect(progress.answeredQuestions).toBe(0);
      expect(progress.completionPercentage).toBe(0);
      expect(progress.canSubmit).toBe(false);
    });

    it('should calculate 50% completion for half answered questions', () => {
      const sections = [
        { id: 's1', questions: [{ id: 'q1', required: true }, { id: 'q2', required: false }] },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: 'yes', answeredAt: new Date().toISOString() },
      };

      const progress = calculateQuestionnaireProgress('assess1', sections, answers);

      expect(progress.completionPercentage).toBe(50);
      expect(progress.canSubmit).toBe(true);
    });

    it('should calculate 100% completion for all answered questions', () => {
      const sections = [
        { id: 's1', questions: [{ id: 'q1', required: true }] },
        { id: 's2', questions: [{ id: 'q2', required: true }] },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: 'yes', answeredAt: new Date().toISOString() },
        q2: { questionId: 'q2', value: 'no', answeredAt: new Date().toISOString() },
      };

      const progress = calculateQuestionnaireProgress('assess1', sections, answers);

      expect(progress.completionPercentage).toBe(100);
      expect(progress.canSubmit).toBe(true);
    });

    it('should include section progress for each section', () => {
      const sections = [
        { id: 's1', questions: [{ id: 'q1', required: true }] },
        { id: 's2', questions: [{ id: 'q2', required: false }] },
      ];
      const answers: Record<string, QuestionAnswer> = {};

      const progress = calculateQuestionnaireProgress('assess1', sections, answers);

      expect(progress.sectionProgress).toHaveLength(2);
      expect(progress.sectionProgress[0].sectionId).toBe('s1');
      expect(progress.sectionProgress[1].sectionId).toBe('s2');
    });

    it('should allow submission when all required are answered', () => {
      const sections = [
        { id: 's1', questions: [{ id: 'q1', required: true }, { id: 'q2', required: false }] },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: 'answered', answeredAt: new Date().toISOString() },
      };

      const progress = calculateQuestionnaireProgress('assess1', sections, answers);

      expect(progress.canSubmit).toBe(true);
      expect(progress.answeredRequired).toBe(1);
      expect(progress.requiredQuestions).toBe(1);
    });

    it('should not allow submission when required are missing', () => {
      const sections = [
        { id: 's1', questions: [{ id: 'q1', required: true }, { id: 'q2', required: true }] },
      ];
      const answers: Record<string, QuestionAnswer> = {
        q1: { questionId: 'q1', value: 'answered', answeredAt: new Date().toISOString() },
      };

      const progress = calculateQuestionnaireProgress('assess1', sections, answers);

      expect(progress.canSubmit).toBe(false);
      expect(progress.answeredRequired).toBe(1);
      expect(progress.requiredQuestions).toBe(2);
    });

    it('should include lastSavedAt when provided', () => {
      const lastSaved = new Date().toISOString();
      const sections = [{ id: 's1', questions: [] }];

      const progress = calculateQuestionnaireProgress('assess1', sections, {}, lastSaved);

      expect(progress.lastSavedAt).toBe(lastSaved);
    });
  });
});

describe('VendorPortalService - Token Generation', () => {
  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = generateSecureToken();
      expect(token.length).toBe(32);
    });

    it('should generate token with specified length', () => {
      const token = generateSecureToken(48);
      expect(token.length).toBe(48);
    });

    it('should generate alphanumeric tokens', () => {
      const token = generateSecureToken(100);
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate different tokens each time', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateVerificationCode', () => {
    it('should generate 6-digit code', () => {
      const code = generateVerificationCode();
      expect(code.length).toBe(6);
    });

    it('should generate numeric-only codes', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('should generate different codes each time', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateVerificationCode());
      }
      // With 100 generations, we should have many unique codes
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should pad with leading zeros if necessary', () => {
      // Generate many codes to test edge cases
      for (let i = 0; i < 50; i++) {
        const code = generateVerificationCode();
        expect(code.length).toBe(6);
      }
    });
  });
});

describe('VendorPortalService - Portal URL Generation', () => {
  it('should generate URL with token', async () => {
    // Dynamic import to avoid Firebase initialization in tests
    const { VendorPortalService } = await import('../VendorPortalService');
    const token = 'test-token-123';
    const url = VendorPortalService.getPortalUrl(token);
    expect(url).toContain(token);
    expect(url).toContain('vendor-portal');
  });
});
