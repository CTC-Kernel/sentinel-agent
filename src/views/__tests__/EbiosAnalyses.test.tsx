/**
 * EbiosAnalyses View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EbiosAnalyses from '../EbiosAnalyses';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' }
  })
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../../hooks/ebios/useEbiosAnalyses', () => ({
  useEbiosAnalyses: () => ({
    analyses: [
      {
        id: 'analysis-1',
        name: 'Test Analysis',
        status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    loading: false,
    error: null,
    createAnalysis: vi.fn(),
    deleteAnalysis: vi.fn()
  })
}));

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
  MasterpieceBackground: () => <div data-testid="masterpiece-bg" />
}));

vi.mock('../../components/ebios/EbiosAnalysisList', () => ({
  EbiosAnalysisList: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <div data-testid="analysis-list">
      <button onClick={() => onSelect('analysis-1')}>Select Analysis</button>
    </div>
  )
}));

vi.mock('../../components/SEO', () => ({
  SEO: () => null
}));

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <EbiosAnalyses />
    </BrowserRouter>
  );
};

describe('EbiosAnalyses View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', () => {
    renderComponent();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('renders the analysis list', () => {
    renderComponent();
    expect(screen.getByTestId('analysis-list')).toBeInTheDocument();
  });

  it('renders the masterpiece background', () => {
    renderComponent();
    expect(screen.getByTestId('masterpiece-bg')).toBeInTheDocument();
  });

  it('navigates to analysis detail on select', async () => {
    renderComponent();
    const selectButton = screen.getByText('Select Analysis');
    fireEvent.click(selectButton);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('exports as default', async () => {
    const module = await import('../EbiosAnalyses');
    expect(module.default).toBeDefined();
  });
});
