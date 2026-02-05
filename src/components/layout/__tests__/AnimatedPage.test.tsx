/**
 * Unit tests for AnimatedPage component
 * Tests animated page wrapper with framer-motion
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedPage } from '../AnimatedPage';

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
 <div className={className}>{children}</div>
 )
 }
}));

// Mock LoadingScreen
vi.mock('../../ui/LoadingScreen', () => ({
 LoadingScreen: () => <div data-testid="loading-screen">Loading...</div>
}));

describe('AnimatedPage', () => {
 describe('rendering', () => {
 it('renders children', () => {
 render(
 <AnimatedPage>
  <div>Test Content</div>
 </AnimatedPage>
 );

 expect(screen.getByText('Test Content')).toBeInTheDocument();
 });

 it('applies default styles', () => {
 const { container } = render(
 <AnimatedPage>
  <div>Content</div>
 </AnimatedPage>
 );

 const wrapper = container.firstChild as HTMLElement;
 expect(wrapper).toHaveClass('w-full');
 expect(wrapper).toHaveClass('flex-col');
 });

 it('applies custom className', () => {
 const { container } = render(
 <AnimatedPage className="custom-class">
  <div>Content</div>
 </AnimatedPage>
 );

 const wrapper = container.firstChild as HTMLElement;
 expect(wrapper).toHaveClass('custom-class');
 });

 it('renders multiple children', () => {
 render(
 <AnimatedPage>
  <div>First Child</div>
  <div>Second Child</div>
 </AnimatedPage>
 );

 expect(screen.getByText('First Child')).toBeInTheDocument();
 expect(screen.getByText('Second Child')).toBeInTheDocument();
 });

 it('renders nested content', () => {
 render(
 <AnimatedPage>
  <div>
  <h1>Title</h1>
  <p>Paragraph</p>
  </div>
 </AnimatedPage>
 );

 expect(screen.getByText('Title')).toBeInTheDocument();
 expect(screen.getByText('Paragraph')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('includes max-width constraint', () => {
 const { container } = render(
 <AnimatedPage>
  <div>Content</div>
 </AnimatedPage>
 );

 const wrapper = container.firstChild as HTMLElement;
 expect(wrapper.className).toContain('max-w-');
 });

 it('includes padding', () => {
 const { container } = render(
 <AnimatedPage>
  <div>Content</div>
 </AnimatedPage>
 );

 const wrapper = container.firstChild as HTMLElement;
 expect(wrapper.className).toContain('p-');
 });

 it('includes animation class', () => {
 const { container } = render(
 <AnimatedPage>
  <div>Content</div>
 </AnimatedPage>
 );

 const wrapper = container.firstChild as HTMLElement;
 expect(wrapper.className).toContain('animate-');
 });
 });
});
