/**
 * EbiosAnalysisDetail View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EbiosAnalysisDetail from '../EbiosAnalysisDetail';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' }
  })
}));

vi.mock('../../hooks/ebios/useEbiosAnalysis', () => ({
  useEbiosAnalysis: () => ({
    analysis: {
      id: 'analysis-1',
      name: 'Test Analysis',
      status: 'in_progress',
      currentWorkshop: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    loading: false,
    error: null,
    updateAnalysis: vi.fn()
  })
}));

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
  MasterpieceBackground: () => <div data-testid="masterpiece-bg" />
}));

vi.mock('../../components/ebios/EbiosWorkshopTabs', () => ({
  EbiosWorkshopTabs: () => <div data-testid="workshop-tabs">Workshop Tabs</div>
}));

vi.mock('../../components/SEO', () => ({
  SEO: () => null
}));

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={['/ebios/analysis-1']}>
      <Routes>
        <Route path="/ebios/:analysisId" element={<EbiosAnalysisDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('EbiosAnalysisDetail View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', () => {
    renderComponent();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('renders the workshop tabs', () => {
    renderComponent();
    expect(screen.getByTestId('workshop-tabs')).toBeInTheDocument();
  });

  it('renders the masterpiece background', () => {
    renderComponent();
    expect(screen.getByTestId('masterpiece-bg')).toBeInTheDocument();
  });

  it('exports as default', async () => {
    const module = await import('../EbiosAnalysisDetail');
    expect(module.default).toBeDefined();
  });
});
