/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * VendorScoringService Tests
 * Story 37-3: Automated Vendor Scoring
 *
 * Tests the scoring calculation algorithm and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getRiskLevelFromScore,
  getDisplayScore,
  getRiskScore,
  scoreYesNoAnswer,
  scoreRatingAnswer,
  scoreMultipleChoiceAnswer,
  scoreTextAnswer,
  applyMitigatingFactors,
  calculateTrend,
  getScoreGrade,
  validateSectionWeights,
  normalizeSectionWeights,
  getScoreColor,
  getScoreBgColor,
  formatScore,
} from '../../types/vendorScoring';
import type { MitigatingFactor, ScoringOption } from '../../types/vendorScoring';

describe('VendorScoringService - Risk Level Assignment', () => {
  describe('getRiskLevelFromScore', () => {
    it('should return Low for scores 0-40', () => {
      expect(getRiskLevelFromScore(0)).toBe('Low');
      expect(getRiskLevelFromScore(20)).toBe('Low');
      expect(getRiskLevelFromScore(40)).toBe('Low');
    });

    it('should return Medium for scores 41-60', () => {
      expect(getRiskLevelFromScore(41)).toBe('Medium');
      expect(getRiskLevelFromScore(50)).toBe('Medium');
      expect(getRiskLevelFromScore(60)).toBe('Medium');
    });

    it('should return High for scores 61-80', () => {
      expect(getRiskLevelFromScore(61)).toBe('High');
      expect(getRiskLevelFromScore(70)).toBe('High');
      expect(getRiskLevelFromScore(80)).toBe('High');
    });

    it('should return Critical for scores 81-100', () => {
      expect(getRiskLevelFromScore(81)).toBe('Critical');
      expect(getRiskLevelFromScore(90)).toBe('Critical');
      expect(getRiskLevelFromScore(100)).toBe('Critical');
    });
  });
});

describe('VendorScoringService - Score Conversion', () => {
  describe('getDisplayScore', () => {
    it('should invert risk score to display score', () => {
      expect(getDisplayScore(0)).toBe(100); // No risk = 100% display
      expect(getDisplayScore(100)).toBe(0); // Max risk = 0% display
      expect(getDisplayScore(50)).toBe(50); // Middle
      expect(getDisplayScore(25)).toBe(75);
    });

    it('should clamp values to 0-100 range', () => {
      expect(getDisplayScore(-10)).toBe(100);
      expect(getDisplayScore(150)).toBe(0);
    });
  });

  describe('getRiskScore', () => {
    it('should invert display score to risk score', () => {
      expect(getRiskScore(100)).toBe(0); // 100% display = no risk
      expect(getRiskScore(0)).toBe(100); // 0% display = max risk
      expect(getRiskScore(50)).toBe(50);
    });
  });
});

describe('VendorScoringService - Question Scoring', () => {
  describe('scoreYesNoAnswer', () => {
    it('should return 0 (no risk) for yes/true answers', () => {
      expect(scoreYesNoAnswer(true)).toBe(0);
      expect(scoreYesNoAnswer('yes')).toBe(0);
      expect(scoreYesNoAnswer('Oui')).toBe(0);
      expect(scoreYesNoAnswer('oui')).toBe(0);
    });

    it('should return 100 (high risk) for no/false answers', () => {
      expect(scoreYesNoAnswer(false)).toBe(100);
      expect(scoreYesNoAnswer('no')).toBe(100);
      expect(scoreYesNoAnswer('Non')).toBe(100);
      expect(scoreYesNoAnswer('non')).toBe(100);
    });

    it('should return 50 (neutral) for partial answers', () => {
      expect(scoreYesNoAnswer('partial')).toBe(50);
      expect(scoreYesNoAnswer('Partiel')).toBe(50);
      expect(scoreYesNoAnswer('partiel')).toBe(50);
    });

    it('should return 50 for unknown/null answers', () => {
      expect(scoreYesNoAnswer(null)).toBe(50);
      expect(scoreYesNoAnswer(undefined)).toBe(50);
      expect(scoreYesNoAnswer('')).toBe(50);
      expect(scoreYesNoAnswer('maybe')).toBe(50);
    });
  });

  describe('scoreRatingAnswer', () => {
    it('should score 5/5 rating as 0 risk', () => {
      expect(scoreRatingAnswer(5, 5)).toBe(0);
    });

    it('should score 1/5 rating as 100 risk', () => {
      expect(scoreRatingAnswer(1, 5)).toBe(100);
    });

    it('should score 3/5 rating as 50 risk', () => {
      expect(scoreRatingAnswer(3, 5)).toBe(50);
    });

    it('should handle different max ratings', () => {
      expect(scoreRatingAnswer(10, 10)).toBe(0);
      expect(scoreRatingAnswer(1, 10)).toBe(100);
    });

    it('should return 50 for invalid values', () => {
      expect(scoreRatingAnswer(NaN, 5)).toBe(50);
      expect(scoreRatingAnswer(undefined as any, 5)).toBe(50);
    });

    it('should clamp values to valid range', () => {
      expect(scoreRatingAnswer(6, 5)).toBe(0); // Clamped to 5
      expect(scoreRatingAnswer(0, 5)).toBe(100); // Clamped to 1
    });
  });

  describe('scoreMultipleChoiceAnswer', () => {
    const options: ScoringOption[] = [
      { value: 'excellent', label: 'Excellent', score: 0 },
      { value: 'good', label: 'Good', score: 25 },
      { value: 'average', label: 'Average', score: 50 },
      { value: 'poor', label: 'Poor', score: 75 },
      { value: 'critical', label: 'Critical', score: 100 },
    ];

    it('should score single choice correctly', () => {
      expect(scoreMultipleChoiceAnswer('excellent', options)).toBe(0);
      expect(scoreMultipleChoiceAnswer('average', options)).toBe(50);
      expect(scoreMultipleChoiceAnswer('critical', options)).toBe(100);
    });

    it('should return 50 for unknown option', () => {
      expect(scoreMultipleChoiceAnswer('unknown', options)).toBe(50);
    });

    it('should average scores for multi-select', () => {
      expect(scoreMultipleChoiceAnswer(['excellent', 'critical'], options)).toBe(50);
      expect(scoreMultipleChoiceAnswer(['good', 'average'], options)).toBe(38); // (25+50)/2 rounded
    });

    it('should return 50 for empty answer', () => {
      expect(scoreMultipleChoiceAnswer('', options)).toBe(50);
      expect(scoreMultipleChoiceAnswer(null as any, options)).toBe(50);
    });
  });

  describe('scoreTextAnswer', () => {
    it('should always return 50 (neutral)', () => {
      expect(scoreTextAnswer()).toBe(50);
    });
  });
});

describe('VendorScoringService - Mitigating Factors', () => {
  describe('applyMitigatingFactors', () => {
    it('should reduce risk score by factor amounts', () => {
      const factors: MitigatingFactor[] = [
        { id: '1', type: 'certification', name: 'SOC 2', riskReduction: 15 },
        { id: '2', type: 'certification', name: 'ISO 27001', riskReduction: 15 },
      ];
      expect(applyMitigatingFactors(80, factors)).toBe(50); // 80 - 15 - 15
    });

    it('should not go below 0', () => {
      const factors: MitigatingFactor[] = [
        { id: '1', type: 'certification', name: 'SOC 2', riskReduction: 60 },
      ];
      expect(applyMitigatingFactors(30, factors)).toBe(0);
    });

    it('should return original score with no factors', () => {
      expect(applyMitigatingFactors(75, [])).toBe(75);
    });
  });
});

describe('VendorScoringService - Trend Calculation', () => {
  describe('calculateTrend', () => {
    it('should identify improving trend (lower risk)', () => {
      const result = calculateTrend(40, 60);
      expect(result.direction).toBe('improving');
      expect(result.percentage).toBeGreaterThan(0);
    });

    it('should identify declining trend (higher risk)', () => {
      const result = calculateTrend(70, 50);
      expect(result.direction).toBe('declining');
      expect(result.percentage).toBeGreaterThan(0);
    });

    it('should identify stable trend for small changes', () => {
      const result = calculateTrend(51, 53);
      expect(result.direction).toBe('stable');
      expect(result.percentage).toBe(0);
    });

    it('should handle zero previous score', () => {
      const result = calculateTrend(50, 0);
      expect(result.percentage).toBe(0);
    });
  });
});

describe('VendorScoringService - Score Display', () => {
  describe('getScoreGrade', () => {
    it('should return A+ for 90+', () => {
      expect(getScoreGrade(90)).toBe('A+');
      expect(getScoreGrade(100)).toBe('A+');
    });

    it('should return A for 80-89', () => {
      expect(getScoreGrade(80)).toBe('A');
      expect(getScoreGrade(89)).toBe('A');
    });

    it('should return B for 70-79', () => {
      expect(getScoreGrade(70)).toBe('B');
      expect(getScoreGrade(79)).toBe('B');
    });

    it('should return C for 60-69', () => {
      expect(getScoreGrade(60)).toBe('C');
      expect(getScoreGrade(69)).toBe('C');
    });

    it('should return D for 50-59', () => {
      expect(getScoreGrade(50)).toBe('D');
      expect(getScoreGrade(59)).toBe('D');
    });

    it('should return F for below 50', () => {
      expect(getScoreGrade(49)).toBe('F');
      expect(getScoreGrade(0)).toBe('F');
    });
  });

  describe('getScoreColor', () => {
    it('should return green for high scores', () => {
      expect(getScoreColor(80)).toContain('green');
      expect(getScoreColor(100)).toContain('green');
    });

    it('should return yellow for medium scores', () => {
      expect(getScoreColor(60)).toContain('yellow');
      expect(getScoreColor(79)).toContain('yellow');
    });

    it('should return orange for low scores', () => {
      expect(getScoreColor(40)).toContain('orange');
      expect(getScoreColor(59)).toContain('orange');
    });

    it('should return red for critical scores', () => {
      expect(getScoreColor(39)).toContain('red');
      expect(getScoreColor(0)).toContain('red');
    });
  });

  describe('formatScore', () => {
    it('should round to integer', () => {
      expect(formatScore(75.6)).toBe('76');
      expect(formatScore(75.4)).toBe('75');
      expect(formatScore(100)).toBe('100');
    });
  });
});

describe('VendorScoringService - Section Weights', () => {
  describe('validateSectionWeights', () => {
    it('should return true for weights totaling 100', () => {
      expect(validateSectionWeights([{ weight: 30 }, { weight: 30 }, { weight: 40 }])).toBe(true);
    });

    it('should return false for weights not totaling 100', () => {
      expect(validateSectionWeights([{ weight: 30 }, { weight: 30 }])).toBe(false);
      expect(validateSectionWeights([{ weight: 50 }, { weight: 60 }])).toBe(false);
    });

    it('should handle floating point precision', () => {
      expect(validateSectionWeights([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }])).toBe(true);
    });
  });

  describe('normalizeSectionWeights', () => {
    it('should normalize weights to total 100', () => {
      const result = normalizeSectionWeights([{ weight: 10 }, { weight: 20 }, { weight: 30 }]);
      const total = result.reduce((sum, w) => sum + w, 0);
      expect(Math.round(total)).toBe(100);
    });

    it('should maintain relative proportions', () => {
      const result = normalizeSectionWeights([{ weight: 10 }, { weight: 20 }]);
      // 10:20 ratio should become 33.33:66.67
      expect(result[1]).toBeCloseTo(result[0] * 2, 1);
    });

    it('should handle zero total weight', () => {
      const result = normalizeSectionWeights([{ weight: 0 }, { weight: 0 }]);
      expect(result[0]).toBe(50);
      expect(result[1]).toBe(50);
    });
  });
});

describe('VendorScoringService - Edge Cases', () => {
  it('should handle boundary scores correctly', () => {
    // Risk level boundaries
    expect(getRiskLevelFromScore(40)).toBe('Low');
    expect(getRiskLevelFromScore(41)).toBe('Medium');
    expect(getRiskLevelFromScore(60)).toBe('Medium');
    expect(getRiskLevelFromScore(61)).toBe('High');
    expect(getRiskLevelFromScore(80)).toBe('High');
    expect(getRiskLevelFromScore(81)).toBe('Critical');
  });

  it('should handle extreme values', () => {
    expect(getDisplayScore(-100)).toBe(100); // Clamped
    expect(getDisplayScore(200)).toBe(0); // Clamped
    expect(getRiskLevelFromScore(0)).toBe('Low');
    expect(getRiskLevelFromScore(100)).toBe('Critical');
  });

  it('should handle special answer values', () => {
    // Boolean coercion
    expect(scoreYesNoAnswer(1 as any)).toBe(50); // Not a boolean
    expect(scoreYesNoAnswer(0 as any)).toBe(50); // Not a boolean

    // Rating edge cases
    expect(scoreRatingAnswer(-1, 5)).toBe(100); // Clamped to 1
  });
});
