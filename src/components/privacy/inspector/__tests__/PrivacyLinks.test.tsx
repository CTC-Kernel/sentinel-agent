/**
 * Unit tests for PrivacyLinks component
 * Tests linked assets and risks display with linking functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyLinks } from '../PrivacyLinks';
import { ProcessingActivity, Asset, Risk, Criticality } from '../../../../types';
import { ProcessingActivityFormData } from '../../../../schemas/privacySchema';
import { UseFormReturn } from 'react-hook-form';

// Mock lucide-react icons with importOriginal to include all exports
vi.mock('lucide-react', async (importOriginal) => {
 const actual = await importOriginal<typeof import('lucide-react')>();
 return {
 ...actual,
 Server: () => <span data-testid="server-icon" />,
 AlertTriangle: () => <span data-testid="alert-triangle-icon" />,
 Plus: () => <span data-testid="plus-icon" />,
 X: () => <span data-testid="x-icon" />
 };
});

describe('PrivacyLinks', () => {
 const mockSetValue = vi.fn();
 const mockWatch = vi.fn();

 const mockForm = {
 watch: mockWatch,
 setValue: mockSetValue
 };

 const mockAssetsList: Asset[] = [
 {
 id: 'asset-1',
 organizationId: 'org-1',
 name: 'HR Server',
 type: 'Matériel',
 owner: 'IT Team',
 confidentiality: Criticality.HIGH,
 integrity: Criticality.HIGH,
 availability: Criticality.HIGH,
 location: 'Data Center',
 createdAt: new Date(Date.now()).toISOString()
 },
 {
 id: 'asset-2',
 organizationId: 'org-1',
 name: 'Employee Database',
 type: 'Données',
 owner: 'IT Team',
 confidentiality: Criticality.CRITICAL,
 integrity: Criticality.CRITICAL,
 availability: Criticality.HIGH,
 location: 'Data Center',
 createdAt: new Date(Date.now()).toISOString()
 },
 {
 id: 'asset-3',
 organizationId: 'org-1',
 name: 'Backup Server',
 type: 'Matériel',
 owner: 'IT Team',
 confidentiality: Criticality.MEDIUM,
 integrity: Criticality.MEDIUM,
 availability: Criticality.HIGH,
 location: 'Data Center',
 createdAt: new Date(Date.now()).toISOString()
 }
 ];

 const mockRisksList: Risk[] = [
 {
 id: 'risk-1',
 organizationId: 'org-1',
 assetId: 'asset-1',
 threat: 'Data Breach',
 vulnerability: 'Weak encryption',
 score: 15,
 residualScore: 8,
 probability: 3,
 impact: 5,
 strategy: 'Atténuer',
 owner: 'Security Team',
 status: 'Ouvert'
 },
 {
 id: 'risk-2',
 organizationId: 'org-1',
 assetId: 'asset-2',
 threat: 'Unauthorized Access',
 vulnerability: 'Poor access control',
 score: 12,
 residualScore: 6,
 probability: 3,
 impact: 4,
 strategy: 'Atténuer',
 owner: 'Security Team',
 status: 'En cours'
 }
 ];

 const mockActivity: ProcessingActivity = {
 id: 'activity-1',
 organizationId: 'org-1',
 name: 'Employee Processing',
 purpose: 'HR management',
 manager: 'Jane Smith',
 legalBasis: 'Contrat',
 dataCategories: ['Etat Civil', 'Coordonnées'],
 dataSubjects: ['Employés'],
 retentionPeriod: '5 ans',
 hasDPIA: false,
 relatedAssetIds: ['asset-1', 'asset-2'],
 relatedRiskIds: ['risk-1'],
 status: 'Actif'
 };

 const activityWithNoLinks: ProcessingActivity = {
 ...mockActivity,
 relatedAssetIds: [],
 relatedRiskIds: []
 };

 const defaultProps = {
 activity: mockActivity,
 isEditing: false,
 form: mockForm as unknown as UseFormReturn<ProcessingActivityFormData>,
 assetsList: mockAssetsList,
 risksList: mockRisksList
 };

 beforeEach(() => {
 vi.clearAllMocks();
 mockWatch.mockImplementation((field: string) => {
 if (field === 'relatedAssetIds') return ['asset-1', 'asset-2'];
 if (field === 'relatedRiskIds') return ['risk-1'];
 return [];
 });
 });

 describe('assets section', () => {
 it('renders assets header with count', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.getByText('Actifs liés (2)')).toBeInTheDocument();
 });

 it('displays linked asset names', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.getByText('HR Server')).toBeInTheDocument();
 expect(screen.getByText('Employee Database')).toBeInTheDocument();
 });

 it('displays asset types', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.getAllByText('Matériel').length).toBeGreaterThan(0);
 expect(screen.getByText('Données')).toBeInTheDocument();
 });

 it('does not show unlinked assets', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.queryByText('Backup Server')).not.toBeInTheDocument();
 });

 it('shows empty state when no assets linked', () => {
 render(<PrivacyLinks {...defaultProps} activity={activityWithNoLinks} />);

 expect(screen.getByText('Aucun actif lié à ce traitement.')).toBeInTheDocument();
 });
 });

 describe('risks section', () => {
 it('renders risks header with count', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.getByText('Risques liés (1)')).toBeInTheDocument();
 });

 it('displays linked risk threats', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.getByText('Data Breach')).toBeInTheDocument();
 });

 it('displays risk residual scores', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.getByText('Score: 8')).toBeInTheDocument();
 });

 it('does not show unlinked risks', () => {
 render(<PrivacyLinks {...defaultProps} />);

 expect(screen.queryByText('Unauthorized Access')).not.toBeInTheDocument();
 });

 it('shows empty state when no risks linked', () => {
 render(<PrivacyLinks {...defaultProps} activity={activityWithNoLinks} />);

 expect(screen.getByText('Aucun risque identifié pour ce traitement.')).toBeInTheDocument();
 });
 });

 describe('edit mode - assets', () => {
 it('shows asset link select when editing', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 expect(screen.getByText('Lier un actif...')).toBeInTheDocument();
 });

 it('shows available (unlinked) assets in select', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 // Backup Server is not linked so should be available
 const select = screen.getAllByRole('combobox')[0];
 expect(select).toHaveTextContent('Backup Server');
 });

 it('shows unlink button on assets when editing', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 // X icons for unlinking (one per linked asset)
 expect(screen.getAllByTestId('x-icon').length).toBeGreaterThan(0);
 });

 it('calls setValue when linking asset', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 const select = screen.getAllByRole('combobox')[0];
 fireEvent.change(select, { target: { value: 'asset-3' } });

 expect(mockSetValue).toHaveBeenCalledWith(
 'relatedAssetIds',
 ['asset-1', 'asset-2', 'asset-3'],
 { shouldDirty: true }
 );
 });

 it('calls setValue when unlinking asset', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 // Click the first X button to unlink
 const unlinkButtons = screen.getAllByTitle('Délier l\'actif');
 fireEvent.click(unlinkButtons[0]);

 expect(mockSetValue).toHaveBeenCalledWith(
 'relatedAssetIds',
 expect.any(Array),
 { shouldDirty: true }
 );
 });
 });

 describe('edit mode - risks', () => {
 it('shows risk link select when editing', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 expect(screen.getByText('Lier un risque...')).toBeInTheDocument();
 });

 it('shows available (unlinked) risks in select', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 // Unauthorized Access is not linked so should be available
 const selects = screen.getAllByRole('combobox');
 expect(selects[1]).toHaveTextContent('Unauthorized Access');
 });

 it('calls setValue when linking risk', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 const selects = screen.getAllByRole('combobox');
 fireEvent.change(selects[1], { target: { value: 'risk-2' } });

 expect(mockSetValue).toHaveBeenCalledWith(
 'relatedRiskIds',
 ['risk-1', 'risk-2'],
 { shouldDirty: true }
 );
 });
 });

 describe('view mode restrictions', () => {
 it('hides asset link select when not editing', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={false} />);

 expect(screen.queryByText('Lier un actif...')).not.toBeInTheDocument();
 });

 it('hides risk link select when not editing', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={false} />);

 expect(screen.queryByText('Lier un risque...')).not.toBeInTheDocument();
 });

 it('hides unlink buttons when not editing', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={false} />);

 expect(screen.queryByTitle("Délier l'actif")).not.toBeInTheDocument();
 });
 });

 describe('icons', () => {
 it('renders server icons for assets', () => {
 render(<PrivacyLinks {...defaultProps} />);

 // Multiple server icons for each asset
 expect(screen.getAllByTestId('server-icon').length).toBeGreaterThan(0);
 });

 it('renders alert triangle icons for risks', () => {
 render(<PrivacyLinks {...defaultProps} />);

 // Multiple alert icons for header and each risk
 expect(screen.getAllByTestId('alert-triangle-icon').length).toBeGreaterThan(0);
 });

 it('renders plus icons in edit mode', () => {
 render(<PrivacyLinks {...defaultProps} isEditing={true} />);

 expect(screen.getAllByTestId('plus-icon').length).toBe(2);
 });
 });

 describe('styling', () => {
 it('has animation class', () => {
 const { container } = render(<PrivacyLinks {...defaultProps} />);

 expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
 });

 it('has grid layout for linked items', () => {
 const { container } = render(<PrivacyLinks {...defaultProps} />);

 expect(container.querySelector('.grid')).toBeInTheDocument();
 });
 });
});
