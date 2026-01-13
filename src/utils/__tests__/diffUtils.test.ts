/**
 * Diff Utils Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { getDiff } from '../diffUtils';

describe('Diff Utils', () => {
    describe('getDiff', () => {
        it('should return empty array for identical objects', () => {
            const obj = { name: 'Test', value: 123 };
            expect(getDiff(obj, obj)).toEqual([]);
        });

        it('should return empty array for equal objects', () => {
            const obj1 = { name: 'Test', value: 123 };
            const obj2 = { name: 'Test', value: 123 };
            expect(getDiff(obj1, obj2)).toEqual([]);
        });

        it('should detect changed values', () => {
            const newObj = { name: 'New Name', value: 123 };
            const oldObj = { name: 'Old Name', value: 123 };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(1);
            expect(changes[0].field).toBe('name');
            expect(changes[0].oldValue).toBe('Old Name');
            expect(changes[0].newValue).toBe('New Name');
        });

        it('should detect added fields', () => {
            const newObj = { name: 'Test', newField: 'added' };
            const oldObj = { name: 'Test' };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(1);
            expect(changes[0].field).toBe('newField');
            expect(changes[0].oldValue).toBeUndefined();
            expect(changes[0].newValue).toBe('added');
        });

        it('should handle undefined base object', () => {
            const newObj = { name: 'Test', value: 123 };

            const changes = getDiff(newObj, undefined);

            expect(changes).toHaveLength(2);
        });

        it('should ignore specified fields', () => {
            const newObj = { name: 'Test', updatedAt: '2024-01-15' };
            const oldObj = { name: 'Test', updatedAt: '2024-01-14' };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(0); // updatedAt is ignored by default
        });

        it('should allow custom ignore list', () => {
            const newObj = { name: 'New', customField: 'changed' };
            const oldObj = { name: 'Old', customField: 'original' };

            const changes = getDiff(newObj, oldObj, ['customField']);

            expect(changes).toHaveLength(1);
            expect(changes[0].field).toBe('name');
        });

        it('should handle nested objects', () => {
            const newObj = {
                name: 'Test',
                details: { level: 'high', score: 10 }
            };
            const oldObj = {
                name: 'Test',
                details: { level: 'low', score: 10 }
            };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(1);
            expect(changes[0].field).toBe('details.level');
            expect(changes[0].oldValue).toBe('low');
            expect(changes[0].newValue).toBe('high');
        });

        it('should detect array changes as value replacement', () => {
            const newObj = { tags: ['a', 'b', 'c'] };
            const oldObj = { tags: ['a', 'b'] };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(1);
            expect(changes[0].field).toBe('tags');
        });

        it('should handle multiple changes', () => {
            const newObj = { name: 'New', status: 'active', count: 5 };
            const oldObj = { name: 'Old', status: 'inactive', count: 3 };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(3);
        });

        it('should handle null values', () => {
            const newObj = { name: null };
            const oldObj = { name: 'Test' };

            const changes = getDiff(newObj, oldObj);

            expect(changes).toHaveLength(1);
            expect(changes[0].newValue).toBeNull();
        });
    });
});
