/**
 * Unit tests for RoleCard component
 * Tests role card display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleCard } from '../RoleCard';
import { CustomRole } from '../../../types';

// Mock ConfirmModal
vi.mock('../../ui/ConfirmModal', () => ({
 ConfirmModal: ({ isOpen, onClose, onConfirm, title, message }: {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string;
 }) => isOpen ? (
 <div data-testid="confirm-modal">
 <h2>{title}</h2>
 <p>{message}</p>
 <button onClick={onClose}>Annuler</button>
 <button onClick={onConfirm}>Supprimer</button>
 </div>
 ) : null
}));

describe('RoleCard', () => {
 const mockRole: CustomRole = {
 id: 'role-1',
 name: 'Developer',
 description: 'Development team role with code access',
 permissions: {
 Risk: ['read', 'update'],
 Control: ['read'],
 Asset: ['read', 'update', 'delete']
 },
 organizationId: 'org-1',
 createdAt: '2024-01-01T00:00:00.000Z',
 updatedAt: '2024-01-01T00:00:00.000Z'
 };

 const mockOnEdit = vi.fn();
 const mockOnDelete = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders role name', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('Developer')).toBeInTheDocument();
 });

 it('renders role description', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('Development team role with code access')).toBeInTheDocument();
 });

 it('renders default description when not provided', () => {
 render(<RoleCard role={{ ...mockRole, description: undefined }} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('Aucune description')).toBeInTheDocument();
 });

 it('renders permissions count', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('3 ressources configurées')).toBeInTheDocument();
 });

 it('renders edit button with correct aria-label', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByLabelText('Modifier le rôle Developer')).toBeInTheDocument();
 });

 it('renders delete button with correct aria-label', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByLabelText('Supprimer le rôle Developer')).toBeInTheDocument();
 });
 });

 describe('edit interaction', () => {
 it('calls onEdit when edit button is clicked', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 fireEvent.click(screen.getByLabelText('Modifier le rôle Developer'));

 expect(mockOnEdit).toHaveBeenCalledWith(mockRole);
 });
 });

 describe('delete interaction', () => {
 it('shows confirmation modal when delete button is clicked', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 fireEvent.click(screen.getByLabelText('Supprimer le rôle Developer'));

 expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
 expect(screen.getByText('Supprimer le rôle')).toBeInTheDocument();
 });

 it('shows role name in confirmation message', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 fireEvent.click(screen.getByLabelText('Supprimer le rôle Developer'));

 // Role name appears multiple times (in card and modal message)
 expect(screen.getAllByText(/Developer/).length).toBeGreaterThan(1);
 });

 it('calls onDelete when confirmed', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 // Open modal
 fireEvent.click(screen.getByLabelText('Supprimer le rôle Developer'));
 // Confirm deletion
 fireEvent.click(screen.getByText('Supprimer'));

 expect(mockOnDelete).toHaveBeenCalledWith('role-1');
 });

 it('closes modal when cancelled', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 // Open modal
 fireEvent.click(screen.getByLabelText('Supprimer le rôle Developer'));
 expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

 // Cancel
 fireEvent.click(screen.getByText('Annuler'));

 expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
 });

 it('does not call onDelete when cancelled', () => {
 render(<RoleCard role={mockRole} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 // Open modal
 fireEvent.click(screen.getByLabelText('Supprimer le rôle Developer'));
 // Cancel
 fireEvent.click(screen.getByText('Annuler'));

 expect(mockOnDelete).not.toHaveBeenCalled();
 });
 });

 describe('different permission counts', () => {
 it('shows correct count for single resource', () => {
 render(<RoleCard role={{ ...mockRole, permissions: { Risk: ['read'] } }} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('1 ressources configurées')).toBeInTheDocument();
 });

 it('shows correct count for empty permissions', () => {
 render(<RoleCard role={{ ...mockRole, permissions: {} }} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('0 ressources configurées')).toBeInTheDocument();
 });

 it('shows correct count for many resources', () => {
 const manyPermissions: CustomRole['permissions'] = {
 Risk: ['read'],
 Control: ['read'],
 Asset: ['read'],
 Document: ['read'],
 Project: ['read']
 };
 render(<RoleCard role={{ ...mockRole, permissions: manyPermissions }} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('5 ressources configurées')).toBeInTheDocument();
 });
 });
});
