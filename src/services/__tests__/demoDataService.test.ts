/**
 * DemoDataService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoDataService } from '../demoDataService';

// Mock Firebase

const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();

vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: mockBatchSet,
        commit: mockBatchCommit,
    })),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

describe('DemoDataService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBatchCommit.mockResolvedValue(undefined);

        // Reset import.meta.env.DEV
        vi.stubGlobal('import', {
            meta: {
                env: {
                    DEV: true,
                },
            },
        });
    });

    describe('generateDemoData', () => {
        it('should generate demo data for demo user', async () => {
            const mockUser = {
                uid: 'demo-user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            const result = await DemoDataService.generateDemoData('org-123', mockUser as never);

            expect(result.success).toBe(true);
            expect(result.count).toBeGreaterThan(0);
            expect(mockBatchSet).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('should generate demo data in development mode', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'developer@example.com',
                organizationId: 'org-123',
            };

            const result = await DemoDataService.generateDemoData('org-123', mockUser as never);

            expect(result.success).toBe(true);
        });

        it('should create assets with correct structure', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            // Check that batch.set was called multiple times for assets
            expect(mockBatchSet).toHaveBeenCalled();

            // Verify some assets were created (at least 4 based on code)
            const setCalls = mockBatchSet.mock.calls;
            expect(setCalls.length).toBeGreaterThanOrEqual(4);
        });

        it('should create suppliers and link to assets', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            // Verify suppliers were created
            const setCalls = mockBatchSet.mock.calls;
            const supplierCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.category === 'SaaS' || data.category === 'Hébergement';
            });
            expect(supplierCalls.length).toBeGreaterThanOrEqual(2);
        });

        it('should create risks linked to assets', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const riskCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.threat !== undefined && data.vulnerability !== undefined;
            });
            expect(riskCalls.length).toBeGreaterThanOrEqual(2);
        });

        it('should create projects with tasks', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const projectCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.manager !== undefined && data.progress !== undefined;
            });
            expect(projectCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should create audits with findings', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const auditCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.auditor !== undefined && data.type !== undefined;
            });
            expect(auditCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should create documents', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const docCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.title !== undefined && data.version !== undefined;
            });
            expect(docCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should create incidents', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const incidentCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.severity !== undefined && data.reporter !== undefined;
            });
            expect(incidentCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should create business processes for BCP', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const bcpCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.rto !== undefined && data.rpo !== undefined;
            });
            expect(bcpCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should create system log entry', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await DemoDataService.generateDemoData('org-123', mockUser as never);

            const setCalls = mockBatchSet.mock.calls;
            const logCalls = setCalls.filter((call: unknown[]) => {
                const data = call[1] as Record<string, unknown>;
                return data.action === 'Generate Demo Data';
            });
            expect(logCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle batch commit error', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockBatchCommit.mockRejectedValue(new Error('Batch commit failed'));

            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            await expect(
                DemoDataService.generateDemoData('org-123', mockUser as never)
            ).rejects.toThrow('Batch commit failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should return count of generated items', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'demo@sentinel-grc.com',
                organizationId: 'org-123',
            };

            const result = await DemoDataService.generateDemoData('org-123', mockUser as never);

            // Count should be sum of assets + risks + projects
            expect(result.count).toBeGreaterThan(5);
        });
    });
});
