/**
 * Unit tests for ProjectCard component
 * Tests project card display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';
import { Project, UserProfile } from '../../../types';

// Mock permissions
vi.mock('../../../utils/permissions', () => ({
 canDeleteResource: vi.fn(() => true)
}));

// Mock avatar utils
vi.mock('../../../utils/avatarUtils', () => ({
 getUserAvatarUrl: vi.fn((url, role) => url || `https://avatar.vercel.sh/${role}`)
}));

describe('ProjectCard', () => {
 const mockProject: Project = {
 id: 'proj-1',
 name: 'Test Project',
 description: 'A test project description',
 status: 'En cours',
 progress: 65,
 members: ['user-1', 'user-2'],
 tasks: [
 { id: 't1', title: 'Task 1', status: 'En cours', assigneeId: 'user-1' }
 ],
 organizationId: 'org-1',
 manager: 'Test Manager',
 dueDate: '2024-12-31',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString()
 };

 const mockUser: UserProfile = {
 uid: 'user-1',
 email: 'test@example.com',
 role: 'admin',
 displayName: 'Test User',
 photoURL: null,
 organizationId: 'org-1'
 };

 const mockUsersList: UserProfile[] = [
 mockUser,
 {
 uid: 'user-2',
 email: 'user2@example.com',
 role: 'user',
 displayName: 'User Two',
 photoURL: null,
 organizationId: 'org-1'
 }
 ];

 const defaultProps = {
 project: mockProject,
 canEdit: true,
 user: mockUser,
 usersList: mockUsersList,
 onEdit: vi.fn(),
 onDelete: vi.fn().mockResolvedValue(undefined),
 onClick: vi.fn(),
 onDuplicate: vi.fn()
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders project name', () => {
 render(<ProjectCard {...defaultProps} />);

 expect(screen.getByText('Test Project')).toBeInTheDocument();
 });

 it('renders project description', () => {
 render(<ProjectCard {...defaultProps} />);

 expect(screen.getByText('A test project description')).toBeInTheDocument();
 });

 it('renders project status', () => {
 render(<ProjectCard {...defaultProps} />);

 expect(screen.getByText('En cours')).toBeInTheDocument();
 });

 it('renders project progress', () => {
 render(<ProjectCard {...defaultProps} />);

 expect(screen.getByText('65%')).toBeInTheDocument();
 });

 it('renders task count', () => {
 render(<ProjectCard {...defaultProps} />);

 expect(screen.getByText('1')).toBeInTheDocument();
 });

 it('renders team member avatars', () => {
 render(<ProjectCard {...defaultProps} />);

 const images = screen.getAllByRole('img');
 expect(images.length).toBe(2); // 2 members
 });
 });

 describe('compact mode', () => {
 it('hides description in compact mode', () => {
 render(<ProjectCard {...defaultProps} compact />);

 expect(screen.queryByText('A test project description')).not.toBeInTheDocument();
 });

 it('hides action buttons in compact mode', () => {
 render(<ProjectCard {...defaultProps} compact />);

 expect(screen.queryByLabelText(/Dupliquer/)).not.toBeInTheDocument();
 });
 });

 describe('interactions', () => {
 it('calls onClick when card is clicked', () => {
 render(<ProjectCard {...defaultProps} />);

 // Get all buttons and find the main card button (first one, contains project name)
 const buttons = screen.getAllByRole('button');
 const cardButton = buttons.find(b => b.textContent?.includes('Test Project'));
 expect(cardButton).toBeDefined();
 fireEvent.click(cardButton!);

 expect(defaultProps.onClick).toHaveBeenCalledWith(mockProject);
 });

 it('calls onClick on Enter key', () => {
 render(<ProjectCard {...defaultProps} />);

 const buttons = screen.getAllByRole('button');
 const cardButton = buttons.find(b => b.textContent?.includes('Test Project'));
 fireEvent.keyDown(cardButton!, { key: 'Enter' });

 expect(defaultProps.onClick).toHaveBeenCalledWith(mockProject);
 });

 it('calls onClick on Space key', () => {
 render(<ProjectCard {...defaultProps} />);

 const buttons = screen.getAllByRole('button');
 const cardButton = buttons.find(b => b.textContent?.includes('Test Project'));
 fireEvent.keyDown(cardButton!, { key: ' ' });

 expect(defaultProps.onClick).toHaveBeenCalledWith(mockProject);
 });

 it('calls onDuplicate when duplicate button is clicked', () => {
 render(<ProjectCard {...defaultProps} />);

 const duplicateButton = screen.getByLabelText(/Dupliquer le projet/);
 fireEvent.click(duplicateButton);

 expect(defaultProps.onDuplicate).toHaveBeenCalledWith(mockProject);
 });

 it('calls onDelete when delete button is clicked', async () => {
 render(<ProjectCard {...defaultProps} />);

 const deleteButton = screen.getByLabelText(/Supprimer le projet/);
 fireEvent.click(deleteButton);

 await waitFor(() => {
 expect(defaultProps.onDelete).toHaveBeenCalledWith('proj-1', 'Test Project');
 });
 });
 });

 describe('edit permissions', () => {
 it('hides action buttons when canEdit is false', () => {
 render(<ProjectCard {...defaultProps} canEdit={false} />);

 expect(screen.queryByLabelText(/Dupliquer/)).not.toBeInTheDocument();
 expect(screen.queryByLabelText(/Supprimer/)).not.toBeInTheDocument();
 });

 it('shows action buttons when canEdit is true', () => {
 render(<ProjectCard {...defaultProps} canEdit={true} />);

 expect(screen.getByLabelText(/Dupliquer le projet/)).toBeInTheDocument();
 });
 });

 describe('status badges', () => {
 it('renders En cours status correctly', () => {
 render(<ProjectCard {...defaultProps} project={{ ...mockProject, status: 'En cours' }} />);

 expect(screen.getByText('En cours')).toBeInTheDocument();
 });

 it('renders Terminé status correctly', () => {
 render(<ProjectCard {...defaultProps} project={{ ...mockProject, status: 'Terminé' }} />);

 expect(screen.getByText('Terminé')).toBeInTheDocument();
 });

 it('renders Suspendu status correctly', () => {
 render(<ProjectCard {...defaultProps} project={{ ...mockProject, status: 'Suspendu' }} />);

 expect(screen.getByText('Suspendu')).toBeInTheDocument();
 });
 });

 describe('empty team', () => {
 it('shows no team message when members list is empty', () => {
 render(<ProjectCard {...defaultProps} project={{ ...mockProject, members: [] }} />);

 expect(screen.getByText('Aucune équipe')).toBeInTheDocument();
 });
 });

 describe('many team members', () => {
 it('shows +N indicator when more than 3 members', () => {
 const manyMembers: UserProfile[] = [
 ...mockUsersList,
 { uid: 'user-3', email: 'u3@test.com', role: 'user', displayName: 'User 3', photoURL: null, organizationId: 'org-1' },
 { uid: 'user-4', email: 'u4@test.com', role: 'user', displayName: 'User 4', photoURL: null, organizationId: 'org-1' },
 { uid: 'user-5', email: 'u5@test.com', role: 'user', displayName: 'User 5', photoURL: null, organizationId: 'org-1' }
 ];

 render(
 <ProjectCard
  {...defaultProps}
  project={{ ...mockProject, members: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'] }}
  usersList={manyMembers}
 />
 );

 expect(screen.getByText('+2')).toBeInTheDocument();
 });
 });
});
