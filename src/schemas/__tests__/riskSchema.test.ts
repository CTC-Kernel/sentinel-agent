/**
 * Unit tests for riskSchema.ts
 * Tests validation of risk forms including business rules
 */

import { describe, it, expect, vi } from 'vitest';
import { riskSchema } from '../riskSchema';

// Mock i18n
vi.mock('../../i18n', () => ({
    default: {
        t: (key: string, params?: Record<string, unknown>) => {
            const translations: Record<string, string> = {
                'validation.minLength': `Minimum ${params?.min} caractères`,
                'validation.maxLength': `Maximum ${params?.max} caractères`,
                'risks.validation_residual': 'Le risque résiduel ne peut pas être supérieur au risque initial',
                'risks.validation_justification': 'Une justification est requise pour accepter un risque critique'
            };
            return translations[key] || key;
        }
    }
}));

describe('riskSchema', () => {
    const validRisk = {
        threat: 'Test threat description',
        vulnerability: 'Test vulnerability',
        probability: 3,
        impact: 4,
        strategy: 'Atténuer' as const,
        status: 'Ouvert' as const
    };

    describe('required fields', () => {
        it('accepts valid risk data', () => {
            const result = riskSchema.safeParse(validRisk);
            expect(result.success).toBe(true);
        });

        it('rejects missing threat', () => {
            const { threat: _threat, ...data } = validRisk;
            const result = riskSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing vulnerability', () => {
            const { vulnerability: _vulnerability, ...data } = validRisk;
            const result = riskSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing probability', () => {
            const { probability: _probability, ...data } = validRisk;
            const result = riskSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing impact', () => {
            const { impact: _impact, ...data } = validRisk;
            const result = riskSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing strategy', () => {
            const { strategy: _strategy, ...data } = validRisk;
            const result = riskSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing status', () => {
            const { status: _status, ...data } = validRisk;
            const result = riskSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('field constraints', () => {
        it('rejects threat shorter than 3 characters', () => {
            const result = riskSchema.safeParse({ ...validRisk, threat: 'ab' });
            expect(result.success).toBe(false);
        });

        it('rejects threat longer than 500 characters', () => {
            const result = riskSchema.safeParse({ ...validRisk, threat: 'a'.repeat(501) });
            expect(result.success).toBe(false);
        });

        it('rejects vulnerability shorter than 3 characters', () => {
            const result = riskSchema.safeParse({ ...validRisk, vulnerability: 'ab' });
            expect(result.success).toBe(false);
        });

        it('rejects vulnerability longer than 500 characters', () => {
            const result = riskSchema.safeParse({ ...validRisk, vulnerability: 'a'.repeat(501) });
            expect(result.success).toBe(false);
        });

        it('rejects scenario longer than 5000 characters', () => {
            const result = riskSchema.safeParse({ ...validRisk, scenario: 'a'.repeat(5001) });
            expect(result.success).toBe(false);
        });

        it('rejects probability less than 1', () => {
            const result = riskSchema.safeParse({ ...validRisk, probability: 0 });
            expect(result.success).toBe(false);
        });

        it('rejects probability greater than 5', () => {
            const result = riskSchema.safeParse({ ...validRisk, probability: 6 });
            expect(result.success).toBe(false);
        });

        it('rejects impact less than 1', () => {
            const result = riskSchema.safeParse({ ...validRisk, impact: 0 });
            expect(result.success).toBe(false);
        });

        it('rejects impact greater than 5', () => {
            const result = riskSchema.safeParse({ ...validRisk, impact: 6 });
            expect(result.success).toBe(false);
        });
    });

    describe('strategy validation', () => {
        it.each(['Atténuer', 'Transférer', 'Éviter'] as const)(
            'accepts valid strategy: %s',
            (strategy) => {
                const result = riskSchema.safeParse({ ...validRisk, strategy });
                expect(result.success).toBe(true);
            }
        );

        it('accepts Accepter strategy with low risk', () => {
            // Score = 2*2 = 4, which is below 12, so no justification needed
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 2,
                impact: 2,
                strategy: 'Accepter'
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid strategy', () => {
            const result = riskSchema.safeParse({ ...validRisk, strategy: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('status validation', () => {
        it.each(['Brouillon', 'Ouvert', 'En cours', 'En attente de validation', 'Fermé'] as const)(
            'accepts valid status: %s',
            (status) => {
                const result = riskSchema.safeParse({ ...validRisk, status });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid status', () => {
            const result = riskSchema.safeParse({ ...validRisk, status: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('framework validation', () => {
        it.each(['ISO27001', 'ISO27005', 'NIS2', 'DORA', 'GDPR'] as const)(
            'accepts valid framework: %s',
            (framework) => {
                const result = riskSchema.safeParse({ ...validRisk, framework });
                expect(result.success).toBe(true);
            }
        );

        it('accepts undefined framework', () => {
            const result = riskSchema.safeParse(validRisk);
            expect(result.success).toBe(true);
        });

        it('rejects invalid framework', () => {
            const result = riskSchema.safeParse({ ...validRisk, framework: 'INVALID' });
            expect(result.success).toBe(false);
        });
    });

    describe('treatment object validation', () => {
        it('accepts valid treatment object', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                treatment: {
                    strategy: 'Atténuer',
                    description: 'Treatment plan',
                    ownerId: 'user-123',
                    dueDate: '2024-12-31',
                    status: 'Planifié',
                    slaStatus: 'On Track',
                    estimatedCost: 5000
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty treatment object', () => {
            const result = riskSchema.safeParse({ ...validRisk, treatment: { strategy: 'Atténuer' } });
            expect(result.success).toBe(true);
        });

        it('accepts undefined treatment', () => {
            const result = riskSchema.safeParse(validRisk);
            expect(result.success).toBe(true);
        });

        it('validates treatment SLA status', () => {
            const validResult = riskSchema.safeParse({
                ...validRisk,
                treatment: { slaStatus: 'At Risk', strategy: 'Atténuer' }
            });
            expect(validResult.success).toBe(true);

            const invalidResult = riskSchema.safeParse({
                ...validRisk,
                treatment: { slaStatus: 'Invalid', strategy: 'Atténuer' }
            });
            expect(invalidResult.success).toBe(false);
        });
    });

    describe('MITRE techniques validation', () => {
        it('accepts valid MITRE techniques array', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                mitreTechniques: [
                    { id: 'T1059', name: 'Command Line', description: 'Command line interface' },
                    { id: 'T1078', name: 'Valid Accounts', description: 'Adversary use of valid accounts' }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty MITRE techniques array', () => {
            const result = riskSchema.safeParse({ ...validRisk, mitreTechniques: [] });
            expect(result.success).toBe(true);
        });

        it('rejects MITRE techniques with missing id', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                mitreTechniques: [{ name: 'Test', description: 'Test' }]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('residual risk refinement', () => {
        it('accepts residual risk lower than inherent risk', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 4,
                impact: 4,
                residualProbability: 2,
                residualImpact: 2
            });
            expect(result.success).toBe(true);
        });

        it('accepts residual risk equal to inherent risk', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 3,
                impact: 3,
                residualProbability: 3,
                residualImpact: 3
            });
            expect(result.success).toBe(true);
        });

        it('rejects residual risk higher than inherent risk', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 2,
                impact: 2,
                residualProbability: 4,
                residualImpact: 4
            });
            expect(result.success).toBe(false);
        });

        it('accepts when only residual probability is set', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                residualProbability: 2
            });
            expect(result.success).toBe(true);
        });

        it('accepts when only residual impact is set', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                residualImpact: 2
            });
            expect(result.success).toBe(true);
        });
    });

    describe('justification refinement for accepted critical risks', () => {
        it('requires justification when accepting critical risk (score >= 12)', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 4,
                impact: 4, // Score = 16
                strategy: 'Accepter'
            });
            expect(result.success).toBe(false);
        });

        it('accepts critical risk with proper justification', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 4,
                impact: 4, // Score = 16
                strategy: 'Accepter',
                justification: 'This is a detailed justification for accepting this critical risk because...'
            });
            expect(result.success).toBe(true);
        });

        it('rejects critical accepted risk with short justification', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 4,
                impact: 3, // Score = 12
                strategy: 'Accepter',
                justification: 'Short' // Less than 10 chars
            });
            expect(result.success).toBe(false);
        });

        it('does not require justification for non-accepted critical risk', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 5,
                impact: 5, // Score = 25
                strategy: 'Atténuer'
            });
            expect(result.success).toBe(true);
        });

        it('does not require justification for accepted non-critical risk', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                probability: 2,
                impact: 3, // Score = 6
                strategy: 'Accepter'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('optional fields', () => {
        it('accepts all optional fields', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                assetId: 'asset-123',
                scenario: 'Detailed scenario',
                framework: 'ISO27001',
                owner: 'John Doe',
                ownerId: 'user-123',
                mitigationControlIds: ['ctrl-1', 'ctrl-2'],
                affectedProcessIds: ['proc-1'],
                relatedSupplierIds: ['sup-1'],
                relatedProjectIds: ['proj-1'],
                treatmentDeadline: '2024-12-31',
                treatmentOwnerId: 'user-456',
                treatmentStatus: 'Planifié',
                isSecureStorage: true
            });
            expect(result.success).toBe(true);
        });
    });

    describe('AI analysis field', () => {
        it('accepts valid AI analysis object', () => {
            const result = riskSchema.safeParse({
                ...validRisk,
                aiAnalysis: {
                    type: 'risk_assessment',
                    response: { recommendation: 'Some recommendation' },
                    timestamp: '2024-01-15T10:00:00Z'
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts null AI analysis', () => {
            const result = riskSchema.safeParse({ ...validRisk, aiAnalysis: null });
            expect(result.success).toBe(true);
        });

        it('accepts undefined AI analysis', () => {
            const result = riskSchema.safeParse(validRisk);
            expect(result.success).toBe(true);
        });
    });
});
