/**
 * Unit tests for ProjectsDebug view
 * Tests the debug page for projects routing
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectsDebug } from '../ProjectsDebug';

describe('ProjectsDebug', () => {
 it('renders the debug page title', () => {
 render(<ProjectsDebug />);
 expect(screen.getByText('Projects Debug Page')).toBeInTheDocument();
 });

 it('displays debug information', () => {
 render(<ProjectsDebug />);
 expect(screen.getByText(/This is a debug version/)).toBeInTheDocument();
 expect(screen.getByText(/the routing is working/)).toBeInTheDocument();
 });

 it('mentions the original Projects component', () => {
 render(<ProjectsDebug />);
 expect(screen.getByText(/original Projects component/)).toBeInTheDocument();
 });

 it('has proper styling containers', () => {
 const { container } = render(<ProjectsDebug />);

 // Check for main container with padding
 expect(container.querySelector('.p-8')).toBeInTheDocument();

 // Check for styled content box
 expect(container.querySelector('.bg-card')).toBeInTheDocument();
 expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
 });
});
