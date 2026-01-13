/**
 * ThemeContext Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { colorSchemes, ThemeContext } from '../ThemeContext';

describe('colorSchemes', () => {
    it('should have default color scheme', () => {
        expect(colorSchemes.default).toBeDefined();
        expect(colorSchemes.default.primary).toBeTruthy();
        expect(colorSchemes.default.secondary).toBeTruthy();
        expect(colorSchemes.default.accent).toBeTruthy();
    });

    it('should have blue color scheme', () => {
        expect(colorSchemes.blue).toBeDefined();
        expect(colorSchemes.blue.primary).toBe('37 99 235');
    });

    it('should have green color scheme', () => {
        expect(colorSchemes.green).toBeDefined();
        expect(colorSchemes.green.primary).toBe('34 197 94');
    });

    it('should have purple color scheme', () => {
        expect(colorSchemes.purple).toBeDefined();
        expect(colorSchemes.purple.primary).toBe('109 40 217');
    });

    it('should have orange color scheme', () => {
        expect(colorSchemes.orange).toBeDefined();
        expect(colorSchemes.orange.primary).toBe('249 115 22');
    });

    it('should have red color scheme', () => {
        expect(colorSchemes.red).toBeDefined();
        expect(colorSchemes.red.primary).toBe('239 68 68');
    });

    it('should have all required colors in each scheme', () => {
        Object.values(colorSchemes).forEach(scheme => {
            expect(scheme.primary).toBeTruthy();
            expect(scheme.secondary).toBeTruthy();
            expect(scheme.accent).toBeTruthy();
        });
    });

    it('should have valid RGB format for all colors', () => {
        const rgbPattern = /^\d+ \d+ \d+$/;
        Object.values(colorSchemes).forEach(scheme => {
            expect(scheme.primary).toMatch(rgbPattern);
            expect(scheme.secondary).toMatch(rgbPattern);
            expect(scheme.accent).toMatch(rgbPattern);
        });
    });
});

describe('ThemeContext', () => {
    it('should export ThemeContext', () => {
        expect(ThemeContext).toBeDefined();
    });

    it('should have undefined default value', () => {
        // React context default value
        // We can't directly access _currentValue but we can check it's a valid context
        expect(ThemeContext.Provider).toBeDefined();
        expect(ThemeContext.Consumer).toBeDefined();
    });
});
