/**
 * Avatar Utilities Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { getDefaultAvatarUrl, getUserAvatarUrl, getAvatarSrc, getDefaultAvatarFallbackUrl } from '../avatarUtils';

describe('Avatar Utilities', () => {
  describe('getDefaultAvatarUrl', () => {
    it('should return user avatar when no role provided', () => {
      expect(getDefaultAvatarUrl()).toBe('/avatar_user.webp');
    });

    it('should return user avatar when undefined', () => {
      expect(getDefaultAvatarUrl(undefined)).toBe('/avatar_user.webp');
    });

    it('should return admin avatar for admin role', () => {
      expect(getDefaultAvatarUrl('admin')).toBe('/avatar_admin.webp');
    });

    it('should return admin avatar case-insensitively', () => {
      expect(getDefaultAvatarUrl('Admin')).toBe('/avatar_admin.webp');
      expect(getDefaultAvatarUrl('ADMIN')).toBe('/avatar_admin.webp');
    });

    it('should return auditor avatar for auditor role', () => {
      expect(getDefaultAvatarUrl('auditor')).toBe('/avatar_auditor.webp');
    });

    it('should return rssi avatar for rssi role', () => {
      expect(getDefaultAvatarUrl('rssi')).toBe('/avatar_rssi.webp');
    });

    it('should return project manager avatar for project_manager role', () => {
      expect(getDefaultAvatarUrl('project_manager')).toBe('/avatar_project_manager.webp');
    });

    it('should return direction avatar for direction role', () => {
      expect(getDefaultAvatarUrl('direction')).toBe('/avatar_direction.webp');
    });

    it('should return user avatar for user role', () => {
      expect(getDefaultAvatarUrl('user')).toBe('/avatar_user.webp');
    });

    it('should fallback to user avatar for unknown roles', () => {
      expect(getDefaultAvatarUrl('unknown_role')).toBe('/avatar_user.webp');
    });
  });

  describe('getDefaultAvatarFallbackUrl', () => {
    it('should return PNG fallback for admin role', () => {
      expect(getDefaultAvatarFallbackUrl('admin')).toBe('/avatar_admin.png');
    });

    it('should return PNG fallback for user role by default', () => {
      expect(getDefaultAvatarFallbackUrl()).toBe('/avatar_user.png');
    });

    it('should return PNG fallback case-insensitively', () => {
      expect(getDefaultAvatarFallbackUrl('RSSI')).toBe('/avatar_rssi.png');
    });

    it('should fallback to user PNG for unknown roles', () => {
      expect(getDefaultAvatarFallbackUrl('unknown_role')).toBe('/avatar_user.png');
    });
  });

  describe('getUserAvatarUrl', () => {
    it('should return photoURL when provided', () => {
      const photoURL = 'https://example.com/photo.jpg';
      expect(getUserAvatarUrl(photoURL, 'admin')).toBe(photoURL);
    });

    it('should return default avatar when photoURL is null', () => {
      expect(getUserAvatarUrl(null, 'admin')).toBe('/avatar_admin.webp');
    });

    it('should return default avatar when photoURL is undefined', () => {
      expect(getUserAvatarUrl(undefined, 'rssi')).toBe('/avatar_rssi.webp');
    });

    it('should return default avatar when photoURL is empty string', () => {
      expect(getUserAvatarUrl('', 'direction')).toBe('/avatar_direction.webp');
    });

    it('should return user avatar when no photoURL and no role', () => {
      expect(getUserAvatarUrl(null)).toBe('/avatar_user.webp');
    });
  });

  describe('getAvatarSrc', () => {
    it('should return photoURL when provided', () => {
      const photoURL = 'https://cdn.example.com/avatar.png';
      expect(getAvatarSrc(photoURL, 'user')).toBe(photoURL);
    });

    it('should return default avatar when photoURL is null', () => {
      expect(getAvatarSrc(null, 'auditor')).toBe('/avatar_auditor.webp');
    });

    it('should return default avatar when photoURL is undefined', () => {
      expect(getAvatarSrc(undefined, 'project_manager')).toBe('/avatar_project_manager.webp');
    });

    it('should return user avatar by default', () => {
      expect(getAvatarSrc(null)).toBe('/avatar_user.webp');
    });
  });
});
