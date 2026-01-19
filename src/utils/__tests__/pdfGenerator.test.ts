/**
 * Unit tests for pdfGenerator.ts
 * Tests PDF generation for continuity reports
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContinuityReport } from '../pdfGenerator';
import { BusinessProcess, BcpDrill } from '../../types';

// Mock PdfService
const mockGenerateExecutiveReport = vi.fn();
const mockDrawDonutChart = vi.fn();

vi.mock('../../services/PdfService', () => ({
    PdfService: {
        generateExecutiveReport: (...args: unknown[]) => mockGenerateExecutiveReport(...args),
        drawDonutChart: (...args: unknown[]) => mockDrawDonutChart(...args)
    }
}));

describe('generateContinuityReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createProcess = (overrides: Partial<BusinessProcess> = {}): BusinessProcess => ({
        id: 'proc-1',
        name: 'Critical Process',
        description: 'Description',
        priority: 'Moyenne',
        rto: '4h',
        rpo: '1h',
        owner: 'John Doe',
        organizationId: 'org-1',
        supportingAssetIds: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides
    });

    const createDrill = (overrides: Partial<BcpDrill> = {}): BcpDrill => ({
        id: 'drill-1',
        processId: 'proc-1',
        type: 'Tabletop',
        date: '2024-01-15',
        result: 'Succès',
        notes: 'Test drill notes',
        organizationId: 'org-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        ...overrides
    });

    it('generates report with processes and drills', async () => {
        const processes = [
            createProcess({ priority: 'Critique' }),
            createProcess({ id: 'proc-2', name: 'Secondary Process', priority: 'Moyenne' })
        ];
        const drills = [
            createDrill({ result: 'Succès' }),
            createDrill({ id: 'drill-2', result: 'Échec' })
        ];

        await generateContinuityReport(processes, drills);

        expect(mockGenerateExecutiveReport).toHaveBeenCalledTimes(1);
    });

    it('calculates correct metrics', async () => {
        const processes = [
            createProcess({ priority: 'Critique', rto: '4h', rpo: '1h' }),
            createProcess({ id: 'proc-2', priority: 'Critique', rto: '2h', rpo: '30min' }),
            createProcess({ id: 'proc-3', priority: 'Élevée', rto: undefined, rpo: undefined })
        ];
        const drills = [
            createDrill({ result: 'Succès' }),
            createDrill({ id: 'drill-2', result: 'Succès' }),
            createDrill({ id: 'drill-3', result: 'Échec' })
        ];

        await generateContinuityReport(processes, drills);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];

        // Check metrics
        expect(reportConfig.metrics).toEqual([
            { label: 'Processus', value: 3, subtext: 'Périmètre total' },
            { label: 'Critiques', value: 2, subtext: 'Priorité absolue' },
            { label: 'Succès Tests', value: '67%', subtext: 'Validation Plan' }
        ]);
    });

    it('handles empty processes array', async () => {
        await generateContinuityReport([], []);

        expect(mockGenerateExecutiveReport).toHaveBeenCalledTimes(1);
        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];

        expect(reportConfig.metrics[0].value).toBe(0); // Total processes
        expect(reportConfig.metrics[1].value).toBe(0); // Critical processes
    });

    it('handles empty drills array with 0% success rate', async () => {
        const processes = [createProcess()];

        await generateContinuityReport(processes, []);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];
        expect(reportConfig.metrics[2].value).toBe('0%'); // Success rate
    });

    it('calculates 100% success rate when all drills succeed', async () => {
        const processes = [createProcess()];
        const drills = [
            createDrill({ result: 'Succès' }),
            createDrill({ id: 'drill-2', result: 'Succès' })
        ];

        await generateContinuityReport(processes, drills);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];
        expect(reportConfig.metrics[2].value).toBe('100%');
    });

    it('includes correct report title and filename', async () => {
        await generateContinuityReport([], []);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];

        expect(reportConfig.title).toBe("Rapport de Continuité d'Activité (BCP)");
        expect(reportConfig.subtitle).toBe("Analyse d'Impact Métier (BIA) et Résilience");
        expect(reportConfig.filename).toBe("rapport_continuite_activite.pdf");
        expect(reportConfig.orientation).toBe('portrait');
    });

    it('counts protected processes with RTO and RPO', async () => {
        const processes = [
            createProcess({ rto: '4h', rpo: '1h' }),           // Protected
            createProcess({ id: 'proc-2', rto: '2h', rpo: undefined }),  // Not protected
            createProcess({ id: 'proc-3', rto: undefined, rpo: '1h' }),  // Not protected
            createProcess({ id: 'proc-4', rto: '1h', rpo: '30min' })     // Protected
        ];

        await generateContinuityReport(processes, []);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];

        // Summary should mention 2 protected processes
        expect(reportConfig.summary).toContain('2 processus disposent de stratégies de continuité');
    });

    it('provides correct stats distribution', async () => {
        const processes = [
            createProcess({ priority: 'Critique' }),
            createProcess({ id: 'proc-2', priority: 'Critique' }),
            createProcess({ id: 'proc-3', priority: 'Élevée' }),
            createProcess({ id: 'proc-4', priority: 'Moyenne' }),
            createProcess({ id: 'proc-5', priority: 'Faible' })
        ];

        await generateContinuityReport(processes, []);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];

        expect(reportConfig.stats).toEqual([
            { label: 'Critique', value: 2, color: '#EF4444' },
            { label: 'Majeur', value: 1, color: '#F97316' },
            { label: 'Standard', value: 2, color: '#3B82F6' }
        ]);
    });

    it('generates optimized preparation status when success rate > 80%', async () => {
        const processes = [createProcess()];
        const drills = [
            createDrill({ result: 'Succès' }),
            createDrill({ id: 'drill-2', result: 'Succès' }),
            createDrill({ id: 'drill-3', result: 'Succès' }),
            createDrill({ id: 'drill-4', result: 'Succès' }),
            createDrill({ id: 'drill-5', result: 'Échec' })  // 80% success
        ];

        await generateContinuityReport(processes, drills);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];
        expect(reportConfig.summary).toContain('En développement');
    });

    it('generates developing status when success rate > 80%', async () => {
        const processes = [createProcess()];
        const drills = [
            createDrill({ result: 'Succès' }),
            createDrill({ id: 'drill-2', result: 'Succès' }),
            createDrill({ id: 'drill-3', result: 'Succès' }),
            createDrill({ id: 'drill-4', result: 'Succès' }),
            createDrill({ id: 'drill-5', result: 'Succès' })  // 100% > 80%
        ];

        await generateContinuityReport(processes, drills);

        const reportConfig = mockGenerateExecutiveReport.mock.calls[0][0];
        expect(reportConfig.summary).toContain('Optimisé');
    });

    it('passes content callback function', async () => {
        await generateContinuityReport([createProcess()], [createDrill()]);

        expect(mockGenerateExecutiveReport).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Function)
        );
    });
});
