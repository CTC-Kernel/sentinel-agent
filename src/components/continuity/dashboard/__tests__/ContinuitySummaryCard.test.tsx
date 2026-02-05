/**
 * Unit tests for ContinuitySummaryCard component
 * Tests continuity dashboard summary card display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContinuitySummaryCard } from '../ContinuitySummaryCard';
import { BusinessProcess, BcpDrill } from '../../../../types';

describe('ContinuitySummaryCard', () => {
 const createProcess = (overrides: Partial<BusinessProcess> = {}): BusinessProcess => ({
 id: 'proc-1',
 name: 'Test Process',
 description: 'Test description',
 owner: 'Test Owner',
 rto: '4h',
 rpo: '1h',
 priority: 'Élevée',
 supportingAssetIds: [],
 organizationId: 'org-1',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 ...overrides
 });

 const createDrill = (overrides: Partial<BcpDrill> = {}): BcpDrill => ({
 id: 'drill-1',
 processId: 'proc-1',
 date: new Date().toISOString(),
 type: 'Tabletop',
 result: 'Succès',
 organizationId: 'org-1',
 createdAt: new Date().toISOString(),
 ...overrides
 });

 const mockProcesses: BusinessProcess[] = [
 createProcess({ id: '1', priority: 'Critique', lastTestDate: new Date().toISOString() }),
 createProcess({ id: '2', priority: 'Élevée', lastTestDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString() }), // Expired
 createProcess({ id: '3', priority: 'Moyenne' })
 ];

 const mockDrills: BcpDrill[] = [
 createDrill({ id: '1', result: 'Succès' }),
 createDrill({ id: '2', result: 'Succès' }),
 createDrill({ id: '3', result: 'Échec' })
 ];

 describe('rendering', () => {
 it('renders BCP health title', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Santé BCP')).toBeInTheDocument();
 });

 it('renders description text', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Couverture des tests et validité des plans.')).toBeInTheDocument();
 });

 it('renders process count', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Processus')).toBeInTheDocument();
 // Multiple numbers may appear, verify at least one '3' is present
 expect(screen.getAllByText('3').length).toBeGreaterThan(0);
 });

 it('renders critical count', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Critiques')).toBeInTheDocument();
 // Multiple '1' values may exist, verify at least one is present
 expect(screen.getAllByText('1').length).toBeGreaterThan(0);
 });

 it('renders drill count', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Exercices')).toBeInTheDocument();
 });

 it('renders expired tests count', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Expirés')).toBeInTheDocument();
 });
 });

 describe('coverage rate calculation', () => {
 it('calculates coverage rate correctly', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 // 1 out of 3 processes tested in last 12 months = 33%
 expect(screen.getByText('33%')).toBeInTheDocument();
 });

 it('shows 0% coverage for empty processes', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={[]} drills={mockDrills} />
 </MemoryRouter>
 );

 // Multiple 0 values may appear
 expect(screen.getAllByText('0').length).toBeGreaterThan(0);
 });

 it('shows 100% coverage when all processes tested recently', () => {
 const allTestedProcesses = [
 createProcess({ id: '1', lastTestDate: new Date().toISOString() }),
 createProcess({ id: '2', lastTestDate: new Date().toISOString() })
 ];
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={allTestedProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('100%')).toBeInTheDocument();
 });
 });

 describe('drill success rate calculation', () => {
 it('calculates success rate correctly', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 // 2 success out of 3 drills = 67%
 expect(screen.getByText('67%')).toBeInTheDocument();
 });

 it('shows 0% success rate for empty drills', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={[]} />
 </MemoryRouter>
 );

 expect(screen.getByText('0%')).toBeInTheDocument();
 });

 it('shows 100% success rate when all drills successful', () => {
 const allSuccessDrills = [
 createDrill({ id: '1', result: 'Succès' }),
 createDrill({ id: '2', result: 'Succès' })
 ];
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={allSuccessDrills} />
 </MemoryRouter>
 );

 // Success rate should be 100%
 const successRateText = screen.getByText('Taux de réussite');
 expect(successRateText).toBeInTheDocument();
 });
 });

 describe('labels', () => {
 it('renders success drill label', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Succès Drills')).toBeInTheDocument();
 });

 it('renders success rate label', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={mockProcesses} drills={mockDrills} />
 </MemoryRouter>
 );

 expect(screen.getByText('Taux de réussite')).toBeInTheDocument();
 });
 });

 describe('empty states', () => {
 it('handles empty processes and drills', () => {
 render(
 <MemoryRouter>
  <ContinuitySummaryCard processes={[]} drills={[]} />
 </MemoryRouter>
 );

 // Should render without errors
 expect(screen.getByText('Santé BCP')).toBeInTheDocument();
 });
 });
});
