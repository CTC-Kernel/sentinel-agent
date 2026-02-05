/**
 * Tests for TreatmentActionForm and TreatmentActionsList components
 * Story 3.4: Risk Treatment Actions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreatmentActionForm } from '../TreatmentActionForm';
import { TreatmentActionsList } from '../TreatmentActionsList';
import { TreatmentAction } from '../../../types';

// Mock store
vi.mock('../../../store', () => ({
 useStore: () => ({
 language: 'fr',
 t: (key: string, options?: Record<string, unknown>) => {
 if (options && 'defaultValue' in options) {
 return (options as { defaultValue?: string }).defaultValue || key;
 }
 return key;
 }
 }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => {
 const translations: Record<string, string> = {
 'risks.treatment.actions_title': 'Actions de traitement',
 'risks.treatment.no_actions': 'Aucune action de traitement',
 'risks.treatment.add_action': 'Ajouter une action',
 'risks.treatment.edit_action': "Modifier l'action",
 'risks.treatment.delete_action': "Supprimer l'action",
 'risks.treatment.new_action': 'Nouvelle action',
 'risks.treatment.save': 'Enregistrer',
 'risks.treatment.cancel': 'Annuler',
 'risks.treatment.title_label': 'Titre',
 'risks.treatment.description_label': 'Description',
 'risks.treatment.owner_label': 'Responsable',
 'risks.treatment.deadline_label': 'Échéance',
 'risks.treatment.status_label': 'Statut',
 'risks.treatment.placeholder_title': 'Ex: Mettre à jour la politique de sécurité',
 'risks.treatment.placeholder_description': "Décrivez l'action à réaliser...",
 'risks.treatment.late': 'En retard',
 'risks.treatment.today': "Aujourd'hui",
 'risks.treatment.progress': 'Progression'
 };
 return translations[key] || key;
 },
 i18n: { language: 'fr' }
 }),
 Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useLocale to provide the required locale data
vi.mock('../../../hooks/useLocale', async () => {
 const { fr } = await import('date-fns/locale');
 return {
 useLocale: () => ({
 locale: 'fr',
 dateFnsLocale: fr,
 zodMessages: {
 required: 'Ce champ est requis',
 invalidType: 'Type de valeur invalide',
 invalidString: 'Ce champ doit être du texte',
 tooShort: (min: number) => `Minimum ${min} caractères requis`,
 tooLong: (max: number) => `Maximum ${max} caractères autorisés`,
 invalidEmail: 'Adresse email invalide',
 invalidUrl: 'URL invalide',
 invalidUuid: 'Identifiant invalide',
 invalidRegex: 'Format invalide',
 invalidNumber: 'Veuillez entrer un nombre valide',
 notInteger: 'Veuillez entrer un nombre entier',
 tooSmall: (min: number) => `La valeur doit être au moins ${min}`,
 tooBig: (max: number) => `La valeur doit être au maximum ${max}`,
 notPositive: 'La valeur doit être positive',
 notNegative: 'La valeur doit être négative',
 notNonNegative: 'La valeur ne peut pas être négative',
 invalidDate: 'Date invalide',
 arrayTooShort: (min: number) => `Sélectionnez au moins ${min} élément${min > 1 ? 's' : ''}`,
 arrayTooLong: (max: number) => `Maximum ${max} élément${max > 1 ? 's' : ''} autorisé${max > 1 ? 's' : ''}`,
 invalidEnum: (options: string[]) => `Valeur invalide. Options: ${options.join(', ')}`,
 custom: 'Valeur invalide',
 },
 formatDate: (date: Date) => date.toLocaleDateString('fr-FR'),
 formatNumber: (num: number) => num.toLocaleString('fr-FR'),
 }),
 };
});

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
 expect(screen.getByText('Ajouter une action')).toBeInTheDocument();
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

 it('should show validation error when title is empty', async () => {
 const user = userEvent.setup();
 const onSave = vi.fn();
 const onCancel = vi.fn();

 render(
 <TreatmentActionForm
 users={mockUsers}
 onSave={onSave}
 onCancel={onCancel}
 />
 );

 const submitButton = screen.getByText('Ajouter une action');
 await user.click(submitButton);

 await waitFor(() => {
 expect(screen.getByText('Le titre est requis')).toBeInTheDocument();
 });
 expect(onSave).not.toHaveBeenCalled();
 });

 it('should call onSave with action data when form is valid', async () => {
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

 fireEvent.click(screen.getByText('Ajouter une action'));

 await waitFor(() => {
 expect(onSave).toHaveBeenCalledWith(
 expect.objectContaining({
  title: 'New Action Title',
  status: 'À faire'
 })
 );
 });
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
