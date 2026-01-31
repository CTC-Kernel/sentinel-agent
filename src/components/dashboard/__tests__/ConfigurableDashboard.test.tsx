/**
 * Tests for ConfigurableDashboard component
 * Story 2-6: Configurable Dashboard Widgets
 * Task 7.5: Test ConfigurableDashboard role detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurableDashboard } from '../ConfigurableDashboard';
import type { WidgetLayout } from '../../../hooks/useDashboardPreferences';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>,
    h3: ({ children, className, ...props }: React.ComponentProps<'h3'>) => <h3 className={className} {...props}>{children}</h3>,
    p: ({ children, className, ...props }: React.ComponentProps<'p'>) => <p className={className} {...props}>{children}</p>,
    button: ({ children, className, ...props }: React.ComponentProps<'button'>) => <button className={className} {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock microInteractions
vi.mock('../../../utils/microInteractions', () => ({
  appleEasing: [0.16, 1, 0.3, 1],
}));

// Mock useAuth
const mockUser = {
  uid: 'user-123',
  organizationId: 'org-123',
  role: 'rssi',
};

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Mock store
vi.mock('../../../store', () => ({
  useStore: () => ({language: 'fr',,
        t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }}),
}));

// Mock useDashboardPreferences
const mockUpdateLayout = vi.fn();
const mockResetLayout = vi.fn();
const mockLayout: WidgetLayout[] = [
  { id: 'widget-1', widgetId: 'stats-overview', colSpan: 2 },
  { id: 'widget-2', widgetId: 'rssi-critical-risks', colSpan: 1 },
];

vi.mock('../../../hooks/useDashboardPreferences', () => ({
  useDashboardPreferences: vi.fn(() => ({
    layout: mockLayout,
    updateLayout: mockUpdateLayout,
    resetLayout: mockResetLayout,
    hasLoaded: true,
    isCustomized: false,
    isSyncing: false,
  })),
}));

// Mock getDashboardRole and getDefaultLayoutForRole
vi.mock('../../../config/dashboardDefaults', () => ({
  getDashboardRole: vi.fn((role: string) => role),
  getDefaultLayoutForRole: vi.fn((role: string) => {
    const layouts: Record<string, WidgetLayout[]> = {
      rssi: [
        { id: 'default-1', widgetId: 'rssi-critical-risks', colSpan: 2 },
      ],
      direction: [
        { id: 'default-1', widgetId: 'executive-kpi', colSpan: 3 },
      ],
      user: [
        { id: 'default-1', widgetId: 'my-workspace', colSpan: 2 },
      ],
    };
    return layouts[role] || layouts.user;
  }),
}));

// Mock react-i18next
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'dashboard.addWidget': 'Ajouter un widget',
          'dashboard.customizeDashboard': 'Personnalisez votre dashboard',
          'dashboard.editMode': 'Mode édition',
          'dashboard.customize': 'Personnaliser',
          'dashboard.doneEditing': 'Terminer',
          'dashboard.resetToDefaults': 'Réinitialiser',
          'dashboard.resetConfirm': 'Réinitialiser votre dashboard ?',
          'common.cancel': 'Annuler',
        };
        return translations[key] || key;
      },
    }),
  };
});

// Mock ConfigurableDashboardGrid
vi.mock('../configurable/ConfigurableDashboardGrid', () => ({
  ConfigurableDashboardGrid: vi.fn(({ layout, isEditing }) => (
    <div data-testid="dashboard-grid" data-editing={isEditing}>
      {layout.map((w: WidgetLayout) => (
        <div key={w.id || 'unknown'} data-testid={`widget-${w.widgetId}`}>
          {w.widgetId}
        </div>
      ))}
    </div>
  )),
}));

// Mock WIDGET_REGISTRY
vi.mock('../configurable/WidgetRegistry', () => ({
  WIDGET_REGISTRY: {
    'stats-overview': {
      id: 'stats-overview',
      titleKey: 'dashboard.statsOverview',
      defaultColSpan: 2,
      component: () => null,
    },
    'compliance-score': {
      id: 'compliance-score',
      titleKey: 'dashboard.complianceScore',
      defaultColSpan: 1,
      component: () => null,
    },
    'rssi-critical-risks': {
      id: 'rssi-critical-risks',
      titleKey: 'dashboard.rssiCriticalRisks',
      defaultColSpan: 2,
      component: () => null,
    },
  },
}));

// Mock AddWidgetModal - use a real widget ID that exists in WIDGET_REGISTRY
vi.mock('../configurable/AddWidgetModal', () => ({
  AddWidgetModal: vi.fn(({ isOpen, onClose, onAdd }) =>
    isOpen ? (
      <div data-testid="add-widget-modal" role="dialog">
        <button onClick={() => onAdd('compliance-score')}>Add Widget</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

// Mock DashboardEditModeToggle
vi.mock('../DashboardEditModeToggle', () => ({
  DashboardEditModeToggle: vi.fn(({ isEditing, onEditModeChange, onReset, isCustomized }) => (
    <div data-testid="edit-mode-toggle">
      <button
        onClick={() => onEditModeChange(!isEditing)}
        data-testid="toggle-edit-btn"
      >
        {isEditing ? 'Done' : 'Customize'}
      </button>
      {isEditing && isCustomized && (
        <button onClick={onReset} data-testid="reset-btn">
          Reset
        </button>
      )}
    </div>
  )),
}));

describe('ConfigurableDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.role = 'rssi';
  });

  describe('Role detection (Task 7.5)', () => {
    it('should detect rssi role from user', async () => {
      mockUser.role = 'rssi';

      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
      });

      // Verify useDashboardPreferences was called with rssi role
      const { useDashboardPreferences } = await import('../../../hooks/useDashboardPreferences');
      expect(useDashboardPreferences).toHaveBeenCalledWith(
        'user-123',
        'org-123',
        'rssi',
        expect.any(Array)
      );
    });

    it('should detect direction role from user', async () => {
      mockUser.role = 'direction';

      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
      });

      const { getDashboardRole } = await import('../../../config/dashboardDefaults');
      expect(getDashboardRole).toHaveBeenCalledWith('direction');
    });

    it('should use roleOverride when provided', async () => {
      mockUser.role = 'rssi';

      render(<ConfigurableDashboard roleOverride="direction" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
      });

      const { useDashboardPreferences } = await import('../../../hooks/useDashboardPreferences');
      expect(useDashboardPreferences).toHaveBeenCalledWith(
        'user-123',
        'org-123',
        'direction',
        expect.any(Array)
      );
    });

    it('should default to user role when no role on user', async () => {
      mockUser.role = undefined as unknown as string;

      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
      });

      const { useDashboardPreferences } = await import('../../../hooks/useDashboardPreferences');
      expect(useDashboardPreferences).toHaveBeenCalledWith(
        'user-123',
        'org-123',
        'user',
        expect.any(Array)
      );
    });
  });

  describe('rendering', () => {
    it('should render dashboard grid with widgets', async () => {
      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
      });

      expect(screen.getByTestId('widget-stats-overview')).toBeInTheDocument();
      expect(screen.getByTestId('widget-rssi-critical-risks')).toBeInTheDocument();
    });

    it('should render edit mode toggle', async () => {
      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });
    });

    it('should apply custom className', async () => {
      const { container } = render(<ConfigurableDashboard className="custom-dashboard" />);

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-dashboard');
      });
    });
  });

  describe('edit mode', () => {
    it('should toggle edit mode when clicking toggle button', async () => {
      const user = userEvent.setup();

      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('toggle-edit-btn')).toBeInTheDocument();
      });

      // Click to enter edit mode
      await user.click(screen.getByTestId('toggle-edit-btn'));

      // Add widget button should appear
      await waitFor(() => {
        expect(screen.getByText('Ajouter un widget')).toBeInTheDocument();
      });
    });

    it('should show add widget button only in edit mode', async () => {
      const user = userEvent.setup();

      render(<ConfigurableDashboard />);

      // Not in edit mode - no add button
      expect(screen.queryByText('Ajouter un widget')).not.toBeInTheDocument();

      // Enter edit mode
      await user.click(screen.getByTestId('toggle-edit-btn'));

      // Add button should appear
      await waitFor(() => {
        expect(screen.getByText('Ajouter un widget')).toBeInTheDocument();
      });
    });

    it('should open add widget modal when clicking add button', async () => {
      const user = userEvent.setup();

      render(<ConfigurableDashboard />);

      // Enter edit mode
      await user.click(screen.getByTestId('toggle-edit-btn'));

      // Click add widget button
      await user.click(screen.getByText('Ajouter un widget'));

      // Modal should open
      await waitFor(() => {
        expect(screen.getByTestId('add-widget-modal')).toBeInTheDocument();
      });
    });
  });

  describe('widget management', () => {
    it('should call updateLayout when adding a widget', async () => {
      const user = userEvent.setup();

      render(<ConfigurableDashboard />);

      // Enter edit mode
      await user.click(screen.getByTestId('toggle-edit-btn'));

      // Open modal
      await user.click(screen.getByText('Ajouter un widget'));

      // Add a widget
      await user.click(screen.getByText('Add Widget'));

      // updateLayout should be called with new widget added
      expect(mockUpdateLayout).toHaveBeenCalled();
      const newLayout = mockUpdateLayout.mock.calls[0][0];
      expect(newLayout.length).toBe(mockLayout.length + 1);
    });

    it('should pass widgetProps to grid', async () => {
      const customProps = {
        customProp: 'test-value',
      };

      render(<ConfigurableDashboard widgetProps={customProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
      });

      // Verify ConfigurableDashboardGrid receives merged props
      const { ConfigurableDashboardGrid } = await import('../configurable/ConfigurableDashboardGrid');
      const mockCalls = vi.mocked(ConfigurableDashboardGrid).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const lastCall = mockCalls[mockCalls.length - 1][0];
      expect(lastCall.widgetProps).toMatchObject({
        customProp: 'test-value',
        organizationId: 'org-123',
        userId: 'user-123',
      });
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when not loaded', async () => {
      const { useDashboardPreferences } = await import('../../../hooks/useDashboardPreferences');
      vi.mocked(useDashboardPreferences).mockReturnValueOnce({
        layout: [],
        updateLayout: mockUpdateLayout,
        resetLayout: mockResetLayout,
        hasLoaded: false,
        isCustomized: false,
        isSyncing: false,
      });

      const { container } = render(<ConfigurableDashboard />);

      // Should show loading skeleton
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no widgets', async () => {
      const { useDashboardPreferences } = await import('../../../hooks/useDashboardPreferences');
      vi.mocked(useDashboardPreferences).mockReturnValue({
        layout: [],
        updateLayout: mockUpdateLayout,
        resetLayout: mockResetLayout,
        hasLoaded: true,
        isCustomized: false,
        isSyncing: false,
      });

      render(<ConfigurableDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Personnalisez votre dashboard')).toBeInTheDocument();
      });
    });
  });
});
