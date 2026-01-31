/**
 * Unit tests for PrivacyData component
 * Tests data categories, DPIA, and retention display/edit
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyData } from '../PrivacyData';
import { ProcessingActivity } from '../../../../types';
import { ProcessingActivityFormData } from '../../../../schemas/privacySchema';
import { UseFormReturn } from 'react-hook-form';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
    const Icon = ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, ...props });
    return {
        Shield: Icon,
        FileSpreadsheet: Icon,
        AlertTriangle: ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'alert-triangle-icon', ...props }),
        Eye: ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'eye-icon', ...props }),
        History: Icon,
        Settings: Icon,
        Grid3X3: Icon,
        Unlock: Icon,
    };
});

// Mock FloatingLabelInput
vi.mock('../../../ui/FloatingLabelInput', () => ({
    FloatingLabelInput: ({ label, error, placeholder, textarea, ...props }: {
        label: string;
        error?: string;
        placeholder?: string;
        textarea?: boolean;
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
    CustomSelect: ({ label, value, onChange, options, multiple }: {
        label: string;
        value: string | string[];
        onChange: (val: string | string[]) => void;
        options: { value: string; label: string }[];
        multiple?: boolean;
        placeholder?: string;
    }) => (
        <div data-testid={`select-${label.replace(/\s+/g, '-').toLowerCase()}`}>
            <label>{label}</label>
            <select
                value={Array.isArray(value) ? value.join(',') : value}
                onChange={(e) => {
                    if (multiple) {
                        onChange(e.target.value.split(','));
                    } else {
                        onChange(e.target.value);
                    }
                }}
                aria-label={label}
                multiple={multiple}
            >
                {options.map(opt => (
                    <option key={opt.value || 'unknown'} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    )
}));

describe('PrivacyData', () => {
    const mockOnStartDPIA = vi.fn();
    const mockOnViewDPIA = vi.fn();
    const mockSetValue = vi.fn();
    const mockRegister = vi.fn((name: string) => ({ name }));
    const mockWatch = vi.fn();

    const mockForm = {
        register: mockRegister,
        setValue: mockSetValue,
        watch: mockWatch,
        formState: { errors: {} }
    } as Record<string, unknown>;

    const mockActivity: ProcessingActivity = {
        id: 'activity-1',
        organizationId: 'org-1',
        name: 'Employee Data Processing',
        purpose: 'HR management',
        manager: 'Jane Smith',
        legalBasis: 'Contrat',
        dataCategories: ['Etat Civil', 'Coordonnées', 'Vie Professionnelle'],
        dataSubjects: ['Employés'],
        retentionPeriod: '5 ans après la fin du contrat',
        hasDPIA: true,
        status: 'Actif'
    };

    const activityWithoutDPIA: ProcessingActivity = {
        ...mockActivity,
        hasDPIA: false
    };

    const activityWithNoCategories: ProcessingActivity = {
        ...mockActivity,
        dataCategories: []
    };

    const defaultProps = {
        activity: mockActivity,
        isEditing: false,
        form: mockForm as unknown as UseFormReturn<ProcessingActivityFormData>,
        onStartDPIA: mockOnStartDPIA,
        onViewDPIA: mockOnViewDPIA
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockWatch.mockImplementation((field: string) => {
            if (field === 'dataCategories') return ['Etat Civil', 'Coordonnées'];
            if (field === 'hasDPIA') return true;
            return undefined;
        });
    });

    describe('view mode', () => {
        it('renders data categories header', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText('Catégories de Données')).toBeInTheDocument();
        });

        it('displays data category badges', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText('Etat Civil')).toBeInTheDocument();
            expect(screen.getByText('Coordonnées')).toBeInTheDocument();
            expect(screen.getByText('Vie Professionnelle')).toBeInTheDocument();
        });

        it('shows fallback when no categories', () => {
            render(<PrivacyData {...defaultProps} activity={activityWithNoCategories} />);

            expect(screen.getByText('Aucune catégorie renseignée')).toBeInTheDocument();
        });

        it('renders conservation header', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText('Conservation')).toBeInTheDocument();
        });

        it('displays retention period', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText('5 ans après la fin du contrat')).toBeInTheDocument();
        });

        it('shows Non spécifié when no retention period', () => {
            const activityNoRetention = { ...mockActivity, retentionPeriod: '' };
            render(<PrivacyData {...defaultProps} activity={activityNoRetention} />);

            expect(screen.getByText('Non spécifié')).toBeInTheDocument();
        });
    });

    describe('DPIA section', () => {
        it('renders DPIA title', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText("Analyse d'Impact (DPIA)")).toBeInTheDocument();
        });

        it('shows DPIA required message when hasDPIA is true', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText("Une analyse d'impact est requise pour ce traitement.")).toBeInTheDocument();
        });

        it('shows DPIA not required message when hasDPIA is false', () => {
            render(<PrivacyData {...defaultProps} activity={activityWithoutDPIA} />);

            expect(screen.getByText("Aucune analyse d'impact n'est requise pour le moment.")).toBeInTheDocument();
        });

        it('shows Gérer DPIA button when hasDPIA is true', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText('Gérer DPIA')).toBeInTheDocument();
        });

        it('hides Gérer DPIA button when hasDPIA is false', () => {
            render(<PrivacyData {...defaultProps} activity={activityWithoutDPIA} />);

            expect(screen.queryByText('Gérer DPIA')).not.toBeInTheDocument();
        });

        it('calls onStartDPIA when button clicked', () => {
            render(<PrivacyData {...defaultProps} />);

            fireEvent.click(screen.getByText('Gérer DPIA'));

            expect(mockOnStartDPIA).toHaveBeenCalled();
        });

        it('shows action required warning when DPIA needed', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByText(/Action requise : Vérifier l'analyse d'impact/)).toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        it('renders data categories select', () => {
            render(<PrivacyData {...defaultProps} isEditing={true} />);

            expect(screen.getByText('Données collectées (Sélection multiple)')).toBeInTheDocument();
        });

        it('renders DPIA select', () => {
            render(<PrivacyData {...defaultProps} isEditing={true} />);

            expect(screen.getByText('DPIA Requis ?')).toBeInTheDocument();
        });

        it('renders retention input', () => {
            render(<PrivacyData {...defaultProps} isEditing={true} />);

            expect(screen.getByText('Durée et règles de conservation')).toBeInTheDocument();
        });

        it('renders section headers in edit mode', () => {
            render(<PrivacyData {...defaultProps} isEditing={true} />);

            expect(screen.getByText('Catégories de Données')).toBeInTheDocument();
            expect(screen.getByText("Analyse d'Impact (DPIA)")).toBeInTheDocument();
            expect(screen.getByText('Conservation')).toBeInTheDocument();
        });
    });

    describe('icons', () => {
        it('renders shield icon', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getAllByTestId('shield-icon').length).toBeGreaterThan(0);
        });

        it('renders alert triangle icon when DPIA required', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
        });

        it('renders eye icon on DPIA button', () => {
            render(<PrivacyData {...defaultProps} />);

            expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has animation class', () => {
            const { container } = render(<PrivacyData {...defaultProps} />);

            expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
        });

        it('has purple styling for DPIA section', () => {
            const { container } = render(<PrivacyData {...defaultProps} />);

            expect(container.querySelector('.bg-purple-50')).toBeInTheDocument();
        });
    });
});
