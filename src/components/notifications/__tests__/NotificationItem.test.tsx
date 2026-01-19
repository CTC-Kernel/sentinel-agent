/**
 * Unit tests for NotificationItem component
 * Tests notification display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationItem } from '../NotificationItem';
import { Notification } from '../../../types/notification';

// Mock date-fns
vi.mock('date-fns', () => ({
    formatDistanceToNow: vi.fn(() => 'il y a 5 minutes')
}));

vi.mock('date-fns/locale', () => ({
    fr: {}
}));

describe('NotificationItem', () => {
    const mockOnRead = vi.fn();

    const baseNotification: Notification = {
        id: 'notif-1',
        title: 'New Risk Alert',
        message: 'A critical risk has been identified in your system',
        type: 'warning',
        read: false,
        createdAt: new Date('2024-01-15T10:00:00').toISOString(),
        userId: 'user-1',
        organizationId: 'org-1'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderNotification = (notification: Notification) => {
        return render(
            <BrowserRouter>
                <NotificationItem notification={notification} onRead={mockOnRead} />
            </BrowserRouter>
        );
    };

    describe('rendering', () => {
        it('renders notification title', () => {
            renderNotification(baseNotification);

            expect(screen.getByText('New Risk Alert')).toBeInTheDocument();
        });

        it('renders notification message', () => {
            renderNotification(baseNotification);

            expect(screen.getByText('A critical risk has been identified in your system')).toBeInTheDocument();
        });

        it('renders timestamp', () => {
            renderNotification(baseNotification);

            expect(screen.getByText('il y a 5 minutes')).toBeInTheDocument();
        });

        it('renders unread indicator when not read', () => {
            const { container } = renderNotification(baseNotification);

            expect(container.querySelector('.bg-brand-500')).toBeInTheDocument();
        });

        it('does not render unread indicator when read', () => {
            const readNotification = { ...baseNotification, read: true };
            const { container } = renderNotification(readNotification);

            // The unread dot should not be present
            const unreadDot = container.querySelector('.h-2.w-2.rounded-full.bg-brand-500');
            expect(unreadDot).not.toBeInTheDocument();
        });
    });

    describe('notification types', () => {
        it('renders success icon for success type', () => {
            const successNotif = { ...baseNotification, type: 'success' as const };
            const { container } = renderNotification(successNotif);

            expect(container.querySelector('.text-green-500')).toBeInTheDocument();
        });

        it('renders warning icon for warning type', () => {
            const warningNotif = { ...baseNotification, type: 'warning' as const };
            const { container } = renderNotification(warningNotif);

            expect(container.querySelector('.text-amber-500')).toBeInTheDocument();
        });

        it('renders error icon for error type', () => {
            const errorNotif = { ...baseNotification, type: 'error' as const };
            const { container } = renderNotification(errorNotif);

            expect(container.querySelector('.text-red-500')).toBeInTheDocument();
        });

        it('renders danger icon for danger type', () => {
            const dangerNotif = { ...baseNotification, type: 'danger' as const };
            const { container } = renderNotification(dangerNotif);

            expect(container.querySelector('.text-red-500')).toBeInTheDocument();
        });

        it('renders mention icon for mention type', () => {
            const mentionNotif = { ...baseNotification, type: 'mention' as const };
            renderNotification(mentionNotif);

            expect(screen.getByText('@')).toBeInTheDocument();
        });

        it('renders assignment icon for assignment type', () => {
            const assignmentNotif = { ...baseNotification, type: 'assignment' as const };
            const { container } = renderNotification(assignmentNotif);

            expect(container.querySelector('.text-blue-500')).toBeInTheDocument();
        });

        it('renders info icon for info type', () => {
            const infoNotif = { ...baseNotification, type: 'info' as const };
            const { container } = renderNotification(infoNotif);

            expect(container.querySelector('.text-slate-500')).toBeInTheDocument();
        });
    });

    describe('background colors', () => {
        it('has warning background for unread warning', () => {
            const { container } = renderNotification(baseNotification);

            expect(container.querySelector('.bg-amber-50')).toBeInTheDocument();
        });

        it('has transparent background for read notification', () => {
            const readNotif = { ...baseNotification, read: true };
            const { container } = renderNotification(readNotif);

            expect(container.querySelector('.bg-transparent')).toBeInTheDocument();
        });

        it('has error background for unread error', () => {
            const errorNotif = { ...baseNotification, type: 'error' as const };
            const { container } = renderNotification(errorNotif);

            expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
        });

        it('has success background for unread success', () => {
            const successNotif = { ...baseNotification, type: 'success' as const };
            const { container } = renderNotification(successNotif);

            expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('calls onRead when clicked and unread', () => {
            renderNotification(baseNotification);

            fireEvent.click(screen.getByRole('button'));

            expect(mockOnRead).toHaveBeenCalledWith('notif-1');
        });

        it('does not call onRead when clicked and already read', () => {
            const readNotif = { ...baseNotification, read: true };
            renderNotification(readNotif);

            fireEvent.click(screen.getByRole('button'));

            expect(mockOnRead).not.toHaveBeenCalled();
        });

        it('calls onRead on Enter key', () => {
            renderNotification(baseNotification);

            fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

            expect(mockOnRead).toHaveBeenCalledWith('notif-1');
        });

        it('calls onRead on Space key', () => {
            renderNotification(baseNotification);

            fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

            expect(mockOnRead).toHaveBeenCalledWith('notif-1');
        });
    });

    describe('with link', () => {
        it('renders as link when link provided', () => {
            const notifWithLink = { ...baseNotification, link: '/risks/risk-1' };
            renderNotification(notifWithLink);

            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/risks/risk-1');
        });

        it('calls onRead when link clicked', () => {
            const notifWithLink = { ...baseNotification, link: '/risks/risk-1' };
            renderNotification(notifWithLink);

            fireEvent.click(screen.getByRole('link'));

            expect(mockOnRead).toHaveBeenCalledWith('notif-1');
        });
    });
});
