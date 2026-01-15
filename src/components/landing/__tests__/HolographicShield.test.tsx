/**
 * Unit tests for HolographicShield component
 * Tests animated shield visual display
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HolographicShield } from '../HolographicShield';

describe('HolographicShield', () => {
    describe('rendering', () => {
        it('renders shield icon', () => {
            const { container } = render(<HolographicShield />);

            // Shield icon should be present
            const shieldIcon = container.querySelector('.lucide-shield');
            expect(shieldIcon).toBeInTheDocument();
        });

        it('renders outer rotating ring', () => {
            const { container } = render(<HolographicShield />);

            // Check for rotating ring element
            const ring = container.querySelector('.rounded-full.border');
            expect(ring).toBeInTheDocument();
        });

        it('renders pulsing core', () => {
            const { container } = render(<HolographicShield />);

            // Check for pulsing element
            const pulse = container.querySelector('.animate-pulse');
            expect(pulse).toBeInTheDocument();
        });

        it('renders center emblem container', () => {
            const { container } = render(<HolographicShield />);

            // Center emblem with backdrop blur
            const emblem = container.querySelector('.backdrop-blur-md');
            expect(emblem).toBeInTheDocument();
        });

        it('renders orbital particles', () => {
            const { container } = render(<HolographicShield />);

            // Check for orbital particle elements
            const particles = container.querySelectorAll('.absolute.w-full.h-full');
            expect(particles.length).toBeGreaterThan(0);
        });
    });

    describe('styling', () => {
        it('has perspective styling', () => {
            const { container } = render(<HolographicShield />);

            expect(container.firstChild).toHaveClass('perspective-1000');
        });

        it('has pointer-events-none to prevent interaction', () => {
            const { container } = render(<HolographicShield />);

            expect(container.firstChild).toHaveClass('pointer-events-none');
        });

        it('has select-none to prevent selection', () => {
            const { container } = render(<HolographicShield />);

            expect(container.firstChild).toHaveClass('select-none');
        });

        it('has proper dimensions', () => {
            const { container } = render(<HolographicShield />);

            expect(container.firstChild).toHaveClass('w-96');
            expect(container.firstChild).toHaveClass('h-96');
        });
    });

    describe('animations', () => {
        it('has spin animations on rings', () => {
            const { container } = render(<HolographicShield />);

            // Elements with spin animation - check if any element has animate- in class
            const allElements = container.querySelectorAll('*');
            const hasSpinAnimation = Array.from(allElements).some(el =>
                el.className && typeof el.className === 'string' && el.className.includes('animate-')
            );
            expect(hasSpinAnimation).toBe(true);
        });

        it('has float animation on center', () => {
            const { container } = render(<HolographicShield />);

            const floatElement = container.querySelector('.animate-float');
            expect(floatElement).toBeInTheDocument();
        });
    });
});
