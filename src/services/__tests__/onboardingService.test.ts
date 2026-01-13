/**
 * OnboardingService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingService } from '../onboardingService';

// Mock driver.js
vi.mock('driver.js', () => ({
    driver: vi.fn(() => ({
        setConfig: vi.fn(),
        getConfig: vi.fn(() => ({})),
        drive: vi.fn(),
        destroy: vi.fn()
    }))
}));

// Mock firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {}
}));

// Mock Firebase Firestore
const mockUpdateDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockWriteBatch = vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    collection: vi.fn(() => 'mock-collection'),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: () => mockGetDocs(),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    writeBatch: () => mockWriteBatch(),
    serverTimestamp: vi.fn(() => new Date().toISOString())
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args)
}));

// Mock dataSanitizer
vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data)
}));

// Mock permissions
vi.mock('../../utils/permissions', () => ({
    getRoleName: vi.fn((role: string) => {
        const names: Record<string, string> = {
            admin: 'Administrateur',
            manager: 'Manager',
            user: 'Utilisateur'
        };
        return names[role] || 'Collaborateur';
    }),
    Role: {}
}));

// Mock emailService
vi.mock('../emailService', () => ({
    sendEmail: vi.fn(() => Promise.resolve())
}));

// Mock emailTemplates
vi.mock('../emailTemplates', () => ({
    getInvitationTemplate: vi.fn(() => '<p>Invitation Email</p>')
}));

// Mock subscriptionService
vi.mock('../subscriptionService', () => ({
    SubscriptionService: {
        startSubscription: vi.fn(() => Promise.resolve())
    }
}));

// Mock analyticsService
vi.mock('../analyticsService', () => ({
    analyticsService: {
        logEvent: vi.fn()
    }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    }
}));

// Mock i18n
vi.mock('../../i18n', () => ({
    default: {
        t: vi.fn((key: string) => key)
    }
}));

describe('OnboardingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: { origin: 'https://app.sentinel.com' },
            writable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createOrganization', () => {
        it('should call cloud function to create organization', async () => {
            const mockFn = vi.fn().mockResolvedValue({
                data: { organizationId: 'new-org-123' }
            });
            mockHttpsCallable.mockReturnValue(mockFn);

            const result = await OnboardingService.createOrganization({
                organizationName: 'Test Org',
                displayName: 'Admin User',
                department: 'IT',
                role: 'admin',
                industry: 'Technology'
            });

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createOrganization');
            expect(mockFn).toHaveBeenCalledWith({
                organizationName: 'Test Org',
                displayName: 'Admin User',
                department: 'IT',
                role: 'admin',
                industry: 'Technology'
            });
            expect(result).toEqual({ organizationId: 'new-org-123' });
        });
    });

    describe('searchOrganizations', () => {
        it('should return empty array for empty search query', async () => {
            const result = await OnboardingService.searchOrganizations('');
            expect(result).toEqual([]);
        });

        it('should return empty array for whitespace-only query', async () => {
            const result = await OnboardingService.searchOrganizations('   ');
            expect(result).toEqual([]);
        });

        it('should search organizations by name', async () => {
            mockGetDocs.mockResolvedValue({
                docs: [
                    { id: 'org-1', data: () => ({ name: 'Test Org', industry: 'Tech' }) },
                    { id: 'org-2', data: () => ({ name: 'Test Company', industry: 'Finance' }) }
                ]
            });

            const result = await OnboardingService.searchOrganizations('Test');

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 'org-1', name: 'Test Org' });
        });

        it('should deduplicate results from multiple queries', async () => {
            // First query returns org-1, second returns same org-1
            mockGetDocs
                .mockResolvedValueOnce({
                    docs: [{ id: 'org-1', data: () => ({ name: 'Test Org' }) }]
                })
                .mockResolvedValueOnce({
                    docs: [{ id: 'org-1', data: () => ({ name: 'Test Org' }) }]
                });

            const result = await OnboardingService.searchOrganizations('test');

            // Should deduplicate
            expect(result).toHaveLength(1);
        });

        it('should handle errors gracefully', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockGetDocs.mockRejectedValue(new Error('Search failed'));

            const result = await OnboardingService.searchOrganizations('Test');

            expect(result).toEqual([]);
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('sendJoinRequest', () => {
        it('should create a join request document', async () => {
            mockAddDoc.mockResolvedValue({ id: 'request-123' });

            const user = {
                uid: 'user-123',
                email: 'user@example.com',
                displayName: 'Test User',
                organizationId: 'org-456'
            };

            await OnboardingService.sendJoinRequest(user as never, 'target-org', 'Target Org', 'John Doe');

            expect(mockAddDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: 'user-123',
                    userEmail: 'user@example.com',
                    displayName: 'John Doe',
                    organizationId: 'target-org',
                    organizationName: 'Target Org',
                    status: 'pending'
                })
            );
        });

        it('should use user displayName if custom displayName not provided', async () => {
            mockAddDoc.mockResolvedValue({ id: 'request-123' });

            const user = {
                uid: 'user-123',
                email: 'user@example.com',
                displayName: 'User Display Name',
                organizationId: 'org-456'
            };

            await OnboardingService.sendJoinRequest(user as never, 'target-org', 'Target Org');

            expect(mockAddDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    displayName: 'User Display Name'
                })
            );
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockAddDoc.mockRejectedValue(new Error('Add failed'));

            const user = {
                uid: 'user-123',
                email: 'user@example.com',
                organizationId: 'org-456'
            };

            await expect(
                OnboardingService.sendJoinRequest(user as never, 'target-org', 'Target Org')
            ).rejects.toThrow('Add failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('updateOrganizationConfiguration', () => {
        it('should update organization with standards and scope', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);

            await OnboardingService.updateOrganizationConfiguration(
                'org-123',
                ['ISO27001', 'GDPR'],
                'All IT systems'
            );

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    standards: ['ISO27001', 'GDPR'],
                    scope: 'All IT systems',
                    onboardingStep: 3
                })
            );
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            await expect(
                OnboardingService.updateOrganizationConfiguration('org-123', [], '')
            ).rejects.toThrow('Update failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('sendInvites', () => {
        it('should not send invites if organizationId is missing', async () => {
            const user = { uid: 'user-123', organizationId: '' };

            await OnboardingService.sendInvites(user as never, [
                { email: 'test@example.com', role: 'user' }
            ]);

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should not send invites if invites array is empty', async () => {
            const user = { uid: 'user-123', organizationId: 'org-123' };

            await OnboardingService.sendInvites(user as never, []);

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should create invitations and send emails', async () => {
            const user = {
                uid: 'user-123',
                organizationId: 'org-123',
                organizationName: 'Test Org',
                displayName: 'Admin User',
                email: 'admin@example.com'
            };

            const invites = [
                { email: 'user1@example.com', role: 'user' },
                { email: 'user2@example.com', role: 'manager' }
            ];

            await OnboardingService.sendInvites(user as never, invites);

            expect(mockWriteBatch).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            // Override mockWriteBatch to return a batch that rejects on commit
            mockWriteBatch.mockReturnValueOnce({
                set: vi.fn(),
                commit: vi.fn().mockRejectedValue(new Error('Batch failed'))
            });

            const user = {
                uid: 'user-123',
                organizationId: 'org-123',
                organizationName: 'Test Org'
            };

            await expect(
                OnboardingService.sendInvites(user as never, [{ email: 'test@example.com', role: 'user' }])
            ).rejects.toThrow('Batch failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('createInitialAssets', () => {
        it('should not create assets if organizationId is missing', async () => {
            const user = { uid: 'user-123', organizationId: '' };

            await OnboardingService.createInitialAssets(user as never, [
                { name: 'Asset 1', type: 'SaaS' }
            ]);

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should not create assets if assets array is empty', async () => {
            const user = { uid: 'user-123', organizationId: 'org-123' };

            await OnboardingService.createInitialAssets(user as never, []);

            expect(mockWriteBatch).not.toHaveBeenCalled();
        });

        it('should create assets in batch', async () => {
            const user = {
                uid: 'user-123',
                organizationId: 'org-123',
                displayName: 'Admin User'
            };

            const assets = [
                { name: 'CRM System', type: 'SaaS' },
                { name: 'Main Server', type: 'Hardware' }
            ];

            await OnboardingService.createInitialAssets(user as never, assets);

            expect(mockWriteBatch).toHaveBeenCalled();
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            // Override mockWriteBatch to return a batch that rejects on commit
            mockWriteBatch.mockReturnValueOnce({
                set: vi.fn(),
                commit: vi.fn().mockRejectedValue(new Error('Batch failed'))
            });

            const user = {
                uid: 'user-123',
                organizationId: 'org-123'
            };

            await expect(
                OnboardingService.createInitialAssets(user as never, [{ name: 'Asset', type: 'SaaS' }])
            ).rejects.toThrow('Batch failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('finalizeOnboarding', () => {
        it('should throw if organizationId is missing', async () => {
            const user = { uid: 'user-123', organizationId: '' };

            await expect(
                OnboardingService.finalizeOnboarding(user as never, 'discovery')
            ).rejects.toThrow('Organization ID missing');
        });

        it('should mark user as onboarded and log event', async () => {
            const { analyticsService } = await import('../analyticsService');
            mockUpdateDoc.mockResolvedValue(undefined);

            const user = {
                uid: 'user-123',
                organizationId: 'org-123'
            };

            await OnboardingService.finalizeOnboarding(user as never, 'discovery');

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                { onboardingCompleted: true }
            );
            expect(analyticsService.logEvent).toHaveBeenCalledWith('complete_onboarding', {
                plan: 'discovery',
                organization_id: 'org-123'
            });
        });

        it('should start subscription for paid plans', async () => {
            const { SubscriptionService } = await import('../subscriptionService');
            mockUpdateDoc.mockResolvedValue(undefined);

            const user = {
                uid: 'user-123',
                organizationId: 'org-123'
            };

            await OnboardingService.finalizeOnboarding(user as never, 'professional');

            expect(SubscriptionService.startSubscription).toHaveBeenCalledWith(
                'org-123',
                'professional',
                'month'
            );
        });

        it('should not start subscription for discovery plan', async () => {
            const { SubscriptionService } = await import('../subscriptionService');
            mockUpdateDoc.mockResolvedValue(undefined);

            const user = {
                uid: 'user-123',
                organizationId: 'org-123'
            };

            await OnboardingService.finalizeOnboarding(user as never, 'discovery');

            expect(SubscriptionService.startSubscription).not.toHaveBeenCalled();
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            const user = {
                uid: 'user-123',
                organizationId: 'org-123'
            };

            await expect(
                OnboardingService.finalizeOnboarding(user as never, 'discovery')
            ).rejects.toThrow('Update failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('Tour Methods', () => {
        it('should start main tour with default role', () => {
            // This tests that startMainTour exists and runs without error
            expect(() => {
                OnboardingService.startMainTour();
            }).not.toThrow();
        });

        it('should start main tour with specific role', () => {
            expect(() => {
                OnboardingService.startMainTour('admin');
            }).not.toThrow();
        });
    });
});
