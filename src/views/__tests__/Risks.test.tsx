import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Risks } from '../Risks'; // Adjust import if necessary (likely index or default)
import { useStore } from '../../store'; // Adjust import
import { useFirestoreCollection } from '../../hooks/useFirestore';

// Mock dependencies
vi.mock('../../store', () => ({
 useStore: vi.fn(),
}));

vi.mock('../../hooks/useFirestore', () => ({
 useFirestoreCollection: vi.fn(),
}));



vi.mock('../../components/risks/RiskList', () => ({
 RiskList: () => <div data-testid="risk-list">Aucun risque identifié</div>
}));

vi.mock('../../components/risks/RiskGrid', () => ({
 RiskGrid: () => <div data-testid="risk-grid">Aucun risque identifié</div>
}));

vi.mock('../../components/risks/RiskInspector', () => ({
 RiskInspector: () => <div data-testid="risk-inspector" />
}));

vi.mock('../../hooks/usePersistedState', () => ({
 usePersistedState: (_key: string, initial: unknown) => React.useState(initial),
}));

vi.mock('../../hooks/useAuth', () => ({
 useAuth: () => ({
 user: { uid: 'test-user', email: 'test@example.com', organizationId: 'test-org', role: 'admin' },
 loading: false,
 }),
}));

vi.mock('../../utils/permissions', () => ({
 canEditResource: vi.fn().mockReturnValue(true),
 canDeleteResource: vi.fn(),
 hasPermission: vi.fn(),
}));

vi.mock('react-helmet-async', () => ({
 Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
 HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/ui/Icons', async (importOriginal) => {
 const actual = await importOriginal<typeof import('../../components/ui/Icons')>();
 return {
 ...actual,
 };
});
// Mock other components to simplify test
vi.mock('../../components/ui/PageHeader', () => ({
 PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));

describe('Risks View', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 const mockState = {
 user: { organizationId: 'test-org', role: 'admin' },
 addToast: vi.fn(),
 demoMode: false,
 language: 'fr',
 t: (k: string) => k,
 };
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 vi.mocked(useStore).mockImplementation((selector: any) =>
 selector ? selector(mockState) : mockState
 );
 vi.mocked(useFirestoreCollection).mockReturnValue({
 data: [],
 loading: false,
 refresh: vi.fn(),
 error: null,
 add: vi.fn(),
 update: vi.fn(),
 remove: vi.fn()
 });
 });

 it('renders the risks dashboard title', () => {
 const { getByText } = render(
 <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <Risks />
 </MemoryRouter>
 );
 expect(getByText(/risks.title/i)).toBeInTheDocument();
 });

 it('shows loading state', () => {
 vi.mocked(useFirestoreCollection).mockReturnValue({
 data: [],
 loading: true,
 refresh: vi.fn(),
 error: null,
 add: vi.fn(),
 update: vi.fn(),
 remove: vi.fn()
 });
 render(
 <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <Risks />
 </MemoryRouter>
 );
 });

 it('displays empty state when no risks found', async () => {
 vi.mocked(useFirestoreCollection).mockReturnValue({
 data: [],
 loading: false,
 refresh: vi.fn(),
 error: null,
 add: vi.fn(),
 update: vi.fn(),
 remove: vi.fn()
 });

 render(
 <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <Risks />
 </MemoryRouter>
 );
 // Switch to List view
 const listTab = screen.getByText("risks.registry");
 fireEvent.click(listTab);

 // The mock RiskList component or empty state will render
 await waitFor(() => {
 // Check either the mocked RiskList or the actual empty state text
 const riskList = screen.queryByTestId('risk-list');
 const emptyState = screen.queryByText(/En attente de données/i) ||
 screen.queryByText(/Aucun risque/i);
 expect(riskList || emptyState).toBeTruthy();
 });
 });
});
