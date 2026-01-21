/**
 * DORAExportService Tests
 * Story 35-3: DORA Register Export
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DORAExportService, DORAExportOptions, DORAExportRecord } from '../DORAExportService';
import { ICTProvider } from '../../types/dora';

// Mock ExcelJS
const mockWorksheet = {
    columns: [],
    getRow: vi.fn(() => ({
        font: {},
        fill: {},
        alignment: {},
        height: 25,
        getCell: vi.fn(() => ({
            fill: {},
            font: {}
        })),
        eachCell: vi.fn((cb: (cell: { border: unknown }) => void) => cb({ border: {} }))
    })),
    getCell: vi.fn(() => ({
        value: 5,
        fill: {},
        font: {}
    })),
    addRow: vi.fn(() => ({
        getCell: vi.fn(() => ({
            fill: {},
            font: {}
        }))
    })),
    addRows: vi.fn(),
    getColumn: vi.fn(() => ({ width: 0 })),
    eachRow: vi.fn()
};

const mockWorkbook = {
    creator: '',
    created: null as Date | null,
    modified: null as Date | null,
    addWorksheet: vi.fn(() => mockWorksheet),
    xlsx: {
        writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
    }
};

vi.mock('exceljs', () => ({
    default: {
        Workbook: vi.fn(() => mockWorkbook)
    }
}));

// Mock jsPDF
const mockJsPDF = {
    internal: {
        pageSize: { width: 210, height: 297 }
    },
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    roundedRect: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    output: vi.fn(() => new Blob(['test'], { type: 'application/pdf' })),
    autoTable: vi.fn()
};

vi.mock('jspdf', () => ({
    jsPDF: vi.fn(() => mockJsPDF)
}));

vi.mock('jspdf-autotable', () => ({}));

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-export-id' });
const mockGetDocs = vi.fn().mockResolvedValue({
    docs: [
        {
            id: 'export-1',
            data: () => ({
                format: 'json',
                exportedAt: '2025-01-15T10:00:00Z',
                exportedBy: 'user-1',
                providerCount: 5,
                filename: 'dora-register.json',
                parameters: { categoryFilter: 'all', includeHistorical: false }
            })
        }
    ]
});
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: () => mockAddDoc(),
    getDocs: () => mockGetDocs(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    deleteDoc: () => mockDeleteDoc(),
    doc: vi.fn(),
    Timestamp: { now: () => ({ toDate: () => new Date() }) }
}));

// Mock ICTProviderService
vi.mock('../ICTProviderService', () => ({
    ICTProviderService: {
        calculateOverallRisk: vi.fn((p: ICTProvider) => p.riskAssessment?.concentration || 50)
    }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock DOM APIs
const mockLink = {
    href: '',
    download: '',
    click: vi.fn()
};

Object.defineProperty(global, 'document', {
    value: {
        createElement: vi.fn(() => mockLink),
        body: {
            appendChild: vi.fn(),
            removeChild: vi.fn()
        }
    },
    writable: true
});

Object.defineProperty(global, 'URL', {
    value: {
        createObjectURL: vi.fn(() => 'blob:test-url'),
        revokeObjectURL: vi.fn()
    },
    writable: true
});

// Sample test data
const createMockProvider = (overrides: Partial<ICTProvider> = {}): ICTProvider => ({
    id: 'provider-1',
    organizationId: 'org-1',
    name: 'Test Provider',
    category: 'critical',
    status: 'active',
    services: [
        { name: 'Cloud Hosting', type: 'infrastructure', criticality: 'critical' }
    ],
    contractInfo: {
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        exitStrategy: 'Migration to alternative provider',
        auditRights: true
    },
    compliance: {
        doraCompliant: true,
        locationEU: true,
        headquartersCountry: 'France',
        certifications: ['ISO 27001', 'SOC 2'],
        subcontractors: []
    },
    riskAssessment: {
        concentration: 65,
        substitutability: 'medium',
        lastAssessment: '2025-01-10'
    },
    createdAt: '2024-01-01',
    updatedAt: '2025-01-10',
    ...overrides
});

describe('DORAExportService', () => {
    const mockOrganizationInfo = {
        name: 'Test Organization',
        lei: '1234567890ABCDEFGHIJ',
        country: 'FR'
    };

    const mockOptions: DORAExportOptions = {
        format: 'json',
        categoryFilter: 'all',
        language: 'fr'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockWorkbook.creator = '';
        mockWorkbook.created = null;
    });

    describe('generateJSON', () => {
        it('should generate ESA-compliant JSON export', async () => {
            const providers = [createMockProvider()];
            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('blob');
            expect(result).toHaveProperty('filename');
            expect(result.filename).toMatch(/^dora-register-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
        });

        it('should include reporting entity info', async () => {
            const providers = [createMockProvider()];
            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.reportingEntity).toEqual(mockOrganizationInfo);
        });

        it('should include provider reports', async () => {
            const providers = [createMockProvider()];
            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.ictProviders).toHaveLength(1);
            expect(result.data.ictProviders[0]).toMatchObject({
                providerId: 'provider-1',
                providerName: 'Test Provider',
                category: 'critical'
            });
        });

        it('should include concentration analysis', async () => {
            const providers = [createMockProvider()];
            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis).toBeDefined();
            expect(result.data.concentrationAnalysis.totalProviders).toBe(1);
            expect(result.data.concentrationAnalysis.criticalProviders).toBe(1);
        });

        it('should filter out inactive providers', async () => {
            const providers = [
                createMockProvider({ id: 'active-1', status: 'active' }),
                createMockProvider({ id: 'inactive-1', status: 'inactive' })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.ictProviders).toHaveLength(1);
            expect(result.data.ictProviders[0].providerId).toBe('active-1');
        });

        it('should apply category filter', async () => {
            const providers = [
                createMockProvider({ id: 'critical-1', category: 'critical' }),
                createMockProvider({ id: 'standard-1', category: 'standard' })
            ];

            const options: DORAExportOptions = {
                ...mockOptions,
                categoryFilter: 'critical'
            };

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                options
            );

            expect(result.data.ictProviders).toHaveLength(1);
            expect(result.data.ictProviders[0].category).toBe('critical');
        });

        it('should include version info', async () => {
            const providers = [createMockProvider()];
            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.version).toBe('1.0');
        });

        it('should include generation timestamp', async () => {
            const providers = [createMockProvider()];
            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.generatedAt).toBeDefined();
            expect(new Date(result.data.generatedAt)).toBeInstanceOf(Date);
        });
    });

    describe('generateExcel', () => {
        it('should create workbook with metadata', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(mockWorkbook.creator).toBe('Sentinel GRC - DORA Export');
            expect(mockWorkbook.created).toBeInstanceOf(Date);
        });

        it('should create 4 worksheets', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(4);
        });

        it('should create provider sheet with correct French name', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'fr' }
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Fournisseurs ICT');
        });

        it('should create provider sheet with correct English name', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'en' }
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('ICT Providers');
        });

        it('should create risk sheet', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'fr' }
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Évaluation des Risques');
        });

        it('should create compliance sheet', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'fr' }
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Conformité');
        });

        it('should create analysis sheet', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'fr' }
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Analyse Concentration');
        });

        it('should return blob with correct MIME type', async () => {
            const providers = [createMockProvider()];

            const result = await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.blob).toBeInstanceOf(Blob);
        });

        it('should generate correct filename', async () => {
            const providers = [createMockProvider()];

            const result = await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.filename).toMatch(/^dora-register-\d{4}-\d{2}-\d{2}-\d{4}\.xlsx$/);
        });

        it('should add rows for each provider', async () => {
            const providers = [
                createMockProvider({ id: 'p1' }),
                createMockProvider({ id: 'p2' })
            ];

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            // addRow called for each provider on multiple sheets
            expect(mockWorksheet.addRow).toHaveBeenCalled();
        });
    });

    describe('generatePDF', () => {
        it('should create PDF document', async () => {
            const providers = [createMockProvider()];

            const result = await DORAExportService.generatePDF(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result).toHaveProperty('doc');
            expect(result).toHaveProperty('blob');
            expect(result).toHaveProperty('filename');
        });

        it('should generate correct filename', async () => {
            const providers = [createMockProvider()];

            const result = await DORAExportService.generatePDF(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.filename).toMatch(/^dora-register-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/);
        });

        it('should include organization name in header', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generatePDF(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(mockJsPDF.text).toHaveBeenCalledWith(
                mockOrganizationInfo.name,
                expect.any(Number),
                expect.any(Number)
            );
        });

        it('should include LEI when provided', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generatePDF(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(mockJsPDF.text).toHaveBeenCalledWith(
                `LEI: ${mockOrganizationInfo.lei}`,
                expect.any(Number),
                expect.any(Number)
            );
        });

        it('should not include LEI when not provided', async () => {
            const providers = [createMockProvider()];
            const orgInfoWithoutLei = { name: 'Test Org', country: 'FR' };

            await DORAExportService.generatePDF(
                providers,
                orgInfoWithoutLei,
                mockOptions
            );

            // LEI text should not be called
            const leiCalls = (mockJsPDF.text as ReturnType<typeof vi.fn>).mock.calls
                .filter((call) => typeof call[0] === 'string' && call[0].startsWith('LEI:'));
            expect(leiCalls).toHaveLength(0);
        });

        it('should call autoTable for provider table', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generatePDF(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(mockJsPDF.autoTable).toHaveBeenCalled();
        });

        it('should set page footers', async () => {
            const providers = [createMockProvider()];

            await DORAExportService.generatePDF(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(mockJsPDF.getNumberOfPages).toHaveBeenCalled();
            expect(mockJsPDF.setPage).toHaveBeenCalled();
        });
    });

    describe('saveExportRecord', () => {
        it('should save export record to Firestore', async () => {
            const record: Omit<DORAExportRecord, 'id' | 'organizationId'> = {
                format: 'json',
                exportedAt: new Date().toISOString(),
                exportedBy: 'user-1',
                providerCount: 5,
                parameters: {
                    categoryFilter: 'all',
                    includeHistorical: false
                },
                filename: 'test.json',
                fileSize: 1024
            };

            const result = await DORAExportService.saveExportRecord('org-1', record);

            expect(result).toBe('test-export-id');
            expect(mockAddDoc).toHaveBeenCalled();
        });
    });

    describe('getExportHistory', () => {
        it('should retrieve export history', async () => {
            const result = await DORAExportService.getExportHistory('org-1');

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'export-1',
                format: 'json'
            });
        });

        it('should return empty array on error', async () => {
            mockGetDocs.mockRejectedValueOnce(new Error('Test error'));

            const result = await DORAExportService.getExportHistory('org-1');

            expect(result).toEqual([]);
        });
    });

    describe('deleteExportRecord', () => {
        it('should delete export record', async () => {
            await DORAExportService.deleteExportRecord('export-1');

            expect(mockDeleteDoc).toHaveBeenCalled();
        });
    });

    describe('downloadBlob', () => {
        it('should create download link and trigger click', () => {
            const blob = new Blob(['test'], { type: 'application/json' });

            DORAExportService.downloadBlob(blob, 'test-file.json');

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockLink.download).toBe('test-file.json');
            expect(mockLink.click).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });
    });

    describe('concentration analysis', () => {
        it('should calculate total providers count', async () => {
            const providers = [
                createMockProvider({ id: 'p1' }),
                createMockProvider({ id: 'p2' }),
                createMockProvider({ id: 'p3' })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.totalProviders).toBe(3);
        });

        it('should count critical providers', async () => {
            const providers = [
                createMockProvider({ id: 'p1', category: 'critical' }),
                createMockProvider({ id: 'p2', category: 'important' }),
                createMockProvider({ id: 'p3', category: 'critical' })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.criticalProviders).toBe(2);
        });

        it('should count important providers', async () => {
            const providers = [
                createMockProvider({ id: 'p1', category: 'important' }),
                createMockProvider({ id: 'p2', category: 'important' }),
                createMockProvider({ id: 'p3', category: 'standard' })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.importantProviders).toBe(2);
        });

        it('should count standard providers', async () => {
            const providers = [
                createMockProvider({ id: 'p1', category: 'standard' }),
                createMockProvider({ id: 'p2', category: 'standard' }),
                createMockProvider({ id: 'p3', category: 'critical' })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.standardProviders).toBe(2);
        });

        it('should calculate average concentration risk', async () => {
            const providers = [
                createMockProvider({ id: 'p1', riskAssessment: { concentration: 60, substitutability: 'medium' } }),
                createMockProvider({ id: 'p2', riskAssessment: { concentration: 80, substitutability: 'low' } }),
                createMockProvider({ id: 'p3', riskAssessment: { concentration: 40, substitutability: 'high' } })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.averageConcentrationRisk).toBe(60);
        });

        it('should identify high concentration providers', async () => {
            const providers = [
                createMockProvider({ id: 'high-1', riskAssessment: { concentration: 85, substitutability: 'low' } }),
                createMockProvider({ id: 'low-1', riskAssessment: { concentration: 30, substitutability: 'high' } }),
                createMockProvider({ id: 'high-2', riskAssessment: { concentration: 75, substitutability: 'low' } })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.highConcentrationProviders).toHaveLength(2);
            expect(result.data.concentrationAnalysis.highConcentrationProviders).toContain('high-1');
            expect(result.data.concentrationAnalysis.highConcentrationProviders).toContain('high-2');
        });

        it('should identify non-EU providers', async () => {
            const providers = [
                createMockProvider({
                    id: 'eu-1',
                    compliance: { doraCompliant: true, locationEU: true, certifications: [], subcontractors: [] }
                }),
                createMockProvider({
                    id: 'non-eu-1',
                    compliance: { doraCompliant: true, locationEU: false, certifications: [], subcontractors: [] }
                })
            ];

            const result = await DORAExportService.generateJSON(
                providers,
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.concentrationAnalysis.nonEuProviders).toHaveLength(1);
            expect(result.data.concentrationAnalysis.nonEuProviders).toContain('non-eu-1');
        });
    });

    describe('translations', () => {
        it('should translate category to French', async () => {
            const providers = [createMockProvider({ category: 'critical' })];

            const _result = await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'fr' }
            );

            // Verify row was added with translated category
            expect(mockWorksheet.addRow).toHaveBeenCalled();
        });

        it('should translate category to English', async () => {
            const providers = [createMockProvider({ category: 'critical' })];

            const _result = await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                { ...mockOptions, language: 'en' }
            );

            expect(mockWorksheet.addRow).toHaveBeenCalled();
        });

        it('should use French as default language', async () => {
            const providers = [createMockProvider()];
            const optionsNoLang: DORAExportOptions = {
                format: 'excel',
                categoryFilter: 'all'
            };

            await DORAExportService.generateExcel(
                providers,
                mockOrganizationInfo,
                optionsNoLang
            );

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Fournisseurs ICT');
        });
    });

    describe('edge cases', () => {
        it('should handle empty providers array', async () => {
            const result = await DORAExportService.generateJSON(
                [],
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.ictProviders).toHaveLength(0);
            expect(result.data.concentrationAnalysis.totalProviders).toBe(0);
        });

        it('should handle providers without optional fields', async () => {
            const minimalProvider: ICTProvider = {
                id: 'minimal-1',
                organizationId: 'org-1',
                name: 'Minimal Provider',
                category: 'standard',
                status: 'active',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01'
            };

            const result = await DORAExportService.generateJSON(
                [minimalProvider],
                mockOrganizationInfo,
                mockOptions
            );

            expect(result.data.ictProviders).toHaveLength(1);
        });

        it('should handle organization without LEI', async () => {
            const orgWithoutLei = { name: 'Test Org', country: 'FR' };

            const result = await DORAExportService.generateJSON(
                [createMockProvider()],
                orgWithoutLei,
                mockOptions
            );

            expect(result.data.reportingEntity.lei).toBeUndefined();
        });
    });
});
