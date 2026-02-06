/**
 * VendorConcentration View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import VendorConcentration from '../VendorConcentration';

vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => key,
 i18n: { language: 'fr' }
 })
}));

vi.mock('../../store', () => ({
 useStore: (selector?: (state: Record<string, unknown>) => unknown) => {
 const state = {
 user: { uid: 'user-123', organizationId: 'org-123' },
 organization: { id: 'org-123' },
 language: 'fr' as const,
 t: (key: string) => key
 };
 return selector ? selector(state) : state;
 }
}));

vi.mock('../../services/VendorConcentrationService', () => ({
 VendorConcentrationService: {
 getCachedMetrics: vi.fn().mockResolvedValue(null),
 calculateConcentrationMetrics: vi.fn().mockResolvedValue({
 totalVendors: 10,
 activeVendors: 8,
 spofCount: 2,
 highDependencyCount: 3,
 overallHHI: 1500,
 concentrationLevel: 'moderate',
 categoryConcentration: []
 }),
 identifySPOFs: vi.fn().mockResolvedValue({ totalSPOFs: 2, criticalSPOFs: 1, alerts: [] }),
 generateRecommendations: vi.fn().mockResolvedValue({
 totalRecommendations: 3,
 highPriority: 1,
 estimatedTotalRiskReduction: 15,
 recommendations: []
 }),
 getConcentrationTrends: vi.fn().mockResolvedValue({
 trendDirection: 'stable',
 changePercentage: 0,
 overallTrend: []
 }),
 buildDependencyMatrix: vi.fn().mockResolvedValue({ vendors: [], dependencies: [] })
 }
}));

vi.mock('../../components/vendor-concentration/CategoryChart', () => ({
 CategoryChart: () => <div data-testid="category-chart">Category Chart</div>
}));

vi.mock('../../components/vendor-concentration/DependencyMatrix', () => ({
 DependencyMatrix: () => <div data-testid="dependency-matrix">Dependency Matrix</div>
}));

vi.mock('../../components/vendor-concentration/SPOFAlerts', () => ({
 SPOFAlerts: () => <div data-testid="spof-alerts">SPOF Alerts</div>
}));

vi.mock('../../components/vendor-concentration/ConcentrationRecommendations', () => ({
 ConcentrationRecommendations: () => <div data-testid="recommendations">Recommendations</div>
}));

const renderComponent = () => {
 return render(
 <BrowserRouter>
 <VendorConcentration />
 </BrowserRouter>
 );
};

describe('VendorConcentration View', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders the view', async () => {
 renderComponent();
 await waitFor(() => {
 expect(screen.getByText('vendorConcentration.title')).toBeInTheDocument();
 });
 });

 it('renders metric cards', async () => {
 renderComponent();
 await waitFor(() => {
 // First metric card shows totalVendors
 expect(screen.getByText('vendorConcentration.metrics.totalVendors')).toBeInTheDocument();
 });
 });

 it('renders tabs for different views', async () => {
 renderComponent();
 await waitFor(() => {
 // Check for tab buttons (component uses custom tab buttons, not role="tablist")
 expect(screen.getByText('vendorConcentration.tabs.overview')).toBeInTheDocument();
 });
 });

 it('exports as default', async () => {
 const module = await import('../VendorConcentration');
 expect(module.default).toBeDefined();
 });
});
