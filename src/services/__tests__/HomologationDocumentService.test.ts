/**
 * HomologationDocumentService Unit Tests
 * Story 38-2: Homologation Document Generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase before importing the service
vi.mock('../../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: 'test-doc-id' })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: {
    fromDate: vi.fn(),
    now: vi.fn()
  }
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297
      }
    },
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setDrawColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    output: vi.fn(() => new Blob(['test'], { type: 'application/pdf' }))
  }))
}));

import {
  HomologationDocumentService,
  type DocumentGenerationContext,
  type GeneratedDocument
} from '../HomologationDocumentService';
import type { HomologationDossier } from '../../types/homologation';

// ============================================================================
// Test Data
// ============================================================================

const mockDossier: HomologationDossier = {
  id: 'dossier-1',
  organizationId: 'org-1',
  name: 'Test SI Homologation',
  description: 'Test system description',
  systemScope: 'Human Resources Information System',
  level: 'standard',
  levelJustification: 'System handles sensitive employee data',
  levelOverridden: false,
  determinationAnswers: [],
  recommendationScore: 65,
  status: 'in_progress',
  validityYears: 3,
  responsibleId: 'user-1',
  authorityName: 'Direction Générale',
  documents: [],
  renewalAlertDays: [90, 60, 30],
  createdAt: '2026-01-15T10:00:00Z',
  createdBy: 'user-1',
  updatedAt: '2026-01-15T10:00:00Z',
  updatedBy: 'user-1'
};

const mockContext: DocumentGenerationContext = {
  organization: {
    name: 'Test Organization',
    address: '123 Test Street',
    sector: 'Public Sector'
  },
  dossier: mockDossier,
  locale: 'fr'
};

const mockEbiosContext: DocumentGenerationContext = {
  ...mockContext,
  ebiosData: {
    fearedEvents: ['Data breach', 'Service unavailability'],
    riskSources: ['Cybercriminals', 'Malicious insiders'],
    strategicScenarios: ['Ransomware attack', 'Data exfiltration'],
    operationalScenarios: ['Phishing campaign', 'Credential theft'],
    treatmentPlan: ['Implement MFA', 'Deploy EDR'],
    residualRisks: ['Social engineering risk accepted']
  }
};

// ============================================================================
// Document Generation Tests
// ============================================================================

describe('HomologationDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDocumentContent', () => {
    it('should generate a strategy document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('strategie');
      expect(doc.title).toBe("Stratégie d'homologation");
      expect(doc.status).toBe('draft');
      expect(doc.version).toBe(1);
      expect(doc.sections).toBeDefined();
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('should generate a risk analysis document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('analyse_risques', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('analyse_risques');
      expect(doc.title).toBe('Analyse de risques');
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('should generate an action plan document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('plan_action', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('plan_action');
      expect(doc.title).toBe("Plan d'action");
    });

    it('should generate a decision document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('decision', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('decision');
      expect(doc.title).toBe("Décision d'homologation");
    });

    it('should generate an attestation document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('attestation', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('attestation');
      expect(doc.title).toBe("Attestation d'homologation");
    });

    it('should generate a penetration test document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('test_intrusion', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('test_intrusion');
      expect(doc.title).toBe("Rapport de tests d'intrusion");
    });

    it('should generate a technical audit document', () => {
      const doc = HomologationDocumentService.generateDocumentContent('audit_technique', mockContext);

      expect(doc).toBeDefined();
      expect(doc.type).toBe('audit_technique');
      expect(doc.title).toBe("Rapport d'audit technique");
    });

    it('should generate documents in English when locale is en', () => {
      const enContext = { ...mockContext, locale: 'en' as const };
      const doc = HomologationDocumentService.generateDocumentContent('strategie', enContext);

      expect(doc.title).toBe('Homologation Strategy');
    });

    it('should set correct timestamps', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      expect(doc.generatedAt).toBeDefined();
      expect(doc.updatedAt).toBeDefined();
      expect(doc.generatedAt).toBe(doc.updatedAt);
    });

    it('should have isModified set to false for all sections', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      doc.sections.forEach((section) => {
        expect(section.isModified).toBe(false);
      });
    });
  });

  describe('Placeholder replacement', () => {
    it('should replace organization placeholders', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      expect(doc.content).toContain('Test Organization');
    });

    it('should replace dossier placeholders', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      expect(doc.content).toContain('Test SI Homologation');
      expect(doc.content).toContain('Human Resources Information System');
    });

    it('should replace level placeholder', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      expect(doc.content).toContain('Standard');
    });

    it('should show placeholder message when no EBIOS data', () => {
      const doc = HomologationDocumentService.generateDocumentContent('analyse_risques', mockContext);

      expect(doc.content).toContain('Aucune analyse EBIOS liée');
    });

    it('should replace EBIOS placeholders when data is available', () => {
      const doc = HomologationDocumentService.generateDocumentContent(
        'analyse_risques',
        mockEbiosContext
      );

      expect(doc.content).toContain('Data breach');
      expect(doc.content).toContain('Cybercriminals');
    });

    it('should format EBIOS data as bullet lists', () => {
      const doc = HomologationDocumentService.generateDocumentContent(
        'analyse_risques',
        mockEbiosContext
      );

      expect(doc.content).toContain('- Data breach');
      expect(doc.content).toContain('- Service unavailability');
    });
  });

  describe('generateAllDocuments', () => {
    it('should generate all required documents for etoile level', () => {
      const context = {
        ...mockContext,
        dossier: { ...mockDossier, level: 'etoile' as const }
      };
      const docs = HomologationDocumentService.generateAllDocuments(context);

      expect(docs).toHaveLength(1);
      expect(docs[0].type).toBe('strategie');
    });

    it('should generate all required documents for simple level', () => {
      const context = {
        ...mockContext,
        dossier: { ...mockDossier, level: 'simple' as const }
      };
      const docs = HomologationDocumentService.generateAllDocuments(context);

      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.type)).toContain('strategie');
      expect(docs.map((d) => d.type)).toContain('analyse_risques');
    });

    it('should generate all required documents for standard level', () => {
      const context = {
        ...mockContext,
        dossier: { ...mockDossier, level: 'standard' as const }
      };
      const docs = HomologationDocumentService.generateAllDocuments(context);

      expect(docs).toHaveLength(5);
      expect(docs.map((d) => d.type)).toContain('strategie');
      expect(docs.map((d) => d.type)).toContain('analyse_risques');
      expect(docs.map((d) => d.type)).toContain('plan_action');
      expect(docs.map((d) => d.type)).toContain('decision');
      expect(docs.map((d) => d.type)).toContain('attestation');
    });

    it('should generate all required documents for renforce level', () => {
      const context = {
        ...mockContext,
        dossier: { ...mockDossier, level: 'renforce' as const }
      };
      const docs = HomologationDocumentService.generateAllDocuments(context);

      expect(docs).toHaveLength(7);
      expect(docs.map((d) => d.type)).toContain('test_intrusion');
      expect(docs.map((d) => d.type)).toContain('audit_technique');
    });
  });

  describe('exportToPDF', () => {
    it('should generate a PDF blob', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);
      const blob = HomologationDocumentService.exportToPDF(doc, mockContext);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle documents with multiple sections', () => {
      const doc = HomologationDocumentService.generateDocumentContent('analyse_risques', mockContext);
      const blob = HomologationDocumentService.exportToPDF(doc, mockContext);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle documents with EBIOS data', () => {
      const doc = HomologationDocumentService.generateDocumentContent(
        'analyse_risques',
        mockEbiosContext
      );
      const blob = HomologationDocumentService.exportToPDF(doc, mockEbiosContext);

      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('Document content structure', () => {
    it('should have consistent section structure', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      doc.sections.forEach((section) => {
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('content');
        expect(section).toHaveProperty('isModified');
        expect(typeof section.id).toBe('string');
        expect(typeof section.title).toBe('string');
        expect(typeof section.content).toBe('string');
        expect(typeof section.isModified).toBe('boolean');
      });
    });

    it('should have non-empty content in all sections', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      doc.sections.forEach((section) => {
        expect(section.content.length).toBeGreaterThan(0);
        expect(section.title.length).toBeGreaterThan(0);
      });
    });

    it('should combine sections into full content', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      // Full content should include content from all sections
      doc.sections.forEach((section) => {
        expect(doc.content).toContain(section.content.substring(0, 50));
      });
    });
  });

  describe('Document types', () => {
    const allTypes = [
      'strategie',
      'analyse_risques',
      'plan_action',
      'decision',
      'attestation',
      'test_intrusion',
      'audit_technique'
    ] as const;

    it.each(allTypes)('should generate %s document type correctly', (type) => {
      const doc = HomologationDocumentService.generateDocumentContent(type, mockContext);

      expect(doc.type).toBe(type);
      expect(doc.title).toBeDefined();
      expect(doc.content).toBeDefined();
      expect(doc.sections.length).toBeGreaterThan(0);
    });
  });

  describe('Locale handling', () => {
    it('should generate French content by default', () => {
      const doc = HomologationDocumentService.generateDocumentContent('strategie', mockContext);

      // French document should contain French text
      expect(doc.title).toBe("Stratégie d'homologation");
    });

    it('should generate English content when locale is en', () => {
      const enContext = { ...mockContext, locale: 'en' as const };
      const doc = HomologationDocumentService.generateDocumentContent('strategie', enContext);

      expect(doc.title).toBe('Homologation Strategy');
    });

    it('should use English section titles in English locale', () => {
      const enContext = { ...mockContext, locale: 'en' as const };
      const doc = HomologationDocumentService.generateDocumentContent('strategie', enContext);

      // Check that sections have English titles
      const hasEnglishTitles = doc.sections.some(
        (s) =>
          s.title.includes('Objective') ||
          s.title.includes('Scope') ||
          s.title.includes('Context')
      );
      expect(hasEnglishTitles).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing optional organization fields', () => {
      const minimalContext: DocumentGenerationContext = {
        organization: {
          name: 'Minimal Org'
        },
        dossier: mockDossier,
        locale: 'fr'
      };

      const doc = HomologationDocumentService.generateDocumentContent('strategie', minimalContext);

      expect(doc).toBeDefined();
      expect(doc.content).toContain('Minimal Org');
    });

    it('should handle missing dossier description', () => {
      const context = {
        ...mockContext,
        dossier: { ...mockDossier, description: undefined }
      };

      const doc = HomologationDocumentService.generateDocumentContent('strategie', context);

      expect(doc).toBeDefined();
    });

    it('should handle empty EBIOS arrays', () => {
      const emptyEbiosContext: DocumentGenerationContext = {
        ...mockContext,
        ebiosData: {
          fearedEvents: [],
          riskSources: [],
          strategicScenarios: [],
          operationalScenarios: [],
          treatmentPlan: [],
          residualRisks: []
        }
      };

      const doc = HomologationDocumentService.generateDocumentContent(
        'analyse_risques',
        emptyEbiosContext
      );

      expect(doc).toBeDefined();
      // Should contain fallback messages for empty arrays
      expect(doc.content).toContain('Aucun');
    });
  });
});
