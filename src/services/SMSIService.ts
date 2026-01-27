/**
 * SMSI Service (ISO 27003)
 * Service for SMSI maturity assessment, certification reporting, and recommendations
 *
 * Story 20.6-20.9: SMSI completion features
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { SMSIProgram, Milestone, PDCAPhase } from '../types/ebios';

// Apply autoTable plugin
(jsPDF.API as unknown as { autoTable: typeof autoTable }).autoTable = autoTable;

/**
 * Maturity level definition
 */
export interface MaturityLevel {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  color: string;
  minScore: number;
  maxScore: number;
}

/**
 * Maturity assessment result
 */
export interface MaturityAssessment {
  overall: {
    score: number;
    level: MaturityLevel;
    trend: 'up' | 'down' | 'stable';
  };
  phases: {
    plan: PhaseMaturity;
    do: PhaseMaturity;
    check: PhaseMaturity;
    act: PhaseMaturity;
  };
  dimensions: {
    governance: number;
    riskManagement: number;
    assetProtection: number;
    continuousImprovement: number;
  };
  recommendations: SMSIRecommendation[];
  generatedAt: string;
}

/**
 * Phase maturity details
 */
export interface PhaseMaturity {
  score: number;
  level: MaturityLevel;
  completedMilestones: number;
  totalMilestones: number;
  overdueMilestones: number;
  averageCompletionRate: number;
}

/**
 * SMSI Recommendation
 */
export interface SMSIRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'governance' | 'risk' | 'operations' | 'improvement' | 'documentation';
  title: string;
  description: string;
  targetPhase: PDCAPhase;
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: 'high' | 'medium' | 'low';
  linkedMilestoneIds?: string[];
}

/**
 * Certification readiness assessment
 */
export interface CertificationReadiness {
  ready: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
  strengths: string[];
  checklist: {
    item: string;
    status: 'passed' | 'failed' | 'warning' | 'not_applicable';
    details?: string;
  }[];
}

/**
 * Maturity levels definition
 */
export const MATURITY_LEVELS: MaturityLevel[] = [
  {
    level: 1,
    label: 'Initial',
    description: 'Processus ad hoc, non documentés',
    color: 'red',
    minScore: 0,
    maxScore: 20,
  },
  {
    level: 2,
    label: 'Géré',
    description: 'Processus planifiés et suivis',
    color: 'orange',
    minScore: 20,
    maxScore: 40,
  },
  {
    level: 3,
    label: 'Défini',
    description: 'Processus standardisés et documentés',
    color: 'yellow',
    minScore: 40,
    maxScore: 60,
  },
  {
    level: 4,
    label: 'Maîtrisé',
    description: 'Processus mesurés et contrôlés',
    color: 'blue',
    minScore: 60,
    maxScore: 80,
  },
  {
    level: 5,
    label: 'Optimisé',
    description: 'Amélioration continue systématique',
    color: 'green',
    minScore: 80,
    maxScore: 100,
  },
];

/**
 * SMSI Service class
 */
export class SMSIService {
  /**
   * Get maturity level from score
   */
  static getMaturityLevel(score: number): MaturityLevel {
    const level = MATURITY_LEVELS.find(
      (l) => score >= l.minScore && score < l.maxScore
    );
    return level || MATURITY_LEVELS[MATURITY_LEVELS.length - 1];
  }

  /**
   * Calculate comprehensive maturity assessment
   */
  static calculateMaturityAssessment(
    program: SMSIProgram,
    milestones: Milestone[],
    previousScore?: number
  ): MaturityAssessment {
    const phases = this.calculatePhaseMaturity(program, milestones);

    // Calculate overall score from phase scores with weights
    const weights = { plan: 0.25, do: 0.30, check: 0.25, act: 0.20 };
    const overallScore = Math.round(
      phases.plan.score * weights.plan +
      phases.do.score * weights.do +
      phases.check.score * weights.check +
      phases.act.score * weights.act
    );

    // Calculate dimension scores
    const dimensions = this.calculateDimensionScores(program, milestones);

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (previousScore !== undefined) {
      if (overallScore > previousScore + 5) trend = 'up';
      else if (overallScore < previousScore - 5) trend = 'down';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(program, milestones, phases);

    return {
      overall: {
        score: overallScore,
        level: this.getMaturityLevel(overallScore),
        trend,
      },
      phases,
      dimensions,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate maturity for each PDCA phase
   */
  private static calculatePhaseMaturity(
    program: SMSIProgram,
    milestones: Milestone[]
  ): { plan: PhaseMaturity; do: PhaseMaturity; check: PhaseMaturity; act: PhaseMaturity } {
    const phases: PDCAPhase[] = ['plan', 'do', 'check', 'act'];
    const result: Record<string, PhaseMaturity> = {};

    for (const phase of phases) {
      const phaseMilestones = milestones.filter((m) => m.phase === phase);
      const completed = phaseMilestones.filter((m) => m.status === 'completed').length;
      const overdue = phaseMilestones.filter(
        (m) => m.status !== 'completed' && new Date(m.dueDate) < new Date()
      ).length;
      const total = phaseMilestones.length;

      // Base score from completion rate
      let score = total > 0 ? (completed / total) * 100 : 0;

      // Apply phase progress from program
      const phaseProgress = program.phases[phase].progress;
      score = (score * 0.6) + (phaseProgress * 0.4);

      // Penalty for overdue milestones
      if (overdue > 0) {
        score = Math.max(0, score - (overdue * 5));
      }

      // Bonus for current/completed phase
      if (program.currentPhase === phase && phaseProgress > 50) {
        score = Math.min(100, score + 5);
      }
      if (program.phases[phase].status === 'completed') {
        score = Math.min(100, score + 10);
      }

      result[phase] = {
        score: Math.round(score),
        level: this.getMaturityLevel(score),
        completedMilestones: completed,
        totalMilestones: total,
        overdueMilestones: overdue,
        averageCompletionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    return result as { plan: PhaseMaturity; do: PhaseMaturity; check: PhaseMaturity; act: PhaseMaturity };
  }

  /**
   * Calculate dimension scores (governance, risk, etc.)
   */
  private static calculateDimensionScores(
    program: SMSIProgram,
    milestones: Milestone[]
  ): { governance: number; riskManagement: number; assetProtection: number; continuousImprovement: number } {
    // Governance: Based on Plan phase + milestones structure
    const planMilestones = milestones.filter((m) => m.phase === 'plan');
    const governance = Math.min(100,
      program.phases.plan.progress * 0.6 +
      (planMilestones.length > 0 ? 20 : 0) +
      (program.description ? 10 : 0) +
      (program.targetCertificationDate ? 10 : 0)
    );

    // Risk Management: Based on Do phase + check phase
    const riskManagement = Math.min(100,
      program.phases.do.progress * 0.5 +
      program.phases.check.progress * 0.3 +
      (milestones.filter(m => m.phase === 'do').length * 3)
    );

    // Asset Protection: Based on implementation progress
    const implementedMilestones = milestones.filter(m => m.status === 'completed').length;
    const totalMilestones = milestones.length;
    const assetProtection = totalMilestones > 0
      ? Math.round((implementedMilestones / totalMilestones) * 100)
      : 0;

    // Continuous Improvement: Based on Act phase + Check phase
    const continuousImprovement = Math.min(100,
      program.phases.act.progress * 0.6 +
      program.phases.check.progress * 0.4
    );

    return {
      governance: Math.round(governance),
      riskManagement: Math.round(riskManagement),
      assetProtection: Math.round(assetProtection),
      continuousImprovement: Math.round(continuousImprovement),
    };
  }

  /**
   * Generate automatic recommendations based on assessment
   */
  static generateRecommendations(
    program: SMSIProgram,
    milestones: Milestone[],
    phases: { plan: PhaseMaturity; do: PhaseMaturity; check: PhaseMaturity; act: PhaseMaturity }
  ): SMSIRecommendation[] {
    const recommendations: SMSIRecommendation[] = [];
    let id = 1;

    // Check for overdue milestones
    const overdueMilestones = milestones.filter(
      (m) => m.status !== 'completed' && new Date(m.dueDate) < new Date()
    );
    if (overdueMilestones.length > 0) {
      recommendations.push({
        id: `rec-${id++}`,
        priority: overdueMilestones.length > 3 ? 'critical' : 'high',
        category: 'operations',
        title: 'Jalons en retard',
        description: `${overdueMilestones.length} jalon(s) sont en retard. Priorisez leur traitement ou révisez les échéances.`,
        targetPhase: program.currentPhase,
        estimatedEffort: 'medium',
        impact: 'high',
        linkedMilestoneIds: overdueMilestones.map((m) => m.id),
      });
    }

    // Check Plan phase
    if (phases.plan.score < 60) {
      recommendations.push({
        id: `rec-${id++}`,
        priority: 'high',
        category: 'governance',
        title: 'Renforcer la phase de planification',
        description: 'La phase Plan nécessite plus d\'attention. Définissez clairement le périmètre, les responsabilités et les objectifs du SMSI.',
        targetPhase: 'plan',
        estimatedEffort: 'high',
        impact: 'high',
      });
    }

    // Check Do phase
    if (phases.do.score < 40 && program.currentPhase !== 'plan') {
      recommendations.push({
        id: `rec-${id++}`,
        priority: 'high',
        category: 'operations',
        title: 'Accélérer le déploiement',
        description: 'La phase de déploiement (Do) est en retard par rapport au planning. Vérifiez les ressources et les blocages.',
        targetPhase: 'do',
        estimatedEffort: 'high',
        impact: 'high',
      });
    }

    // Check documentation
    if (!program.description) {
      recommendations.push({
        id: `rec-${id++}`,
        priority: 'medium',
        category: 'documentation',
        title: 'Documenter le programme',
        description: 'Ajoutez une description détaillée du programme SMSI pour faciliter la communication et la certification.',
        targetPhase: 'plan',
        estimatedEffort: 'low',
        impact: 'medium',
      });
    }

    // Check certification target
    if (!program.targetCertificationDate) {
      recommendations.push({
        id: `rec-${id++}`,
        priority: 'medium',
        category: 'governance',
        title: 'Définir une date objectif de certification',
        description: 'Fixez une date cible pour la certification ISO 27001 pour orienter les efforts.',
        targetPhase: 'plan',
        estimatedEffort: 'low',
        impact: 'medium',
      });
    }

    // Continuous improvement recommendations
    if (phases.act.score < 30 && phases.check.score > 50) {
      recommendations.push({
        id: `rec-${id++}`,
        priority: 'medium',
        category: 'improvement',
        title: 'Initier l\'amélioration continue',
        description: 'La phase Check montre une bonne progression. Commencez à documenter les actions d\'amélioration (phase Act).',
        targetPhase: 'act',
        estimatedEffort: 'medium',
        impact: 'high',
      });
    }

    // Low milestone count warning
    if (milestones.length < 5) {
      recommendations.push({
        id: `rec-${id++}`,
        priority: 'medium',
        category: 'governance',
        title: 'Enrichir le planning des jalons',
        description: 'Le nombre de jalons semble insuffisant. Décomposez davantage les activités pour un meilleur suivi.',
        targetPhase: program.currentPhase,
        estimatedEffort: 'medium',
        impact: 'medium',
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Assess certification readiness
   */
  static assessCertificationReadiness(
    program: SMSIProgram,
    _milestones: Milestone[], // Reserved for future milestone-based checks
    maturity: MaturityAssessment
  ): CertificationReadiness {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const strengths: string[] = [];
    const checklist: CertificationReadiness['checklist'] = [];

    // Check overall maturity
    if (maturity.overall.score < 60) {
      blockers.push('Score de maturité global inférieur à 60%');
    } else if (maturity.overall.score >= 80) {
      strengths.push('Excellent score de maturité global');
    }

    // Check phases completion
    const phases: PDCAPhase[] = ['plan', 'do', 'check', 'act'];
    for (const phase of phases) {
      const phaseData = maturity.phases[phase];
      if (phaseData.score < 50) {
        blockers.push(`Phase ${phase.toUpperCase()} insuffisante (${phaseData.score}%)`);
      }
      if (phaseData.overdueMilestones > 0) {
        warnings.push(`${phaseData.overdueMilestones} jalon(s) en retard en phase ${phase.toUpperCase()}`);
      }
    }

    // Checklist items
    checklist.push({
      item: 'Politique de sécurité documentée',
      status: program.phases.plan.progress > 50 ? 'passed' : 'failed',
      details: program.phases.plan.progress > 50
        ? 'Phase Plan suffisamment avancée'
        : 'La phase Plan doit atteindre au moins 50%',
    });

    checklist.push({
      item: 'Analyse des risques réalisée',
      status: program.phases.do.progress > 30 ? 'passed' : 'warning',
      details: 'Basé sur la progression de la phase Do',
    });

    checklist.push({
      item: 'Mesures de sécurité implémentées',
      status: maturity.dimensions.assetProtection > 50 ? 'passed' : 'failed',
    });

    checklist.push({
      item: 'Audit interne réalisé',
      status: program.phases.check.progress > 50 ? 'passed' : 'failed',
    });

    checklist.push({
      item: 'Revue de direction effectuée',
      status: program.phases.act.progress > 30 ? 'passed' : 'warning',
    });

    checklist.push({
      item: 'Actions correctives documentées',
      status: program.phases.act.progress > 50 ? 'passed' : 'warning',
    });

    checklist.push({
      item: 'Objectif de certification défini',
      status: program.targetCertificationDate ? 'passed' : 'warning',
    });

    // Calculate readiness score
    const passedCount = checklist.filter((c) => c.status === 'passed').length;
    const score = Math.round((passedCount / checklist.length) * 100);
    const ready = blockers.length === 0 && score >= 70;

    if (ready) {
      strengths.push('Prêt pour l\'audit de certification');
    }

    return {
      ready,
      score,
      blockers,
      warnings,
      strengths,
      checklist,
    };
  }

  /**
   * Generate SMSI Certification Report PDF
   */
  static generateCertificationReport(
    program: SMSIProgram,
    _milestones: Milestone[], // Reserved for future milestone reporting
    maturity: MaturityAssessment,
    readiness: CertificationReadiness,
    options: {
      organizationName?: string;
      author?: string;
      includeRecommendations?: boolean;
    } = {}
  ): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    // ===== Cover Page =====
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 80, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport de Certification SMSI', pageWidth / 2, 35, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(program.name, pageWidth / 2, 50, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`ISO/IEC 27001:2022`, pageWidth / 2, 65, { align: 'center' });

    y = 100;
    doc.setTextColor(0, 0, 0);

    // Organization & date
    doc.setFontSize(11);
    if (options.organizationName) {
      doc.text(`Organisation: ${options.organizationName}`, 20, y);
      y += 8;
    }
    doc.text(`Date: ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`, 20, y);
    y += 8;
    if (options.author) {
      doc.text(`Auteur: ${options.author}`, 20, y);
      y += 8;
    }
    y += 10;

    // Readiness summary box
    const boxColor = readiness.ready ? [34, 197, 94] : [239, 68, 68];
    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.roundedRect(20, y, pageWidth - 40, 25, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(
      readiness.ready ? '✓ PRÊT POUR LA CERTIFICATION' : '✗ NON PRÊT - ACTIONS REQUISES',
      pageWidth / 2,
      y + 10,
      { align: 'center' }
    );
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Score: ${readiness.score}%`, pageWidth / 2, y + 18, { align: 'center' });

    y += 40;
    doc.setTextColor(0, 0, 0);

    // Maturity Overview
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Maturité du SMSI', 20, y);
    y += 10;

    // Overall maturity gauge representation
    doc.setFontSize(10);
    doc.text('Score global:', 20, y);

    // Draw gauge
    const gaugeWidth = 100;
    const gaugeHeight = 8;
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(60, y - 5, gaugeWidth, gaugeHeight, 2, 2, 'F');

    const levelColors: Record<string, [number, number, number]> = {
      red: [239, 68, 68],
      orange: [249, 115, 22],
      yellow: [234, 179, 8],
      blue: [59, 130, 246],
      green: [34, 197, 94],
    };
    const color = levelColors[maturity.overall.level.color] || [100, 100, 100];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(60, y - 5, (gaugeWidth * maturity.overall.score) / 100, gaugeHeight, 2, 2, 'F');

    doc.text(`${maturity.overall.score}% - ${maturity.overall.level.label}`, 165, y);
    y += 15;

    // Phase scores table
    doc.autoTable({
      startY: y,
      head: [['Phase', 'Score', 'Niveau', 'Jalons', 'En retard']],
      body: [
        ['Plan', `${maturity.phases.plan.score}%`, maturity.phases.plan.level.label,
         `${maturity.phases.plan.completedMilestones}/${maturity.phases.plan.totalMilestones}`,
         String(maturity.phases.plan.overdueMilestones)],
        ['Do', `${maturity.phases.do.score}%`, maturity.phases.do.level.label,
         `${maturity.phases.do.completedMilestones}/${maturity.phases.do.totalMilestones}`,
         String(maturity.phases.do.overdueMilestones)],
        ['Check', `${maturity.phases.check.score}%`, maturity.phases.check.level.label,
         `${maturity.phases.check.completedMilestones}/${maturity.phases.check.totalMilestones}`,
         String(maturity.phases.check.overdueMilestones)],
        ['Act', `${maturity.phases.act.score}%`, maturity.phases.act.level.label,
         `${maturity.phases.act.completedMilestones}/${maturity.phases.act.totalMilestones}`,
         String(maturity.phases.act.overdueMilestones)],
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      margin: { left: 20, right: 20 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // Checklist de certification - new page
    doc.addPage();
    y = 25;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Checklist de Certification', 20, y);
    y += 10;

    doc.autoTable({
      startY: y,
      head: [['Exigence', 'Statut', 'Détails']],
      body: readiness.checklist.map((item) => [
        item.item,
        item.status === 'passed' ? '✓ Conforme' :
          item.status === 'warning' ? '⚠ Attention' :
          item.status === 'failed' ? '✗ Non conforme' : 'N/A',
        item.details || '-',
      ]),
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 80 },
      },
      margin: { left: 20, right: 20 },
      didParseCell: (data: { section: string; column: { index: number }; cell: { text: string[]; styles: { textColor: number[]; fontStyle: string } } }) => {
        if (data.section === 'body' && data.column.index === 1) {
          const value = data.cell.text[0];
          if (value.includes('✓')) {
            data.cell.styles.textColor = [34, 197, 94];
            data.cell.styles.fontStyle = 'bold';
          } else if (value.includes('⚠')) {
            data.cell.styles.textColor = [234, 179, 8];
            data.cell.styles.fontStyle = 'bold';
          } else if (value.includes('✗')) {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // Blockers and warnings
    if (readiness.blockers.length > 0) {
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(20, y, pageWidth - 40, 8 + readiness.blockers.length * 6, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Points bloquants:', 25, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      readiness.blockers.forEach((b, i) => {
        doc.text(`• ${b}`, 30, y + 12 + i * 6);
      });
      y += 15 + readiness.blockers.length * 6;
    }

    if (readiness.warnings.length > 0) {
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(20, y, pageWidth - 40, 8 + readiness.warnings.length * 6, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(161, 98, 7);
      doc.text('Points d\'attention:', 25, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      readiness.warnings.forEach((w, i) => {
        doc.text(`• ${w}`, 30, y + 12 + i * 6);
      });
      y += 15 + readiness.warnings.length * 6;
    }

    // Recommendations
    if (options.includeRecommendations && maturity.recommendations.length > 0) {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 25;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommandations', 20, y);
      y += 10;

      const priorityColors: Record<string, [number, number, number]> = {
        critical: [220, 38, 38],
        high: [249, 115, 22],
        medium: [234, 179, 8],
        low: [34, 197, 94],
      };

      doc.autoTable({
        startY: y,
        head: [['Priorité', 'Recommandation', 'Phase', 'Impact']],
        body: maturity.recommendations.slice(0, 10).map((r) => [
          r.priority.toUpperCase(),
          r.title,
          r.targetPhase.toUpperCase(),
          r.impact,
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 90 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: 20, right: 20 },
        didParseCell: (data: { section: string; column: { index: number }; cell: { text: string[]; styles: { textColor: number[]; fontStyle: string } } }) => {
          if (data.section === 'body' && data.column.index === 0) {
            const priority = data.cell.text[0].toLowerCase() as keyof typeof priorityColors;
            const color = priorityColors[priority];
            if (color) {
              data.cell.styles.textColor = color;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('Rapport de Certification SMSI - Sentinel GRC', 20, pageHeight - 10);
      doc.text(format(new Date(), 'dd/MM/yyyy'), pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    return doc;
  }

  /**
   * Download SMSI Certification Report
   */
  static downloadCertificationReport(
    program: SMSIProgram,
    milestones: Milestone[],
    options: {
      organizationName?: string;
      author?: string;
      includeRecommendations?: boolean;
    } = {}
  ): void {
    const maturity = this.calculateMaturityAssessment(program, milestones);
    const readiness = this.assessCertificationReadiness(program, milestones, maturity);
    const doc = this.generateCertificationReport(program, milestones, maturity, readiness, options);
    const filename = `smsi-certification-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
  }

  /**
   * Get SMSI Certification Report as Blob
   */
  static getCertificationReportBlob(
    program: SMSIProgram,
    milestones: Milestone[]
  ): Blob {
    const maturity = this.calculateMaturityAssessment(program, milestones);
    const readiness = this.assessCertificationReadiness(program, milestones, maturity);
    const doc = this.generateCertificationReport(program, milestones, maturity, readiness, {
      includeRecommendations: true,
    });
    return doc.output('blob');
  }

  /**
   * Export maturity data as JSON for storage/comparison
   */
  static exportMaturityData(
    program: SMSIProgram,
    milestones: Milestone[]
  ): string {
    const maturity = this.calculateMaturityAssessment(program, milestones);
    const readiness = this.assessCertificationReadiness(program, milestones, maturity);

    return JSON.stringify({
      programId: program.id,
      programName: program.name,
      generatedAt: new Date().toISOString(),
      maturity,
      readiness,
    }, null, 2);
  }
}

export default SMSIService;
