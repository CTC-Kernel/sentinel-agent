/**
 * Unit tests for ProjectDependencies component
 * Tests linked items display for risks, controls, assets, and audits
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectDependencies } from '../ProjectDependencies';
import { Risk, Control, Asset, Audit, Criticality } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
 ShieldAlert: () => <span data-testid="shield-alert-icon" />,
 CheckSquare: () => <span data-testid="check-square-icon" />,
 Server: () => <span data-testid="server-icon" />,
 ClipboardCheck: () => <span data-testid="clipboard-check-icon" />,
 Edit: () => <span data-testid="edit-icon" />
}));

// Mock Badge
vi.mock('../../../ui/Badge', () => ({
 Badge: ({ children, status }: { children: React.ReactNode; status: string }) => (
 <span data-testid="badge" data-status={status}>{children}</span>
 )
}));

// Mock Inspectors - they open in modals but we just need to verify they render
vi.mock('../../../risks/RiskInspector', () => ({
 RiskInspector: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
 isOpen ? <div data-testid="risk-inspector"><button onClick={onClose}>Close</button></div> : null
}));

vi.mock('../../../assets/AssetInspector', () => ({
 AssetInspector: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
 isOpen ? <div data-testid="asset-inspector"><button onClick={onClose}>Close</button></div> : null
}));

vi.mock('../../../audits/AuditInspector', () => ({
 AuditInspector: ({ onClose }: { onClose: () => void }) => (
 <div data-testid="audit-inspector"><button onClick={onClose}>Close</button></div>
 )
}));

vi.mock('../../../compliance/ComplianceInspector', () => ({
 ComplianceInspector: () => <div data-testid="compliance-inspector" />
}));

describe('ProjectDependencies', () => {
 const mockRisks: Risk[] = [
 {
 id: 'risk-1',
 organizationId: 'org-1',
 assetId: 'asset-1',
 threat: 'Data Breach',
 vulnerability: 'Weak encryption',
 score: 15,
 probability: 3,
 impact: 5,
 status: 'Ouvert',
 category: 'Technical',
 strategy: 'Atténuer',
 owner: 'User 1'
 },
 {
 id: 'risk-2',
 organizationId: 'org-1',
 assetId: 'asset-2',
 threat: 'DDoS Attack',
 vulnerability: 'No rate limiting',
 score: 8,
 probability: 2,
 impact: 4,
 status: 'En cours',
 category: 'Operational',
 strategy: 'Atténuer',
 owner: 'User 2'
 }
 ];

 const mockControls: Control[] = [
 {
 id: 'ctrl-1',
 organizationId: 'org-1',
 code: 'A.8.1',
 name: 'User access management',
 description: 'Access control for users',
 status: 'Implémenté',
 evidenceIds: []
 },
 {
 id: 'ctrl-2',
 organizationId: 'org-1',
 code: 'A.12.3',
 name: 'Data backup',
 description: 'Regular data backup procedures',
 status: 'Partiel',
 evidenceIds: []
 }
 ];

 const mockAssets: Asset[] = [
 {
 id: 'asset-1',
 organizationId: 'org-1',
 name: 'Production Server',
 type: 'Matériel',
 owner: 'IT Admin',
 confidentiality: Criticality.HIGH,
 integrity: Criticality.HIGH,
 availability: Criticality.CRITICAL,
 location: 'Data Center',
 createdAt: '2024-01-01'
 },
 {
 id: 'asset-2',
 organizationId: 'org-1',
 name: 'Customer Database',
 type: 'Données',
 owner: 'DBA',
 confidentiality: Criticality.CRITICAL,
 integrity: Criticality.CRITICAL,
 availability: Criticality.HIGH,
 location: 'Cloud',
 createdAt: '2024-01-01'
 }
 ];

 const mockAudits: Audit[] = [
 {
 id: 'audit-1',
 organizationId: 'org-1',
 name: 'ISO 27001 Audit',
 type: 'Certification',
 auditor: 'External Auditor',
 reference: 'AUD-2024-001',
 status: 'Terminé',
 dateScheduled: '2024-01-15',
 findingsCount: 3
 },
 {
 id: 'audit-2',
 organizationId: 'org-1',
 name: 'Security Review',
 type: 'Interne',
 auditor: 'Internal Team',
 reference: 'AUD-2024-002',
 status: 'En cours',
 dateScheduled: '2024-02-01',
 findingsCount: 0
 }
 ];

 const defaultProps = {
 type: 'risks' as const,
 items: mockRisks,
 canEdit: true
 };

 describe('empty states', () => {
 it('shows empty state for risks', () => {
 render(<ProjectDependencies {...defaultProps} items={[]} />);

 expect(screen.getByText('Aucun risque lié à ce projet.')).toBeInTheDocument();
 expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
 });

 it('shows empty state for controls', () => {
 render(<ProjectDependencies type="controls" items={[]} canEdit={true} />);

 expect(screen.getByText('Aucun contrôle lié à ce projet.')).toBeInTheDocument();
 expect(screen.getByTestId('check-square-icon')).toBeInTheDocument();
 });

 it('shows empty state for assets', () => {
 render(<ProjectDependencies type="assets" items={[]} canEdit={true} />);

 expect(screen.getByText('Aucun actif lié à ce projet.')).toBeInTheDocument();
 expect(screen.getByTestId('server-icon')).toBeInTheDocument();
 });

 it('shows empty state for audits', () => {
 render(<ProjectDependencies type="audits" items={[]} canEdit={true} />);

 expect(screen.getByText('Aucun audit lié à ce projet.')).toBeInTheDocument();
 expect(screen.getByTestId('clipboard-check-icon')).toBeInTheDocument();
 });
 });

 describe('risks display', () => {
 it('renders risk threats', () => {
 render(<ProjectDependencies {...defaultProps} />);

 expect(screen.getByText('Data Breach')).toBeInTheDocument();
 expect(screen.getByText('DDoS Attack')).toBeInTheDocument();
 });

 it('renders risk scores', () => {
 render(<ProjectDependencies {...defaultProps} />);

 expect(screen.getByText('Score: 15')).toBeInTheDocument();
 expect(screen.getByText('Score: 8')).toBeInTheDocument();
 });

 it('renders risk categories', () => {
 render(<ProjectDependencies {...defaultProps} />);

 expect(screen.getByText('Technical')).toBeInTheDocument();
 expect(screen.getByText('Operational')).toBeInTheDocument();
 });

 it('opens risk inspector on click', () => {
 render(<ProjectDependencies {...defaultProps} />);

 fireEvent.click(screen.getByText('Data Breach'));

 expect(screen.getByTestId('risk-inspector')).toBeInTheDocument();
 });

 it('opens risk inspector on Enter key', () => {
 render(<ProjectDependencies {...defaultProps} />);

 const riskItem = screen.getByRole('button', { name: /Data Breach/i });
 fireEvent.keyDown(riskItem, { key: 'Enter' });

 expect(screen.getByTestId('risk-inspector')).toBeInTheDocument();
 });
 });

 describe('controls display', () => {
 it('renders control codes', () => {
 render(<ProjectDependencies type="controls" items={mockControls} canEdit={true} />);

 expect(screen.getByText('A.8.1')).toBeInTheDocument();
 expect(screen.getByText('A.12.3')).toBeInTheDocument();
 });

 it('renders control names', () => {
 render(<ProjectDependencies type="controls" items={mockControls} canEdit={true} />);

 expect(screen.getByText('User access management')).toBeInTheDocument();
 expect(screen.getByText('Data backup')).toBeInTheDocument();
 });

 it('renders control descriptions', () => {
 render(<ProjectDependencies type="controls" items={mockControls} canEdit={true} />);

 expect(screen.getByText('Access control for users')).toBeInTheDocument();
 });

 it('opens compliance inspector on click', () => {
 render(<ProjectDependencies type="controls" items={mockControls} canEdit={true} />);

 fireEvent.click(screen.getByText('User access management'));

 expect(screen.getByTestId('compliance-inspector')).toBeInTheDocument();
 });
 });

 describe('assets display', () => {
 it('renders asset names', () => {
 render(<ProjectDependencies type="assets" items={mockAssets} canEdit={true} />);

 expect(screen.getByText('Production Server')).toBeInTheDocument();
 expect(screen.getByText('Customer Database')).toBeInTheDocument();
 });

 it('renders asset types', () => {
 render(<ProjectDependencies type="assets" items={mockAssets} canEdit={true} />);

 expect(screen.getByText('Matériel')).toBeInTheDocument();
 expect(screen.getByText('Données')).toBeInTheDocument();
 });

 it('opens asset inspector on click', () => {
 render(<ProjectDependencies type="assets" items={mockAssets} canEdit={true} />);

 fireEvent.click(screen.getByText('Production Server'));

 expect(screen.getByTestId('asset-inspector')).toBeInTheDocument();
 });
 });

 describe('audits display', () => {
 it('renders audit names', () => {
 render(<ProjectDependencies type="audits" items={mockAudits} canEdit={true} />);

 expect(screen.getByText('ISO 27001 Audit')).toBeInTheDocument();
 expect(screen.getByText('Security Review')).toBeInTheDocument();
 });

 it('renders audit references', () => {
 render(<ProjectDependencies type="audits" items={mockAudits} canEdit={true} />);

 expect(screen.getByText('Ref: AUD-2024-001')).toBeInTheDocument();
 expect(screen.getByText('Ref: AUD-2024-002')).toBeInTheDocument();
 });

 it('renders audit status badges', () => {
 render(<ProjectDependencies type="audits" items={mockAudits} canEdit={true} />);

 expect(screen.getByText('Terminé')).toBeInTheDocument();
 expect(screen.getByText('En cours')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('has glass-premium containers', () => {
 const { container } = render(<ProjectDependencies {...defaultProps} />);

 expect(container.querySelectorAll('.glass-premium').length).toBeGreaterThan(0);
 });

 it('applies red color for high score risks', () => {
 const { container } = render(<ProjectDependencies {...defaultProps} />);

 expect(container.querySelector('.bg-red-100')).toBeInTheDocument();
 });
 });
});
