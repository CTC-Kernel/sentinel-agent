/**
 * EbiosAnalyses View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EbiosAnalyses from '../EbiosAnalyses';

vi.mock('../../store', () => ({
  useStore: () => ({
    t: (key: string) => key
  })
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      uid: 'user-1',
      email: 'test@example.com',
      role: 'user',
      organizationId: 'org-1',
      displayName: 'Test User'
    },
    firebaseUser: null,
    loading: false,
    error: null,
    isAdmin: false,
    claimsSynced: true,
    dismissBlockerError: vi.fn(),
    refreshSession: vi.fn(),
    logout: vi.fn(),
    enrollMFA: vi.fn(),
    verifyMFA: vi.fn(),
    unenrollMFA: vi.fn(),
    loginWithSSO: vi.fn()
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

vi.mock('../../services/ebiosService', () => ({
  EbiosService: {
    listAnalyses: vi.fn().mockResolvedValue([
      {
        id: 'analysis-1',
        organizationId: 'org-1',
        name: 'Test Analysis',
        description: 'Test description',
        status: 'in_progress',
        currentWorkshop: 1,
        completionPercentage: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: 'user-1',
        workshops: {
          1: { status: 'in_progress', data: { scope: { objectives: [], context: '' }, fearedEvents: [] } },
          2: { status: 'not_started', data: { riskSources: [], targetObjectives: [] } },
          3: { status: 'not_started', data: { strategicScenarios: [] } },
          4: { status: 'not_started', data: { operationalScenarios: [] } },
          5: { status: 'not_started', data: { treatmentStrategies: [], residualRisks: [], actionPlan: [] } }
        }
      }
    ]),
    createAnalysis: vi.fn(),
    deleteAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
    duplicateAnalysis: vi.fn()
  }
}));

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
  MasterpieceBackground: () => <div data-testid="masterpiece-bg" />
}));

vi.mock('../../components/ui/GlassCard', () => ({
  GlassCard: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    onClick ? (
      <button
        data-testid="glass-card"
        onClick={onClick}
        className="glass-card-mock-btn"
      >
        {children}
      </button>
    ) : (
      <div data-testid="glass-card">{children}</div>
    )
  )
}));

vi.mock('../../components/ui/ProgressRing', () => ({
  ProgressRing: () => <div data-testid="progress-ring" />
}));

vi.mock('../../components/ui/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state" />
}));

vi.mock('../../components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner" />
}));

vi.mock('../../components/ui/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="confirm-modal" /> : null
}));

vi.mock('../../components/ebios/EbiosStatsWidget', () => ({
  EbiosStatsWidget: () => <div data-testid="ebios-stats-widget" />
}));

vi.mock('../../components/ebios/CreateAnalysisDrawer', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="create-drawer"><button onClick={onClose}>Close</button></div> : null
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../services/errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn()
  }
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
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

  it('renders the page header', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });

  it('renders the masterpiece background', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('masterpiece-bg')).toBeInTheDocument();
    });
  });

  it('renders the stats widget', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('ebios-stats-widget')).toBeInTheDocument();
    });
  });

  it('renders analysis cards after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('glass-card')).toBeInTheDocument();
    });
  });

  it('navigates to analysis detail on card click', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('glass-card')).toBeInTheDocument();
    });
    const card = screen.getByTestId('glass-card');
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/ebios/analysis-1');
  });

  it('exports as default', async () => {
    const module = await import('../EbiosAnalyses');
    expect(module.default).toBeDefined();
  });
});
