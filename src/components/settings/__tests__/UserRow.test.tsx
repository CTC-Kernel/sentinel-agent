/**
 * Unit tests for UserRow component
 * Tests user management row display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserRow } from '../UserRow';
import { UserProfile, Organization } from '../../../types';

// Mock avatar utils
vi.mock('../../../utils/avatarUtils', () => ({
    getUserAvatarUrl: vi.fn((url, role) => url || `https://avatar.vercel.sh/${role}`)
}));

// Mock CustomSelect
vi.mock('../../ui/CustomSelect', () => ({
    CustomSelect: ({ value, onChange, options, disabled, label }: {
        value: string;
        onChange: (val: string) => void;
        options: { value: string; label: string }[];
        disabled: boolean;
        label: string;
    }) => (
        <select
            data-testid="role-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-label={label}
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )
}));

describe('UserRow', () => {
    const mockT = (key: string) => {
        const translations: Record<string, string> = {
            'settings.owner': 'Propriétaire',
            'settings.you': 'Vous',
            'settings.role': 'Rôle',
            'settings.transferOwnership': 'Transférer la propriété',
            'settings.removeMember': 'Retirer le membre',
            'settings.roles.admin': 'Admin',
            'settings.roles.rssi': 'RSSI',
            'settings.roles.auditor': 'Auditeur',
            'settings.roles.project_manager': 'Chef de projet',
            'settings.roles.direction': 'Direction',
            'settings.roles.user': 'Utilisateur'
        };
        return translations[key] || key;
    };

    const mockCurrentUser: UserProfile = {
        uid: 'current-user',
        email: 'current@example.com',
        displayName: 'Current User',
        role: 'admin',
        photoURL: null,
        organizationId: 'org-1'
    };

    const mockTargetUser: UserProfile = {
        uid: 'target-user',
        email: 'target@example.com',
        displayName: 'Target User',
        role: 'user',
        photoURL: null,
        organizationId: 'org-1'
    };

    const mockOrg: Organization = {
        id: 'org-1',
        name: 'Test Org',
        ownerId: 'owner-user',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockOnUpdateRole = vi.fn();
    const mockOnTransfer = vi.fn();
    const mockOnRemove = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders user display name', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByText('Target User')).toBeInTheDocument();
        });

        it('renders user email', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByText('target@example.com')).toBeInTheDocument();
        });

        it('renders avatar image', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByAltText('Target User')).toBeInTheDocument();
        });

        it('renders role selector', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByTestId('role-select')).toBeInTheDocument();
        });
    });

    describe('owner badge', () => {
        it('shows owner badge for organization owner', () => {
            const ownerUser = { ...mockTargetUser, uid: 'owner-user' };
            render(
                <UserRow
                    user={ownerUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByText('Propriétaire')).toBeInTheDocument();
        });

        it('does not show owner badge for non-owners', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.queryByText('Propriétaire')).not.toBeInTheDocument();
        });
    });

    describe('current user badge', () => {
        it('shows "You" badge for current user', () => {
            render(
                <UserRow
                    user={mockCurrentUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByText('Vous')).toBeInTheDocument();
        });

        it('does not show "You" badge for other users', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.queryByText('Vous')).not.toBeInTheDocument();
        });
    });

    describe('role update', () => {
        it('calls onUpdateRole when role is changed', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            fireEvent.change(screen.getByTestId('role-select'), { target: { value: 'admin' } });

            expect(mockOnUpdateRole).toHaveBeenCalledWith('target-user', 'admin');
        });

        it('disables role selector for current user', () => {
            render(
                <UserRow
                    user={mockCurrentUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByTestId('role-select')).toBeDisabled();
        });

        it('disables role selector for owner', () => {
            const ownerUser = { ...mockTargetUser, uid: 'owner-user' };
            render(
                <UserRow
                    user={ownerUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByTestId('role-select')).toBeDisabled();
        });
    });

    describe('transfer ownership', () => {
        it('shows transfer button when current user is owner viewing another user', () => {
            const ownerCurrentUser = { ...mockCurrentUser, uid: 'owner-user' };
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={ownerCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByLabelText('Transférer la propriété')).toBeInTheDocument();
        });

        it('calls onTransfer when transfer button clicked', () => {
            const ownerCurrentUser = { ...mockCurrentUser, uid: 'owner-user' };
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={ownerCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            fireEvent.click(screen.getByLabelText('Transférer la propriété'));

            expect(mockOnTransfer).toHaveBeenCalledWith('target-user');
        });
    });

    describe('remove member', () => {
        it('shows remove button for admin viewing other user', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.getByLabelText('Retirer le membre')).toBeInTheDocument();
        });

        it('calls onRemove when remove button clicked', () => {
            render(
                <UserRow
                    user={mockTargetUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            fireEvent.click(screen.getByLabelText('Retirer le membre'));

            expect(mockOnRemove).toHaveBeenCalledWith('target-user');
        });

        it('does not show remove button when viewing self', () => {
            render(
                <UserRow
                    user={mockCurrentUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.queryByLabelText('Retirer le membre')).not.toBeInTheDocument();
        });

        it('does not show remove button for owner', () => {
            const ownerUser = { ...mockTargetUser, uid: 'owner-user' };
            render(
                <UserRow
                    user={ownerUser}
                    currentUser={mockCurrentUser}
                    currentOrg={mockOrg}
                    updating={false}
                    onUpdateRole={mockOnUpdateRole}
                    onTransfer={mockOnTransfer}
                    onRemove={mockOnRemove}
                    t={mockT}
                />
            );

            expect(screen.queryByLabelText('Retirer le membre')).not.toBeInTheDocument();
        });
    });
});
