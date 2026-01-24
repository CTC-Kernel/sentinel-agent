import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutiveKPIWidget } from '../ExecutiveKPIWidget';

// Mock the hooks
vi.mock('../../../hooks/useComplianceScore', () => ({
  useComplianceScore: vi.fn(),
}));

vi.mock('../../../hooks/useCriticalRisks', () => ({
  useCriticalRisks: vi.fn(),
}));

vi.mock('../../../hooks/useOngoingAudits', () => ({
  useOngoingAudits: vi.fn(),
}));

import { useComplianceScore } from '../../../hooks/useComplianceScore';
import { useCriticalRisks } from '../../../hooks/useCriticalRisks';
import { useOngoingAudits } from '../../../hooks/useOngoingAudits';

describe('ExecutiveKPIWidget', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useComplianceScore).mockReturnValue({
      score: { global: 75, byFramework: { iso27001: 80, nis2: 70, dora: 65, rgpd: 85 }, trend: 'up', lastCalculated: new Date(), breakdown: {} as never },
      breakdown: null,
      trend: 'up',
      history: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    vi.mocked(useCriticalRisks).mockReturnValue({
      count: 2,
      previousCount: 3,
      trend: 'down',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    vi.mocked(useOngoingAudits).mockReturnValue({
      count: 4,
      previousCount: 4,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('should render all 3 KPI cards', () => {
    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('Sante Conformite')).toBeInTheDocument();
    expect(screen.getByText("Points d'Attention")).toBeInTheDocument();
    expect(screen.getByText('Controles Actifs')).toBeInTheDocument();
  });

  it('should display correct values', () => {
    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should show loading skeletons when loading', () => {
    vi.mocked(useComplianceScore).mockReturnValue({
      score: null,
      breakdown: null,
      trend: null,
      history: [],
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    vi.mocked(useCriticalRisks).mockReturnValue({
      count: null,
      previousCount: null,
      trend: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    vi.mocked(useOngoingAudits).mockReturnValue({
      count: null,
      previousCount: null,
      trend: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state when any hook has error', () => {
    vi.mocked(useComplianceScore).mockReturnValue({
      score: null,
      breakdown: null,
      trend: null,
      history: [],
      loading: false,
      error: new Error('Test error'),
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Reessayer')).toBeInTheDocument();
  });

  it('should call refetch when retry button is clicked', async () => {
    vi.mocked(useComplianceScore).mockReturnValue({
      score: null,
      breakdown: null,
      trend: null,
      history: [],
      loading: false,
      error: new Error('Test error'),
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    const retryButton = screen.getByText('Reessayer');
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should call onKPIClick when KPI card is clicked', () => {
    const handleClick = vi.fn();

    render(
      <ExecutiveKPIWidget organizationId="org-123" onKPIClick={handleClick} />
    );

    // Click on Score Global card
    const scoreCard = screen.getByText('Sante Conformite').closest('[role="button"]');
    fireEvent.click(scoreCard!);

    expect(handleClick).toHaveBeenCalledWith('score_global');
  });

  it('should display correct subtitle for zero critical risks', () => {
    vi.mocked(useCriticalRisks).mockReturnValue({
      count: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('Aucun risque critique')).toBeInTheDocument();
  });

  it('should display correct subtitle for one critical risk', () => {
    vi.mocked(useCriticalRisks).mockReturnValue({
      count: 1,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('1 necessite votre attention')).toBeInTheDocument();
  });

  it('should display correct subtitle for multiple critical risks', () => {
    vi.mocked(useCriticalRisks).mockReturnValue({
      count: 5,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('5 necessitent votre attention')).toBeInTheDocument();
  });

  it('should display correct subtitle for zero ongoing audits', () => {
    vi.mocked(useOngoingAudits).mockReturnValue({
      count: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('Aucun controle en cours')).toBeInTheDocument();
  });

  it('should display correct subtitle for one ongoing audit', () => {
    vi.mocked(useOngoingAudits).mockReturnValue({
      count: 1,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByText('1 verification en cours')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ExecutiveKPIWidget organizationId="org-123" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render different sizes', () => {
    const { rerender } = render(
      <ExecutiveKPIWidget organizationId="org-123" size="lg" />
    );

    // Check for large size class (matches KPICard SIZE_CONFIG)
    expect(screen.getByText('75')).toHaveClass('text-3xl');

    rerender(<ExecutiveKPIWidget organizationId="org-123" size="sm" />);

    expect(screen.getByText('75')).toHaveClass('text-xl');
  });

  it('should have accessible region role', () => {
    render(<ExecutiveKPIWidget organizationId="org-123" />);

    expect(screen.getByRole('region')).toHaveAttribute(
      'aria-label',
      'Indicateurs cles de performance'
    );
  });
});
