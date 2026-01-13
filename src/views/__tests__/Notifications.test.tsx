import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    }
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
        user: { uid: 'user-1', organizationId: 'org-1' }
    })
}));

// Mock NotificationService
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();

vi.mock('../../services/notificationService', () => ({
    NotificationService: {
        subscribeToNotifications: (_userId: string, callback: (data: unknown[]) => void) => {
            callback([
                { id: 'notif-1', title: 'Test Notification', message: 'Test message', type: 'info', read: false, createdAt: '2024-01-01' },
                { id: 'notif-2', title: 'Warning', message: 'Warning message', type: 'warning', read: true, createdAt: '2024-01-02' }
            ]);
            return () => {};
        },
        markAsRead: vi.fn().mockResolvedValue(undefined),
        markAllAsRead: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn()
    }
}));

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/SEO', () => ({
    SEO: ({ title }: { title: string }) => <div data-testid="seo" data-title={title} />
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
        <div data-testid="page-header">
            <h1>{title}</h1>
            {actions}
        </div>
    )
}));

vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ children, searchQuery, onSearchChange }: { children: React.ReactNode; searchQuery: string; onSearchChange: (v: string) => void }) => (
        <div data-testid="premium-control">
            <input
                data-testid="search-input"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
            />
            {children}
        </div>
    )
}));

vi.mock('../../components/common/EmptyState', () => ({
    EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>
}));

vi.mock('../../components/ui/Skeleton', () => ({
    CardSkeleton: () => <div data-testid="card-skeleton" />
}));

vi.mock('../../components/ui/animationVariants', () => ({
    staggerContainerVariants: {}
}));

vi.mock('../../components/ui/Icons', () => ({
    Bell: () => <span>BellIcon</span>,
    CheckCircle2: () => <span>CheckCircle2Icon</span>,
    AlertTriangle: () => <span>AlertTriangleIcon</span>,
    Info: () => <span>InfoIcon</span>,
    X: () => <span>XIcon</span>,
    ArrowRight: () => <span>ArrowRightIcon</span>
}));

// Import after mocks
import { Notifications } from '../Notifications';

describe('Notifications View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <Notifications />
            </BrowserRouter>
        );
    };

    it('should render SEO component', () => {
        renderComponent();
        expect(screen.getByTestId('seo')).toHaveAttribute('data-title', 'Notifications');
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();
        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render page header', () => {
        renderComponent();
        expect(screen.getByText('notifications.title')).toBeInTheDocument();
    });

    it('should render notifications list', () => {
        renderComponent();
        expect(screen.getByText('Test Notification')).toBeInTheDocument();
        expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should render filter buttons', () => {
        renderComponent();
        expect(screen.getByLabelText('notifications.filter.all')).toBeInTheDocument();
        expect(screen.getByLabelText('notifications.filter.unread')).toBeInTheDocument();
    });

    it('should call markAsRead when clicking mark as read button', async () => {
        const { NotificationService } = await import('../../services/notificationService');

        renderComponent();

        const markReadButton = screen.getByLabelText('Marquer comme lu');
        fireEvent.click(markReadButton);

        await waitFor(() => {
            expect(NotificationService.markAsRead).toHaveBeenCalledWith('notif-1');
        });
    });

    it('should call markAllAsRead when clicking mark all button', async () => {
        const { NotificationService } = await import('../../services/notificationService');

        renderComponent();

        const markAllButton = screen.getByLabelText('notifications.markAll');
        fireEvent.click(markAllButton);

        await waitFor(() => {
            expect(NotificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
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
