import { Risk, Project, ProjectTask, Control } from '../types';
import { CONTROL_STATUS, PARTIAL_CONTROL_WEIGHT, RISK_THRESHOLDS, COMPLIANCE_WEIGHTS, isActionableStatus, isExcludedStatus } from '../constants/complianceConfig';

export interface ReportMetrics {
    total_risks: number;
    critical_risks: number;
    high_risks: number;
    medium_risks: number;
    low_risks: number;
    risk_score: number;
    treated_percentage: number;
}

export interface RiskAnalysis {
    distribution: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    top_risks: Risk[];
    trends: {
        new_risks_count: number;
        trend_direction: 'increasing' | 'stable' | 'decreasing';
    };
    recommendations: string[];
}

export class ReportEnrichmentService {

    /**
     * Calculate meaningful metrics from raw risk data
     * Ported from MCP Server RiskManagementTools
     */
    static calculateMetrics(risks: Risk[]): ReportMetrics {
        if (!Array.isArray(risks)) {
            return {
                total_risks: 0,
                critical_risks: 0,
                high_risks: 0,
                medium_risks: 0,
                low_risks: 0,
                risk_score: 0,
                treated_percentage: 0
            };
        }

        const total = risks.length;
        let critical = 0;
        let high = 0;
        let medium = 0;
        let low = 0;
        let treated = 0;

        risks.forEach(r => {
            const prob = Number(r.probability) || 0;
            const imp = Number(r.impact) || 0;
            const level = prob * imp;
            if (level >= RISK_THRESHOLDS.CRITICAL) critical++;
            else if (level >= RISK_THRESHOLDS.HIGH) high++;
            else if (level >= RISK_THRESHOLDS.MEDIUM) medium++;
            else low++;

            if (r.treatment?.status === 'Terminé' || r.treatment?.status === 'Planifié' || r.treatment?.status === 'En cours') {
                treated++;
            }
        });

        // Calculate weighted risk score (0-100)
        // Max possible score per risk is 25. 
        // Normalized score = (Sum of levels / (Count * 25)) * 100
        const sumLevels = risks.reduce((acc, r) => acc + ((Number(r.probability) || 0) * (Number(r.impact) || 0)), 0);
        const riskScore = total > 0 ? Math.round((sumLevels / (total * 25)) * 100) : 0;

        return {
            total_risks: total,
            critical_risks: critical,
            high_risks: high,
            medium_risks: medium,
            low_risks: low,
            risk_score: riskScore,
            treated_percentage: total > 0 ? Math.round((treated / total) * 100) : 0
        };
    }

    /**
     * Generate an intelligent analysis of the risk portfolio
     * Simulates AI analysis from MCP Server
     */
    static analyzeRiskPortfolio(risks: Risk[]): RiskAnalysis {
        const metrics = this.calculateMetrics(risks);

        // Auto-generate recommendations based on heuristics
        const recommendations: string[] = [];

        if (metrics.critical_risks > 0) {
            recommendations.push(`Priorité absolue : remédier immédiatement aux ${metrics.critical_risks} risques critiques.`);
        }

        if (metrics.risk_score > 60) {
            recommendations.push("L'exposition globale au risque est élevée. Revoyez l'appétence au risque et l'efficacité des contrôles.");
        }

        if (metrics.treated_percentage < 50) {
            recommendations.push("Accélérez la mise en œuvre des plans de traitement pour améliorer la couverture.");
        }

        if (metrics.low_risks > metrics.high_risks * 3) {
            recommendations.push("Revoyez les risques de faible priorité pour vous assurer qu'ils ne sont pas mal classés.");
        }

        // Sort risks by severity for "Top Risks"
        const topRisks = Array.isArray(risks) ? [...risks]
            .sort((a, b) => ((Number(b.probability) || 0) * (Number(b.impact) || 0)) - ((Number(a.probability) || 0) * (Number(a.impact) || 0)))
            .slice(0, 5) : [];

        // Trend analysis based on creation date
        const recentCount = risks.filter(r => {
            if (!r.createdAt) return false;
            const date = new Date(r.createdAt);
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return date > monthAgo;
        }).length;

        return {
            distribution: {
                critical: metrics.critical_risks,
                high: metrics.high_risks,
                medium: metrics.medium_risks,
                low: metrics.low_risks
            },
            top_risks: topRisks,
            trends: {
                new_risks_count: recentCount,
                trend_direction: recentCount > (metrics.total_risks * 0.1) ? 'increasing' : 'stable'
            },
            recommendations
        };
    }

    /**
     * Generate Executive Summary Text
     * Ported from MCP Server AnalyticsTools
     */
    static generateExecutiveSummary(metrics: ReportMetrics): string {
        const status = metrics.risk_score < 30 ? "Sain" : metrics.risk_score < 60 ? "Modéré" : "Critique";

        return `
      Synthèse Exécutive : Protection des Données & Conformité
      
      Posture de Sécurité Actuelle : ${status} (Score : ${100 - metrics.risk_score}/100)
      
      Vue d'ensemble :
      L'organisation suit actuellement ${metrics.total_risks} risques actifs, avec une attention particulière sur ${metrics.critical_risks} éléments critiques nécessitant une action immédiate. L'exposition globale au risque est calculée à ${metrics.risk_score}%, indiquant un niveau de risque résiduel ${status.toLowerCase()}.
      
      Points Clés :
      • Menaces Critiques : ${metrics.critical_risks} (${Math.round((metrics.critical_risks / metrics.total_risks) * 100 || 0)}% du total)
      • Progrès de l'Atténuation : ${metrics.treated_percentage}% des risques identifiés ont des plans de traitement actifs.
      • Distribution : La majorité des risques se situent dans la catégorie ${metrics.high_risks > metrics.medium_risks ? 'Élevée' : 'Moyenne'}.

      Recommandation Stratégique :
      ${metrics.critical_risks > 0
                ? "Une allocation immédiate de ressources est requise pour traiter les vulnérabilités critiques."
                : "Maintenir l'efficacité actuelle des contrôles et poursuivre la surveillance régulière."}
    `.trim();
    }
    // --- AUDIT MODULE ENRICHMENT ---

    /**
     * Calculate metrics for a specific Audit based on its findings
     */
    static calculateAuditMetrics(findings: { type: string; status: string }[]): AuditMetrics {
        const total = findings.length;
        let major = 0;
        let minor = 0;
        let observation = 0;
        let open = 0;
        let closed = 0;

        findings.forEach(f => {
            if (f.type === 'Majeure') major++;
            else if (f.type === 'Mineure') minor++;
            else observation++;

            if (f.status === 'Ouvert') open++;
            else closed++;
        });

        // Calculate a "Conformity Score" based on findings
        // Base 100
        // Major = -20 pts
        // Minor = -5 pts
        // Observation = -1 pt
        const penalty = (major * 20) + (minor * 5) + (observation * 1);
        const conformityScore = Math.max(0, 100 - penalty);

        return {
            total_findings: total,
            major_findings: major,
            minor_findings: minor,
            observations: observation,
            open_findings: open,
            closed_findings: closed,
            conformity_score: conformityScore
        };
    }

    /**
     * Generate Executive Summary for an Audit Report
     */
    static generateAuditExecutiveSummary(metrics: AuditMetrics, auditName: string): string {
        const status = metrics.conformity_score > 85 ? "Bon" : metrics.conformity_score > 60 ? "Acceptable" : "Critique";

        return `
      Synthèse Exécutive : ${auditName}
      
      Évaluation de Conformité : ${status} (Score : ${metrics.conformity_score}/100)
      
      Vue d'ensemble :
      Cet audit a identifié un total de ${metrics.total_findings} constats. La revue met en évidence ${metrics.major_findings} non-conformités majeures représentant des écarts significatifs par rapport au standard.
      
      Observations Clés :
      • Criticité : ${metrics.major_findings} Majeures, ${metrics.minor_findings} Mineures, ${metrics.observations} Observations.
      • Statut de Remédiation : ${metrics.closed_findings} constats ont été traités, tandis que ${metrics.open_findings} restent ouverts.
      
      Recommandation Stratégique :
      ${metrics.major_findings > 0
                ? "La priorité doit être donnée à la clôture des non-conformités majeures pour assurer la conformité de la certification."
                : "Concentrez-vous sur l'amélioration continue en traitant les constats mineurs et les observations."}
    `.trim();
    }
    // --- PROJECT MODULE ENRICHMENT ---

    /**
     * Calculate metrics for a specific Project
     */
    static calculateProjectMetrics(project: Project): ProjectMetrics {
        const tasks = project.tasks || [];
        const total = tasks.length;
        const done = tasks.filter((t: ProjectTask) => t.status === 'Terminé').length;
        const inProgress = tasks.filter((t: ProjectTask) => t.status === 'En cours').length;
        const todo = tasks.filter((t: ProjectTask) => t.status === 'A faire').length;

        // Calculate delay risk
        let delayRisk = 'Low';
        if (project.dueDate) {
            const daysLeft = Math.ceil((new Date(project.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft < 0) delayRisk = 'Critical';
            else if (daysLeft < 7 && project.progress < 90) delayRisk = 'High';
            else if (daysLeft < 30 && project.progress < 50) delayRisk = 'Medium';
        }

        return {
            total_tasks: total,
            completed_tasks: done,
            in_progress_tasks: inProgress,
            pending_tasks: todo,
            completion_percentage: project.progress || 0,
            delay_risk: delayRisk,
            dependencies_count: (project.relatedRiskIds?.length || 0) + (project.relatedControlIds?.length || 0)
        };
    }

    /**
     * Generate Executive Summary for a Project Report
     */
    static generateProjectExecutiveSummary(metrics: ProjectMetrics, projectName: string): string {
        return `
      Synthèse Exécutive : ${projectName}
      
      Vue d'ensemble du Statut :
      Le projet est actuellement à ${metrics.completion_percentage}% d'achèvement. Sur un total de ${metrics.total_tasks} tâches, ${metrics.completed_tasks} ont été livrées avec succès.
      
      Évaluation des Risques :
      Le risque planning est actuellement évalué comme ${metrics.delay_risk}. ${metrics.delay_risk === 'Critical' ? 'Le projet a dépassé la date d\'échéance et nécessite une intervention immédiate.' : metrics.delay_risk === 'High' ? 'Il existe un risque significatif de manquer l\'échéance compte tenu de la progression actuelle.' : 'Le projet progresse dans des paramètres acceptables.'}
      
      Composants Opérationnels :
      L'initiative implique ${metrics.in_progress_tasks} chantiers actifs. Elle est stratégiquement liée à ${metrics.dependencies_count} autres éléments GRC (Risques/Contrôles), assurant l'alignement avec la posture de sécurité globale.
    `.trim();
    }
    // --- COMPLIANCE MODULE ENRICHMENT ---

    /**
     * Calculate metrics for Compliance (SoA)
     */
    static calculateComplianceMetrics(controls: Control[]): ComplianceMetrics {
        const total = controls.length;
        const implemented = controls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
        const partial = controls.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;
        const planned = controls.filter(c => c.status === CONTROL_STATUS.NOT_STARTED || c.status === CONTROL_STATUS.IN_PROGRESS).length;
        const notApplicable = controls.filter(c => isExcludedStatus(c.status)).length;
        const notStarted = controls.filter(c => c.status === CONTROL_STATUS.NOT_STARTED).length;

        const actionable = controls.filter(c => isActionableStatus(c.status)).length;
        const coverage = actionable > 0 ? Math.round(((implemented + partial * PARTIAL_CONTROL_WEIGHT) / actionable) * 100) : 100;
        const readiness = actionable > 0 ? Math.round(((implemented + partial + planned) / actionable) * 100) : 100;

        return {
            total_controls: total,
            implemented_controls: implemented,
            planned_controls: planned,
            not_applicable: notApplicable,
            not_started: notStarted,
            compliance_coverage: coverage,
            audit_readiness: readiness
        };
    }

    /**
     * Generate Executive Summary for Compliance Report
     */
    static generateComplianceExecutiveSummary(metrics: ComplianceMetrics): string {
        const status = metrics.compliance_coverage > 80 ? "Optimisé" : metrics.compliance_coverage > 50 ? "En développement" : "Initial";

        return `
      Synthèse Exécutive : Statut de Conformité ISO 27001
      
      Évaluation de Maturité : ${status} (Couverture : ${metrics.compliance_coverage}%)
      
      Vue d'ensemble :
      Le Système de Management de la Sécurité de l'Information (SMSI) couvre actuellement ${metrics.compliance_coverage}% des contrôles de sécurité applicables. Un total de ${metrics.implemented_controls} contrôles ont été entièrement implémentés et vérifiés.
      
      Analyse des Écarts :
      • Implémentés : ${metrics.implemented_controls} contrôles assurant une défense active.
      • En Cours : ${metrics.planned_controls} contrôles sont en cours de déploiement ou de traitement.
      • Action Requise : ${metrics.not_started} contrôles n'ont pas encore été adressés.
      
      Feuille de Route Stratégique :
      ${metrics.audit_readiness > 80
                ? "L'organisation est bien positionnée pour un audit externe. Concentrez-vous sur la collecte de preuves et la surveillance continue."
                : "Accélérez l'implémentation des contrôles planifiés pour atteindre une posture minimale viable pour la certification."}
    `.trim();
    }
    // --- GLOBAL MODULE ENRICHMENT ---

    /**
     * Calculate global metrics aggregating all domains
     */
    static calculateGlobalMetrics(
        riskMetrics: ReportMetrics,
        complianceMetrics: ComplianceMetrics,
        auditMetrics: AuditMetrics[],
        projectMetrics: ProjectMetrics[]
    ): GlobalMetrics {
        // 1. Risk Component (30%)
        // Risk Score is already 0-100 (where 0 is best). We want Health (100 is best).
        // So Risk Health = 100 - Risk Score.
        const riskHealth = Math.max(0, 100 - riskMetrics.risk_score);

        // 2. Compliance Component (30%)
        const complianceHealth = complianceMetrics.compliance_coverage;

        // 3. Audit Component (20%)
        // Average of all audit scores
        const auditHealth = auditMetrics.length > 0
            ? auditMetrics.reduce((acc, a) => acc + a.conformity_score, 0) / auditMetrics.length
            : 100; // Default to 100 if no audits

        // 4. Project Component (20%)
        // Based on completion vs delay
        const projectHealth = projectMetrics.length > 0
            ? projectMetrics.reduce((acc, p) => {
                let score = p.completion_percentage;
                // Penalize for delays
                if (p.delay_risk === 'Critical') score -= 50;
                else if (p.delay_risk === 'High') score -= 25;
                else if (p.delay_risk === 'Medium') score -= 10;
                return acc + Math.max(0, score);
            }, 0) / projectMetrics.length
            : 100; // Default to 100 if no projects

        // Weighted Average (using centralized weights)
        const globalScore = Math.round(
            (riskHealth * COMPLIANCE_WEIGHTS.risks) +
            (complianceHealth * COMPLIANCE_WEIGHTS.controls) +
            (auditHealth * COMPLIANCE_WEIGHTS.audits) +
            (projectHealth * (COMPLIANCE_WEIGHTS.documents + COMPLIANCE_WEIGHTS.training))
        );

        return {
            global_score: globalScore,
            risk_health: riskHealth,
            compliance_health: complianceHealth,
            audit_health: Math.round(auditHealth),
            project_health: Math.round(projectHealth),
            total_projects: projectMetrics.length,
            total_audits: auditMetrics.length
        };
    }

    /**
     * Generate Executive Summary for Global Report
     */
    static generateGlobalExecutiveSummary(metrics: GlobalMetrics): string {
        const grade = metrics.global_score >= 90 ? 'A'
            : metrics.global_score >= 80 ? 'B'
                : metrics.global_score >= 60 ? 'C'
                    : metrics.global_score >= 40 ? 'D' : 'F';

        return `
      Synthèse Exécutive Globale : Statut de la Gouvernance Cyber
      
      Note Globale de Gouvernance : ${grade} (Score : ${metrics.global_score}/100)
      
      Vue d'ensemble Stratégique :
      La posture globale de gouvernance de l'organisation est actuellement notée à ${metrics.global_score}%. Ce score reflète une évaluation pondérée de la Gestion des Risques (30%), de la Conformité ISO 27001 (30%), des Résultats d'Audit (20%) et des Initiatives Stratégiques (20%).
      
      Indicateurs Clés de Performance (KPIs) :
      • Résilience aux Risques : ${metrics.risk_health}% - ${metrics.risk_health > 80 ? 'Posture de défense robuste.' : 'Nécessite une attention pour réduire l\'exposition.'}
      • Maturité de Conformité : ${metrics.compliance_health}% - ${metrics.compliance_health > 80 ? 'Alignement élevé avec les normes ISO.' : 'Écarts dans l\'implémentation des contrôles.'}
      • Conformité d'Audit : ${metrics.audit_health}% - Basé sur ${metrics.total_audits} audits récents.
      • Exécution Stratégique : ${metrics.project_health}% - Progrès sur ${metrics.total_projects} initiatives actives.
      
      Recommandation :
      ${grade === 'A' || grade === 'B'
                ? "Maintenez la dynamique actuelle. Concentrez-vous sur l'amélioration continue et les menaces émergentes."
                : "Initiez un plan de remédiation se concentrant sur les domaines les moins performants pour améliorer la note globale."}
    `.trim();
    }
}

export interface AuditMetrics {
    total_findings: number;
    major_findings: number;
    minor_findings: number;
    observations: number;
    open_findings: number;
    closed_findings: number;
    conformity_score: number;
}

export interface ProjectMetrics {
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    pending_tasks: number;
    completion_percentage: number;
    delay_risk: string;
    dependencies_count: number;
}

export interface ComplianceMetrics {
    total_controls: number;
    implemented_controls: number;
    planned_controls: number;
    not_applicable: number;
    not_started: number;
    compliance_coverage: number;
    audit_readiness: number;
}

export interface GlobalMetrics {
    global_score: number;
    risk_health: number;
    compliance_health: number;
    audit_health: number;
    project_health: number;
    total_projects: number;
    total_audits: number;
}
