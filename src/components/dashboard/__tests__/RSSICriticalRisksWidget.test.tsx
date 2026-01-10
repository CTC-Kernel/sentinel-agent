import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RSSICriticalRisksWidget } from '../RSSICriticalRisksWidget';

// Mock the hook
vi.mock('../../../hooks/useCriticalRisksList', () => ({
  useCriticalRisksList: vi.fn(),
  getCriticalityColorScheme: vi.fn((criticality) => {
    if (criticality >= 20) return 'danger';
    if (criticality >= 15) return 'warning';
    if (criticality >= 10) return 'caution';
    return 'success';
  }),
  CRITICALITY_COLOR_CLASSES: {
    danger: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    warning: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
    caution: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    success: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  },
}));

import { useCriticalRisksList } from '../../../hooks/useCriticalRisksList';

describe('RSSICriticalRisksWidget', () => {
  const mockRefetch = vi.fn();
  const mockRisks = [
    { id: 'risk-1', title: 'Attaque DDoS', category: 'Reseau', criticality: 20, impact: 5, probability: 4, status: 'Ouvert' },
    { id: 'risk-2', title: 'Fuite de donnees', category: 'Donnees', criticality: 16, impact: 4, probability: 4, status: 'En cours' },
    { id: 'risk-3', title: 'Acces non autorise', category: 'Securite', criticality: 15, impact: 5, probability: 3, status: 'Ouvert' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useCriticalRisksList).mockReturnValue({
      risks: mockRisks,
      count: 3,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('should render the widget with correct count', () => {
    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Risques Critiques')).toBeInTheDocument();
  });

  it('should display all risk items', () => {
    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByText('Attaque DDoS')).toBeInTheDocument();
    expect(screen.getByText('Fuite de donnees')).toBeInTheDocument();
    expect(screen.getByText('Acces non autorise')).toBeInTheDocument();
  });

  it('should display category for each risk', () => {
    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByText('Reseau')).toBeInTheDocument();
    expect(screen.getByText('Donnees')).toBeInTheDocument();
    expect(screen.getByText('Securite')).toBeInTheDocument();
  });

  it('should display criticality badge for each risk', () => {
    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('should call onRiskClick when a risk item is clicked', () => {
    const handleClick = vi.fn();
    render(<RSSICriticalRisksWidget organizationId="org-123" onRiskClick={handleClick} />);

    const firstRisk = screen.getByText('Attaque DDoS').closest('button');
    fireEvent.click(firstRisk!);

    expect(handleClick).toHaveBeenCalledWith('risk-1');
  });

  it('should call onViewAllClick when "Voir tous les risques" is clicked', () => {
    const handleViewAll = vi.fn();
    render(<RSSICriticalRisksWidget organizationId="org-123" onViewAllClick={handleViewAll} />);

    const viewAllButton = screen.getByText('Voir tous les risques');
    fireEvent.click(viewAllButton);

    expect(handleViewAll).toHaveBeenCalled();
  });

  it('should show loading skeleton when loading', () => {
    vi.mocked(useCriticalRisksList).mockReturnValue({
      risks: [],
      count: 0,
      previousCount: null,
      trend: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state when no risks', () => {
    vi.mocked(useCriticalRisksList).mockReturnValue({
      risks: [],
      count: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByText('Aucun risque critique')).toBeInTheDocument();
    expect(screen.getByText('Tous les risques sont sous controle')).toBeInTheDocument();
  });

  it('should show error state and allow retry', () => {
    vi.mocked(useCriticalRisksList).mockReturnValue({
      risks: [],
      count: 0,
      previousCount: null,
      trend: null,
      loading: false,
      error: new Error('Erreur de connexion'),
      refetch: mockRefetch,
    });

    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByText('Erreur de connexion')).toBeInTheDocument();

    const retryButton = screen.getByText('Reessayer');
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should have accessible region role', () => {
    render(<RSSICriticalRisksWidget organizationId="org-123" />);

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Risques critiques');
  });

  it('should render different sizes', () => {
    const { rerender } = render(
      <RSSICriticalRisksWidget organizationId="org-123" size="lg" />
    );

    expect(screen.getByText('3')).toHaveClass('text-4xl');

    rerender(<RSSICriticalRisksWidget organizationId="org-123" size="sm" />);

    expect(screen.getByText('3')).toHaveClass('text-2xl');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RSSICriticalRisksWidget organizationId="org-123" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
