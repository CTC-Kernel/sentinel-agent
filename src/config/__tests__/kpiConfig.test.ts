import { describe, it, expect } from 'vitest';
import {
  KPI_DEFINITIONS,
  KPI_THRESHOLDS,
  KPI_COLOR_CLASSES,
  EXECUTIVE_KPIS,
  getKPIColorScheme,
  getTrendLabel,
} from '../kpiConfig';

describe('kpiConfig', () => {
  describe('KPI_DEFINITIONS', () => {
    it('should have all three KPI types defined', () => {
      expect(KPI_DEFINITIONS.score_global).toBeDefined();
      expect(KPI_DEFINITIONS.risques_critiques).toBeDefined();
      expect(KPI_DEFINITIONS.audits_en_cours).toBeDefined();
    });

    it('should have simple French labels without jargon', () => {
      expect(KPI_DEFINITIONS.score_global.title).toBe('Santé Conformité');
      expect(KPI_DEFINITIONS.risques_critiques.title).toBe("Points d'Attention");
      expect(KPI_DEFINITIONS.audits_en_cours.title).toBe('Contrôles Actifs');
    });

    it('should have i18n keys for future multilingual support', () => {
      expect(KPI_DEFINITIONS.score_global.i18nKey).toBe('kpi.score_global');
      expect(KPI_DEFINITIONS.risques_critiques.i18nKey).toBe('kpi.risques_critiques');
      expect(KPI_DEFINITIONS.audits_en_cours.i18nKey).toBe('kpi.audits_en_cours');
    });

    it('should have descriptions for accessibility', () => {
      expect(KPI_DEFINITIONS.score_global.description).toBeTruthy();
      expect(KPI_DEFINITIONS.risques_critiques.description).toBeTruthy();
      expect(KPI_DEFINITIONS.audits_en_cours.description).toBeTruthy();
    });
  });

  describe('KPI_THRESHOLDS', () => {
    it('should have correct thresholds for score_global', () => {
      expect(KPI_THRESHOLDS.score_global.danger).toBe(50);
      expect(KPI_THRESHOLDS.score_global.warning).toBe(75);
    });

    it('should have correct thresholds for risques_critiques', () => {
      expect(KPI_THRESHOLDS.risques_critiques.success).toBe(0);
      expect(KPI_THRESHOLDS.risques_critiques.warning).toBe(3);
    });

    it('should have neutral for audits_en_cours', () => {
      expect(KPI_THRESHOLDS.audits_en_cours.neutral).toBe(true);
    });
  });

  describe('getKPIColorScheme', () => {
    describe('score_global', () => {
      it('should return danger for score below 50', () => {
        expect(getKPIColorScheme('score_global', 30)).toBe('danger');
        expect(getKPIColorScheme('score_global', 49)).toBe('danger');
      });

      it('should return warning for score between 50-75', () => {
        expect(getKPIColorScheme('score_global', 50)).toBe('warning');
        expect(getKPIColorScheme('score_global', 75)).toBe('warning');
      });

      it('should return success for score above 75', () => {
        expect(getKPIColorScheme('score_global', 76)).toBe('success');
        expect(getKPIColorScheme('score_global', 100)).toBe('success');
      });
    });

    describe('risques_critiques', () => {
      it('should return success for 0 risks', () => {
        expect(getKPIColorScheme('risques_critiques', 0)).toBe('success');
      });

      it('should return warning for 1-3 risks', () => {
        expect(getKPIColorScheme('risques_critiques', 1)).toBe('warning');
        expect(getKPIColorScheme('risques_critiques', 3)).toBe('warning');
      });

      it('should return danger for more than 3 risks', () => {
        expect(getKPIColorScheme('risques_critiques', 4)).toBe('danger');
        expect(getKPIColorScheme('risques_critiques', 10)).toBe('danger');
      });
    });

    describe('audits_en_cours', () => {
      it('should always return neutral regardless of count', () => {
        expect(getKPIColorScheme('audits_en_cours', 0)).toBe('neutral');
        expect(getKPIColorScheme('audits_en_cours', 5)).toBe('neutral');
        expect(getKPIColorScheme('audits_en_cours', 100)).toBe('neutral');
      });
    });
  });

  describe('KPI_COLOR_CLASSES', () => {
    it('should have all color scheme classes defined', () => {
      expect(KPI_COLOR_CLASSES.success).toBeDefined();
      expect(KPI_COLOR_CLASSES.warning).toBeDefined();
      expect(KPI_COLOR_CLASSES.danger).toBeDefined();
      expect(KPI_COLOR_CLASSES.neutral).toBeDefined();
    });

    it('should have bg, bgLight, text, border, and badge classes for each scheme', () => {
      const schemes = ['success', 'warning', 'danger', 'neutral'] as const;

      schemes.forEach((scheme) => {
        expect(KPI_COLOR_CLASSES[scheme].bg).toBeTruthy();
        expect(KPI_COLOR_CLASSES[scheme].bgLight).toBeTruthy();
        expect(KPI_COLOR_CLASSES[scheme].text).toBeTruthy();
        expect(KPI_COLOR_CLASSES[scheme].border).toBeTruthy();
        expect(KPI_COLOR_CLASSES[scheme].badge).toBeTruthy();
      });
    });

    it('should use correct Tailwind color classes', () => {
      expect(KPI_COLOR_CLASSES.success.bg).toContain('success');
      expect(KPI_COLOR_CLASSES.warning.bg).toContain('warning');
      expect(KPI_COLOR_CLASSES.danger.bg).toContain('destructive');
      expect(KPI_COLOR_CLASSES.neutral.bg).toContain('muted');
    });
  });

  describe('getTrendLabel', () => {
    it('should return "En hausse" for up trend', () => {
      expect(getTrendLabel('up')).toBe('En hausse');
    });

    it('should return "En baisse" for down trend', () => {
      expect(getTrendLabel('down')).toBe('En baisse');
    });

    it('should return "Stable" for stable trend', () => {
      expect(getTrendLabel('stable')).toBe('Stable');
    });

    it('should include percentage for up trend with value', () => {
      expect(getTrendLabel('up', 15)).toBe('En hausse de 15%');
    });

    it('should include percentage for down trend with value', () => {
      expect(getTrendLabel('down', 10)).toBe('En baisse de 10%');
    });

    it('should use absolute value for percentage', () => {
      expect(getTrendLabel('down', -10)).toBe('En baisse de 10%');
    });
  });

  describe('EXECUTIVE_KPIS', () => {
    it('should contain exactly 3 KPI types', () => {
      expect(EXECUTIVE_KPIS).toHaveLength(3);
    });

    it('should contain correct KPI types in order', () => {
      expect(EXECUTIVE_KPIS[0]).toBe('score_global');
      expect(EXECUTIVE_KPIS[1]).toBe('risques_critiques');
      expect(EXECUTIVE_KPIS[2]).toBe('audits_en_cours');
    });

    it('should match KPI_DEFINITIONS keys', () => {
      EXECUTIVE_KPIS.forEach((kpi) => {
        expect(KPI_DEFINITIONS[kpi]).toBeDefined();
      });
    });
  });
});
