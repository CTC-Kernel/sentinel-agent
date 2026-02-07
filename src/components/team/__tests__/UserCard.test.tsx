/**
 * Unit tests for UserCard component
 * Tests user card display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from '../UserCard';
import { UserProfile } from '../../../types';

// Mock i18n
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => {
 const translations: Record<string, string> = {
 'team.actions.edit': 'Modifier',
 'team.actions.delete': 'Supprimer',
 'team.delete.titleInvite': 'Supprimer l\'invitation ?',
 'team.invite.success': 'Invitation envoyée',
 'team.stats.pending': 'en attente',
 'team.columns.lastLogin': 'Dernière connexion'
 };
 return translations[key] || key;
 }
 })
}));

// Mock useLocale - component uses this, not useTranslation
vi.mock('../../../hooks/useLocale', () => ({
 useLocale: () => ({
 locale: 'fr',
 t: (key: string, options?: { defaultValue?: string }) => {
 if (options?.defaultValue) return options.defaultValue;
 const translations: Record<string, string> = {
 'team.actions.edit': 'Modifier',
 'team.actions.delete': 'Supprimer',
 'team.delete.titleInvite': 'Supprimer l\'invitation ?',
 'team.invite.success': 'Invitation envoyée',
 'team.stats.pending': 'en attente',
 'team.columns.lastLogin': 'Dernière connexion',
 'team.defaultDepartment': 'Général'
 };
 return translations[key] || key;
 }
 })
}));

// Mock avatar utils
vi.mock('../../../utils/avatarUtils', () => ({
 getDefaultAvatarUrl: vi.fn((role) => `https://avatar.vercel.sh/${role}`)
}));

// Mock Tooltip
vi.mock('../../ui/Tooltip', () => ({
 Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
 <div title={content}>{children}</div>
 )
}));

// Mock RoleBadge
vi.mock('../../ui/RoleBadge', () => ({
 RoleBadge: ({ role }: { role: string }) => <span data-testid="role-badge">{role}</span>
}));

describe('UserCard', () => {
 const mockUser: UserProfile = {
 uid: 'user-1',
 email: 'test@example.com',
 displayName: 'Test User',
 role: 'admin',
 photoURL: null,
 organizationId: 'org-1',
 department: 'IT',
 lastLogin: new Date().toISOString()
 };

 const mockOnEdit = vi.fn();
 const mockOnDelete = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders user display name', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('Test User')).toBeInTheDocument();
 });

 it('renders user email', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('test@example.com')).toBeInTheDocument();
 });

 it('renders role badge', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByTestId('role-badge')).toBeInTheDocument();
 expect(screen.getByText('admin')).toBeInTheDocument();
 });

 it('renders department', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('IT')).toBeInTheDocument();
 });

 it('renders default department when not set', () => {
 render(<UserCard user={{ ...mockUser, department: undefined }} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText('Général')).toBeInTheDocument();
 });

 it('renders last login date', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText(new Date(mockUser.lastLogin!).toLocaleDateString('fr-FR'))).toBeInTheDocument();
 });

 it('renders avatar image', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 const avatar = screen.getByAltText('Test User');
 expect(avatar).toBeInTheDocument();
 });
 });

 describe('pending user', () => {
 const pendingUser = { ...mockUser, isPending: true };

 it('shows pending status', () => {
 render(<UserCard user={pendingUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByText(/en attente/)).toBeInTheDocument();
 });

 it('applies pending styles', () => {
 const { container } = render(<UserCard user={pendingUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(container.querySelector('.border-dashed')).toBeInTheDocument();
 });

 it('hides edit button for pending users', () => {
 render(<UserCard user={pendingUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 // Should not have edit button aria-label
 const editButton = screen.queryByLabelText('Modifier');
 expect(editButton).not.toBeInTheDocument();
 });

 it('shows delete button for pending users', () => {
 render(<UserCard user={pendingUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByLabelText('Supprimer')).toBeInTheDocument();
 });
 });

 describe('admin actions', () => {
 it('shows edit button when canAdmin is true', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByLabelText('Modifier')).toBeInTheDocument();
 });

 it('shows delete button when canAdmin is true', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.getByLabelText('Supprimer')).toBeInTheDocument();
 });

 it('hides buttons when canAdmin is false', () => {
 render(<UserCard user={mockUser} canAdmin={false} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 expect(screen.queryByLabelText('Modifier')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('Supprimer')).not.toBeInTheDocument();
 });

 it('calls onEdit when edit button clicked', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 fireEvent.click(screen.getByLabelText('Modifier'));

 expect(mockOnEdit).toHaveBeenCalledWith(mockUser);
 });

 it('calls onDelete when delete button clicked', () => {
 render(<UserCard user={mockUser} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 fireEvent.click(screen.getByLabelText('Supprimer'));

 expect(mockOnDelete).toHaveBeenCalledWith(mockUser);
 });
 });

 describe('last login handling', () => {
 it('does not show last login when not set', () => {
 render(<UserCard user={{ ...mockUser, lastLogin: undefined }} canAdmin={true} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

 // The date should not be present if lastLogin is undefined
 expect(screen.queryByText(new Date().toLocaleDateString('fr-FR'))).not.toBeInTheDocument();
 });
 });
});
