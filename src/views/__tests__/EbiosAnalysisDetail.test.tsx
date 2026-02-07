/**
 * EbiosAnalysisDetail View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EbiosAnalysisDetail from '../EbiosAnalysisDetail';
import type { EbiosAnalysis, EbiosWorkshopNumber } from '../../types/ebios';

vi.mock('../../store', () => ({
 useStore: () => ({
 t: (key: string) => key
 })
}));

vi.mock('../../hooks/useAuth', () => ({
 useAuth: () => ({
 user: {
 id: 'user-1',
 uid: 'user-1',
 email: 'test@example.com',
 role: 'user',
 organizationId: 'org-1',
 displayName: 'Test User'
 },
 firebaseUser: null,
 loading: false,
 error: null,
 isAdmin: false,
 claimsSynced: true,
 dismissBlockerError: vi.fn(),
 refreshSession: vi.fn(),
 logout: vi.fn(),
 enrollMFA: vi.fn(),
 verifyMFA: vi.fn(),
 unenrollMFA: vi.fn(),
 loginWithSSO: vi.fn()
 })
}));

vi.mock('../../services/ebiosService', () => ({
 EbiosService: {
 getAnalysis: vi.fn().mockResolvedValue({
 id: 'analysis-1',
 organizationId: 'org-1',
 name: 'Test Analysis',
 description: 'Test description',
 status: 'in_progress',
 currentWorkshop: 1,
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now()),
 createdBy: 'user-1',
 updatedBy: 'user-1',
 workshops: {
 1: { status: 'in_progress', data: { scope: { objectives: [], context: '' }, fearedEvents: [] } },
 2: { status: 'not_started', data: { riskSources: [], targetObjectives: [] } },
 3: { status: 'not_started', data: { strategicScenarios: [] } },
 4: { status: 'not_started', data: { operationalScenarios: [] } },
 5: { status: 'not_started', data: { treatmentStrategies: [], residualRisks: [], actionPlan: [] } }
 }
 }),
 saveWorkshopData: vi.fn().mockResolvedValue(undefined),
 navigateToWorkshop: vi.fn().mockResolvedValue(undefined),
 updateAnalysis: vi.fn().mockResolvedValue(undefined)
 }
}));

vi.mock('../../hooks/useAutoSave', () => ({
 useAutoSave: vi.fn()
}));

vi.mock('../../components/ebios/EbiosWizard', () => ({
 EbiosWizard: ({
 analysis,
 children
 }: {
 analysis: EbiosAnalysis;
 children: React.ReactNode;
 onWorkshopChange: (w: EbiosWorkshopNumber) => void;
 }) => (
 <div data-testid="ebios-wizard">
 <h1 data-testid="analysis-name">{analysis.name}</h1>
 <span data-testid="analysis-status">{analysis.status}</span>
 {children}
 </div>
 )
}));

vi.mock('../../components/ebios/workshops/Workshop1Content', () => ({
 Workshop1Content: () => <div data-testid="workshop-1-content">Workshop 1</div>
}));

vi.mock('../../components/ebios/workshops/Workshop2Content', () => ({
 Workshop2Content: () => <div data-testid="workshop-2-content">Workshop 2</div>
}));

vi.mock('../../components/ebios/workshops/Workshop3Content', () => ({
 Workshop3Content: () => <div data-testid="workshop-3-content">Workshop 3</div>
}));

vi.mock('../../components/ebios/workshops/Workshop4Content', () => ({
 Workshop4Content: () => <div data-testid="workshop-4-content">Workshop 4</div>,
 CreateRiskFromEbiosData: {}
}));

vi.mock('../../components/ebios/workshops/Workshop5Content', () => ({
 Workshop5Content: () => <div data-testid="workshop-5-content">Workshop 5</div>
}));

vi.mock('@/lib/toast', () => ({
 toast: {
 success: vi.fn(),
 error: vi.fn()
 }
}));

vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

vi.mock('../../firebase', () => ({
 db: {}
}));

vi.mock('firebase/firestore', () => ({
 addDoc: vi.fn(),
 collection: vi.fn(),
 serverTimestamp: vi.fn()
}));

vi.mock('../../utils/dataSanitizer', () => ({
 sanitizeData: (data: unknown) => data
}));

const renderComponent = () => {
 return render(
 <MemoryRouter initialEntries={['/ebios/analysis-1']}>
 <Routes>
 <Route path="/ebios/:id" element={<EbiosAnalysisDetail />} />
 </Routes>
 </MemoryRouter>
 );
};

describe('EbiosAnalysisDetail View', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders the EbiosWizard after loading', async () => {
 renderComponent();
 await waitFor(() => {
 expect(screen.getByTestId('ebios-wizard')).toBeInTheDocument();
 });
 });

 it('displays the analysis name', async () => {
 renderComponent();
 await waitFor(() => {
 expect(screen.getByTestId('analysis-name')).toHaveTextContent('Test Analysis');
 });
 });

 it('renders workshop 1 content by default', async () => {
 renderComponent();
 await waitFor(() => {
 expect(screen.getByTestId('workshop-1-content')).toBeInTheDocument();
 });
 });

 it('exports as default', async () => {
 const module = await import('../EbiosAnalysisDetail');
 expect(module.default).toBeDefined();
 });
});
