/**
 * ACL Service Tests
 * Comprehensive tests for Access Control List management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    permissionIncludes,
    createDefaultACL,
    createPermission,
    checkAccess,
    canViewDocument,
    getUserPermissions,
    explainPermissions,
    PERMISSION_LEVELS,
    PERMISSION_HIERARCHY,
    PermissionLevel,
} from '../aclService';
import type { Document } from '../../types/documents';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    Timestamp: {
        now: vi.fn(() => ({ toMillis: () => Date.now() })),
        fromDate: vi.fn((date: Date) => ({ toMillis: () => date.getTime() })),
    },
    doc: vi.fn(),
    updateDoc: vi.fn(),
    getDoc: vi.fn(),
}));

vi.mock('../vaultConfig', () => ({
    canAccessClassification: vi.fn((classification: string, role: string) => {
        // Simplified classification access logic for testing
        const accessMap: Record<string, string[]> = {
            public: ['user', 'analyst', 'rssi', 'admin', 'super_admin'],
            internal: ['user', 'analyst', 'rssi', 'admin', 'super_admin'],
            confidential: ['analyst', 'rssi', 'admin', 'super_admin'],
            secret: ['rssi', 'admin', 'super_admin'],
            top_secret: ['super_admin'],
        };
        return accessMap[classification]?.includes(role) ?? false;
    }),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

describe('ACL Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('permissionIncludes', () => {
        it('should return true when permission includes itself', () => {
            PERMISSION_LEVELS.forEach((level) => {
                expect(permissionIncludes(level, level)).toBe(true);
            });
        });

        it('should return true when admin permission includes all others', () => {
            PERMISSION_LEVELS.forEach((level) => {
                expect(permissionIncludes('admin', level)).toBe(true);
            });
        });

        it('should return false when read permission is checked for edit', () => {
            expect(permissionIncludes('read', 'edit')).toBe(false);
        });

        it('should return true when edit permission includes read', () => {
            expect(permissionIncludes('edit', 'read')).toBe(true);
        });

        it('should follow permission hierarchy correctly', () => {
            expect(permissionIncludes('download', 'read')).toBe(true);
            expect(permissionIncludes('download', 'edit')).toBe(false);
            expect(permissionIncludes('edit', 'download')).toBe(true);
            expect(permissionIncludes('delete', 'share')).toBe(false);
            expect(permissionIncludes('share', 'delete')).toBe(false);
        });
    });

    describe('createDefaultACL', () => {
        it('should create ACL with classification-based access', () => {
            const acl = createDefaultACL();
            expect(acl.defaultAccess).toBe('classification');
            expect(acl.permissions).toEqual([]);
        });
    });

    describe('createPermission', () => {
        it('should create user permission correctly', () => {
            const permission = createPermission('user', 'user-123', 'edit', 'admin-1');

            expect(permission.principalType).toBe('user');
            expect(permission.principalId).toBe('user-123');
            expect(permission.access).toBe('edit');
            expect(permission.grantedBy).toBe('admin-1');
            expect(permission.grantedAt).toBeDefined();
            expect(permission.expiresAt).toBeUndefined();
        });

        it('should create permission with expiration date', () => {
            const expiryDate = new Date('2025-12-31');
            const permission = createPermission('role', 'analyst', 'read', 'admin-1', expiryDate);

            expect(permission.expiresAt).toBeDefined();
        });

        it('should create group permission correctly', () => {
            const permission = createPermission('group', 'security-team', 'admin', 'admin-1');

            expect(permission.principalType).toBe('group');
            expect(permission.principalId).toBe('security-team');
        });
    });

    describe('checkAccess', () => {
        const baseDocument: Document = {
            id: 'doc-1',
            organizationId: 'org-1',
            title: 'Test Document',
            ownerId: 'owner-123',
            classification: { level: 'internal' },
            acl: {
                defaultAccess: 'classification',
                permissions: [],
            },
        } as Document;

        it('should grant access to admin users', () => {
            expect(checkAccess(baseDocument, 'any-user', 'admin', 'delete')).toBe(true);
        });

        it('should grant access to super_admin users', () => {
            expect(checkAccess(baseDocument, 'any-user', 'super_admin', 'admin')).toBe(true);
        });

        it('should grant access to rssi users', () => {
            expect(checkAccess(baseDocument, 'any-user', 'rssi', 'share')).toBe(true);
        });

        it('should grant full access to document owner', () => {
            expect(checkAccess(baseDocument, 'owner-123', 'user', 'admin')).toBe(true);
        });

        it('should grant read access based on classification', () => {
            expect(checkAccess(baseDocument, 'user-1', 'user', 'read')).toBe(true);
        });

        it('should deny edit access when only classification-based read is available', () => {
            expect(checkAccess(baseDocument, 'user-1', 'user', 'edit')).toBe(false);
        });

        it('should check explicit user permissions', () => {
            const docWithPermissions: Document = {
                ...baseDocument,
                acl: {
                    defaultAccess: 'explicit',
                    permissions: [{
                        principalType: 'user',
                        principalId: 'user-456',
                        access: 'edit' as PermissionLevel,
                        grantedBy: 'admin-1',
                        grantedAt: Timestamp.now(),
                    }],
                },
            };

            expect(checkAccess(docWithPermissions, 'user-456', 'user', 'edit')).toBe(true);
            expect(checkAccess(docWithPermissions, 'user-456', 'user', 'read')).toBe(true);
            expect(checkAccess(docWithPermissions, 'user-456', 'user', 'delete')).toBe(false);
        });

        it('should check role-based permissions', () => {
            const docWithRolePermissions: Document = {
                ...baseDocument,
                acl: {
                    defaultAccess: 'explicit',
                    permissions: [{
                        principalType: 'role',
                        principalId: 'analyst',
                        access: 'download' as PermissionLevel,
                        grantedBy: 'admin-1',
                        grantedAt: Timestamp.now(),
                    }],
                },
            };

            expect(checkAccess(docWithRolePermissions, 'any-user', 'analyst', 'download')).toBe(true);
            expect(checkAccess(docWithRolePermissions, 'any-user', 'user', 'download')).toBe(false);
        });

        it('should check group-based permissions', () => {
            const docWithGroupPermissions: Document = {
                ...baseDocument,
                acl: {
                    defaultAccess: 'explicit',
                    permissions: [{
                        principalType: 'group',
                        principalId: 'security-team',
                        access: 'share' as PermissionLevel,
                        grantedBy: 'admin-1',
                        grantedAt: Timestamp.now(),
                    }],
                },
            };

            expect(checkAccess(docWithGroupPermissions, 'user-1', 'user', 'share', ['security-team'])).toBe(true);
            expect(checkAccess(docWithGroupPermissions, 'user-1', 'user', 'share', ['other-team'])).toBe(false);
        });

        it('should skip expired permissions', () => {
            const pastDate = new Date(Date.now() - 86400000); // Yesterday
            const docWithExpiredPermission: Document = {
                ...baseDocument,
                acl: {
                    defaultAccess: 'explicit',
                    permissions: [{
                        principalType: 'user',
                        principalId: 'user-789',
                        access: 'admin' as PermissionLevel,
                        grantedBy: 'admin-1',
                        grantedAt: Timestamp.now(),
                        expiresAt: Timestamp.fromDate(pastDate),
                    }],
                },
            };

            expect(checkAccess(docWithExpiredPermission, 'user-789', 'user', 'admin')).toBe(false);
        });
    });

    describe('canViewDocument', () => {
        it('should return true when user has classification access', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'owner-1',
                classification: { level: 'internal' },
            } as Document;

            expect(canViewDocument(doc, 'user-1', 'user')).toBe(true);
        });

        it('should return false when user lacks classification access', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Secret Doc',
                ownerId: 'owner-1',
                classification: { level: 'secret' },
            } as Document;

            expect(canViewDocument(doc, 'user-1', 'user')).toBe(false);
        });
    });

    describe('getUserPermissions', () => {
        it('should return all permissions for admin', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'other-user',
            } as Document;

            const permissions = getUserPermissions(doc, 'admin-user', 'admin');
            expect(permissions).toEqual([...PERMISSION_LEVELS]);
        });

        it('should return all permissions for document owner', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'owner-123',
            } as Document;

            const permissions = getUserPermissions(doc, 'owner-123', 'user');
            expect(permissions).toEqual([...PERMISSION_LEVELS]);
        });

        it('should return only read for classification-based access', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'other-user',
                classification: { level: 'internal' },
            } as Document;

            const permissions = getUserPermissions(doc, 'user-1', 'user');
            expect(permissions).toContain('read');
            expect(permissions).not.toContain('edit');
        });

        it('should combine classification and explicit permissions', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'other-user',
                classification: { level: 'internal' },
                acl: {
                    defaultAccess: 'classification',
                    permissions: [{
                        principalType: 'user',
                        principalId: 'user-1',
                        access: 'edit' as PermissionLevel,
                        grantedBy: 'admin-1',
                        grantedAt: Timestamp.now(),
                    }],
                },
            } as Document;

            const permissions = getUserPermissions(doc, 'user-1', 'user');
            expect(permissions).toContain('read');
            expect(permissions).toContain('edit');
            expect(permissions).toContain('download');
        });
    });

    describe('explainPermissions', () => {
        it('should explain admin role access', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'other-user',
            } as Document;

            const explanation = explainPermissions(doc, 'admin-user', 'admin');

            expect(explanation.isAdmin).toBe(true);
            expect(explanation.permissions).toEqual([...PERMISSION_LEVELS]);
            expect(explanation.reasons.some(r => r.includes('admin'))).toBe(true);
        });

        it('should explain owner access', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'owner-123',
            } as Document;

            const explanation = explainPermissions(doc, 'owner-123', 'user');

            expect(explanation.isOwner).toBe(true);
            expect(explanation.reasons.some(r => r.includes('Propriétaire'))).toBe(true);
        });

        it('should explain classification-based access', () => {
            const doc: Document = {
                id: 'doc-1',
                organizationId: 'org-1',
                title: 'Test',
                ownerId: 'other-user',
                classification: { level: 'internal' },
            } as Document;

            const explanation = explainPermissions(doc, 'user-1', 'user');

            expect(explanation.hasClassificationAccess).toBe(true);
            expect(explanation.reasons.some(r => r.includes('Classification'))).toBe(true);
        });
    });

    describe('Permission Hierarchy', () => {
        it('should have correct hierarchy for all permission levels', () => {
            // Read includes only read
            expect(PERMISSION_HIERARCHY.read).toEqual(['read']);

            // Download includes read and download
            expect(PERMISSION_HIERARCHY.download).toContain('read');
            expect(PERMISSION_HIERARCHY.download).toContain('download');

            // Edit includes read, download, and edit
            expect(PERMISSION_HIERARCHY.edit).toContain('read');
            expect(PERMISSION_HIERARCHY.edit).toContain('download');
            expect(PERMISSION_HIERARCHY.edit).toContain('edit');

            // Admin includes everything
            expect(PERMISSION_HIERARCHY.admin.length).toBe(PERMISSION_LEVELS.length);
        });
    });
});
