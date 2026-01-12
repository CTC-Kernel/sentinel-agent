/**
 * Date Utilities Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '../date';

describe('Date Utilities', () => {
    describe('formatDate', () => {
        it('should format a valid date string', () => {
            const result = formatDate('2024-01-15');
            expect(result).toMatch(/15.*janv.*2024/i);
        });

        it('should format a Date object', () => {
            const date = new Date(2024, 5, 20); // June 20, 2024
            const result = formatDate(date);
            expect(result).toMatch(/20.*juin.*2024/i);
        });

        it('should return dash for null', () => {
            expect(formatDate(null)).toBe('-');
        });

        it('should return dash for undefined', () => {
            expect(formatDate(undefined)).toBe('-');
        });

        it('should return dash for empty string', () => {
            expect(formatDate('')).toBe('-');
        });

        it('should handle ISO date strings', () => {
            const result = formatDate('2024-03-15T10:30:00Z');
            expect(result).toMatch(/15.*mars.*2024/i);
        });
    });

    describe('formatDateTime', () => {
        it('should format a valid date string with time', () => {
            const result = formatDateTime('2024-01-15T14:30:00');
            expect(result).toContain('2024');
            expect(result).toMatch(/14[h:]30/);
        });

        it('should format a Date object with time', () => {
            const date = new Date(2024, 5, 20, 9, 45); // June 20, 2024, 9:45
            const result = formatDateTime(date);
            expect(result).toMatch(/20.*juin.*2024/i);
            expect(result).toMatch(/09[h:]45/);
        });

        it('should return dash for null', () => {
            expect(formatDateTime(null)).toBe('-');
        });

        it('should return dash for undefined', () => {
            expect(formatDateTime(undefined)).toBe('-');
        });

        it('should return dash for empty string', () => {
            expect(formatDateTime('')).toBe('-');
        });

        it('should handle midnight time', () => {
            const result = formatDateTime('2024-01-01T00:00:00');
            expect(result).toMatch(/00[h:]00/);
        });
    });
});
