/**
 * Unit tests for SystemEntrance component
 * Tests system entrance landing page with boot sequence
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SystemEntrance } from '../SystemEntrance';

// Mock dependencies
vi.mock('../LandingMap', () => ({
 LandingMap: () => <div data-testid="landing-map">Map</div>
}));

vi.mock('../../ui/ThemeToggle', () => ({
 ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>
}));

vi.mock('../../ui/button', () => ({
 Button: ({ children, onClick, className }: {
 children: React.ReactNode;
 onClick?: () => void;
 className?: string;
 }) => (
 <button onClick={onClick} className={className}>{children}</button>
 )
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
 const actual = await vi.importActual('react-router-dom');
 return {
 ...actual,
 useNavigate: () => mockNavigate
 };
});

describe('SystemEntrance', () => {
 const renderComponent = () => {
 return render(
 <BrowserRouter>
 <SystemEntrance />
 </BrowserRouter>
 );
 };

 describe('boot sequence rendering', () => {
 it('renders initial boot screen', () => {
 renderComponent();

 // During boot, blinking cursor should be visible
 expect(screen.getByText('_')).toBeInTheDocument();
 });

 it('has boot screen styling', () => {
 const { container } = renderComponent();

 // Boot screen has font-mono class
 expect(container.querySelector('.font-mono')).toBeInTheDocument();
 });

 it('renders boot sequence container', () => {
 const { container } = renderComponent();

 // Container should exist
 expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
 });

 it('has correct background color classes', () => {
 const { container } = renderComponent();

 expect(container.querySelector('.bg-muted')).toBeInTheDocument();
 });
 });

 describe('component structure', () => {
 it('renders without errors', () => {
 expect(() => renderComponent()).not.toThrow();
 });

 it('renders a container div', () => {
 const { container } = renderComponent();

 expect(container.firstChild).toBeInTheDocument();
 });
 });
});
