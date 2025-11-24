import { describe, it, expect } from 'vitest';
import { hasPermission, canEditResource, getRoleName, getRoleDescription } from '../utils/permissions';
import { UserProfile } from '../types';

describe('permissions', () => {
  const mockUser = (role: UserProfile['role'], uid = 'user-123', displayName = 'Test User', email = 'test@example.com'): UserProfile => ({
    uid,
    displayName,
    email,
    role,
    organizationId: 'org-123'
  });

  describe('hasPermission', () => {
    it('should return false for null user', () => {
      expect(hasPermission(null, 'Asset', 'read')).toBe(false);
    });

    it('should allow admin full access', () => {
      const admin = mockUser('admin');
      expect(hasPermission(admin, 'Asset', 'delete')).toBe(true);
      expect(hasPermission(admin, 'Settings', 'update')).toBe(true);
    });

    it('should allow RSSI broad permissions', () => {
      const rssi = mockUser('rssi');
      expect(hasPermission(rssi, 'Asset', 'manage')).toBe(true);
      expect(hasPermission(rssi, 'Risk', 'manage')).toBe(true);
      expect(hasPermission(rssi, 'Project', 'manage')).toBe(true);
      expect(hasPermission(rssi, 'Audit', 'manage')).toBe(true);
      expect(hasPermission(rssi, 'Document', 'manage')).toBe(true);
      expect(hasPermission(rssi, 'SystemLog', 'read')).toBe(true);
    });

    it('should allow auditor limited permissions', () => {
      const auditor = mockUser('auditor');
      expect(hasPermission(auditor, 'Audit', 'manage')).toBe(true);
      expect(hasPermission(auditor, 'Document', 'create')).toBe(true);
      expect(hasPermission(auditor, 'Document', 'read')).toBe(true);
      expect(hasPermission(auditor, 'Document', 'update')).toBe(true);
      expect(hasPermission(auditor, 'Risk', 'read')).toBe(true);
      expect(hasPermission(auditor, 'Project', 'read')).toBe(true);
      expect(hasPermission(auditor, 'Asset', 'read')).toBe(true);
      expect(hasPermission(auditor, 'Asset', 'create')).toBe(false);
    });

    it('should allow project manager limited permissions', () => {
      const pm = mockUser('project_manager');
      expect(hasPermission(pm, 'Project', 'manage')).toBe(true);
      expect(hasPermission(pm, 'Document', 'create')).toBe(true);
      expect(hasPermission(pm, 'Document', 'read')).toBe(true);
      expect(hasPermission(pm, 'Document', 'update')).toBe(true);
      expect(hasPermission(pm, 'Risk', 'read')).toBe(true);
      expect(hasPermission(pm, 'Asset', 'read')).toBe(true);
      expect(hasPermission(pm, 'Project', 'delete')).toBe(true);
      expect(hasPermission(pm, 'Audit', 'read')).toBe(false);
    });

    it('should allow direction read-only access', () => {
      const dir = mockUser('direction');
      expect(hasPermission(dir, 'Project', 'read')).toBe(true);
      expect(hasPermission(dir, 'Risk', 'read')).toBe(true);
      expect(hasPermission(dir, 'Audit', 'read')).toBe(true);
      expect(hasPermission(dir, 'Document', 'read')).toBe(true);
      expect(hasPermission(dir, 'Asset', 'read')).toBe(true);
      expect(hasPermission(dir, 'Project', 'update')).toBe(false);
    });

    it('should allow user minimal read access', () => {
      const user = mockUser('user');
      expect(hasPermission(user, 'Document', 'read')).toBe(true);
      expect(hasPermission(user, 'Asset', 'read')).toBe(true);
      expect(hasPermission(user, 'Risk', 'read')).toBe(true);
      expect(hasPermission(user, 'Project', 'read')).toBe(false);
      expect(hasPermission(user, 'Asset', 'create')).toBe(false);
    });
  });

  describe('canEditResource', () => {
    it('should return false for null user', () => {
      expect(canEditResource(null, 'Document')).toBe(false);
    });

    it('should allow admin and RSSI to edit any resource', () => {
      const admin = mockUser('admin');
      const rssi = mockUser('rssi');
      expect(canEditResource(admin, 'Document')).toBe(true);
      expect(canEditResource(rssi, 'Document')).toBe(true);
    });

    it('should allow users to edit their own documents', () => {
      const user = mockUser('user');
      expect(canEditResource(user, 'Document', user.uid)).toBe(true);
      expect(canEditResource(user, 'Document', user.displayName)).toBe(true);
      expect(canEditResource(user, 'Document', user.email)).toBe(true);
      expect(canEditResource(user, 'Document', 'other-id')).toBe(false);
    });

    it('should respect role-based update permissions', () => {
      const auditor = mockUser('auditor');
      const pm = mockUser('project_manager');
      // Auditor can update documents per matrix
      expect(canEditResource(auditor, 'Document')).toBe(true);
      // PM can update documents per matrix
      expect(canEditResource(pm, 'Document')).toBe(true);
      // Auditor cannot update projects
      expect(canEditResource(auditor, 'Project')).toBe(false);
      // PM can update projects
      expect(canEditResource(pm, 'Project')).toBe(true);
    });
  });

  describe('getRoleName', () => {
    it('should return French role names', () => {
      expect(getRoleName('admin')).toBe('Administrateur');
      expect(getRoleName('rssi')).toBe('RSSI');
      expect(getRoleName('auditor')).toBe('Auditeur');
      expect(getRoleName('project_manager')).toBe('Chef de Projet');
      expect(getRoleName('direction')).toBe('Direction');
      expect(getRoleName('user')).toBe('Utilisateur');
    });
  });

  describe('getRoleDescription', () => {
    it('should return role descriptions', () => {
      expect(getRoleDescription('admin')).toContain('Accès complet');
      expect(getRoleDescription('rssi')).toContain('sécurité');
      expect(getRoleDescription('auditor')).toContain('conformité');
      expect(getRoleDescription('project_manager')).toContain('projets');
      expect(getRoleDescription('direction')).toContain('Supervise');
      expect(getRoleDescription('user')).toContain('droits limités');
    });
  });
});
