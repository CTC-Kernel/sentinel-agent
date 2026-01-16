/**
 * Unit tests for PriorityRisksWidget component
 * Tests priority risks display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriorityRisksWidget } from '../PriorityRisksWidget';
import { Risk } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    Flame: () => <span data-testid="flame-icon" />,
    ShieldAlert: () => <span data-testid="shield-alert-icon" />
}));

// Mock Skeleton
vi.mock('../../../ui/Skeleton', () => ({
    Skeleton: ({ className }: { className?: string }) => (
        <div data-testid="skeleton" className={className} />
    )
}));

// Mock DashboardCard
vi.mock('../../DashboardCard', () => ({
    DashboardCard: ({ children, title, subtitle, onToggleExpand, isExpanded }: {
        children: React.ReactNode;
        title: string;
        subtitle: string;
        onToggleExpand?: () => void;
        isExpanded?: boolean;
    }) => (
        <div data-testid="dashboard-card">
            <h3>{title}</h3>
            <p>{subtitle}</p>
            {onToggleExpand && (
                <button data-testid="expand-btn" onClick={onToggleExpand}>
                    {isExpanded ? 'Collapse' : 'Expand'}
                </button>
            )}
            {children}
        </div>
    )
}));

// Mock EmptyState
vi.mock('../../../ui/EmptyState', () => ({
    EmptyState: ({ title, description }: { title: string; description: string }) => (
        <div data-testid="empty-state">
            <h4>{title}</h4>
            <p>{description}</p>
        </div>
    )
}));

describe('PriorityRisksWidget', () => {
    const mockNavigate = vi.fn();
    const mockT = vi.fn((key: string) => {
        const translations: Record<string, string> = {
            'dashboard.priorityRisks': 'Risques Prioritaires',
            'dashboard.topCriticality': 'Top criticité',
            'dashboard.noCriticalRisks': 'Aucun risque critique',
            'dashboard.allClear': 'Tout est sous contrôle',
            'common.more': 'plus'
        };
        return translations[key] || key;
    });

    const mockRisks: Risk[] = [
        {
            id: 'risk-1',
            organizationId: 'org-1',
            assetId: 'asset-1',
            threat: 'Ransomware Attack',
            vulnerability: 'Outdated systems',
            score: 25,
            probability: 5,
            impact: 5,
            status: 'En cours',
            strategy: 'Atténuer',
            owner: 'user-1'
        },
        {
            id: 'risk-2',
            organizationId: 'org-1',
            assetId: 'asset-1',
            threat: 'Data Breach',
            vulnerability: 'Weak access controls',
            score: 20,
            probability: 4,
            impact: 5,
            status: 'Ouvert',
            strategy: 'Transférer',
            owner: 'user-1'
        },
        {
            id: 'risk-3',
            organizationId: 'org-1',
            assetId: 'asset-1',
            threat: 'DDoS Attack',
            vulnerability: 'No rate limiting',
            score: 16,
            probability: 4,
            impact: 4,
            status: 'En cours',
            strategy: 'Atténuer',
            owner: 'user-1'
        },
        {
            id: 'risk-4',
            organizationId: 'org-1',
            assetId: 'asset-1',
            threat: 'Phishing',
            vulnerability: 'Lack of training',
            score: 12,
            probability: 3,
            impact: 4,
            status: 'Ouvert',
            strategy: 'Accepter',
            owner: 'user-1'
        }
    ];

    const defaultProps = {
        topRisks: mockRisks,
        loading: false,
        navigate: mockNavigate,
        t: mockT
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders widget title', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('Risques Prioritaires')).toBeInTheDocument();
        });

        it('renders widget subtitle', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('Top criticité')).toBeInTheDocument();
        });

        it('renders custom title when provided', () => {
            render(<PriorityRisksWidget {...defaultProps} title="Custom Title" />);

            expect(screen.getByText('Custom Title')).toBeInTheDocument();
        });

        it('renders dashboard card wrapper', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByTestId('dashboard-card')).toBeInTheDocument();
        });
    });

    describe('loading state', () => {
        it('shows skeletons when loading', () => {
            render(<PriorityRisksWidget {...defaultProps} loading={true} />);

            expect(screen.getAllByTestId('skeleton').length).toBe(2);
        });

        it('hides risk items when loading', () => {
            render(<PriorityRisksWidget {...defaultProps} loading={true} />);

            expect(screen.queryByText('Ransomware Attack')).not.toBeInTheDocument();
        });
    });

    describe('risk items', () => {
        it('displays risk threats', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('Ransomware Attack')).toBeInTheDocument();
            expect(screen.getByText('Data Breach')).toBeInTheDocument();
            expect(screen.getByText('DDoS Attack')).toBeInTheDocument();
        });

        it('displays risk vulnerabilities', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('Outdated systems')).toBeInTheDocument();
            expect(screen.getByText('Weak access controls')).toBeInTheDocument();
        });

        it('displays risk scores', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('25')).toBeInTheDocument();
            expect(screen.getByText('20')).toBeInTheDocument();
            expect(screen.getByText('16')).toBeInTheDocument();
        });

        it('displays risk strategies', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            // Multiple "Mitiger" strategies exist
            expect(screen.getAllByText('Mitiger').length).toBeGreaterThan(0);
            expect(screen.getByText('Transférer')).toBeInTheDocument();
        });

        it('only shows first 3 risks initially', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('Ransomware Attack')).toBeInTheDocument();
            expect(screen.getByText('Data Breach')).toBeInTheDocument();
            expect(screen.getByText('DDoS Attack')).toBeInTheDocument();
            expect(screen.queryByText('Phishing')).not.toBeInTheDocument();
        });
    });

    describe('navigation', () => {
        it('navigates to risk detail on click', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Voir le risque: Ransomware Attack'));

            expect(mockNavigate).toHaveBeenCalledWith('/risks?id=risk-1');
        });

        it('navigates on Enter key', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            const riskItem = screen.getByLabelText('Voir le risque: Ransomware Attack');
            fireEvent.keyDown(riskItem, { key: 'Enter' });

            expect(mockNavigate).toHaveBeenCalledWith('/risks?id=risk-1');
        });

        it('navigates on Space key', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            const riskItem = screen.getByLabelText('Voir le risque: Data Breach');
            fireEvent.keyDown(riskItem, { key: ' ' });

            expect(mockNavigate).toHaveBeenCalledWith('/risks?id=risk-2');
        });
    });

    describe('expansion', () => {
        it('shows "more" indicator when more than 3 risks', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByText('+1 plus')).toBeInTheDocument();
        });

        it('hides "more" indicator when 3 or fewer risks', () => {
            const fewRisks = mockRisks.slice(0, 3);
            render(<PriorityRisksWidget {...defaultProps} topRisks={fewRisks} />);

            expect(screen.queryByText(/plus/)).not.toBeInTheDocument();
        });

        it('shows all risks when expanded', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            fireEvent.click(screen.getByText('+1 plus'));

            expect(screen.getByText('Phishing')).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty state when no risks', () => {
            render(<PriorityRisksWidget {...defaultProps} topRisks={[]} />);

            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });

        it('shows empty title', () => {
            render(<PriorityRisksWidget {...defaultProps} topRisks={[]} />);

            expect(screen.getByText('Aucun risque critique')).toBeInTheDocument();
        });

        it('shows empty description', () => {
            render(<PriorityRisksWidget {...defaultProps} topRisks={[]} />);

            expect(screen.getByText('Tout est sous contrôle')).toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('has role button on risk items', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByLabelText('Voir le risque: Ransomware Attack')).toHaveAttribute('role', 'button');
        });

        it('has tabindex on risk items', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByLabelText('Voir le risque: Ransomware Attack')).toHaveAttribute('tabIndex', '0');
        });

        it('has aria-label for more button', () => {
            render(<PriorityRisksWidget {...defaultProps} />);

            expect(screen.getByLabelText('Afficher plus de risques')).toBeInTheDocument();
        });
    });

    describe('data-tour attribute', () => {
        it('has data-tour for onboarding', () => {
            const { container } = render(<PriorityRisksWidget {...defaultProps} />);

            expect(container.querySelector('[data-tour="risks-overview"]')).toBeInTheDocument();
        });
    });
});
