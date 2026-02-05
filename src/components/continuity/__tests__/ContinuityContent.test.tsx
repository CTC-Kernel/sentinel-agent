/**
 * Unit tests for ContinuityContent component
 * Tests tab content switching and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContinuityContent } from '../ContinuityContent';

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => (
 <div {...props}>{children}</div>
 )
 },
 AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock child components
vi.mock('../ContinuityDashboard', () => ({
 ContinuityDashboard: () => <div data-testid="continuity-dashboard">Dashboard Content</div>
}));

vi.mock('../ContinuityBIA', () => ({
 ContinuityBIA: () => <div data-testid="continuity-bia">BIA Content</div>
}));

vi.mock('../ContinuityStrategies', () => ({
 ContinuityStrategies: () => <div data-testid="continuity-strategies">Strategies Content</div>
}));

vi.mock('../pra/ContinuityPRA', () => ({
 ContinuityPRA: () => <div data-testid="continuity-pra">PRA Content</div>
}));

vi.mock('../ContinuityDrills', () => ({
 ContinuityDrills: () => <div data-testid="continuity-drills">Drills Content</div>
}));

vi.mock('../ContinuityCrisis', () => ({
 ContinuityCrisis: () => <div data-testid="continuity-crisis">Crisis Content</div>
}));

vi.mock('../tlpt/TlptDashboard', () => ({
 TlptDashboard: () => <div data-testid="tlpt-dashboard">TLPT Content</div>
}));

vi.mock('../../ui/EmptyState', () => ({
 EmptyState: ({ title, onAction }: { title: string; onAction?: () => void }) => (
 <div data-testid="empty-state">
 <span>{title}</span>
 {onAction && <button onClick={onAction}>Action</button>}
 </div>
 )
}));

vi.mock('../../ui/PremiumPageControl', () => ({
 PremiumPageControl: ({ searchQuery, onSearchChange, actions }: {
 searchQuery: string;
 onSearchChange: (q: string) => void;
 actions?: React.ReactNode;
 }) => (
 <div data-testid="page-control">
 <input
 data-testid="search-input"
 value={searchQuery}
 onChange={(e) => onSearchChange(e.target.value)}
 />
 {actions}
 </div>
 )
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => key
 })
}));

describe('ContinuityContent', () => {
 const mockOnSearchChange = vi.fn();
 const mockOnViewModeChange = vi.fn();
 const mockOnGenerateReport = vi.fn();
 const mockOnImportCsv = vi.fn();
 const mockOnOpenProcessModal = vi.fn();
 const mockOnSetSelectedProcess = vi.fn();
 const mockOnOpenDrillModal = vi.fn();
 const mockOnDeleteDrill = vi.fn();
 const mockOnAddTlpt = vi.fn();
 const mockOnUpdateTlpt = vi.fn();
 const mockOnDeleteTlpt = vi.fn();
 const mockOnAddPlan = vi.fn();
 const mockOnUpdatePlan = vi.fn();
 const mockOnDeletePlan = vi.fn();

 const mockProcess = {
 id: 'proc-1',
 name: 'Test Process',
 description: 'Test description',
 criticality: 'high' as const,
 rto: '4h',
 rpo: '1h',
 mtpd: '24h',
 owner: 'user-1',
 dependencies: [],
 status: 'active' as const,
 organizationId: 'org-1',
 priority: 'Élevée' as const,
 supportingAssetIds: []
 };

 const defaultProps = {
 activeTab: 'overview' as const,
 loading: false,
 viewMode: 'grid' as const,
 filteredProcesses: [mockProcess],
 assets: [],
 drills: [],
 users: [],
 searchQuery: '',
 onSearchChange: mockOnSearchChange,
 onViewModeChange: mockOnViewModeChange,
 onGenerateReport: mockOnGenerateReport,
 onImportCsv: mockOnImportCsv,
 canCreate: true,
 onOpenProcessModal: mockOnOpenProcessModal,
 onSetSelectedProcess: mockOnSetSelectedProcess,
 onOpenDrillModal: mockOnOpenDrillModal,
 onDeleteDrill: mockOnDeleteDrill,
 _tlptCampaigns: [],
 _onAddTlpt: mockOnAddTlpt,
 _onUpdateTlpt: mockOnUpdateTlpt,
 _onDeleteTlpt: mockOnDeleteTlpt,
 recoveryPlans: [],
 onAddPlan: mockOnAddPlan,
 onUpdatePlan: mockOnUpdatePlan,
 onDeletePlan: mockOnDeletePlan
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('tab rendering', () => {
 it('renders dashboard on overview tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="overview" />);

 expect(screen.getByTestId('continuity-dashboard')).toBeInTheDocument();
 });

 it('renders BIA on bia tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByTestId('continuity-bia')).toBeInTheDocument();
 });

 it('renders strategies on strategies tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="strategies" />);

 expect(screen.getByTestId('continuity-strategies')).toBeInTheDocument();
 });

 it('renders PRA on pra tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="pra" />);

 expect(screen.getByTestId('continuity-pra')).toBeInTheDocument();
 });

 it('renders drills on drills tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="drills" />);

 expect(screen.getByTestId('continuity-drills')).toBeInTheDocument();
 });

 it('renders crisis on crisis tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="crisis" />);

 expect(screen.getByTestId('continuity-crisis')).toBeInTheDocument();
 });

 it('renders TLPT on tlpt tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="tlpt" />);

 expect(screen.getByTestId('tlpt-dashboard')).toBeInTheDocument();
 });
 });

 describe('BIA tab controls', () => {
 it('renders page control on BIA tab', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByTestId('page-control')).toBeInTheDocument();
 });

 it('renders search input', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByTestId('search-input')).toBeInTheDocument();
 });

 it('handles search change', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 const searchInput = screen.getByTestId('search-input');
 fireEvent.change(searchInput, { target: { value: 'test' } });

 expect(mockOnSearchChange).toHaveBeenCalledWith('test');
 });

 it('renders generate report button when canCreate', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByLabelText('Générer le rapport')).toBeInTheDocument();
 });

 it('calls onGenerateReport when report button clicked', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 fireEvent.click(screen.getByLabelText('Générer le rapport'));

 expect(mockOnGenerateReport).toHaveBeenCalled();
 });

 it('renders new process button when canCreate', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByLabelText('continuity.newProcess')).toBeInTheDocument();
 });

 it('calls onOpenProcessModal when new process clicked', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 fireEvent.click(screen.getByLabelText('continuity.newProcess'));

 expect(mockOnOpenProcessModal).toHaveBeenCalled();
 });

 it('renders import CSV button when canCreate', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByLabelText('common.importCsv')).toBeInTheDocument();
 });

 it('calls onImportCsv when import button clicked', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 fireEvent.click(screen.getByLabelText('common.importCsv'));

 expect(mockOnImportCsv).toHaveBeenCalled();
 });
 });

 describe('BIA empty state', () => {
 it('shows empty state when no processes and not loading', () => {
 render(
 <ContinuityContent
  {...defaultProps}
  activeTab="bia"
  filteredProcesses={[]}
 />
 );

 expect(screen.getByTestId('empty-state')).toBeInTheDocument();
 expect(screen.getByText('Aucun processus défini')).toBeInTheDocument();
 });

 it('shows BIA when processes exist', () => {
 render(<ContinuityContent {...defaultProps} activeTab="bia" />);

 expect(screen.getByTestId('continuity-bia')).toBeInTheDocument();
 });
 });

 describe('canCreate permissions', () => {
 it('hides action buttons when canCreate is false', () => {
 render(
 <ContinuityContent
  {...defaultProps}
  activeTab="bia"
  canCreate={false}
 />
 );

 expect(screen.queryByLabelText('continuity.newProcess')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('common.importCsv')).not.toBeInTheDocument();
 });

 it('shows report button even when canCreate is false', () => {
 render(
 <ContinuityContent
  {...defaultProps}
  activeTab="bia"
  canCreate={false}
 />
 );

 expect(screen.getByLabelText('Générer le rapport')).toBeInTheDocument();
 });
 });

 describe('data-tour attributes', () => {
 it('has data-tour attribute on overview', () => {
 const { container } = render(<ContinuityContent {...defaultProps} activeTab="overview" />);

 expect(container.querySelector('[data-tour="continuity-dashboard"]')).toBeInTheDocument();
 });
 });
});
