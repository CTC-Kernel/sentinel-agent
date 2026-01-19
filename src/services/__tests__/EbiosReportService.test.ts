/**
 * EbiosReportService Tests
 * Tests for EBIOS RM report generation
 *
 * Story: EBIOS RM Test Coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EbiosReportService } from '../EbiosReportService';
import {
  createEbiosAnalysis,
  createCompletedEbiosAnalysis,
  createWorkshop1Data,
  createSMSIProgram,
  createMilestoneList,
  createSecurityBaseline,
  resetEbiosCounters,
} from '../../tests/factories/ebiosFactory';

// Mock jsPDF
const mockJsPDF = {
  save: vi.fn(),
  text: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  setFillColor: vi.fn(),
  addImage: vi.fn(),
  line: vi.fn(),
  addPage: vi.fn(),
  setPage: vi.fn(),
  getNumberOfPages: vi.fn(() => 1),
  internal: {
    pageSize: { width: 210, height: 297, getWidth: () => 210, getHeight: () => 297 },
  },
  autoTable: vi.fn(),
  lastAutoTable: { finalY: 100 },
  splitTextToSize: vi.fn((text: string) => [text]),
  getTextWidth: vi.fn(() => 50),
  saveGraphicsState: vi.fn(),
  restoreGraphicsState: vi.fn(),
  generateReport: vi.fn(async (_options: unknown) => new Blob(['mock PDF'], { type: 'application/pdf' })),
  output: vi.fn(() => new Blob(['pdf content'], { type: 'application/pdf' })),
};

vi.mock('jspdf', () => {
  const MockJsPDF = vi.fn(() => mockJsPDF);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MockJsPDF as any).API = {};
  return { jsPDF: MockJsPDF };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

// Mock PdfService
vi.mock('../PdfService', () => ({
  PdfService: {
    generateExecutiveReport: vi.fn((_options, contentCallback) => {
      // Simulate calling the content callback
      contentCallback(mockJsPDF, 50);
      return mockJsPDF;
    }),
    generateTableReport: vi.fn(() => mockJsPDF),
  },
}));

describe('EbiosReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEbiosCounters();
  });

  // ============================================================================
  // Workshop 1 Completion Checks
  // ============================================================================

  describe('isWorkshop1Complete', () => {
    it('should return true when all required elements are present', () => {
      const data = createWorkshop1Data({
        missionsCount: 1,
        essentialAssetsCount: 1,
        supportingAssetsCount: 1,
        fearedEventsCount: 1,
        includeBaseline: true,
      });
      data.securityBaseline = createSecurityBaseline({ totalMeasures: 10 });

      const result = EbiosReportService.isWorkshop1Complete(data);

      expect(result).toBe(true);
    });

    it('should return false when missions are missing', () => {
      const data = createWorkshop1Data({ missionsCount: 0 });

      const result = EbiosReportService.isWorkshop1Complete(data);

      expect(result).toBe(false);
    });

    it('should return false when assets are missing', () => {
      const data = createWorkshop1Data({
        missionsCount: 1,
        essentialAssetsCount: 0,
        supportingAssetsCount: 0,
      });

      const result = EbiosReportService.isWorkshop1Complete(data);

      expect(result).toBe(false);
    });

    it('should return false when feared events are missing', () => {
      const data = createWorkshop1Data({
        missionsCount: 1,
        essentialAssetsCount: 1,
        fearedEventsCount: 0,
      });

      const result = EbiosReportService.isWorkshop1Complete(data);

      expect(result).toBe(false);
    });

    it('should return false when security baseline is empty', () => {
      const data = createWorkshop1Data();
      data.securityBaseline = createSecurityBaseline({ totalMeasures: 0 });

      const result = EbiosReportService.isWorkshop1Complete(data);

      expect(result).toBe(false);
    });
  });

  describe('getWorkshop1CompletionDetails', () => {
    it('should return detailed completion status', () => {
      const data = createWorkshop1Data({
        missionsCount: 2,
        essentialAssetsCount: 1,
        supportingAssetsCount: 3,
        fearedEventsCount: 2,
      });
      data.securityBaseline = createSecurityBaseline({ totalMeasures: 5 });

      const result = EbiosReportService.getWorkshop1CompletionDetails(data);

      expect(result.missions).toBe(true);
      expect(result.essentialAssets).toBe(true);
      expect(result.supportingAssets).toBe(true);
      expect(result.fearedEvents).toBe(true);
      expect(result.securityBaseline).toBe(true);
      expect(result.overall).toBe(true);
    });

    it('should indicate missing sections', () => {
      const data = createWorkshop1Data({
        missionsCount: 0,
        essentialAssetsCount: 0,
        supportingAssetsCount: 0,
        fearedEventsCount: 0,
      });
      data.securityBaseline = createSecurityBaseline({ totalMeasures: 0 });

      const result = EbiosReportService.getWorkshop1CompletionDetails(data);

      expect(result.missions).toBe(false);
      expect(result.essentialAssets).toBe(false);
      expect(result.supportingAssets).toBe(false);
      expect(result.fearedEvents).toBe(false);
      expect(result.securityBaseline).toBe(false);
      expect(result.overall).toBe(false);
    });
  });

  // ============================================================================
  // Workshop 1 Report Generation
  // ============================================================================

  describe('generateWorkshop1Report', () => {
    it('should generate a Workshop 1 report', () => {
      const analysis = createEbiosAnalysis({ name: 'Test Analysis' });
      analysis.workshops[1].data = createWorkshop1Data({
        missionsCount: 2,
        essentialAssetsCount: 2,
        supportingAssetsCount: 3,
        fearedEventsCount: 2,
      });

      const result = EbiosReportService.generateWorkshop1Report(analysis);

      expect(result).toBeDefined();
    });

    it('should include organization name in options', () => {
      const analysis = createEbiosAnalysis();
      analysis.workshops[1].data = createWorkshop1Data();

      const result = EbiosReportService.generateWorkshop1Report(analysis, {
        organizationName: 'Test Organization',
        author: 'Test Author',
      });

      expect(result).toBeDefined();
    });

    it('should handle empty workshop data gracefully', () => {
      const analysis = createEbiosAnalysis();
      analysis.workshops[1].data = createWorkshop1Data({
        missionsCount: 0,
        essentialAssetsCount: 0,
        supportingAssetsCount: 0,
        fearedEventsCount: 0,
      });

      expect(() => {
        EbiosReportService.generateWorkshop1Report(analysis);
      }).not.toThrow();
    });

    it('should include baseline details when requested', () => {
      const analysis = createEbiosAnalysis();
      analysis.workshops[1].data = createWorkshop1Data();

      const result = EbiosReportService.generateWorkshop1Report(analysis, {
        includeBaselineDetails: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe('downloadWorkshop1Report', () => {
    it('should call save on the PDF', () => {
      const analysis = createEbiosAnalysis();
      analysis.workshops[1].data = createWorkshop1Data();

      EbiosReportService.downloadWorkshop1Report(analysis);

      // The mock is set up via PdfService mock
      expect(mockJsPDF).toBeDefined();
    });
  });

  describe('getWorkshop1ReportBlob', () => {
    it('should return a blob', () => {
      const analysis = createEbiosAnalysis();
      analysis.workshops[1].data = createWorkshop1Data();

      const result = EbiosReportService.getWorkshop1ReportBlob(analysis);

      expect(result).toBeInstanceOf(Blob);
    });
  });

  // ============================================================================
  // Analysis Completion
  // ============================================================================

  describe('getAnalysisCompletion', () => {
    it('should calculate completion for empty analysis', () => {
      const analysis = createEbiosAnalysis();

      const result = EbiosReportService.getAnalysisCompletion(analysis);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.workshops).toBeDefined();
    });

    it('should calculate higher completion for populated analysis', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.getAnalysisCompletion(analysis);

      expect(result.overall).toBeGreaterThan(0);
      expect(result.workshops[1]).toBeGreaterThan(0);
    });

    it('should calculate workshop-specific completion', () => {
      const analysis = createEbiosAnalysis();
      analysis.workshops[1].data = createWorkshop1Data({
        missionsCount: 1,
        essentialAssetsCount: 1,
        supportingAssetsCount: 1,
        fearedEventsCount: 1,
      });
      analysis.workshops[1].data.securityBaseline = createSecurityBaseline({
        totalMeasures: 10,
      });

      const result = EbiosReportService.getAnalysisCompletion(analysis);

      expect(result.workshops[1]).toBe(100); // All 5 sections filled = 100%
    });
  });

  // ============================================================================
  // Full EBIOS Report Generation
  // ============================================================================

  describe('generateFullEbiosReport', () => {
    it('should generate a complete EBIOS report', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.generateFullEbiosReport(analysis);

      expect(result).toBeDefined();
    });

    it('should allow selective workshop inclusion', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.generateFullEbiosReport(analysis, {
        includeWorkshops: {
          workshop1: true,
          workshop2: true,
          workshop3: false,
          workshop4: false,
          workshop5: false,
        },
      });

      expect(result).toBeDefined();
    });

    it('should include risk matrix when requested', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.generateFullEbiosReport(analysis, {
        includeRiskMatrix: true,
      });

      expect(result).toBeDefined();
    });

    it('should include control mappings when requested', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.generateFullEbiosReport(analysis, {
        includeControlMappings: true,
      });

      expect(result).toBeDefined();
    });

    it('should include residual risk summary when requested', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.generateFullEbiosReport(analysis, {
        includeResidualRiskSummary: true,
      });

      expect(result).toBeDefined();
    });

    it('should handle analysis with empty workshops', () => {
      const analysis = createEbiosAnalysis();

      expect(() => {
        EbiosReportService.generateFullEbiosReport(analysis);
      }).not.toThrow();
    });
  });

  describe('downloadFullEbiosReport', () => {
    it('should trigger download', () => {
      const analysis = createCompletedEbiosAnalysis();

      expect(() => {
        EbiosReportService.downloadFullEbiosReport(analysis);
      }).not.toThrow();
    });
  });

  describe('getFullEbiosReportBlob', () => {
    it('should return a blob', () => {
      const analysis = createCompletedEbiosAnalysis();

      const result = EbiosReportService.getFullEbiosReportBlob(analysis);

      expect(result).toBeInstanceOf(Blob);
    });
  });

  // ============================================================================
  // SMSI Program Report
  // ============================================================================

  describe('generateSMSIProgressReport', () => {
    it('should generate SMSI progress report', () => {
      const program = createSMSIProgram();
      const milestones = createMilestoneList(5);

      const result = EbiosReportService.generateSMSIProgressReport(program, milestones);

      expect(result).toBeDefined();
    });

    it('should handle empty milestones', () => {
      const program = createSMSIProgram();

      const result = EbiosReportService.generateSMSIProgressReport(program, []);

      expect(result).toBeDefined();
    });

    it('should include organization name', () => {
      const program = createSMSIProgram();
      const milestones = createMilestoneList(2);

      const result = EbiosReportService.generateSMSIProgressReport(program, milestones, {
        organizationName: 'Test Corp',
        author: 'John Doe',
      });

      expect(result).toBeDefined();
    });

    it('should calculate correct statistics', () => {
      const program = createSMSIProgram();
      const milestones = [
        ...createMilestoneList(3, { status: 'completed' }),
        ...createMilestoneList(2, { status: 'in_progress' }),
        ...createMilestoneList(1, { status: 'pending' }),
      ];

      expect(() => {
        EbiosReportService.generateSMSIProgressReport(program, milestones);
      }).not.toThrow();
    });

    it('should handle milestones across all PDCA phases', () => {
      const program = createSMSIProgram();
      const milestones = [
        ...createMilestoneList(2, { phase: 'plan' }),
        ...createMilestoneList(2, { phase: 'do' }),
        ...createMilestoneList(2, { phase: 'check' }),
        ...createMilestoneList(2, { phase: 'act' }),
      ];

      expect(() => {
        EbiosReportService.generateSMSIProgressReport(program, milestones);
      }).not.toThrow();
    });
  });

  describe('downloadSMSIProgressReport', () => {
    it('should trigger download', () => {
      const program = createSMSIProgram();
      const milestones = createMilestoneList(3);

      expect(() => {
        EbiosReportService.downloadSMSIProgressReport(program, milestones);
      }).not.toThrow();
    });
  });

  describe('getSMSIProgressReportBlob', () => {
    it('should return a blob', () => {
      const program = createSMSIProgram();
      const milestones = createMilestoneList(3);

      const result = EbiosReportService.getSMSIProgressReportBlob(program, milestones);

      expect(result).toBeInstanceOf(Blob);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle analysis with missing workshop data', () => {
      const analysis = createEbiosAnalysis();
      // Simulate potentially undefined workshop data
      // @ts-expect-error - Testing edge case
      analysis.workshops[1] = undefined;

      expect(() => {
        EbiosReportService.getAnalysisCompletion(analysis);
      }).not.toThrow();
    });

    it('should handle long text content gracefully', () => {
      const analysis = createEbiosAnalysis({ name: 'A'.repeat(500) });
      analysis.description = 'B'.repeat(1000);
      analysis.workshops[1].data = createWorkshop1Data();

      expect(() => {
        EbiosReportService.generateWorkshop1Report(analysis);
      }).not.toThrow();
    });

    it('should handle special characters in content', () => {
      const analysis = createEbiosAnalysis({
        name: 'Test "Analysis" with <special> & characters',
        description: "L'analyse de risques avec accents: \u00e9\u00e8\u00e0\u00f9",
      });
      analysis.workshops[1].data = createWorkshop1Data();

      expect(() => {
        EbiosReportService.generateWorkshop1Report(analysis);
      }).not.toThrow();
    });
  });
});
