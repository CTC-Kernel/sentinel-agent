/**
 * Risk Calculator Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { RiskCalculator } from '../RiskCalculator';
import { Risk } from '../../types';

describe('RiskCalculator', () => {
    describe('calculateScore', () => {
        it('should calculate score as probability * impact', () => {
            expect(RiskCalculator.calculateScore(undefined, 3, 4)).toBe(12);
        });

        it('should handle low values', () => {
            expect(RiskCalculator.calculateScore(undefined, 1, 1)).toBe(1);
        });

        it('should handle high values', () => {
            expect(RiskCalculator.calculateScore(undefined, 5, 5)).toBe(25);
        });

        it('should ignore detectability parameter (reserved for future)', () => {
            expect(RiskCalculator.calculateScore(2, 3, 4)).toBe(12);
            expect(RiskCalculator.calculateScore(5, 3, 4)).toBe(12);
        });
    });

    describe('calculateResidualScore', () => {
        it('should calculate residual score', () => {
            expect(RiskCalculator.calculateResidualScore(2, 3)).toBe(6);
        });

        it('should handle minimum values', () => {
            expect(RiskCalculator.calculateResidualScore(1, 1)).toBe(1);
        });

        it('should handle maximum values', () => {
            expect(RiskCalculator.calculateResidualScore(5, 5)).toBe(25);
        });
    });

    describe('getCriticalityLabel', () => {
        it('should return Faible for score < 10', () => {
            expect(RiskCalculator.getCriticalityLabel(1)).toBe('Faible');
            expect(RiskCalculator.getCriticalityLabel(9)).toBe('Faible');
        });

        it('should return Moyen for score 10-14', () => {
            expect(RiskCalculator.getCriticalityLabel(10)).toBe('Moyen');
            expect(RiskCalculator.getCriticalityLabel(14)).toBe('Moyen');
        });

        it('should return Élevé for score 15-19', () => {
            expect(RiskCalculator.getCriticalityLabel(15)).toBe('Élevé');
            expect(RiskCalculator.getCriticalityLabel(19)).toBe('Élevé');
        });

        it('should return Critique for score >= 20', () => {
            expect(RiskCalculator.getCriticalityLabel(20)).toBe('Critique');
            expect(RiskCalculator.getCriticalityLabel(25)).toBe('Critique');
        });
    });

    describe('getScoreColor', () => {
        it('should return emerald colors for low scores', () => {
            const color = RiskCalculator.getScoreColor(4);
            expect(color).toContain('emerald');
        });

        it('should return amber colors for medium scores', () => {
            const color = RiskCalculator.getScoreColor(7);
            expect(color).toContain('amber');
        });

        it('should return orange colors for high scores', () => {
            const color = RiskCalculator.getScoreColor(12);
            expect(color).toContain('orange');
        });

        it('should return red colors for critical scores', () => {
            const color = RiskCalculator.getScoreColor(20);
            expect(color).toContain('red');
        });
    });

    describe('getScoreHexColor', () => {
        it('should return hex color for low scores', () => {
            const color = RiskCalculator.getScoreHexColor(4);
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });

        it('should return hex color for medium scores', () => {
            const color = RiskCalculator.getScoreHexColor(7);
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });

        it('should return hex color for high scores', () => {
            const color = RiskCalculator.getScoreHexColor(12);
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });

        it('should return hex color for critical scores', () => {
            const color = RiskCalculator.getScoreHexColor(20);
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });

    describe('sanitizeRisk', () => {
        const baseRisk: Risk = {
            id: 'risk-1',
            assetId: 'asset-1',
            threat: 'Test Threat',
            vulnerability: 'Test Vulnerability',

            category: 'Operational',
            status: 'Ouvert',
            probability: 3,
            impact: 4,
            residualProbability: 2,
            residualImpact: 3,
            score: 12,
            residualScore: 6,
            owner: 'John Doe',
            strategy: 'Atténuer',
            organizationId: 'org-1',
            createdAt: '2024-01-15',
            updatedAt: '2024-01-15'
        };

        it('should preserve valid risk values', () => {
            const sanitized = RiskCalculator.sanitizeRisk(baseRisk);

            expect(sanitized.probability).toBe(3);
            expect(sanitized.impact).toBe(4);
            expect(sanitized.residualProbability).toBe(2);
            expect(sanitized.residualImpact).toBe(3);
        });

        it('should preserve stored score if present', () => {
            const sanitized = RiskCalculator.sanitizeRisk(baseRisk);
            expect(sanitized.score).toBe(12);
        });

        it('should default invalid probability to 1', () => {
            const risk = { ...baseRisk, probability: NaN } as unknown as Risk;
            const sanitized = RiskCalculator.sanitizeRisk(risk);

            expect(sanitized.probability).toBe(1);
        });

        it('should default invalid impact to 1', () => {
            const risk = { ...baseRisk, impact: undefined } as unknown as Risk;
            const sanitized = RiskCalculator.sanitizeRisk(risk);

            expect(sanitized.impact).toBe(1);
        });

        it('should default residual probability to base probability', () => {
            const risk = {
                ...baseRisk,
                probability: 4,
                residualProbability: NaN
            } as unknown as Risk;
            const sanitized = RiskCalculator.sanitizeRisk(risk);

            expect(sanitized.residualProbability).toBe(4);
        });

        it('should default residual impact to base impact', () => {
            const risk = {
                ...baseRisk,
                impact: 5,
                residualImpact: undefined
            } as unknown as Risk;
            const sanitized = RiskCalculator.sanitizeRisk(risk);

            expect(sanitized.residualImpact).toBe(5);
        });
    });

    describe('parseRiskValues', () => {
        it('should parse valid risk values', () => {
            const data = { probability: 3, impact: 4 };
            const result = RiskCalculator.parseRiskValues(data);

            expect(result.probability).toBe(3);
            expect(result.impact).toBe(4);
            expect(result.score).toBe(12);
        });

        it('should calculate scores automatically', () => {
            const data = { probability: 2, impact: 3 };
            const result = RiskCalculator.parseRiskValues(data);

            expect(result.score).toBe(6);
        });

        it('should default missing probability to 1', () => {
            const data = { impact: 4 };
            const result = RiskCalculator.parseRiskValues(data);

            expect(result.probability).toBe(1);
            expect(result.score).toBe(4);
        });

        it('should default missing impact to 1', () => {
            const data = { probability: 3 };
            const result = RiskCalculator.parseRiskValues(data);

            expect(result.impact).toBe(1);
            expect(result.score).toBe(3);
        });

        it('should default residual values to base values', () => {
            const data = { probability: 3, impact: 4 };
            const result = RiskCalculator.parseRiskValues(data);

            expect(result.residualProbability).toBe(3);
            expect(result.residualImpact).toBe(4);
            expect(result.residualScore).toBe(12);
        });

        it('should use provided residual values', () => {
            const data = {
                probability: 4,
                impact: 5,
                residualProbability: 2,
                residualImpact: 3
            };
            const result = RiskCalculator.parseRiskValues(data);

            expect(result.residualProbability).toBe(2);
            expect(result.residualImpact).toBe(3);
            expect(result.residualScore).toBe(6);
        });

        it('should handle null data', () => {
            const result = RiskCalculator.parseRiskValues(null);

            expect(result.probability).toBe(1);
            expect(result.impact).toBe(1);
            expect(result.score).toBe(1);
        });

        it('should handle undefined data', () => {
            const result = RiskCalculator.parseRiskValues(undefined);

            expect(result.probability).toBe(1);
            expect(result.impact).toBe(1);
            expect(result.score).toBe(1);
        });
    });
});
