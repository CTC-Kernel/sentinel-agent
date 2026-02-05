/**
 * Unit tests for RiskStats component
 * Tests risk statistics display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskStats } from '../RiskStats';

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>
 }
}));

describe('RiskStats', () => {
 const mockStats = {
 total: 45,
 critical: 8,
 avgScore: 12.5,
 reductionPercentage: 23,
 untreatedCritical: 3
 };

 const mockRisks: never[] = [];

 describe('rendering', () => {
 it('renders total risks count', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getByText('45')).toBeInTheDocument();
 expect(screen.getByText('Risques identifiés')).toBeInTheDocument();
 });

 it('renders critical risks count', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getAllByText('Critiques').length).toBeGreaterThan(0);
 expect(screen.getByText('8')).toBeInTheDocument();
 });

 it('renders average score', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getByText('Score Moyen')).toBeInTheDocument();
 expect(screen.getByText('12.5')).toBeInTheDocument();
 expect(screen.getByText('/ 25')).toBeInTheDocument();
 });

 it('renders untreated critical count', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getByText('Non Traités')).toBeInTheDocument();
 expect(screen.getByText('3')).toBeInTheDocument();
 });

 it('renders reduction percentage', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getByText('Réduction')).toBeInTheDocument();
 expect(screen.getByText('23%')).toBeInTheDocument();
 });

 it('renders global view label', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getByText('Vue globale des risques')).toBeInTheDocument();
 });

 it('renders Score 15+ badge', () => {
 render(<RiskStats stats={mockStats} risks={mockRisks} />);

 expect(screen.getByText('Score 15+')).toBeInTheDocument();
 });
 });

 describe('different values', () => {
 it('renders zero total', () => {
 render(<RiskStats stats={{ ...mockStats, total: 0 }} risks={mockRisks} />);

 expect(screen.getByText('0')).toBeInTheDocument();
 });

 it('renders zero critical', () => {
 render(<RiskStats stats={{ ...mockStats, critical: 0, total: 5 }} risks={mockRisks} />);

 // Should still render the count even if 0
 expect(screen.getByText('5')).toBeInTheDocument();
 });

 it('renders decimal average score correctly', () => {
 render(<RiskStats stats={{ ...mockStats, avgScore: 7.333 }} risks={mockRisks} />);

 expect(screen.getByText('7.3')).toBeInTheDocument();
 });

 it('renders whole number average score', () => {
 render(<RiskStats stats={{ ...mockStats, avgScore: 10.0 }} risks={mockRisks} />);

 expect(screen.getByText('10.0')).toBeInTheDocument();
 });

 it('renders high reduction percentage', () => {
 render(<RiskStats stats={{ ...mockStats, reductionPercentage: 85 }} risks={mockRisks} />);

 expect(screen.getByText('85%')).toBeInTheDocument();
 });

 it('renders zero reduction percentage', () => {
 render(<RiskStats stats={{ ...mockStats, reductionPercentage: 0 }} risks={mockRisks} />);

 expect(screen.getByText('0%')).toBeInTheDocument();
 });
 });
});
