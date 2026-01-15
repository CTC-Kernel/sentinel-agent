/**
 * Unit tests for continuitySchema.ts
 * Tests validation of business continuity forms
 */

import { describe, it, expect } from 'vitest';
import {
    businessProcessSchema,
    bcpDrillSchema,
    strategySchema,
    warRoomMessageSchema,
    recoveryPlanSchema
} from '../continuitySchema';

describe('businessProcessSchema', () => {
    const validProcess = {
        name: 'Order Processing',
        description: 'Critical business process for handling customer orders',
        owner: 'Operations Team',
        rto: '4h',
        rpo: '1h',
        priority: 'Critique' as const
    };

    describe('required fields', () => {
        it('accepts valid business process data', () => {
            const result = businessProcessSchema.safeParse(validProcess);
            expect(result.success).toBe(true);
        });

        it('rejects missing name', () => {
            const { name: _name, ...data } = validProcess;
            const result = businessProcessSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty name', () => {
            const result = businessProcessSchema.safeParse({ ...validProcess, name: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing description', () => {
            const { description: _description, ...data } = validProcess;
            const result = businessProcessSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty description', () => {
            const result = businessProcessSchema.safeParse({ ...validProcess, description: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing owner', () => {
            const { owner: _owner, ...data } = validProcess;
            const result = businessProcessSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing rto', () => {
            const { rto: _rto, ...data } = validProcess;
            const result = businessProcessSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing rpo', () => {
            const { rpo: _rpo, ...data } = validProcess;
            const result = businessProcessSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing priority', () => {
            const { priority: _priority, ...data } = validProcess;
            const result = businessProcessSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects name longer than 100 characters', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                name: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('rejects description longer than 2000 characters', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                description: 'a'.repeat(2001)
            });
            expect(result.success).toBe(false);
        });

        it('rejects rto longer than 20 characters', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                rto: 'a'.repeat(21)
            });
            expect(result.success).toBe(false);
        });

        it('rejects rpo longer than 20 characters', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                rpo: 'a'.repeat(21)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('priority validation', () => {
        it.each(['Critique', 'Élevée', 'Moyenne', 'Faible'] as const)(
            'accepts valid priority: %s',
            (priority) => {
                const result = businessProcessSchema.safeParse({ ...validProcess, priority });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid priority', () => {
            const result = businessProcessSchema.safeParse({ ...validProcess, priority: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('recovery tasks validation', () => {
        it('accepts valid recovery tasks array', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                recoveryTasks: [
                    {
                        id: 'task-1',
                        title: 'Activate backup',
                        description: 'Switch to backup systems',
                        owner: 'IT Team',
                        duration: '30min',
                        order: 1
                    },
                    {
                        id: 'task-2',
                        title: 'Verify data',
                        owner: 'DBA',
                        duration: '15min',
                        order: 2
                    }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty recovery tasks array', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                recoveryTasks: []
            });
            expect(result.success).toBe(true);
        });

        it('rejects recovery task with missing id', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                recoveryTasks: [{ title: 'Task', owner: 'Owner', duration: '1h', order: 1 }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects recovery task with missing title', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                recoveryTasks: [{ id: '1', owner: 'Owner', duration: '1h', order: 1 }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects recovery task with empty title', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                recoveryTasks: [{ id: '1', title: '', owner: 'Owner', duration: '1h', order: 1 }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects recovery task title longer than 100 characters', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                recoveryTasks: [{ id: '1', title: 'a'.repeat(101), owner: 'Owner', duration: '1h', order: 1 }]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('optional arrays', () => {
        it('accepts supporting asset IDs', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                supportingAssetIds: ['asset-1', 'asset-2']
            });
            expect(result.success).toBe(true);
        });

        it('accepts related risk IDs', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                relatedRiskIds: ['risk-1']
            });
            expect(result.success).toBe(true);
        });

        it('accepts supplier IDs', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                supplierIds: ['supplier-1', 'supplier-2']
            });
            expect(result.success).toBe(true);
        });
    });

    describe('whitespace trimming', () => {
        it('trims whitespace from name', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                name: '  Process Name  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Process Name');
            }
        });

        it('trims whitespace from description', () => {
            const result = businessProcessSchema.safeParse({
                ...validProcess,
                description: '  Description  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.description).toBe('Description');
            }
        });
    });
});

describe('bcpDrillSchema', () => {
    const validDrill = {
        processId: 'process-123',
        date: '2024-03-15',
        type: 'Tabletop' as const,
        result: 'Succès' as const
    };

    describe('required fields', () => {
        it('accepts valid drill data', () => {
            const result = bcpDrillSchema.safeParse(validDrill);
            expect(result.success).toBe(true);
        });

        it('rejects missing processId', () => {
            const { processId: _processId, ...data } = validDrill;
            const result = bcpDrillSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty processId', () => {
            const result = bcpDrillSchema.safeParse({ ...validDrill, processId: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing date', () => {
            const { date: _date, ...data } = validDrill;
            const result = bcpDrillSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing type', () => {
            const { type: _type, ...data } = validDrill;
            const result = bcpDrillSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing result', () => {
            const { result: res, ...data } = validDrill;
            const result = bcpDrillSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('type validation', () => {
        it.each(['Tabletop', 'Simulation', 'Bascule réelle', 'Full Scale', 'Call Tree'] as const)(
            'accepts valid type: %s',
            (type) => {
                const result = bcpDrillSchema.safeParse({ ...validDrill, type });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid type', () => {
            const result = bcpDrillSchema.safeParse({ ...validDrill, type: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('result validation', () => {
        it.each(['Succès', 'Succès partiel', 'Échec'] as const)(
            'accepts valid result: %s',
            (res) => {
                const result = bcpDrillSchema.safeParse({ ...validDrill, result: res });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid result', () => {
            const result = bcpDrillSchema.safeParse({ ...validDrill, result: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('optional fields', () => {
        it('accepts notes', () => {
            const result = bcpDrillSchema.safeParse({
                ...validDrill,
                notes: 'Drill completed successfully with minor observations'
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('strategySchema', () => {
    const validStrategy = {
        title: 'Primary DR Strategy',
        type: 'Active-Passive' as const,
        rto: '4h',
        rpo: '1h'
    };

    describe('required fields', () => {
        it('accepts valid strategy data', () => {
            const result = strategySchema.safeParse(validStrategy);
            expect(result.success).toBe(true);
        });

        it('rejects missing title', () => {
            const { title: _title, ...data } = validStrategy;
            const result = strategySchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty title', () => {
            const result = strategySchema.safeParse({ ...validStrategy, title: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing type', () => {
            const { type: _type, ...data } = validStrategy;
            const result = strategySchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing rto', () => {
            const { rto: _rto, ...data } = validStrategy;
            const result = strategySchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing rpo', () => {
            const { rpo: _rpo, ...data } = validStrategy;
            const result = strategySchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('type validation', () => {
        it.each(['Active-Active', 'Active-Passive', 'Cold Standby', 'Cloud DR', 'Backup Only'] as const)(
            'accepts valid type: %s',
            (type) => {
                const result = strategySchema.safeParse({ ...validStrategy, type });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid type', () => {
            const result = strategySchema.safeParse({ ...validStrategy, type: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects title longer than 100 characters', () => {
            const result = strategySchema.safeParse({
                ...validStrategy,
                title: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('rejects rto longer than 20 characters', () => {
            const result = strategySchema.safeParse({
                ...validStrategy,
                rto: 'a'.repeat(21)
            });
            expect(result.success).toBe(false);
        });

        it('rejects rpo longer than 20 characters', () => {
            const result = strategySchema.safeParse({
                ...validStrategy,
                rpo: 'a'.repeat(21)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('optional fields', () => {
        it('accepts description and linked assets', () => {
            const result = strategySchema.safeParse({
                ...validStrategy,
                description: 'Comprehensive DR strategy',
                linkedAssets: ['asset-1', 'asset-2']
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('warRoomMessageSchema', () => {
    describe('content validation', () => {
        it('accepts valid message content', () => {
            const result = warRoomMessageSchema.safeParse({ content: 'Status update: Systems restored' });
            expect(result.success).toBe(true);
        });

        it('rejects empty content', () => {
            const result = warRoomMessageSchema.safeParse({ content: '' });
            expect(result.success).toBe(false);
        });

        it('rejects whitespace-only content', () => {
            const result = warRoomMessageSchema.safeParse({ content: '   ' });
            expect(result.success).toBe(false);
        });

        it('trims whitespace from content', () => {
            const result = warRoomMessageSchema.safeParse({ content: '  Message  ' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.content).toBe('Message');
            }
        });
    });
});

describe('recoveryPlanSchema', () => {
    const validPlan = {
        title: 'IT System Recovery Plan',
        type: 'IT System' as const,
        rto: '4h',
        rpo: '1h',
        ownerId: 'user-123'
    };

    describe('required fields', () => {
        it('accepts valid recovery plan data', () => {
            const result = recoveryPlanSchema.safeParse(validPlan);
            expect(result.success).toBe(true);
        });

        it('rejects missing title', () => {
            const { title: _title, ...data } = validPlan;
            const result = recoveryPlanSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty title', () => {
            const result = recoveryPlanSchema.safeParse({ ...validPlan, title: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing type', () => {
            const { type: _type, ...data } = validPlan;
            const result = recoveryPlanSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing rto', () => {
            const { rto: _rto, ...data } = validPlan;
            const result = recoveryPlanSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing rpo', () => {
            const { rpo: _rpo, ...data } = validPlan;
            const result = recoveryPlanSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing ownerId', () => {
            const { ownerId: _ownerId, ...data } = validPlan;
            const result = recoveryPlanSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty ownerId', () => {
            const result = recoveryPlanSchema.safeParse({ ...validPlan, ownerId: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('type validation', () => {
        it.each(['IT System', 'Business Process', 'Facility', 'Crisis Comm'] as const)(
            'accepts valid type: %s',
            (type) => {
                const result = recoveryPlanSchema.safeParse({ ...validPlan, type });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid type', () => {
            const result = recoveryPlanSchema.safeParse({ ...validPlan, type: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('status validation', () => {
        it.each(['Draft', 'Active', 'Archived', 'Testing'] as const)(
            'accepts valid status: %s',
            (status) => {
                const result = recoveryPlanSchema.safeParse({ ...validPlan, status });
                expect(result.success).toBe(true);
            }
        );

        it('defaults to Draft', () => {
            const result = recoveryPlanSchema.safeParse(validPlan);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('Draft');
            }
        });

        it('rejects invalid status', () => {
            const result = recoveryPlanSchema.safeParse({ ...validPlan, status: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects title longer than 150 characters', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                title: 'a'.repeat(151)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('steps validation', () => {
        it('accepts valid steps array', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: [
                    {
                        id: 'step-1',
                        title: 'Activate backup',
                        description: 'Enable backup systems',
                        assignedRole: 'IT Admin',
                        estimatedDuration: 30,
                        isCritical: true
                    },
                    {
                        id: 'step-2',
                        title: 'Verify integrity',
                        estimatedDuration: 15,
                        isCritical: false
                    }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty steps array', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: []
            });
            expect(result.success).toBe(true);
        });

        it('rejects step with missing id', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: [{ title: 'Step' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects step with missing title', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: [{ id: '1' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects step with empty title', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: [{ id: '1', title: '' }]
            });
            expect(result.success).toBe(false);
        });

        it('rejects negative estimated duration', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: [{ id: '1', title: 'Step', estimatedDuration: -1 }]
            });
            expect(result.success).toBe(false);
        });

        it('defaults step values', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                steps: [{ id: '1', title: 'Step' }]
            });
            expect(result.success).toBe(true);
            if (result.success && result.data.steps) {
                expect(result.data.steps[0].estimatedDuration).toBe(0);
                expect(result.data.steps[0].isCritical).toBe(false);
            }
        });
    });

    describe('optional fields', () => {
        it('accepts all optional fields', () => {
            const result = recoveryPlanSchema.safeParse({
                ...validPlan,
                description: 'Comprehensive recovery plan',
                strategyId: 'strategy-123',
                linkedAssetIds: ['asset-1', 'asset-2'],
                triggers: ['System failure', 'Natural disaster']
            });
            expect(result.success).toBe(true);
        });
    });
});
