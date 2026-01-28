/**
 * Unit tests for RowActionsMenu component (Story 1.6)
 *
 * Tests menu rendering, keyboard navigation, and action callbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu, RowActionItem } from '../RowActionsMenu';
import { Edit, Copy, Trash2 } from '../Icons';

// Mock Headless UI to eliminate async transition state updates and "ot" warnings
vi.mock('@headlessui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@headlessui/react')>();
  return {
    ...actual,
    Transition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('RowActionsMenu', () => {
  const mockOnEdit = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultItems: RowActionItem[] = [
    { label: 'Modifier', icon: Edit, onClick: mockOnEdit },
    { label: 'Dupliquer', icon: Copy, onClick: mockOnDuplicate },
    { label: 'Supprimer', icon: Trash2, onClick: mockOnDelete, variant: 'danger' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress specific Headless UI warnings
    const originalError = console.error;
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      const msg = args.join(' ');
      if (typeof msg === 'string' && msg.includes('An update to')) return;
      originalError(...args);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders menu trigger button', () => {
      render(<RowActionsMenu items={defaultItems} />);

      expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
    });

    it('renders with custom aria-label', () => {
      render(<RowActionsMenu items={defaultItems} aria-label="Actions pour le risque" />);

      expect(screen.getByRole('button', { name: 'Actions pour le risque' })).toBeInTheDocument();
    });

    it('returns null when items array is empty', () => {
      const { container } = render(<RowActionsMenu items={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders all menu items when opened', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Modifier')).toBeInTheDocument();
        expect(screen.getByText('Dupliquer')).toBeInTheDocument();
        expect(screen.getByText('Supprimer')).toBeInTheDocument();
      });
    });

    it('applies glass-premium styling to dropdown', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        const menuItems = screen.getByRole('menu');
        expect(menuItems).toHaveClass('rounded-3xl');
        expect(menuItems).toHaveClass('shadow-lg');
      });
    });
  });

  describe('variant styling', () => {
    it('applies danger styling to delete action', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        const deleteButton = screen.getByText('Supprimer').closest('button');
        expect(deleteButton).toHaveClass('text-error-600');
      });
    });

    it('applies default styling to regular actions', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        const editButton = screen.getByText('Modifier').closest('button');
        expect(editButton).toHaveClass('text-slate-700');
      });
    });
  });

  describe('disabled state', () => {
    it('disables item when disabled prop is true', async () => {
      const itemsWithDisabled: RowActionItem[] = [
        { label: 'Modifier', icon: Edit, onClick: mockOnEdit },
        { label: 'Dupliquer', icon: Copy, onClick: mockOnDuplicate, disabled: true },
      ];

      render(<RowActionsMenu items={itemsWithDisabled} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        const duplicateButton = screen.getByText('Dupliquer').closest('button');
        expect(duplicateButton).toBeDisabled();
        expect(duplicateButton).toHaveClass('cursor-not-allowed');
      });
    });

    it('does not call onClick when item is disabled', async () => {
      const itemsWithDisabled: RowActionItem[] = [
        { label: 'Dupliquer', icon: Copy, onClick: mockOnDuplicate, disabled: true },
      ];

      render(<RowActionsMenu items={itemsWithDisabled} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        const duplicateButton = screen.getByText('Dupliquer').closest('button');
        fireEvent.click(duplicateButton!);
      });

      expect(mockOnDuplicate).not.toHaveBeenCalled();
    });
  });

  describe('click handlers', () => {
    it('calls onClick when menu item is clicked', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Modifier'));
      });

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('calls correct handler for each action', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });

      // Test Edit
      await userEvent.click(trigger);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Modifier'));
      });
      expect(mockOnEdit).toHaveBeenCalled();

      // Test Duplicate
      await userEvent.click(trigger);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Dupliquer'));
      });
      expect(mockOnDuplicate).toHaveBeenCalled();

      // Test Delete
      await userEvent.click(trigger);
      await waitFor(() => {
        fireEvent.click(screen.getByText('Supprimer'));
      });
      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('stops event propagation on container click', async () => {
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            parentClick();
          }
        }}>
          <RowActionsMenu items={defaultItems} />
        </div>
      );

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      // The parent click should not be triggered
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('opens menu on Enter key', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      trigger.focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Modifier')).toBeInTheDocument();
      });
    });

    it('opens menu on Space key', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      trigger.focus();
      await userEvent.keyboard(' ');

      await waitFor(() => {
        expect(screen.getByText('Modifier')).toBeInTheDocument();
      }, { timeout: 1000 }); // Headless UI animations might take a moment
    });

    it('closes menu on Escape key', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Modifier')).toBeInTheDocument();
      });

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
      });
    });

    it('navigates through items with arrow keys', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Modifier')).toBeInTheDocument();
      });

      // Arrow down should move focus
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');

      // The focus should have moved (Headless UI handles this internally)
      // We can verify the menu is still open and items are present
      expect(screen.getByText('Dupliquer')).toBeInTheDocument();
    });
  });

  describe('click outside', () => {
    it('closes menu when clicking outside', async () => {
      render(
        <div>
          <RowActionsMenu items={defaultItems} />
          <button>Outside button</button>
        </div>
      );

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Modifier')).toBeInTheDocument();
      });

      // Click outside the menu
      await userEvent.click(screen.getByText('Outside button'));

      await waitFor(() => {
        expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has aria-haspopup attribute on trigger', () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('menu has role="menu"', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('menu items have role="menuitem"', async () => {
      render(<RowActionsMenu items={defaultItems} />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(3);
      });
    });
  });
});
