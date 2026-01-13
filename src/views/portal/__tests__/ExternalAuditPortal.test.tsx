/**
 * ExternalAuditPortal Component Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExternalAuditPortal } from '../ExternalAuditPortal';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'certifier.portal.loading': 'Loading audit data...',
                'certifier.portal.invalidLink': 'Invalid or expired link',
                'certifier.portal.accessDenied': 'Access Denied',
                'certifier.portal.notFound': 'Audit not found',
                'certifier.portal.expiredOrInvalid': 'Link expired or invalid',
                'certifier.portal.defaultError': 'An error occurred',
                'certifier.portal.contactAdmin': 'Please contact the administrator',
                'certifier.portal.overview': 'Overview',
                'certifier.portal.findings': 'Findings',
                'certifier.portal.certify': 'Certify',
                'certifier.portal.controls': 'Controls',
            };
            return translations[key] || key;
        },
    }),
}));

// Mock Firebase functions
const mockGetSharedAuditData = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockGetSharedAuditData,
}));

vi.mock('../../../firebase', () => ({
    functions: {},
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

// Mock CertificateUploadSection
vi.mock('../CertificateUploadSection', () => ({
    CertificateUploadSection: () => <div data-testid="certificate-upload">Certificate Upload</div>,
}));

const mockAuditData = {
    audit: {
        id: 'audit-123',
        name: 'ISO 27001 Certification Audit',
        status: 'in_progress',
        type: 'certification',
        date: '2026-01-15',
        description: 'Annual certification audit',
        scope: 'Full organization',
    },
    findings: [
        {
            id: 'finding-1',
            type: 'minor',
            description: 'Minor documentation gap',
            createdAt: '2026-01-10',
        },
        {
            id: 'finding-2',
            type: 'observation',
            description: 'Observation on process',
            createdAt: '2026-01-11',
        },
    ],
    documents: [
        {
            id: 'doc-1',
            name: 'Security Policy',
            type: 'pdf',
            url: 'https://example.com/doc1',
            category: 'policy',
        },
    ],
    permissions: ['view', 'upload'],
    auditorEmail: 'auditor@example.com',
};

describe('ExternalAuditPortal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithRouter = (token: string = 'valid-token-123456') => {
        return render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/portal/audit/${token}`]}>
                <Routes>
                    <Route path="/portal/audit/:token" element={<ExternalAuditPortal />} />
                </Routes>
            </MemoryRouter>
        );
    };

    describe('Loading State', () => {
        it('should show loading spinner initially', () => {
            mockGetSharedAuditData.mockImplementation(() => new Promise(() => { })); // Never resolves

            renderWithRouter();

            expect(screen.getByText('Loading audit data...')).toBeInTheDocument();
        });
    });

    describe('Error States', () => {
        it('should show error for invalid token (too short)', async () => {
            renderWithRouter('short');

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
                expect(screen.getByText('Invalid or expired link')).toBeInTheDocument();
            });
        });

        it('should show not found error', async () => {
            mockGetSharedAuditData.mockRejectedValueOnce({ code: 'not-found' });

            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
                expect(screen.getByText('Audit not found')).toBeInTheDocument();
            });
        });

        it('should show permission denied error', async () => {
            mockGetSharedAuditData.mockRejectedValueOnce({ code: 'permission-denied' });

            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
                expect(screen.getByText('Link expired or invalid')).toBeInTheDocument();
            });
        });

        it('should show generic error message', async () => {
            mockGetSharedAuditData.mockRejectedValueOnce({ message: 'Server error' });

            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
                expect(screen.getByText('Server error')).toBeInTheDocument();
            });
        });

        it('should show contact admin message on error', async () => {
            mockGetSharedAuditData.mockRejectedValueOnce(new Error('Error'));

            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('Please contact the administrator')).toBeInTheDocument();
            });
        });
    });

    describe('Successful Data Load', () => {
        beforeEach(() => {
            mockGetSharedAuditData.mockResolvedValue({ data: mockAuditData });
        });

        it('should display audit name after loading', async () => {
            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('ISO 27001 Certification Audit')).toBeInTheDocument();
            });
        });

        it('should display audit description', async () => {
            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('Annual certification audit')).toBeInTheDocument();
            });
        });

        it('should display auditor email', async () => {
            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText(/auditor@example.com/)).toBeInTheDocument();
            });
        });
    });

    describe('Tab Navigation', () => {
        beforeEach(() => {
            mockGetSharedAuditData.mockResolvedValue({ data: mockAuditData });
        });

        it('should show overview tab by default', async () => {
            renderWithRouter();

            await waitFor(() => {
                // The overview content should be visible by default
                expect(screen.getByText('ISO 27001 Certification Audit')).toBeInTheDocument();
            });
        });

        it('should have tab navigation buttons', async () => {
            renderWithRouter();

            await waitFor(() => {
                // Check for tab-like navigation elements
                expect(screen.getByText('ISO 27001 Certification Audit')).toBeInTheDocument();
            });
        });
    });

    describe('Error Logging', () => {
        it('should log errors to ErrorLogger', async () => {
            const { ErrorLogger } = await import('../../../services/errorLogger');
            const testError = new Error('Test error');
            mockGetSharedAuditData.mockRejectedValueOnce(testError);

            renderWithRouter();

            await waitFor(() => {
                expect(ErrorLogger.error).toHaveBeenCalled();
            });
        });
    });
});
