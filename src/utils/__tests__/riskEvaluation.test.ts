/**
 * Unit tests for riskEvaluation.ts
 * Tests risk level classification and calculation functions
 */

import { describe, it, expect } from 'vitest';
import {
    getRiskLevelFromScore,
    calculateRiskScore,
    calculateMitigationCoverage
} from '../riskEvaluation';
import { Control, ControlStatus } from '../../types';

describe('getRiskLevelFromScore', () => {
    describe('critical level (score >= 15)', () => {
        it('returns critical for score 15', () => {
            const result = getRiskLevelFromScore(15);
            expect(result.label).toBe('Critique');
            expect(result.color).toBe('rose');
            expect(result.bgColor).toBe('bg-rose-500');
            expect(result.textColor).toBe('text-rose-600 dark:text-rose-400');
        });

        it('returns critical for score 20', () => {
            const result = getRiskLevelFromScore(20);
            expect(result.label).toBe('Critique');
        });

        it('returns critical for score 25 (max)', () => {
            const result = getRiskLevelFromScore(25);
            expect(result.label).toBe('Critique');
        });
    });

    describe('high level (score >= 10 and < 15)', () => {
        it('returns high for score 10', () => {
            const result = getRiskLevelFromScore(10);
            expect(result.label).toBe('Élevé');
            expect(result.color).toBe('orange');
            expect(result.bgColor).toBe('bg-orange-500');
            expect(result.textColor).toBe('text-orange-600 dark:text-orange-400');
        });

        it('returns high for score 12', () => {
            const result = getRiskLevelFromScore(12);
            expect(result.label).toBe('Élevé');
        });

        it('returns high for score 14', () => {
            const result = getRiskLevelFromScore(14);
            expect(result.label).toBe('Élevé');
        });
    });

    describe('medium level (score >= 5 and < 10)', () => {
        it('returns medium for score 5', () => {
            const result = getRiskLevelFromScore(5);
            expect(result.label).toBe('Moyen');
            expect(result.color).toBe('amber');
            expect(result.bgColor).toBe('bg-amber-400');
            expect(result.textColor).toBe('text-amber-600 dark:text-amber-400');
        });

        it('returns medium for score 7', () => {
            const result = getRiskLevelFromScore(7);
            expect(result.label).toBe('Moyen');
        });

        it('returns medium for score 9', () => {
            const result = getRiskLevelFromScore(9);
            expect(result.label).toBe('Moyen');
        });
    });

    describe('low level (score < 5)', () => {
        it('returns low for score 4', () => {
            const result = getRiskLevelFromScore(4);
            expect(result.label).toBe('Faible');
            expect(result.color).toBe('emerald');
            expect(result.bgColor).toBe('bg-emerald-500');
            expect(result.textColor).toBe('text-emerald-600 dark:text-emerald-400');
        });

        it('returns low for score 1', () => {
            const result = getRiskLevelFromScore(1);
            expect(result.label).toBe('Faible');
        });

        it('returns low for score 0', () => {
            const result = getRiskLevelFromScore(0);
            expect(result.label).toBe('Faible');
        });
    });
});

describe('calculateRiskScore', () => {
    it('calculates score as impact * probability', () => {
        expect(calculateRiskScore(3, 4)).toBe(12);
        expect(calculateRiskScore(5, 5)).toBe(25);
        expect(calculateRiskScore(1, 1)).toBe(1);
        expect(calculateRiskScore(2, 3)).toBe(6);
    });

    it('handles edge cases', () => {
        expect(calculateRiskScore(0, 5)).toBe(0);
        expect(calculateRiskScore(5, 0)).toBe(0);
        expect(calculateRiskScore(0, 0)).toBe(0);
    });
});

describe('calculateMitigationCoverage', () => {
    const createControl = (status: ControlStatus): Control => ({
        id: 'ctrl-1',
        organizationId: 'org-1',
        code: 'A.1.1',
        name: 'Test Control',
        description: 'Description',
        status,
        framework: 'ISO27001',
    });

    it('returns 0 for empty controls array', () => {
        expect(calculateMitigationCoverage([])).toBe(0);
    });

    it('returns 100 for fully implemented controls', () => {
        const controls = [
            createControl('Implémenté'),
            createControl('Actif')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(100);
    });

    it('returns 50 for partial controls', () => {
        const controls = [
            createControl('Partiel'),
            createControl('Partiel')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(50);
    });

    it('returns 30 for in-progress controls', () => {
        const controls = [
            createControl('En cours'),
            createControl('En cours')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(30);
    });

    it('returns 20 for in-review controls', () => {
        const controls = [
            createControl('En revue'),
            createControl('En revue')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(20);
    });

    it('returns 10 for not started controls', () => {
        const controls = [
            createControl('Non commencé'),
            createControl('Non commencé')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(10);
    });

    it('returns 0 for non-applicable or excluded controls', () => {
        const controls = [
            createControl('Non applicable'),
            createControl('Exclu')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(0);
    });

    it('returns 0 for inactive controls', () => {
        const controls = [
            createControl('Inactif'),
            createControl('Inactif')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(0);
    });

    it('calculates mixed status correctly (excludes non-applicable)', () => {
        const controls = [
            createControl('Implémenté'),  // 1.0
            createControl('Partiel'),     // 0.5
            createControl('En cours'),    // 0.3
            createControl('Non applicable') // excluded from calculation
        ];
        // Average: (1.0 + 0.5 + 0.3) / 3 = 0.6 = 60% (Non applicable is excluded)
        expect(calculateMitigationCoverage(controls)).toBe(60);
    });

    it('handles non-conforme status as 0', () => {
        const controls = [
            createControl('Non conforme')
        ];
        expect(calculateMitigationCoverage(controls)).toBe(0);
    });

    it('caps result at 100', () => {
        // This shouldn't happen with valid weights, but tests the Math.min
        const controls = [
            createControl('Implémenté')
        ];
        const result = calculateMitigationCoverage(controls);
        expect(result).toBeLessThanOrEqual(100);
    });
});
