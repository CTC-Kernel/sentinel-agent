/**
 * Unit tests for FolderTree component
 * Tests folder tree navigation and CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderTree } from '../FolderTree';
import { DocumentFolder } from '../../../types';

// Mock Icons
vi.mock('../../ui/Icons', () => ({
    Folder: () => <span data-testid="folder-icon" />,
    FolderOpen: () => <span data-testid="folder-open-icon" />,
    ChevronRight: () => <span data-testid="chevron-right-icon" />,
    ChevronDown: () => <span data-testid="chevron-down-icon" />,
    Plus: () => <span data-testid="plus-icon" />,
    MoreVertical: () => <span data-testid="more-icon" />,
    Edit2: () => <span data-testid="edit-icon" />,
    Trash2: () => <span data-testid="trash-icon" />,
    Loader2: () => <span data-testid="loader-icon" />
}));

// Mock Button
vi.mock('../../ui/button', () => ({
    Button: ({ children, onClick, className, disabled, 'aria-label': ariaLabel }: {
        children: React.ReactNode;
        onClick?: () => void;
        className?: string;
        disabled?: boolean;
        'aria-label'?: string;
    }) => (
        <button onClick={onClick} className={className} disabled={disabled} aria-label={ariaLabel}>
            {children}
        </button>
    )
}));

// Mock ConfirmModal
vi.mock('../../ui/ConfirmModal', () => ({
    ConfirmModal: ({ isOpen, onClose, onConfirm, title }: {
        isOpen: boolean;
        onClose: () => void;
        onConfirm: () => void;
        title: string;
        message: string;
        loading?: boolean;
        closeOnConfirm?: boolean;
    }) => isOpen ? (
        <div data-testid="confirm-modal">
            <h3>{title}</h3>
            <button onClick={onClose} data-testid="cancel-delete">Annuler</button>
            <button onClick={onConfirm} data-testid="confirm-delete">Confirmer</button>
        </div>
    ) : null
}));

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
    useForm: () => ({
        register: (name: string) => ({ name }),
        handleSubmit: (fn: (data: { name: string }) => void) => (e: React.FormEvent) => {
            e.preventDefault();
            fn({ name: 'New Folder' });
        },
        formState: { errors: {} },
        reset: vi.fn()
    })
}));

// Mock zod resolver
vi.mock('@hookform/resolvers/zod', () => ({
    zodResolver: () => vi.fn()
}));

describe('FolderTree', () => {
    const mockOnSelectFolder = vi.fn();
    const mockOnCreateFolder = vi.fn();
    const mockOnUpdateFolder = vi.fn();
    const mockOnDeleteFolder = vi.fn();

    const mockFolders: DocumentFolder[] = [
        {
            id: 'folder-1',
            organizationId: 'org-1',
            name: 'Policies',
            parentId: undefined,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        },
        {
            id: 'folder-2',
            organizationId: 'org-1',
            name: 'Procedures',
            parentId: undefined,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        },
        {
            id: 'folder-3',
            organizationId: 'org-1',
            name: 'Security Policies',
            parentId: 'folder-1',
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z'
        },
        {
            id: 'folder-4',
            organizationId: 'org-1',
            name: 'HR Policies',
            parentId: 'folder-1',
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z'
        }
    ];

    const defaultProps = {
        folders: mockFolders,
        selectedFolderId: null,
        onSelectFolder: mockOnSelectFolder,
        onCreateFolder: mockOnCreateFolder,
        onUpdateFolder: mockOnUpdateFolder,
        onDeleteFolder: mockOnDeleteFolder
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnCreateFolder.mockResolvedValue(undefined);
        mockOnDeleteFolder.mockResolvedValue(undefined);
    });

    describe('header', () => {
        it('renders Dossiers header', () => {
            render(<FolderTree {...defaultProps} />);

            expect(screen.getByText('Dossiers')).toBeInTheDocument();
        });

        it('renders create root folder button', () => {
            render(<FolderTree {...defaultProps} />);

            expect(screen.getByLabelText('Créer un nouveau dossier racine')).toBeInTheDocument();
        });

        it('opens create modal when button clicked', () => {
            render(<FolderTree {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Créer un nouveau dossier racine'));

            expect(screen.getByText('Nouveau Dossier')).toBeInTheDocument();
        });
    });

    describe('all documents option', () => {
        it('renders all documents option', () => {
            render(<FolderTree {...defaultProps} />);

            expect(screen.getByText('Tous les documents')).toBeInTheDocument();
        });

        it('calls onSelectFolder with null when clicked', () => {
            render(<FolderTree {...defaultProps} selectedFolderId="folder-1" />);

            fireEvent.click(screen.getByText('Tous les documents'));

            expect(mockOnSelectFolder).toHaveBeenCalledWith(null);
        });

        it('highlights when selected', () => {
            const { container } = render(<FolderTree {...defaultProps} selectedFolderId={null} />);

            expect(container.querySelector('.bg-brand-50')).toBeInTheDocument();
        });
    });

    describe('folder list', () => {
        it('renders root folders', () => {
            render(<FolderTree {...defaultProps} />);

            expect(screen.getByText('Policies')).toBeInTheDocument();
            expect(screen.getByText('Procedures')).toBeInTheDocument();
        });

        it('calls onSelectFolder when folder clicked', () => {
            render(<FolderTree {...defaultProps} />);

            fireEvent.click(screen.getByText('Policies'));

            expect(mockOnSelectFolder).toHaveBeenCalledWith('folder-1');
        });

        it('shows expand button for folders with children', () => {
            render(<FolderTree {...defaultProps} />);

            // Policies has children so should have visible expand button
            expect(screen.getAllByLabelText('Déplier le dossier').length).toBeGreaterThan(0);
        });
    });

    describe('folder expansion', () => {
        it('shows children when expanded', () => {
            render(<FolderTree {...defaultProps} />);

            // Click expand button for Policies folder
            const expandButtons = screen.getAllByLabelText('Déplier le dossier');
            fireEvent.click(expandButtons[0]);

            // Children should now be visible
            expect(screen.getByText('Security Policies')).toBeInTheDocument();
            expect(screen.getByText('HR Policies')).toBeInTheDocument();
        });
    });

    describe('create modal', () => {
        it('shows folder name input', () => {
            render(<FolderTree {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Créer un nouveau dossier racine'));

            expect(screen.getByLabelText('Nom du nouveau dossier')).toBeInTheDocument();
        });

        it('shows cancel button', () => {
            render(<FolderTree {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Créer un nouveau dossier racine'));

            expect(screen.getByLabelText('Annuler la création')).toBeInTheDocument();
        });

        it('shows confirm button', () => {
            render(<FolderTree {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Créer un nouveau dossier racine'));

            expect(screen.getByLabelText('Confirmer la création')).toBeInTheDocument();
        });

        it('closes when cancel clicked', () => {
            render(<FolderTree {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Créer un nouveau dossier racine'));
            fireEvent.click(screen.getByLabelText('Annuler la création'));

            expect(screen.queryByText('Nouveau Dossier')).not.toBeInTheDocument();
        });
    });

    describe('folder options', () => {
        it('shows options button on hover', () => {
            render(<FolderTree {...defaultProps} />);

            // Options buttons exist but are hidden until hover
            expect(screen.getAllByLabelText('Options du dossier').length).toBeGreaterThan(0);
        });
    });

    describe('styling', () => {
        it('highlights selected folder', () => {
            const { container } = render(<FolderTree {...defaultProps} selectedFolderId="folder-1" />);

            // Selected folder should have highlight class
            expect(container.querySelectorAll('.bg-brand-50').length).toBeGreaterThan(0);
        });
    });

    describe('icons', () => {
        it('renders folder icons', () => {
            render(<FolderTree {...defaultProps} />);

            // At least one folder icon for root folders and "all documents"
            expect(screen.getAllByTestId('folder-icon').length).toBeGreaterThan(0);
        });

        it('renders plus icon in create button', () => {
            render(<FolderTree {...defaultProps} />);

            expect(screen.getAllByTestId('plus-icon').length).toBeGreaterThan(0);
        });
    });
});
