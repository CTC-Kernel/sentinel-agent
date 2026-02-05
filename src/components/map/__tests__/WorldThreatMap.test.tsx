/**
 * Unit tests for WorldThreatMap component
 * Tests threat map display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorldThreatMap } from '../WorldThreatMap';

// Mock react-simple-maps
vi.mock('react-simple-maps', () => ({
 ComposableMap: ({ children }: { children: React.ReactNode }) => (
 <div data-testid="composable-map">{children}</div>
 ),
 Geographies: ({ children }: { children: (props: { geographies: unknown[] }) => React.ReactNode }) => (
 <div data-testid="geographies">{children({ geographies: [] })}</div>
 ),
 Geography: () => <div data-testid="geography" />,
 Marker: ({ children }: { children: React.ReactNode }) => (
 <div data-testid="marker">{children}</div>
 ),
 ZoomableGroup: ({ children }: { children: React.ReactNode }) => (
 <div data-testid="zoomable-group">{children}</div>
 )
}));

// Mock d3-scale
vi.mock('d3-scale', () => ({
 scaleLinear: () => {
 const scale = (value: number) => {
 if (value >= 10) return '#ef4444';
 if (value >= 5) return '#f97316';
 if (value >= 1) return '#3b82f6';
 return '#1e293b';
 };
 scale.domain = () => scale;
 scale.range = () => scale;
 return scale;
 }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
 <div className={className}>{children}</div>
 )
 },
 AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('WorldThreatMap', () => {
 const mockData = [
 {
 country: 'USA',
 value: 8,
 markers: [
 { coordinates: [-74, 40.7] as [number, number], name: 'New York Threat', type: 'Malware', severity: 'Critical' as const }
 ]
 },
 {
 country: 'France',
 value: 3,
 markers: [
 { coordinates: [2.3, 48.8] as [number, number], name: 'Paris Threat', type: 'Phishing', severity: 'High' as const }
 ]
 }
 ];

 describe('rendering', () => {
 it('renders map container', () => {
 const { container } = render(<WorldThreatMap data={mockData} />);

 expect(container.querySelector('.bg-slate-950')).toBeInTheDocument();
 });

 it('renders composable map', () => {
 render(<WorldThreatMap data={mockData} />);

 expect(screen.getByTestId('composable-map')).toBeInTheDocument();
 });

 it('renders zoomable group', () => {
 render(<WorldThreatMap data={mockData} />);

 expect(screen.getByTestId('zoomable-group')).toBeInTheDocument();
 });

 it('renders geographies', () => {
 render(<WorldThreatMap data={mockData} />);

 expect(screen.getByTestId('geographies')).toBeInTheDocument();
 });
 });

 describe('HUD overlay', () => {
 it('renders tactical view label', () => {
 render(<WorldThreatMap data={mockData} />);

 expect(screen.getByText('TACTICAL VIEW')).toBeInTheDocument();
 });

 it('renders live feed indicator', () => {
 render(<WorldThreatMap data={mockData} />);

 expect(screen.getByText('LIVE FEED')).toBeInTheDocument();
 });
 });

 describe('with empty data', () => {
 it('renders map with no threats', () => {
 render(<WorldThreatMap data={[]} />);

 expect(screen.getByTestId('composable-map')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('has background container', () => {
 const { container } = render(<WorldThreatMap data={mockData} />);

 // Check for any background-related class
 const bgElement = container.querySelector('[class*="bg-"]');
 expect(bgElement).toBeInTheDocument();
 });

 it('has rounded container', () => {
 const { container } = render(<WorldThreatMap data={mockData} />);

 // Check for rounded class
 const roundedElement = container.querySelector('[class*="rounded"]');
 expect(roundedElement).toBeInTheDocument();
 });

 it('has pulse animation on live indicator', () => {
 const { container } = render(<WorldThreatMap data={mockData} />);

 expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
 });
 });
});
