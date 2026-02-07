/**
 * Homologation View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Homologation from '../Homologation';

// Mock dependencies
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => key,
 i18n: { language: 'fr' }
 })
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
 const actual = await vi.importActual('react-router-dom');
 return {
 ...actual,
 useNavigate: () => mockNavigate
 };
});

const mockCreateDossier = vi.fn();
const mockDeleteDossier = vi.fn();

vi.mock('../../hooks/useHomologation', () => ({
 useHomologation: () => ({
 dossiers: [
 {
 id: 'dossier-1',
 name: 'Test Dossier',
 systemName: 'Test System',
 level: 'standard',
 status: 'draft',
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now())
 }
 ],
 loading: false,
 error: null,
 stats: {
 total: 1,
 byLevel: { etoile: 0, simple: 0, standard: 1, renforce: 0 },
 byStatus: { draft: 1, in_progress: 0, pending_decision: 0, homologated: 0, expired: 0, revoked: 0 },
 expiringSoon: 0,
 expired: 0
 },
 createDossier: mockCreateDossier,
 deleteDossier: mockDeleteDossier
 })
}));

vi.mock('../../hooks/useAuth', () => ({
 useAuth: () => ({
 user: { uid: 'user-123', email: 'test@example.com' }
 })
}));

vi.mock('../../components/homologation', () => ({
 LevelDeterminationWizard: ({ onComplete }: { onComplete: () => void }) => (
 <div data-testid="level-wizard">
 <button onClick={onComplete}>Complete Wizard</button>
 </div>
 ),
 HomologationDossierList: ({ onEdit, onDelete }: { onEdit: (d: unknown) => void; onDelete: (d: unknown) => void }) => (
 <div data-testid="dossier-list">
 <button onClick={() => onEdit({ id: 'dossier-1' })}>Edit Dossier</button>
 <button onClick={() => onDelete({ id: 'dossier-1', name: 'Test' })}>Delete Dossier</button>
 </div>
 ),
 HomologationValidityWidget: () => <div data-testid="validity-widget">Validity Widget</div>,
 RenewalDialog: () => <div data-testid="renewal-dialog">Renewal Dialog</div>
}));

vi.mock('../../lib/toast', () => ({
 toast: {
 success: vi.fn(),
 error: vi.fn()
 }
}));

vi.mock('../../types/homologation', async () => {
 const actual = await vi.importActual<typeof import('../../types/homologation')>('../../types/homologation');
 return {
 ...actual,
 LEVEL_INFO: {
 etoile: { label: 'Étoile', color: '#FCD34D' },
 simple: { label: 'Simple', color: '#60A5FA' },
 standard: { label: 'Standard', color: '#34D399' },
 renforce: { label: 'Renforcé', color: '#F87171' }
 }
 };
});

vi.mock('../../components/ui/button', () => ({
 Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
 <button onClick={onClick} {...props}>{children}</button>
 )
}));

vi.mock('../../components/ui/card', () => ({
 Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../../components/ui/dialog', () => ({
 Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
 open ? <div data-testid="dialog">{children}</div> : null,
 DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>
}));

vi.mock('../../components/ui/tabs', () => ({
 Tabs: ({ children, defaultValue }: { children: React.ReactNode; defaultValue: string }) => (
 <div data-testid="tabs" data-value={defaultValue}>{children}</div>
 ),
 TabsList: ({ children }: { children: React.ReactNode }) => <div role="tablist">{children}</div>,
 TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
 <button role="tab" data-value={value}>{children}</button>
 ),
 TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
 <div role="tabpanel" data-value={value}>{children}</div>
 )
}));

vi.mock('../../components/ui/ConfirmModal', () => ({
 ConfirmModal: ({ isOpen, onConfirm, onCancel }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) =>
 isOpen ? (
 <div data-testid="confirm-modal">
 <button onClick={onConfirm}>Confirm</button>
 <button onClick={onCancel}>Cancel</button>
 </div>
 ) : null
}));

const renderComponent = () => {
 return render(
 <BrowserRouter>
 <Homologation />
 </BrowserRouter>
 );
};

describe('Homologation View', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders the main structure', () => {
 renderComponent();
 // Multiple dossier lists are rendered (one per tab)
 const dossierLists = screen.getAllByTestId('dossier-list');
 expect(dossierLists.length).toBeGreaterThan(0);
 });

 it('renders the validity widget', () => {
 renderComponent();
 expect(screen.getByTestId('validity-widget')).toBeInTheDocument();
 });

 it('renders tabs for different views', () => {
 renderComponent();
 expect(screen.getByTestId('tabs')).toBeInTheDocument();
 });

 it('opens delete confirmation when delete is clicked', async () => {
 renderComponent();
 // Multiple delete buttons exist (one per tab), click the first one
 const deleteButtons = screen.getAllByText('Delete Dossier');
 fireEvent.click(deleteButtons[0]);
 await waitFor(() => {
 expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
 });
 });

 it('navigates to dossier edit page on edit', () => {
 renderComponent();
 // Multiple edit buttons exist (one per tab), click the first one
 const editButtons = screen.getAllByText('Edit Dossier');
 fireEvent.click(editButtons[0]);
 // Component calls handleEditDossier which navigates to /homologation/{id}/edit
 expect(mockNavigate).toHaveBeenCalledWith('/homologation/dossier-1/edit');
 });

 it('exports as default', async () => {
 const module = await import('../Homologation');
 expect(module.default).toBeDefined();
 });
});
