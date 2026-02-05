/**
 * VoxelExecutiveView Tests
 *
 * @see Story VOX-9.8: Mode Direction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
 VoxelExecutiveView,
 type ExecutiveKPI,
 type CriticalItem,
} from '../VoxelExecutiveView';

// ============================================================================
// Mocks
// ============================================================================

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
 TrendingUp: () => <span data-testid="icon-trending-up">TrendingUp</span>,
 TrendingDown: () => <span data-testid="icon-trending-down">TrendingDown</span>,
 Minus: () => <span data-testid="icon-minus">Minus</span>,
 AlertTriangle: () => <span data-testid="icon-alert">Alert</span>,
 Shield: () => <span data-testid="icon-shield">Shield</span>,
 Activity: () => <span data-testid="icon-activity">Activity</span>,
 Target: () => <span data-testid="icon-target">Target</span>,
 Users: () => <span data-testid="icon-users">Users</span>,
 Clock: () => <span data-testid="icon-clock">Clock</span>,
 ArrowRight: () => <span data-testid="icon-arrow">Arrow</span>,
}));

// ============================================================================
// Test Data
// ============================================================================

const mockKPIs: ExecutiveKPI[] = [
 {
 id: 'risk',
 label: 'Risk Score',
 value: 65,
 previousValue: 70,
 trend: 'down',
 changePercent: -7.1,
 higherIsBetter: false,
 icon: 'alert',
 },
 {
 id: 'compliance',
 label: 'Compliance',
 value: 92,
 previousValue: 88,
 unit: '%',
 trend: 'up',
 changePercent: 4.5,
 higherIsBetter: true,
 icon: 'shield',
 },
];

const mockCriticalItems: CriticalItem[] = [
 {
 id: 'item-1',
 title: 'Critical vulnerability found',
 severity: 'critical',
 ageInDays: 7,
 owner: 'Security Team',
 },
 {
 id: 'item-2',
 title: 'Access review pending',
 severity: 'high',
 ageInDays: 14,
 owner: 'IAM',
 },
];

// ============================================================================
// Tests
// ============================================================================

describe('VoxelExecutiveView', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('Visibility', () => {
 it('should render when visible', () => {
 render(<VoxelExecutiveView visible={true} />);
 expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
 });

 it('should not render when not visible', () => {
 const { container } = render(<VoxelExecutiveView visible={false} />);
 expect(container.firstChild).toBeNull();
 });
 });

 describe('KPIs Display', () => {
 it('should display KPI values', () => {
 render(<VoxelExecutiveView visible={true} kpis={mockKPIs} />);
 expect(screen.getByText('65')).toBeInTheDocument();
 expect(screen.getByText('92')).toBeInTheDocument();
 });

 it('should display KPI labels', () => {
 render(<VoxelExecutiveView visible={true} kpis={mockKPIs} />);
 // Risk Score appears in both gauge and KPI
 const riskScoreElements = screen.getAllByText('Risk Score');
 expect(riskScoreElements.length).toBeGreaterThanOrEqual(1);
 // Compliance appears in both gauge and KPI
 const complianceElements = screen.getAllByText('Compliance');
 expect(complianceElements.length).toBeGreaterThanOrEqual(1);
 });

 it('should display KPI units', () => {
 render(<VoxelExecutiveView visible={true} kpis={mockKPIs} />);
 expect(screen.getByText('%')).toBeInTheDocument();
 });

 it('should display trend indicators', () => {
 render(<VoxelExecutiveView visible={true} kpis={mockKPIs} />);
 expect(screen.getAllByTestId('icon-trending-down').length).toBeGreaterThan(0);
 expect(screen.getAllByTestId('icon-trending-up').length).toBeGreaterThan(0);
 });

 it('should display change percentages', () => {
 render(<VoxelExecutiveView visible={true} kpis={mockKPIs} />);
 expect(screen.getByText('-7.1%')).toBeInTheDocument();
 expect(screen.getByText('+4.5%')).toBeInTheDocument();
 });

 it('should display default KPIs when none provided', () => {
 render(<VoxelExecutiveView visible={true} />);
 // Default KPIs include Risk Score and Compliance
 expect(screen.getAllByText('Risk Score').length).toBeGreaterThanOrEqual(1);
 expect(screen.getAllByText('Compliance').length).toBeGreaterThanOrEqual(1);
 });
 });

 describe('Score Gauges', () => {
 it('should display risk score', () => {
 render(<VoxelExecutiveView visible={true} riskScore={75} />);
 expect(screen.getByText('75')).toBeInTheDocument();
 });

 it('should display compliance score', () => {
 render(<VoxelExecutiveView visible={true} complianceScore={88} />);
 expect(screen.getByText('88')).toBeInTheDocument();
 });

 it('should display gauge labels', () => {
 render(<VoxelExecutiveView visible={true} />);
 // Note: "Risk Score" appears both as gauge label and KPI label
 const riskScoreElements = screen.getAllByText('Risk Score');
 expect(riskScoreElements.length).toBeGreaterThanOrEqual(1);
 });
 });

 describe('Critical Items', () => {
 it('should display critical items section', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByText('Attention Required')).toBeInTheDocument();
 });

 it('should display critical item titles', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByText('Critical vulnerability found')).toBeInTheDocument();
 expect(screen.getByText('Access review pending')).toBeInTheDocument();
 });

 it('should display item age', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByText('7d old')).toBeInTheDocument();
 expect(screen.getByText('14d old')).toBeInTheDocument();
 });

 it('should display item owners', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByText('Security Team')).toBeInTheDocument();
 expect(screen.getByText('IAM')).toBeInTheDocument();
 });

 it('should display item count badge', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByText('2')).toBeInTheDocument();
 });

 it('should show empty message when no critical items', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={[]} />);
 expect(screen.getByText('No critical items')).toBeInTheDocument();
 });

 it('should call onCriticalItemClick when clicking an item', () => {
 const onCriticalItemClick = vi.fn();
 render(
 <VoxelExecutiveView
 visible={true}
 criticalItems={mockCriticalItems}
 onCriticalItemClick={onCriticalItemClick}
 />
 );

 const itemButton = screen.getByRole('button', { name: /view critical vulnerability/i });
 fireEvent.click(itemButton);

 expect(onCriticalItemClick).toHaveBeenCalledWith('item-1');
 });
 });

 describe('Last Updated', () => {
 it('should display "Just now" for recent updates', () => {
 const recentDate = new Date();
 render(<VoxelExecutiveView visible={true} lastUpdated={recentDate} />);
 expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
 });

 it('should display minutes for updates within an hour', () => {
 const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
 render(<VoxelExecutiveView visible={true} lastUpdated={fiveMinutesAgo} />);
 expect(screen.getByText(/updated 5m ago/i)).toBeInTheDocument();
 });

 it('should display hours for updates within a day', () => {
 const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
 render(<VoxelExecutiveView visible={true} lastUpdated={twoHoursAgo} />);
 expect(screen.getByText(/updated 2h ago/i)).toBeInTheDocument();
 });

 it('should not display timestamp when not provided', () => {
 render(<VoxelExecutiveView visible={true} />);
 expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
 });
 });

 describe('View Details', () => {
 it('should display view details button when callback provided', () => {
 const onViewDetails = vi.fn();
 render(<VoxelExecutiveView visible={true} onViewDetails={onViewDetails} />);
 expect(screen.getByRole('button', { name: /view detailed dashboard/i })).toBeInTheDocument();
 });

 it('should not display view details button when no callback', () => {
 render(<VoxelExecutiveView visible={true} />);
 expect(screen.queryByRole('button', { name: /view detailed dashboard/i })).not.toBeInTheDocument();
 });

 it('should call onViewDetails when clicking button', () => {
 const onViewDetails = vi.fn();
 render(<VoxelExecutiveView visible={true} onViewDetails={onViewDetails} />);

 const button = screen.getByRole('button', { name: /view detailed dashboard/i });
 fireEvent.click(button);

 expect(onViewDetails).toHaveBeenCalled();
 });
 });

 describe('Accessibility', () => {
 it('should have proper button labels for critical items', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByRole('button', { name: /view critical vulnerability/i })).toBeInTheDocument();
 expect(screen.getByRole('button', { name: /view access review/i })).toBeInTheDocument();
 });

 it('should have severity indicators', () => {
 render(<VoxelExecutiveView visible={true} criticalItems={mockCriticalItems} />);
 expect(screen.getByLabelText(/critical severity/i)).toBeInTheDocument();
 expect(screen.getByLabelText(/high severity/i)).toBeInTheDocument();
 });
 });

 describe('Edge Cases', () => {
 it('should handle empty KPIs array', () => {
 render(<VoxelExecutiveView visible={true} kpis={[]} />);
 expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
 });

 it('should handle KPIs without trends', () => {
 const kpiWithoutTrend: ExecutiveKPI[] = [
 {
 id: 'simple',
 label: 'Simple KPI',
 value: 100,
 },
 ];
 render(<VoxelExecutiveView visible={true} kpis={kpiWithoutTrend} />);
 expect(screen.getByText('100')).toBeInTheDocument();
 expect(screen.getByText('Simple KPI')).toBeInTheDocument();
 });

 it('should handle stable trend', () => {
 const stableKPI: ExecutiveKPI[] = [
 {
 id: 'stable',
 label: 'Stable Metric',
 value: 50,
 trend: 'stable',
 },
 ];
 render(<VoxelExecutiveView visible={true} kpis={stableKPI} />);
 expect(screen.getByTestId('icon-minus')).toBeInTheDocument();
 });

 it('should only show first 4 KPIs', () => {
 const manyKPIs: ExecutiveKPI[] = Array.from({ length: 6 }, (_, i) => ({
 id: `kpi-${i}`,
 label: `KPI ${i + 1}`,
 value: i * 10,
 }));
 render(<VoxelExecutiveView visible={true} kpis={manyKPIs} />);

 expect(screen.getByText('KPI 1')).toBeInTheDocument();
 expect(screen.getByText('KPI 4')).toBeInTheDocument();
 expect(screen.queryByText('KPI 5')).not.toBeInTheDocument();
 });

 it('should only show first 3 critical items', () => {
 const manyItems: CriticalItem[] = Array.from({ length: 5 }, (_, i) => ({
 id: `item-${i}`,
 title: `Critical Item ${i + 1}`,
 severity: 'critical' as const,
 ageInDays: i,
 }));
 render(<VoxelExecutiveView visible={true} criticalItems={manyItems} />);

 expect(screen.getByText('Critical Item 1')).toBeInTheDocument();
 expect(screen.getByText('Critical Item 3')).toBeInTheDocument();
 expect(screen.queryByText('Critical Item 4')).not.toBeInTheDocument();
 });
 });
});
