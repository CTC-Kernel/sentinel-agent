/**
 * DataExportService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataExportService } from '../dataExportService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(() => Promise.resolve({
        docs: [
            {
                id: 'doc-1',
                data: () => ({ name: 'Test Item 1', organizationId: 'org-1' })
            },
            {
                id: 'doc-2',
                data: () => ({ name: 'Test Item 2', organizationId: 'org-1' })
            }
        ]
    }))
}));

// Mock file-saver
vi.mock('file-saver', () => ({
    saveAs: vi.fn()
}));

// Mock JSZip
vi.mock('jszip', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            file: vi.fn(),
            generateAsync: vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'application/zip' })))
        } as unknown as any)) // eslint-disable-line @typescript-eslint/no-explicit-any
    };
});

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('DataExportService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('exportOrganizationData', () => {
        it('should export organization data to ZIP', async () => {
            const { saveAs } = await import('file-saver');

            await DataExportService.exportOrganizationData('org-1');

            expect(saveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.stringContaining('sentinel_export_org-1')
            );
        });

        it('should include date in filename', async () => {
            const { saveAs } = await import('file-saver');
            const today = new Date().toISOString().split('T')[0];

            await DataExportService.exportOrganizationData('org-1');

            expect(saveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.stringContaining(today)
            );
        });

        it('should query all required collections', async () => {
            const { collection, query, where } = await import('firebase/firestore');

            await DataExportService.exportOrganizationData('org-1');

            // Should query 6 collections: assets, risks, controls, documents, audits, incidents
            expect(collection).toHaveBeenCalledTimes(6);
            expect(query).toHaveBeenCalledTimes(6);
            expect(where).toHaveBeenCalledTimes(6);
        });

        it('should create ZIP with collection files', async () => {
            const JSZip = (await import('jszip')).default;

            await DataExportService.exportOrganizationData('org-1');

            const mockZipInstance = vi.mocked(JSZip).mock.results[0]?.value;
            expect(mockZipInstance.file).toHaveBeenCalled();
            expect(mockZipInstance.generateAsync).toHaveBeenCalledWith({ type: 'blob' });
        });

        it('should throw on Firestore error', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(DataExportService.exportOrganizationData('org-1')).rejects.toThrow();
        });

        it('should log errors', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));
            const { ErrorLogger } = await import('../errorLogger');

            try {
                await DataExportService.exportOrganizationData('org-1');
            } catch {
                // Expected
            }

            expect(ErrorLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'DataExportService.exportOrganizationData'
            );
        });

        it('should throw on ZIP generation error', async () => {
            const JSZip = (await import('jszip')).default;
            vi.mocked(JSZip).mockImplementationOnce(() => ({
                file: vi.fn(),
                generateAsync: vi.fn().mockRejectedValueOnce(new Error('ZIP error'))
            } as unknown as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

            await expect(DataExportService.exportOrganizationData('org-1')).rejects.toThrow();
        });
    });
});
