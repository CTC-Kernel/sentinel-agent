import { Risk } from '../types';

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
            const level = r.probability * r.impact;
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
        const sumLevels = risks.reduce((acc, r) => acc + (r.probability * r.impact), 0);
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
            .sort((a, b) => (b.probability * b.impact) - (a.probability * a.impact))
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
}
