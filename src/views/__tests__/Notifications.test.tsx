import { describe, it, expect } from 'vitest';

describe('Notification Types', () => {
    it('should have correct notification structure', () => {
        const notification = {
            id: 'notif-1',
            type: 'warning' as const,
            title: 'Security Alert',
            message: 'Unusual login detected',
            read: false,
            link: '/incidents/123',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        expect(notification.id).toBeDefined();
        expect(['info', 'warning', 'error', 'success']).toContain(notification.type);
        expect(notification.read).toBe(false);
    });

    it('should categorize notifications by type', () => {
        const types = ['info', 'warning', 'error', 'success'];
        types.forEach(type => {
            expect(typeof type).toBe('string');
        });
    });

    it('should check if notification is expired', () => {
        const isExpired = (expiresAt?: Date): boolean => {
            if (!expiresAt) return false;
            return new Date() > expiresAt;
        };

        const pastDate = new Date(Date.now() - 1000);
        const futureDate = new Date(Date.now() + 1000000);

        expect(isExpired(pastDate)).toBe(true);
        expect(isExpired(futureDate)).toBe(false);
        expect(isExpired(undefined)).toBe(false);
    });

    it('should filter unread notifications', () => {
        const notifications = [
            { id: '1', read: false },
            { id: '2', read: true },
            { id: '3', read: false },
            { id: '4', read: true }
        ];

        const unread = notifications.filter(n => !n.read);
        expect(unread).toHaveLength(2);
    });

    it('should sort notifications by date', () => {
        const notifications = [
            { id: '1', createdAt: new Date('2024-01-15') },
            { id: '2', createdAt: new Date('2024-01-17') },
            { id: '3', createdAt: new Date('2024-01-16') }
        ];

        const sorted = [...notifications].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        expect(sorted[0].id).toBe('2');
        expect(sorted[2].id).toBe('1');
    });

    it('should group notifications by date', () => {
        const notifications = [
            { id: '1', createdAt: new Date('2024-01-15T10:00:00') },
            { id: '2', createdAt: new Date('2024-01-15T14:00:00') },
            { id: '3', createdAt: new Date('2024-01-16T09:00:00') }
        ];

        const groupByDate = (notifs: typeof notifications) => {
            return notifs.reduce((groups, n) => {
                const date = n.createdAt.toISOString().split('T')[0];
                if (!groups[date]) groups[date] = [];
                groups[date].push(n);
                return groups;
            }, {} as Record<string, typeof notifications>);
        };

        const grouped = groupByDate(notifications);
        expect(grouped['2024-01-15']).toHaveLength(2);
        expect(grouped['2024-01-16']).toHaveLength(1);
    });

    it('should calculate unread count', () => {
        const notifications = [
            { read: false },
            { read: true },
            { read: false },
            { read: false }
        ];

        const unreadCount = notifications.filter(n => !n.read).length;
        expect(unreadCount).toBe(3);
    });

    it('should prioritize notifications by type', () => {
        const notifications = [
            { id: '1', type: 'info' },
            { id: '2', type: 'error' },
            { id: '3', type: 'warning' },
            { id: '4', type: 'success' }
        ];

        const typeOrder: Record<string, number> = {
            error: 0,
            warning: 1,
            success: 2,
            info: 3
        };

        const sorted = [...notifications].sort(
            (a, b) => typeOrder[a.type] - typeOrder[b.type]
        );

        expect(sorted[0].type).toBe('error');
        expect(sorted[1].type).toBe('warning');
    });
});

describe('Notification Actions', () => {
    it('should mark notification as read', () => {
        const notification = { id: '1', read: false };
        const markAsRead = (n: typeof notification) => ({ ...n, read: true });

        const updated = markAsRead(notification);
        expect(updated.read).toBe(true);
    });

    it('should mark all as read', () => {
        const notifications = [
            { id: '1', read: false },
            { id: '2', read: false },
            { id: '3', read: true }
        ];

        const markAllAsRead = (notifs: typeof notifications) =>
            notifs.map(n => ({ ...n, read: true }));

        const updated = markAllAsRead(notifications);
        expect(updated.every(n => n.read)).toBe(true);
    });

    it('should delete notification', () => {
        const notifications = [
            { id: '1' },
            { id: '2' },
            { id: '3' }
        ];

        const deleteNotification = (notifs: typeof notifications, id: string) =>
            notifs.filter(n => n.id !== id);

        const updated = deleteNotification(notifications, '2');
        expect(updated).toHaveLength(2);
        expect(updated.find(n => n.id === '2')).toBeUndefined();
    });
});
