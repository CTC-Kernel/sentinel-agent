/**
 * Unit tests for MigrationTool component
 * Tests migration tool UI and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrationTool } from '../MigrationTool';

// Mock store
const mockAddToast = vi.fn();
vi.mock('../../../store', () => ({
    useStore: () => ({
        addToast: mockAddToast
    })
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock MigrationService
const mockRunMigration = vi.fn();
vi.mock('../../../services/migrationService', () => ({
    MigrationService: {
        runOrganizationMigration: (callback: (p: { progress: number; logs: string[] }) => void) => mockRunMigration(callback)
    }
}));

describe('MigrationTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRunMigration.mockResolvedValue({ totalFixed: 5, orgFixed: 2 });
    });

    describe('rendering', () => {
        it('renders tool header', () => {
            render(<MigrationTool />);

            expect(screen.getByText('Migration & Intégrité')).toBeInTheDocument();
        });

        it('renders description', () => {
            render(<MigrationTool />);

            expect(screen.getByText('Vérifier et réparer la cohérence des données multi-tenant.')).toBeInTheDocument();
        });

        it('renders initial ready message', () => {
            render(<MigrationTool />);

            expect(screen.getByText('Prêt à démarrer...')).toBeInTheDocument();
        });

        it('renders start button', () => {
            render(<MigrationTool />);

            expect(screen.getByText('Lancer la Migration')).toBeInTheDocument();
        });
    });

    describe('migration process', () => {
        it('shows loading state when migration starts', async () => {
            mockRunMigration.mockImplementation(() => new Promise(() => {}));

            render(<MigrationTool />);

            fireEvent.click(screen.getByText('Lancer la Migration'));

            await waitFor(() => {
                expect(screen.getByText('Migration en cours...')).toBeInTheDocument();
            });
        });

        it('disables button during migration', async () => {
            mockRunMigration.mockImplementation(() => new Promise(() => {}));

            render(<MigrationTool />);

            fireEvent.click(screen.getByText('Lancer la Migration'));

            await waitFor(() => {
                expect(screen.getByText('Migration en cours...').closest('button')).toBeDisabled();
            });
        });

        it('shows success toast on completion', async () => {
            render(<MigrationTool />);

            fireEvent.click(screen.getByText('Lancer la Migration'));

            await waitFor(() => {
                expect(mockAddToast).toHaveBeenCalledWith(
                    'Migration terminée. 5 documents et 2 organisations corrigés.',
                    'success'
                );
            });
        });

        it('shows error toast on failure', async () => {
            mockRunMigration.mockRejectedValue(new Error('Test error'));

            render(<MigrationTool />);

            fireEvent.click(screen.getByText('Lancer la Migration'));

            await waitFor(() => {
                expect(mockAddToast).toHaveBeenCalledWith('Erreur lors de la migration', 'error');
            });
        });
    });

    describe('progress tracking', () => {
        it('calls migration with progress callback', async () => {
            render(<MigrationTool />);

            fireEvent.click(screen.getByText('Lancer la Migration'));

            await waitFor(() => {
                expect(mockRunMigration).toHaveBeenCalledWith(expect.any(Function));
            });
        });
    });

    describe('styling', () => {
        it('has glass panel styling', () => {
            const { container } = render(<MigrationTool />);

            expect(container.querySelector('.glass-panel')).toBeInTheDocument();
        });

        it('has log display area', () => {
            const { container } = render(<MigrationTool />);

            expect(container.querySelector('.font-mono')).toBeInTheDocument();
        });
    });
});
