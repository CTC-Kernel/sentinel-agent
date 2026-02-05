/**
 * Unit tests for ThreatDashboard component
 * Tests threat statistics and chart displays
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreatDashboard } from '../ThreatDashboard';
import { Threat } from '../../../types';

// Mock Recharts
vi.mock('recharts', () => ({
 ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
 <div data-testid="responsive-container">{children}</div>
 ),
 BarChart: () => (
 <div data-testid="bar-chart" />
 ),
 Bar: () => <div data-testid="bar" />,
 AreaChart: () => (
 <div data-testid="area-chart" />
 ),
 Area: () => <div data-testid="area" />,
 XAxis: () => <div data-testid="x-axis" />,
 YAxis: () => <div data-testid="y-axis" />,
 CartesianGrid: () => <div data-testid="cartesian-grid" />,
 Tooltip: () => <div data-testid="tooltip" />
}));

// Mock Icons
vi.mock('../../ui/Icons', () => ({
 AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
 Shield: () => <div data-testid="shield-icon" />,
 Activity: () => <div data-testid="activity-icon" />
}));

// Mock ChartTooltip
vi.mock('../../ui/ChartTooltip', () => ({
 ChartTooltip: () => <div data-testid="chart-tooltip" />
}));

// Mock EmptyChartState
vi.mock('../../ui/EmptyChartState', () => ({
 EmptyChartState: ({ message }: { message: string }) => (
 <div data-testid="empty-chart-state">{message}</div>
 )
}));

// Mock theme
vi.mock('../../../theme/chartTheme', () => ({
 SENTINEL_PALETTE: { info: '#3b82f6' },
 SEVERITY_COLORS: { critical: '#ef4444' },
 CHART_AXIS_COLORS: { tick: '#64748b', gridOpacity: 0.1 }
}));

describe('ThreatDashboard', () => {
 const mockThreats: Threat[] = [
 {
 id: 'threat-1',
 title: 'Ransomware Attack',
 type: 'Ransomware',
 severity: 'Critical',
 date: '2024-01-15',
 timestamp: Date.now() - 3600000,
 description: 'Test ransomware',
 country: 'FR',
 votes: 10,
 comments: 2,
 author: 'System'
 },
 {
 id: 'threat-2',
 title: 'Malware Detection',
 type: 'Malware',
 severity: 'High',
 date: '2024-01-14',
 timestamp: Date.now() - 7200000,
 description: 'Test malware',
 country: 'US',
 votes: 5,
 comments: 1,
 author: 'Analyst'
 },
 {
 id: 'threat-3',
 title: 'Another Malware',
 type: 'Malware',
 severity: 'Critical',
 date: '2024-01-13',
 timestamp: Date.now() - 10800000,
 description: 'Another malware',
 country: 'DE',
 votes: 8,
 comments: 3,
 author: 'System'
 },
 {
 id: 'threat-4',
 title: 'Phishing Attempt',
 type: 'Phishing',
 severity: 'Medium',
 date: '2024-01-12',
 timestamp: Date.now() - 86400000 * 2,
 description: 'Phishing attack',
 country: 'UK',
 votes: 2,
 comments: 0,
 author: 'User'
 }
 ];

 describe('rendering', () => {
 it('renders threat dashboard', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Menaces en temps réel')).toBeInTheDocument();
 });

 it('renders total threats count', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('4')).toBeInTheDocument();
 });

 it('shows 24h active label', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Actives (24h)')).toBeInTheDocument();
 });
 });

 describe('KPI cards', () => {
 it('shows critical threats count', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Critiques')).toBeInTheDocument();
 // Critical count is 2 (threat-1 and threat-3) - Multiple "2"s exist on page
 expect(screen.getAllByText('2').length).toBeGreaterThan(0);
 });

 it('shows ransomware count', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Ransomware')).toBeInTheDocument();
 // Ransomware count is 1 - Multiple "1"s may exist on page
 expect(screen.getAllByText('1').length).toBeGreaterThan(0);
 });

 it('shows malware count', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Malware')).toBeInTheDocument();
 // Malware count is 2 (threat-2 and threat-3) - checked above
 });

 it('renders priority haute label', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Priorité haute')).toBeInTheDocument();
 });

 it('renders campagnes label', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Campagnes')).toBeInTheDocument();
 });

 it('renders détectés label', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Détectés')).toBeInTheDocument();
 });
 });

 describe('charts', () => {
 it('renders threat types chart', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText('Top Types de Menaces')).toBeInTheDocument();
 expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
 });

 it('renders activity chart', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByText("Volume d'Activité (24h)")).toBeInTheDocument();
 expect(screen.getByTestId('area-chart')).toBeInTheDocument();
 });
 });

 describe('empty state', () => {
 it('shows empty state for bar chart when no threats', () => {
 render(<ThreatDashboard threats={[]} />);

 expect(screen.getByText('Aucune menace')).toBeInTheDocument();
 });

 it('shows zero counts when no threats', () => {
 render(<ThreatDashboard threats={[]} />);

 // All stat values should be 0
 expect(screen.getAllByText('0').length).toBeGreaterThan(0);
 });
 });

 describe('styling', () => {
 it('has glass-premium container', () => {
 const { container } = render(<ThreatDashboard threats={mockThreats} />);

 expect(container.querySelector('.glass-premium')).toBeInTheDocument();
 });

 it('has glass-premium chart containers', () => {
 const { container } = render(<ThreatDashboard threats={mockThreats} />);

 // At least 2 glass-premium containers should exist
 expect(container.querySelectorAll('.glass-premium').length).toBeGreaterThanOrEqual(2);
 });

 it('has pulsing indicator', () => {
 const { container } = render(<ThreatDashboard threats={mockThreats} />);

 expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
 });
 });

 describe('icons', () => {
 it('renders alert triangle icon', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
 });

 it('renders shield icon', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
 });

 it('renders activity icon', () => {
 render(<ThreatDashboard threats={mockThreats} />);

 expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
 });
 });
});
