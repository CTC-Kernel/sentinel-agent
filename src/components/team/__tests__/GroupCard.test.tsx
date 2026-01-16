/**
 * Unit tests for GroupCard component
 * Tests group card display and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupCard } from '../GroupCard';
import { UserGroup, UserProfile } from '../../../types';

// Mock Icons
vi.mock('../../ui/Icons', () => ({
    Edit: () => <span data-testid="edit-icon" />,
    Trash2: () => <span data-testid="trash-icon" />,
    Users: () => <span data-testid="users-icon" />
}));

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
            <h3>{title}</h3>
            <p>{message}</p>
            <button onClick={onClose} data-testid="cancel-delete">Annuler</button>
            <button onClick={onConfirm} data-testid="confirm-delete">Supprimer</button>
        </div>
    ) : null
}));

// Mock avatarUtils
vi.mock('../../../utils/avatarUtils', () => ({
    getDefaultAvatarUrl: (role: string) => `https://avatar.example.com/${role}.png`
}));

describe('GroupCard', () => {
    const mockOnEdit = vi.fn();
    const mockOnDelete = vi.fn();

    const mockUsers: UserProfile[] = [
        {
            uid: 'user-1',
            email: 'alice@example.com',
            displayName: 'Alice Martin',
            role: 'admin',
            organizationId: 'org-1'
        },
        {
            uid: 'user-2',
            email: 'bob@example.com',
            displayName: 'Bob Dupont',
            role: 'user',
            organizationId: 'org-1'
        },
        {
            uid: 'user-3',
            email: 'charlie@example.com',
            displayName: 'Charlie Durand',
            role: 'user',
            organizationId: 'org-1'
        }
    ];

    const mockGroup: UserGroup = {
        id: 'group-1',
        organizationId: 'org-1',
        name: 'Security Team',
        description: 'Handles security operations',
        members: ['user-1', 'user-2']
    };

    const groupWithoutDescription: UserGroup = {
        ...mockGroup,
        description: undefined
    };

    const groupWithManyMembers: UserGroup = {
        ...mockGroup,
        members: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7']
    };

    const emptyGroup: UserGroup = {
        ...mockGroup,
        members: []
    };

    const defaultProps = {
        group: mockGroup,
        users: mockUsers,
        onEdit: mockOnEdit,
        onDelete: mockOnDelete
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('group display', () => {
        it('displays group name', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByText('Security Team')).toBeInTheDocument();
        });

        it('displays member count', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByText('2 membres')).toBeInTheDocument();
        });

        it('displays group description', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByText('Handles security operations')).toBeInTheDocument();
        });

        it('shows fallback when no description', () => {
            render(<GroupCard {...defaultProps} group={groupWithoutDescription} />);

            expect(screen.getByText('Aucune description')).toBeInTheDocument();
        });

        it('renders users icon', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByTestId('users-icon')).toBeInTheDocument();
        });
    });

    describe('member avatars', () => {
        it('displays member avatars', () => {
            render(<GroupCard {...defaultProps} />);

            const avatars = screen.getAllByAltText(/Alice|Bob/);
            expect(avatars.length).toBe(2);
        });

        it('shows +N indicator for many members', () => {
            render(<GroupCard {...defaultProps} group={groupWithManyMembers} />);

            expect(screen.getByText('+2')).toBeInTheDocument();
        });

        it('handles empty members list', () => {
            render(<GroupCard {...defaultProps} group={emptyGroup} />);

            expect(screen.getByText('0 membres')).toBeInTheDocument();
        });
    });

    describe('edit action', () => {
        it('renders edit button', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByLabelText('Modifier le groupe Security Team')).toBeInTheDocument();
        });

        it('calls onEdit when edit button clicked', () => {
            render(<GroupCard {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Modifier le groupe Security Team'));

            expect(mockOnEdit).toHaveBeenCalledWith(mockGroup);
        });

        it('renders edit icon', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
        });
    });

    describe('delete action', () => {
        it('renders delete button', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByLabelText('Supprimer le groupe Security Team')).toBeInTheDocument();
        });

        it('shows confirm modal when delete clicked', () => {
            render(<GroupCard {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Supprimer le groupe Security Team'));

            expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
        });

        it('displays confirm modal title', () => {
            render(<GroupCard {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Supprimer le groupe Security Team'));

            expect(screen.getByText('Supprimer le groupe')).toBeInTheDocument();
        });

        it('displays confirm modal message', () => {
            render(<GroupCard {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Supprimer le groupe Security Team'));

            expect(screen.getByText('Êtes-vous sûr de vouloir supprimer le groupe "Security Team" ?')).toBeInTheDocument();
        });

        it('calls onDelete when confirmed', () => {
            render(<GroupCard {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Supprimer le groupe Security Team'));
            fireEvent.click(screen.getByTestId('confirm-delete'));

            expect(mockOnDelete).toHaveBeenCalledWith('group-1');
        });

        it('closes modal when canceled', () => {
            render(<GroupCard {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Supprimer le groupe Security Team'));
            fireEvent.click(screen.getByTestId('cancel-delete'));

            expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
        });

        it('renders trash icon', () => {
            render(<GroupCard {...defaultProps} />);

            expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has card styling', () => {
            const { container } = render(<GroupCard {...defaultProps} />);

            expect(container.querySelector('.rounded-2xl')).toBeInTheDocument();
        });

        it('has shadow on hover', () => {
            const { container } = render(<GroupCard {...defaultProps} />);

            expect(container.querySelector('.hover\\:shadow-md')).toBeInTheDocument();
        });
    });
});
