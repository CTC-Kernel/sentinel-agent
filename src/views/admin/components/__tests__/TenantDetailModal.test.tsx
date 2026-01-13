/**
 * TenantDetailModal Component Tests
 * Story 14-1: Test Coverage 50%
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TenantDetailModal } from '../TenantDetailModal';
import { Organization } from '../../../../types';

// Mock AdminService
const mockGetTenantStats = vi.fn();
const mockToggleTenantStatus = vi.fn();
const mockUpdateTenantSubscription = vi.fn();

vi.mock('../../../../services/adminService', () => ({
    AdminService: {
        getTenantStats: () => mockGetTenantStats(),
        toggleTenantStatus: (...args: unknown[]) => mockToggleTenantStatus(...args),
        updateTenantSubscription: (...args: unknown[]) => mockUpdateTenantSubscription(...args),
    },
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('../../../../lib/toast', () => ({
    toast: {
        success: (msg: string) => mockToastSuccess(msg),
        error: (msg: string) => mockToastError(msg),
    },
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    X: () => <span data-testid="icon-x" />,
    Users: () => <span data-testid="icon-users" />,
    Database: () => <span data-testid="icon-database" />,
    Shield: () => <span data-testid="icon-shield" />,
    AlertTriangle: () => <span data-testid="icon-alert" />,
    CreditCard: () => <span data-testid="icon-credit" />,
    Save: () => <span data-testid="icon-save" />,
}));

// Mock HeadlessUI with compound components properly
vi.mock('@headlessui/react', () => {
    // Dialog compound component
    const Dialog = ({ children, onClose }: { children: React.ReactNode; onClose: () => void; className?: string }) => (
        <div data-testid="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}>
            {children}
        </div>
    );
    Dialog.Panel = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog-panel">{children}</div>
    );
    Dialog.Title = ({ children }: { children: React.ReactNode }) => (
        <h2 data-testid="dialog-title">{children}</h2>
    );

    // Transition compound component
    const Transition = ({ show, children }: { show: boolean; children: React.ReactNode }) => (
        show ? <div data-testid="transition">{children}</div> : null
    );
    Transition.Child = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="transition-child">{children}</div>
    );

    // Tab compound component
    const Tab = ({ children, className }: { children: React.ReactNode; className?: unknown }) => (
        <button data-testid="tab" role="tab" className={typeof className === 'function' ? className({ selected: false }) : className}>
            {children}
        </button>
    );
    Tab.Group = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="tab-group">{children}</div>
    );
    Tab.List = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="tab-list" role="tablist">{children}</div>
    );
    Tab.Panels = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="tab-panels">{children}</div>
    );
    Tab.Panel = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="tab-panel" role="tabpanel">{children}</div>
    );

    return { Dialog, Transition, Tab };
});

describe('TenantDetailModal', () => {
    const mockTenant: Organization = {
        id: 'tenant-123',
        name: 'Acme Corporation',
        isActive: true,
        createdAt: Date.now(),
        subscription: {
            planId: 'professional',
            customLimits: {
                maxUsers: 10,
                maxProjects: 5,
            },
        },
    } as Organization;

    const mockOnClose = vi.fn();
    const mockOnUpdate = vi.fn();

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        tenant: mockTenant,
        onUpdate: mockOnUpdate,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetTenantStats.mockResolvedValue({
            userCount: 8,
            projectCount: 3,
            storageUsedBytes: 0,
        });
        mockToggleTenantStatus.mockResolvedValue(undefined);
        mockUpdateTenantSubscription.mockResolvedValue(undefined);
        // Mock window.confirm
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    describe('Rendering', () => {
        it('should not render when isOpen is false', () => {
            render(<TenantDetailModal {...defaultProps} isOpen={false} />);
            expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
        });

        it('should not render when tenant is null', () => {
            render(<TenantDetailModal {...defaultProps} tenant={null} />);
            expect(screen.queryByTestId('dialog-title')).not.toBeInTheDocument();
        });

        it('should render when isOpen is true and tenant exists', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByTestId('dialog')).toBeInTheDocument();
        });

        it('should display tenant name in title', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        });

        it('should display tenant ID', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('tenant-123')).toBeInTheDocument();
        });

        it('should display Active status for active tenant', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Active')).toBeInTheDocument();
        });

        it('should display Suspended status for inactive tenant', () => {
            const inactiveTenant = { ...mockTenant, isActive: false };
            render(<TenantDetailModal {...defaultProps} tenant={inactiveTenant} />);
            expect(screen.getByText('Suspended')).toBeInTheDocument();
        });

        it('should display tenant initials avatar', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('AC')).toBeInTheDocument();
        });
    });

    describe('Stats Loading', () => {
        it('should load stats when modal opens', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            await waitFor(() => {
                expect(mockGetTenantStats).toHaveBeenCalled();
            });
        });

        it('should display user count from stats', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('8')).toBeInTheDocument();
            });
        });

        it('should display project count from stats', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('3')).toBeInTheDocument();
            });
        });

        it('should handle stats loading error', async () => {
            mockGetTenantStats.mockRejectedValue(new Error('Load failed'));

            render(<TenantDetailModal {...defaultProps} />);

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith('Failed to load stats');
            });
        });
    });

    describe('Toggle Status', () => {
        it('should show Suspend button for active tenant', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Suspend')).toBeInTheDocument();
        });

        it('should show Activate button for suspended tenant', () => {
            const inactiveTenant = { ...mockTenant, isActive: false };
            render(<TenantDetailModal {...defaultProps} tenant={inactiveTenant} />);
            expect(screen.getByText('Activate')).toBeInTheDocument();
        });

        it('should call toggleTenantStatus when suspend button clicked', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const suspendButton = screen.getByText('Suspend');
            fireEvent.click(suspendButton);

            await waitFor(() => {
                expect(mockToggleTenantStatus).toHaveBeenCalledWith('tenant-123', false);
            });
        });

        it('should show success toast after status toggle', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const suspendButton = screen.getByText('Suspend');
            fireEvent.click(suspendButton);

            await waitFor(() => {
                expect(mockToastSuccess).toHaveBeenCalledWith('Tenant suspended successfully');
            });
        });

        it('should call onUpdate after status toggle', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const suspendButton = screen.getByText('Suspend');
            fireEvent.click(suspendButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalled();
            });
        });

        it('should call onClose after status toggle', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const suspendButton = screen.getByText('Suspend');
            fireEvent.click(suspendButton);

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should not toggle if user cancels confirmation', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            render(<TenantDetailModal {...defaultProps} />);

            const suspendButton = screen.getByText('Suspend');
            fireEvent.click(suspendButton);

            expect(mockToggleTenantStatus).not.toHaveBeenCalled();
        });

        it('should handle toggle error', async () => {
            mockToggleTenantStatus.mockRejectedValue(new Error('Toggle failed'));

            render(<TenantDetailModal {...defaultProps} />);

            const suspendButton = screen.getByText('Suspend');
            fireEvent.click(suspendButton);

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith('Status update failed');
            });
        });
    });

    describe('Subscription Form', () => {
        it('should display plan selector label', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Current Plan')).toBeInTheDocument();
        });

        it('should display max users label', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Max Users')).toBeInTheDocument();
        });

        it('should display max projects label', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Max Projects')).toBeInTheDocument();
        });

        it('should initialize form with tenant subscription values', () => {
            render(<TenantDetailModal {...defaultProps} />);

            // Find by role - there's one select (plan) and two number inputs
            const selects = screen.getAllByRole('combobox');
            expect(selects.length).toBeGreaterThanOrEqual(1);
            expect((selects[0] as HTMLSelectElement).value).toBe('professional');

            // Number inputs
            const numberInputs = screen.getAllByRole('spinbutton');
            expect(numberInputs.length).toBe(2);
            expect((numberInputs[0] as HTMLInputElement).value).toBe('10');
            expect((numberInputs[1] as HTMLInputElement).value).toBe('5');
        });

        it('should update plan when changed', () => {
            render(<TenantDetailModal {...defaultProps} />);

            const planSelect = screen.getAllByRole('combobox')[0];
            fireEvent.change(planSelect, { target: { value: 'enterprise' } });

            expect((planSelect as HTMLSelectElement).value).toBe('enterprise');
        });

        it('should update max users when changed', () => {
            render(<TenantDetailModal {...defaultProps} />);

            const numberInputs = screen.getAllByRole('spinbutton');
            const maxUsersInput = numberInputs[0];
            fireEvent.change(maxUsersInput, { target: { value: '20' } });

            expect((maxUsersInput as HTMLInputElement).value).toBe('20');
        });

        it('should save subscription when save button clicked', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const saveButton = screen.getByText('Save Changes');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockUpdateTenantSubscription).toHaveBeenCalledWith(
                    'tenant-123',
                    'professional',
                    { maxUsers: 10, maxProjects: 5 }
                );
            });
        });

        it('should show success toast after saving subscription', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const saveButton = screen.getByText('Save Changes');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockToastSuccess).toHaveBeenCalledWith('Subscription updated successfully');
            });
        });

        it('should call onUpdate after saving subscription', async () => {
            render(<TenantDetailModal {...defaultProps} />);

            const saveButton = screen.getByText('Save Changes');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalled();
            });
        });

        it('should handle subscription save error', async () => {
            mockUpdateTenantSubscription.mockRejectedValue(new Error('Update failed'));

            render(<TenantDetailModal {...defaultProps} />);

            const saveButton = screen.getByText('Save Changes');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith('Update failed');
            });
        });
    });

    describe('Close Button', () => {
        it('should render close button', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByTestId('icon-x')).toBeInTheDocument();
        });
    });

    describe('Tabs', () => {
        it('should render Overview tab', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Overview')).toBeInTheDocument();
        });

        it('should render Subscription tab', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Subscription')).toBeInTheDocument();
        });
    });

    describe('Danger Zone', () => {
        it('should display danger zone section', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Danger Zone')).toBeInTheDocument();
        });

        it('should display suspend organization text', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Suspend Organization')).toBeInTheDocument();
        });

        it('should display warning text', () => {
            render(<TenantDetailModal {...defaultProps} />);
            expect(screen.getByText('Stop all access immediately.')).toBeInTheDocument();
        });
    });

    describe('Default values', () => {
        it('should use default values when customLimits are missing', () => {
            const tenantWithoutLimits = {
                ...mockTenant,
                subscription: {
                    planId: 'discovery',
                    customLimits: undefined,
                },
            } as unknown as Organization;

            render(<TenantDetailModal {...defaultProps} tenant={tenantWithoutLimits} />);

            // Number inputs - default values
            const numberInputs = screen.getAllByRole('spinbutton');
            expect(numberInputs.length).toBe(2);
            expect((numberInputs[0] as HTMLInputElement).value).toBe('5'); // Default maxUsers
            expect((numberInputs[1] as HTMLInputElement).value).toBe('1'); // Default maxProjects
        });
    });
});
