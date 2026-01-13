/**
 * TenantList Component Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TenantList } from '../TenantList';

// Mock Firestore
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    getDocs: () => mockGetDocs(),
    orderBy: vi.fn(),
    limit: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../../../firebase', () => ({
    db: {},
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

// Mock TenantDetailModal
vi.mock('../TenantDetailModal', () => ({
    TenantDetailModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
        isOpen ? (
            <div data-testid="tenant-modal">
                <button onClick={onClose}>Close</button>
            </div>
        ) : null
    ),
}));

describe('TenantList', () => {
    const mockTenants = [
        {
            id: 'tenant-1',
            name: 'Acme Corp',
            isActive: true,
            createdAt: new Date('2025-06-01').getTime(),
            subscription: { planId: 'professional' },
        },
        {
            id: 'tenant-2',
            name: 'TechStart',
            isActive: true,
            createdAt: new Date('2026-01-01').getTime(),
            subscription: { planId: 'discovery' },
        },
        {
            id: 'tenant-3',
            name: 'Enterprise Inc',
            isActive: false,
            createdAt: new Date('2024-01-01').getTime(),
            subscription: { planId: 'enterprise' },
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocs.mockResolvedValue({
            docs: mockTenants.map(tenant => ({
                id: tenant.id,
                data: () => tenant,
            })),
        });
    });

    describe('Rendering', () => {
        it('should render loading state initially', () => {
            // Mock a slow response to see loading state
            mockGetDocs.mockImplementation(() => new Promise(() => {}));

            render(<TenantList />);

            // Loading skeleton should be present
            const loadingElements = document.querySelectorAll('.animate-pulse');
            expect(loadingElements.length).toBeGreaterThan(0);
        });

        it('should render tenants after loading', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
                expect(screen.getByText('TechStart')).toBeInTheDocument();
                expect(screen.getByText('Enterprise Inc')).toBeInTheDocument();
            });
        });

        it('should render table headers', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Organization')).toBeInTheDocument();
                expect(screen.getByText('ID')).toBeInTheDocument();
                expect(screen.getByText('Status')).toBeInTheDocument();
                expect(screen.getByText('Created')).toBeInTheDocument();
                expect(screen.getByText('Actions')).toBeInTheDocument();
            });
        });

        it('should display tenant status badges', async () => {
            render(<TenantList />);

            await waitFor(() => {
                const activeElements = screen.getAllByText('Active');
                expect(activeElements.length).toBe(2);
                expect(screen.getByText('Suspended')).toBeInTheDocument();
            });
        });

        it('should display plan types', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Professional')).toBeInTheDocument();
                expect(screen.getByText('Discovery')).toBeInTheDocument();
                expect(screen.getByText('Enterprise')).toBeInTheDocument();
            });
        });
    });

    describe('Search Functionality', () => {
        it('should have a search input', async () => {
            render(<TenantList />);

            await waitFor(() => {
                const searchInput = screen.getByPlaceholderText('Search tenants...');
                expect(searchInput).toBeInTheDocument();
            });
        });

        it('should filter tenants by name', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search tenants...');
            fireEvent.change(searchInput, { target: { value: 'Tech' } });

            await waitFor(() => {
                expect(screen.getByText('TechStart')).toBeInTheDocument();
                expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
            });
        });

        it('should filter tenants by ID', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search tenants...');
            fireEvent.change(searchInput, { target: { value: 'tenant-2' } });

            await waitFor(() => {
                expect(screen.getByText('TechStart')).toBeInTheDocument();
                expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
            });
        });

        it('should show empty message when no results match', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search tenants...');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            await waitFor(() => {
                expect(screen.getByText('No tenants found matching your search.')).toBeInTheDocument();
            });
        });
    });

    describe('Controls', () => {
        it('should have Filter button', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Filter/i })).toBeInTheDocument();
            });
        });

        it('should have Add Tenant button', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Add Tenant' })).toBeInTheDocument();
            });
        });
    });

    describe('Tenant Selection', () => {
        it('should open modal when clicking on tenant row', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            });

            const row = screen.getByText('Acme Corp').closest('tr');
            fireEvent.click(row!);

            await waitFor(() => {
                expect(screen.getByTestId('tenant-modal')).toBeInTheDocument();
            });
        });

        it('should close modal when close button is clicked', async () => {
            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            });

            const row = screen.getByText('Acme Corp').closest('tr');
            fireEvent.click(row!);

            await waitFor(() => {
                expect(screen.getByTestId('tenant-modal')).toBeInTheDocument();
            });

            const closeButton = screen.getByText('Close');
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByTestId('tenant-modal')).not.toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const { ErrorLogger } = await import('../../../../services/errorLogger');
            mockGetDocs.mockRejectedValueOnce(new Error('API Error'));

            render(<TenantList />);

            await waitFor(() => {
                expect(ErrorLogger.error).toHaveBeenCalledWith(
                    expect.any(Error),
                    'TenantList.fetchTenants'
                );
            });
        });
    });

    describe('Empty State', () => {
        it('should show empty message when no tenants exist', async () => {
            mockGetDocs.mockResolvedValueOnce({ docs: [] });

            render(<TenantList />);

            await waitFor(() => {
                expect(screen.getByText('No tenants found matching your search.')).toBeInTheDocument();
            });
        });
    });
});
