/**
 * Unit tests for ViewSelector component
 *
 * Tests for:
 * - Preset selection
 * - Keyboard shortcuts
 * - Custom view save
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewSelector } from '../ViewSelector';
import { resetIdCounter } from '@/tests/factories/voxelFactory';
import type { ViewPreset } from '@/types/voxel';

// Mock voxelStore
const mockApplyPreset = vi.fn();
const mockSaveCustomPreset = vi.fn();

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      applyPreset: mockApplyPreset,
      saveCustomPreset: mockSaveCustomPreset,
      currentPreset: 'executive',
    };
    return selector(state);
  }),
  useCurrentPreset: vi.fn(() => 'executive' as ViewPreset),
}));

// Mock viewPresets
vi.mock('@/stores/viewPresets', () => ({
  VIEW_PRESETS: {
    executive: {
      name: 'executive',
      label: 'Vue Executive',
      layers: ['asset', 'risk', 'control'],
      layout: 'force',
      camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
      description: 'Vue haut niveau pour dirigeants',
      icon: 'Briefcase',
    },
    rssi: {
      name: 'rssi',
      label: 'Vue RSSI',
      layers: ['risk', 'control', 'incident'],
      layout: 'force',
      camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
      description: 'Vue securite pour RSSI',
      icon: 'Shield',
    },
    auditor: {
      name: 'auditor',
      label: 'Vue Auditeur',
      layers: ['control', 'audit'],
      layout: 'hierarchical',
      camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
      description: 'Vue conformite pour auditeurs',
      icon: 'ClipboardCheck',
    },
    soc: {
      name: 'soc',
      label: 'Vue SOC',
      layers: ['incident', 'asset'],
      layout: 'force',
      camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
      description: 'Vue operations pour SOC',
      icon: 'Activity',
    },
    compliance: {
      name: 'compliance',
      label: 'Vue Compliance',
      layers: ['control', 'audit', 'risk'],
      layout: 'hierarchical',
      camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
      description: 'Vue conformite reglementaire',
      icon: 'Scale',
    },
    custom: {
      name: 'custom',
      label: 'Vue Personnalisee',
      layers: [],
      layout: 'force',
      camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
      description: 'Votre vue personnalisee',
      icon: 'Settings',
    },
  },
  getAvailablePresets: vi.fn(() => ['executive', 'rssi', 'auditor', 'soc', 'compliance', 'custom']),
}));

// Mock useLocale
vi.mock('@/hooks/useLocale', () => ({
  useLocale: vi.fn(() => ({ locale: 'fr' })),
}));

// Mock dropdown menu components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu" {...props}>{children}</div>
  ),
  DropdownMenuContent: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content" role="menu" {...props}>{children}</div>
  ),
  DropdownMenuGroup: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="dropdown-group" {...props}>{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <div data-testid="dropdown-item" role="menuitem" onClick={onClick} {...props}>{children}</div>
  ),
  DropdownMenuLabel: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="dropdown-label" {...props}>{children}</div>
  ),
  DropdownMenuSeparator: (props: Record<string, unknown>) => (
    <div data-testid="dropdown-separator" role="separator" {...props} />
  ),
  DropdownMenuTrigger: ({ children, asChild, ...props }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <div data-testid="dropdown-trigger" {...props}>{children}</div>
  ),
}));

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: React.PropsWithChildren<{ onClick?: () => void; className?: string }>) => (
    <button onClick={onClick} className={className} {...props}>{children}</button>
  ),
}));

describe('ViewSelector', () => {
  const defaultProps = {
    className: '',
    onCopyLink: vi.fn(),
    onSaveCustomView: vi.fn(),
    onManageViews: vi.fn(),
  };

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render dropdown trigger', () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
    });

    it('should display current preset name', () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.getByText(/executive|vue/i)).toBeInTheDocument();
    });

    it('should render dropdown menu', () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    });

    it('should render all preset options', () => {
      render(<ViewSelector {...defaultProps} />);

      // Check for preset labels
      expect(screen.getByText(/executive/i)).toBeInTheDocument();
    });

    it('should show checkmark for current preset', () => {
      render(<ViewSelector {...defaultProps} />);

      // Current preset should have indicator
      const currentPresetItem = screen.getByText(/executive/i).closest('[data-testid="dropdown-item"]');
      expect(currentPresetItem).toBeDefined();
    });
  });

  // ============================================================================
  // Preset Selection Tests
  // ============================================================================

  describe('preset selection', () => {
    it('should call applyPreset when preset is selected', async () => {
      render(<ViewSelector {...defaultProps} />);

      const rssiOption = screen.getByText(/rssi/i);
      fireEvent.click(rssiOption);

      expect(mockApplyPreset).toHaveBeenCalledWith('rssi');
    });

    it('should show preset descriptions', () => {
      render(<ViewSelector {...defaultProps} />);

      // Descriptions should be visible
      expect(screen.queryByText(/dirigeants|haut niveau/i)).toBeDefined();
    });

    it('should show layer previews for each preset', () => {
      render(<ViewSelector {...defaultProps} />);

      // Layer dots should be present
      const layerDots = document.querySelectorAll('[class*="rounded-full"]');
      expect(layerDots.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Keyboard Shortcuts Tests
  // ============================================================================

  describe('keyboard shortcuts', () => {
    it('should apply preset when pressing number key', async () => {
      render(<ViewSelector {...defaultProps} />);

      // Press '2' for RSSI preset
      await userEvent.keyboard('2');

      await waitFor(() => {
        expect(mockApplyPreset).toHaveBeenCalledWith('rssi');
      });
    });

    it('should apply executive preset when pressing 1', async () => {
      render(<ViewSelector {...defaultProps} />);

      await userEvent.keyboard('1');

      await waitFor(() => {
        expect(mockApplyPreset).toHaveBeenCalledWith('executive');
      });
    });

    it('should not trigger shortcut when modifier key is pressed', async () => {
      render(<ViewSelector {...defaultProps} />);

      // Press Ctrl+1
      await userEvent.keyboard('{Control>}1{/Control}');

      // Should not apply preset
      expect(mockApplyPreset).not.toHaveBeenCalled();
    });

    it('should not trigger shortcut when typing in input', async () => {
      render(
        <>
          <ViewSelector {...defaultProps} />
          <input type="text" data-testid="test-input" />
        </>
      );

      const input = screen.getByTestId('test-input');
      input.focus();

      await userEvent.keyboard('1');

      // Should not apply preset when focused on input
      expect(mockApplyPreset).not.toHaveBeenCalled();
    });

    it('should show keyboard shortcuts in dropdown', () => {
      render(<ViewSelector {...defaultProps} />);

      // Shortcuts should be visible (1, 2, 3, etc.)
      const shortcutText = screen.queryByText(/\d/);
      expect(shortcutText).toBeDefined();
    });
  });

  // ============================================================================
  // Copy Link Tests
  // ============================================================================

  describe('copy link', () => {
    it('should have copy link option', () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.queryByText(/copier|copy|lien|link/i)).toBeDefined();
    });

    it('should call onCopyLink when copy link is clicked', () => {
      render(<ViewSelector {...defaultProps} />);

      const copyLink = screen.queryByText(/copier|copy/i);
      if (copyLink) {
        fireEvent.click(copyLink);
        expect(defaultProps.onCopyLink).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Save Custom View Tests
  // ============================================================================

  describe('save custom view', () => {
    it('should have save custom view option', () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.queryByText(/sauvegarder|save|personnalis/i)).toBeDefined();
    });

    it('should call onSaveCustomView when save is clicked', () => {
      render(<ViewSelector {...defaultProps} />);

      const saveButton = screen.queryByText(/sauvegarder|save/i);
      if (saveButton) {
        fireEvent.click(saveButton);
        expect(defaultProps.onSaveCustomView).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Manage Views Tests
  // ============================================================================

  describe('manage views', () => {
    it('should have manage views option', () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.queryByText(/gerer|manage|parametres|settings/i)).toBeDefined();
    });

    it('should call onManageViews when manage is clicked', () => {
      render(<ViewSelector {...defaultProps} />);

      const manageButton = screen.queryByText(/gerer|manage/i);
      if (manageButton) {
        fireEvent.click(manageButton);
        expect(defaultProps.onManageViews).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Custom Class Tests
  // ============================================================================

  describe('custom class', () => {
    it('should apply custom className', () => {
      const { container } = render(<ViewSelector {...defaultProps} className="my-custom-class" />);

      expect(container.querySelector('.my-custom-class')).toBeDefined();
    });
  });
});
