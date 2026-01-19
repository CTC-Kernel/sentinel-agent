/**
 * Unit tests for useAutoNotification hook
 * Tests automatic notification creation and cleanup based on conditions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoNotification } from '../useAutoNotification';

// Mock useNotifications
const mockAddNotification = vi.fn();
const mockRemoveNotification = vi.fn();

vi.mock('../useNotifications', () => ({
    useNotifications: () => ({
        addNotification: mockAddNotification,
        removeNotification: mockRemoveNotification
    })
}));

describe('useAutoNotification', () => {
    const testNotification = {
        type: 'warning' as const,
        title: 'Test Warning',
        message: 'This is a test notification',
        read: false,
        createdAt: Date.now()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockAddNotification.mockReturnValue('notification-123');
    });

    describe('condition true', () => {
        it('adds notification when condition is true', () => {
            renderHook(() => useAutoNotification(true, testNotification));

            expect(mockAddNotification).toHaveBeenCalledWith(testNotification);
        });

        it('only adds notification once', () => {
            const { rerender } = renderHook(
                ({ condition }) => useAutoNotification(condition, testNotification),
                { initialProps: { condition: true } }
            );

            expect(mockAddNotification).toHaveBeenCalledTimes(1);

            rerender({ condition: true });

            // Should not add again
            expect(mockAddNotification).toHaveBeenCalledTimes(1);
        });

        it('stores notification ID in ref', () => {
            renderHook(() => useAutoNotification(true, testNotification));

            expect(mockAddNotification).toHaveBeenCalled();
        });
    });

    describe('condition false', () => {
        it('does not add notification when condition is false', () => {
            renderHook(() => useAutoNotification(false, testNotification));

            expect(mockAddNotification).not.toHaveBeenCalled();
        });
    });

    describe('condition changes', () => {
        it('removes notification when condition changes to false', () => {
            const { rerender, unmount } = renderHook(
                ({ condition }) => useAutoNotification(condition, testNotification),
                { initialProps: { condition: true } }
            );

            expect(mockAddNotification).toHaveBeenCalled();

            // Change condition to false
            rerender({ condition: false });

            // Wait for cleanup effect
            unmount();

            // Notification should be removed
            expect(mockRemoveNotification).toHaveBeenCalled();
        });
    });

    describe('unmount cleanup', () => {
        it('removes notification on unmount', () => {
            const { unmount } = renderHook(() =>
                useAutoNotification(true, testNotification)
            );

            unmount();

            expect(mockRemoveNotification).toHaveBeenCalledWith('notification-123');
        });

        it('does not try to remove when no notification was added', () => {
            const { unmount } = renderHook(() =>
                useAutoNotification(false, testNotification)
            );

            unmount();

            // No notification ID to remove since condition was false
            expect(mockRemoveNotification).not.toHaveBeenCalled();
        });
    });

    describe('notification content', () => {
        it('passes notification type correctly', () => {
            renderHook(() =>
                useAutoNotification(true, {
                    type: 'error',
                    title: 'Error Title',
                    message: 'Error message',
                    read: false,
                    createdAt: Date.now()
                })
            );

            expect(mockAddNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    title: 'Error Title'
                })
            );
        });

        it('handles different notification types', () => {
            const types = ['info', 'success', 'warning', 'error'] as const;

            types.forEach(type => {
                mockAddNotification.mockClear();

                const { unmount } = renderHook(() =>
                    useAutoNotification(true, {
                        type,
                        title: `${type} notification`,
                        message: 'Test message',
                        read: false,
                        createdAt: Date.now()
                    })
                );

                expect(mockAddNotification).toHaveBeenCalledWith(
                    expect.objectContaining({ type })
                );

                unmount();
            });
        });
    });

    describe('notification ID handling', () => {
        it('handles string ID from addNotification', () => {
            mockAddNotification.mockReturnValue('string-id-123');

            const { unmount } = renderHook(() =>
                useAutoNotification(true, testNotification)
            );

            unmount();

            expect(mockRemoveNotification).toHaveBeenCalledWith('string-id-123');
        });

        it('handles non-string return from addNotification', () => {
            mockAddNotification.mockReturnValue(undefined);

            const { unmount } = renderHook(() =>
                useAutoNotification(true, testNotification)
            );

            unmount();

            // Should not try to remove with undefined ID
            expect(mockRemoveNotification).not.toHaveBeenCalled();
        });
    });

    describe('notification object reference', () => {
        it('uses JSON.stringify for deep comparison', () => {
            const { rerender } = renderHook(
                ({ notification }) => useAutoNotification(true, notification),
                {
                    initialProps: {
                        notification: { type: 'info' as const, title: 'Test', message: 'Msg', read: false, createdAt: Date.now() }
                    }
                }
            );

            expect(mockAddNotification).toHaveBeenCalledTimes(1);

            // Rerender with identical content but new object reference
            rerender({
                notification: { type: 'info' as const, title: 'Test', message: 'Msg', read: false, createdAt: Date.now() }
            });

            // Should not add again due to JSON comparison
            expect(mockAddNotification).toHaveBeenCalledTimes(1);
        });
    });
});
