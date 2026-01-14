/**
 * ReportEnrichmentService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import {
    ReportEnrichmentService,
    ReportMetrics,
    AuditMetrics,
    ProjectMetrics,
    ComplianceMetrics
} from '../ReportEnrichmentService';
import { Risk, Project, Control } from '../../types';

// Helper to create mock risks
const createMockRisk = (overrides: Partial<Risk> = {}): Risk => ({
    id: `risk-${Math.random().toString(36).substr(2, 9)}`,
    threat: 'Test Risk',
    assetId: 'asset-123',
    vulnerability: 'vuln-1',
    probability: 3,
    impact: 3,
    score: 9,
    category: 'Opérationnel',
    strategy: 'Atténuer',
    status: 'Ouvert',
    owner: 'owner-123',
    treatment: {
        strategy: 'Atténuer',
        status: 'Planifié'
    },
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
});

// Helper to create mock project
const createMockProject = (overrides: Partial<Project> = {}): Project => ({
    id: 'project-123',
    name: 'Test Project',
    description: 'Test description',
    status: 'En cours',
    priority: 'Haute',
    progress: 50,
    startDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    tasks: [],
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
} as Project);

// Helper to create mock control
const createMockControl = (overrides: Partial<Control> = {}): Control => ({
    id: 'control-123',
    reference: 'A.5.1',
    name: 'Test Control',
    description: 'Test description',
    status: 'Implémenté',
    category: 'Organisationnel',
    organizationId: 'org-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
} as Control);

describe('ReportEnrichmentService', () => {
    describe('calculateMetrics', () => {
        it('should return zero metrics for empty array', () => {
            const result = ReportEnrichmentService.calculateMetrics([]);

            expect(result).toEqual({
                total_risks: 0,
                critical_risks: 0,
                high_risks: 0,
                medium_risks: 0,
                low_risks: 0,
                risk_score: 0,
                treated_percentage: 0
            });
        });

        it('should return zero metrics for non-array input', () => {
            const result = ReportEnrichmentService.calculateMetrics(null as unknown as Risk[]);

            expect(result).toEqual({
                total_risks: 0,
                critical_risks: 0,
                high_risks: 0,
                medium_risks: 0,
                low_risks: 0,
                risk_score: 0,
                treated_percentage: 0
            });
        });

        it('should correctly categorize critical risks (level >= 15)', () => {
            const risks = [
                createMockRisk({ probability: 5, impact: 5 }), // level = 25, critical
                createMockRisk({ probability: 5, impact: 3 }), // level = 15, critical
                createMockRisk({ probability: 3, impact: 5 })  // level = 15, critical
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            expect(result.critical_risks).toBe(3);
            expect(result.total_risks).toBe(3);
        });

        it('should correctly categorize high risks (10 <= level < 15)', () => {
            const risks = [
                createMockRisk({ probability: 5, impact: 2 }), // level = 10, high
                createMockRisk({ probability: 4, impact: 3 }), // level = 12, high
                createMockRisk({ probability: 2, impact: 5 })  // level = 10, high
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            expect(result.high_risks).toBe(3);
        });

        it('should correctly categorize medium risks (5 <= level < 10)', () => {
            const risks = [
                createMockRisk({ probability: 3, impact: 2 }), // level = 6, medium
                createMockRisk({ probability: 2, impact: 3 }), // level = 6, medium
                createMockRisk({ probability: 3, impact: 3 })  // level = 9, medium
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            expect(result.medium_risks).toBe(3);
        });

        it('should correctly categorize low risks (level < 5)', () => {
            const risks = [
                createMockRisk({ probability: 1, impact: 1 }), // level = 1, low
                createMockRisk({ probability: 2, impact: 2 }), // level = 4, low
                createMockRisk({ probability: 1, impact: 3 })  // level = 3, low
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            expect(result.low_risks).toBe(3);
        });

        it('should calculate correct risk score', () => {
            // Sum of levels = 25 + 10 + 5 = 40
            // Max possible = 3 * 25 = 75
            // Score = (40 / 75) * 100 = 53.33 -> 53
            const risks = [
                createMockRisk({ probability: 5, impact: 5 }), // 25
                createMockRisk({ probability: 5, impact: 2 }), // 10
                createMockRisk({ probability: 1, impact: 5 })  // 5
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            expect(result.risk_score).toBe(53);
        });

        it('should calculate treated percentage correctly', () => {
            const risks = [
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'Terminé' } }),
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'En cours' } }),
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'Planifié' } }),
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'Retard' } })
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            // 3 out of 4 are treated
            expect(result.treated_percentage).toBe(75);
        });

        it('should handle risks with missing probability/impact', () => {
            const risks = [
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                createMockRisk({ probability: undefined as unknown as any, impact: 3 as 1 | 2 | 3 | 4 | 5 }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                createMockRisk({ probability: 3 as 1 | 2 | 3 | 4 | 5, impact: undefined as unknown as any })
            ];

            const result = ReportEnrichmentService.calculateMetrics(risks);

            // Both should be low (0 * anything = 0)
            expect(result.low_risks).toBe(2);
        });
    });

    describe('analyzeRiskPortfolio', () => {
        it('should return proper distribution from metrics', () => {
            const risks = [
                createMockRisk({ probability: 5, impact: 5 }), // critical
                createMockRisk({ probability: 4, impact: 3 }), // high
                createMockRisk({ probability: 2, impact: 3 }), // medium
                createMockRisk({ probability: 1, impact: 1 })  // low
            ];

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            expect(result.distribution).toEqual({
                critical: 1,
                high: 1,
                medium: 1,
                low: 1
            });
        });

        it('should return top 5 risks sorted by severity', () => {
            const risks = [
                createMockRisk({ threat: 'Low', probability: 1, impact: 1 }),
                createMockRisk({ threat: 'Critical', probability: 5, impact: 5 }),
                createMockRisk({ threat: 'Medium', probability: 3, impact: 2 }),
                createMockRisk({ threat: 'High', probability: 4, impact: 3 }),
                createMockRisk({ threat: 'Medium2', probability: 2, impact: 3 }),
                createMockRisk({ threat: 'Low2', probability: 2, impact: 1 })
            ];

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            expect(result.top_risks).toHaveLength(5);
            expect(result.top_risks[0].threat).toBe('Critical'); // 25
            expect(result.top_risks[1].threat).toBe('High');     // 12
        });

        it('should generate recommendations for critical risks', () => {
            const risks = [
                createMockRisk({ probability: 5, impact: 5 }),
                createMockRisk({ probability: 5, impact: 4 })
            ];

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            expect(result.recommendations).toContain(
                'Priorité absolue : remédier immédiatement aux 2 risques critiques.'
            );
        });

        it('should generate recommendations for high risk score', () => {
            // All critical risks = high score
            const risks = [
                createMockRisk({ probability: 5, impact: 5 }),
                createMockRisk({ probability: 5, impact: 5 }),
                createMockRisk({ probability: 5, impact: 5 })
            ];

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            expect(result.recommendations).toContainEqual(
                expect.stringContaining("L'exposition globale au risque est élevée")
            );
        });

        it('should generate recommendations for low treatment coverage', () => {
            const risks = [
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'Planifié' } }), // Treated
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'Retard' } }), // Untreated
                createMockRisk({ treatment: { strategy: 'Atténuer' } }), // Untreated (no status)
                createMockRisk({ treatment: { strategy: 'Atténuer', status: 'Retard' } })        // Untreated
            ];

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            expect(result.recommendations).toContainEqual(
                expect.stringContaining('Accélérez la mise en œuvre des plans de traitement')
            );
        });

        it('should detect increasing trend for recent risks', () => {
            // Create risks with recent creation dates
            const recentDate = new Date().toISOString();
            const risks = Array(10).fill(null).map(() =>
                createMockRisk({ createdAt: recentDate })
            );

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            // If more than 10% are recent, trend is increasing
            expect(result.trends.trend_direction).toBe('increasing');
            expect(result.trends.new_risks_count).toBe(10);
        });

        it('should detect stable trend for old risks', () => {
            // Create risks with old creation dates
            const oldDate = new Date('2020-01-01').toISOString();
            const risks = [
                createMockRisk({ createdAt: oldDate }),
                createMockRisk({ createdAt: oldDate })
            ];

            const result = ReportEnrichmentService.analyzeRiskPortfolio(risks);

            expect(result.trends.trend_direction).toBe('stable');
            expect(result.trends.new_risks_count).toBe(0);
        });
    });

    describe('generateExecutiveSummary', () => {
        it('should generate summary with "Sain" status for low risk score', () => {
            const metrics: ReportMetrics = {
                total_risks: 10,
                critical_risks: 0,
                high_risks: 1,
                medium_risks: 4,
                low_risks: 5,
                risk_score: 25,
                treated_percentage: 80
            };

            const summary = ReportEnrichmentService.generateExecutiveSummary(metrics);

            expect(summary).toContain('Posture de Sécurité Actuelle : Sain');
            expect(summary).toContain('Score : 75/100'); // 100 - 25
        });

        it('should generate summary with "Modéré" status for medium risk score', () => {
            const metrics: ReportMetrics = {
                total_risks: 10,
                critical_risks: 2,
                high_risks: 3,
                medium_risks: 3,
                low_risks: 2,
                risk_score: 45,
                treated_percentage: 60
            };

            const summary = ReportEnrichmentService.generateExecutiveSummary(metrics);

            expect(summary).toContain('Posture de Sécurité Actuelle : Modéré');
        });

        it('should generate summary with "Critique" status for high risk score', () => {
            const metrics: ReportMetrics = {
                total_risks: 10,
                critical_risks: 5,
                high_risks: 3,
                medium_risks: 2,
                low_risks: 0,
                risk_score: 75,
                treated_percentage: 30
            };

            const summary = ReportEnrichmentService.generateExecutiveSummary(metrics);

            expect(summary).toContain('Posture de Sécurité Actuelle : Critique');
        });

        it('should include all key metrics in summary', () => {
            const metrics: ReportMetrics = {
                total_risks: 15,
                critical_risks: 3,
                high_risks: 5,
                medium_risks: 4,
                low_risks: 3,
                risk_score: 50,
                treated_percentage: 65
            };

            const summary = ReportEnrichmentService.generateExecutiveSummary(metrics);

            expect(summary).toContain('15 risques actifs');
            expect(summary).toContain('3 éléments critiques');
            expect(summary).toContain('65%');
        });

        it('should recommend immediate action when critical risks exist', () => {
            const metrics: ReportMetrics = {
                total_risks: 10,
                critical_risks: 2,
                high_risks: 3,
                medium_risks: 3,
                low_risks: 2,
                risk_score: 40,
                treated_percentage: 50
            };

            const summary = ReportEnrichmentService.generateExecutiveSummary(metrics);

            expect(summary).toContain('allocation immédiate de ressources');
        });

        it('should recommend maintenance when no critical risks', () => {
            const metrics: ReportMetrics = {
                total_risks: 10,
                critical_risks: 0,
                high_risks: 2,
                medium_risks: 4,
                low_risks: 4,
                risk_score: 25,
                treated_percentage: 70
            };

            const summary = ReportEnrichmentService.generateExecutiveSummary(metrics);

            expect(summary).toContain('Maintenir');
        });
    });

    describe('calculateAuditMetrics', () => {
        it('should count findings by type correctly', () => {
            const findings = [
                { type: 'Majeure', status: 'Ouvert' },
                { type: 'Majeure', status: 'Fermé' },
                { type: 'Mineure', status: 'Ouvert' },
                { type: 'Observation', status: 'Fermé' }
            ];

            const result = ReportEnrichmentService.calculateAuditMetrics(findings);

            expect(result.major_findings).toBe(2);
            expect(result.minor_findings).toBe(1);
            expect(result.observations).toBe(1);
        });

        it('should count findings by status correctly', () => {
            const findings = [
                { type: 'Majeure', status: 'Ouvert' },
                { type: 'Mineure', status: 'Ouvert' },
                { type: 'Observation', status: 'Fermé' }
            ];

            const result = ReportEnrichmentService.calculateAuditMetrics(findings);

            expect(result.open_findings).toBe(2);
            expect(result.closed_findings).toBe(1);
        });

        it('should calculate conformity score with penalties', () => {
            // Major = -20, Minor = -5, Observation = -1
            const findings = [
                { type: 'Majeure', status: 'Ouvert' },     // -20
                { type: 'Mineure', status: 'Ouvert' },     // -5
                { type: 'Observation', status: 'Ouvert' }  // -1
            ];
            // 100 - 26 = 74

            const result = ReportEnrichmentService.calculateAuditMetrics(findings);

            expect(result.conformity_score).toBe(74);
        });

        it('should not go below 0 conformity score', () => {
            const findings = Array(10).fill({ type: 'Majeure', status: 'Ouvert' });
            // 10 * -20 = -200, but should clamp to 0

            const result = ReportEnrichmentService.calculateAuditMetrics(findings);

            expect(result.conformity_score).toBe(0);
        });

        it('should return perfect score for empty findings', () => {
            const result = ReportEnrichmentService.calculateAuditMetrics([]);

            expect(result.total_findings).toBe(0);
            expect(result.conformity_score).toBe(100);
        });
    });

    describe('generateAuditExecutiveSummary', () => {
        it('should generate "Bon" status for high conformity', () => {
            const metrics: AuditMetrics = {
                total_findings: 5,
                major_findings: 0,
                minor_findings: 2,
                observations: 3,
                open_findings: 1,
                closed_findings: 4,
                conformity_score: 90
            };

            const summary = ReportEnrichmentService.generateAuditExecutiveSummary(metrics, 'ISO 27001 Audit');

            expect(summary).toContain('Évaluation de Conformité : Bon');
            expect(summary).toContain('ISO 27001 Audit');
        });

        it('should generate "Acceptable" status for medium conformity', () => {
            const metrics: AuditMetrics = {
                total_findings: 10,
                major_findings: 1,
                minor_findings: 4,
                observations: 5,
                open_findings: 5,
                closed_findings: 5,
                conformity_score: 70
            };

            const summary = ReportEnrichmentService.generateAuditExecutiveSummary(metrics, 'Annual Audit');

            expect(summary).toContain('Évaluation de Conformité : Acceptable');
        });

        it('should generate "Critique" status for low conformity', () => {
            const metrics: AuditMetrics = {
                total_findings: 15,
                major_findings: 3,
                minor_findings: 5,
                observations: 7,
                open_findings: 12,
                closed_findings: 3,
                conformity_score: 40
            };

            const summary = ReportEnrichmentService.generateAuditExecutiveSummary(metrics, 'Compliance Audit');

            expect(summary).toContain('Évaluation de Conformité : Critique');
        });

        it('should include all finding counts in summary', () => {
            const metrics: AuditMetrics = {
                total_findings: 8,
                major_findings: 2,
                minor_findings: 3,
                observations: 3,
                open_findings: 4,
                closed_findings: 4,
                conformity_score: 65
            };

            const summary = ReportEnrichmentService.generateAuditExecutiveSummary(metrics, 'Test Audit');

            expect(summary).toContain('8 constats');
            expect(summary).toContain('2 non-conformités majeures');
            expect(summary).toContain('2 Majeures');
            expect(summary).toContain('3 Mineures');
            expect(summary).toContain('3 Observations');
        });
    });

    describe('calculateProjectMetrics', () => {
        it('should count tasks by status correctly', () => {
            const project = createMockProject({
                tasks: [
                    { id: '1', title: 'Task 1', status: 'Terminé', assignee: '', dueDate: '' },
                    { id: '2', title: 'Task 2', status: 'En cours', assignee: '', dueDate: '' },
                    { id: '3', title: 'Task 3', status: 'A faire', assignee: '', dueDate: '' },
                    { id: '4', title: 'Task 4', status: 'Terminé', assignee: '', dueDate: '' }
                ]
            });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.total_tasks).toBe(4);
            expect(result.completed_tasks).toBe(2);
            expect(result.in_progress_tasks).toBe(1);
            expect(result.pending_tasks).toBe(1);
        });

        it('should detect Critical delay risk for overdue projects', () => {
            const project = createMockProject({
                dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
                progress: 80
            });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.delay_risk).toBe('Critical');
        });

        it('should detect High delay risk when deadline is near and progress is low', () => {
            const project = createMockProject({
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
                progress: 50
            });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.delay_risk).toBe('High');
        });

        it('should detect Medium delay risk for moderate timeline concerns', () => {
            const project = createMockProject({
                dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
                progress: 30
            });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.delay_risk).toBe('Medium');
        });

        it('should detect Low delay risk for on-track projects', () => {
            const project = createMockProject({
                dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
                progress: 50
            });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.delay_risk).toBe('Low');
        });

        it('should calculate dependencies count correctly', () => {
            const project = createMockProject({
                relatedRiskIds: ['risk-1', 'risk-2'],
                relatedControlIds: ['control-1', 'control-2', 'control-3']
            });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.dependencies_count).toBe(5);
        });

        it('should use project progress as completion percentage', () => {
            const project = createMockProject({ progress: 75 });

            const result = ReportEnrichmentService.calculateProjectMetrics(project);

            expect(result.completion_percentage).toBe(75);
        });
    });

    describe('generateProjectExecutiveSummary', () => {
        it('should include project name and metrics', () => {
            const metrics: ProjectMetrics = {
                total_tasks: 10,
                completed_tasks: 6,
                in_progress_tasks: 2,
                pending_tasks: 2,
                completion_percentage: 60,
                delay_risk: 'Low',
                dependencies_count: 3
            };

            const summary = ReportEnrichmentService.generateProjectExecutiveSummary(metrics, 'ISMS Implementation');

            expect(summary).toContain('ISMS Implementation');
            expect(summary).toContain('60% d\'achèvement');
            expect(summary).toContain('10 tâches');
            expect(summary).toContain('6 ont été livrées');
        });

        it('should describe Critical delay risk appropriately', () => {
            const metrics: ProjectMetrics = {
                total_tasks: 5,
                completed_tasks: 2,
                in_progress_tasks: 1,
                pending_tasks: 2,
                completion_percentage: 40,
                delay_risk: 'Critical',
                dependencies_count: 2
            };

            const summary = ReportEnrichmentService.generateProjectExecutiveSummary(metrics, 'Overdue Project');

            expect(summary).toContain('dépassé la date d\'échéance');
        });

        it('should describe High delay risk appropriately', () => {
            const metrics: ProjectMetrics = {
                total_tasks: 5,
                completed_tasks: 2,
                in_progress_tasks: 2,
                pending_tasks: 1,
                completion_percentage: 50,
                delay_risk: 'High',
                dependencies_count: 1
            };

            const summary = ReportEnrichmentService.generateProjectExecutiveSummary(metrics, 'At Risk Project');

            expect(summary).toContain('risque significatif de manquer l\'échéance');
        });

        it('should describe Low delay risk appropriately', () => {
            const metrics: ProjectMetrics = {
                total_tasks: 10,
                completed_tasks: 8,
                in_progress_tasks: 1,
                pending_tasks: 1,
                completion_percentage: 80,
                delay_risk: 'Low',
                dependencies_count: 4
            };

            const summary = ReportEnrichmentService.generateProjectExecutiveSummary(metrics, 'On Track Project');

            expect(summary).toContain('paramètres acceptables');
        });
    });

    describe('calculateComplianceMetrics', () => {
        it('should count controls by status correctly', () => {
            const controls = [
                createMockControl({ status: 'Implémenté' }),
                createMockControl({ status: 'Implémenté' }),
                createMockControl({ status: 'En cours' }),
                createMockControl({ status: 'Non commencé' }),
                createMockControl({ status: 'Non applicable' })
            ];

            const result = ReportEnrichmentService.calculateComplianceMetrics(controls);

            expect(result.total_controls).toBe(5);
            expect(result.implemented_controls).toBe(2);
            expect(result.not_applicable).toBe(1);
            expect(result.not_started).toBe(1);
        });

        it('should calculate compliance coverage excluding N/A controls', () => {
            const controls = [
                createMockControl({ status: 'Implémenté' }),
                createMockControl({ status: 'Implémenté' }),
                createMockControl({ status: 'Non commencé' }),
                createMockControl({ status: 'Non applicable' })
            ];
            // Effective total = 4 - 1 = 3
            // Implemented = 2
            // Coverage = 2/3 = 67%

            const result = ReportEnrichmentService.calculateComplianceMetrics(controls);

            expect(result.compliance_coverage).toBe(67);
        });

        it('should calculate audit readiness correctly', () => {
            const controls = [
                createMockControl({ status: 'Implémenté' }),
                createMockControl({ status: 'En cours' }),
                createMockControl({ status: 'Non commencé' }),
                createMockControl({ status: 'Non applicable' })
            ];
            // Effective total = 4 - 1 = 3
            // Implemented + Planned (En cours + Non commencé) = 1 + 2 = 3
            // Readiness = 3/3 = 100%

            const result = ReportEnrichmentService.calculateComplianceMetrics(controls);

            expect(result.audit_readiness).toBe(100);
        });

        it('should return 0 coverage for empty controls', () => {
            const result = ReportEnrichmentService.calculateComplianceMetrics([]);

            expect(result.compliance_coverage).toBe(0);
            expect(result.audit_readiness).toBe(0);
        });

        it('should return 0 when all controls are N/A', () => {
            const controls = [
                createMockControl({ status: 'Non applicable' }),
                createMockControl({ status: 'Non applicable' })
            ];

            const result = ReportEnrichmentService.calculateComplianceMetrics(controls);

            expect(result.compliance_coverage).toBe(0);
        });
    });

    describe('generateComplianceExecutiveSummary', () => {
        it('should generate "Optimisé" status for high coverage', () => {
            const metrics: ComplianceMetrics = {
                total_controls: 100,
                implemented_controls: 85,
                planned_controls: 10,
                not_applicable: 5,
                not_started: 0,
                compliance_coverage: 90,
                audit_readiness: 95
            };

            const summary = ReportEnrichmentService.generateComplianceExecutiveSummary(metrics);

            expect(summary).toContain('Évaluation de Maturité : Optimisé');
        });

        it('should generate "En développement" status for medium coverage', () => {
            const metrics: ComplianceMetrics = {
                total_controls: 100,
                implemented_controls: 60,
                planned_controls: 20,
                not_applicable: 5,
                not_started: 15,
                compliance_coverage: 65,
                audit_readiness: 80
            };

            const summary = ReportEnrichmentService.generateComplianceExecutiveSummary(metrics);

            expect(summary).toContain('Évaluation de Maturité : En développement');
        });

        it('should generate "Initial" status for low coverage', () => {
            const metrics: ComplianceMetrics = {
                total_controls: 100,
                implemented_controls: 30,
                planned_controls: 25,
                not_applicable: 10,
                not_started: 35,
                compliance_coverage: 40,
                audit_readiness: 55
            };

            const summary = ReportEnrichmentService.generateComplianceExecutiveSummary(metrics);

            expect(summary).toContain('Évaluation de Maturité : Initial');
        });

        it('should recommend evidence collection for high readiness', () => {
            const metrics: ComplianceMetrics = {
                total_controls: 50,
                implemented_controls: 45,
                planned_controls: 3,
                not_applicable: 2,
                not_started: 0,
                compliance_coverage: 94,
                audit_readiness: 95
            };

            const summary = ReportEnrichmentService.generateComplianceExecutiveSummary(metrics);

            expect(summary).toContain('bien positionnée pour un audit externe');
        });

        it('should recommend acceleration for low readiness', () => {
            const metrics: ComplianceMetrics = {
                total_controls: 50,
                implemented_controls: 20,
                planned_controls: 15,
                not_applicable: 5,
                not_started: 10,
                compliance_coverage: 50,
                audit_readiness: 70
            };

            const summary = ReportEnrichmentService.generateComplianceExecutiveSummary(metrics);

            expect(summary).toContain('Accélérez');
        });
    });

    describe('calculateGlobalMetrics', () => {
        const defaultRiskMetrics: ReportMetrics = {
            total_risks: 10,
            critical_risks: 1,
            high_risks: 2,
            medium_risks: 4,
            low_risks: 3,
            risk_score: 40,
            treated_percentage: 60
        };

        const defaultComplianceMetrics: ComplianceMetrics = {
            total_controls: 50,
            implemented_controls: 35,
            planned_controls: 10,
            not_applicable: 5,
            not_started: 0,
            compliance_coverage: 70,
            audit_readiness: 90
        };

        it('should calculate weighted global score correctly', () => {
            const auditMetrics: AuditMetrics[] = [
                { total_findings: 5, major_findings: 1, minor_findings: 2, observations: 2, open_findings: 2, closed_findings: 3, conformity_score: 80 }
            ];
            const projectMetrics: ProjectMetrics[] = [
                { total_tasks: 10, completed_tasks: 7, in_progress_tasks: 2, pending_tasks: 1, completion_percentage: 70, delay_risk: 'Low', dependencies_count: 3 }
            ];

            // Risk Health = 100 - 40 = 60 (weight 0.30) = 18
            // Compliance Health = 70 (weight 0.30) = 21
            // Audit Health = 80 (weight 0.20) = 16
            // Project Health = 70 (weight 0.20) = 14
            // Total = 69

            const result = ReportEnrichmentService.calculateGlobalMetrics(
                defaultRiskMetrics,
                defaultComplianceMetrics,
                auditMetrics,
                projectMetrics
            );

            expect(result.global_score).toBe(69);
        });

        it('should use 100 as default for missing audits', () => {
            const result = ReportEnrichmentService.calculateGlobalMetrics(
                defaultRiskMetrics,
                defaultComplianceMetrics,
                [],
                []
            );

            expect(result.audit_health).toBe(100);
            expect(result.project_health).toBe(100);
        });

        it('should penalize project health for delays', () => {
            const projectMetrics: ProjectMetrics[] = [
                { total_tasks: 10, completed_tasks: 5, in_progress_tasks: 3, pending_tasks: 2, completion_percentage: 50, delay_risk: 'Critical', dependencies_count: 2 }
            ];

            // Project health = 50 - 50 (Critical penalty) = 0

            const result = ReportEnrichmentService.calculateGlobalMetrics(
                defaultRiskMetrics,
                defaultComplianceMetrics,
                [],
                projectMetrics
            );

            expect(result.project_health).toBe(0);
        });

        it('should average multiple audit scores', () => {
            const auditMetrics: AuditMetrics[] = [
                { total_findings: 3, major_findings: 0, minor_findings: 1, observations: 2, open_findings: 1, closed_findings: 2, conformity_score: 90 },
                { total_findings: 10, major_findings: 2, minor_findings: 3, observations: 5, open_findings: 6, closed_findings: 4, conformity_score: 60 }
            ];

            const result = ReportEnrichmentService.calculateGlobalMetrics(
                defaultRiskMetrics,
                defaultComplianceMetrics,
                auditMetrics,
                []
            );

            expect(result.audit_health).toBe(75); // (90 + 60) / 2
        });

        it('should track total counts', () => {
            const auditMetrics: AuditMetrics[] = [
                { total_findings: 5, major_findings: 1, minor_findings: 2, observations: 2, open_findings: 2, closed_findings: 3, conformity_score: 80 },
                { total_findings: 8, major_findings: 2, minor_findings: 3, observations: 3, open_findings: 4, closed_findings: 4, conformity_score: 70 }
            ];
            const projectMetrics: ProjectMetrics[] = [
                { total_tasks: 10, completed_tasks: 7, in_progress_tasks: 2, pending_tasks: 1, completion_percentage: 70, delay_risk: 'Low', dependencies_count: 3 },
                { total_tasks: 5, completed_tasks: 4, in_progress_tasks: 1, pending_tasks: 0, completion_percentage: 80, delay_risk: 'Low', dependencies_count: 2 },
                { total_tasks: 8, completed_tasks: 2, in_progress_tasks: 3, pending_tasks: 3, completion_percentage: 30, delay_risk: 'High', dependencies_count: 1 }
            ];

            const result = ReportEnrichmentService.calculateGlobalMetrics(
                defaultRiskMetrics,
                defaultComplianceMetrics,
                auditMetrics,
                projectMetrics
            );

            expect(result.total_audits).toBe(2);
            expect(result.total_projects).toBe(3);
        });
    });

    describe('generateGlobalExecutiveSummary', () => {
        it('should generate grade A for score >= 90', () => {
            const metrics = {
                global_score: 92,
                risk_health: 90,
                compliance_health: 95,
                audit_health: 90,
                project_health: 85,
                total_projects: 5,
                total_audits: 3
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Note Globale de Gouvernance : A');
        });

        it('should generate grade B for score >= 80', () => {
            const metrics = {
                global_score: 85,
                risk_health: 80,
                compliance_health: 85,
                audit_health: 90,
                project_health: 80,
                total_projects: 4,
                total_audits: 2
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Note Globale de Gouvernance : B');
        });

        it('should generate grade C for score >= 60', () => {
            const metrics = {
                global_score: 65,
                risk_health: 60,
                compliance_health: 70,
                audit_health: 65,
                project_health: 60,
                total_projects: 3,
                total_audits: 2
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Note Globale de Gouvernance : C');
        });

        it('should generate grade D for score >= 40', () => {
            const metrics = {
                global_score: 45,
                risk_health: 40,
                compliance_health: 50,
                audit_health: 45,
                project_health: 40,
                total_projects: 2,
                total_audits: 1
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Note Globale de Gouvernance : D');
        });

        it('should generate grade F for score < 40', () => {
            const metrics = {
                global_score: 25,
                risk_health: 20,
                compliance_health: 30,
                audit_health: 25,
                project_health: 20,
                total_projects: 1,
                total_audits: 1
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Note Globale de Gouvernance : F');
        });

        it('should include all KPIs in summary', () => {
            const metrics = {
                global_score: 75,
                risk_health: 70,
                compliance_health: 80,
                audit_health: 75,
                project_health: 65,
                total_projects: 4,
                total_audits: 3
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Résilience aux Risques : 70%');
            expect(summary).toContain('Maturité de Conformité : 80%');
            expect(summary).toContain('Conformité d\'Audit : 75%');
            expect(summary).toContain('Exécution Stratégique : 65%');
            expect(summary).toContain('4 initiatives actives');
            expect(summary).toContain('3 audits récents');
        });

        it('should recommend maintenance for high grades', () => {
            const metrics = {
                global_score: 88,
                risk_health: 85,
                compliance_health: 90,
                audit_health: 88,
                project_health: 82,
                total_projects: 6,
                total_audits: 4
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Maintenez la dynamique actuelle');
        });

        it('should recommend remediation for low grades', () => {
            const metrics = {
                global_score: 55,
                risk_health: 50,
                compliance_health: 60,
                audit_health: 55,
                project_health: 50,
                total_projects: 3,
                total_audits: 2
            };

            const summary = ReportEnrichmentService.generateGlobalExecutiveSummary(metrics);

            expect(summary).toContain('Initiez un plan de remédiation');
        });
    });
});
