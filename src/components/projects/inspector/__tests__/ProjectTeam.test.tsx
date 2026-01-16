/**
 * Unit tests for ProjectTeam component
 * Tests team member display with avatars and roles
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectTeam } from '../ProjectTeam';
import { Project, UserProfile } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    Users: () => <span data-testid="users-icon" />
}));

// Mock Badge
vi.mock('../../../ui/Badge', () => ({
    Badge: ({ children, variant, status, className }: {
        children: React.ReactNode;
        variant?: string;
        status?: string;
        className?: string;
    }) => (
        <span data-testid="badge" data-variant={variant} data-status={status} className={className}>
            {children}
        </span>
    )
}));

// Mock avatarUtils
vi.mock('../../../../utils/avatarUtils', () => ({
    getUserAvatarUrl: (photoURL: string | null, role: string) =>
        photoURL || `https://avatar.example.com/${role}`
}));

describe('ProjectTeam', () => {
    const mockUsersList: UserProfile[] = [
        {
            uid: 'user-1',
            email: 'alice@example.com',
            displayName: 'Alice Martin',
            role: 'admin',
            photoURL: 'https://example.com/alice.jpg',
            organizationId: 'org-1'
        },
        {
            uid: 'user-2',
            email: 'bob@example.com',
            displayName: 'Bob Dupont',
            role: 'user',
            photoURL: null,
            organizationId: 'org-1'
        },
        {
            uid: 'user-3',
            email: 'charlie@example.com',
            displayName: 'Charlie Bernard',
            role: 'rssi',
            photoURL: 'https://example.com/charlie.jpg',
            organizationId: 'org-1'
        }
    ];

    const mockProject: Project = {
        id: 'project-1',
        name: 'Security Project',
        description: 'A security project',
        status: 'En cours',
        startDate: '2024-01-01',
        members: ['user-1', 'user-2']
    };

    const projectWithNoMembers: Project = {
        ...mockProject,
        members: []
    };

    const projectWithUndefinedMembers: Project = {
        ...mockProject,
        members: undefined
    };

    const defaultProps = {
        project: mockProject,
        usersList: mockUsersList
    };

    describe('with members', () => {
        it('renders member names', () => {
            render(<ProjectTeam {...defaultProps} />);

            expect(screen.getByText('Alice Martin')).toBeInTheDocument();
            expect(screen.getByText('Bob Dupont')).toBeInTheDocument();
        });

        it('renders member emails', () => {
            render(<ProjectTeam {...defaultProps} />);

            expect(screen.getByText('alice@example.com')).toBeInTheDocument();
            expect(screen.getByText('bob@example.com')).toBeInTheDocument();
        });

        it('renders member role badges', () => {
            render(<ProjectTeam {...defaultProps} />);

            expect(screen.getByText('admin')).toBeInTheDocument();
            expect(screen.getByText('user')).toBeInTheDocument();
        });

        it('renders correct number of members', () => {
            render(<ProjectTeam {...defaultProps} />);

            // Project has 2 members
            expect(screen.getAllByTestId('badge').length).toBe(2);
        });

        it('does not render non-members', () => {
            render(<ProjectTeam {...defaultProps} />);

            // Charlie is not in the project members list
            expect(screen.queryByText('Charlie Bernard')).not.toBeInTheDocument();
        });

        it('renders member avatars', () => {
            render(<ProjectTeam {...defaultProps} />);

            const images = screen.getAllByRole('img');
            expect(images.length).toBe(2);
        });

        it('uses correct avatar URL', () => {
            render(<ProjectTeam {...defaultProps} />);

            const aliceImage = screen.getByAltText('Alice Martin');
            expect(aliceImage).toHaveAttribute('src', 'https://example.com/alice.jpg');
        });
    });

    describe('empty state', () => {
        it('shows empty message when no members', () => {
            render(<ProjectTeam {...defaultProps} project={projectWithNoMembers} />);

            expect(screen.getByText('Aucun membre affecté à ce projet.')).toBeInTheDocument();
        });

        it('shows empty message when members undefined', () => {
            render(<ProjectTeam {...defaultProps} project={projectWithUndefinedMembers} />);

            expect(screen.getByText('Aucun membre affecté à ce projet.')).toBeInTheDocument();
        });

        it('shows users icon in empty state', () => {
            render(<ProjectTeam {...defaultProps} project={projectWithNoMembers} />);

            expect(screen.getByTestId('users-icon')).toBeInTheDocument();
        });
    });

    describe('fallback display name', () => {
        it('shows Utilisateur when displayName is empty', () => {
            const usersWithEmptyName: UserProfile[] = [
                {
                    ...mockUsersList[0],
                    displayName: ''
                }
            ];

            render(<ProjectTeam project={mockProject} usersList={usersWithEmptyName} />);

            expect(screen.getByText('Utilisateur')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-panel containers', () => {
            const { container } = render(<ProjectTeam {...defaultProps} />);

            expect(container.querySelectorAll('.glass-panel').length).toBe(2);
        });

        it('has proper grid layout', () => {
            const { container } = render(<ProjectTeam {...defaultProps} />);

            expect(container.querySelector('.grid')).toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('handles empty usersList', () => {
            render(<ProjectTeam project={mockProject} usersList={[]} />);

            // No members should be rendered even if project has member IDs
            expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
        });

        it('handles null usersList', () => {
            render(<ProjectTeam project={mockProject} usersList={null as unknown as UserProfile[]} />);

            // Should not crash - null is handled by safeUsersList fallback
            // Project has members but usersList is null so no members can be rendered
            expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
        });
    });
});
