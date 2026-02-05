/**
 * Unit tests for UserRow component
 * Tests user row in team management table
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserRow } from '../UserRow';

// Mock permissions utils
vi.mock('../../../utils/permissions', () => ({
 getRoleName: (role: string) => {
 const names: Record<string, string> = {
 admin: 'Administrateur',
 rssi: 'RSSI',
 auditor: 'Auditeur',
 user: 'Utilisateur'
 };
 return names[role] || role;
 }
}));

// Mock avatarUtils
vi.mock('../../../utils/avatarUtils', () => ({
 getUserAvatarUrl: (photoUrl: string | null, role: string) =>
 photoUrl || `https://example.com/avatar/${role}.png`
}));

describe('UserRow', () => {
 const mockOnEditStart = vi.fn();
 const mockOnEditCancel = vi.fn();
 const mockOnRoleChange = vi.fn();
 const mockOnSave = vi.fn();

 const mockUser = {
 uid: 'user-1',
 displayName: 'John Doe',
 email: 'john@example.com',
 role: 'user' as const,
 department: 'IT Department',
 photoURL: null,
 organizationId: 'org-1',
 lastLogin: '2024-01-15T10:00:00'
 };

 const mockCurrentUser = {
 uid: 'admin-1',
 displayName: 'Admin User',
 email: 'admin@example.com',
 role: 'admin' as const,
 organizationId: 'org-1'
 };

 const defaultProps = {
 user: mockUser,
 currentUser: mockCurrentUser,
 isEditing: false,
 selectedRole: 'user' as const,
 onEditStart: mockOnEditStart,
 onEditCancel: mockOnEditCancel,
 onRoleChange: mockOnRoleChange,
 onSave: mockOnSave
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 const renderInTable = (props = {}) => {
 return render(
 <table>
 <tbody>
  <UserRow {...defaultProps} {...props} />
 </tbody>
 </table>
 );
 };

 describe('display mode', () => {
 it('renders user name', () => {
 renderInTable();

 expect(screen.getByText('John Doe')).toBeInTheDocument();
 });

 it('renders user email', () => {
 renderInTable();

 expect(screen.getByText('john@example.com')).toBeInTheDocument();
 });

 it('renders user department', () => {
 renderInTable();

 expect(screen.getByText('IT Department')).toBeInTheDocument();
 });

 it('renders role badge', () => {
 renderInTable();

 expect(screen.getByText('Utilisateur')).toBeInTheDocument();
 });

 it('renders last login date', () => {
 renderInTable();

 expect(screen.getByText(/15/)).toBeInTheDocument();
 });

 it('shows Jamais when no last login', () => {
 renderInTable({
 user: { ...mockUser, lastLogin: null }
 });

 expect(screen.getByText('Jamais')).toBeInTheDocument();
 });

 it('renders avatar image', () => {
 renderInTable();

 const img = screen.getByAltText('John Doe');
 expect(img).toBeInTheDocument();
 });

 it('renders edit button', () => {
 renderInTable();

 expect(screen.getByTitle('Modifier le rôle')).toBeInTheDocument();
 });
 });

 describe('edit button interactions', () => {
 it('calls onEditStart when edit clicked', () => {
 renderInTable();

 fireEvent.click(screen.getByTitle('Modifier le rôle'));

 expect(mockOnEditStart).toHaveBeenCalledWith('user-1', 'user');
 });

 it('disables edit for current user', () => {
 renderInTable({
 user: { ...mockUser, uid: 'admin-1' }
 });

 expect(screen.getByTitle('Modifier le rôle')).toBeDisabled();
 });
 });

 describe('edit mode', () => {
 const editProps = {
 ...defaultProps,
 isEditing: true,
 selectedRole: 'auditor' as const
 };

 it('shows role select dropdown', () => {
 renderInTable(editProps);

 expect(screen.getByRole('combobox')).toBeInTheDocument();
 });

 it('has correct selected value', () => {
 renderInTable(editProps);

 expect(screen.getByRole('combobox')).toHaveValue('auditor');
 });

 it('shows all role options', () => {
 renderInTable(editProps);

 expect(screen.getByText('Administrateur')).toBeInTheDocument();
 expect(screen.getByText('RSSI')).toBeInTheDocument();
 expect(screen.getByText('Auditeur')).toBeInTheDocument();
 });

 it('calls onRoleChange when selection changes', () => {
 renderInTable(editProps);

 fireEvent.change(screen.getByRole('combobox'), {
 target: { value: 'rssi' }
 });

 expect(mockOnRoleChange).toHaveBeenCalledWith('rssi');
 });

 it('shows save button', () => {
 renderInTable(editProps);

 expect(screen.getByTitle('Enregistrer')).toBeInTheDocument();
 });

 it('shows cancel button', () => {
 renderInTable(editProps);

 expect(screen.getByTitle('Annuler')).toBeInTheDocument();
 });

 it('calls onSave when save clicked', () => {
 renderInTable(editProps);

 fireEvent.click(screen.getByTitle('Enregistrer'));

 expect(mockOnSave).toHaveBeenCalledWith('user-1', 'auditor');
 });

 it('calls onEditCancel when cancel clicked', () => {
 renderInTable(editProps);

 fireEvent.click(screen.getByTitle('Annuler'));

 expect(mockOnEditCancel).toHaveBeenCalled();
 });
 });

 describe('without department', () => {
 it('does not render department when not provided', () => {
 renderInTable({
 user: { ...mockUser, department: undefined }
 });

 expect(screen.queryByText('IT Department')).not.toBeInTheDocument();
 });
 });
});
