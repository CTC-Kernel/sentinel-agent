/**
 * SkipLink Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink, SkipLinks } from '../SkipLink';

describe('SkipLink', () => {
    it('should render skip link', () => {
        render(<SkipLink />);

        const link = screen.getByText('Aller au contenu principal');
        expect(link).toBeInTheDocument();
    });

    it('should have correct href', () => {
        render(<SkipLink />);

        const link = screen.getByText('Aller au contenu principal');
        expect(link).toHaveAttribute('href', '#main-content');
    });

    it('should be focusable', () => {
        render(<SkipLink />);

        const link = screen.getByText('Aller au contenu principal');
        expect(link).toHaveAttribute('tabIndex', '0');
    });

    it('should have sr-only class for screen reader accessibility', () => {
        render(<SkipLink />);

        const link = screen.getByText('Aller au contenu principal');
        expect(link.className).toContain('sr-only');
    });
});

describe('SkipLinks', () => {
    it('should render default links', () => {
        render(<SkipLinks />);

        expect(screen.getByText('Aller au contenu principal')).toBeInTheDocument();
        expect(screen.getByText('Aller à la navigation')).toBeInTheDocument();
        expect(screen.getByText('Aller à la recherche')).toBeInTheDocument();
    });

    it('should render custom links when provided', () => {
        const customLinks = [
            { href: '#custom-1', label: 'Custom Link 1' },
            { href: '#custom-2', label: 'Custom Link 2' }
        ];

        render(<SkipLinks links={customLinks} />);

        expect(screen.getByText('Custom Link 1')).toBeInTheDocument();
        expect(screen.getByText('Custom Link 2')).toBeInTheDocument();
        expect(screen.queryByText('Aller au contenu principal')).not.toBeInTheDocument();
    });

    it('should have correct hrefs for custom links', () => {
        const customLinks = [
            { href: '#section-a', label: 'Section A' },
            { href: '#section-b', label: 'Section B' }
        ];

        render(<SkipLinks links={customLinks} />);

        expect(screen.getByText('Section A')).toHaveAttribute('href', '#section-a');
        expect(screen.getByText('Section B')).toHaveAttribute('href', '#section-b');
    });

    it('should be contained in sr-only container', () => {
        const { container } = render(<SkipLinks />);

        expect(container.firstChild).toHaveClass('sr-only');
    });

    it('should render all default links with correct hrefs', () => {
        render(<SkipLinks />);

        expect(screen.getByText('Aller au contenu principal')).toHaveAttribute('href', '#main-content');
        expect(screen.getByText('Aller à la navigation')).toHaveAttribute('href', '#navigation');
        expect(screen.getByText('Aller à la recherche')).toHaveAttribute('href', '#search');
    });
});
