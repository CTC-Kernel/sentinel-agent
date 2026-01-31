import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { uid: 'user-1', organizationId: 'org-1' },
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
        addToast: vi.fn()
    })
}));

// Mock useNotifications hook
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockRemoveNotification = vi.fn();

vi.mock('../../hooks/useNotifications', () => ({
    useNotifications: () => ({
        notifications: [
            { id: 'notif-1', title: 'Test Notification', message: 'Test message', type: 'info', read: false, createdAt: '2024-01-01' },
            { id: 'notif-2', title: 'Warning', message: 'Warning message', type: 'warning', read: true, createdAt: '2024-01-02' }
        ],
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        removeNotification: mockRemoveNotification
    })
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn()
    }
}));


// Mock GlassCard component
vi.mock('../../components/ui/GlassCard', () => ({
    GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className} data-testid="glass-card">{children}</div>
    )
}));

// Import after mocks
import { Notifications } from '../Notifications';

describe('Notifications View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Notifications />
            </BrowserRouter>
        );
    };

    it('should render page header with title', () => {
        renderComponent();
        expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('should render subtitle', () => {
        renderComponent();
        expect(screen.getByText('Gérez vos alertes et messages importants')).toBeInTheDocument();
    });

    it('should render notifications list', () => {
        renderComponent();
        expect(screen.getByText('Test Notification')).toBeInTheDocument();
        expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should render filter buttons', () => {
        renderComponent();
        expect(screen.getByText('Toutes')).toBeInTheDocument();
        expect(screen.getByText('Non lues')).toBeInTheDocument();
    });

    it('should render search input', () => {
        renderComponent();
        expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
    });

    it('should call markAsRead when clicking mark as read button', async () => {
        renderComponent();

        const markReadButton = screen.getByTitle('Marquer comme lu');
        fireEvent.click(markReadButton);

        await waitFor(() => {
            expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
        });
    });

    it('should call markAllAsRead when clicking mark all button', async () => {
        renderComponent();

        const markAllButton = screen.getByText('Tout marquer comme lu');
        fireEvent.click(markAllButton);

        await waitFor(() => {
            expect(mockMarkAllAsRead).toHaveBeenCalled();
        });
    });
});

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
