/**
 * Unit tests for RiskFormIdentificationTab component
 * Tests threat identification form fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskFormIdentificationTab } from '../RiskFormIdentificationTab';

// Mock react-hook-form Controller
vi.mock('react-hook-form', () => ({
    Controller: ({ render: renderProp }: {
        control: unknown;
        name: string;
        render: (props: { field: { value: string; onChange: (val: string) => void } }) => React.ReactNode;
    }) => renderProp({ field: { value: '', onChange: vi.fn() } })
}));

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    FileText: () => <span data-testid="file-text-icon" />,
    Search: () => <span data-testid="search-icon" />,
    BookOpen: () => <span data-testid="book-icon" />
}));

// Mock FloatingLabelInput
vi.mock('../../../ui/FloatingLabelInput', () => ({
    FloatingLabelInput: ({ label, error, ...props }: {
        label: string;
        error?: string;
        textarea?: boolean;
        [key: string]: unknown;
    }) => (
        <div data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            <label>{label}</label>
            {props.textarea ? (
                <textarea aria-label={label} {...props} />
            ) : (
                <input aria-label={label} {...props} />
            )}
            {error && <span data-testid="error">{error}</span>}
        </div>
    )
}));

// Mock RichTextEditor
vi.mock('../../../ui/RichTextEditor', () => ({
    RichTextEditor: ({ label, value, onChange, error }: {
        label: string;
        value: string;
        onChange: (val: string) => void;
        error?: string;
    }) => (
        <div data-testid="rich-text-editor">
            <label>{label}</label>
            <textarea
                aria-label={label}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <span data-testid="error">{error}</span>}
        </div>
    )
}));

// Mock AIAssistButton
vi.mock('../../../ai/AIAssistButton', () => ({
    AIAssistButton: ({ onSuggest, fieldName }: { onSuggest: (val: string) => void; fieldName: string }) => (
        <button
            data-testid={`ai-assist-${fieldName.toLowerCase()}`}
            onClick={() => onSuggest(`Suggested ${fieldName}`)}
        >
            AI Assist
        </button>
    )
}));

// Mock riskConstants
vi.mock('../../../../data/riskConstants', () => ({
    STANDARD_THREATS: ['Ransomware', 'Phishing', 'DDoS Attack', 'Data Breach']
}));

import type { Asset } from '../../../../types';
import { Criticality } from '../../../../types/common';
import type { RiskFormIdentificationTabProps } from '../riskFormTypes';

describe('RiskFormIdentificationTab', () => {
    const mockSetValue = vi.fn();
    const mockSetShowLibraryModal = vi.fn();
    const mockGetValues = vi.fn();
    const mockRegister = vi.fn((name: string) => ({ name }));

    const mockControl = {
        register: mockRegister
    };

    const mockAssets: Asset[] = [
        {
            id: 'asset-1',
            name: 'Server-01',
            type: 'Matériel',
            organizationId: 'org-1',
            owner: 'IT Team',
            confidentiality: Criticality.HIGH,
            integrity: Criticality.HIGH,
            availability: Criticality.HIGH,
            location: 'Datacenter',
            createdAt: '2024-01-01'
        },
        {
            id: 'asset-2',
            name: 'Database-01',
            type: 'Logiciel',
            organizationId: 'org-1',
            owner: 'DBA Team',
            confidentiality: Criticality.CRITICAL,
            integrity: Criticality.CRITICAL,
            availability: Criticality.HIGH,
            location: 'Cloud',
            createdAt: '2024-01-01'
        }
    ];

    const defaultProps = {
        control: mockControl as unknown as RiskFormIdentificationTabProps['control'],
        errors: {},
        assets: mockAssets,
        getValues: mockGetValues as unknown as RiskFormIdentificationTabProps['getValues'],
        setValue: mockSetValue as unknown as RiskFormIdentificationTabProps['setValue'],
        setShowLibraryModal: mockSetShowLibraryModal,
        showLibraryModal: false
    } satisfies RiskFormIdentificationTabProps;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetValues.mockImplementation((field: string) => {
            if (field === 'assetId') return 'asset-1';
            if (field === 'threat') return 'Test threat';
            return '';
        });
    });

    describe('rendering', () => {
        it('renders section header', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            // i18n returns key when not configured
            expect(screen.getByText('risks.tabs.identification')).toBeInTheDocument();
        });

        it('renders FileText icon', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
        });

        it('renders threat input field', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            // i18n returns key when not configured
            expect(screen.getByLabelText('common.threat')).toBeInTheDocument();
        });

        it('renders vulnerability rich text editor', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
            // i18n returns key when not configured
            expect(screen.getByText('common.vulnerability')).toBeInTheDocument();
        });

        it('renders scenario textarea', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            // i18n returns key when not configured
            expect(screen.getByLabelText('risks.scenario')).toBeInTheDocument();
        });
    });

    describe('library button', () => {
        it('renders library button', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            // i18n returns key when not configured
            expect(screen.getByText('common.library')).toBeInTheDocument();
        });

        it('opens library modal when clicked', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            fireEvent.click(screen.getByText('common.library'));

            expect(mockSetShowLibraryModal).toHaveBeenCalledWith(true);
        });

        it('renders book icon', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            expect(screen.getByTestId('book-icon')).toBeInTheDocument();
        });
    });

    describe('AI assist buttons', () => {
        it('renders AI assist for threat field', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            // fieldName uses i18n key
            expect(screen.getByTestId('ai-assist-common.threat')).toBeInTheDocument();
        });

        it('renders AI assist for vulnerability field', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            // fieldName uses i18n key
            expect(screen.getByTestId('ai-assist-common.vulnerability')).toBeInTheDocument();
        });

        it('calls setValue when threat AI assist clicked', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            fireEvent.click(screen.getByTestId('ai-assist-common.threat'));

            expect(mockSetValue).toHaveBeenCalledWith('threat', 'Suggested common.threat', { shouldDirty: true });
        });

        it('calls setValue when vulnerability AI assist clicked', () => {
            render(<RiskFormIdentificationTab {...defaultProps} />);

            fireEvent.click(screen.getByTestId('ai-assist-common.vulnerability'));

            expect(mockSetValue).toHaveBeenCalledWith('vulnerability', 'Suggested common.vulnerability', { shouldDirty: true });
        });
    });

    describe('datalist', () => {
        it('renders datalist with standard threats', () => {
            const { container } = render(<RiskFormIdentificationTab {...defaultProps} />);

            const datalist = container.querySelector('datalist#threatsList');
            expect(datalist).toBeInTheDocument();
        });

        it('contains threat options', () => {
            const { container } = render(<RiskFormIdentificationTab {...defaultProps} />);

            const options = container.querySelectorAll('datalist#threatsList option');
            expect(options.length).toBe(4);
        });
    });

    describe('validation errors', () => {
        it('displays threat error when present', () => {
            const propsWithError: RiskFormIdentificationTabProps = {
                ...defaultProps,
                errors: { threat: { message: 'La menace est requise', type: 'required' } }
            };

            render(<RiskFormIdentificationTab {...propsWithError} />);

            expect(screen.getByText('La menace est requise')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-panel container', () => {
            const { container } = render(<RiskFormIdentificationTab {...defaultProps} />);

            expect(container.querySelector('.glass-panel')).toBeInTheDocument();
        });
    });
});
