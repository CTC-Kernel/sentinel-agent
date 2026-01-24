/**
 * ProgressRing Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from '../ProgressRing';

// Mock BRAND_COLORS
vi.mock('../../../constants/colors', () => ({
    BRAND_COLORS: {
        500: '#3b82f6'
    }
}));

describe('ProgressRing', () => {
    it('should render with default props', () => {
        render(<ProgressRing progress={50} />);

        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should render correct percentage', () => {
        render(<ProgressRing progress={75} />);

        expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should round percentage', () => {
        render(<ProgressRing progress={33.7} />);

        expect(screen.getByText('34%')).toBeInTheDocument();
    });

    it('should render 0%', () => {
        render(<ProgressRing progress={0} />);

        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should render 100%', () => {
        render(<ProgressRing progress={100} />);

        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should render label when provided', () => {
        render(<ProgressRing progress={50} label="Complete" />);

        expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('should not render percentage when showLabel is false', () => {
        render(<ProgressRing progress={50} showLabel={false} />);

        expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(
            <ProgressRing progress={50} className="custom-class" />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render SVG with correct size', () => {
        const { container } = render(<ProgressRing progress={50} size={200} />);

        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '200');
        expect(svg).toHaveAttribute('height', '200');
    });

    it('should render both background and progress circles', () => {
        const { container } = render(<ProgressRing progress={50} />);

        const circles = container.querySelectorAll('circle');
        // 3 circles: background, progress with gradient, and animated tip glow
        expect(circles.length).toBeGreaterThanOrEqual(2);
    });

    it('should apply custom color', () => {
        const { container } = render(
            <ProgressRing progress={50} color="#ff0000" />
        );

        const circles = container.querySelectorAll('circle');
        // Progress circle uses gradient, check that tip glow circle has fill color
        const tipGlow = circles[2]; // tip glow is the third circle
        expect(tipGlow).toHaveAttribute('fill', '#ff0000');
    });

    it('should apply custom backgroundColor', () => {
        const { container } = render(
            <ProgressRing progress={50} backgroundColor="#cccccc" />
        );

        const circles = container.querySelectorAll('circle');
        // First circle is the background circle
        expect(circles[0]).toHaveAttribute('stroke', '#cccccc');
    });

    it('should calculate correct stroke offset for different progress values', () => {
        const { container: container0 } = render(<ProgressRing progress={0} />);
        const { container: container50 } = render(<ProgressRing progress={50} />);
        const { container: container100 } = render(<ProgressRing progress={100} />);

        const circles0 = container0.querySelectorAll('circle');
        const circles50 = container50.querySelectorAll('circle');
        const circles100 = container100.querySelectorAll('circle');

        const offset0 = circles0[1].getAttribute('stroke-dashoffset');
        const offset50 = circles50[1].getAttribute('stroke-dashoffset');
        const offset100 = circles100[1].getAttribute('stroke-dashoffset');

        // Progress 0 should have full offset (circumference)
        // Progress 100 should have 0 offset
        expect(parseFloat(offset0!)).toBeGreaterThan(parseFloat(offset50!));
        expect(parseFloat(offset50!)).toBeGreaterThan(parseFloat(offset100!));
        expect(parseFloat(offset100!)).toBeCloseTo(0);
    });
});
