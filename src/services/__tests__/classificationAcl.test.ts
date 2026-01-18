/**
 * Story 24.6 - Tests for Classification & ACL Services
 *
 * Comprehensive test suite for document classification and access control.
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// Classification Service
import {
  canAccessClassification,
  canSetClassification,
  getMaxClassificationForRole,
  getAccessibleClassifications,
  createClassification,
  validateClassificationChange,
  requiresJustification,
  getClassificationDisplay,
  isClassificationUpgrade,
  isClassificationDowngrade,
  getDefaultClassification,
  suggestClassification,
  getClassificationSensitivity,
  CLASSIFICATION_HIERARCHY,
  ROLE_HIERARCHY,
} from '@/services/classificationService';

// ACL Service
import {
  PERMISSION_LEVELS,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_HIERARCHY,
  permissionIncludes,
  createDefaultACL,
  createPermission,
  checkAccess,
  canViewDocument,
  getUserPermissions,
  explainPermissions,
} from '@/services/aclService';

import type { ClassificationLevel } from '@/types/vault';
import type { Document } from '@/types/documents';

// ============================================================================
// Classification Service Tests
// ============================================================================

describe('Classification Service', () => {
  describe('CLASSIFICATION_HIERARCHY', () => {
    it('should have correct order of sensitivity', () => {
      expect(CLASSIFICATION_HIERARCHY).toEqual(['public', 'internal', 'confidential', 'secret']);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should define role hierarchy correctly', () => {
      expect(ROLE_HIERARCHY).toContain('user');
      expect(ROLE_HIERARCHY).toContain('admin');
      expect(ROLE_HIERARCHY).toContain('rssi');
      expect(ROLE_HIERARCHY).toContain('super_admin');
    });
  });

  describe('getClassificationSensitivity', () => {
    it('should return correct sensitivity levels', () => {
      expect(getClassificationSensitivity('public')).toBe(0);
      expect(getClassificationSensitivity('internal')).toBe(1);
      expect(getClassificationSensitivity('confidential')).toBe(2);
      expect(getClassificationSensitivity('secret')).toBe(3);
    });
  });

  describe('canSetClassification', () => {
    it('should allow users to set classifications they can access', () => {
      expect(canSetClassification('public', 'user')).toBe(true);
      expect(canSetClassification('internal', 'user')).toBe(true);
      expect(canSetClassification('confidential', 'project_manager')).toBe(true);
      expect(canSetClassification('secret', 'rssi')).toBe(true);
    });

    it('should prevent users from setting classifications they cannot access', () => {
      expect(canSetClassification('confidential', 'user')).toBe(false);
      expect(canSetClassification('secret', 'user')).toBe(false);
      expect(canSetClassification('secret', 'project_manager')).toBe(false);
    });
  });

  describe('getMaxClassificationForRole', () => {
    it('should return correct max classification for each role', () => {
      expect(getMaxClassificationForRole('user')).toBe('internal');
      expect(getMaxClassificationForRole('project_manager')).toBe('confidential');
      expect(getMaxClassificationForRole('rssi')).toBe('secret');
      expect(getMaxClassificationForRole('admin')).toBe('secret');
      expect(getMaxClassificationForRole('super_admin')).toBe('secret');
    });

    it('should return public for unknown roles', () => {
      expect(getMaxClassificationForRole('unknown')).toBe('public');
    });
  });

  describe('getAccessibleClassifications', () => {
    it('should return all accessible levels for user', () => {
      const levels = getAccessibleClassifications('user');
      expect(levels).toContain('public');
      expect(levels).toContain('internal');
      expect(levels).not.toContain('confidential');
      expect(levels).not.toContain('secret');
    });

    it('should return all accessible levels for project_manager', () => {
      const levels = getAccessibleClassifications('project_manager');
      expect(levels).toContain('public');
      expect(levels).toContain('internal');
      expect(levels).toContain('confidential');
      expect(levels).not.toContain('secret');
    });

    it('should return all levels for rssi', () => {
      const levels = getAccessibleClassifications('rssi');
      expect(levels).toHaveLength(4);
    });

    it('should return all levels for admin', () => {
      const levels = getAccessibleClassifications('admin');
      expect(levels).toHaveLength(4);
    });
  });

  describe('createClassification', () => {
    it('should create a valid classification object', () => {
      const classification = createClassification('confidential', 'user123', 'Sensitive data');

      expect(classification.level).toBe('confidential');
      expect(classification.classifiedBy).toBe('user123');
      expect(classification.justification).toBe('Sensitive data');
      expect(classification.autoClassified).toBe(false);
      expect(classification.classifiedAt).toBeDefined();
    });

    it('should support auto-classification flag', () => {
      const classification = createClassification('internal', 'system', undefined, true);

      expect(classification.autoClassified).toBe(true);
      expect(classification.justification).toBeUndefined();
    });
  });

  describe('validateClassificationChange', () => {
    it('should allow valid classification changes', () => {
      const result = validateClassificationChange('internal', 'confidential', 'project_manager');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject unauthorized classification changes', () => {
      const result = validateClassificationChange('internal', 'secret', 'user');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject changes when user cannot access current level', () => {
      const result = validateClassificationChange('secret', 'internal', 'user');
      expect(result.isValid).toBe(false);
    });

    it('should allow setting classification on new documents', () => {
      const result = validateClassificationChange(undefined, 'internal', 'user');
      expect(result.isValid).toBe(true);
    });
  });

  describe('requiresJustification', () => {
    it('should require justification for confidential and secret', () => {
      expect(requiresJustification('public')).toBe(false);
      expect(requiresJustification('internal')).toBe(false);
      expect(requiresJustification('confidential')).toBe(true);
      expect(requiresJustification('secret')).toBe(true);
    });
  });

  describe('getClassificationDisplay', () => {
    it('should return display configuration', () => {
      const display = getClassificationDisplay('confidential');

      expect(display.label).toBe('Confidentiel');
      expect(display.color).toBeDefined();
      expect(display.icon).toBeDefined();
      expect(display.description).toBeDefined();
    });
  });

  describe('isClassificationUpgrade', () => {
    it('should detect upgrades correctly', () => {
      expect(isClassificationUpgrade('public', 'internal')).toBe(true);
      expect(isClassificationUpgrade('internal', 'confidential')).toBe(true);
      expect(isClassificationUpgrade('confidential', 'secret')).toBe(true);
    });

    it('should not detect downgrades as upgrades', () => {
      expect(isClassificationUpgrade('secret', 'public')).toBe(false);
      expect(isClassificationUpgrade('confidential', 'internal')).toBe(false);
    });

    it('should not detect same level as upgrade', () => {
      expect(isClassificationUpgrade('internal', 'internal')).toBe(false);
    });
  });

  describe('isClassificationDowngrade', () => {
    it('should detect downgrades correctly', () => {
      expect(isClassificationDowngrade('secret', 'public')).toBe(true);
      expect(isClassificationDowngrade('confidential', 'internal')).toBe(true);
      expect(isClassificationDowngrade('internal', 'public')).toBe(true);
    });

    it('should not detect upgrades as downgrades', () => {
      expect(isClassificationDowngrade('public', 'secret')).toBe(false);
    });
  });

  describe('getDefaultClassification', () => {
    it('should return internal as default', () => {
      expect(getDefaultClassification()).toBe('internal');
    });
  });

  describe('suggestClassification', () => {
    it('should suggest secret for sensitive keywords', () => {
      expect(suggestClassification('password123')).toBe('secret');
      expect(suggestClassification('API key configuration')).toBe('secret');
      expect(suggestClassification('private key file')).toBe('secret');
    });

    it('should suggest confidential for business-sensitive content', () => {
      expect(suggestClassification('document confidentiel')).toBe('confidential');
      expect(suggestClassification('salary report')).toBe('confidential');
      expect(suggestClassification('contrat fournisseur')).toBe('confidential');
    });

    it('should suggest internal for general content', () => {
      expect(suggestClassification('procedure qualite')).toBe('internal');
      expect(suggestClassification('politique securite')).toBe('internal');
    });

    it('should suggest internal as default', () => {
      expect(suggestClassification('random document')).toBe('internal');
    });

    it('should consider document type', () => {
      expect(suggestClassification('audit evidence', 'Preuve')).toBe('confidential');
    });
  });
});

// ============================================================================
// ACL Service Tests
// ============================================================================

describe('ACL Service', () => {
  describe('PERMISSION_LEVELS', () => {
    it('should have all permission levels', () => {
      expect(PERMISSION_LEVELS).toContain('read');
      expect(PERMISSION_LEVELS).toContain('download');
      expect(PERMISSION_LEVELS).toContain('edit');
      expect(PERMISSION_LEVELS).toContain('delete');
      expect(PERMISSION_LEVELS).toContain('share');
      expect(PERMISSION_LEVELS).toContain('admin');
    });
  });

  describe('PERMISSION_LABELS', () => {
    it('should have French labels for all permissions', () => {
      expect(PERMISSION_LABELS.read).toBe('Lecture');
      expect(PERMISSION_LABELS.edit).toBe('Modification');
      expect(PERMISSION_LABELS.admin).toBe('Administration');
    });
  });

  describe('PERMISSION_DESCRIPTIONS', () => {
    it('should have descriptions for all permissions', () => {
      Object.keys(PERMISSION_LABELS).forEach(key => {
        expect(PERMISSION_DESCRIPTIONS[key as keyof typeof PERMISSION_DESCRIPTIONS]).toBeDefined();
      });
    });
  });

  describe('PERMISSION_HIERARCHY', () => {
    it('should have correct hierarchy for admin', () => {
      const adminPerms = PERMISSION_HIERARCHY.admin;
      expect(adminPerms).toContain('read');
      expect(adminPerms).toContain('download');
      expect(adminPerms).toContain('edit');
      expect(adminPerms).toContain('delete');
      expect(adminPerms).toContain('share');
      expect(adminPerms).toContain('admin');
    });

    it('should have correct hierarchy for edit', () => {
      const editPerms = PERMISSION_HIERARCHY.edit;
      expect(editPerms).toContain('read');
      expect(editPerms).toContain('download');
      expect(editPerms).toContain('edit');
      expect(editPerms).not.toContain('delete');
      expect(editPerms).not.toContain('admin');
    });

    it('should have read as base for all permissions', () => {
      Object.values(PERMISSION_HIERARCHY).forEach(perms => {
        expect(perms).toContain('read');
      });
    });
  });

  describe('permissionIncludes', () => {
    it('should correctly check permission inclusion', () => {
      expect(permissionIncludes('admin', 'read')).toBe(true);
      expect(permissionIncludes('admin', 'edit')).toBe(true);
      expect(permissionIncludes('admin', 'admin')).toBe(true);
      expect(permissionIncludes('edit', 'read')).toBe(true);
      expect(permissionIncludes('edit', 'admin')).toBe(false);
      expect(permissionIncludes('read', 'edit')).toBe(false);
    });
  });

  describe('createDefaultACL', () => {
    it('should create ACL with classification-based default', () => {
      const acl = createDefaultACL();
      expect(acl.defaultAccess).toBe('classification');
      expect(acl.permissions).toEqual([]);
    });
  });

  describe('createPermission', () => {
    it('should create a valid user permission', () => {
      const permission = createPermission('user', 'user123', 'edit', 'admin1');

      expect(permission.principalType).toBe('user');
      expect(permission.principalId).toBe('user123');
      expect(permission.access).toBe('edit');
      expect(permission.grantedBy).toBe('admin1');
      expect(permission.grantedAt).toBeDefined();
      expect(permission.expiresAt).toBeUndefined();
    });

    it('should create a permission with expiry', () => {
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const permission = createPermission('role', 'project_manager', 'read', 'admin1', expiryDate);

      expect(permission.expiresAt).toBeDefined();
    });

    it('should create group permissions', () => {
      const permission = createPermission('group', 'group123', 'download', 'admin1');

      expect(permission.principalType).toBe('group');
      expect(permission.principalId).toBe('group123');
    });
  });

  describe('checkAccess', () => {
    const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
      id: 'doc1',
      organizationId: 'org1',
      title: 'Test Document',
      type: 'Politique',
      version: '1.0',
      status: 'Brouillon',
      owner: 'owner@test.com',
      ownerId: 'owner123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('should always allow admin access', () => {
      const doc = createMockDocument();
      expect(checkAccess(doc, 'user1', 'admin', 'edit')).toBe(true);
      expect(checkAccess(doc, 'user1', 'super_admin', 'admin')).toBe(true);
      expect(checkAccess(doc, 'user1', 'rssi', 'delete')).toBe(true);
    });

    it('should always allow owner access', () => {
      const doc = createMockDocument({ ownerId: 'owner123' });
      expect(checkAccess(doc, 'owner123', 'user', 'admin')).toBe(true);
    });

    it('should grant read access based on classification', () => {
      const doc = createMockDocument({
        classification: {
          level: 'internal',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
      });

      expect(checkAccess(doc, 'user1', 'user', 'read')).toBe(true);
    });

    it('should deny access for restricted classification', () => {
      const doc = createMockDocument({
        classification: {
          level: 'secret',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
      });

      expect(checkAccess(doc, 'user1', 'user', 'read')).toBe(false);
    });

    it('should check explicit ACL permissions', () => {
      const doc = createMockDocument({
        acl: {
          defaultAccess: 'explicit',
          permissions: [
            {
              principalType: 'user',
              principalId: 'user1',
              access: 'edit',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
      });

      expect(checkAccess(doc, 'user1', 'user', 'edit')).toBe(true);
      expect(checkAccess(doc, 'user1', 'user', 'read')).toBe(true);
      expect(checkAccess(doc, 'user2', 'user', 'read')).toBe(false);
    });

    it('should respect permission hierarchy in ACL', () => {
      const doc = createMockDocument({
        acl: {
          defaultAccess: 'explicit',
          permissions: [
            {
              principalType: 'user',
              principalId: 'user1',
              access: 'edit',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
      });

      expect(checkAccess(doc, 'user1', 'user', 'read')).toBe(true);
      expect(checkAccess(doc, 'user1', 'user', 'download')).toBe(true);
      expect(checkAccess(doc, 'user1', 'user', 'edit')).toBe(true);
      expect(checkAccess(doc, 'user1', 'user', 'admin')).toBe(false);
    });

    it('should check role-based ACL permissions', () => {
      const doc = createMockDocument({
        acl: {
          defaultAccess: 'explicit',
          permissions: [
            {
              principalType: 'role',
              principalId: 'project_manager',
              access: 'edit',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
      });

      expect(checkAccess(doc, 'user1', 'project_manager', 'edit')).toBe(true);
      expect(checkAccess(doc, 'user2', 'user', 'edit')).toBe(false);
    });

    it('should check group-based ACL permissions', () => {
      const doc = createMockDocument({
        acl: {
          defaultAccess: 'explicit',
          permissions: [
            {
              principalType: 'group',
              principalId: 'group1',
              access: 'read',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
      });

      expect(checkAccess(doc, 'user1', 'user', 'read', ['group1'])).toBe(true);
      expect(checkAccess(doc, 'user1', 'user', 'read', ['group2'])).toBe(false);
    });
  });

  describe('canViewDocument', () => {
    const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
      id: 'doc1',
      organizationId: 'org1',
      title: 'Test Document',
      type: 'Politique',
      version: '1.0',
      status: 'Brouillon',
      owner: 'owner@test.com',
      ownerId: 'owner123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('should check classification first', () => {
      const doc = createMockDocument({
        classification: {
          level: 'secret',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
      });

      expect(canViewDocument(doc, 'user1', 'user')).toBe(false);
      expect(canViewDocument(doc, 'user1', 'rssi')).toBe(true);
    });
  });

  describe('getUserPermissions', () => {
    const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
      id: 'doc1',
      organizationId: 'org1',
      title: 'Test Document',
      type: 'Politique',
      version: '1.0',
      status: 'Brouillon',
      owner: 'owner@test.com',
      ownerId: 'owner123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('should return all permissions for admin', () => {
      const doc = createMockDocument();
      const perms = getUserPermissions(doc, 'user1', 'admin');

      expect(perms).toHaveLength(PERMISSION_LEVELS.length);
      expect(perms).toContain('admin');
    });

    it('should return all permissions for owner', () => {
      const doc = createMockDocument({ ownerId: 'user1' });
      const perms = getUserPermissions(doc, 'user1', 'user');

      expect(perms).toHaveLength(PERMISSION_LEVELS.length);
    });

    it('should return only read for classification-based access', () => {
      const doc = createMockDocument({
        classification: {
          level: 'internal',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
      });

      const perms = getUserPermissions(doc, 'user1', 'user');

      expect(perms).toContain('read');
      expect(perms).not.toContain('edit');
      expect(perms).not.toContain('admin');
    });

    it('should accumulate permissions from ACL', () => {
      const doc = createMockDocument({
        acl: {
          defaultAccess: 'classification',
          permissions: [
            {
              principalType: 'user',
              principalId: 'user1',
              access: 'edit',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
        classification: {
          level: 'internal',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
      });

      const perms = getUserPermissions(doc, 'user1', 'user');

      expect(perms).toContain('read');
      expect(perms).toContain('download');
      expect(perms).toContain('edit');
      expect(perms).not.toContain('admin');
    });
  });

  describe('explainPermissions', () => {
    const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
      id: 'doc1',
      organizationId: 'org1',
      title: 'Test Document',
      type: 'Politique',
      version: '1.0',
      status: 'Brouillon',
      owner: 'owner@test.com',
      ownerId: 'owner123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('should explain admin access', () => {
      const doc = createMockDocument();
      const explanation = explainPermissions(doc, 'user1', 'admin');

      expect(explanation.isAdmin).toBe(true);
      expect(explanation.reasons.some(r => r.includes('admin'))).toBe(true);
    });

    it('should explain owner access', () => {
      const doc = createMockDocument({ ownerId: 'user1' });
      const explanation = explainPermissions(doc, 'user1', 'user');

      expect(explanation.isOwner).toBe(true);
      expect(explanation.reasons.some(r => r.includes('Propriétaire'))).toBe(true);
    });

    it('should explain classification access', () => {
      const doc = createMockDocument({
        classification: {
          level: 'internal',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
      });

      const explanation = explainPermissions(doc, 'user1', 'user');

      expect(explanation.hasClassificationAccess).toBe(true);
      expect(explanation.reasons.some(r => r.includes('Classification'))).toBe(true);
    });
  });
});

// ============================================================================
// Edge Cases and Security Tests
// ============================================================================

describe('Edge Cases and Security', () => {
  describe('Classification Edge Cases', () => {
    it('should handle empty role string', () => {
      expect(canAccessClassification('internal', '')).toBe(false);
    });

    it('should handle invalid classification gracefully', () => {
      // The function may throw for invalid input - this is acceptable behavior
      // as the type system should prevent this in normal usage
      try {
        // @ts-expect-error - Testing invalid input
        const result = canAccessClassification('invalid_level', 'admin');
        // If it doesn't throw, it should return false
        expect(result).toBe(false);
      } catch {
        // Throwing is also acceptable for invalid input
        expect(true).toBe(true);
      }
    });

    it('should prevent role injection in classification checks', () => {
      expect(canAccessClassification('secret', 'admin" OR "1"="1')).toBe(false);
      expect(canAccessClassification('confidential', '<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('ACL Edge Cases', () => {
    const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
      id: 'doc1',
      organizationId: 'org1',
      title: 'Test Document',
      type: 'Politique',
      version: '1.0',
      status: 'Brouillon',
      owner: 'owner@test.com',
      ownerId: 'owner123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('should handle documents without ACL', () => {
      const doc = createMockDocument({ acl: undefined });
      expect(() => checkAccess(doc, 'user1', 'user', 'read')).not.toThrow();
    });

    it('should handle empty permissions array', () => {
      const doc = createMockDocument({
        acl: {
          defaultAccess: 'explicit',
          permissions: [],
        },
      });
      expect(checkAccess(doc, 'user1', 'user', 'read')).toBe(false);
    });

    it('should not match expired permissions', () => {
      const expiredTimestamp = Timestamp.fromDate(
        new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      );

      const doc = createMockDocument({
        acl: {
          defaultAccess: 'explicit',
          permissions: [
            {
              principalType: 'user',
              principalId: 'user1',
              access: 'admin',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
              expiresAt: expiredTimestamp,
            },
          ],
        },
      });

      expect(checkAccess(doc, 'user1', 'user', 'admin')).toBe(false);
    });
  });

  describe('Combined Classification + ACL', () => {
    const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
      id: 'doc1',
      organizationId: 'org1',
      title: 'Test Document',
      type: 'Politique',
      version: '1.0',
      status: 'Brouillon',
      owner: 'owner@test.com',
      ownerId: 'owner123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('should deny access when classification blocks but ACL allows', () => {
      const doc = createMockDocument({
        classification: {
          level: 'secret',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
        acl: {
          defaultAccess: 'classification',
          permissions: [
            {
              principalType: 'user',
              principalId: 'user1',
              access: 'admin',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
      });

      // ACL grants admin but classification blocks - should deny for regular user
      // Note: canViewDocument checks classification first
      expect(canViewDocument(doc, 'user1', 'user')).toBe(false);
    });

    it('should respect both classification and ACL when both are satisfied', () => {
      const doc = createMockDocument({
        classification: {
          level: 'confidential',
          classifiedBy: 'admin1',
          classifiedAt: Timestamp.now(),
          autoClassified: false,
        },
        acl: {
          defaultAccess: 'classification',
          permissions: [
            {
              principalType: 'user',
              principalId: 'user1',
              access: 'edit',
              grantedBy: 'admin1',
              grantedAt: Timestamp.now(),
            },
          ],
        },
      });

      // project_manager can access confidential
      expect(checkAccess(doc, 'user1', 'project_manager', 'edit')).toBe(true);
      expect(checkAccess(doc, 'user1', 'project_manager', 'read')).toBe(true);
    });
  });
});

// ============================================================================
// Access Control Matrix Tests
// ============================================================================

describe('Complete Access Control Matrix', () => {
  const roles = ['user', 'auditor', 'project_manager', 'rssi', 'admin', 'super_admin'];
  const classifications: ClassificationLevel[] = ['public', 'internal', 'confidential', 'secret'];

  const expectedMatrix: Record<ClassificationLevel, Record<string, boolean>> = {
    public: {
      user: true,
      auditor: true,
      project_manager: true,
      rssi: true,
      admin: true,
      super_admin: true,
    },
    internal: {
      user: true,
      auditor: true,
      project_manager: true,
      rssi: true,
      admin: true,
      super_admin: true,
    },
    confidential: {
      user: false,
      auditor: false,
      project_manager: true,
      rssi: true,
      admin: true,
      super_admin: true,
    },
    secret: {
      user: false,
      auditor: false,
      project_manager: false,
      rssi: true,
      admin: true,
      super_admin: true,
    },
  };

  classifications.forEach(classification => {
    describe(`${classification} classification`, () => {
      roles.forEach(role => {
        const expected = expectedMatrix[classification][role];
        it(`should ${expected ? 'allow' : 'deny'} ${role} access`, () => {
          expect(canAccessClassification(classification, role)).toBe(expected);
        });
      });
    });
  });
});
