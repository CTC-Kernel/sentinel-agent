import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RSSIIncidentsWidget } from '../RSSIIncidentsWidget';
import { Criticality } from '../../../types/common';
import type { IncidentListItem } from '../../../hooks/useActiveIncidents';

// Mock the hook
vi.mock('../../../hooks/useActiveIncidents', () => ({
  useActiveIncidents: vi.fn(),
  getSeverityColorScheme: vi.fn((severity) => {
    if (severity === 'Critique') return 'danger';
    if (severity === 'Élevée') return 'warning';
    if (severity === 'Moyenne') return 'caution';
    return 'success';
  }),
  SEVERITY_COLOR_CLASSES: {
    danger: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', badge: 'bg-red-500' },
    warning: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', badge: 'bg-orange-500' },
    caution: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', badge: 'bg-yellow-500' },
    success: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', badge: 'bg-green-500' },
  },
}));

import { useActiveIncidents } from '../../../hooks/useActiveIncidents';

describe('RSSIIncidentsWidget', () => {
  const mockRefetch = vi.fn();
  const mockIncidents: IncidentListItem[] = [
    {
      id: 'incident-1',
      title: 'Tentative de phishing',
      description: 'Email de phishing detecte',
      severity: Criticality.CRITICAL,
      status: 'Analyse',
      category: 'Phishing',
      dateReported: '2026-01-10T10:00:00Z',
      reporter: 'Jean Dupont',
    },
    {
      id: 'incident-2',
      title: 'Indisponibilite serveur',
      description: 'Serveur web inaccessible',
      severity: Criticality.HIGH,
      status: 'Contenu',
      category: 'Indisponibilité',
      dateReported: '2026-01-09T14:30:00Z',
      reporter: 'Marie Martin',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useActiveIncidents).mockReturnValue({
      incidents: mockIncidents,
      count: 2,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('should render the widget with correct count', () => {
    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Incidents Actifs')).toBeInTheDocument();
  });

  it('should display all incident items', () => {
    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByText('Tentative de phishing')).toBeInTheDocument();
    expect(screen.getByText('Indisponibilite serveur')).toBeInTheDocument();
  });

  it('should display severity badge for each incident', () => {
    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByText('Critique')).toBeInTheDocument();
    expect(screen.getByText('Élevée')).toBeInTheDocument();
  });

  it('should display category for incidents', () => {
    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByText('• Phishing')).toBeInTheDocument();
    expect(screen.getByText('• Indisponibilité')).toBeInTheDocument();
  });

  it('should call onIncidentClick when an incident is clicked', () => {
    const handleClick = vi.fn();
    render(<RSSIIncidentsWidget organizationId="org-123" onIncidentClick={handleClick} />);

    const firstIncident = screen.getByText('Tentative de phishing').closest('button');
    fireEvent.click(firstIncident!);

    expect(handleClick).toHaveBeenCalledWith('incident-1');
  });

  it('should call onViewAllClick when "Voir tous les incidents" is clicked', () => {
    const handleViewAll = vi.fn();
    render(<RSSIIncidentsWidget organizationId="org-123" onViewAllClick={handleViewAll} />);

    const viewAllButton = screen.getByText('Voir tous les incidents');
    fireEvent.click(viewAllButton);

    expect(handleViewAll).toHaveBeenCalled();
  });

  it('should show loading skeleton when loading', () => {
    vi.mocked(useActiveIncidents).mockReturnValue({
      incidents: [],
      count: 0,
      previousCount: null,
      trend: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSIIncidentsWidget organizationId="org-123" />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state when no incidents', () => {
    vi.mocked(useActiveIncidents).mockReturnValue({
      incidents: [],
      count: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByText('Aucun incident actif')).toBeInTheDocument();
    expect(screen.getByText('Tout est sous controle')).toBeInTheDocument();
  });

  it('should show error state and allow retry', () => {
    vi.mocked(useActiveIncidents).mockReturnValue({
      incidents: [],
      count: 0,
      previousCount: null,
      trend: null,
      loading: false,
      error: new Error('Erreur de connexion'),
      refetch: mockRefetch,
    });

    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByText('Erreur de connexion')).toBeInTheDocument();

    const retryButton = screen.getByText('Reessayer');
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should have accessible region role', () => {
    render(<RSSIIncidentsWidget organizationId="org-123" />);

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Incidents actifs');
  });

  it('should render different sizes', () => {
    const { rerender } = render(
      <RSSIIncidentsWidget organizationId="org-123" size="lg" />
    );

    expect(screen.getByText('2')).toHaveClass('text-4xl');

    rerender(<RSSIIncidentsWidget organizationId="org-123" size="sm" />);

    expect(screen.getByText('2')).toHaveClass('text-2xl');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RSSIIncidentsWidget organizationId="org-123" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should show count in orange when there are incidents', () => {
    render(<RSSIIncidentsWidget organizationId="org-123" />);

    const count = screen.getByText('2');
    expect(count).toHaveClass('text-orange-600');
  });

  it('should show count in green when no incidents', () => {
    vi.mocked(useActiveIncidents).mockReturnValue({
      incidents: [],
      count: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSIIncidentsWidget organizationId="org-123" />);

    const count = screen.getByText('0');
    expect(count).toHaveClass('text-green-600');
  });
});
