import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '../notificationService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'notifications'),
    addDoc: vi.fn(() => Promise.resolve({ id: 'test-notification-id' })),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
    updateDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(() => ({ id: 'test-doc' })),
    orderBy: vi.fn(),
    limit: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({
            notificationPreferences: {
                system: { inApp: true, email: true },
                tasks: { inApp: true, email: false },
                audit: { inApp: true, email: true }
            }
        })
    })),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => new Date().toISOString()),
    writeBatch: vi.fn(() => ({
        update: vi.fn(),
        commit: vi.fn(() => Promise.resolve())
    })),
    deleteDoc: vi.fn(() => Promise.resolve())
}));

// Mock email service
vi.mock('../emailService', () => ({
    sendEmail: vi.fn(() => Promise.resolve())
}));

// Mock email templates
vi.mock('../emailTemplates', () => ({
    getTaskAssignmentTemplate: vi.fn(() => ({ subject: 'Task', html: '<p>Task</p>' })),
    getIncidentAlertTemplate: vi.fn(() => ({ subject: 'Incident', html: '<p>Incident</p>' })),
    getAuditReminderTemplate: vi.fn(() => ({ subject: 'Audit', html: '<p>Audit</p>' })),
    getDocumentReviewTemplate: vi.fn(() => ({ subject: 'Document', html: '<p>Document</p>' })),
    getRiskTreatmentDueTemplate: vi.fn(() => ({ subject: 'Risk', html: '<p>Risk</p>' })),
    getComplianceAlertTemplate: vi.fn(() => ({ subject: 'Compliance', html: '<p>Compliance</p>' })),
    getMaintenanceTemplate: vi.fn(() => ({ subject: 'Maintenance', html: '<p>Maintenance</p>' })),
    getSupplierReviewTemplate: vi.fn(() => ({ subject: 'Supplier', html: '<p>Supplier</p>' }))
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    }
}));

// Mock appConfig
vi.mock('../../config/appConfig', () => ({
    buildAppUrl: vi.fn((path: string) => `https://app.sentinel.com${path}`)
}));

// Mock dataSanitizer
vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data)
}));

describe('NotificationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('create', () => {
        it('should create a notification for a user', async () => {
            const { addDoc } = await import('firebase/firestore');

            const user = {
                uid: 'user-123',
                organizationId: 'org-456'
            };

            await NotificationService.create(
                user,
                'info',
                'Test Title',
                'Test Message',
                '/dashboard',
                7,
                'system'
            );

            expect(addDoc).toHaveBeenCalled();
        });

        it('should not create notification if organizationId is missing', async () => {
            const { addDoc } = await import('firebase/firestore');

            const user = {
                uid: 'user-123',
                organizationId: ''
            };

            await NotificationService.create(
                user,
                'info',
                'Test Title',
                'Test Message'
            );

            expect(addDoc).not.toHaveBeenCalled();
        });

        it('should respect user notification preferences', async () => {
            const { addDoc, getDoc } = await import('firebase/firestore');

            // Mock user with inApp notifications disabled
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    notificationPreferences: {
                        system: { inApp: false, email: true }
                    }
                })
            } as never);

            const user = {
                uid: 'user-123',
                organizationId: 'org-456'
            };

            await NotificationService.create(
                user,
                'info',
                'Test Title',
                'Test Message',
                undefined,
                undefined,
                'system'
            );

            // Should not create notification since inApp is disabled
            expect(addDoc).not.toHaveBeenCalled();
        });

        it('should set expiration date when expiresInDays is provided', async () => {
            const { addDoc } = await import('firebase/firestore');
            const { sanitizeData } = await import('../../utils/dataSanitizer');

            const user = {
                uid: 'user-123',
                organizationId: 'org-456'
            };

            await NotificationService.create(
                user,
                'warning',
                'Expiring Notification',
                'This will expire',
                '/alerts',
                30
            );

            expect(addDoc).toHaveBeenCalled();
            expect(sanitizeData).toHaveBeenCalledWith(
                expect.objectContaining({
                    expiresAt: expect.any(String)
                })
            );
        });
    });

    describe('shouldNotify', () => {
        it('should return true if no preferences are set', () => {
            const user = {
                uid: 'user-123',
                organizationId: 'org-456'
            } as never;

            const result = NotificationService.shouldNotify(user, 'system', 'inApp');
            expect(result).toBe(true);
        });

        it('should return preference value when set', () => {
            const user = {
                uid: 'user-123',
                organizationId: 'org-456',
                notificationPreferences: {
                    system: { inApp: false, email: true },
                    tasks: { inApp: true, email: false }
                }
            } as never;

            expect(NotificationService.shouldNotify(user, 'system', 'inApp')).toBe(false);
            expect(NotificationService.shouldNotify(user, 'system', 'email')).toBe(true);
            expect(NotificationService.shouldNotify(user, 'tasks', 'inApp')).toBe(true);
            expect(NotificationService.shouldNotify(user, 'tasks', 'email')).toBe(false);
        });

        it('should default to true for unset preferences', () => {
            const user = {
                uid: 'user-123',
                organizationId: 'org-456',
                notificationPreferences: {
                    system: { inApp: true }
                }
            } as never;

            // Email not set, should default to true
            expect(NotificationService.shouldNotify(user, 'system', 'email')).toBe(true);
        });
    });

    describe('notification types', () => {
        it('should handle info notification type', async () => {
            const { addDoc } = await import('firebase/firestore');

            await NotificationService.create(
                { uid: 'user-123', organizationId: 'org-456' },
                'info',
                'Info Title',
                'Info message'
            );

            expect(addDoc).toHaveBeenCalled();
        });

        it('should handle warning notification type', async () => {
            const { addDoc } = await import('firebase/firestore');

            await NotificationService.create(
                { uid: 'user-123', organizationId: 'org-456' },
                'warning',
                'Warning Title',
                'Warning message'
            );

            expect(addDoc).toHaveBeenCalled();
        });

        it('should handle error notification type', async () => {
            const { addDoc } = await import('firebase/firestore');

            await NotificationService.create(
                { uid: 'user-123', organizationId: 'org-456' },
                'error',
                'Error Title',
                'Error message'
            );

            expect(addDoc).toHaveBeenCalled();
        });

        it('should handle success notification type', async () => {
            const { addDoc } = await import('firebase/firestore');

            await NotificationService.create(
                { uid: 'user-123', organizationId: 'org-456' },
                'success',
                'Success Title',
                'Success message'
            );

            expect(addDoc).toHaveBeenCalled();
        });
    });

    describe('notification categories', () => {
        const categories = ['system', 'tasks', 'audit', 'risks', 'compliance', 'documents', 'incidents'] as const;

        categories.forEach(category => {
            it(`should handle ${category} category`, async () => {
                const { addDoc } = await import('firebase/firestore');

                await NotificationService.create(
                    { uid: 'user-123', organizationId: 'org-456' },
                    'info',
                    `${category} notification`,
                    `Message for ${category}`,
                    undefined,
                    undefined,
                    category as never
                );

                expect(addDoc).toHaveBeenCalled();
            });
        });
    });

    describe('error handling', () => {
        it('should handle errors gracefully during creation', async () => {
            const { addDoc } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await NotificationService.create(
                { uid: 'user-123', organizationId: 'org-456' },
                'info',
                'Test',
                'Test message'
            );

            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should handle errors when fetching user preferences', async () => {
            const { getDoc, addDoc } = await import('firebase/firestore');

            vi.mocked(getDoc).mockRejectedValueOnce(new Error('Fetch error'));

            await NotificationService.create(
                { uid: 'user-123', organizationId: 'org-456' },
                'info',
                'Test',
                'Test message'
            );

            // Should still attempt to create notification
            expect(addDoc).toHaveBeenCalled();
        });
    });
});
