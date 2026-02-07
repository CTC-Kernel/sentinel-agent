/**
 * FinancialRisk View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FinancialRisk from '../FinancialRisk';

// Hoisted mock for translations
const { mockT } = vi.hoisted(() => ({
 mockT: (key: string) => key
}));

vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: mockT,
 i18n: { language: 'fr' }
 })
}));

vi.mock('../../hooks/useLocale', () => ({
 useLocale: () => ({
 locale: 'fr',
 t: mockT,
 formatDate: (date: Date) => date.toLocaleDateString('fr-FR'),
 formatNumber: (num: number) => num.toLocaleString('fr-FR'),
 formatCurrency: (num: number) => num.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
 })
}));

const mockRunSimulation = vi.fn();
const mockCreateConfig = vi.fn();
const mockDeleteConfig = vi.fn();

vi.mock('../../hooks/useFAIR', () => ({
 useFAIR: () => ({
 configurations: [
 {
 id: 'config-1',
 name: 'Test Config',
 lossEventFrequency: { distribution: { mostLikely: 2 } },
 primaryLossMagnitude: {
 currency: 'EUR',
 distribution: { min: 1000, max: 10000 }
 },
 vulnerability: {
 controlStrength: { overall: 70 },
 vulnerabilityScore: 30
 },
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now())
 }
 ],
 selectedConfig: null,
 simulationResults: null,
 loading: false,
 simulating: false,
 error: null,
 selectConfiguration: vi.fn(),
 createFromSimpleForm: mockCreateConfig,
 deleteConfiguration: mockDeleteConfig,
 duplicateConfiguration: vi.fn(),
 runSimulation: mockRunSimulation,
 clearSelection: vi.fn()
 })
}));

vi.mock('../../lib/toast', () => ({
 toast: {
 success: vi.fn(),
 error: vi.fn()
 }
}));

vi.mock('../../components/fair/FAIRConfigList', () => ({
 FAIRConfigList: ({ onSelect, onDelete }: { onSelect: (c: unknown) => void; onDelete: (c: unknown) => void }) => (
 <div data-testid="config-list">
 <button onClick={() => onSelect({ id: 'config-1' })}>Select Config</button>
 <button onClick={() => onDelete({ id: 'config-1' })}>Delete Config</button>
 </div>
 )
}));

vi.mock('../../components/fair/FAIRSimpleForm', () => ({
 FAIRSimpleForm: ({ onSubmit }: { onSubmit: (v: unknown) => void }) => (
 <div data-testid="fair-form">
 <button onClick={() => onSubmit({ name: 'Test' })}>Submit Form</button>
 </div>
 )
}));

vi.mock('../../components/fair/SimulationResults', () => ({
 SimulationResults: () => <div data-testid="simulation-results">Simulation Results</div>
}));

vi.mock('../../components/ui/card', () => ({
 Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../../components/ui/button', () => ({
 Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
 <button onClick={onClick} {...props}>{children}</button>
 )
}));

vi.mock('../../components/ui/Badge', () => ({
 Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}));

vi.mock('../../components/ui/dialog', () => ({
 Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
 open ? <div data-testid="dialog">{children}</div> : null,
 DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
 DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>
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
 <FinancialRisk />
 </BrowserRouter>
 );
};

describe('FinancialRisk View', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders the view title', () => {
 renderComponent();
 expect(screen.getByText('fair.title')).toBeInTheDocument();
 });

 it('renders the config list', () => {
 renderComponent();
 expect(screen.getByTestId('config-list')).toBeInTheDocument();
 });

 it('shows create button', () => {
 renderComponent();
 expect(screen.getByText('fair.actions.newAnalysis')).toBeInTheDocument();
 });

 it('opens create dialog when button clicked', async () => {
 renderComponent();
 const createButton = screen.getByText('fair.actions.newAnalysis');
 fireEvent.click(createButton);
 await waitFor(() => {
 expect(screen.getByTestId('dialog')).toBeInTheDocument();
 });
 });

 it('exports as default', async () => {
 const module = await import('../FinancialRisk');
 expect(module.default).toBeDefined();
 });
});
