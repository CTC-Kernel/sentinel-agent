import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '@/services/subscriptionService';
import { getDoc } from 'firebase/firestore';

// Explicitly mock firestore in this test file to ensure we can control it
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(),
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    getFirestore: vi.fn(), // If used elsewhere
}));

// Mock getPlanLimits to avoid dependency on config file if possible, or let it run if it's pure JS
// We'll mock the firestore response
vi.mock('../../config/plans', () => ({
    getPlanLimits: (planId: string) => {
        const limits = {
            discovery: { maxUsers: 3, maxProjects: 1, maxAssets: 10, maxStorageGB: 1, features: { aiAssistant: false } },
            professional: { maxUsers: 10, maxProjects: 10, maxAssets: 100, maxStorageGB: 10, features: { aiAssistant: true } },
        };
        return limits[planId as keyof typeof limits] || limits.discovery;
    }
}));

describe('SubscriptionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getLimits', () => {
        it('should return discovery limits if organization does not exist', async () => {
            (getDoc as any).mockResolvedValue({
                exists: () => false,
            });

            const limits = await SubscriptionService.getLimits('non-existent-org');
            expect(limits.maxUsers).toBe(3);
        });

        it('should return plan limits based on organization subscription', async () => {
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({ subscription: { planId: 'professional' } }),
            });

            const limits = await SubscriptionService.getLimits('org-123');
            expect(limits.maxUsers).toBe(10);
        });
    });

    describe('checkLimit', () => {
        it('should return true if count is within limit', async () => {
            // Mock getLimits indirectly by mocking getDoc
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({ subscription: { planId: 'discovery' } }),
            });

            const allowed = await SubscriptionService.checkLimit('org-123', 'users', 2);
            expect(allowed).toBe(true);
        });

        it('should return false if count exceeds limit', async () => {
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({ subscription: { planId: 'discovery' } }),
            });

            const allowed = await SubscriptionService.checkLimit('org-123', 'users', 5);
            expect(allowed).toBe(false);
        });
    });

    describe('hasFeature', () => {
        it('should return true if feature is enabled in plan', async () => {
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({ subscription: { planId: 'professional' } }),
            });

            const hasAI = await SubscriptionService.hasFeature('org-123', 'aiAssistant');
            expect(hasAI).toBe(true);
        });

        it('should return false if feature is disabled in plan', async () => {
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({ subscription: { planId: 'discovery' } }),
            });

            const hasAI = await SubscriptionService.hasFeature('org-123', 'aiAssistant');
            expect(hasAI).toBe(false);
        });
    });
});
