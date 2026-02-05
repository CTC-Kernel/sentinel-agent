import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComplianceScoreWidget } from '../ComplianceScoreWidget';
import type { GlobalComplianceScore as ComplianceScore, GlobalScoreHistory as ScoreHistory } from '../../../types/score.types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>,
 span: ({ children, className, ...props }: React.ComponentProps<'span'>) => <span className={className} {...props}>{children}</span>,
 circle: (props: React.SVGProps<SVGCircleElement>) => <circle {...props} />,
 },
 AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock microInteractions utilities
vi.mock('../../../utils/microInteractions', () => ({
 appleEasing: [0.16, 1, 0.3, 1],
 animateCounter: vi.fn((_from: number, to: number, _duration: number, onUpdate: (v: number) => void, onComplete?: () => void) => {
 onUpdate(to);
 if (onComplete) onComplete();
 return () => { };
 }),
 triggerConfetti: vi.fn(),
 triggerHaptic: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
 const Icon = ({ className, ...props }: React.ComponentProps<'svg'>) => <svg className={`icon ${className}`} {...props} />;
 return {
 TrendingUp: Icon,
 TrendingDown: Icon,
 Minus: Icon,
 Settings: Icon,
 Grid3X3: Icon,
 Unlock: Icon,
 };
});

// Mock the useComplianceScore hook
vi.mock('../../../hooks/useComplianceScore', () => ({
 useComplianceScore: vi.fn(),
}));

import { useComplianceScore } from '../../../hooks/useComplianceScore';

const mockScore: ComplianceScore = {
 global: 75,
 byFramework: {
 iso27001: 80,
 nis2: 70,
 dora: 65,
 rgpd: 85,
 },
 trend: 'up',
 lastCalculated: new Date().toISOString(),
 breakdown: {
 controls: { score: 80, weight: 0.40 },
 risks: { score: 70, weight: 0.30 },
 documents: { score: 75, weight: 0.10 },
 audits: { score: 72, weight: 0.20 },
 },
 calculationDetails: {
 implementedControls: 80,
 actionableControls: 100,
 totalRisks: 50,
 criticalRisks: 5,
 totalDocuments: 60,
 validDocuments: 45,
 totalFindings: 50,
 compliantFindings: 36,
 },
};

const mockHistory: ScoreHistory[] = [
 { date: '2026-01-08', global: 70 },
 { date: '2026-01-09', global: 72 },
 { date: '2026-01-10', global: 75 },
];

describe('ComplianceScoreWidget', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should render loading skeleton when loading', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: null,
 breakdown: null,
 trend: null,
 history: [],
 loading: true,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" />);

 // Should show skeleton (animated pulse elements)
 const skeleton = document.querySelector('.animate-pulse');
 expect(skeleton).toBeInTheDocument();
 });

 it('should render error state when error occurs', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: null,
 breakdown: null,
 trend: null,
 history: [],
 loading: false,
 error: new Error('Test error'),
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" />);

 expect(screen.getByText(/Impossible de charger le score/)).toBeInTheDocument();
 expect(screen.getByText('Réessayer')).toBeInTheDocument();
 });

 it('should render empty state when no score exists', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: null,
 breakdown: null,
 trend: null,
 history: [],
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" />);

 expect(screen.getByText('Aucun score calculé')).toBeInTheDocument();
 });

 it('should render score gauge when score exists', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" />);

 expect(screen.getByRole('meter')).toBeInTheDocument();
 expect(screen.getByText('75')).toBeInTheDocument();
 });

 it('should display title', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" title="Custom Title" />);

 expect(screen.getByText('Custom Title')).toBeInTheDocument();
 });

 it('should display status label', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" />);

 // Score 75 is at the boundary, so it's "À améliorer" (warning level)
 expect(screen.getByText('À améliorer')).toBeInTheDocument();
 });

 it('should show sparkline when showSparkline is true and history exists', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" showSparkline={true} />);

 // Sparkline should render SVG elements
 const svgs = document.querySelectorAll('svg');
 expect(svgs.length).toBeGreaterThan(1); // Gauge SVG + Sparkline SVG
 });

 it('should not show sparkline when showSparkline is false', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" showSparkline={false} />);

 // Should not have sparkline - look for the unique sparkline container with history icon
 const svgs = document.querySelectorAll('svg');
 // Only the gauge SVG should be present (not the sparkline SVG)
 expect(svgs.length).toBe(1);
 });

 it('should open breakdown panel on gauge click', async () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" showBreakdownOnClick={true} />);

 const gauge = screen.getByRole('meter');
 fireEvent.click(gauge);

 await waitFor(() => {
 expect(screen.getByText('Détail du Score')).toBeInTheDocument();
 });
 });

 it('should close breakdown panel when backdrop is clicked', async () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" showBreakdownOnClick={true} />);

 // Open panel
 const gauge = screen.getByRole('meter');
 fireEvent.click(gauge);

 await waitFor(() => {
 expect(screen.getByText('Détail du Score')).toBeInTheDocument();
 });

 // Click backdrop to close
 const backdrop = document.querySelector('.fixed.inset-0');
 fireEvent.click(backdrop!);

 await waitFor(() => {
 expect(screen.queryByText('Détail du Score')).not.toBeInTheDocument();
 });
 });

 it('should not open breakdown panel when showBreakdownOnClick is false', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 render(<ComplianceScoreWidget organizationId="org-123" showBreakdownOnClick={false} />);

 const gauge = screen.getByRole('meter');
 fireEvent.click(gauge);

 expect(screen.queryByText('Détail du Score')).not.toBeInTheDocument();
 });

 it('should apply custom className', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 const { container } = render(
 <ComplianceScoreWidget organizationId="org-123" className="custom-widget" />
 );

 expect(container.querySelector('.custom-widget')).toBeInTheDocument();
 });

 it('should use different gauge sizes', () => {
 vi.mocked(useComplianceScore).mockReturnValue({
 score: mockScore,
 breakdown: mockScore.breakdown,
 trend: 'up',
 history: mockHistory,
 loading: false,
 error: null,
 refetch: vi.fn(),
 });

 const { rerender } = render(
 <ComplianceScoreWidget organizationId="org-123" size="lg" />
 );

 let svg = screen.getByRole('meter').querySelector('svg');
 expect(svg).toHaveAttribute('width', '180');

 rerender(<ComplianceScoreWidget organizationId="org-123" size="sm" />);

 svg = screen.getByRole('meter').querySelector('svg');
 expect(svg).toHaveAttribute('width', '80');
 });
});
