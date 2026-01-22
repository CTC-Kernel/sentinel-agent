/**
 * ControlEffectiveness View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ControlEffectiveness from '../ControlEffectiveness';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' }
  })
}));

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
  MasterpieceBackground: () => <div data-testid="masterpiece-bg" />
}));

vi.mock('../../components/controls/ControlEffectivenessTab', () => ({
  ControlEffectivenessTab: () => <div data-testid="effectiveness-tab">Effectiveness Tab</div>
}));

vi.mock('../../components/SEO', () => ({
  SEO: () => null
}));

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <ControlEffectiveness />
    </BrowserRouter>
  );
};

describe('ControlEffectiveness View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', () => {
    renderComponent();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('renders the effectiveness tab', () => {
    renderComponent();
    expect(screen.getByTestId('effectiveness-tab')).toBeInTheDocument();
  });

  it('renders the masterpiece background', () => {
    renderComponent();
    expect(screen.getByTestId('masterpiece-bg')).toBeInTheDocument();
  });

  it('exports as default', async () => {
    const module = await import('../ControlEffectiveness');
    expect(module.default).toBeDefined();
  });
});
