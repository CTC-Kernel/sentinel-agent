/**
 * Tests for RiskLinkedControls component
 * Story 3.3: Link Risks to Controls
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RiskLinkedControls } from '../RiskLinkedControls';
import { calculateMitigationCoverage } from '../../../../utils/riskEvaluation';
import { Risk, Control } from '../../../../types';

// Wrapper for router
const renderWithRouter = (ui: React.ReactElement) => {
 return render(<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</BrowserRouter>);
};

const createRisk = (overrides: Partial<Risk> = {}): Risk => ({
 id: 'risk-1',
 organizationId: 'org-1',
 assetId: 'asset-1',
 threat: 'Test threat',
 vulnerability: 'Test vulnerability',
 impact: 4,
 probability: 4,
 score: 16,
 status: 'Ouvert',
 strategy: 'Atténuer',
 owner: 'owner-1',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 ...overrides
});

const createControl = (overrides: Partial<Control> = {}): Control => ({
 id: 'ctrl-1',
 organizationId: 'org-1',
 code: 'CTR-001',
 name: 'Test Control',
 status: 'Implémenté',
 ...overrides
});

describe('calculateMitigationCoverage', () => {
 it('should return 0 for empty controls', () => {
 expect(calculateMitigationCoverage([])).toBe(0);
 });

 it('should return 100 for all implemented controls', () => {
 const controls = [
 createControl({ status: 'Implémenté' }),
 createControl({ id: '2', status: 'Actif' })
 ];
 expect(calculateMitigationCoverage(controls)).toBe(100);
 });

 it('should return 50 for all partial controls', () => {
 const controls = [createControl({ status: 'Partiel' })];
 expect(calculateMitigationCoverage(controls)).toBe(50);
 });

 it('should calculate weighted average', () => {
 const controls = [
 createControl({ id: '1', status: 'Implémenté' }),
 createControl({ id: '2', status: 'Non commencé' })
 ];
 // (1.0 + 0.1) / 2 = 0.55 -> 55%
 expect(calculateMitigationCoverage(controls)).toBe(55);
 });
});

describe('RiskLinkedControls', () => {
 it('should show empty state when no controls linked', () => {
 const risk = createRisk({ mitigationControlIds: [] });
 renderWithRouter(<RiskLinkedControls risk={risk} controls={[]} />);

 expect(screen.getByText('Aucun contrôle de sécurité lié')).toBeInTheDocument();
 });

 it('should display linked controls count', () => {
 const risk = createRisk({ mitigationControlIds: ['ctrl-1', 'ctrl-2'] });
 const controls = [
 createControl({ id: 'ctrl-1' }),
 createControl({ id: 'ctrl-2', code: 'CTR-002', name: 'Second Control' })
 ];

 renderWithRouter(<RiskLinkedControls risk={risk} controls={controls} />);

 expect(screen.getByText('Contrôles Liés (2)')).toBeInTheDocument();
 });

 it('should display control details', () => {
 const risk = createRisk({ mitigationControlIds: ['ctrl-1'] });
 const controls = [
 createControl({
 id: 'ctrl-1',
 code: 'ISO-001',
 name: 'Access Control',
 framework: 'ISO27001',
 status: 'Implémenté'
 })
 ];

 renderWithRouter(<RiskLinkedControls risk={risk} controls={controls} />);

 expect(screen.getByText('ISO-001 - Access Control')).toBeInTheDocument();
 expect(screen.getByText('ISO27001')).toBeInTheDocument();
 expect(screen.getByText('Implémenté')).toBeInTheDocument();
 });

 it('should display mitigation coverage percentage', () => {
 const risk = createRisk({ mitigationControlIds: ['ctrl-1'] });
 const controls = [createControl({ id: 'ctrl-1', status: 'Implémenté' })];

 renderWithRouter(<RiskLinkedControls risk={risk} controls={controls} />);

 expect(screen.getByText('Couverture de Mitigation')).toBeInTheDocument();
 expect(screen.getByText('100%')).toBeInTheDocument();
 });

 it('should display implemented count', () => {
 const risk = createRisk({ mitigationControlIds: ['ctrl-1', 'ctrl-2'] });
 const controls = [
 createControl({ id: 'ctrl-1', status: 'Implémenté' }),
 createControl({ id: 'ctrl-2', status: 'Partiel' })
 ];

 renderWithRouter(<RiskLinkedControls risk={risk} controls={controls} />);

 // Check for the "Implémentés" label which indicates implemented controls section exists
 expect(screen.getByText('Implémentés')).toBeInTheDocument();
 // Check for "En attente" which shows partial/not started controls
 expect(screen.getByText('En attente')).toBeInTheDocument();
 });

 it('should handle missing controls gracefully', () => {
 const risk = createRisk({ mitigationControlIds: ['ctrl-1', 'ctrl-missing'] });
 const controls = [createControl({ id: 'ctrl-1' })];

 renderWithRouter(<RiskLinkedControls risk={risk} controls={controls} />);

 // Should only show the one that exists
 expect(screen.getByText('Contrôles Liés (1)')).toBeInTheDocument();
 });
});
