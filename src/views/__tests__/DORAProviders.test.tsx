/**
 * DORAProviders View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DORAProviders } from '../DORAProviders';

vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => key,
 i18n: { language: 'fr' }
 })
}));

vi.mock('@/lib/toast', () => ({
 toast: {
 success: vi.fn(),
 error: vi.fn()
 }
}));

const mockDeleteProvider = vi.fn();
const mockRefresh = vi.fn();

vi.mock('../../hooks/useICTProviders', () => ({
 useICTProviders: () => ({
 providers: [
 {
 id: 'provider-1',
 name: 'Test Provider',
 category: 'critical',
 doraCompliant: true,
 createdAt: new Date(),
 updatedAt: new Date()
 }
 ],
 loading: false,
 stats: { total: 1, critical: 1, important: 0, standard: 0 },
 concentrationAnalysis: { herfindahlIndex: 0.3 },
 deleteProvider: mockDeleteProvider,
 refresh: mockRefresh
 })
}));

vi.mock('../../components/ui/button', () => ({
 Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
 <button onClick={onClick} {...props}>{children}</button>
 )
}));

vi.mock('../../components/ui/SearchInput', () => ({
 SearchInput: ({ onChange }: { onChange: (v: string) => void }) => (
 <input data-testid="search-input" onChange={(e) => onChange(e.target.value)} />
 )
}));

vi.mock('../../components/ui/CustomSelect', () => ({
 CustomSelect: () => <select data-testid="custom-select" />
}));

vi.mock('../../components/ui/Drawer', () => ({
 Drawer: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
 isOpen ? <div data-testid="drawer">{children}</div> : null
}));

vi.mock('../../components/dora/ICTProviderList', () => ({
 ICTProviderList: ({ onSelect }: { onSelect: (p: unknown) => void }) => (
 <div data-testid="provider-list">
 <button onClick={() => onSelect({ id: 'provider-1' })}>Select Provider</button>
 </div>
 )
}));

vi.mock('../../components/dora/ICTProviderDrawer', () => ({
 ICTProviderDrawer: ({ isOpen }: { isOpen: boolean }) =>
 isOpen ? <div data-testid="provider-drawer">Provider Drawer</div> : null
}));

vi.mock('../../components/dora/ICTProviderInspector', () => ({
 ICTProviderInspector: () => <div data-testid="provider-inspector">Provider Inspector</div>
}));

vi.mock('../../components/dora/ImportICTProvidersModal', () => ({
 ImportICTProvidersModal: ({ isOpen }: { isOpen: boolean }) =>
 isOpen ? <div data-testid="import-modal">Import Modal</div> : null
}));

vi.mock('../../components/dora/ExportDORARegisterModal', () => ({
 ExportDORARegisterModal: ({ isOpen }: { isOpen: boolean }) =>
 isOpen ? <div data-testid="export-modal">Export Modal</div> : null
}));

vi.mock('../../components/dora/ExportHistoryPanel', () => ({
 ExportHistoryPanel: () => <div data-testid="export-history">Export History</div>
}));

vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

vi.mock('../../store', () => ({
 useStore: () => ({
 user: { uid: 'test-user', role: 'admin', organizationId: 'org-1' },
 }),
}));

vi.mock('../../utils/permissions', () => ({
 canEditResource: vi.fn().mockReturnValue(true),
}));

vi.mock('../../components/ui/ConfirmModal', () => ({
 ConfirmModal: () => null,
}));

const renderComponent = () => {
 return render(
 <BrowserRouter>
 <DORAProviders />
 </BrowserRouter>
 );
};

describe('DORAProviders View', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders the view title', () => {
 renderComponent();
 expect(screen.getByText('dora.title')).toBeInTheDocument();
 });

 it('renders the provider list', () => {
 renderComponent();
 expect(screen.getByTestId('provider-list')).toBeInTheDocument();
 });

 it('renders the search input', () => {
 renderComponent();
 expect(screen.getByTestId('search-input')).toBeInTheDocument();
 });

 it('shows add provider button', () => {
 renderComponent();
 expect(screen.getByText('dora.providers.new')).toBeInTheDocument();
 });

 it('opens drawer when add button clicked', async () => {
 renderComponent();
 const addButton = screen.getByText('dora.providers.new');
 fireEvent.click(addButton);
 await waitFor(() => {
 expect(screen.getByTestId('provider-drawer')).toBeInTheDocument();
 });
 });

 it('exports as named export', async () => {
 const module = await import('../DORAProviders');
 expect(module.DORAProviders).toBeDefined();
 });
});
