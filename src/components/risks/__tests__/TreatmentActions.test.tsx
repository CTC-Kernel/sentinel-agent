/**
 * Tests for TreatmentActionForm and TreatmentActionsList components
 * Story 3.4: Risk Treatment Actions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreatmentActionForm } from '../TreatmentActionForm';
import { TreatmentActionsList } from '../TreatmentActionsList';
import { TreatmentAction } from '../../../types';

const mockUsers = [
    { uid: 'user-1', displayName: 'Jean Dupont' },
    { uid: 'user-2', displayName: 'Marie Martin' }
];

const createAction = (overrides: Partial<TreatmentAction> = {}): TreatmentAction => ({
    id: 'action-1',
    title: 'Test Action',
    description: 'Test description',
    ownerId: 'user-1',
    deadline: '2026-02-15',
    status: 'À faire',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...overrides
});

describe('TreatmentActionForm', () => {
    it('should render empty form for new action', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        expect(screen.getByText('Nouvelle action')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Mettre à jour/)).toHaveValue('');
        expect(screen.getByText('Ajouter')).toBeInTheDocument();
    });

    it('should render form with existing action data', () => {
        const action = createAction();
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                action={action}
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        expect(screen.getByText("Modifier l'action")).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Action')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
        expect(screen.getByText('Enregistrer')).toBeInTheDocument();
    });

    it('should show validation error when title is empty', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        fireEvent.click(screen.getByText('Ajouter'));

        expect(screen.getByText('Le titre est requis')).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('should call onSave with action data when form is valid', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        fireEvent.change(screen.getByPlaceholderText(/Mettre à jour/), {
            target: { value: 'New Action Title' }
        });

        fireEvent.click(screen.getByText('Ajouter'));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'New Action Title',
                status: 'À faire'
            })
        );
    });

    it('should call onCancel when cancel button is clicked', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        fireEvent.click(screen.getByText('Annuler'));

        expect(onCancel).toHaveBeenCalled();
    });

    it('should display user options in owner select', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
        expect(screen.getByText('Marie Martin')).toBeInTheDocument();
    });

    it('should display all status options', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        render(
            <TreatmentActionForm
                users={mockUsers}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        expect(screen.getByRole('option', { name: 'À faire' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'En cours' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Terminé' })).toBeInTheDocument();
    });
});

describe('TreatmentActionsList', () => {
    it('should display empty state when no actions', () => {
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        expect(screen.getByText(/Aucune action de traitement/)).toBeInTheDocument();
        expect(screen.getByText('Ajouter une action')).toBeInTheDocument();
    });

    it('should display actions count in header', () => {
        const actions = [createAction(), createAction({ id: 'action-2', title: 'Second Action' })];
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={actions}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        expect(screen.getByText('Actions de traitement (2)')).toBeInTheDocument();
    });

    it('should display action details', () => {
        const action = createAction();
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        expect(screen.getByText('Test Action')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
        expect(screen.getByText('À faire')).toBeInTheDocument();
    });

    it('should show progress indicator', () => {
        const actions = [
            createAction({ id: 'action-1', status: 'Terminé' }),
            createAction({ id: 'action-2', status: 'À faire' })
        ];
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={actions}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('should show add form when add button is clicked', () => {
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        fireEvent.click(screen.getByText('Ajouter une action'));

        expect(screen.getByText('Nouvelle action')).toBeInTheDocument();
    });

    it('should call onDelete when delete button is clicked', () => {
        const action = createAction();
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        fireEvent.click(screen.getByLabelText("Supprimer l'action"));

        expect(onDelete).toHaveBeenCalledWith('action-1');
    });

    it('should show edit form when edit button is clicked', () => {
        const action = createAction();
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        fireEvent.click(screen.getByLabelText("Modifier l'action"));

        expect(screen.getByText("Modifier l'action")).toBeInTheDocument();
    });

    it('should toggle status when status icon is clicked', () => {
        const action = createAction({ status: 'À faire' });
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        fireEvent.click(screen.getByTitle('Statut: À faire'));

        expect(onUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'action-1',
                status: 'En cours'
            })
        );
    });

    it('should style completed actions differently', () => {
        const action = createAction({ status: 'Terminé' });
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        const actionTitle = screen.getByText('Test Action');
        expect(actionTitle).toHaveClass('line-through');
    });

    it('should not show add/edit/delete buttons in readOnly mode', () => {
        const action = createAction();
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
                readOnly
            />
        );

        expect(screen.queryByText('Ajouter une action')).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Modifier l'action")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Supprimer l'action")).not.toBeInTheDocument();
    });

    it('should show overdue indicator for past deadline', () => {
        const action = createAction({ deadline: '2025-01-01' }); // Past date
        const onAdd = vi.fn();
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <TreatmentActionsList
                actions={[action]}
                users={mockUsers}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        );

        expect(screen.getByText('En retard')).toBeInTheDocument();
    });
});
