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

    describe('createForOrganization', () => {
        it('should create notifications for all users in organization', async () => {
            const { getDocs, addDoc } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    { id: 'user-1', data: () => ({ uid: 'user-1', organizationId: 'org-123' }) },
                    { id: 'user-2', data: () => ({ uid: 'user-2', organizationId: 'org-123' }) }
                ]
            } as never);

            await NotificationService.createForOrganization(
                'org-123',
                'info',
                'Org Notification',
                'Message for all'
            );

            expect(addDoc).toHaveBeenCalledTimes(2);
        });

        it('should filter users based on notification preferences', async () => {
            const { getDocs, addDoc } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    { id: 'user-1', data: () => ({ uid: 'user-1', organizationId: 'org-123', notificationPreferences: { system: { inApp: true } } }) },
                    { id: 'user-2', data: () => ({ uid: 'user-2', organizationId: 'org-123', notificationPreferences: { system: { inApp: false } } }) }
                ]
            } as never);

            await NotificationService.createForOrganization(
                'org-123',
                'info',
                'Org Notification',
                'Message for all',
                undefined,
                'system'
            );

            // Only user-1 should get notification
            expect(addDoc).toHaveBeenCalledTimes(1);
        });

        it('should handle errors gracefully', async () => {
            const { getDocs } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(getDocs).mockRejectedValueOnce(new Error('DB Error'));

            await NotificationService.createForOrganization(
                'org-123',
                'info',
                'Test',
                'Test message'
            );

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getUnread', () => {
        it('should return unread notifications for a user', async () => {
            const { getDocs } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 'notif-1',
                        data: () => ({
                            type: 'info',
                            title: 'Test',
                            message: 'Test message',
                            read: false,
                            createdAt: { toDate: () => new Date() }
                        })
                    },
                    {
                        id: 'notif-2',
                        data: () => ({
                            type: 'warning',
                            title: 'Warning',
                            message: 'Warning message',
                            read: false,
                            createdAt: { seconds: Date.now() / 1000 }
                        })
                    }
                ]
            } as never);

            const notifications = await NotificationService.getUnread('user-123', 'org-123');

            expect(notifications).toHaveLength(2);
            expect(notifications[0].id).toBe('notif-1');
        });

        it('should return empty array on error', async () => {
            const { getDocs } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(getDocs).mockRejectedValueOnce(new Error('DB Error'));

            const notifications = await NotificationService.getUnread('user-123', 'org-123');

            expect(notifications).toEqual([]);
            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should handle createdAt as string', async () => {
            const { getDocs } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 'notif-1',
                        data: () => ({
                            type: 'info',
                            title: 'Test',
                            message: 'Test message',
                            read: false,
                            createdAt: '2026-01-10T10:00:00Z'
                        })
                    }
                ]
            } as never);

            const notifications = await NotificationService.getUnread('user-123', 'org-123');

            expect(notifications).toHaveLength(1);
        });
    });

    describe('getAll', () => {
        it('should return all notifications with default limit', async () => {
            const { getDocs } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 'notif-1',
                        data: () => ({
                            type: 'info',
                            title: 'Test 1',
                            message: 'Message 1',
                            read: true,
                            createdAt: { toDate: () => new Date() }
                        })
                    },
                    {
                        id: 'notif-2',
                        data: () => ({
                            type: 'info',
                            title: 'Test 2',
                            message: 'Message 2',
                            read: false,
                            createdAt: { toDate: () => new Date() }
                        })
                    }
                ]
            } as never);

            const notifications = await NotificationService.getAll('user-123', 'org-123');

            expect(notifications).toHaveLength(2);
        });

        it('should accept custom limit', async () => {
            const { getDocs, limit } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);

            await NotificationService.getAll('user-123', 'org-123', 10);

            expect(limit).toHaveBeenCalledWith(10);
        });

        it('should return empty array on error', async () => {
            const { getDocs } = await import('firebase/firestore');

            vi.mocked(getDocs).mockRejectedValueOnce(new Error('DB Error'));

            const notifications = await NotificationService.getAll('user-123', 'org-123');

            expect(notifications).toEqual([]);
        });
    });

    describe('markAsRead', () => {
        it('should mark a notification as read', async () => {
            const { updateDoc, doc, getDoc } = await import('firebase/firestore');

            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ organizationId: 'org-456' })
            } as never);

            await NotificationService.markAsRead('notif-123', 'org-456');

            expect(doc).toHaveBeenCalledWith(expect.anything(), 'notifications', 'notif-123');
            expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { read: true });
        });

        it('should handle errors gracefully', async () => {
            const { updateDoc, getDoc } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ organizationId: 'org-456' })
            } as never);

            vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Update failed'));

            await NotificationService.markAsRead('notif-123', 'org-456');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all unread notifications as read for a user', async () => {
            const { getDocs, updateDoc } = await import('firebase/firestore');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    { id: 'notif-1', ref: { id: 'notif-1' } },
                    { id: 'notif-2', ref: { id: 'notif-2' } },
                    { id: 'notif-3', ref: { id: 'notif-3' } }
                ]
            } as never);

            await NotificationService.markAllAsRead('user-123', 'org-456');

            expect(updateDoc).toHaveBeenCalledTimes(3);
        });

        it('should handle individual update failures gracefully', async () => {
            const { getDocs, updateDoc } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    { id: 'notif-1', ref: { id: 'notif-1' } },
                    { id: 'notif-2', ref: { id: 'notif-2' } }
                ]
            } as never);

            vi.mocked(updateDoc)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('Update failed'));

            await NotificationService.markAllAsRead('user-123', 'org-456');

            // Should log error for failed update
            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should handle query errors gracefully', async () => {
            const { getDocs } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Query failed'));

            await NotificationService.markAllAsRead('user-123', 'org-456');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('subscribeToNotifications', () => {
        it('should set up real-time subscription', async () => {
            const { onSnapshot } = await import('firebase/firestore');

            const mockUnsubscribe = vi.fn();
            vi.mocked(onSnapshot).mockReturnValueOnce(mockUnsubscribe);

            const callback = vi.fn();
            const unsubscribe = NotificationService.subscribeToNotifications('user-123', 'org-123', callback);

            expect(onSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });

        it('should call callback with parsed notifications', async () => {
            const { onSnapshot } = await import('firebase/firestore');

            let snapshotCallback: ((snapshot: unknown) => void) | undefined;
            vi.mocked(onSnapshot).mockImplementation((_q, cb) => {
                snapshotCallback = cb as (snapshot: unknown) => void;
                return vi.fn();
            });

            const callback = vi.fn();
            NotificationService.subscribeToNotifications('user-123', 'org-123', callback);

            // Simulate snapshot
            if (snapshotCallback) {
                snapshotCallback({
                    docs: [
                        {
                            id: 'notif-1',
                            data: () => ({
                                type: 'info',
                                title: 'Real-time notification',
                                message: 'Test',
                                createdAt: { toDate: () => new Date() }
                            })
                        }
                    ]
                });
            }

            expect(callback).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'notif-1' })
                ])
            );
        });

        it('should return no-op function on error during setup', async () => {
            const { onSnapshot } = await import('firebase/firestore');

            // Simulate onSnapshot throwing an error during setup
            vi.mocked(onSnapshot).mockImplementationOnce(() => {
                throw new Error('Snapshot error');
            });

            const callback = vi.fn();
            const unsubscribe = NotificationService.subscribeToNotifications('user-123', 'org-123', callback);

            expect(typeof unsubscribe).toBe('function');
            // Should not throw when called
            unsubscribe();
        });
    });

    describe('checkUpcomingAudits', () => {
        it('should check for audits scheduled within 7 days', async () => {
            const { getDocs } = await import('firebase/firestore');

            // Mock audits query
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 3); // 3 days from now

            vi.mocked(getDocs)
                .mockResolvedValueOnce({
                    docs: [
                        {
                            id: 'audit-1',
                            data: () => ({
                                id: 'audit-1',
                                dateScheduled: futureDate.toISOString(),
                                auditor: 'John Doe',
                                organizationId: 'org-123',
                                status: 'Planifié'
                            })
                        }
                    ]
                } as never)
                // Mock auditor lookup
                .mockResolvedValueOnce({
                    empty: false,
                    docs: [{ id: 'auditor-123' }]
                } as never)
                // Mock existing notification check
                .mockResolvedValueOnce({ empty: true } as never);

            await NotificationService.checkUpcomingAudits('org-123');

            expect(getDocs).toHaveBeenCalled();
        });

        it('should not create duplicate notifications', async () => {
            const { getDocs, addDoc } = await import('firebase/firestore');

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 3);

            vi.mocked(getDocs)
                .mockResolvedValueOnce({
                    docs: [
                        {
                            id: 'audit-1',
                            data: () => ({
                                id: 'audit-1',
                                dateScheduled: futureDate.toISOString(),
                                auditor: 'John Doe',
                                organizationId: 'org-123'
                            })
                        }
                    ]
                } as never)
                .mockResolvedValueOnce({
                    empty: false,
                    docs: [{ id: 'auditor-123' }]
                } as never)
                // Existing notification found
                .mockResolvedValueOnce({
                    empty: false,
                    docs: [{ id: 'existing-notif' }]
                } as never);

            await NotificationService.checkUpcomingAudits('org-123');

            // Should not create new notification since one exists
            expect(addDoc).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const { getDocs } = await import('firebase/firestore');
            const { ErrorLogger } = await import('../errorLogger');

            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Query failed'));

            await NotificationService.checkUpcomingAudits('org-123');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });
});
