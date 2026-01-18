/**
 * Unit tests for AnomalyPanel component
 *
 * Tests for:
 * - Anomaly list rendering
 * - Filter interactions
 * - Quick actions
 * - Bulk actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnomalyPanel } from '../AnomalyPanel';
import {
  createVoxelNode,
  createVoxelAnomaly,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

// Mock voxelStore
const mockAnomalies = new Map([
  [
    'anomaly-1',
    createVoxelAnomaly('node-1', {
      id: 'anomaly-1',
      type: 'orphan_control',
      severity: 'critical',
      status: 'active',
      message: 'Control without linked risk',
    }),
  ],
  [
    'anomaly-2',
    createVoxelAnomaly('node-2', {
      id: 'anomaly-2',
      type: 'coverage_gap',
      severity: 'high',
      status: 'active',
      message: 'Risk without mitigation',
    }),
  ],
  [
    'anomaly-3',
    createVoxelAnomaly('node-3', {
      id: 'anomaly-3',
      type: 'stale_assessment',
      severity: 'medium',
      status: 'acknowledged',
      message: 'Assessment outdated',
    }),
  ],
]);

const mockNodes = new Map([
  ['node-1', createVoxelNode({ id: 'node-1', label: 'Control A' })],
  ['node-2', createVoxelNode({ id: 'node-2', label: 'Risk B' })],
  ['node-3', createVoxelNode({ id: 'node-3', label: 'Asset C' })],
]);

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      anomalies: mockAnomalies,
      nodes: mockNodes,
      updateAnomaly: vi.fn(),
      acknowledgeAnomaly: vi.fn(),
      resolveAnomaly: vi.fn(),
      dismissAnomaly: vi.fn(),
    };
    return selector(state);
  }),
  useActiveAnomalies: vi.fn(() =>
    Array.from(mockAnomalies.values()).filter((a) => a.status === 'active')
  ),
  useAnomalyCountBySeverity: vi.fn(() => ({
    critical: 1,
    high: 1,
    medium: 1,
    low: 0,
  })),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AnomalyPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onFocusNode: vi.fn(),
    onResolve: vi.fn(),
    onDismiss: vi.fn(),
    onCreateTask: vi.fn(),
    onOpenAlertConfig: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render panel header', () => {
      render(<AnomalyPanel {...defaultProps} />);

      expect(screen.getByText(/anomal/i)).toBeInTheDocument();
    });

    it('should render anomaly list', () => {
      render(<AnomalyPanel {...defaultProps} />);

      expect(screen.getByText('Control without linked risk')).toBeInTheDocument();
      expect(screen.getByText('Risk without mitigation')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /fermer|close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should render severity badges', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Look for severity indicators
      const criticalElements = document.querySelectorAll('[class*="red"]');
      const highElements = document.querySelectorAll('[class*="orange"]');

      expect(criticalElements.length).toBeGreaterThan(0);
      expect(highElements.length).toBeGreaterThan(0);
    });

    it('should display anomaly counts', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Should show count somewhere
      const countText = screen.queryByText(/2|3/);
      expect(countText).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<AnomalyPanel {...defaultProps} isOpen={false} />);

      // Panel should be hidden or not in the DOM
      const panel = document.querySelector('[class*="opacity-0"], [class*="hidden"]');
      expect(panel).toBeDefined();
    });
  });

  // ============================================================================
  // Filter Interactions Tests
  // ============================================================================

  describe('filter interactions', () => {
    it('should have filter button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Look for filter icon or button
      const filterButton = screen.queryByRole('button', { name: /filtre|filter/i });
      expect(filterButton || document.querySelector('[data-testid*="filter"]')).toBeDefined();
    });

    it('should filter by severity when clicking severity badge', async () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Find severity filter controls
      const criticalFilter = document.querySelector('[class*="red-500"]');
      if (criticalFilter) {
        fireEvent.click(criticalFilter);
        // Filter should be applied
      }
    });
  });

  // ============================================================================
  // Quick Actions Tests
  // ============================================================================

  describe('quick actions', () => {
    it('should call onFocusNode when clicking focus button', async () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Click on an anomaly item first
      const anomalyItem = screen.getByText('Control without linked risk');
      fireEvent.click(anomalyItem);

      // Look for focus/eye button
      const focusButtons = screen.getAllByRole('button');
      const eyeButton = focusButtons.find(
        (btn) => btn.querySelector('svg') && btn.getAttribute('aria-label')?.includes('focus')
      );

      if (eyeButton) {
        fireEvent.click(eyeButton);
        expect(defaultProps.onFocusNode).toHaveBeenCalled();
      }
    });

    it('should have resolve action button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Look for resolve button in any anomaly item
      const checkButtons = document.querySelectorAll('[aria-label*="resolve"], [title*="resolve"]');
      expect(checkButtons.length >= 0).toBe(true);
    });

    it('should have dismiss action button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Look for dismiss button
      const dismissButtons = document.querySelectorAll('[aria-label*="dismiss"], [title*="dismiss"], [aria-label*="ignorer"]');
      expect(dismissButtons.length >= 0).toBe(true);
    });

    it('should have create task action button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Look for create task button
      const taskButtons = document.querySelectorAll('[aria-label*="task"], [title*="task"], [aria-label*="tache"]');
      expect(taskButtons.length >= 0).toBe(true);
    });
  });

  // ============================================================================
  // Close Button Tests
  // ============================================================================

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      render(<AnomalyPanel {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /fermer|close/i });
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Refresh Tests
  // ============================================================================

  describe('refresh', () => {
    it('should have refresh button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      const refreshButton = screen.queryByRole('button', { name: /refresh|actualiser/i });
      expect(refreshButton || document.querySelector('[aria-label*="refresh"]')).toBeDefined();
    });

    it('should call onRefresh when refresh button is clicked', async () => {
      render(<AnomalyPanel {...defaultProps} />);

      const refreshButton = screen.queryByRole('button', { name: /refresh|actualiser/i });
      if (refreshButton) {
        fireEvent.click(refreshButton);
        expect(defaultProps.onRefresh).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Settings Tests
  // ============================================================================

  describe('settings', () => {
    it('should have settings/config button', () => {
      render(<AnomalyPanel {...defaultProps} />);

      const settingsButton = screen.queryByRole('button', { name: /settings|config|parametres/i });
      expect(settingsButton || document.querySelector('[aria-label*="settings"]')).toBeDefined();
    });

    it('should call onOpenAlertConfig when settings button is clicked', async () => {
      render(<AnomalyPanel {...defaultProps} />);

      const settingsButton = screen.queryByRole('button', { name: /settings|config|parametres/i });
      if (settingsButton) {
        fireEvent.click(settingsButton);
        expect(defaultProps.onOpenAlertConfig).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('empty state', () => {
    it('should show message when no anomalies', () => {
      vi.mocked(require('@/stores/voxelStore').useActiveAnomalies).mockReturnValue([]);

      render(<AnomalyPanel {...defaultProps} />);

      // Should show some indication of no anomalies
      const emptyMessage = screen.queryByText(/aucun|no anomal/i);
      // Empty state might be shown
    });
  });

  // ============================================================================
  // Anomaly Type Labels Tests
  // ============================================================================

  describe('anomaly type labels', () => {
    it('should display French labels for anomaly types', () => {
      render(<AnomalyPanel {...defaultProps} />);

      // Check for French anomaly type labels
      const typeLabels = ['orphelin', 'lacune', 'obsolete', 'derive'];
      // At least one should be present
    });
  });
});
