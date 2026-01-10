import { describe, it, expect } from 'vitest';
import {
  getScoreLevel,
  getScoreTextColor,
  getScoreStrokeColor,
  getScoreBgColor,
  getScoreBgLightColor,
  getScoreHexColor,
  getScoreStatusLabel,
  isScoreCritical,
  normalizeScore,
  formatScore,
  SCORE_THRESHOLDS,
} from '../scoreUtils';

describe('scoreUtils', () => {
  describe('SCORE_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(SCORE_THRESHOLDS.CRITICAL).toBe(50);
      expect(SCORE_THRESHOLDS.WARNING).toBe(75);
      expect(SCORE_THRESHOLDS.PULSE).toBe(30);
    });
  });

  describe('getScoreLevel', () => {
    it('should return critical for scores below 50', () => {
      expect(getScoreLevel(0)).toBe('critical');
      expect(getScoreLevel(25)).toBe('critical');
      expect(getScoreLevel(49)).toBe('critical');
      expect(getScoreLevel(49.9)).toBe('critical');
    });

    it('should return warning for scores 50-75', () => {
      expect(getScoreLevel(50)).toBe('warning');
      expect(getScoreLevel(60)).toBe('warning');
      expect(getScoreLevel(75)).toBe('warning');
    });

    it('should return good for scores above 75', () => {
      expect(getScoreLevel(75.1)).toBe('good');
      expect(getScoreLevel(80)).toBe('good');
      expect(getScoreLevel(100)).toBe('good');
    });
  });

  describe('getScoreTextColor', () => {
    it('should return red for critical scores', () => {
      expect(getScoreTextColor(30)).toBe('text-red-500');
    });

    it('should return orange for warning scores', () => {
      expect(getScoreTextColor(60)).toBe('text-orange-500');
    });

    it('should return green for good scores', () => {
      expect(getScoreTextColor(80)).toBe('text-green-500');
    });
  });

  describe('getScoreStrokeColor', () => {
    it('should return stroke-red for critical scores', () => {
      expect(getScoreStrokeColor(30)).toBe('stroke-red-500');
    });

    it('should return stroke-orange for warning scores', () => {
      expect(getScoreStrokeColor(60)).toBe('stroke-orange-500');
    });

    it('should return stroke-green for good scores', () => {
      expect(getScoreStrokeColor(80)).toBe('stroke-green-500');
    });
  });

  describe('getScoreBgColor', () => {
    it('should return bg-red for critical scores', () => {
      expect(getScoreBgColor(30)).toBe('bg-red-500');
    });

    it('should return bg-orange for warning scores', () => {
      expect(getScoreBgColor(60)).toBe('bg-orange-500');
    });

    it('should return bg-green for good scores', () => {
      expect(getScoreBgColor(80)).toBe('bg-green-500');
    });
  });

  describe('getScoreBgLightColor', () => {
    it('should return light bg colors with dark mode variants', () => {
      expect(getScoreBgLightColor(30)).toContain('bg-red-50');
      expect(getScoreBgLightColor(60)).toContain('bg-orange-50');
      expect(getScoreBgLightColor(80)).toContain('bg-green-50');
    });
  });

  describe('getScoreHexColor', () => {
    it('should return correct hex colors', () => {
      expect(getScoreHexColor(30)).toBe('#ef4444'); // red-500
      expect(getScoreHexColor(60)).toBe('#f97316'); // orange-500
      expect(getScoreHexColor(80)).toBe('#22c55e'); // green-500
    });
  });

  describe('getScoreStatusLabel', () => {
    it('should return French labels by default', () => {
      expect(getScoreStatusLabel(30)).toBe('Critique');
      expect(getScoreStatusLabel(60)).toBe('À améliorer');
      expect(getScoreStatusLabel(80)).toBe('Bon');
    });

    it('should return English labels when specified', () => {
      expect(getScoreStatusLabel(30, 'en')).toBe('Critical');
      expect(getScoreStatusLabel(60, 'en')).toBe('Needs Improvement');
      expect(getScoreStatusLabel(80, 'en')).toBe('Good');
    });
  });

  describe('isScoreCritical', () => {
    it('should return true for scores below 30', () => {
      expect(isScoreCritical(0)).toBe(true);
      expect(isScoreCritical(15)).toBe(true);
      expect(isScoreCritical(29)).toBe(true);
      expect(isScoreCritical(29.9)).toBe(true);
    });

    it('should return false for scores 30 and above', () => {
      expect(isScoreCritical(30)).toBe(false);
      expect(isScoreCritical(50)).toBe(false);
      expect(isScoreCritical(100)).toBe(false);
    });
  });

  describe('normalizeScore', () => {
    it('should clamp scores to 0-100 range', () => {
      expect(normalizeScore(-10)).toBe(0);
      expect(normalizeScore(0)).toBe(0);
      expect(normalizeScore(50)).toBe(50);
      expect(normalizeScore(100)).toBe(100);
      expect(normalizeScore(150)).toBe(100);
    });

    it('should round to 2 decimal places', () => {
      expect(normalizeScore(75.555)).toBe(75.56);
      expect(normalizeScore(75.554)).toBe(75.55);
    });
  });

  describe('formatScore', () => {
    it('should format score with default 0 decimals', () => {
      expect(formatScore(75.5)).toBe('76');
      expect(formatScore(75.4)).toBe('75');
    });

    it('should format score with specified decimals', () => {
      expect(formatScore(75.555, 1)).toBe('75.6');
      expect(formatScore(75.555, 2)).toBe('75.56');
    });

    it('should handle edge cases', () => {
      expect(formatScore(-10)).toBe('0');
      expect(formatScore(150)).toBe('100');
    });
  });
});
