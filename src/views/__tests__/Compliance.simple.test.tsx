import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Compliance } from '../Compliance';

// Simple test without complex mocks
describe('Compliance View', () => {
    it('renders without crashing', () => {
        render(<Compliance />);
        // Basic test to ensure component renders
        expect(screen.getByText('Conformité')).toBeInTheDocument();
    });

    it('displays framework selector', () => {
        render(<Compliance />);
        expect(screen.getByText('ISO 27001 (Sécurité SI)')).toBeInTheDocument();
    });

    it('displays navigation tabs', () => {
        render(<Compliance />);
        expect(screen.getByText('Vue d\'ensemble')).toBeInTheDocument();
        expect(screen.getByText('Contrôles')).toBeInTheDocument();
        expect(screen.getByText('SoA')).toBeInTheDocument();
    });
});
