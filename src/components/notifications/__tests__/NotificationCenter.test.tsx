/**
 * Unit tests for NotificationCenter component
 * Tests notification dropdown, filtering, and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationCenter } from '../NotificationCenter';
import { Notification } from '../../../types';

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Bell: () => <span data-testid="bell-icon" />,
    CheckCheck: () => <span data-testid="check-all-icon" />,
    Filter: () => <span data-testid="filter-icon" />
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: { children?: React.ReactNode; className?: string;[key: string]: unknown }) => (
            <div className={className} {...props}>{children}</div>
        )
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

// Mock Tooltip
vi.mock('../../ui/Tooltip', () => ({
    Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
        <div data-tooltip={content}>{children}</div>
    )
}));

// Mock NotificationItem
vi.mock('../NotificationItem', () => ({
    NotificationItem: ({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) => (
        <div data-testid="notification-item" data-id={notification.id} onClick={() => onRead(notification.id)}>
            {notification.title}
        </div>
    )
}));

// Mock useOnClickOutside hook
vi.mock('../../../hooks/utils/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn()
}));

// Mock useNotifications hook
const mockToggle = vi.fn();
const mockSetIsOpen = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();

let mockNotifications: Notification[] = [];
let mockUnreadCount = 0;
let mockIsOpen = false;
let mockLoading = false;

vi.mock('../../../hooks/useNotifications', () => ({
    useNotifications: () => ({
        notifications: mockNotifications,
        unreadCount: mockUnreadCount,
        toggle: mockToggle,
        isOpen: mockIsOpen,
        setIsOpen: mockSetIsOpen,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        loading: mockLoading
    })
}));

const renderWithRouter = (ui: React.ReactElement) => {
    return render(
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {ui}
        </BrowserRouter>
    );
};

describe('NotificationCenter', () => {
    const mockNotificationsList: Notification[] = [
        {
            id: 'notif-1',
            organizationId: 'org-1',
            userId: 'user-1',
            title: 'New risk identified',
            message: 'A new high risk has been identified',
            type: 'warning',
            read: false,
            createdAt: '2024-01-15T10:00:00Z'
        },
        {
            id: 'notif-2',
            organizationId: 'org-1',
            userId: 'user-1',
            title: 'Control approved',
            message: 'Your control has been approved',
            type: 'success',
            read: true,
            createdAt: '2024-01-14T10:00:00Z'
        },
        {
            id: 'notif-3',
            organizationId: 'org-1',
            userId: 'user-1',
            title: 'Task assigned',
            message: 'You have been assigned a task',
            type: 'assignment',
            read: false,
            createdAt: '2024-01-13T10:00:00Z'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockNotifications = mockNotificationsList;
        mockUnreadCount = 2;
        mockIsOpen = false;
        mockLoading = false;
    });

    describe('bell button', () => {
        it('renders bell icon button', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
        });

        it('shows unread count in aria-label', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByLabelText('Notifications - 2 non lues')).toBeInTheDocument();
        });

        it('shows simple label when no unread', () => {
            mockUnreadCount = 0;
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
        });

        it('calls toggle when button clicked', () => {
            renderWithRouter(<NotificationCenter />);

            fireEvent.click(screen.getByRole('button'));

            expect(mockToggle).toHaveBeenCalled();
        });

        it('shows unread indicator when unread count > 0', () => {
            const { container } = renderWithRouter(<NotificationCenter />);

            // Red dot indicator
            expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
        });

        it('hides unread indicator when no unread', () => {
            mockUnreadCount = 0;
            const { container } = renderWithRouter(<NotificationCenter />);

            expect(container.querySelector('.bg-red-500')).not.toBeInTheDocument();
        });
    });

    describe('dropdown panel - closed', () => {
        it('does not render panel when closed', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
        });
    });

    describe('dropdown panel - open', () => {
        beforeEach(() => {
            mockIsOpen = true;
        });

        it('renders panel header when open', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByText('Notifications')).toBeInTheDocument();
        });

        it('renders filter button', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
        });

        it('renders mark all as read button', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByTestId('check-all-icon')).toBeInTheDocument();
        });

        it('renders notification items', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getAllByTestId('notification-item').length).toBe(3);
        });

        it('displays notification titles', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByText('New risk identified')).toBeInTheDocument();
            expect(screen.getByText('Control approved')).toBeInTheDocument();
            expect(screen.getByText('Task assigned')).toBeInTheDocument();
        });

        it('renders settings link', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByText('Gérer les préférences')).toBeInTheDocument();
        });

        it('calls markAllAsRead when button clicked', () => {
            renderWithRouter(<NotificationCenter />);

            // Find button with check-all icon
            const markAllButton = screen.getByTestId('check-all-icon').closest('button')!;
            fireEvent.click(markAllButton);

            expect(mockMarkAllAsRead).toHaveBeenCalled();
        });

        it('calls markAsRead when notification clicked', () => {
            renderWithRouter(<NotificationCenter />);

            fireEvent.click(screen.getByText('New risk identified'));

            expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
        });
    });

    describe('loading state', () => {
        beforeEach(() => {
            mockIsOpen = true;
            mockLoading = true;
        });

        it('shows loading animation', () => {
            const { container } = renderWithRouter(<NotificationCenter />);

            expect(container.querySelectorAll('.animate-bounce').length).toBe(3);
        });

        it('hides notification items when loading', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.queryByTestId('notification-item')).not.toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        beforeEach(() => {
            mockIsOpen = true;
            mockNotifications = [];
        });

        it('shows empty message when no notifications', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByText('Aucune notification')).toBeInTheDocument();
        });

        it('shows calm message for all filter', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByText("C'est calme par ici...")).toBeInTheDocument();
        });
    });

    describe('filter toggle', () => {
        beforeEach(() => {
            mockIsOpen = true;
        });

        it('shows Tout label by default', () => {
            renderWithRouter(<NotificationCenter />);

            expect(screen.getByText('Tout')).toBeInTheDocument();
        });

        it('toggles to unread filter when clicked', () => {
            renderWithRouter(<NotificationCenter />);

            const filterButton = screen.getByText('Tout').closest('button')!;
            fireEvent.click(filterButton);

            expect(screen.getByText('Non-lus')).toBeInTheDocument();
        });

        it('filters to show only unread notifications', () => {
            renderWithRouter(<NotificationCenter />);

            const filterButton = screen.getByText('Tout').closest('button')!;
            fireEvent.click(filterButton);

            // Only 2 unread notifications should show
            expect(screen.getAllByTestId('notification-item').length).toBe(2);
        });

        it('toggles back to all filter', () => {
            renderWithRouter(<NotificationCenter />);

            const filterButton = screen.getByText('Tout').closest('button')!;
            fireEvent.click(filterButton); // to unread
            fireEvent.click(screen.getByText('Non-lus').closest('button')!); // back to all

            expect(screen.getByText('Tout')).toBeInTheDocument();
            expect(screen.getAllByTestId('notification-item').length).toBe(3);
        });
    });

    describe('settings link', () => {
        beforeEach(() => {
            mockIsOpen = true;
        });

        it('links to notification settings', () => {
            renderWithRouter(<NotificationCenter />);

            const link = screen.getByText('Gérer les préférences');
            expect(link).toHaveAttribute('href', '/settings/notifications');
        });

        it('closes panel when link clicked', () => {
            renderWithRouter(<NotificationCenter />);

            fireEvent.click(screen.getByText('Gérer les préférences'));

            expect(mockSetIsOpen).toHaveBeenCalledWith(false);
        });
    });
});
