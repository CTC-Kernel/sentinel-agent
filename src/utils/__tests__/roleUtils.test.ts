import { describe, it, expect } from 'vitest';
import {
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isExecutive,
  isRSSI,
  isAdmin,
  isAuditor,
  isProjectManager,
  canViewExecutiveDashboard,
  type UserWithRole,
} from '../roleUtils';

describe('roleUtils', () => {
  describe('hasRole', () => {
    it('should return false for null user', () => {
      expect(hasRole(null, 'admin')).toBe(false);
    });

    it('should return false for undefined user', () => {
      expect(hasRole(undefined, 'admin')).toBe(false);
    });

    it('should return true when user has the specified role', () => {
      const user: UserWithRole = { id: '1', role: 'admin' };
      expect(hasRole(user, 'admin')).toBe(true);
    });

    it('should return false when user does not have the specified role', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(hasRole(user, 'admin')).toBe(false);
    });

    it('should check multiple roles array', () => {
      const user: UserWithRole = { id: '1', role: 'user', roles: ['admin', 'rssi'] };
      expect(hasRole(user, 'rssi')).toBe(true);
    });
  });

  describe('hasAnyRole', () => {
    it('should return false for null user', () => {
      expect(hasAnyRole(null, ['admin', 'rssi'])).toBe(false);
    });

    it('should return true when user has any of the specified roles', () => {
      const user: UserWithRole = { id: '1', role: 'rssi' };
      expect(hasAnyRole(user, ['admin', 'rssi'])).toBe(true);
    });

    it('should return false when user has none of the specified roles', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(hasAnyRole(user, ['admin', 'rssi'])).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return false for null user', () => {
      expect(hasAllRoles(null, ['admin', 'rssi'])).toBe(false);
    });

    it('should return true when user has all specified roles', () => {
      const user: UserWithRole = { id: '1', role: 'admin', roles: ['admin', 'rssi'] };
      expect(hasAllRoles(user, ['admin', 'rssi'])).toBe(true);
    });

    it('should return false when user does not have all specified roles', () => {
      const user: UserWithRole = { id: '1', role: 'admin' };
      expect(hasAllRoles(user, ['admin', 'rssi'])).toBe(false);
    });
  });

  describe('isExecutive', () => {
    it('should return true for direction role', () => {
      const user: UserWithRole = { id: '1', role: 'direction' };
      expect(isExecutive(user)).toBe(true);
    });

    it('should return false for non-direction role', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(isExecutive(user)).toBe(false);
    });
  });

  describe('isRSSI', () => {
    it('should return true for rssi role', () => {
      const user: UserWithRole = { id: '1', role: 'rssi' };
      expect(isRSSI(user)).toBe(true);
    });

    it('should return false for non-rssi role', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(isRSSI(user)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin role', () => {
      const user: UserWithRole = { id: '1', role: 'admin' };
      expect(isAdmin(user)).toBe(true);
    });

    it('should return false for non-admin role', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(isAdmin(user)).toBe(false);
    });
  });

  describe('isAuditor', () => {
    it('should return true for auditor role', () => {
      const user: UserWithRole = { id: '1', role: 'auditor' };
      expect(isAuditor(user)).toBe(true);
    });

    it('should return false for non-auditor role', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(isAuditor(user)).toBe(false);
    });
  });

  describe('isProjectManager', () => {
    it('should return true for project_manager role', () => {
      const user: UserWithRole = { id: '1', role: 'project_manager' };
      expect(isProjectManager(user)).toBe(true);
    });

    it('should return false for non-project_manager role', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(isProjectManager(user)).toBe(false);
    });
  });

  describe('canViewExecutiveDashboard', () => {
    it('should return true for direction role', () => {
      const user: UserWithRole = { id: '1', role: 'direction' };
      expect(canViewExecutiveDashboard(user)).toBe(true);
    });

    it('should return true for admin role', () => {
      const user: UserWithRole = { id: '1', role: 'admin' };
      expect(canViewExecutiveDashboard(user)).toBe(true);
    });

    it('should return false for other roles', () => {
      const user: UserWithRole = { id: '1', role: 'user' };
      expect(canViewExecutiveDashboard(user)).toBe(false);
    });

    it('should return false for rssi role', () => {
      const user: UserWithRole = { id: '1', role: 'rssi' };
      expect(canViewExecutiveDashboard(user)).toBe(false);
    });
  });
});
