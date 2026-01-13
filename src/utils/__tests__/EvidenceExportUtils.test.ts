/**
 * EvidenceExportUtils Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock date-fns
vi.mock('date-fns', () => ({
    format: vi.fn().mockReturnValue('20240615')
}));

// Mock jszip - needs to be a proper async import mock
const mockFile = vi.fn();
const mockFolder = vi.fn().mockReturnValue({ file: mockFile });
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['test']));

vi.mock('jszip', () => ({
    default: vi.fn().mockImplementation(() => ({
        folder: mockFolder,
        generateAsync: mockGenerateAsync
    }))
}));

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:test-url');
URL.revokeObjectURL = vi.fn();

import { exportEvidenceRequestsZip } from '../EvidenceExportUtils';
import { EvidenceRequest, UserProfile, Control, Document } from '../../types';

describe('exportEvidenceRequestsZip', () => {
    const mockOnSuccess = vi.fn();
    const mockOnError = vi.fn();

    const mockRequests: EvidenceRequest[] = [
        {
            id: 'req-1',
            auditId: 'audit-123',
            title: 'Evidence Request 1',
            description: 'Test description',
            status: 'pending',
            assignedTo: 'user-1',
            dueDate: '2024-06-30',
            relatedControlId: 'ctrl-1',
            documentIds: ['doc-1'],
            createdAt: '2024-06-01',
            createdBy: 'admin'
        }
    ];

    const mockUsers: UserProfile[] = [
        {
            uid: 'user-1',
            email: 'user@example.com',
            displayName: 'Test User',
            role: 'user',
            organizationId: 'org-123'
        }
    ];

    const mockControls: Control[] = [
        {
            id: 'ctrl-1',
            code: 'CTL-001',
            title: 'Test Control',
            domain: 'Security',
            status: 'implemented',
            organizationId: 'org-123',
            frameworkId: 'fw-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01'
        }
    ];

    const mockDocuments: Document[] = [
        {
            id: 'doc-1',
            title: 'Test Document',
            type: 'policy',
            url: 'https://example.com/doc.pdf',
            organizationId: 'org-123',
            createdAt: '2024-01-01',
            createdBy: 'admin'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock document methods
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn(),
            style: {}
        } as unknown as HTMLAnchorElement);
        vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
        vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
    });

    it('should create a zip file with audit data', async () => {
        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: mockRequests,
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        expect(mockFolder).toHaveBeenCalledWith('Preuves_Audit_audit-123');
        expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
        expect(mockOnSuccess).toHaveBeenCalledWith('Export ZIP téléchargé');
    });

    it('should generate CSV with request data', async () => {
        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: mockRequests,
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        // Check that file was called for CSV
        expect(mockFile).toHaveBeenCalled();
        const csvCall = mockFile.mock.calls.find((call: unknown[]) =>
            call[0] === 'rapport_demandes.csv'
        );
        expect(csvCall).toBeDefined();
    });

    it('should create links file when documents exist', async () => {
        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: mockRequests,
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        const linksCall = mockFile.mock.calls.find((call: unknown[]) =>
            call[0] === 'liens_documents.txt'
        );
        expect(linksCall).toBeDefined();
    });

    it('should trigger download after zip creation', async () => {
        const mockClick = vi.fn();
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: mockClick,
            style: {}
        } as unknown as HTMLAnchorElement);

        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: mockRequests,
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        expect(mockClick).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should handle errors and call onError', async () => {
        mockGenerateAsync.mockRejectedValueOnce(new Error('Zip error'));

        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: mockRequests,
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        expect(mockOnError).toHaveBeenCalled();
    });

    it('should handle empty requests', async () => {
        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: [],
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle missing user for assigned request', async () => {
        const requestsWithUnknownUser: EvidenceRequest[] = [
            {
                ...mockRequests[0],
                assignedTo: 'unknown-user'
            }
        ];

        await exportEvidenceRequestsZip({
            auditId: 'audit-123',
            requests: requestsWithUnknownUser,
            users: mockUsers,
            controls: mockControls,
            documents: mockDocuments,
            onSuccess: mockOnSuccess,
            onError: mockOnError
        });

        expect(mockOnSuccess).toHaveBeenCalled();
    });
});
