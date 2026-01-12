/**
 * Avatar Utilities Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { getDefaultAvatarUrl, getUserAvatarUrl, getAvatarSrc } from '../avatarUtils';

describe('Avatar Utilities', () => {
    describe('getDefaultAvatarUrl', () => {
        it('should return user avatar when no role provided', () => {
            expect(getDefaultAvatarUrl()).toBe('/avatar_user.png');
        });

        it('should return user avatar when undefined', () => {
            expect(getDefaultAvatarUrl(undefined)).toBe('/avatar_user.png');
        });

        it('should return admin avatar for admin role', () => {
            expect(getDefaultAvatarUrl('admin')).toBe('/avatar_admin.png');
        });

        it('should return admin avatar case-insensitively', () => {
            expect(getDefaultAvatarUrl('Admin')).toBe('/avatar_admin.png');
            expect(getDefaultAvatarUrl('ADMIN')).toBe('/avatar_admin.png');
        });

        it('should return auditor avatar for auditor role', () => {
            expect(getDefaultAvatarUrl('auditor')).toBe('/avatar_auditor.png');
        });

        it('should return rssi avatar for rssi role', () => {
            expect(getDefaultAvatarUrl('rssi')).toBe('/avatar_rssi.png');
        });

        it('should return project manager avatar for project_manager role', () => {
            expect(getDefaultAvatarUrl('project_manager')).toBe('/avatar_project_manager.png');
        });

        it('should return direction avatar for direction role', () => {
            expect(getDefaultAvatarUrl('direction')).toBe('/avatar_direction.png');
        });

        it('should return user avatar for user role', () => {
            expect(getDefaultAvatarUrl('user')).toBe('/avatar_user.png');
        });

        it('should return user avatar for unknown role', () => {
            expect(getDefaultAvatarUrl('unknown_role')).toBe('/avatar_user.png');
        });
    });

    describe('getUserAvatarUrl', () => {
        it('should return photoURL when provided', () => {
            const photoURL = 'https://example.com/photo.jpg';
            expect(getUserAvatarUrl(photoURL, 'admin')).toBe(photoURL);
        });

        it('should return default avatar when photoURL is null', () => {
            expect(getUserAvatarUrl(null, 'admin')).toBe('/avatar_admin.png');
        });

        it('should return default avatar when photoURL is undefined', () => {
            expect(getUserAvatarUrl(undefined, 'rssi')).toBe('/avatar_rssi.png');
        });

        it('should return default avatar when photoURL is empty string', () => {
            expect(getUserAvatarUrl('', 'direction')).toBe('/avatar_direction.png');
        });

        it('should return user avatar when no photoURL and no role', () => {
            expect(getUserAvatarUrl(null)).toBe('/avatar_user.png');
        });
    });

    describe('getAvatarSrc', () => {
        it('should return photoURL when provided', () => {
            const photoURL = 'https://cdn.example.com/avatar.png';
            expect(getAvatarSrc(photoURL, 'user')).toBe(photoURL);
        });

        it('should return default avatar when photoURL is null', () => {
            expect(getAvatarSrc(null, 'auditor')).toBe('/avatar_auditor.png');
        });

        it('should return default avatar when photoURL is undefined', () => {
            expect(getAvatarSrc(undefined, 'project_manager')).toBe('/avatar_project_manager.png');
        });

        it('should return user avatar by default', () => {
            expect(getAvatarSrc(null)).toBe('/avatar_user.png');
        });
    });
});
