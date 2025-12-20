import { Risk, Project, ProjectTask, Control } from '../types';

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
        const total = risks.length;
        let critical = 0;
        let high = 0;
        let medium = 0;
        let low = 0;
        let treated = 0;

        risks.forEach(r => {
            const prob = r.probability || 0;
            const imp = r.impact || 0;
            const level = prob * imp;
            if (level >= 20) critical++;
            else if (level >= 15) high++;
            else if (level >= 9) medium++;
            else low++;

            if (r.treatment?.status === 'Terminé' || r.treatment?.status === 'Planifié' || r.treatment?.status === 'En cours') {
                treated++;
            }
        });

        // Calculate weighted risk score (0-100)
        // Max possible score per risk is 25. 
        // Normalized score = (Sum of levels / (Count * 25)) * 100
        const sumLevels = risks.reduce((acc, r) => acc + ((r.probability || 0) * (r.impact || 0)), 0);
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

        // Auto-generate recommendations based on heuristics (since we lack direct OpenAI access here)
        const recommendations: string[] = [];

        if (metrics.critical_risks > 0) {
            recommendations.push(`Prioritize immediate remediation of ${metrics.critical_risks} critical risks.`);
        }

        if (metrics.risk_score > 60) {
            recommendations.push("Overall risk exposure is high. Consider reviewing risk appetite and control effectiveness.");
        }

        if (metrics.treated_percentage < 50) {
            recommendations.push("Accelerate implementation of risk treatment plans to improve coverage.");
        }

        if (metrics.low_risks > metrics.high_risks * 3) {
            recommendations.push("Review low-priority risks to ensure they aren't incorrectly classified.");
        }

        // Sort risks by severity for "Top Risks"
        const topRisks = [...risks]
            .sort((a, b) => ((b.probability || 0) * (b.impact || 0)) - ((a.probability || 0) * (a.impact || 0)))
            .slice(0, 5);

        // Mock trend analysis (would be real if we had historical data)
        // Assuming some randomization for demo purposes if dates aren't available, 
        // but using created_at if possible.
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
        const status = metrics.risk_score < 30 ? "Healthy" : metrics.risk_score < 60 ? "Moderate" : "Critical";

        return `
      Executive Summary: Data Protection & Compliance Status
      
      Current Security Posture: ${status} (Score: ${100 - metrics.risk_score}/100)
      
      Overview:
      The organization is currently tracking ${metrics.total_risks} active risks, with a focus on ${metrics.critical_risks} critical items requiring immediate attention. The overall risk exposure is calculated at ${metrics.risk_score}%, indicating a ${status.toLowerCase()} level of residual risk.
      
      Key Highlights:
      • Critical Threats: ${metrics.critical_risks} (${Math.round((metrics.critical_risks / metrics.total_risks) * 100 || 0)}% of total)
      • Mitigation Progress: ${metrics.treated_percentage}% of identified risks have active treatment plans.
      • Distribution: The majority of risks fall into the ${metrics.high_risks > metrics.medium_risks ? 'High' : 'Medium'} category.

      Strategic Recommendation:
      ${metrics.critical_risks > 0
                ? "Immediate resource allocation is required to address critical vulnerabilities."
                : "Maintain current control effectiveness and continue regular monitoring."}
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
        const status = metrics.conformity_score > 85 ? "Good" : metrics.conformity_score > 60 ? "Acceptable" : "Critical";

        return `
      Executive Summary: ${auditName}
      
      Conformity Assessment: ${status} (Score: ${metrics.conformity_score}/100)
      
      Overview:
      This audit identified a total of ${metrics.total_findings} findings. The review highlights ${metrics.major_findings} major non-conformities that represent significant deviations from the standard.
      
      Key Observations:
      • Criticality: ${metrics.major_findings} Major, ${metrics.minor_findings} Minor, ${metrics.observations} Observations.
      • Remediation Status: ${metrics.closed_findings} findings have been addressed, while ${metrics.open_findings} remain open.
      
      Strategic Recommendation:
      ${metrics.major_findings > 0
                ? "Priority must be given to closing the major non-conformities to ensure certification compliance."
                : "Focus on continuous improvement by addressing minor findings and observations."}
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
      Executive Summary: ${projectName}
      
      Status Overview:
      The project is currently at ${metrics.completion_percentage}% completion. Out of ${metrics.total_tasks} total tasks, ${metrics.completed_tasks} have been successfully delivered.
      
      Risk Assessment:
      Schedule Risk is currently evaluated as ${metrics.delay_risk}. ${metrics.delay_risk === 'Critical' ? 'The project is over the due date and requires immediate intervention.' : metrics.delay_risk === 'High' ? 'There is a significant risk of missing the deadline given current progress.' : 'The project is progressing within acceptable parameters.'}
      
      Operational Components:
      The initiative involves ${metrics.in_progress_tasks} active workstreams. It is strategically linked to ${metrics.dependencies_count} other GRC elements (Risks/Controls), ensuring alignment with the broader security posture.
    `.trim();
    }
    // --- COMPLIANCE MODULE ENRICHMENT ---

    /**
     * Calculate metrics for Compliance (SoA)
     */
    static calculateComplianceMetrics(controls: Control[]): ComplianceMetrics {
        const total = controls.length;
        const implemented = controls.filter(c => c.status === 'Implémenté').length;
        const planned = controls.filter(c => c.status === 'Non commencé' || c.status === 'En cours').length;
        const notApplicable = controls.filter(c => c.status === 'Non applicable').length;
        const notStarted = controls.filter(c => c.status === 'Non commencé').length;

        const effectiveTotal = total - notApplicable;
        const coverage = effectiveTotal > 0 ? Math.round((implemented / effectiveTotal) * 100) : 0;
        const readiness = effectiveTotal > 0 ? Math.round(((implemented + planned) / effectiveTotal) * 100) : 0;

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
        const status = metrics.compliance_coverage > 80 ? "Optimized" : metrics.compliance_coverage > 50 ? "Developing" : "Initial";

        return `
      Executive Summary: ISO 27001 Compliance Status
      
      Maturity Assessment: ${status} (Coverage: ${metrics.compliance_coverage}%)
      
      Overview:
      The Information Security Management System (ISMS) currently covers ${metrics.compliance_coverage}% of the applicable security controls. A total of ${metrics.implemented_controls} controls have been fully implemented and verified.
      
      Gap Analysis:
      • Implemented: ${metrics.implemented_controls} controls providing active defense.
      • In Progress: ${metrics.planned_controls} controls are currently being deployed or treated.
      • Attention Required: ${metrics.not_started} controls have not yet been addressed.
      
      Strategic Roadmap:
      ${metrics.audit_readiness > 80
                ? "The organization is well-positioned for an external audit. Focus on evidence collection and continuous monitoring."
                : "Accelerate the implementation of planned controls to reach a minimum viable posture for certification."}
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

        // Weighted Average
        const globalScore = Math.round(
            (riskHealth * 0.30) +
            (complianceHealth * 0.30) +
            (auditHealth * 0.20) +
            (projectHealth * 0.20)
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
      Global Executive Summary: Cyber Governance Status
      
      Overall Governance Grade: ${grade} (Score: ${metrics.global_score}/100)
      
      Strategic Overview:
      The organization's global governance posture is currently rated at ${metrics.global_score}%. This score reflects a weighted assessment of Risk Management (30%), ISO 27001 Compliance (30%), Audit Results (20%), and Strategic Initiatives (20%).
      
      Key Performance Indicators:
      • Risk Resilience: ${metrics.risk_health}% - ${metrics.risk_health > 80 ? 'Robust defense posture.' : 'Requires attention to reduce exposure.'}
      • Compliance Maturity: ${metrics.compliance_health}% - ${metrics.compliance_health > 80 ? 'High alignment with ISO standards.' : 'Gaps in control implementation.'}
      • Audit Conformity: ${metrics.audit_health}% - Based on ${metrics.total_audits} recent audits.
      • Strategic Execution: ${metrics.project_health}% - Progress across ${metrics.total_projects} active initiatives.
      
      Recommendation:
      ${grade === 'A' || grade === 'B'
                ? "Maintain the current momentum. Focus on continuous improvement and emerging threats."
                : "Initiate a remediation plan focusing on the lowest performing domains to improve the overall grade."}
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
