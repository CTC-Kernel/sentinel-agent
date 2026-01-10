import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCORE_WEIGHTS,
  TREND_THRESHOLD,
  type TrendType,
  type CategoryScore,
  type ScoreBreakdown,
  type FrameworkScores,
  type CalculationDetails,
  type ComplianceScore,
  type ScoreHistory,
  type ComplianceScoreHookResult,
} from '../score.types';

describe('score.types', () => {
  describe('DEFAULT_SCORE_WEIGHTS', () => {
    it('should have correct default weights summing to 1', () => {
      const sum =
        DEFAULT_SCORE_WEIGHTS.controls +
        DEFAULT_SCORE_WEIGHTS.risks +
        DEFAULT_SCORE_WEIGHTS.audits +
        DEFAULT_SCORE_WEIGHTS.documents;
      expect(sum).toBeCloseTo(1, 10);
    });

    it('should have controls as the highest weight (40%)', () => {
      expect(DEFAULT_SCORE_WEIGHTS.controls).toBe(0.40);
    });

    it('should have risks at 30%', () => {
      expect(DEFAULT_SCORE_WEIGHTS.risks).toBe(0.30);
    });

    it('should have audits at 20%', () => {
      expect(DEFAULT_SCORE_WEIGHTS.audits).toBe(0.20);
    });

    it('should have documents at 10%', () => {
      expect(DEFAULT_SCORE_WEIGHTS.documents).toBe(0.10);
    });
  });

  describe('TREND_THRESHOLD', () => {
    it('should be 5 percent', () => {
      expect(TREND_THRESHOLD).toBe(5);
    });
  });

  describe('Type structure validation', () => {
    it('should create valid TrendType values', () => {
      const trends: TrendType[] = ['up', 'down', 'stable'];
      expect(trends).toHaveLength(3);
      expect(trends).toContain('up');
      expect(trends).toContain('down');
      expect(trends).toContain('stable');
    });

    it('should create valid CategoryScore object', () => {
      const categoryScore: CategoryScore = {
        score: 85,
        weight: 0.40,
      };
      expect(categoryScore.score).toBe(85);
      expect(categoryScore.weight).toBe(0.40);
    });

    it('should create valid ScoreBreakdown object', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: 70, weight: 0.30 },
        controls: { score: 80, weight: 0.40 },
        documents: { score: 75, weight: 0.10 },
        audits: { score: 72, weight: 0.20 },
      };
      expect(Object.keys(breakdown)).toHaveLength(4);
      expect(breakdown.controls.weight).toBe(0.40);
    });

    it('should create valid FrameworkScores object', () => {
      const frameworks: FrameworkScores = {
        iso27001: 80,
        nis2: 70,
        dora: 65,
        rgpd: 85,
      };
      expect(Object.keys(frameworks)).toHaveLength(4);
      expect(frameworks.iso27001).toBe(80);
    });

    it('should create valid CalculationDetails object', () => {
      const details: CalculationDetails = {
        totalRisks: 50,
        criticalRisks: 5,
        implementedControls: 80,
        actionableControls: 100,
        validDocuments: 45,
        totalDocuments: 60,
        compliantFindings: 36,
        totalFindings: 50,
      };
      expect(Object.keys(details)).toHaveLength(8);
      expect(details.implementedControls).toBe(80);
    });

    it('should create valid ComplianceScore object', () => {
      const score: ComplianceScore = {
        global: 75,
        byFramework: {
          iso27001: 80,
          nis2: 70,
          dora: 65,
          rgpd: 85,
        },
        trend: 'up',
        lastCalculated: new Date(),
        breakdown: {
          risks: { score: 70, weight: 0.30 },
          controls: { score: 80, weight: 0.40 },
          documents: { score: 75, weight: 0.10 },
          audits: { score: 72, weight: 0.20 },
        },
      };
      expect(score.global).toBe(75);
      expect(score.trend).toBe('up');
      expect(score.breakdown.controls.score).toBe(80);
    });

    it('should create valid ComplianceScore with string date', () => {
      const score: ComplianceScore = {
        global: 75,
        byFramework: {
          iso27001: 80,
          nis2: 70,
          dora: 65,
          rgpd: 85,
        },
        trend: 'stable',
        lastCalculated: '2026-01-10T12:00:00Z',
        breakdown: {
          risks: { score: 70, weight: 0.30 },
          controls: { score: 80, weight: 0.40 },
          documents: { score: 75, weight: 0.10 },
          audits: { score: 72, weight: 0.20 },
        },
      };
      expect(typeof score.lastCalculated).toBe('string');
    });

    it('should create valid ScoreHistory object', () => {
      const history: ScoreHistory = {
        date: '2026-01-10',
        global: 72,
      };
      expect(history.date).toBe('2026-01-10');
      expect(history.global).toBe(72);
    });

    it('should create valid ScoreHistory with optional breakdown', () => {
      const history: ScoreHistory = {
        date: '2026-01-10',
        global: 72,
        byFramework: {
          iso27001: 75,
          nis2: 68,
          dora: 70,
          rgpd: 80,
        },
        breakdown: {
          risks: { score: 70, weight: 0.30 },
          controls: { score: 75, weight: 0.40 },
          documents: { score: 70, weight: 0.10 },
          audits: { score: 68, weight: 0.20 },
        },
      };
      expect(history.byFramework?.iso27001).toBe(75);
      expect(history.breakdown?.controls.score).toBe(75);
    });

    it('should create valid ComplianceScoreHookResult object', () => {
      const hookResult: ComplianceScoreHookResult = {
        score: null,
        breakdown: null,
        trend: null,
        history: [],
        loading: true,
        error: null,
        refetch: () => {},
      };
      expect(hookResult.loading).toBe(true);
      expect(hookResult.score).toBeNull();
    });

    it('should create ComplianceScoreHookResult with data', () => {
      const hookResult: ComplianceScoreHookResult = {
        score: {
          global: 75,
          byFramework: { iso27001: 80, nis2: 70, dora: 65, rgpd: 85 },
          trend: 'up',
          lastCalculated: new Date(),
          breakdown: {
            risks: { score: 70, weight: 0.30 },
            controls: { score: 80, weight: 0.40 },
            documents: { score: 75, weight: 0.10 },
            audits: { score: 72, weight: 0.20 },
          },
        },
        breakdown: {
          risks: { score: 70, weight: 0.30 },
          controls: { score: 80, weight: 0.40 },
          documents: { score: 75, weight: 0.10 },
          audits: { score: 72, weight: 0.20 },
        },
        trend: 'up',
        history: [
          { date: '2026-01-09', global: 72 },
          { date: '2026-01-10', global: 75 },
        ],
        loading: false,
        error: null,
        refetch: () => {},
      };
      expect(hookResult.loading).toBe(false);
      expect(hookResult.score?.global).toBe(75);
      expect(hookResult.history).toHaveLength(2);
    });
  });

  describe('Score range validation', () => {
    it('should allow scores from 0 to 100', () => {
      const minScore: ComplianceScore = {
        global: 0,
        byFramework: { iso27001: 0, nis2: 0, dora: 0, rgpd: 0 },
        trend: 'down',
        lastCalculated: new Date(),
        breakdown: {
          risks: { score: 0, weight: 0.30 },
          controls: { score: 0, weight: 0.40 },
          documents: { score: 0, weight: 0.10 },
          audits: { score: 0, weight: 0.20 },
        },
      };
      expect(minScore.global).toBe(0);

      const maxScore: ComplianceScore = {
        global: 100,
        byFramework: { iso27001: 100, nis2: 100, dora: 100, rgpd: 100 },
        trend: 'up',
        lastCalculated: new Date(),
        breakdown: {
          risks: { score: 100, weight: 0.30 },
          controls: { score: 100, weight: 0.40 },
          documents: { score: 100, weight: 0.10 },
          audits: { score: 100, weight: 0.20 },
        },
      };
      expect(maxScore.global).toBe(100);
    });
  });
});
