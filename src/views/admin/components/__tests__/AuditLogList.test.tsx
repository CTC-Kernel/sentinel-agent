/**
 * AuditLogList Component Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditLogList } from '../AuditLogList';

// Create mock functions
const mockGetAuditLogs = vi.fn();
const mockErrorLoggerError = vi.fn();

// Mock AdminService
vi.mock('../../../../services/adminService', () => ({
    AdminService: {
        getAuditLogs: () => mockGetAuditLogs(),
    },
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: (...args: unknown[]) => mockErrorLoggerError(...args),
    },
}));

// Mock URL and Blob for export functionality
const mockRevokeObjectURL = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');

global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

const mockLogs = [
    {
        id: 'log-1',
        timestamp: new Date('2026-01-10T10:00:00').getTime(),
        actorId: 'user-1',
        actorEmail: 'admin@example.com',
        action: 'CREATE_USER',
        targetId: 'target-123',
        metadata: { role: 'user' },
    },
    {
        id: 'log-2',
        timestamp: new Date('2026-01-10T11:00:00').getTime(),
        actorId: 'user-2',
        actorEmail: 'manager@example.com',
        action: 'UPDATE_SETTINGS',
        targetId: 'org-456',
        metadata: { field: 'name' },
    },
    {
        id: 'log-3',
        timestamp: new Date('2026-01-10T12:00:00').getTime(),
        actorId: 'user-1',
        actorEmail: 'admin@example.com',
        action: 'DELETE_DOCUMENT',
        targetId: 'doc-789',
        metadata: {},
    },
    {
        id: 'log-4',
        timestamp: new Date('2026-01-10T13:00:00').getTime(),
        actorId: 'user-3',
        actorEmail: 'support@example.com',
        action: 'SUSPEND_USER',
        targetId: 'user-suspended',
        metadata: { reason: 'violation' },
    },
    {
        id: 'log-5',
        timestamp: new Date('2026-01-10T14:00:00').getTime(),
        actorId: 'user-1',
        actorEmail: 'admin@example.com',
        action: 'ACTIVATE_FEATURE',
        targetId: 'feature-123',
        metadata: {},
    },
];

describe('AuditLogList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default successful response
        mockGetAuditLogs.mockResolvedValue(mockLogs);
    });

    describe('Rendering', () => {
        it('should render the search input', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search logs (Actor, Action, ID)...')).toBeInTheDocument();
            });
        });

        it('should render table headers', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByText('Timestamp')).toBeInTheDocument();
                expect(screen.getByText('Actor')).toBeInTheDocument();
                expect(screen.getByText('Action')).toBeInTheDocument();
                expect(screen.getByText('Target ID')).toBeInTheDocument();
                expect(screen.getByText('Details')).toBeInTheDocument();
            });
        });

        it('should show loading skeleton initially', () => {
            render(<AuditLogList />);

            // Loading skeletons should be present
            const loadingRows = document.querySelectorAll('.animate-pulse');
            expect(loadingRows.length).toBeGreaterThan(0);
        });

        it('should display audit logs after loading', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                // admin@example.com appears 3 times in mock data
                expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
                expect(screen.getByText('manager@example.com')).toBeInTheDocument();
            });
        });

        it('should display action badges', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByText('CREATE_USER')).toBeInTheDocument();
                expect(screen.getByText('UPDATE_SETTINGS')).toBeInTheDocument();
                expect(screen.getByText('DELETE_DOCUMENT')).toBeInTheDocument();
            });
        });

        it('should display target IDs', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByText('target-123')).toBeInTheDocument();
                expect(screen.getByText('org-456')).toBeInTheDocument();
            });
        });
    });

    describe('Search Functionality', () => {
        it('should filter logs by actor email', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
            });

            const searchInput = screen.getByPlaceholderText('Search logs (Actor, Action, ID)...');
            fireEvent.change(searchInput, { target: { value: 'manager' } });

            await waitFor(() => {
                expect(screen.getByText('manager@example.com')).toBeInTheDocument();
                expect(screen.queryAllByText('admin@example.com').length).toBe(0);
            });
        });

        it('should filter logs by action', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByText('CREATE_USER')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search logs (Actor, Action, ID)...');
            fireEvent.change(searchInput, { target: { value: 'DELETE' } });

            await waitFor(() => {
                expect(screen.getByText('DELETE_DOCUMENT')).toBeInTheDocument();
                expect(screen.queryByText('CREATE_USER')).not.toBeInTheDocument();
            });
        });

        it('should filter logs by target ID', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByText('target-123')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search logs (Actor, Action, ID)...');
            fireEvent.change(searchInput, { target: { value: 'org-456' } });

            await waitFor(() => {
                expect(screen.getByText('org-456')).toBeInTheDocument();
                expect(screen.queryByText('target-123')).not.toBeInTheDocument();
            });
        });

        it('should show empty state when no results match', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
            });

            const searchInput = screen.getByPlaceholderText('Search logs (Actor, Action, ID)...');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            await waitFor(() => {
                expect(screen.getByText('No audit logs found.')).toBeInTheDocument();
            });
        });
    });

    describe('Export Functionality', () => {
        it('should have an export button', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const exportButton = screen.getByTitle('Export CSV');
                expect(exportButton).toBeInTheDocument();
            });
        });

        it('should export logs as CSV when button is clicked', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
            });

            const exportButton = screen.getByTitle('Export CSV');
            fireEvent.click(exportButton);

            expect(mockCreateObjectURL).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalled();
        });
    });

    describe('Refresh Functionality', () => {
        it('should have a refresh button', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const refreshButton = screen.getByTitle('Refresh');
                expect(refreshButton).toBeInTheDocument();
            });
        });

        it('should reload logs when refresh button is clicked', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                expect(mockGetAuditLogs).toHaveBeenCalledTimes(1);
            });

            const refreshButton = screen.getByTitle('Refresh');
            fireEvent.click(refreshButton);

            await waitFor(() => {
                expect(mockGetAuditLogs).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Action Colors', () => {
        it('should apply correct color class for CREATE actions', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const createBadge = screen.getByText('CREATE_USER');
                expect(createBadge).toHaveClass('text-emerald-400');
            });
        });

        it('should apply correct color class for DELETE actions', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const deleteBadge = screen.getByText('DELETE_DOCUMENT');
                expect(deleteBadge).toHaveClass('text-red-400');
            });
        });

        it('should apply correct color class for UPDATE actions', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const updateBadge = screen.getByText('UPDATE_SETTINGS');
                expect(updateBadge).toHaveClass('text-blue-400');
            });
        });

        it('should apply correct color class for SUSPEND actions', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const suspendBadge = screen.getByText('SUSPEND_USER');
                expect(suspendBadge).toHaveClass('text-red-400');
            });
        });

        it('should apply correct color class for ACTIVATE actions', async () => {
            render(<AuditLogList />);

            await waitFor(() => {
                const activateBadge = screen.getByText('ACTIVATE_FEATURE');
                expect(activateBadge).toHaveClass('text-emerald-400');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            mockGetAuditLogs.mockRejectedValueOnce(new Error('API Error'));

            render(<AuditLogList />);

            await waitFor(() => {
                expect(mockErrorLoggerError).toHaveBeenCalledWith(expect.any(Error), 'AuditLogList.fetchLogs');
            });
        });
    });

    describe('Empty State', () => {
        it('should show empty message when no logs exist', async () => {
            mockGetAuditLogs.mockResolvedValueOnce([]);

            render(<AuditLogList />);

            await waitFor(() => {
                expect(screen.getByText('No audit logs found.')).toBeInTheDocument();
            });
        });
    });
});
