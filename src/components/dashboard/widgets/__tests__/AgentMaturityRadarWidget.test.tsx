import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentMaturityRadarWidget } from '../AgentMaturityRadarWidget';
import { useAgentData } from '../../../../hooks/useAgentData';

// Mock the hook
vi.mock('../../../../hooks/useAgentData');
const mockedUseAgentData = useAgentData as unknown as { mockReturnValue: (val: unknown) => void };

// Mock Recharts to avoid SVG rendering issues in JSDOM
vi.mock('recharts', () => ({
 ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 RadarChart: ({ children, data }: { children: React.ReactNode; data: Array<{ subject: string }> }) => (
 <div data-testid="radar-chart">
 {data?.map((d) => <div key={d.subject || 'unknown'}>{d.subject}</div>)}
 {children}
 </div>
 ),
 PolarGrid: () => <div data-testid="polar-grid" />,
 PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
 PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
 Radar: ({ name }: { name: string }) => <div data-testid="radar">{name}</div>,
 Tooltip: () => <div data-testid="tooltip" />,
}));

describe('AgentMaturityRadarWidget', () => {
 const mockT = (key: string) => key;
 const mockNavigate = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders loading state correctly', () => {
 mockedUseAgentData.mockReturnValue({
 agents: [],
 loading: true,
 error: null,
 refresh: vi.fn(),
 stats: { total: 0, active: 0, offline: 0, error: 0, avgCompliance: 0 } as unknown,
 recentResults: []
 });

 render(<AgentMaturityRadarWidget t={mockT} navigate={mockNavigate} />);
 expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
 });

 it('renders radar subjects with data', () => {
 mockedUseAgentData.mockReturnValue({
 agents: [
 { id: '1', status: 'active', complianceScore: 80, version: '1.0.0', lastHeartbeat: new Date().toISOString() } as unknown,
 { id: '2', status: 'offline', complianceScore: 60, version: '0.9.0', lastHeartbeat: new Date(0).toISOString() } as unknown
 ],
 loading: false,
 error: null,
 refresh: vi.fn(),
 stats: { total: 2, active: 1, offline: 1, error: 0, avgCompliance: 70 } as unknown,
 recentResults: []
 });

 render(<AgentMaturityRadarWidget t={mockT} navigate={mockNavigate} />);

 // Check for subjects (mockT returns the key)
 expect(screen.getByText('dashboard.agentMaturity.compliance')).toBeInTheDocument();
 expect(screen.getByText('dashboard.agentMaturity.availability')).toBeInTheDocument();
 expect(screen.getByText('64')).toBeInTheDocument(); // Score is now a number without % in the center
 });

 it('renders empty state when no agents', () => {
 mockedUseAgentData.mockReturnValue({
 agents: [],
 loading: false,
 error: null,
 refresh: vi.fn(),
 stats: { total: 0, active: 0, offline: 0, error: 0, avgCompliance: 0 } as unknown,
 recentResults: []
 });

 render(<AgentMaturityRadarWidget t={mockT} navigate={mockNavigate} />);
 expect(screen.getByText('agents.widget.title')).toBeInTheDocument();
 });
});
