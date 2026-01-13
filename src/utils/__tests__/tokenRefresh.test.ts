/**
 * TokenRefresh Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase - use vi.hoisted for mock functions
const { mockGetIdToken, mockGetIdTokenResult, mockHttpsCallable, mockCurrentUser } = vi.hoisted(() => {
    const mockGetIdToken = vi.fn().mockResolvedValue('mock-token');
    const mockGetIdTokenResult = vi.fn().mockResolvedValue({
        claims: { organizationId: 'org-123' }
    });
    const mockHttpsCallable = vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
        data: { success: true }
    }));
    const mockCurrentUser = {
        getIdToken: mockGetIdToken,
        getIdTokenResult: mockGetIdTokenResult
    };
    return { mockGetIdToken, mockGetIdTokenResult, mockHttpsCallable, mockCurrentUser };
});

vi.mock('../../firebase', () => ({
    auth: {
        get currentUser() { return mockCurrentUser; }
    }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mockHttpsCallable,
    getFunctions: vi.fn().mockReturnValue({})
}));

vi.mock('firebase/app', () => ({
    getApp: vi.fn().mockReturnValue({})
}));

import { refreshUserToken, hasCustomClaims, autoRefreshTokenIfNeeded } from '../tokenRefresh';

describe('refreshUserToken', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
            data: { success: true }
        }));
    });

    it('should call cloud function to refresh token', async () => {
        const result = await refreshUserToken();

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'refreshUserToken');
        expect(result).toBe(true);
    });

    it('should force refresh ID token after cloud function success', async () => {
        await refreshUserToken();

        expect(mockGetIdToken).toHaveBeenCalledWith(true);
    });

    it('should return false when cloud function returns failure', async () => {
        mockHttpsCallable.mockReturnValueOnce(vi.fn().mockResolvedValue({
            data: { success: false }
        }));

        const result = await refreshUserToken();

        expect(result).toBe(false);
    });

    it('should return false on error', async () => {
        mockHttpsCallable.mockReturnValueOnce(vi.fn().mockRejectedValue(new Error('Network error')));

        const result = await refreshUserToken();

        expect(result).toBe(false);
    });
});

describe('hasCustomClaims', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetIdTokenResult.mockResolvedValue({
            claims: { organizationId: 'org-123' }
        });
    });

    it('should return true when user has organizationId claim', async () => {
        mockGetIdTokenResult.mockResolvedValueOnce({
            claims: { organizationId: 'org-123' }
        });

        const result = await hasCustomClaims();

        expect(result).toBe(true);
    });

    it('should return false when user has no organizationId claim', async () => {
        mockGetIdTokenResult.mockResolvedValueOnce({
            claims: {}
        });

        const result = await hasCustomClaims();

        expect(result).toBe(false);
    });

    it('should return false on error', async () => {
        mockGetIdTokenResult.mockRejectedValueOnce(new Error('Token error'));

        const result = await hasCustomClaims();

        expect(result).toBe(false);
    });
});

describe('autoRefreshTokenIfNeeded', () => {
    const mockLocation = { reload: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
            data: { success: true }
        }));
        mockGetIdTokenResult.mockResolvedValue({
            claims: { organizationId: 'org-123' }
        });

        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: mockLocation,
            writable: true
        });
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('should skip refresh if just refreshed', async () => {
        sessionStorage.setItem('tokenJustRefreshed', 'true');

        await autoRefreshTokenIfNeeded();

        expect(sessionStorage.getItem('tokenJustRefreshed')).toBeNull();
    });

    it('should not refresh if user already has claims', async () => {
        mockGetIdTokenResult.mockResolvedValueOnce({
            claims: { organizationId: 'org-123' }
        });

        await autoRefreshTokenIfNeeded();

        expect(mockLocation.reload).not.toHaveBeenCalled();
    });

    it('should refresh and reload when claims are missing', async () => {
        mockGetIdTokenResult.mockResolvedValueOnce({
            claims: {}
        });

        await autoRefreshTokenIfNeeded();

        expect(sessionStorage.getItem('tokenJustRefreshed')).toBe('true');
        expect(mockLocation.reload).toHaveBeenCalled();
    });

    it('should not reload if refresh fails', async () => {
        mockGetIdTokenResult.mockResolvedValueOnce({
            claims: {}
        });
        mockHttpsCallable.mockReturnValueOnce(vi.fn().mockResolvedValue({
            data: { success: false }
        }));

        await autoRefreshTokenIfNeeded();

        expect(mockLocation.reload).not.toHaveBeenCalled();
    });

    it('should handle errors silently', async () => {
        mockGetIdTokenResult.mockRejectedValueOnce(new Error('Error'));

        // Should not throw
        await expect(autoRefreshTokenIfNeeded()).resolves.toBeUndefined();
    });
});
