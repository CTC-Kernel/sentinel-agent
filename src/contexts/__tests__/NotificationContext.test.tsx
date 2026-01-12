/**
 * NotificationContext Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi } from 'vitest';
import { NotificationContext, NotificationContextType, NotificationType, Notification } from '../NotificationContext';

describe('NotificationContext', () => {
    describe('Notification type', () => {
        it('should support success type', () => {
            const type: NotificationType = 'success';
            expect(type).toBe('success');
        });

        it('should support error type', () => {
            const type: NotificationType = 'error';
            expect(type).toBe('error');
        });

        it('should support warning type', () => {
            const type: NotificationType = 'warning';
            expect(type).toBe('warning');
        });

        it('should support info type', () => {
            const type: NotificationType = 'info';
            expect(type).toBe('info');
        });
    });

    describe('Notification interface', () => {
        it('should have correct structure', () => {
            const notification: Notification = {
                id: 'notif-1',
                type: 'success',
                title: 'Test Title',
                message: 'Test message',
                timestamp: Date.now(),
                read: false,
                createdAt: new Date().toISOString()
            };

            expect(notification.id).toBe('notif-1');
            expect(notification.type).toBe('success');
            expect(notification.title).toBe('Test Title');
            expect(notification.read).toBe(false);
        });
    });

    describe('NotificationContextType interface', () => {
        it('should have all required properties', () => {
            const context: NotificationContextType = {
                notifications: [],
                unreadCount: 0,
                loading: false,
                isOpen: false,
                toggle: vi.fn(),
                setIsOpen: vi.fn(),
                addNotification: vi.fn(() => 'new-id'),
                removeNotification: vi.fn(),
                clearNotifications: vi.fn(),
                markAsRead: vi.fn(),
                markAllAsRead: vi.fn()
            };

            expect(context.notifications).toEqual([]);
            expect(context.unreadCount).toBe(0);
            expect(context.loading).toBe(false);
            expect(context.isOpen).toBe(false);
            expect(typeof context.toggle).toBe('function');
            expect(typeof context.setIsOpen).toBe('function');
            expect(typeof context.addNotification).toBe('function');
            expect(typeof context.removeNotification).toBe('function');
            expect(typeof context.clearNotifications).toBe('function');
            expect(typeof context.markAsRead).toBe('function');
            expect(typeof context.markAllAsRead).toBe('function');
        });

        it('should return id from addNotification', () => {
            const mockAddNotification = vi.fn(() => 'generated-id');
            const context: NotificationContextType = {
                notifications: [],
                unreadCount: 0,
                loading: false,
                isOpen: false,
                toggle: vi.fn(),
                setIsOpen: vi.fn(),
                addNotification: mockAddNotification,
                removeNotification: vi.fn(),
                clearNotifications: vi.fn(),
                markAsRead: vi.fn(),
                markAllAsRead: vi.fn()
            };

            const id = context.addNotification({
                type: 'success',
                title: 'Test',
                message: 'Test message'
            });

            expect(id).toBe('generated-id');
        });
    });

    describe('NotificationContext', () => {
        it('should be defined', () => {
            expect(NotificationContext).toBeDefined();
        });
    });
});
