/**
 * FrameworkSettings Component Tests
 * Story 4.1: Framework Activation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameworkSettings } from '../FrameworkSettings';
import { useStore } from '../../../store';
import { useSettingsData } from '../../../hooks/settings/useSettingsData';
import { hasPermission } from '../../../utils/permissions';

// Mock dependencies
vi.mock('../../../store', () => ({
    useStore: vi.fn(),
}));

vi.mock('../../../hooks/settings/useSettingsData', () => ({
    useSettingsData: vi.fn(),
}));

vi.mock('../../../utils/permissions', () => ({
    hasPermission: vi.fn(),
}));

vi.mock('../../../services/logger', () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn(),
        error: vi.fn(),
    },
}));

describe('FrameworkSettings', () => {
    const mockUser = {
        uid: 'test-user',
        organizationId: 'test-org',
        role: 'admin',
    };

    const mockOrganization = {
        id: 'test-org',
        name: 'Test Organization',
        subscription: {
            planId: 'professional',
            status: 'active',
        },
        enabledFrameworks: ['ISO27001'],
    };

    const mockUpdateOrganization = vi.fn().mockResolvedValue(undefined);
    const mockAddToast = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            addToast: mockAddToast,
            t: (key: string) => key,
        } as ReturnType<typeof useStore>);

        vi.mocked(useSettingsData).mockReturnValue({
            organization: mockOrganization,
            updateOrganization: mockUpdateOrganization,
            users: [],
            integrations: [],
            activityLogs: [],
            loading: false,
            updateUser: vi.fn(),
            batchUpdateOrgUsers: vi.fn(),
        });

        vi.mocked(hasPermission).mockReturnValue(true);
    });

    it('should render framework settings header', () => {
        render(<FrameworkSettings />);

        expect(screen.getByText('settings.frameworksTitle')).toBeInTheDocument();
        expect(screen.getByText('settings.frameworksDescription')).toBeInTheDocument();
    });

    it('should display framework count badge', () => {
        render(<FrameworkSettings />);

        expect(screen.getByText('1 / 6')).toBeInTheDocument();
    });

    it('should show all framework categories', () => {
        render(<FrameworkSettings />);

        expect(screen.getByText('Conformité')).toBeInTheDocument();
        expect(screen.getByText('Gestion des Risques')).toBeInTheDocument();
        expect(screen.getByText('Gouvernance')).toBeInTheDocument();
    });

    it('should display all available frameworks', () => {
        render(<FrameworkSettings />);

        // Check some key frameworks are displayed
        expect(screen.getByText('ISO27001')).toBeInTheDocument();
        expect(screen.getByText('NIS2')).toBeInTheDocument();
        expect(screen.getByText('DORA')).toBeInTheDocument();
        expect(screen.getByText('GDPR')).toBeInTheDocument();
    });

    it('should show pre-selected frameworks from organization', () => {
        render(<FrameworkSettings />);

        // Find button by text content instead of aria-label
        const iso27001Button = screen.getByRole('button', { name: /Désactiver ISO 27001/i });
        expect(iso27001Button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should toggle framework selection when clicked', async () => {
        render(<FrameworkSettings />);

        const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
        expect(nis2Button).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(nis2Button);

        await waitFor(() => {
            expect(nis2Button).toHaveAttribute('aria-pressed', 'true');
        });
    });

    it('should enable save button when changes are made', async () => {
        render(<FrameworkSettings />);

        const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
        expect(saveButton).toBeDisabled();

        // Toggle a framework
        const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
        fireEvent.click(nis2Button);

        await waitFor(() => {
            expect(saveButton).not.toBeDisabled();
        });
    });

    it('should show cancel button when changes are made', async () => {
        render(<FrameworkSettings />);

        expect(screen.queryByRole('button', { name: /Annuler/i })).not.toBeInTheDocument();

        // Toggle a framework
        const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
        fireEvent.click(nis2Button);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument();
        });
    });

    it('should reset selection when cancel is clicked', async () => {
        render(<FrameworkSettings />);

        // Toggle frameworks
        const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
        fireEvent.click(nis2Button);

        await waitFor(() => {
            expect(nis2Button).toHaveAttribute('aria-pressed', 'true');
        });

        // Click cancel
        const cancelButton = screen.getByRole('button', { name: /Annuler/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(nis2Button).toHaveAttribute('aria-pressed', 'false');
        });
    });

    it('should call updateOrganization when save is clicked', async () => {
        render(<FrameworkSettings />);

        // Toggle a framework
        const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
        fireEvent.click(nis2Button);

        // Click save
        const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockUpdateOrganization).toHaveBeenCalledWith({
                enabledFrameworks: expect.arrayContaining(['ISO27001', 'NIS2']),
            });
        });
    });

    it('should show success toast after saving', async () => {
        render(<FrameworkSettings />);

        // Toggle a framework
        const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
        fireEvent.click(nis2Button);

        // Click save
        const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });
    });

    describe('Plan limits', () => {
        it('should enforce discovery plan limit of 1 framework', () => {
            vi.mocked(useSettingsData).mockReturnValue({
                organization: {
                    ...mockOrganization,
                    subscription: { planId: 'discovery', status: 'active' },
                    enabledFrameworks: ['ISO27001'],
                },
                updateOrganization: mockUpdateOrganization,
                users: [],
                integrations: [],
                activityLogs: [],
                loading: false,
                updateUser: vi.fn(),
                batchUpdateOrgUsers: vi.fn(),
            });

            render(<FrameworkSettings />);

            // Should show 1/1 limit
            expect(screen.getByText('1 / 1')).toBeInTheDocument();

            // Other framework buttons should be disabled when at limit
            const nis2Button = screen.getByRole('button', { name: /Activer NIS 2/i });
            expect(nis2Button).toBeDisabled();
        });

        it('should show limit warning when at max frameworks', () => {
            vi.mocked(useSettingsData).mockReturnValue({
                organization: {
                    ...mockOrganization,
                    subscription: { planId: 'discovery', status: 'active' },
                    enabledFrameworks: ['ISO27001'],
                },
                updateOrganization: mockUpdateOrganization,
                users: [],
                integrations: [],
                activityLogs: [],
                loading: false,
                updateUser: vi.fn(),
                batchUpdateOrgUsers: vi.fn(),
            });

            render(<FrameworkSettings />);

            expect(screen.getByText('Limite atteinte')).toBeInTheDocument();
        });

        it('should allow unlimited frameworks for enterprise plan', () => {
            vi.mocked(useSettingsData).mockReturnValue({
                organization: {
                    ...mockOrganization,
                    subscription: { planId: 'enterprise', status: 'active' },
                    enabledFrameworks: ['ISO27001', 'NIS2', 'DORA'],
                },
                updateOrganization: mockUpdateOrganization,
                users: [],
                integrations: [],
                activityLogs: [],
                loading: false,
                updateUser: vi.fn(),
                batchUpdateOrgUsers: vi.fn(),
            });

            render(<FrameworkSettings />);

            // Should show unlimited symbol
            expect(screen.getByText(/3 \/ ∞/)).toBeInTheDocument();

            // Should not show limit warning
            expect(screen.queryByText('Limite atteinte')).not.toBeInTheDocument();
        });
    });

    describe('Permission handling', () => {
        it('should show access denied message when user lacks permission', () => {
            vi.mocked(hasPermission).mockReturnValue(false);

            render(<FrameworkSettings />);

            expect(screen.getByText('Accès restreint')).toBeInTheDocument();
            expect(screen.queryByText('settings.frameworksTitle')).not.toBeInTheDocument();
        });
    });

    describe('Deselection', () => {
        it('should allow deselecting a framework', async () => {
            render(<FrameworkSettings />);

            // ISO27001 is pre-selected - find it by the Désactiver label
            const iso27001Button = screen.getByRole('button', { name: /Désactiver ISO 27001/i });
            expect(iso27001Button).toHaveAttribute('aria-pressed', 'true');

            // Click to deselect
            fireEvent.click(iso27001Button);

            await waitFor(() => {
                expect(iso27001Button).toHaveAttribute('aria-pressed', 'false');
            });
        });
    });
});
