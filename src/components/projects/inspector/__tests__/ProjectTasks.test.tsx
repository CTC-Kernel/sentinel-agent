/**
 * Unit tests for ProjectTasks component
 * Tests task management with list and kanban views
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectTasks } from '../ProjectTasks';
import { Project, ProjectTask, UserProfile } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
 Plus: () => <span data-testid="plus-icon" />,
 CheckSquare: () => <span data-testid="check-square-icon" />,
 CalendarDays: () => <span data-testid="calendar-days-icon" />,
 Trash2: () => <span data-testid="trash2-icon" />,
 X: () => <span data-testid="x-icon" />,
 ChevronLeft: () => <span data-testid="chevron-left-icon" />,
 ChevronRight: () => <span data-testid="chevron-right-icon" />
}));

// Mock Button
vi.mock('../../../ui/button', () => ({
 Button: ({ children, onClick, className }: {
 children: React.ReactNode;
 onClick?: () => void;
 className?: string;
 }) => (
 <button onClick={onClick} className={className}>
 {children}
 </button>
 )
}));

// Mock KanbanColumn
vi.mock('../../KanbanColumn', () => ({
 KanbanColumn: ({ status, tasks, onEditTask, onDeleteTask }: {
 status: string;
 tasks: ProjectTask[];
 canEdit: boolean;
 draggedTaskId: string | null;
 onDragOver: (e: React.DragEvent) => void;
 onDrop: (e: React.DragEvent, status: string) => void;
 onDragStart: (e: React.DragEvent, taskId: string) => void;
 onEditTask: (task: ProjectTask) => void;
 onDeleteTask: (taskId: string) => void;
 }) => (
 <div data-testid={`kanban-column-${status.replace(/\s/g, '-')}`}>
 <h3>{status}</h3>
 <p>{tasks.length} tasks</p>
 {tasks.map(task => (
 <div key={task.id || 'unknown'} data-testid={`kanban-task-${task.id}`}>
  <span>{task.title}</span>
  <button onClick={() => onEditTask(task)} data-testid={`edit-${task.id}`}>Edit</button>
  <button onClick={() => onDeleteTask(task.id)} data-testid={`delete-${task.id}`}>Delete</button>
 </div>
 ))}
 </div>
 )
}));

// Mock TaskFormDrawer
vi.mock('../../TaskFormDrawer', () => ({
 TaskFormDrawer: ({ isOpen, onClose, onSubmit }: {
 isOpen: boolean;
 onClose: () => void;
 onSubmit: (data: Partial<ProjectTask>) => void;
 existingTask?: ProjectTask;
 availableTasks: ProjectTask[];
 availableUsers: UserProfile[];
 }) => isOpen ? (
 <div data-testid="task-form-modal">
 <button onClick={onClose} data-testid="close-modal">Close</button>
 <button
 onClick={() => onSubmit({ title: 'New Task', status: 'À faire' })}
 data-testid="submit-task"
 >
 Submit
 </button>
 </div>
 ) : null
}));

// Mock ConfirmModal
vi.mock('../../../ui/ConfirmModal', () => ({
 ConfirmModal: ({ isOpen, onClose, onConfirm, title }: {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string;
 confirmText: string;
 type: string;
 }) => isOpen ? (
 <div data-testid="confirm-modal">
 <h3>{title}</h3>
 <button onClick={onClose} data-testid="cancel-delete">Cancel</button>
 <button onClick={onConfirm} data-testid="confirm-delete">Confirm</button>
 </div>
 ) : null
}));

// Mock Drawer
vi.mock('../../../ui/Drawer', () => ({
 Drawer: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
 isOpen ? <div data-testid="drawer">{children}</div> : null
}));

// Mock calendarUtils
vi.mock('../../../../utils/calendarUtils', () => ({
 generateICS: vi.fn(() => 'ICS_CONTENT'),
 downloadICS: vi.fn()
}));

// Mock dataSanitizer
vi.mock('../../../../utils/dataSanitizer', () => ({
 sanitizeData: (data: unknown) => data
}));

describe('ProjectTasks', () => {
 const mockOnUpdateTasks = vi.fn();

 const mockTasks: ProjectTask[] = [
 {
 id: 'task-1',
 title: 'Setup environment',
 description: 'Configure development environment',
 status: 'Terminé',
 startDate: '2024-01-01',
 dueDate: '2024-01-15',
 assigneeId: 'user-1',
 priority: 'medium'
 },
 {
 id: 'task-2',
 title: 'Implement feature',
 description: 'Build the main feature',
 status: 'En cours',
 startDate: '2024-01-10',
 dueDate: '2024-01-30',
 assigneeId: 'user-1',
 priority: 'high'
 },
 {
 id: 'task-3',
 title: 'Write tests',
 description: 'Add unit tests',
 status: 'À faire',
 startDate: '2024-02-01',
 dueDate: '2024-02-15',
 assigneeId: 'user-1',
 priority: 'low'
 }
 ];

 const mockProject = {
 id: 'project-1',
 name: 'Test Project',
 description: 'A test project',
 status: 'En cours',
 startDate: '2024-01-01',
 tasks: mockTasks,
 organizationId: 'org-1',
 manager: 'Manager',
 dueDate: '2024-12-31',
 progress: 0,
 createdAt: '2024-01-01',
 updatedAt: '2024-01-01',
 createdBy: 'user-1'
 } as Project;

 const projectWithNoTasks = {
 ...mockProject,
 tasks: []
 } as Project;

 const mockUsersList: UserProfile[] = [
 {
 uid: 'user-1',
 email: 'user@example.com',
 displayName: 'User One',
 role: 'user',
 organizationId: 'org-1'
 }
 ];

 const defaultProps = {
 project: mockProject,
 canEdit: true,
 usersList: mockUsersList,
 onUpdateTasks: mockOnUpdateTasks
 };

 beforeEach(() => {
 vi.clearAllMocks();
 mockOnUpdateTasks.mockResolvedValue(undefined);
 });

 describe('view mode toggle', () => {
 it('renders list view button', () => {
 render(<ProjectTasks {...defaultProps} />);

 expect(screen.getByText('Liste')).toBeInTheDocument();
 });

 it('renders board view button', () => {
 render(<ProjectTasks {...defaultProps} />);

 expect(screen.getByText('Tableau')).toBeInTheDocument();
 });

 it('shows board view by default', () => {
 render(<ProjectTasks {...defaultProps} />);

 // Kanban columns should be visible
 expect(screen.getByTestId('kanban-column-À-faire')).toBeInTheDocument();
 expect(screen.getByTestId('kanban-column-En-cours')).toBeInTheDocument();
 expect(screen.getByTestId('kanban-column-Terminé')).toBeInTheDocument();
 });

 it('switches to list view when clicked', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Liste'));

 // List items should be visible
 expect(screen.getByText('Setup environment')).toBeInTheDocument();
 expect(screen.getByText('Implement feature')).toBeInTheDocument();
 });
 });

 describe('new task button', () => {
 it('renders new task button when canEdit', () => {
 render(<ProjectTasks {...defaultProps} />);

 expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument();
 });

 it('hides new task button when not canEdit', () => {
 render(<ProjectTasks {...defaultProps} canEdit={false} />);

 expect(screen.queryByText('Nouvelle tâche')).not.toBeInTheDocument();
 });

 it('opens task modal when clicked', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Nouvelle tâche'));

 expect(screen.getByTestId('task-form-modal')).toBeInTheDocument();
 });
 });

 describe('list view', () => {
 it('displays all tasks in list view', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Liste'));

 expect(screen.getByText('Setup environment')).toBeInTheDocument();
 expect(screen.getByText('Implement feature')).toBeInTheDocument();
 expect(screen.getByText('Write tests')).toBeInTheDocument();
 });

 it('shows check icon for completed tasks', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Liste'));

 // At least one check-square icon should be visible for completed task
 expect(screen.getAllByTestId('check-square-icon').length).toBeGreaterThan(0);
 });

 it('shows calendar icon in list view', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Liste'));

 expect(screen.getAllByTestId('calendar-days-icon').length).toBeGreaterThan(0);
 });

 it('shows delete icon in list view when canEdit', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Liste'));

 expect(screen.getAllByTestId('trash2-icon').length).toBeGreaterThan(0);
 });
 });

 describe('board view', () => {
 it('renders three kanban columns', () => {
 render(<ProjectTasks {...defaultProps} />);

 expect(screen.getByTestId('kanban-column-À-faire')).toBeInTheDocument();
 expect(screen.getByTestId('kanban-column-En-cours')).toBeInTheDocument();
 expect(screen.getByTestId('kanban-column-Terminé')).toBeInTheDocument();
 });

 it('shows correct task count per column', () => {
 render(<ProjectTasks {...defaultProps} />);

 // Each column shows task count (all have 1 task each)
 expect(screen.getAllByText('1 tasks').length).toBe(3);
 });
 });

 describe('task submission', () => {
 it('calls onUpdateTasks when task submitted', async () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByText('Nouvelle tâche'));
 fireEvent.click(screen.getByTestId('submit-task'));

 await waitFor(() => {
 expect(mockOnUpdateTasks).toHaveBeenCalled();
 });
 });
 });

 describe('task deletion', () => {
 it('shows confirm modal when delete clicked in board view', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByTestId('delete-task-1'));

 expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
 });

 it('shows correct delete title in confirm modal', () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByTestId('delete-task-1'));

 expect(screen.getByText('Supprimer la tâche')).toBeInTheDocument();
 });

 it('calls onUpdateTasks when delete confirmed', async () => {
 render(<ProjectTasks {...defaultProps} />);

 fireEvent.click(screen.getByTestId('delete-task-1'));
 fireEvent.click(screen.getByTestId('confirm-delete'));

 await waitFor(() => {
 expect(mockOnUpdateTasks).toHaveBeenCalled();
 });
 });
 });

 describe('empty state', () => {
 it('renders empty list view with no tasks', () => {
 render(<ProjectTasks {...defaultProps} project={projectWithNoTasks} />);

 fireEvent.click(screen.getByText('Liste'));

 // No task items should be shown
 expect(screen.queryByText('Setup environment')).not.toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('has proper view toggle styling', () => {
 const { container } = render(<ProjectTasks {...defaultProps} />);

 expect(container.querySelector('.rounded-3xl')).toBeInTheDocument();
 });
 });
});
