/**
 * Unit tests for DashboardHeader component
 * Tests dashboard header display and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHeader } from '../DashboardHeader';

// Mock framer-motion - create a handler that returns a passthrough component for any element
vi.mock('framer-motion', async () => {
    const React = await import('react');

    const createMotionComponent = (element: string) => {
        return ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
            // Filter out framer-motion specific props
            const { initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, variants: _variants, ...htmlProps } = props;
            return React.createElement(element, htmlProps, children);
        };
    };

    return {
        motion: new Proxy({}, {
            get: (_target, prop: string) => createMotionComponent(prop)
        }),
        AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
    };
});

// Mock Icons - use importOriginal to include all icons
vi.mock('../../../ui/Icons', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../ui/Icons')>();
    return {
        ...actual,
        // Override specific icons for testing if needed
        Loader2: () => <span data-testid="loader-icon" />
    };
});

// Mock ShinyText
vi.mock('../../../ui/ShinyText', () => ({
    ShinyText: ({ children }: { children: React.ReactNode }) => <span data-testid="shiny-text">{children}</span>
}));

// Mock Tooltip
vi.mock('../../../ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock PremiumCard
vi.mock('../../../ui/PremiumCard', () => ({
    PremiumCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="glass-card" className={className}>{children}</div>
    )
}));

// Mock Aceternity UI components
vi.mock('../../../ui/aceternity/Spotlight', () => ({
    Spotlight: () => null
}));

vi.mock('../../../ui/aceternity/BorderBeam', () => ({
    BorderBeam: () => null
}));

vi.mock('../../../ui/aceternity/Sparkles.tsx', () => ({
    SparklesCore: () => null
}));

describe('DashboardHeader', () => {
    const mockNavigate = vi.fn();
    const mockGenerateICal = vi.fn();
    const mockGenerateExecutiveReport = vi.fn();
    const mockOnToggleEdit = vi.fn();
    const mockOnShowGettingStarted = vi.fn();

    const mockT = vi.fn((key: string) => {
        const translations: Record<string, string> = {
            'sidebar.dashboard': 'Dashboard',
            'common.pilotage': 'Pilotage',
            'dashboard.allSystemsOperational': 'All systems operational',
            'dashboard.executiveReport': 'Executive Report',
            'dashboard.exportIcal': 'Export iCal',
            'dashboard.inviteTooltip': 'Invite team members',
            'dashboard.inviteMember': 'Invite',
            'dashboard.edit.customize': 'Customize',
            'dashboard.edit.finish': 'Finish',
            'dashboard.showGettingStarted': 'Show Getting Started',
            'dashboard.operationalSystem': 'Operational System',
            'dashboard.welcomeTitle_admin': 'Welcome back',
            'dashboard.welcomeSubtitle1_admin': 'Your security dashboard is ready',
            'dashboard.createAsset': 'Create Asset',
            'dashboard.createAssetDesc': 'Add new assets',
            'dashboard.createAssetDesc_rssi': 'Manage assets',
            'dashboard.configureControls': 'Configure Controls',
            'dashboard.configureControlsDesc': 'Set up compliance',
            'dashboard.addDocuments': 'Add Documents',
            'dashboard.addDocumentsDesc': 'Upload documents'
        };
        return translations[key] || key;
    });

    const mockUser = {
        role: 'admin' as const,
        displayName: 'John Doe',
        organizationName: 'Test Org'
    };

    const defaultProps = {
        user: mockUser,
        organizationName: 'Acme Corp',
        loading: false,
        navigate: mockNavigate,
        t: mockT,
        generateICal: mockGenerateICal,
        generateExecutiveReport: mockGenerateExecutiveReport
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('normal state', () => {
        it('renders organization name', () => {
            render(<DashboardHeader {...defaultProps} />);

            expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        });

        it('renders workspace label', () => {
            render(<DashboardHeader {...defaultProps} />);

            expect(screen.getByText('Pilotage')).toBeInTheDocument();
        });

        it('renders date', () => {
            render(<DashboardHeader {...defaultProps} />);

            // Check for any date element by querying all text elements
            // The component renders a date string somewhere in the header
            const container = document.body;
            expect(container.textContent).toMatch(/\d/);
        });

        it('renders all systems operational when no insight', () => {
            render(<DashboardHeader {...defaultProps} />);

            expect(screen.getByText('All systems operational')).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('renders empty state when isEmpty is true', () => {
            render(<DashboardHeader {...defaultProps} isEmpty={true} />);

            expect(screen.getByText('Create Asset')).toBeInTheDocument();
            expect(screen.getByText('Configure Controls')).toBeInTheDocument();
            expect(screen.getByText('Add Documents')).toBeInTheDocument();
        });

        it('renders shiny text with user name in empty state', () => {
            render(<DashboardHeader {...defaultProps} isEmpty={true} />);

            expect(screen.getByTestId('shiny-text')).toHaveTextContent('John Doe');
        });

        it('navigates when action card clicked', () => {
            render(<DashboardHeader {...defaultProps} isEmpty={true} />);

            fireEvent.click(screen.getByLabelText('Create Asset'));

            expect(mockNavigate).toHaveBeenCalledWith('/assets?action=create');
        });
    });

    describe('insight banner', () => {
        it('displays insight text when provided', () => {
            const propsWithInsight = {
                ...defaultProps,
                insight: {
                    type: 'warning',
                    text: '5 risks need attention',
                    details: 'Review your risk register',
                    link: '/risks'
                }
            };

            render(<DashboardHeader {...propsWithInsight} />);

            expect(screen.getByText('5 risks need attention')).toBeInTheDocument();
        });

        it('displays insight details', () => {
            const propsWithInsight = {
                ...defaultProps,
                insight: {
                    type: 'warning',
                    text: '5 risks need attention',
                    details: 'Review your risk register',
                    link: '/risks'
                }
            };

            render(<DashboardHeader {...propsWithInsight} />);

            expect(screen.getByText('Review your risk register')).toBeInTheDocument();
        });

        it('navigates when insight clicked', () => {
            const propsWithInsight = {
                ...defaultProps,
                insight: {
                    type: 'danger',
                    text: 'Critical alert',
                    link: '/incidents'
                }
            };

            render(<DashboardHeader {...propsWithInsight} />);

            fireEvent.click(screen.getByText('Critical alert'));

            expect(mockNavigate).toHaveBeenCalledWith('/incidents');
        });
    });

    describe('action buttons', () => {
        it('renders executive report button', () => {
            render(<DashboardHeader {...defaultProps} />);

            expect(screen.getByLabelText('Executive Report')).toBeInTheDocument();
        });

        it('calls generateExecutiveReport when clicked', () => {
            render(<DashboardHeader {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Executive Report'));

            expect(mockGenerateExecutiveReport).toHaveBeenCalled();
        });

        it('shows loader when generating report', () => {
            render(<DashboardHeader {...defaultProps} isGeneratingReport={true} />);

            expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
        });

        it('renders iCal export button', () => {
            render(<DashboardHeader {...defaultProps} />);

            expect(screen.getByLabelText('Export iCal')).toBeInTheDocument();
        });

        it('calls generateICal when clicked', () => {
            render(<DashboardHeader {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Export iCal'));

            expect(mockGenerateICal).toHaveBeenCalled();
        });
    });

    describe('admin features', () => {
        it('renders invite button for admin users (hidden on small screens)', () => {
            const { container } = render(<DashboardHeader {...defaultProps} />);

            // Button uses aria-label={t('dashboard.inviteMember')} which returns "Invite"
            const inviteButton = container.querySelector('[aria-label="Invite"]');
            expect(inviteButton).toBeInTheDocument();
        });

        it('navigates to team on invite click', () => {
            const { container } = render(<DashboardHeader {...defaultProps} />);

            const inviteButton = container.querySelector('[aria-label="Invite"]');
            if (inviteButton) fireEvent.click(inviteButton);

            expect(mockNavigate).toHaveBeenCalledWith('/team');
        });

        it('hides invite button for non-admin users', () => {
            const nonAdminUser = { ...mockUser, role: 'user' as const };
            const { container } = render(<DashboardHeader {...defaultProps} user={nonAdminUser} />);

            expect(container.querySelector('[aria-label="Invite"]')).not.toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        it('shows edit button when onToggleEdit provided', () => {
            render(<DashboardHeader {...defaultProps} onToggleEdit={mockOnToggleEdit} />);

            expect(screen.getByLabelText('Customize')).toBeInTheDocument();
        });

        it('calls onToggleEdit when clicked', () => {
            render(<DashboardHeader {...defaultProps} onToggleEdit={mockOnToggleEdit} />);

            fireEvent.click(screen.getByLabelText('Customize'));

            expect(mockOnToggleEdit).toHaveBeenCalled();
        });

        it('shows finish label when editing', () => {
            render(<DashboardHeader {...defaultProps} onToggleEdit={mockOnToggleEdit} isEditing={true} />);

            expect(screen.getByLabelText('Finish')).toBeInTheDocument();
        });
    });

    describe('getting started', () => {
        it('shows getting started button when closed', () => {
            render(
                <DashboardHeader
                    {...defaultProps}
                    onShowGettingStarted={mockOnShowGettingStarted}
                    isGettingStartedClosed={true}
                />
            );

            expect(screen.getByLabelText('Show Getting Started')).toBeInTheDocument();
        });

        it('calls onShowGettingStarted when clicked', () => {
            render(
                <DashboardHeader
                    {...defaultProps}
                    onShowGettingStarted={mockOnShowGettingStarted}
                    isGettingStartedClosed={true}
                />
            );

            fireEvent.click(screen.getByLabelText('Show Getting Started'));

            expect(mockOnShowGettingStarted).toHaveBeenCalled();
        });

        it('hides getting started button when not closed', () => {
            render(
                <DashboardHeader
                    {...defaultProps}
                    onShowGettingStarted={mockOnShowGettingStarted}
                    isGettingStartedClosed={false}
                />
            );

            expect(screen.queryByLabelText('Show Getting Started')).not.toBeInTheDocument();
        });
    });

    describe('loading state', () => {
        it('does not show empty state when loading', () => {
            render(<DashboardHeader {...defaultProps} isEmpty={true} loading={true} />);

            expect(screen.queryByText('Create Asset')).not.toBeInTheDocument();
        });
    });
});
