/**
 * AuditLogService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    AuditLogService,
    AUDIT_ACTIONS,
    AUDITABLE_ENTITIES,
    AuditAction,
    AuditableEntity,
    CreateAuditLogInput
} from '../auditLogService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-log-id' })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn(() => Promise.resolve())
    }))
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('AuditLogService', () => {
    const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
    const mockOrgId = 'org-1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('log', () => {
        it('should create audit log entry', async () => {
            const { addDoc } = await import('firebase/firestore');

            const input: CreateAuditLogInput = {
                organizationId: mockOrgId,
                userId: mockUser.id,
                userName: mockUser.name,
                userEmail: mockUser.email,
                action: 'create',
                entityType: 'risk',
                entityId: 'risk-1'
            };

            const result = await AuditLogService.log(input);

            expect(result).toBe('new-log-id');
            expect(addDoc).toHaveBeenCalled();
        });

        it('should calculate changes from before/after', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.log({
                organizationId: mockOrgId,
                userId: mockUser.id,
                userName: mockUser.name,
                userEmail: mockUser.email,
                action: 'update',
                entityType: 'control',
                entityId: 'ctrl-1',
                before: { name: 'Old Name', status: 'active' },
                after: { name: 'New Name', status: 'active' }
            });

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    changes: ['name']
                })
            );
        });

        it('should throw on error', async () => {
            const { addDoc } = await import('firebase/firestore');
            vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(AuditLogService.log({
                organizationId: mockOrgId,
                userId: mockUser.id,
                userName: mockUser.name,
                userEmail: mockUser.email,
                action: 'create',
                entityType: 'asset',
                entityId: 'asset-1'
            })).rejects.toThrow();
        });
    });

    describe('logCreate', () => {
        it('should log entity creation', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logCreate(
                mockOrgId,
                mockUser,
                'document',
                'doc-1',
                { name: 'New Document', type: 'policy' }
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'create',
                    entityType: 'document',
                    entityId: 'doc-1'
                })
            );
        });
    });

    describe('logUpdate', () => {
        it('should log entity update with before/after states', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logUpdate(
                mockOrgId,
                mockUser,
                'incident',
                'inc-1',
                { status: 'open', severity: 'low' },
                { status: 'resolved', severity: 'low' },
                'Test Incident'
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'update',
                    entityType: 'incident',
                    before: expect.objectContaining({ status: 'open' }),
                    after: expect.objectContaining({ status: 'resolved' })
                })
            );
        });
    });

    describe('logDelete', () => {
        it('should log entity deletion with before state', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logDelete(
                mockOrgId,
                mockUser,
                'supplier',
                'supp-1',
                { name: 'Deleted Supplier', status: 'active' }
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'delete',
                    entityType: 'supplier',
                    before: expect.objectContaining({ name: 'Deleted Supplier' })
                })
            );
        });
    });

    describe('logStatusChange', () => {
        it('should log status change with old and new status', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logStatusChange(
                mockOrgId,
                mockUser,
                'audit',
                'audit-1',
                'Test Audit',
                'planned',
                'in_progress'
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'status_change',
                    before: { status: 'planned' },
                    after: { status: 'in_progress' },
                    details: expect.stringContaining('planned')
                })
            );
        });
    });

    describe('logExport', () => {
        it('should log data export for compliance', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logExport(
                mockOrgId,
                mockUser,
                'risk',
                'csv',
                50,
                { status: 'active' }
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'export',
                    entityId: 'bulk',
                    details: expect.stringContaining('50')
                })
            );
        });
    });

    describe('logImport', () => {
        it('should log data import', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logImport(
                mockOrgId,
                mockUser,
                'asset',
                100,
                'Excel file'
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'import',
                    entityId: 'bulk',
                    details: expect.stringContaining('100')
                })
            );
        });
    });

    describe('logLogin', () => {
        it('should log user login', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logLogin(mockOrgId, mockUser, {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/100',
                source: 'web'
            });

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'login',
                    entityType: 'user',
                    metadata: expect.objectContaining({ ipAddress: '192.168.1.1' })
                })
            );
        });
    });

    describe('logLogout', () => {
        it('should log user logout', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logLogout(mockOrgId, mockUser);

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'logout',
                    entityType: 'user'
                })
            );
        });
    });

    describe('logPermissionChange', () => {
        it('should log permission change', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logPermissionChange(
                mockOrgId,
                mockUser,
                'target-user-id',
                'Target User',
                'viewer',
                'editor'
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'permission_change',
                    before: { role: 'viewer' },
                    after: { role: 'editor' }
                })
            );
        });
    });

    describe('logShare', () => {
        it('should log entity sharing', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AuditLogService.logShare(
                mockOrgId,
                mockUser,
                'audit',
                'audit-1',
                'Test Audit',
                { type: 'portal', recipients: ['certifier@test.com'] }
            );

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: 'share',
                    details: expect.stringContaining('certifier@test.com')
                })
            );
        });
    });

    describe('logBatch', () => {
        it('should batch log multiple entries', async () => {
            const { writeBatch } = await import('firebase/firestore');
            const mockBatch = { set: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
            vi.mocked(writeBatch).mockReturnValue(mockBatch as unknown as any); // eslint-disable-line @typescript-eslint/no-explicit-any

            const entries: CreateAuditLogInput[] = [
                {
                    organizationId: mockOrgId,
                    userId: mockUser.id,
                    userName: mockUser.name,
                    userEmail: mockUser.email,
                    action: 'create',
                    entityType: 'risk',
                    entityId: 'risk-1'
                },
                {
                    organizationId: mockOrgId,
                    userId: mockUser.id,
                    userName: mockUser.name,
                    userEmail: mockUser.email,
                    action: 'create',
                    entityType: 'risk',
                    entityId: 'risk-2'
                }
            ];

            await AuditLogService.logBatch(entries);

            expect(mockBatch.set).toHaveBeenCalledTimes(2);
            expect(mockBatch.commit).toHaveBeenCalled();
        });

        it('should handle empty array', async () => {
            const { writeBatch } = await import('firebase/firestore');

            await AuditLogService.logBatch([]);

            expect(writeBatch).not.toHaveBeenCalled();
        });
    });

    describe('getActionLabel', () => {
        it('should return French labels for actions', () => {
            expect(AuditLogService.getActionLabel('create')).toBe('Creation');
            expect(AuditLogService.getActionLabel('update')).toBe('Modification');
            expect(AuditLogService.getActionLabel('delete')).toBe('Suppression');
            expect(AuditLogService.getActionLabel('login')).toBe('Connexion');
            expect(AuditLogService.getActionLabel('logout')).toBe('Deconnexion');
        });

        it('should return action name for unknown actions', () => {
            expect(AuditLogService.getActionLabel('unknown' as AuditAction)).toBe('unknown');
        });
    });

    describe('getEntityLabel', () => {
        it('should return French labels for entities', () => {
            expect(AuditLogService.getEntityLabel('risk')).toBe('Risque');
            expect(AuditLogService.getEntityLabel('control')).toBe('Controle');
            expect(AuditLogService.getEntityLabel('incident')).toBe('Incident');
            expect(AuditLogService.getEntityLabel('user')).toBe('Utilisateur');
        });

        it('should return entity name for unknown entities', () => {
            expect(AuditLogService.getEntityLabel('unknown' as AuditableEntity)).toBe('unknown');
        });
    });
});

describe('AUDIT_ACTIONS constant', () => {
    it('should contain all expected actions', () => {
        expect(AUDIT_ACTIONS).toContain('create');
        expect(AUDIT_ACTIONS).toContain('update');
        expect(AUDIT_ACTIONS).toContain('delete');
        expect(AUDIT_ACTIONS).toContain('view');
        expect(AUDIT_ACTIONS).toContain('export');
        expect(AUDIT_ACTIONS).toContain('import');
        expect(AUDIT_ACTIONS).toContain('login');
        expect(AUDIT_ACTIONS).toContain('logout');
    });
});

describe('AUDITABLE_ENTITIES constant', () => {
    it('should contain all expected entities', () => {
        expect(AUDITABLE_ENTITIES).toContain('risk');
        expect(AUDITABLE_ENTITIES).toContain('control');
        expect(AUDITABLE_ENTITIES).toContain('asset');
        expect(AUDITABLE_ENTITIES).toContain('document');
        expect(AUDITABLE_ENTITIES).toContain('audit');
        expect(AUDITABLE_ENTITIES).toContain('incident');
        expect(AUDITABLE_ENTITIES).toContain('supplier');
        expect(AUDITABLE_ENTITIES).toContain('user');
    });
});
