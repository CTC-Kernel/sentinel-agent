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

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../../hooks/usePersistedState', () => ({
  usePersistedState: <T,>(_key: string, defaultValue: T) => {
    return [defaultValue, vi.fn()];
  }
}));

vi.mock('../../hooks/controls/useControlEffectiveness', () => ({
  useControlEffectiveness: () => ({
    assessments: [],
    domainScores: [],
    loading: false,
    error: null,
    createAssessment: vi.fn()
  })
}));

vi.mock('../../data/complianceData', () => ({
  ISO_SEED_CONTROLS: []
}));

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
  MasterpieceBackground: () => <div data-testid="masterpiece-bg" />
}));

vi.mock('../../components/ui/ScrollableTabs', () => ({
  ScrollableTabs: () => <div data-testid="scrollable-tabs">Tabs</div>
}));

vi.mock('../../components/controls/ControlEffectivenessManager', () => ({
  ControlEffectivenessManager: () => <div data-testid="effectiveness-manager">Effectiveness Manager</div>
}));

vi.mock('../../components/controls/dashboard/ControlEffectivenessDashboard', () => ({
  ControlEffectivenessDashboard: () => <div data-testid="effectiveness-dashboard">Dashboard</div>
}));

vi.mock('../../components/controls/AssessmentFormModal', () => ({
  AssessmentFormModal: () => <div data-testid="assessment-modal">Modal</div>
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

  it('renders the effectiveness dashboard', () => {
    renderComponent();
    expect(screen.getByTestId('effectiveness-dashboard')).toBeInTheDocument();
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
