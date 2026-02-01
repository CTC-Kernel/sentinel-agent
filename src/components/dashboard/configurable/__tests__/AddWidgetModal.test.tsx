/**
 * Tests for AddWidgetModal component
 * Story 2-6: Configurable Dashboard Widgets
 * Task 7.6: Test AddWidgetModal filtering and selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddWidgetModal } from '../AddWidgetModal';

// Mock Headless UI
vi.mock('@headlessui/react', () => {
  const Dialog = ({ children, onClose, 'aria-labelledby': ariaLabelledBy }: { children: React.ReactNode; onClose: () => void; 'aria-labelledby'?: string }) => (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <button
        data-testid="backdrop"
        onClick={onClose}
        className="fixed inset-0"
        aria-hidden="true"
      />
      {children}
    </div>
  );
  Dialog.Panel = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Transition = ({ children, show }: { children: React.ReactNode; show?: boolean }) => (
    show ? <>{children}</> : null
  );
  Transition.Root = Transition;
  Transition.Child = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { Dialog, Transition };
});

// Mock createPortal to render in test container
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'dashboard.addWidget': 'Ajouter un widget',
        'dashboard.customizeDashboard': 'Personnalisez votre dashboard',
        'dashboard.addWidgetToDashboard': 'Ajouter au dashboard',
        'dashboard.allWidgetsAdded': 'Tous les widgets sont ajoutés',
        'dashboard.statsOverview': 'Vue d\'ensemble',
        'dashboard.complianceScore': 'Score de Conformité',
        'dashboard.executiveKpi': 'KPIs Direction',
        'dashboard.rssiCriticalRisks': 'Risques Critiques',
        'dashboard.rssiIncidents': 'Incidents RSSI',
        'dashboard.rssiActions': 'Actions RSSI',
        'dashboard.pmActionsOverdue': 'Actions en retard',
        'dashboard.pmTimeline': 'Timeline Projet',
        'dashboard.pmProgress': 'Progression Projet',
        'dashboard.myWorkspace': 'Mon Espace',
        'dashboard.complianceEvolution': 'Évolution Conformité',
        'dashboard.healthCheck': 'Santé Système',
        'dashboard.priorityRisks': 'Risques Prioritaires',
        'dashboard.recentActivity': 'Activité Récente',
        'dashboard.maturityRadar': 'Radar Maturité',
        'dashboard.cyberNews': 'Actualités Cyber',
        'dashboard.riskHeatmap': 'Carte des Risques',
        'dashboard.auditsDonut': 'Audits',
        'dashboard.projectTasks': 'Tâches Projet',
        'dashboard.incidentsStats': 'Statistiques Incidents',
        'dashboard.documentsStats': 'Documents',
        'dashboard.complianceProgress': 'Progression Conformité',
        'dashboard.assetStats': 'Actifs',
        'dashboard.suppliersStats': 'Fournisseurs',
        'dashboard.continuityPlans': 'Plans de Continuité',
        'dashboard.nis2DoraKpi': 'KPIs NIS2/DORA',
        'dashboard.widgetCategories.scoreKpi': 'Score & KPI',
        'dashboard.widgetCategories.risks': 'Risques',
        'dashboard.widgetCategories.actions': 'Actions',
        'dashboard.widgetCategories.audits': 'Audits',
        'dashboard.widgetCategories.other': 'Autres',
        'common.all': 'Tous',
        'common.close': 'Fermer',
        'common.search': 'Rechercher',
        'common.noResults': 'Aucun résultat',
        'common.tryDifferentSearch': 'Essayez une autre recherche',
      };
      return translations[key] || options?.defaultValue || key;
    },
  }),
}));

// Mock WIDGET_REGISTRY
vi.mock('../WidgetRegistry', () => ({
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
    'executive-kpi': {
      id: 'executive-kpi',
      titleKey: 'dashboard.executiveKpi',
      defaultColSpan: 3,
      component: () => null,
    },
    'rssi-critical-risks': {
      id: 'rssi-critical-risks',
      titleKey: 'dashboard.rssiCriticalRisks',
      defaultColSpan: 2,
      component: () => null,
    },
    'rssi-incidents': {
      id: 'rssi-incidents',
      titleKey: 'dashboard.rssiIncidents',
      defaultColSpan: 1,
      component: () => null,
    },
    'pm-actions-overdue': {
      id: 'pm-actions-overdue',
      titleKey: 'dashboard.pmActionsOverdue',
      defaultColSpan: 2,
      component: () => null,
    },
    'audits-donut': {
      id: 'audits-donut',
      titleKey: 'dashboard.auditsDonut',
      defaultColSpan: 1,
      component: () => null,
    },
    'my-workspace': {
      id: 'my-workspace',
      titleKey: 'dashboard.myWorkspace',
      defaultColSpan: 2,
      component: () => null,
    },
  },
}));

// Mock dashboardDefaults
vi.mock('../../../../config/dashboardDefaults', () => ({
  WIDGET_CATEGORIES: {
    'stats-overview': 'scoreKpi',
    'compliance-score': 'scoreKpi',
    'executive-kpi': 'scoreKpi',
    'rssi-critical-risks': 'risks',
    'rssi-incidents': 'other',
    'pm-actions-overdue': 'actions',
    'audits-donut': 'audits',
    'my-workspace': 'other',
  },
  getWidgetCategory: (widgetId: string) => {
    const categories: Record<string, string> = {
      'stats-overview': 'scoreKpi',
      'compliance-score': 'scoreKpi',
      'executive-kpi': 'scoreKpi',
      'rssi-critical-risks': 'risks',
      'rssi-incidents': 'other',
      'pm-actions-overdue': 'actions',
      'audits-donut': 'audits',
      'my-workspace': 'other',
    };
    return categories[widgetId] || 'other';
  },
}));

describe('AddWidgetModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAdd: vi.fn(),
    currentWidgetIds: [] as string[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when open', () => {
      render(<AddWidgetModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Ajouter un widget')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<AddWidgetModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should show all widgets when modal opens', () => {
      render(<AddWidgetModal {...defaultProps} />);

      // Should show widgets from registry (using getAllByText as there may be multiple elements)
      expect(screen.getAllByText('Vue d\'ensemble').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Score de Conformité').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Risques Critiques').length).toBeGreaterThan(0);
    });

    it('should show category tabs', () => {
      render(<AddWidgetModal {...defaultProps} />);

      // Find the category filter buttons by their containing role and count
      const categoryButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent?.includes('Tous') ||
          btn.textContent?.includes('Score & KPI') ||
          btn.textContent?.includes('Risques') ||
          btn.textContent?.includes('Actions') ||
          btn.textContent?.includes('Audits') ||
          btn.textContent?.includes('Autres')
      );

      // Should have at least 6 category tabs (Tous + 5 categories)
      expect(categoryButtons.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('filtering by category (Task 7.6)', () => {
    // Helper to find category tab button
    const findCategoryTab = (categoryName: string) => {
      return screen.getAllByRole('button').find(
        (btn) => btn.textContent?.includes(categoryName) && btn.textContent?.match(/\d+/)
      );
    };

    it('should filter widgets by scoreKpi category', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      // Click Score & KPI category tab (has count)
      const scoreKpiTab = findCategoryTab('Score & KPI');
      expect(scoreKpiTab).toBeDefined();
      await user.click(scoreKpiTab!);

      // Should show scoreKpi widgets
      expect(screen.getAllByText('Vue d\'ensemble').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Score de Conformité').length).toBeGreaterThan(0);
      expect(screen.getAllByText('KPIs Direction').length).toBeGreaterThan(0);

      // Should not show other category widgets (check widget cards not visible)
      const widgetButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent?.includes('Risques Critiques')
      );
      // No widget button with Risques Critiques should be present
      expect(widgetButtons.length).toBe(0);
    });

    it('should filter widgets by risks category', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      // Click Risks category tab
      const risksTab = findCategoryTab('Risques');
      expect(risksTab).toBeDefined();
      await user.click(risksTab!);

      // Should show risks widgets
      expect(screen.getAllByText('Risques Critiques').length).toBeGreaterThan(0);

      // Should not show scoreKpi widgets
      const scoreWidgets = screen.getAllByRole('button').filter(
        (btn) => btn.textContent?.includes('Score de Conformité')
      );
      expect(scoreWidgets.length).toBe(0);
    });

    it('should filter widgets by actions category', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      // Click Actions category tab
      const actionsTab = findCategoryTab('Actions');
      expect(actionsTab).toBeDefined();
      await user.click(actionsTab!);

      // Should show actions widgets
      expect(screen.getAllByText('Actions en retard').length).toBeGreaterThan(0);
    });

    it('should filter widgets by audits category', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      // Click Audits category tab
      const auditsTab = findCategoryTab('Audits');
      expect(auditsTab).toBeDefined();
      await user.click(auditsTab!);

      // Should show audits widgets - verify at least one widget is shown
      const widgetCount = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('aria-label')?.includes('Audits')
      ).length;
      expect(widgetCount).toBeGreaterThan(0);
    });

    it('should show all widgets when clicking "All" category', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      // First filter by a category
      const risksTab = findCategoryTab('Risques');
      await user.click(risksTab!);

      // Then click All
      const allTab = findCategoryTab('Tous');
      expect(allTab).toBeDefined();
      await user.click(allTab!);

      // Should show all widgets again
      expect(screen.getAllByText('Vue d\'ensemble').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Risques Critiques').length).toBeGreaterThan(0);
    });
  });

  describe('search filtering (Task 7.6)', () => {
    it('should filter widgets by search query', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Rechercher');
      await user.type(searchInput, 'conformité');

      // Should show matching widgets
      await waitFor(() => {
        expect(screen.getByText('Score de Conformité')).toBeInTheDocument();
      });

      // Should not show non-matching widgets
      expect(screen.queryByText('Risques Critiques')).not.toBeInTheDocument();
    });

    it('should show empty state when no search results', async () => {
      const user = userEvent.setup();

      render(<AddWidgetModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Rechercher');
      await user.type(searchInput, 'xyz123nonexistent');

      await waitFor(() => {
        expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
      });
    });

    it('should clear search when closing modal', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { rerender } = render(<AddWidgetModal {...defaultProps} onClose={onClose} />);

      // Type search
      const searchInput = screen.getByPlaceholderText('Rechercher');
      await user.type(searchInput, 'test');

      // Close modal
      await user.click(screen.getByRole('button', { name: /fermer/i }));

      expect(onClose).toHaveBeenCalled();

      // Reopen modal
      rerender(<AddWidgetModal {...defaultProps} isOpen={true} onClose={onClose} />);

      // Search should be cleared
      const newSearchInput = screen.getByPlaceholderText('Rechercher');
      expect(newSearchInput).toHaveValue('');
    });
  });

  describe('widget selection (Task 7.6)', () => {
    it('should call onAdd when clicking a widget', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();

      render(<AddWidgetModal {...defaultProps} onAdd={onAdd} />);

      // Find and click the stats-overview widget button
      const widgetButtons = screen.getAllByRole('button');
      const statsButton = widgetButtons.find((btn) =>
        btn.textContent?.includes('Vue d\'ensemble')
      );
      expect(statsButton).toBeDefined();

      await user.click(statsButton!);

      expect(onAdd).toHaveBeenCalledWith('stats-overview');
    });

    it('should disable already added widgets', () => {
      render(
        <AddWidgetModal
          {...defaultProps}
          currentWidgetIds={['stats-overview', 'compliance-score']}
        />
      );

      // Find widget buttons
      const widgetButtons = screen.getAllByRole('button');
      const statsButton = widgetButtons.find((btn) =>
        btn.textContent?.includes('Vue d\'ensemble')
      );

      expect(statsButton).toHaveAttribute('aria-disabled', 'true');
      expect(statsButton).toBeDisabled();
    });

    it('should show "already added" indicator for disabled widgets', () => {
      render(
        <AddWidgetModal
          {...defaultProps}
          currentWidgetIds={['stats-overview']}
        />
      );

      expect(screen.getByText('(déjà ajouté)')).toBeInTheDocument();
    });

    it('should not call onAdd for disabled widgets', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();

      render(
        <AddWidgetModal
          {...defaultProps}
          onAdd={onAdd}
          currentWidgetIds={['stats-overview']}
        />
      );

      // Find disabled widget button
      const widgetButtons = screen.getAllByRole('button');
      const statsButton = widgetButtons.find((btn) =>
        btn.textContent?.includes('Vue d\'ensemble')
      );

      await user.click(statsButton!);

      expect(onAdd).not.toHaveBeenCalled();
    });

    it('should not close modal after adding widget', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onAdd = vi.fn();

      render(<AddWidgetModal {...defaultProps} onClose={onClose} onAdd={onAdd} />);

      // Click a widget to add it
      const widgetButtons = screen.getAllByRole('button');
      const kpiButton = widgetButtons.find((btn) =>
        btn.textContent?.includes('KPIs Direction')
      );

      await user.click(kpiButton!);

      // onAdd should be called but not onClose
      expect(onAdd).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('category counts', () => {
    it('should show correct counts for each category', () => {
      render(<AddWidgetModal {...defaultProps} />);

      // Total count should be 8 (all widgets in registry)
      const allTab = screen.getByText('Tous').closest('button');
      expect(allTab?.textContent).toContain('8');
    });
  });

  describe('accessibility', () => {
    it('should have proper dialog role and aria attributes', () => {
      render(<AddWidgetModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'add-widget-title');
    });

    it('should have accessible widget buttons', () => {
      render(<AddWidgetModal {...defaultProps} />);

      const widgetButtons = screen.getAllByRole('button');
      const statsButton = widgetButtons.find((btn) =>
        btn.textContent?.includes('Vue d\'ensemble')
      );

      expect(statsButton).toHaveAttribute('aria-label');
    });

    it('should indicate disabled state in aria-label', () => {
      render(
        <AddWidgetModal
          {...defaultProps}
          currentWidgetIds={['stats-overview']}
        />
      );

      const widgetButtons = screen.getAllByRole('button');
      const statsButton = widgetButtons.find((btn) =>
        btn.textContent?.includes('Vue d\'ensemble')
      );

      expect(statsButton?.getAttribute('aria-label')).toContain('déjà ajouté');
    });
  });

  describe('modal interactions', () => {
    it('should close when clicking backdrop', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<AddWidgetModal {...defaultProps} onClose={onClose} />);

      // Click backdrop (mocked)
      await user.click(screen.getByTestId('backdrop'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should close when clicking close button', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<AddWidgetModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /fermer/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
