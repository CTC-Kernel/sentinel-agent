/**
 * Unit tests for PrivacyDetails component
 * Tests privacy activity details display and edit form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyDetails } from '../PrivacyDetails';
import { ProcessingActivity, UserProfile } from '../../../../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    User: () => <span data-testid="user-icon" />,
    Calendar: () => <span data-testid="calendar-icon" />,
    Tag: () => <span data-testid="tag-icon" />
}));

// Mock FloatingLabelInput
vi.mock('../../../ui/FloatingLabelInput', () => ({
    FloatingLabelInput: ({ label, error, placeholder, textarea, icon: _icon, ...props }: {
        label: string;
        error?: string;
        placeholder?: string;
        textarea?: boolean;
        icon?: React.ComponentType;
        [key: string]: unknown;
    }) => (
        <div data-testid={`input-${label.replace(/\s+/g, '-').toLowerCase()}`}>
            <label>{label}</label>
            {textarea ? (
                <textarea aria-label={label} placeholder={placeholder} {...props} />
            ) : (
                <input aria-label={label} placeholder={placeholder} {...props} />
            )}
            {error && <span data-testid="error">{error}</span>}
        </div>
    )
}));

// Mock CustomSelect
vi.mock('../../../ui/CustomSelect', () => ({
    CustomSelect: ({ label, value, onChange, options, error }: {
        label: string;
        value: string;
        onChange: (val: string) => void;
        options: { value: string; label: string }[];
        placeholder?: string;
        error?: string;
    }) => (
        <div data-testid="custom-select">
            <label>{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
            >
                <option value="">Select...</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {error && <span data-testid="select-error">{error}</span>}
        </div>
    )
}));

describe('PrivacyDetails', () => {
    const mockSetValue = vi.fn();
    const mockRegister = vi.fn((name: string) => ({ name }));
    const mockWatch = vi.fn();

    const mockForm = {
        register: mockRegister,
        setValue: mockSetValue,
        watch: mockWatch,
        formState: { errors: {} }
    };

    const mockUsersList: UserProfile[] = [
        {
            uid: 'user-1',
            email: 'alice@example.com',
            displayName: 'Alice Martin',
            role: 'admin',
            organizationId: 'org-1'
        },
        {
            uid: 'user-2',
            email: 'bob@example.com',
            displayName: 'Bob Dupont',
            role: 'user',
            organizationId: 'org-1'
        }
    ];

    const mockActivity: ProcessingActivity = {
        id: 'activity-1',
        organizationId: 'org-1',
        name: 'Gestion de la paie',
        purpose: 'Traitement des salaires et obligations fiscales des employés.',
        manager: 'Alice Martin',
        managerId: 'user-1',
        legalBasis: 'Obligation Légale',
        dataCategories: ['Données financières', 'Données personnelles'],
        dataSubjects: ['Employés'],
        hasDPIA: false,
        retentionPeriod: '5 ans',
        status: 'Actif',
        createdAt: '2024-01-15T10:00:00Z'
    };

    const activityWithoutPurpose: ProcessingActivity = {
        ...mockActivity,
        purpose: ''
    };

    const activityWithoutManager: ProcessingActivity = {
        ...mockActivity,
        managerId: '',
        manager: ''
    };

    const defaultProps = {
        activity: mockActivity,
        isEditing: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form: mockForm as any,
        usersList: mockUsersList
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockWatch.mockReturnValue('user-1');
    });

    describe('view mode', () => {
        it('renders description header', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Description & Finalité')).toBeInTheDocument();
        });

        it('displays purpose label', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Finalité')).toBeInTheDocument();
        });

        it('displays activity purpose', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Traitement des salaires et obligations fiscales des employés.')).toBeInTheDocument();
        });

        it('shows fallback when no purpose', () => {
            render(<PrivacyDetails {...defaultProps} activity={activityWithoutPurpose} />);

            expect(screen.getByText('Non spécifié')).toBeInTheDocument();
        });

        it('renders responsibility section', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Responsabilité')).toBeInTheDocument();
        });

        it('displays responsable label', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Responsable')).toBeInTheDocument();
        });

        it('displays manager name', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Alice Martin')).toBeInTheDocument();
        });

        it('shows Non assigné when no manager', () => {
            render(<PrivacyDetails {...defaultProps} activity={activityWithoutManager} />);

            expect(screen.getByText('Non assigné')).toBeInTheDocument();
        });

        it('renders metadata section', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Métadonnées')).toBeInTheDocument();
        });

        it('displays created date label', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByText('Créé le')).toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        it('renders name input field', () => {
            render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(screen.getByText("Nom de l'activité")).toBeInTheDocument();
        });

        it('renders manager select', () => {
            render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(screen.getByText('Responsable du traitement')).toBeInTheDocument();
        });

        it('renders purpose textarea', () => {
            render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(screen.getByText('Finalité du traitement')).toBeInTheDocument();
        });

        it('renders custom select for manager', () => {
            render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(screen.getByTestId('custom-select')).toBeInTheDocument();
        });

        it('shows manager options', () => {
            render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(screen.getByText('Alice Martin')).toBeInTheDocument();
            expect(screen.getByText('Bob Dupont')).toBeInTheDocument();
        });

        it('calls setValue when manager changed', () => {
            render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            const select = screen.getByRole('combobox', { name: 'Responsable du traitement' });
            fireEvent.change(select, { target: { value: 'user-2' } });

            expect(mockSetValue).toHaveBeenCalledWith('managerId', 'user-2', { shouldDirty: true });
        });
    });

    describe('icons', () => {
        it('renders user icon in view mode', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByTestId('user-icon')).toBeInTheDocument();
        });

        it('renders calendar icon in view mode', () => {
            render(<PrivacyDetails {...defaultProps} />);

            expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
        });
    });

    describe('validation errors', () => {
        it('displays name error when present', () => {
            const formWithErrors = {
                ...mockForm,
                formState: {
                    errors: {
                        name: { message: 'Le nom est requis' }
                    }
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            render(<PrivacyDetails {...defaultProps} isEditing={true} form={formWithErrors as any} />);

            expect(screen.getByText('Le nom est requis')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has animation class in view mode', () => {
            const { container } = render(<PrivacyDetails {...defaultProps} />);

            expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
        });

        it('has animation class in edit mode', () => {
            const { container } = render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
        });

        it('has proper grid layout in edit mode', () => {
            const { container } = render(<PrivacyDetails {...defaultProps} isEditing={true} />);

            expect(container.querySelector('.grid')).toBeInTheDocument();
        });
    });
});
