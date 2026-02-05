/**
 * RiskContext View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RiskContextView } from '../RiskContext';

// Mock dependencies
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => key,
 i18n: { language: 'fr' }
 })
}));

vi.mock('../../components/ui/PageHeader', () => ({
 PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
 <div data-testid="page-header">
 <h1>{title}</h1>
 <p>{subtitle}</p>
 </div>
 )
}));

vi.mock('../../components/risks/context/RiskContextManager', () => ({
 RiskContextManager: () => <div data-testid="risk-context-manager">Risk Context Manager</div>
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
 MasterpieceBackground: () => <div data-testid="masterpiece-bg" />
}));

vi.mock('../../components/SEO', () => ({
 SEO: () => null
}));

const renderComponent = () => {
 return render(
 <BrowserRouter>
 <RiskContextView />
 </BrowserRouter>
 );
};

describe('RiskContextView', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders the page header with correct title', () => {
 renderComponent();
 expect(screen.getByTestId('page-header')).toBeInTheDocument();
 expect(screen.getByText('riskContext.title')).toBeInTheDocument();
 });

 it('renders the risk context manager component', () => {
 renderComponent();
 expect(screen.getByTestId('risk-context-manager')).toBeInTheDocument();
 });

 it('renders the masterpiece background', () => {
 renderComponent();
 expect(screen.getByTestId('masterpiece-bg')).toBeInTheDocument();
 });

 it('has proper container structure', () => {
 const { container } = renderComponent();
 expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
 expect(container.querySelector('.max-w-7xl')).toBeInTheDocument();
 });

 it('exports as default', async () => {
 const module = await import('../RiskContext');
 expect(module.default).toBeDefined();
 });
});
