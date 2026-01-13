/**
 * Utils Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn (className utility)', () => {
    it('should merge class names', () => {
        const result = cn('class1', 'class2');
        expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
        const isActive = true;
        const isDisabled = false;

        const result = cn(
            'base-class',
            isActive && 'active-class',
            isDisabled && 'disabled-class'
        );

        expect(result).toBe('base-class active-class');
        expect(result).not.toContain('disabled-class');
    });

    it('should handle array of classes', () => {
        const result = cn(['class1', 'class2']);
        expect(result).toContain('class1');
        expect(result).toContain('class2');
    });

    it('should merge tailwind classes correctly', () => {
        // twMerge should handle conflicting classes
        const result = cn('p-4', 'p-2');
        // The last class should win
        expect(result).toBe('p-2');
    });

    it('should handle null and undefined', () => {
        const result = cn('class1', null, undefined, 'class2');
        expect(result).toBe('class1 class2');
    });

    it('should handle empty strings', () => {
        const result = cn('class1', '', 'class2');
        expect(result).toBe('class1 class2');
    });

    it('should handle object syntax', () => {
        const result = cn({
            'active': true,
            'disabled': false,
            'visible': true
        });

        expect(result).toContain('active');
        expect(result).toContain('visible');
        expect(result).not.toContain('disabled');
    });

    it('should merge responsive variants', () => {
        const result = cn('text-sm', 'md:text-base', 'lg:text-lg');
        expect(result).toContain('text-sm');
        expect(result).toContain('md:text-base');
        expect(result).toContain('lg:text-lg');
    });

    it('should handle hover and focus states', () => {
        const result = cn('bg-blue-500', 'hover:bg-blue-600', 'focus:ring-2');
        expect(result).toContain('bg-blue-500');
        expect(result).toContain('hover:bg-blue-600');
        expect(result).toContain('focus:ring-2');
    });

    it('should return empty string for no inputs', () => {
        const result = cn();
        expect(result).toBe('');
    });
});
