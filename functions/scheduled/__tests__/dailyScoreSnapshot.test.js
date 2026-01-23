/**
 * Daily Score Snapshot Cloud Function Tests
 * ADR-003: Score de Conformité Global
 *
 * Tests utility functions for compliance score history and trends
 */

const {
    calculateTrendFromHistory,
    getTodayDateString,
    getDateNDaysAgo,
    TREND_THRESHOLD,
    HISTORY_RETENTION_DAYS
} = require('../dailyScoreSnapshot');

describe('Daily Score Snapshot Functions', () => {
    describe('Constants', () => {
        it('should have correct TREND_THRESHOLD', () => {
            expect(TREND_THRESHOLD).toBe(5);
        });

        it('should have correct HISTORY_RETENTION_DAYS', () => {
            expect(HISTORY_RETENTION_DAYS).toBe(90);
        });
    });

    describe('getTodayDateString', () => {
        it('should return date in YYYY-MM-DD format', () => {
            const result = getTodayDateString();

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should return today\'s date', () => {
            const result = getTodayDateString();
            const today = new Date().toISOString().split('T')[0];

            expect(result).toBe(today);
        });

        it('should not include time component', () => {
            const result = getTodayDateString();

            expect(result).not.toContain('T');
            expect(result).not.toContain(':');
        });
    });

    describe('getDateNDaysAgo', () => {
        it('should return date in YYYY-MM-DD format', () => {
            const result = getDateNDaysAgo(7);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should return today for 0 days ago', () => {
            const result = getDateNDaysAgo(0);
            const today = new Date().toISOString().split('T')[0];

            expect(result).toBe(today);
        });

        it('should return correct date for 7 days ago', () => {
            const result = getDateNDaysAgo(7);
            const expected = new Date();
            expected.setDate(expected.getDate() - 7);

            expect(result).toBe(expected.toISOString().split('T')[0]);
        });

        it('should return correct date for 30 days ago', () => {
            const result = getDateNDaysAgo(30);
            const expected = new Date();
            expected.setDate(expected.getDate() - 30);

            expect(result).toBe(expected.toISOString().split('T')[0]);
        });

        it('should return correct date for HISTORY_RETENTION_DAYS ago', () => {
            const result = getDateNDaysAgo(HISTORY_RETENTION_DAYS);
            const expected = new Date();
            expected.setDate(expected.getDate() - HISTORY_RETENTION_DAYS);

            expect(result).toBe(expected.toISOString().split('T')[0]);
        });

        it('should handle year boundary correctly', () => {
            // This test may behave differently depending on current date
            const result = getDateNDaysAgo(400);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('calculateTrendFromHistory', () => {
        it('should return "stable" for empty history', () => {
            const result = calculateTrendFromHistory(75, []);

            expect(result).toBe('stable');
        });

        it('should return "up" when current score is significantly higher than average', () => {
            const historyDocs = [
                { data: () => ({ global: 60 }) },
                { data: () => ({ global: 62 }) },
                { data: () => ({ global: 58 }) },
            ];
            // Average = 60, current = 70 (diff = 10 > TREND_THRESHOLD)
            const result = calculateTrendFromHistory(70, historyDocs);

            expect(result).toBe('up');
        });

        it('should return "down" when current score is significantly lower than average', () => {
            const historyDocs = [
                { data: () => ({ global: 80 }) },
                { data: () => ({ global: 82 }) },
                { data: () => ({ global: 78 }) },
            ];
            // Average = 80, current = 70 (diff = -10 < -TREND_THRESHOLD)
            const result = calculateTrendFromHistory(70, historyDocs);

            expect(result).toBe('down');
        });

        it('should return "stable" when difference is within threshold', () => {
            const historyDocs = [
                { data: () => ({ global: 72 }) },
                { data: () => ({ global: 74 }) },
                { data: () => ({ global: 73 }) },
            ];
            // Average = 73, current = 75 (diff = 2 < TREND_THRESHOLD)
            const result = calculateTrendFromHistory(75, historyDocs);

            expect(result).toBe('stable');
        });

        it('should return "stable" for exactly at threshold (5 points up)', () => {
            const historyDocs = [
                { data: () => ({ global: 70 }) },
            ];
            // Average = 70, current = 75 (diff = 5 = TREND_THRESHOLD, not > threshold)
            const result = calculateTrendFromHistory(75, historyDocs);

            expect(result).toBe('stable');
        });

        it('should return "up" for just above threshold', () => {
            const historyDocs = [
                { data: () => ({ global: 70 }) },
            ];
            // Average = 70, current = 76 (diff = 6 > TREND_THRESHOLD)
            const result = calculateTrendFromHistory(76, historyDocs);

            expect(result).toBe('up');
        });

        it('should handle single history entry', () => {
            const historyDocs = [
                { data: () => ({ global: 50 }) },
            ];

            const result = calculateTrendFromHistory(60, historyDocs);

            expect(result).toBe('up');
        });

        it('should handle large history array', () => {
            const historyDocs = Array(30).fill(null).map(() => ({
                data: () => ({ global: 70 })
            }));
            // Average = 70, current = 85 (diff = 15 > TREND_THRESHOLD)
            const result = calculateTrendFromHistory(85, historyDocs);

            expect(result).toBe('up');
        });

        it('should handle missing global in history entries', () => {
            const historyDocs = [
                { data: () => ({ global: 60 }) },
                { data: () => ({}) }, // Missing global - should be treated as 0
                { data: () => ({ global: 60 }) },
            ];
            // Average = (60 + 0 + 60) / 3 = 40, current = 60 (diff = 20 > TREND_THRESHOLD)
            const result = calculateTrendFromHistory(60, historyDocs);

            expect(result).toBe('up');
        });

        it('should handle all zeros in history', () => {
            const historyDocs = [
                { data: () => ({ global: 0 }) },
                { data: () => ({ global: 0 }) },
            ];
            // Average = 0, current = 10 (diff = 10 > TREND_THRESHOLD)
            const result = calculateTrendFromHistory(10, historyDocs);

            expect(result).toBe('up');
        });

        it('should handle perfect score stability', () => {
            const historyDocs = Array(7).fill(null).map(() => ({
                data: () => ({ global: 100 })
            }));
            // Average = 100, current = 100 (diff = 0)
            const result = calculateTrendFromHistory(100, historyDocs);

            expect(result).toBe('stable');
        });

        it('should handle zero score stability', () => {
            const historyDocs = Array(7).fill(null).map(() => ({
                data: () => ({ global: 0 })
            }));
            // Average = 0, current = 0 (diff = 0)
            const result = calculateTrendFromHistory(0, historyDocs);

            expect(result).toBe('stable');
        });
    });

    describe('Trend Calculation Edge Cases', () => {
        it('should calculate correct trend for typical compliance improvement', () => {
            // Simulate gradual improvement over 7 days
            const historyDocs = [
                { data: () => ({ global: 65 }) },
                { data: () => ({ global: 67 }) },
                { data: () => ({ global: 68 }) },
                { data: () => ({ global: 70 }) },
                { data: () => ({ global: 71 }) },
                { data: () => ({ global: 72 }) },
                { data: () => ({ global: 73 }) },
            ];
            // Average ≈ 69.4, current = 80 (diff ≈ 10.6 > TREND_THRESHOLD)
            const result = calculateTrendFromHistory(80, historyDocs);

            expect(result).toBe('up');
        });

        it('should detect decline after audit findings', () => {
            // Simulate score drop after audit identified issues
            const historyDocs = [
                { data: () => ({ global: 85 }) },
                { data: () => ({ global: 84 }) },
                { data: () => ({ global: 85 }) },
            ];
            // Average = 84.67, current = 72 (diff ≈ -12.67 < -TREND_THRESHOLD)
            const result = calculateTrendFromHistory(72, historyDocs);

            expect(result).toBe('down');
        });

        it('should show stability during normal operations', () => {
            // Typical day-to-day fluctuations
            const historyDocs = [
                { data: () => ({ global: 78 }) },
                { data: () => ({ global: 79 }) },
                { data: () => ({ global: 77 }) },
                { data: () => ({ global: 78 }) },
                { data: () => ({ global: 80 }) },
            ];
            // Average = 78.4, current = 79 (diff = 0.6, within threshold)
            const result = calculateTrendFromHistory(79, historyDocs);

            expect(result).toBe('stable');
        });
    });
});
