/**
 * Unit tests for IntakeForm component
 * Tests asset intake form validation and submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntakeForm } from '../IntakeForm';

// Mock IntakeService
const mockFetchOptions = vi.fn();
const mockSubmitAsset = vi.fn();
vi.mock('../../../services/intakeService', () => ({
    IntakeService: {
        fetchOptions: () => mockFetchOptions(),
        submitAsset: (data: unknown) => mockSubmitAsset(data)
    }
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock Icons
vi.mock('../../ui/Icons', () => ({
    Laptop: () => <span data-testid="laptop-icon" />,
    Save: () => <span data-testid="save-icon" />,
    AlertTriangle: () => <span data-testid="alert-icon" />,
    User: () => <span data-testid="user-icon" />,
    Server: () => <span data-testid="server-icon" />,
    Database: () => <span data-testid="database-icon" />
}));

// Mock UI components
vi.mock('../../ui/button', () => ({
    Button: ({ children, isLoading, ...props }: {
        children: React.ReactNode;
        isLoading?: boolean;
        [key: string]: unknown;
    }) => (
        <button {...props}>
            {isLoading ? 'Loading...' : children}
        </button>
    )
}));

vi.mock('../../ui/FloatingLabelInput', () => ({
    FloatingLabelInput: ({ label, error, ...props }: {
        label: string;
        error?: string;
        [key: string]: unknown;
    }) => (
        <div>
            <input aria-label={label} {...props} />
            {error && <span data-testid="error">{error}</span>}
        </div>
    )
}));

vi.mock('../../ui/CustomSelect', () => ({
    CustomSelect: ({ label, value, onChange, options }: {
        label: string;
        value: string;
        onChange: (value: string) => void;
        options: Array<{ value: string; label: string }>;
    }) => (
        <select
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-testid={`select-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
            <option value="">--</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )
}));

vi.mock('../../ui/FloatingLabelTextarea', () => ({
    FloatingLabelTextarea: ({ label, ...props }: {
        label: string;
        [key: string]: unknown;
    }) => (
        <textarea aria-label={label} {...props} />
    )
}));

// Mock useZodForm
vi.mock('../../../hooks/useZodForm', () => ({
    useZodForm: ({ defaultValues }: { defaultValues: Record<string, string> }) => ({
        register: (name: string) => ({
            name,
            onChange: vi.fn(),
            onBlur: vi.fn(),
            ref: vi.fn()
        }),
        handleSubmit: (fn: (data: unknown) => void) => (e: React.FormEvent) => {
            e.preventDefault();
            fn({
                name: 'Test Device',
                serialNumber: 'SN123',
                userId: '',
                projectId: '',
                notes: '',
                hardwareType: defaultValues?.hardwareType || 'Laptop'
            });
        },
        setValue: vi.fn(),
        watch: (name: string) => defaultValues?.[name] || '',
        formState: { errors: {} }
    })
}));

describe('IntakeForm', () => {
    const mockHardwareInfo = {
        os: 'macOS Sonoma',
        browser: 'Chrome 121',
        ram: '16 GB',
        gpu: 'Apple M1 Pro',
        cpuCores: '10',
        screenResolution: '2560x1440',
        isMobile: false,
        fingerprint: 'abc123'
    };

    const defaultProps = {
        hardwareInfo: mockHardwareInfo,
        orgId: 'org-123',
        onSuccess: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchOptions.mockResolvedValue({
            projects: [
                { id: 'proj-1', name: 'Project Alpha' },
                { id: 'proj-2', name: 'Project Beta' }
            ],
            users: [
                { uid: 'user-1', displayName: 'John Doe' },
                { uid: 'user-2', displayName: 'Jane Smith' }
            ]
        });
        mockSubmitAsset.mockResolvedValue({ id: 'asset-1' });
    });

    describe('rendering', () => {
        it('renders hardware detected section', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('Matériel Détecté')).toBeInTheDocument();
        });

        it('renders complementary info section', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('Informations Complémentaires')).toBeInTheDocument();
        });

        it('renders equipment name input', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByLabelText("Nom de l'équipement")).toBeInTheDocument();
        });

        it('renders serial number input', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByLabelText('Numéro de Série')).toBeInTheDocument();
        });

        it('renders user select', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByLabelText('Utilisateur Principal')).toBeInTheDocument();
        });

        it('renders project select', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByLabelText('Projet Associé')).toBeInTheDocument();
        });

        it('renders equipment type select', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByLabelText("Type d'équipement")).toBeInTheDocument();
        });

        it('renders notes textarea', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByLabelText('Notes')).toBeInTheDocument();
        });

        it('renders submit button', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText("Enregistrer l'équipement")).toBeInTheDocument();
        });
    });

    describe('hardware info display', () => {
        it('displays GPU information', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('Apple M1 Pro')).toBeInTheDocument();
        });

        it('displays CPU cores', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('10 Cœurs logiques')).toBeInTheDocument();
        });

        it('displays OS information', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText(/macOS Sonoma/)).toBeInTheDocument();
        });

        it('displays RAM information', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText(/16 GB/)).toBeInTheDocument();
        });

        it('displays browser information', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText(/Chrome 121/)).toBeInTheDocument();
        });

        it('displays screen resolution', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('2560x1440')).toBeInTheDocument();
        });
    });

    describe('form labels', () => {
        it('shows Processeur / GPU label', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('Processeur / GPU')).toBeInTheDocument();
        });

        it('shows Mémoire & OS label', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('Mémoire & OS')).toBeInTheDocument();
        });

        it('shows Affichage label', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByText('Affichage')).toBeInTheDocument();
        });
    });

    describe('form submission', () => {
        it('calls IntakeService.submitAsset on submit', async () => {
            render(<IntakeForm {...defaultProps} />);

            const submitButton = screen.getByText("Enregistrer l'équipement");
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockSubmitAsset).toHaveBeenCalled();
            });
        });

        it('calls onSuccess after successful submission', async () => {
            render(<IntakeForm {...defaultProps} />);

            const submitButton = screen.getByText("Enregistrer l'équipement");
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(defaultProps.onSuccess).toHaveBeenCalled();
            });
        });
    });

    describe('error handling', () => {
        it('shows error when submission fails', async () => {
            mockSubmitAsset.mockRejectedValue(new Error('Submit failed'));

            render(<IntakeForm {...defaultProps} />);

            const submitButton = screen.getByText("Enregistrer l'équipement");
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText("Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.")).toBeInTheDocument();
            });
        });

        it('shows error when orgId is missing', async () => {
            render(<IntakeForm {...defaultProps} orgId="" />);

            const submitButton = screen.getByText("Enregistrer l'équipement");
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Organisation non identifiée. Lien invalide.')).toBeInTheDocument();
            });
        });
    });

    describe('fetching options', () => {
        it('fetches options on mount', async () => {
            render(<IntakeForm {...defaultProps} />);

            await waitFor(() => {
                expect(mockFetchOptions).toHaveBeenCalled();
            });
        });

        it('does not fetch options when orgId is empty', async () => {
            render(<IntakeForm {...defaultProps} orgId="" />);

            // Wait a bit to ensure no fetch happens
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockFetchOptions).not.toHaveBeenCalled();
        });
    });

    describe('styling', () => {
        it('has glass-panel containers', () => {
            const { container } = render(<IntakeForm {...defaultProps} />);

            expect(container.querySelectorAll('.glass-panel').length).toBe(2);
        });
    });

    describe('icons', () => {
        it('renders laptop icons', () => {
            render(<IntakeForm {...defaultProps} />);

            // Multiple laptop icons may exist in the UI
            expect(screen.getAllByTestId('laptop-icon').length).toBeGreaterThan(0);
        });

        it('renders save icon in button', () => {
            render(<IntakeForm {...defaultProps} />);

            expect(screen.getByTestId('save-icon')).toBeInTheDocument();
        });
    });
});
