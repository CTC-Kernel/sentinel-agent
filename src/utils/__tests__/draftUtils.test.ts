/**
 * draftUtils Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect } from 'vitest';
import { isDraftStatus } from '../draftUtils';

describe('isDraftStatus', () => {
    describe('valid draft statuses', () => {
        it('should return true for "Brouillon"', () => {
            expect(isDraftStatus('Brouillon')).toBe(true);
        });

        it('should return true for "brouillon" (lowercase)', () => {
            expect(isDraftStatus('brouillon')).toBe(true);
        });

        it('should return true for "Draft"', () => {
            expect(isDraftStatus('Draft')).toBe(true);
        });

        it('should return true for "draft" (lowercase)', () => {
            expect(isDraftStatus('draft')).toBe(true);
        });
    });

    describe('non-draft statuses', () => {
        it('should return false for "Publié"', () => {
            expect(isDraftStatus('Publié')).toBe(false);
        });

        it('should return false for "En revue"', () => {
            expect(isDraftStatus('En revue')).toBe(false);
        });

        it('should return false for "Approuvé"', () => {
            expect(isDraftStatus('Approuvé')).toBe(false);
        });

        it('should return false for "Archivé"', () => {
            expect(isDraftStatus('Archivé')).toBe(false);
        });

        it('should return false for "Active"', () => {
            expect(isDraftStatus('Active')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isDraftStatus('')).toBe(false);
        });

        it('should return false for random string', () => {
            expect(isDraftStatus('random')).toBe(false);
        });
    });

    describe('null and undefined handling', () => {
        it('should return false for null', () => {
            expect(isDraftStatus(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(isDraftStatus(undefined)).toBe(false);
        });
    });
});
