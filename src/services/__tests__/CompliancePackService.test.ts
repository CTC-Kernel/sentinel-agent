/**
 * CompliancePackService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompliancePackService } from '../CompliancePackService';
import { Risk, Control, Document as GRCDocument, Audit, Incident, Asset } from '../../types';
import { Criticality } from '../../types/common';
import { RiskStatus, TreatmentStatus } from '../../types/risks';
import { IncidentStatus } from '../../types/incidents';
import { ControlStatus } from '../../types/controls';

// Mock JSZip
const mockZipFile = vi.fn();
const mockGenerateAsync = vi.fn();

interface MockFolder {
    file: typeof mockZipFile;
    folder: () => MockFolder;
}

const createMockFolder = (): MockFolder => ({
    file: mockZipFile,
    folder: () => createMockFolder()
});

const mockZipFolder = vi.fn(() => createMockFolder());

vi.mock('jszip', () => {
    return {
        default: class MockJSZip {
            folder = mockZipFolder;
            generateAsync = mockGenerateAsync;
        }
    };
});

// Mock file-saver
const mockSaveAs = vi.fn();
vi.mock('file-saver', () => ({
    saveAs: (...args: unknown[]) => mockSaveAs(...args)
}));

// Mock DOMPurify
vi.mock('dompurify', () => ({
    default: {
        sanitize: vi.fn((html: string) => html.replace(/<[^>]+>/g, ''))
    }
}));

// Mock PdfService
// Mock PdfService
vi.mock('../PdfService', () => ({
    PdfService: {
        generateExecutiveReport: vi.fn().mockReturnValue({
            output: () => new Blob(['pdf content'])
        }),
        generateTableReport: vi.fn().mockReturnValue({
            output: () => new Blob(['pdf content'])
        }),
        drawRiskMatrix: vi.fn(),
        drawDonutChart: vi.fn(),
        addSafeText: vi.fn()
    }
}));

// Mock ReportEnrichmentService
vi.mock('../ReportEnrichmentService', () => ({
    ReportEnrichmentService: {
        calculateMetrics: vi.fn().mockReturnValue({
            total_risks: 10,
            critical_risks: 2,
            high_risks: 3,
            medium_risks: 3,
            low_risks: 2,
            risk_score: 45,
            treated_percentage: 60
        }),
        generateExecutiveSummary: vi.fn().mockReturnValue('Executive Summary'),
        analyzeRiskPortfolio: vi.fn().mockReturnValue({
            distribution: { critical: 2, high: 3, medium: 3, low: 2 },
            top_risks: [],
            trends: { new_risks_count: 1, trend_direction: 'stable' },
            recommendations: ['Recommendation 1']
        }),
        calculateComplianceMetrics: vi.fn().mockReturnValue({
            total_controls: 50,
            implemented_controls: 35,
            planned_controls: 10,
            not_applicable: 3,
            not_started: 2,
            compliance_coverage: 75,
            audit_readiness: 90
        }),
        generateComplianceExecutiveSummary: vi.fn().mockReturnValue('Compliance Summary')
    }
}));

// Helper to create mock data
const createMockRisk = (overrides: Partial<Risk> = {}): Risk => ({
    id: 'risk-123',
    name: 'Test Risk',
    assetId: 'asset-123',
    threat: 'Data Breach',
    vulnerability: 'Weak Password',
    probability: 3,
    impact: 4,
    score: 12,
    residualScore: 6,
    strategy: 'Atténuer',
    category: 'Opérationnel',
    status: 'Ouvert' as RiskStatus,
    treatmentDeadline: new Date('2024-12-31').toISOString(),
    treatment: {
        strategy: 'Atténuer',
        status: 'En cours' as TreatmentStatus,
        description: 'Treatment plan'
    },
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: 'John Doe',
    ...overrides
} as Risk);

const createMockControl = (overrides: Partial<Control> = {}): Control => ({
    id: 'control-123',
    reference: 'A.5.1', // Assuming reference matches code
    code: 'A.5.1',
    name: 'Test Control',
    description: 'Test description',
    status: 'Implémenté' as ControlStatus,
    applicability: 'Applicable',
    maturity: 4,
    type: 'Préventif', // Changed from category to type
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(), // Changed from updatedAt
    ...overrides
} as Control);

const createMockDocument = (overrides: Partial<GRCDocument> = {}): GRCDocument => ({
    id: 'doc-123',
    title: 'Security Policy',
    type: 'Policy',
    content: '<p>Policy content</p>',
    status: 'Publié',
    version: '1.0',
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
} as GRCDocument);

const createMockAudit = (overrides: Partial<Audit> = {}): Audit => ({
    id: 'audit-123',
    name: 'ISO 27001 Audit',
    dateScheduled: new Date('2024-06-15').toISOString(),
    auditor: 'John Smith',
    status: 'Completed',
    score: 85,
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
} as Audit);

const createMockIncident = (overrides: Partial<Incident> = {}): Incident => ({
    id: 'incident-123',
    title: 'Security Incident',
    description: 'Incident desc',
    severity: Criticality.HIGH,
    status: 'Nouveau' as IncidentStatus,
    dateReported: new Date('2024-03-15').toISOString(),
    impact: 'Majeur',
    organizationId: 'org-123',
    reporter: 'Jane Doe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
} as Incident);

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-123',
    name: 'Production Server',
    type: 'Server',
    confidentiality: 'Confidentiel', // Assuming 'Confidentiel' matches confidentiality type or string
    owner: 'IT Department',
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
} as Asset);

describe('CompliancePackService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateAsync.mockResolvedValue(new Blob(['zip content']));

        // Mock document.createElement for DOMPurify usage
        const mockElement = {
            innerHTML: '',
            textContent: 'Sanitized content'
        };
        vi.spyOn(document, 'createElement').mockReturnValue(mockElement as unknown as HTMLElement);
    });

    describe('safeFormatDate', () => {
        it('should return N/A for null or undefined', () => {
            expect(CompliancePackService.safeFormatDate(null)).toBe('N/A');
            expect(CompliancePackService.safeFormatDate(undefined)).toBe('N/A');
        });

        it('should format valid date string', () => {
            const result = CompliancePackService.safeFormatDate('2024-06-15T10:00:00.000Z');
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });

        it('should format Date object', () => {
            const result = CompliancePackService.safeFormatDate(new Date('2024-06-15'));
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });

        it('should handle Firestore Timestamp with toDate method', () => {
            const timestamp = {
                toDate: () => new Date('2024-06-15')
            };
            const result = CompliancePackService.safeFormatDate(timestamp);
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });

        it('should handle serialized Timestamp with seconds', () => {
            const timestamp = {
                seconds: new Date('2024-06-15').getTime() / 1000
            };
            const result = CompliancePackService.safeFormatDate(timestamp);
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });

        it('should return "Date invalide" for invalid date', () => {
            const result = CompliancePackService.safeFormatDate('not-a-date');
            expect(result).toBe('Date invalide');
        });

        it('should handle number (timestamp in ms)', () => {
            const result = CompliancePackService.safeFormatDate(1718448000000);
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });
    });

    describe('generatePack', () => {
        const mockData = {
            organizationName: 'Test Organization',
            risks: [createMockRisk()],
            controls: [createMockControl()],
            documents: [createMockDocument()],
            audits: [createMockAudit()],
            incidents: [createMockIncident()],
            assets: [createMockAsset()]
        };

        it('should create a ZIP file with the correct structure', async () => {
            await CompliancePackService.generatePack(mockData);

            // Verify root folder was created
            expect(mockZipFolder).toHaveBeenCalledWith(expect.stringContaining('Conformité_'));
        });

        it('should create README file', async () => {
            await CompliancePackService.generatePack(mockData);

            expect(mockZipFile).toHaveBeenCalledWith(
                '00_LISEZ_MOI.txt',
                expect.stringContaining('PACK DE CONFORMITÉ')
            );
        });

        it('should include organization name in README', async () => {
            await CompliancePackService.generatePack(mockData);

            expect(mockZipFile).toHaveBeenCalledWith(
                '00_LISEZ_MOI.txt',
                expect.stringContaining('Test Organization')
            );
        });

        it('should call saveAs with proper filename', async () => {
            await CompliancePackService.generatePack(mockData);

            expect(mockSaveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.stringMatching(/Compliance_Pack_Test_Organization_\d{4}-\d{2}-\d{2}\.zip/)
            );
        });

        it('should sanitize organization name for filename', async () => {
            const dataWithSpecialChars = {
                ...mockData,
                organizationName: 'Test/Org:Name?'
            };

            await CompliancePackService.generatePack(dataWithSpecialChars);

            expect(mockSaveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.stringMatching(/Compliance_Pack_Test_Org_Name__/)
            );
        });

        it('should use default organization name if not provided', async () => {
            const dataWithoutOrgName = {
                ...mockData,
                organizationName: ''
            };

            await CompliancePackService.generatePack(dataWithoutOrgName);

            expect(mockSaveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                expect.stringContaining('Organization')
            );
        });

        it('should throw error if root folder creation fails', async () => {
            mockZipFolder.mockReturnValueOnce(null as any);

            await expect(CompliancePackService.generatePack(mockData)).rejects.toThrow(
                'Failed to create root folder in ZIP'
            );
        });

        it('should throw error if ZIP generation fails', async () => {
            mockGenerateAsync.mockRejectedValueOnce(new Error('ZIP generation error'));

            await expect(CompliancePackService.generatePack(mockData)).rejects.toThrow(
                'Failed to create ZIP file'
            );
        });

        it('should handle empty risks array', async () => {
            const dataWithEmptyRisks = {
                ...mockData,
                risks: []
            };

            await CompliancePackService.generatePack(dataWithEmptyRisks);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle empty controls array', async () => {
            const dataWithEmptyControls = {
                ...mockData,
                controls: []
            };

            await CompliancePackService.generatePack(dataWithEmptyControls);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle empty documents array', async () => {
            const dataWithEmptyDocs = {
                ...mockData,
                documents: []
            };

            await CompliancePackService.generatePack(dataWithEmptyDocs);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle documents without content', async () => {
            const dataWithEmptyContent = {
                ...mockData,
                documents: [createMockDocument({ content: undefined })]
            };

            await CompliancePackService.generatePack(dataWithEmptyContent);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle risks with missing optional fields', async () => {
            const riskWithMissing = createMockRisk({
                threat: undefined,
                assetId: undefined,
                score: undefined,
                strategy: undefined,
                residualScore: undefined,
                treatmentDeadline: undefined
            });

            const dataWithMissing = {
                ...mockData,
                risks: [riskWithMissing]
            };

            await CompliancePackService.generatePack(dataWithMissing);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle incidents with missing optional fields', async () => {
            const incidentWithMissing = createMockIncident({
                title: undefined,
                severity: undefined,
                status: undefined,
                dateReported: undefined,
                impact: undefined
            });

            const dataWithMissing = {
                ...mockData,
                incidents: [incidentWithMissing]
            };

            await CompliancePackService.generatePack(dataWithMissing);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle assets with missing optional fields', async () => {
            const assetWithMissing = createMockAsset({
                name: undefined,
                type: undefined,
                confidentiality: undefined,
                owner: undefined
            });

            const dataWithMissing = {
                ...mockData,
                assets: [assetWithMissing]
            };

            await CompliancePackService.generatePack(dataWithMissing);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle audits with missing optional fields', async () => {
            const auditWithMissing = createMockAudit({
                name: undefined,
                dateScheduled: undefined,
                auditor: undefined,
                status: undefined,
                score: undefined
            });

            const dataWithMissing = {
                ...mockData,
                audits: [auditWithMissing]
            };

            await CompliancePackService.generatePack(dataWithMissing);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle controls with missing optional fields', async () => {
            const controlWithMissing = createMockControl({
                code: undefined,
                name: undefined,
                applicability: undefined,
                maturity: undefined
            });

            const dataWithMissing = {
                ...mockData,
                controls: [controlWithMissing]
            };

            await CompliancePackService.generatePack(dataWithMissing);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should handle documents with missing optional fields', async () => {
            const docWithMissing = createMockDocument({
                title: undefined,
                type: undefined,
                version: undefined,
                status: undefined,
                updatedAt: undefined
            });

            const dataWithMissing = {
                ...mockData,
                documents: [docWithMissing]
            };

            await CompliancePackService.generatePack(dataWithMissing);

            expect(mockSaveAs).toHaveBeenCalled();
        });

        it('should call PdfService for risk management report', async () => {
            const { PdfService } = await import('../PdfService');

            await CompliancePackService.generatePack(mockData);

            expect(PdfService.generateExecutiveReport).toHaveBeenCalled();
        });

        it('should call PdfService for table reports', async () => {
            const { PdfService } = await import('../PdfService');

            await CompliancePackService.generatePack(mockData);

            expect(PdfService.generateTableReport).toHaveBeenCalled();
        });

        it('should call ReportEnrichmentService for metrics', async () => {
            const { ReportEnrichmentService } = await import('../ReportEnrichmentService');

            await CompliancePackService.generatePack(mockData);

            expect(ReportEnrichmentService.calculateMetrics).toHaveBeenCalledWith(mockData.risks);
        });

        it('should call ReportEnrichmentService for risk analysis', async () => {
            const { ReportEnrichmentService } = await import('../ReportEnrichmentService');

            await CompliancePackService.generatePack(mockData);

            expect(ReportEnrichmentService.analyzeRiskPortfolio).toHaveBeenCalledWith(mockData.risks);
        });

        it('should call ReportEnrichmentService for compliance metrics', async () => {
            const { ReportEnrichmentService } = await import('../ReportEnrichmentService');

            await CompliancePackService.generatePack(mockData);

            expect(ReportEnrichmentService.calculateComplianceMetrics).toHaveBeenCalledWith(mockData.controls);
        });

        it('should generate executive summary for risks', async () => {
            const { ReportEnrichmentService } = await import('../ReportEnrichmentService');

            await CompliancePackService.generatePack(mockData);

            expect(ReportEnrichmentService.generateExecutiveSummary).toHaveBeenCalled();
        });

        it('should generate executive summary for compliance', async () => {
            const { ReportEnrichmentService } = await import('../ReportEnrichmentService');

            await CompliancePackService.generatePack(mockData);

            expect(ReportEnrichmentService.generateComplianceExecutiveSummary).toHaveBeenCalled();
        });
    });
});
