/**
 * autoSaveUtils Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect } from 'vitest';
import { getAutoSaveLabel, getAutoSaveLabels } from '../autoSaveUtils';

describe('getAutoSaveLabel', () => {
    describe('French locale', () => {
        it('should return saving label in French', () => {
            const label = getAutoSaveLabel('fr', 'saving');
            expect(label).toBe('Enregistrement...');
        });

        it('should return saved label in French', () => {
            const label = getAutoSaveLabel('fr', 'saved');
            expect(label).toBe('Enregistré');
        });

        it('should return error label in French', () => {
            const label = getAutoSaveLabel('fr', 'error');
            expect(label).toBe("Échec de l'enregistrement");
        });

        it('should return retry label in French', () => {
            const label = getAutoSaveLabel('fr', 'retry');
            expect(label).toBe('Réessayer');
        });

        it('should return pending label in French', () => {
            const label = getAutoSaveLabel('fr', 'pending');
            expect(label).toBe('Modifications en attente...');
        });

        it('should return justNow label in French', () => {
            const label = getAutoSaveLabel('fr', 'justNow');
            expect(label).toBe("À l'instant");
        });

        it('should return minutesAgo function in French', () => {
            const label = getAutoSaveLabel('fr', 'minutesAgo');
            expect(typeof label).toBe('function');
            expect((label as (n: number) => string)(5)).toBe('il y a 5 min');
        });

        it('should return hoursAgo function in French', () => {
            const label = getAutoSaveLabel('fr', 'hoursAgo');
            expect(typeof label).toBe('function');
            expect((label as (n: number) => string)(2)).toBe('il y a 2h');
        });
    });

    describe('English locale', () => {
        it('should return saving label in English', () => {
            const label = getAutoSaveLabel('en', 'saving');
            expect(label).toBe('Saving...');
        });

        it('should return saved label in English', () => {
            const label = getAutoSaveLabel('en', 'saved');
            expect(label).toBe('Saved');
        });

        it('should return error label in English', () => {
            const label = getAutoSaveLabel('en', 'error');
            expect(label).toBe('Save failed');
        });

        it('should return retry label in English', () => {
            const label = getAutoSaveLabel('en', 'retry');
            expect(label).toBe('Retry');
        });

        it('should return pending label in English', () => {
            const label = getAutoSaveLabel('en', 'pending');
            expect(label).toBe('Changes pending...');
        });

        it('should return justNow label in English', () => {
            const label = getAutoSaveLabel('en', 'justNow');
            expect(label).toBe('Just now');
        });

        it('should return minutesAgo function in English', () => {
            const label = getAutoSaveLabel('en', 'minutesAgo');
            expect(typeof label).toBe('function');
            expect((label as (n: number) => string)(5)).toBe('5 min ago');
        });

        it('should return hoursAgo function in English', () => {
            const label = getAutoSaveLabel('en', 'hoursAgo');
            expect(typeof label).toBe('function');
            expect((label as (n: number) => string)(2)).toBe('2h ago');
        });
    });
});

describe('getAutoSaveLabels', () => {
    it('should return all French labels', () => {
        const labels = getAutoSaveLabels('fr');

        expect(labels.saving).toBe('Enregistrement...');
        expect(labels.saved).toBe('Enregistré');
        expect(labels.error).toBe("Échec de l'enregistrement");
        expect(labels.retry).toBe('Réessayer');
        expect(labels.pending).toBe('Modifications en attente...');
        expect(labels.justNow).toBe("À l'instant");
        expect(typeof labels.minutesAgo).toBe('function');
        expect(typeof labels.hoursAgo).toBe('function');
    });

    it('should return all English labels', () => {
        const labels = getAutoSaveLabels('en');

        expect(labels.saving).toBe('Saving...');
        expect(labels.saved).toBe('Saved');
        expect(labels.error).toBe('Save failed');
        expect(labels.retry).toBe('Retry');
        expect(labels.pending).toBe('Changes pending...');
        expect(labels.justNow).toBe('Just now');
        expect(typeof labels.minutesAgo).toBe('function');
        expect(typeof labels.hoursAgo).toBe('function');
    });

    it('should allow calling time functions from returned labels', () => {
        const frLabels = getAutoSaveLabels('fr');
        const enLabels = getAutoSaveLabels('en');

        expect(frLabels.minutesAgo(10)).toBe('il y a 10 min');
        expect(frLabels.hoursAgo(3)).toBe('il y a 3h');
        expect(enLabels.minutesAgo(10)).toBe('10 min ago');
        expect(enLabels.hoursAgo(3)).toBe('3h ago');
    });
});
