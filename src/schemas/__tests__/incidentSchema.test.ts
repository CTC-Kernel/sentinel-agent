/**
 * Unit tests for incidentSchema.ts
 * Tests validation of incident forms
 */

import { describe, it, expect } from 'vitest';
import { incidentSchema } from '../incidentSchema';
import { Criticality } from '../../types';

describe('incidentSchema', () => {
    const validIncident = {
        title: 'Security Incident',
        description: 'A detailed description of the security incident',
        severity: Criticality.HIGH,
        status: 'Nouveau' as const,
        reporter: 'John Doe'
    };

    describe('required fields', () => {
        it('accepts valid incident data', () => {
            const result = incidentSchema.safeParse(validIncident);
            expect(result.success).toBe(true);
        });

        it('rejects missing title', () => {
            const { title, ...data } = validIncident;
            const result = incidentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty title', () => {
            const result = incidentSchema.safeParse({ ...validIncident, title: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing description', () => {
            const { description, ...data } = validIncident;
            const result = incidentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty description', () => {
            const result = incidentSchema.safeParse({ ...validIncident, description: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing severity', () => {
            const { severity, ...data } = validIncident;
            const result = incidentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing status', () => {
            const { status, ...data } = validIncident;
            const result = incidentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing reporter', () => {
            const { reporter, ...data } = validIncident;
            const result = incidentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty reporter', () => {
            const result = incidentSchema.safeParse({ ...validIncident, reporter: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects title longer than 200 characters', () => {
            const result = incidentSchema.safeParse({ ...validIncident, title: 'a'.repeat(201) });
            expect(result.success).toBe(false);
        });

        it('accepts title at max length (200)', () => {
            const result = incidentSchema.safeParse({ ...validIncident, title: 'a'.repeat(200) });
            expect(result.success).toBe(true);
        });

        it('rejects description longer than 5000 characters', () => {
            const result = incidentSchema.safeParse({ ...validIncident, description: 'a'.repeat(5001) });
            expect(result.success).toBe(false);
        });

        it('accepts description at max length (5000)', () => {
            const result = incidentSchema.safeParse({ ...validIncident, description: 'a'.repeat(5000) });
            expect(result.success).toBe(true);
        });
    });

    describe('severity validation', () => {
        it.each(Object.values(Criticality))(
            'accepts valid severity: %s',
            (severity) => {
                const result = incidentSchema.safeParse({ ...validIncident, severity });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid severity', () => {
            const result = incidentSchema.safeParse({ ...validIncident, severity: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('status validation', () => {
        it.each(['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'] as const)(
            'accepts valid status: %s',
            (status) => {
                const result = incidentSchema.safeParse({ ...validIncident, status });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid status', () => {
            const result = incidentSchema.safeParse({ ...validIncident, status: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('category validation', () => {
        it.each(['Ransomware', 'Phishing', 'Vol Matériel', 'Indisponibilité', 'Fuite de Données', 'Autre'] as const)(
            'accepts valid category: %s',
            (category) => {
                const result = incidentSchema.safeParse({ ...validIncident, category });
                expect(result.success).toBe(true);
            }
        );

        it('accepts undefined category', () => {
            const result = incidentSchema.safeParse(validIncident);
            expect(result.success).toBe(true);
        });

        it('rejects invalid category', () => {
            const result = incidentSchema.safeParse({ ...validIncident, category: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('NIS 2 fields', () => {
        it('accepts isSignificant boolean', () => {
            const result = incidentSchema.safeParse({ ...validIncident, isSignificant: true });
            expect(result.success).toBe(true);
        });

        it('validates notification status', () => {
            const validResult = incidentSchema.safeParse({
                ...validIncident,
                notificationStatus: 'Reported'
            });
            expect(validResult.success).toBe(true);

            const invalidResult = incidentSchema.safeParse({
                ...validIncident,
                notificationStatus: 'Invalid'
            });
            expect(invalidResult.success).toBe(false);
        });

        it.each(['Not Required', 'Pending', 'Reported'] as const)(
            'accepts valid notification status: %s',
            (status) => {
                const result = incidentSchema.safeParse({
                    ...validIncident,
                    notificationStatus: status
                });
                expect(result.success).toBe(true);
            }
        );

        it('accepts relevant authorities array', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                relevantAuthorities: ['ANSSI', 'CNIL']
            });
            expect(result.success).toBe(true);
        });
    });

    describe('playbook steps', () => {
        it('accepts playbook steps completed array', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                playbookStepsCompleted: ['step1', 'step2', 'step3']
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty playbook steps array', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                playbookStepsCompleted: []
            });
            expect(result.success).toBe(true);
        });
    });

    describe('optional fields', () => {
        it('accepts all optional fields', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                affectedAssetId: 'asset-123',
                relatedRiskId: 'risk-456',
                financialImpact: 50000,
                dateReported: '2024-01-15',
                dateAnalysis: '2024-01-16',
                dateContained: '2024-01-17',
                dateResolved: '2024-01-20',
                lessonsLearned: 'Important lessons from this incident',
                affectedProcessId: 'process-789'
            });
            expect(result.success).toBe(true);
        });

        it('accepts financial impact as number', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                financialImpact: 100000
            });
            expect(result.success).toBe(true);
        });

        it('accepts zero financial impact', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                financialImpact: 0
            });
            expect(result.success).toBe(true);
        });
    });

    describe('whitespace trimming', () => {
        it('trims whitespace from title', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                title: '  Incident Title  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.title).toBe('Incident Title');
            }
        });

        it('trims whitespace from description', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                description: '  Description  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.description).toBe('Description');
            }
        });

        it('trims whitespace from reporter', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                reporter: '  John Doe  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reporter).toBe('John Doe');
            }
        });

        it('trims whitespace from lessons learned', () => {
            const result = incidentSchema.safeParse({
                ...validIncident,
                lessonsLearned: '  Important lesson  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lessonsLearned).toBe('Important lesson');
            }
        });
    });
});
