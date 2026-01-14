/**
 * SubscriptionService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../subscriptionService';

// Mock Firebase
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: () => mockGetDoc(),
}));

vi.mock('../../firebase', () => ({
    db: {},
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => mockHttpsCallable,
}));

// Mock plan config
vi.mock('../../config/plans', () => ({
    getPlanLimits: (plan: string) => {
        const plans: Record<string, { maxUsers: number; maxProjects: number; maxAssets: number; maxStorageGB: number; features: { customReports: boolean; apiAccess: boolean; advancedAnalytics: boolean } }> = {
            discovery: {
                maxUsers: 5,
                maxProjects: 1,
                maxAssets: 100,
                maxStorageGB: 1,
                features: { customReports: false, apiAccess: false, advancedAnalytics: false },
            },
            professional: {
                maxUsers: 25,
                maxProjects: 10,
                maxAssets: 1000,
                maxStorageGB: 10,
                features: { customReports: true, apiAccess: true, advancedAnalytics: false },
            },
            enterprise: {
                maxUsers: 999999,
                maxProjects: 999999,
                maxAssets: 999999,
                maxStorageGB: 999999,
                features: { customReports: true, apiAccess: true, advancedAnalytics: true },
            },
        };
        return plans[plan] || plans.discovery;
    },
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

// Mock window.location
const mockLocation = { origin: 'https://app.example.com', href: '' };
Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
});

describe('SubscriptionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLocation.href = '';
    });

    describe('getLimits', () => {
        it('should return discovery limits when org does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });

            const limits = await SubscriptionService.getLimits('org-123');

            expect(limits.maxUsers).toBe(5);
            expect(limits.maxProjects).toBe(1);
        });

        it('should return plan limits based on organization subscription', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    subscription: { planId: 'professional' },
                }),
            });

            const limits = await SubscriptionService.getLimits('org-123');

            expect(limits.maxUsers).toBe(25);
            expect(limits.maxProjects).toBe(10);
        });

        it('should return discovery limits when no subscription', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({}),
            });

            const limits = await SubscriptionService.getLimits('org-123');

            expect(limits.maxUsers).toBe(5);
        });

        it('should return discovery limits on error', async () => {
            mockGetDoc.mockRejectedValue(new Error('Database error'));

            const limits = await SubscriptionService.getLimits('org-123');

            expect(limits.maxUsers).toBe(5);
        });

        it('should log error when fetching fails', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockGetDoc.mockRejectedValue(new Error('Database error'));

            await SubscriptionService.getLimits('org-123');

            expect(ErrorLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'SubscriptionService.getLimits'
            );
        });
    });

    describe('checkLimit', () => {
        beforeEach(() => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    subscription: { planId: 'discovery' },
                }),
            });
        });

        it('should return true when under user limit', async () => {
            const result = await SubscriptionService.checkLimit('org-123', 'users', 3);
            expect(result).toBe(true);
        });

        it('should return false when at user limit', async () => {
            const result = await SubscriptionService.checkLimit('org-123', 'users', 5);
            expect(result).toBe(false);
        });

        it('should check project limits', async () => {
            const result = await SubscriptionService.checkLimit('org-123', 'projects', 0);
            expect(result).toBe(true);

            const result2 = await SubscriptionService.checkLimit('org-123', 'projects', 1);
            expect(result2).toBe(false);
        });

        it('should check asset limits', async () => {
            const result = await SubscriptionService.checkLimit('org-123', 'assets', 50);
            expect(result).toBe(true);

            const result2 = await SubscriptionService.checkLimit('org-123', 'assets', 100);
            expect(result2).toBe(false);
        });

        it('should check storage limits', async () => {
            const result = await SubscriptionService.checkLimit('org-123', 'storage', 0.5);
            expect(result).toBe(true);
        });

        it('should return true for unknown resource type', async () => {
            const result = await SubscriptionService.checkLimit('org-123', 'unknown' as never, 999);
            expect(result).toBe(true);
        });
    });

    describe('hasFeature', () => {
        it('should return false for features not in discovery plan', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    subscription: { planId: 'discovery' },
                }),
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasCustomReports = await SubscriptionService.hasFeature('org-123', 'customReports' as any);
            expect(hasCustomReports).toBe(false);

            const hasApiAccess = await SubscriptionService.hasFeature('org-123', 'apiAccess');
            expect(hasApiAccess).toBe(false);
        });

        it('should return true for features in professional plan', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    subscription: { planId: 'professional' },
                }),
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasCustomReports = await SubscriptionService.hasFeature('org-123', 'customReports' as any);
            expect(hasCustomReports).toBe(true);

            const hasApiAccess = await SubscriptionService.hasFeature('org-123', 'apiAccess');
            expect(hasApiAccess).toBe(true);
        });

        it('should return true for all features in enterprise plan', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    subscription: { planId: 'enterprise' },
                }),
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasAdvanced = await SubscriptionService.hasFeature('org-123', 'advancedAnalytics' as any);
            expect(hasAdvanced).toBe(true);
        });
    });

    describe('startSubscription', () => {
        it('should redirect to checkout URL on success', async () => {
            mockHttpsCallable.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/session123' },
            });

            await SubscriptionService.startSubscription('org-123', 'professional');

            expect(mockLocation.href).toBe('https://checkout.stripe.com/session123');
        });

        it('should call with correct parameters', async () => {
            mockHttpsCallable.mockResolvedValue({
                data: { url: 'https://checkout.stripe.com/session123' },
            });

            await SubscriptionService.startSubscription('org-123', 'enterprise', 'year');

            expect(mockHttpsCallable).toHaveBeenCalledWith({
                organizationId: 'org-123',
                planId: 'enterprise',
                interval: 'year',
                successUrl: 'https://app.example.com/settings?billing_success=true',
                cancelUrl: 'https://app.example.com/pricing?canceled=true',
            });
        });

        it('should throw error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockHttpsCallable.mockRejectedValue(new Error('Stripe error'));

            await expect(
                SubscriptionService.startSubscription('org-123', 'professional')
            ).rejects.toThrow('Stripe error');

            expect(ErrorLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'SubscriptionService.startSubscription'
            );
        });

        it('should not redirect when no URL returned', async () => {
            mockHttpsCallable.mockResolvedValue({
                data: {},
            });

            await SubscriptionService.startSubscription('org-123', 'professional');

            expect(mockLocation.href).toBe('');
        });
    });

    describe('manageSubscription', () => {
        it('should redirect to portal URL on success', async () => {
            mockHttpsCallable.mockResolvedValue({
                data: { url: 'https://billing.stripe.com/portal123' },
            });

            await SubscriptionService.manageSubscription('org-123');

            expect(mockLocation.href).toBe('https://billing.stripe.com/portal123');
        });

        it('should throw specific error for not-found functions', async () => {
            mockHttpsCallable.mockRejectedValue({
                code: 'functions/not-found',
            });

            await expect(
                SubscriptionService.manageSubscription('org-123')
            ).rejects.toThrow('La gestion des abonnements n\'est pas encore configurée');
        });

        it('should throw specific error for 404 message', async () => {
            mockHttpsCallable.mockRejectedValue({
                message: '404 Not Found',
            });

            await expect(
                SubscriptionService.manageSubscription('org-123')
            ).rejects.toThrow('La gestion des abonnements n\'est pas encore configurée');
        });

        it('should rethrow other errors', async () => {
            mockHttpsCallable.mockRejectedValue(new Error('Network error'));

            await expect(
                SubscriptionService.manageSubscription('org-123')
            ).rejects.toThrow('Network error');
        });
    });
});
