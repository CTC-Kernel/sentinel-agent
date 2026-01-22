/**
 * VendorConcentration View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import VendorConcentration from '../VendorConcentration';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' }
  })
}));

vi.mock('../../store', () => ({
  useStore: () => ({
    user: { uid: 'user-123' },
    organization: { id: 'org-123' }
  })
}));

vi.mock('../../services/VendorConcentrationService', () => ({
  VendorConcentrationService: {
    getMetrics: vi.fn().mockResolvedValue({
      herfindahlIndex: 0.5,
      topVendorShare: 35,
      categoryCount: 5
    }),
    getSPOFSummary: vi.fn().mockResolvedValue({ alerts: [], totalSPOFs: 0 }),
    getDependencyMatrix: vi.fn().mockResolvedValue({ vendors: [], dependencies: [] }),
    getRecommendations: vi.fn().mockResolvedValue({ recommendations: [] }),
    getTrends: vi.fn().mockResolvedValue({ trends: [] })
  }
}));

vi.mock('../../components/vendor-concentration/CategoryChart', () => ({
  CategoryChart: () => <div data-testid="category-chart">Category Chart</div>
}));

vi.mock('../../components/vendor-concentration/DependencyMatrix', () => ({
  DependencyMatrix: () => <div data-testid="dependency-matrix">Dependency Matrix</div>
}));

vi.mock('../../components/vendor-concentration/SPOFAlerts', () => ({
  SPOFAlerts: () => <div data-testid="spof-alerts">SPOF Alerts</div>
}));

vi.mock('../../components/vendor-concentration/ConcentrationRecommendations', () => ({
  ConcentrationRecommendations: () => <div data-testid="recommendations">Recommendations</div>
}));

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <VendorConcentration />
    </BrowserRouter>
  );
};

describe('VendorConcentration View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the view', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('vendorConcentration.title')).toBeInTheDocument();
    });
  });

  it('renders metric cards', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('vendorConcentration.metrics.herfindahl')).toBeInTheDocument();
    });
  });

  it('renders tabs for different views', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  it('exports as default', async () => {
    const module = await import('../VendorConcentration');
    expect(module.default).toBeDefined();
  });
});
