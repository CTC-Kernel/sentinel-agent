/**
 * NIS2 Incident Alerts Cloud Function Tests
 * Story EU-1: NIS2 Compliance
 *
 * Tests utility functions for NIS2 deadline tracking
 */

// Mock firebase-admin before importing the module
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        collection: jest.fn(),
    })),
}));

const {
    getTimeRemaining,
    formatTimeRemaining,
    NIS2_DEADLINES
} = require('../nis2IncidentAlerts');

describe('NIS2 Incident Alerts Functions', () => {
    describe('NIS2_DEADLINES', () => {
        it('should have correct INITIAL_NOTIFICATION deadline (24 hours)', () => {
            expect(NIS2_DEADLINES.INITIAL_NOTIFICATION).toBe(24 * 60 * 60 * 1000);
        });

        it('should have correct INTERMEDIATE_REPORT deadline (72 hours)', () => {
            expect(NIS2_DEADLINES.INTERMEDIATE_REPORT).toBe(72 * 60 * 60 * 1000);
        });

        it('should have correct FINAL_REPORT deadline (30 days)', () => {
            expect(NIS2_DEADLINES.FINAL_REPORT).toBe(30 * 24 * 60 * 60 * 1000);
        });

        it('should have correct WARNING_THRESHOLD (6 hours)', () => {
            expect(NIS2_DEADLINES.WARNING_THRESHOLD).toBe(6 * 60 * 60 * 1000);
        });
    });

    describe('getTimeRemaining', () => {
        it('should return positive time when deadline is in the future', () => {
            const detectedAt = new Date().toISOString();
            const deadlineMs = 24 * 60 * 60 * 1000; // 24 hours

            const remaining = getTimeRemaining(detectedAt, deadlineMs);

            // Should be approximately 24 hours (with small margin for test execution)
            expect(remaining).toBeGreaterThan(23 * 60 * 60 * 1000);
            expect(remaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
        });

        it('should return negative time when deadline has passed', () => {
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const deadlineMs = 24 * 60 * 60 * 1000; // 24 hours

            const remaining = getTimeRemaining(twoDaysAgo.toISOString(), deadlineMs);

            // Should be negative (deadline passed)
            expect(remaining).toBeLessThan(0);
        });

        it('should handle ISO date strings', () => {
            const now = new Date();
            const detectedAt = now.toISOString();
            const deadlineMs = 72 * 60 * 60 * 1000; // 72 hours

            const remaining = getTimeRemaining(detectedAt, deadlineMs);

            expect(remaining).toBeGreaterThan(0);
        });

        it('should calculate correct time for 72h deadline', () => {
            const now = Date.now();
            const detectedAt = new Date(now).toISOString();
            const deadlineMs = NIS2_DEADLINES.INTERMEDIATE_REPORT;

            const remaining = getTimeRemaining(detectedAt, deadlineMs);

            // Should be approximately 72 hours
            expect(remaining).toBeGreaterThan(71 * 60 * 60 * 1000);
            expect(remaining).toBeLessThanOrEqual(72 * 60 * 60 * 1000);
        });

        it('should handle detection at exact deadline time', () => {
            const now = new Date();
            const detectedAt = now.toISOString();
            const deadlineMs = 0; // Immediate deadline

            const remaining = getTimeRemaining(detectedAt, deadlineMs);

            // Should be at or very close to 0 (with small margin for execution)
            expect(remaining).toBeLessThanOrEqual(1000);
        });
    });

    describe('formatTimeRemaining', () => {
        it('should return "DÉPASSÉ" for negative time', () => {
            expect(formatTimeRemaining(-1000)).toBe('DÉPASSÉ');
        });

        it('should return "DÉPASSÉ" for zero time', () => {
            expect(formatTimeRemaining(0)).toBe('DÉPASSÉ');
        });

        it('should format hours and minutes for less than 24 hours', () => {
            const sixHours = 6 * 60 * 60 * 1000;
            const result = formatTimeRemaining(sixHours);

            expect(result).toBe('6h 0min');
        });

        it('should format hours and minutes correctly', () => {
            const time = 2 * 60 * 60 * 1000 + 30 * 60 * 1000; // 2h 30min
            const result = formatTimeRemaining(time);

            expect(result).toBe('2h 30min');
        });

        it('should format days and hours for more than 24 hours', () => {
            const twoDays = 48 * 60 * 60 * 1000;
            const result = formatTimeRemaining(twoDays);

            expect(result).toBe('2j 0h');
        });

        it('should format days with remaining hours', () => {
            const time = 26 * 60 * 60 * 1000; // 26 hours = 1 day 2 hours
            const result = formatTimeRemaining(time);

            expect(result).toBe('1j 2h');
        });

        it('should handle 30 days (FINAL_REPORT deadline)', () => {
            const thirtyDays = NIS2_DEADLINES.FINAL_REPORT;
            const result = formatTimeRemaining(thirtyDays);

            expect(result).toBe('30j 0h');
        });

        it('should format exactly 24 hours as days', () => {
            const twentyFourHours = 24 * 60 * 60 * 1000;
            const result = formatTimeRemaining(twentyFourHours);

            expect(result).toBe('1j 0h');
        });

        it('should format just under 24 hours as hours/minutes', () => {
            const time = 23 * 60 * 60 * 1000 + 59 * 60 * 1000; // 23h 59min
            const result = formatTimeRemaining(time);

            expect(result).toBe('23h 59min');
        });

        it('should handle very small time (1 minute)', () => {
            const oneMinute = 60 * 1000;
            const result = formatTimeRemaining(oneMinute);

            expect(result).toBe('0h 1min');
        });

        it('should handle WARNING_THRESHOLD time (6 hours)', () => {
            const result = formatTimeRemaining(NIS2_DEADLINES.WARNING_THRESHOLD);

            expect(result).toBe('6h 0min');
        });
    });

    describe('NIS2 Deadline Scenarios', () => {
        it('should correctly identify initial notification deadline approaching', () => {
            const now = Date.now();
            // Detected 18 hours ago
            const detectedAt = new Date(now - 18 * 60 * 60 * 1000).toISOString();

            const remaining = getTimeRemaining(detectedAt, NIS2_DEADLINES.INITIAL_NOTIFICATION);

            // Should have ~6 hours remaining
            expect(remaining).toBeGreaterThan(5 * 60 * 60 * 1000);
            expect(remaining).toBeLessThan(7 * 60 * 60 * 1000);

            const formatted = formatTimeRemaining(remaining);
            expect(formatted).toMatch(/^[56]h \d+min$/);
        });

        it('should correctly identify overdue initial notification', () => {
            const now = Date.now();
            // Detected 30 hours ago (6 hours overdue)
            const detectedAt = new Date(now - 30 * 60 * 60 * 1000).toISOString();

            const remaining = getTimeRemaining(detectedAt, NIS2_DEADLINES.INITIAL_NOTIFICATION);

            expect(remaining).toBeLessThan(0);
            expect(formatTimeRemaining(remaining)).toBe('DÉPASSÉ');
        });

        it('should correctly track intermediate report deadline', () => {
            const now = Date.now();
            // Detected 48 hours ago (24h remaining for 72h deadline)
            const detectedAt = new Date(now - 48 * 60 * 60 * 1000).toISOString();

            const remaining = getTimeRemaining(detectedAt, NIS2_DEADLINES.INTERMEDIATE_REPORT);

            // Should have ~24 hours remaining
            expect(remaining).toBeGreaterThan(23 * 60 * 60 * 1000);
            expect(remaining).toBeLessThan(25 * 60 * 60 * 1000);

            const formatted = formatTimeRemaining(remaining);
            expect(formatted).toBe('1j 0h');
        });
    });
});
