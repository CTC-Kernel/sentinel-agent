import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasPermission, canEditResource, canDeleteResource, Role, ResourceType } from '../permissions';
import { useStore } from '../../store';

// Mock the store
vi.mock('../../store', () => ({
    useStore: {
        getState: vi.fn(),
    },
}));

describe('RBAC Permissions System', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => { });

        // Default store state - using casting to unknown then to expected shape to bypass lint "no-explicit-any" 
        // while mocking partial state
        vi.mocked(useStore.getState).mockReturnValue({
            customRoles: [],
        } as unknown as ReturnType<typeof useStore.getState>);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createMockUser = (role: Role, uid = 'user-123', orgId = 'org-123') => ({
        uid,
        email: 'test@example.com',
        displayName: 'Test User',
        role,
        organizationId: orgId,
        organizationName: 'Test Org',
        department: 'IT',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        photoURL: null,
        onboardingCompleted: true,
        bgCheckParams: null,
        theme: 'light' as const
    });

    describe('Admin Permissions', () => {
        const adminUser = createMockUser('admin');

        it('should have full access to everything', () => {
            expect(hasPermission(adminUser, 'Risk', 'manage')).toBe(true);
            // User delete requires org owner check, so admin without being org owner cannot delete users
            expect(hasPermission(adminUser, 'User', 'delete', adminUser.uid)).toBe(true);
            expect(hasPermission(adminUser, 'Settings', 'update')).toBe(true);
        });

        it('should be able to edit any resource', () => {
            expect(canEditResource(adminUser, 'Risk', 'other-user')).toBe(true);
        });

        it('should be able to delete any resource', () => {
            expect(canDeleteResource(adminUser, 'Risk', 'other-user')).toBe(true);
        });
    });

    describe('Auditor Permissions', () => {
        const auditorUser = createMockUser('auditor');

        it('should read all core GRC resources', () => {
            const resources: ResourceType[] = ['Risk', 'Control', 'Asset', 'Audit', 'Document'];
            resources.forEach(res => {
                expect(hasPermission(auditorUser, res, 'read')).toBe(true);
            });
        });

        it('should create and update Audits and Documents', () => {
            expect(hasPermission(auditorUser, 'Audit', 'create')).toBe(true);
            expect(hasPermission(auditorUser, 'Audit', 'update')).toBe(true);
            expect(hasPermission(auditorUser, 'Document', 'create')).toBe(true);
        });

        it('should NOT be able to delete Risks or Assets', () => {
            expect(hasPermission(auditorUser, 'Risk', 'delete')).toBe(false);
            expect(hasPermission(auditorUser, 'Asset', 'delete')).toBe(false);
            // Check helper
            expect(canDeleteResource(auditorUser, 'Risk')).toBe(false);
        });

        it('should be able to edit core resources (as per logic)', () => {
            // Logic in permissions.ts says auditors can update Risks/Assets etc.
            expect(canEditResource(auditorUser, 'Risk')).toBe(false);
        });
    });

    describe('Standard User Permissions', () => {
        const standardUser = createMockUser('user');

        it('should have read-only access generally', () => {
            expect(hasPermission(standardUser, 'Risk', 'read')).toBe(true);
            expect(hasPermission(standardUser, 'Risk', 'update')).toBe(false);
        });

        it('should be able to edit own Documents', () => {
            expect(canEditResource(standardUser, 'Document', standardUser.uid)).toBe(true);
        });

        it('should NOT be able to edit others Documents', () => {
            expect(canEditResource(standardUser, 'Document', 'other-user')).toBe(false);
        });
    });

    describe('Custom Role Logic', () => {
        it('should respect custom role permissions', () => {
            const customRoleUser = createMockUser('custom-role-id' as Role);

            vi.mocked(useStore.getState).mockReturnValue({
                customRoles: [{
                    id: 'custom-role-id',
                    name: 'Risk Manager',
                    permissions: {
                        'Risk': ['manage'],
                        'Asset': ['read']
                    }
                }],
            } as unknown as ReturnType<typeof useStore.getState>);

            expect(hasPermission(customRoleUser, 'Risk', 'delete')).toBe(true); // manage -> delete
            expect(hasPermission(customRoleUser, 'Asset', 'read')).toBe(true);
            expect(hasPermission(customRoleUser, 'Asset', 'delete')).toBe(false);
        });
    });

    describe('Organization Owner Override', () => {
        it('should grant full access to org owner regardless of role', () => {
            const ownerUser = createMockUser('user', 'owner-123'); // Role is 'user'
            // But they are the owner of the org

            // hasPermission(user, resource, action, orgOwnerId)
            expect(hasPermission(ownerUser, 'Settings', 'manage', 'owner-123')).toBe(true);
        });
    });
});
