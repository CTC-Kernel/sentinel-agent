/**
 * Vendor Scoring Service
 * Handles automated vendor risk scoring calculations
 * Story 37-3: Automated Vendor Scoring
 */

import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';
import { QuestionnaireSection, SupplierQuestionnaireQuestion } from '../types/business';
import { EnhancedAssessmentResponse } from '../types/vendorAssessment';
import {
  VendorScore,
  SectionScore,
  QuestionScore,
  RiskLevel,
  MitigatingFactor,
  ScoringOption,
  TemplateScoringConfig,
  VendorComparisonEntry,
  ScoringStatistics,
  getRiskLevelFromScore,
  getDisplayScore,
  scoreYesNoAnswer,
  scoreRatingAnswer,
  scoreMultipleChoiceAnswer,
  scoreTextAnswer,
  applyMitigatingFactors,
  calculateTrend,
  normalizeSectionWeights,
} from '../types/vendorScoring';
import { getTemplateById } from '../data/questionnaireTemplates';

// Collection names
const ASSESSMENTS_COLLECTION = 'questionnaire_responses';
const SCORING_CONFIG_COLLECTION = 'scoring_configurations';

export class VendorScoringService {
  // ============================================================================
  // Score Calculation
  // ============================================================================

  /**
   * Calculate and save score for an assessment
   */
  static async calculateAndSaveScore(
    assessmentId: string,
    mitigatingFactors?: MitigatingFactor[]
  ): Promise<VendorScore> {
    try {
      // Get assessment
      const assessmentRef = doc(db, ASSESSMENTS_COLLECTION, assessmentId);
      const assessmentSnap = await getDoc(assessmentRef);

      if (!assessmentSnap.exists()) {
        throw new Error('Assessment not found');
      }

      const assessment = {
        id: assessmentSnap.id,
        ...assessmentSnap.data(),
      } as EnhancedAssessmentResponse;

      // Calculate score
      const score = await this.calculateAssessmentScore(assessment, mitigatingFactors);

      // Update assessment with score
      await updateDoc(assessmentRef, sanitizeData({
        overallScore: score.displayScore,
        riskScore: score.overallScore,
        inherentRisk: score.inherentRisk,
        residualRisk: score.residualRisk,
        scoredAt: score.calculatedAt,
      }));

      return score;
    } catch (error) {
      ErrorLogger.error(error, 'VendorScoringService.calculateAndSaveScore');
      throw error;
    }
  }

  /**
   * Calculate score for an assessment
   */
  static async calculateAssessmentScore(
    assessment: EnhancedAssessmentResponse,
    mitigatingFactors?: MitigatingFactor[]
  ): Promise<VendorScore> {
    try {
      // Get template sections
      const templateData = getTemplateById(assessment.templateId);
      if (!templateData) {
        throw new Error(`Template not found: ${assessment.templateId}`);
      }

      const sections = templateData.sections;
      const answers = assessment.answers || {};

      // Get custom scoring configuration if exists
      const scoringConfig = await this.getScoringConfig(
        assessment.templateId,
        assessment.organizationId
      );

      // Calculate section scores
      const sectionScores = sections.map(section => {
        const sectionConfig = scoringConfig?.sections.find(s => s.sectionId === section.id);
        return this.calculateSectionScore(section, answers, sectionConfig);
      });

      // Normalize weights
      const weights = normalizeSectionWeights(sectionScores);
      sectionScores.forEach((ss, idx) => {
        ss.weight = weights[idx];
        ss.weightedScore = (ss.score * weights[idx]) / 100;
      });

      // Calculate overall score (weighted average)
      const totalWeight = sectionScores.reduce((sum, ss) => sum + ss.weight, 0);
      const weightedSum = sectionScores.reduce((sum, ss) => sum + ss.weightedScore, 0);
      const overallScore = totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100)
        : 50;

      // Calculate inherent risk (before mitigating factors)
      const inherentRisk = getRiskLevelFromScore(overallScore);

      // Calculate residual risk (after mitigating factors)
      const residualScore = mitigatingFactors
        ? applyMitigatingFactors(overallScore, mitigatingFactors)
        : overallScore;
      const residualRisk = getRiskLevelFromScore(residualScore);

      // Count totals
      const totalQuestions = sectionScores.reduce((sum, ss) => sum + ss.questionCount, 0);
      const answeredQuestions = sectionScores.reduce((sum, ss) => sum + ss.answeredCount, 0);
      const criticalIssuesCount = sectionScores.reduce((sum, ss) => sum + ss.criticalIssues, 0);

      const vendorScore: VendorScore = {
        assessmentId: assessment.id,
        supplierId: assessment.supplierId,
        supplierName: assessment.supplierName || 'Unknown',
        overallScore,
        displayScore: getDisplayScore(overallScore),
        inherentRisk,
        residualRisk,
        sectionScores,
        totalQuestions,
        answeredQuestions,
        criticalIssuesCount,
        calculatedAt: new Date().toISOString(),
        calculatedBy: 'system',
        mitigatingFactors,
      };

      return vendorScore;
    } catch (error) {
      ErrorLogger.error(error, 'VendorScoringService.calculateAssessmentScore');
      throw error;
    }
  }

  /**
   * Calculate score for a section
   */
  static calculateSectionScore(
    section: QuestionnaireSection,
    answers: Record<string, { value: unknown; comment?: string }>,
    config?: { questions: Array<{ questionId: string; isCritical: boolean; customWeight?: number; options?: ScoringOption[] }> }
  ): SectionScore {
    const questionScores: QuestionScore[] = [];
    let criticalIssues = 0;
    let answeredCount = 0;

    for (const question of section.questions) {
      const answer = answers[question.id];
      const questionConfig = config?.questions.find(q => q.questionId === question.id);

      const qScore = this.calculateQuestionScore(
        question,
        answer?.value,
        questionConfig?.isCritical ?? false,
        questionConfig?.customWeight ?? question.weight,
        questionConfig?.options
      );

      questionScores.push(qScore);

      if (answer?.value !== undefined && answer?.value !== null && answer?.value !== '') {
        answeredCount++;
      }

      // Track critical issues (critical question with poor score)
      if (qScore.isCritical && qScore.rawScore >= 60) {
        criticalIssues++;
      }
    }

    // Calculate section score (weighted average of questions)
    const totalWeight = questionScores.reduce((sum, qs) => sum + qs.weight, 0);
    const weightedSum = questionScores.reduce((sum, qs) => sum + qs.weightedScore, 0);
    const score = totalWeight > 0
      ? Math.round(weightedSum / totalWeight)
      : 50;

    return {
      sectionId: section.id,
      sectionTitle: section.title,
      score,
      weight: section.weight,
      weightedScore: (score * section.weight) / 100,
      questionCount: section.questions.length,
      answeredCount,
      criticalIssues,
      questionScores,
    };
  }

  /**
   * Calculate score for a single question
   */
  static calculateQuestionScore(
    question: SupplierQuestionnaireQuestion,
    answerValue: unknown,
    isCritical: boolean = false,
    customWeight?: number,
    scoringOptions?: ScoringOption[]
  ): QuestionScore {
    let rawScore: number;

    switch (question.type) {
      case 'yes_no':
        rawScore = scoreYesNoAnswer(answerValue);
        break;
      case 'rating':
        rawScore = scoreRatingAnswer(answerValue as number);
        break;
      case 'multiple_choice':
        // If we have custom scoring options, use them
        if (scoringOptions && scoringOptions.length > 0) {
          rawScore = scoreMultipleChoiceAnswer(answerValue as string | string[], scoringOptions);
        } else {
          // Default: first option = best, last option = worst
          const options = question.options || [];
          const optionIndex = options.indexOf(answerValue as string);
          if (optionIndex >= 0 && options.length > 1) {
            rawScore = Math.round((optionIndex / (options.length - 1)) * 100);
          } else {
            rawScore = 50;
          }
        }
        break;
      case 'text':
        rawScore = scoreTextAnswer();
        break;
      default:
        rawScore = 50;
    }

    const weight = (customWeight ?? question.weight ?? 1) * (isCritical ? 2 : 1);
    const weightedScore = rawScore * weight;

    return {
      questionId: question.id,
      questionText: question.text,
      rawScore,
      weight,
      weightedScore,
      isCritical,
      answerValue,
      answerType: question.type,
    };
  }

  // ============================================================================
  // Scoring Configuration
  // ============================================================================

  /**
   * Get scoring configuration for a template
   */
  static async getScoringConfig(
    templateId: string,
    organizationId: string
  ): Promise<TemplateScoringConfig | null> {
    try {
      const q = query(
        collection(db, SCORING_CONFIG_COLLECTION),
        where('templateId', '==', templateId),
        where('organizationId', '==', organizationId),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      return snapshot.docs[0].data() as TemplateScoringConfig;
    } catch (error) {
      ErrorLogger.error(error, 'VendorScoringService.getScoringConfig');
      return null;
    }
  }

  // ============================================================================
  // Score Comparison
  // ============================================================================

  /**
   * Get vendor comparison data for an organization
   */
  static async getVendorComparisons(
    organizationId: string,
    limitCount: number = 50
  ): Promise<VendorComparisonEntry[]> {
    try {
      const q = query(
        collection(db, ASSESSMENTS_COLLECTION),
        where('organizationId', '==', organizationId),
        where('status', 'in', ['Submitted', 'Reviewed']),
        orderBy('submittedDate', 'desc'),
        limit(limitCount * 2) // Get extra to handle grouping by supplier
      );

      const snapshot = await getDocs(q);

      // Group by supplier
      const supplierMap = new Map<string, EnhancedAssessmentResponse[]>();
      snapshot.docs.forEach(doc => {
        const assessment = { id: doc.id, ...doc.data() } as EnhancedAssessmentResponse;
        const existing = supplierMap.get(assessment.supplierId) || [];
        existing.push(assessment);
        supplierMap.set(assessment.supplierId, existing);
      });

      // Build comparison entries
      const comparisons: VendorComparisonEntry[] = [];

      for (const [supplierId, assessments] of supplierMap) {
        // Sort by date descending
        assessments.sort((a, b) =>
          new Date(b.submittedDate || b.sentDate).getTime() -
          new Date(a.submittedDate || a.sentDate).getTime()
        );

        const latest = assessments[0];
        const previous = assessments[1];

        // Calculate score for latest if not already calculated
        const latestScore = await this.getOrCalculateScore(latest);

        let previousScore: VendorScore | undefined;
        let trend: ReturnType<typeof calculateTrend> = { direction: 'stable', percentage: 0 };

        if (previous) {
          previousScore = await this.getOrCalculateScore(previous);
          trend = calculateTrend(latestScore.overallScore, previousScore.overallScore);
        }

        comparisons.push({
          supplierId,
          supplierName: latest.supplierName || 'Unknown',
          category: latest.framework,
          latestScore,
          previousScore,
          scoreTrend: trend.direction,
          trendPercentage: trend.percentage,
          assessmentCount: assessments.length,
          lastAssessedAt: latest.submittedDate || latest.sentDate,
        });
      }

      // Sort by risk (highest risk first)
      comparisons.sort((a, b) => b.latestScore.overallScore - a.latestScore.overallScore);

      return comparisons.slice(0, limitCount);
    } catch (error) {
      ErrorLogger.error(error, 'VendorScoringService.getVendorComparisons');
      throw error;
    }
  }

  /**
   * Get or calculate score for an assessment
   */
  private static async getOrCalculateScore(
    assessment: EnhancedAssessmentResponse
  ): Promise<VendorScore> {
    // If score already calculated and stored
    if (assessment.overallScore !== undefined && assessment.submittedDate) {
      // FIX: Use nullish coalescing (??) instead of || to preserve riskScore of 0
      const storedRiskScore = (assessment as { riskScore?: number }).riskScore;
      const computedRiskScore = storedRiskScore ?? (100 - assessment.overallScore);

      return {
        assessmentId: assessment.id,
        supplierId: assessment.supplierId,
        supplierName: assessment.supplierName || 'Unknown',
        overallScore: computedRiskScore,
        displayScore: assessment.overallScore,
        inherentRisk: (assessment as { inherentRisk?: RiskLevel }).inherentRisk ?? getRiskLevelFromScore(computedRiskScore),
        residualRisk: (assessment as { residualRisk?: RiskLevel }).residualRisk ?? getRiskLevelFromScore(computedRiskScore),
        sectionScores: [],
        totalQuestions: 0,
        answeredQuestions: Object.keys(assessment.answers || {}).length,
        criticalIssuesCount: 0,
        calculatedAt: assessment.submittedDate || assessment.reviewedDate || new Date().toISOString(),
        calculatedBy: 'system',
      };
    }

    // Calculate fresh
    return this.calculateAssessmentScore(assessment);
  }

  /**
   * Get scoring statistics for an organization
   */
  static async getScoringStatistics(organizationId: string): Promise<ScoringStatistics> {
    try {
      const comparisons = await this.getVendorComparisons(organizationId, 100);

      if (comparisons.length === 0) {
        return {
          organizationId,
          averageScore: 0,
          medianScore: 0,
          vendorCount: 0,
          byRiskLevel: { Low: 0, Medium: 0, High: 0, Critical: 0 },
          byCategory: {},
          topRisks: [],
          recentImprovements: [],
        };
      }

      // Calculate statistics
      const scores = comparisons.map(c => c.latestScore.displayScore);
      const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

      const sortedScores = [...scores].sort((a, b) => a - b);
      const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];

      // Count by risk level
      const byRiskLevel: Record<RiskLevel, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
      comparisons.forEach(c => {
        byRiskLevel[c.latestScore.inherentRisk]++;
      });

      // Group by category
      const byCategory: Record<string, { count: number; averageScore: number }> = {};
      comparisons.forEach(c => {
        const cat = c.category || 'Other';
        if (!byCategory[cat]) {
          byCategory[cat] = { count: 0, averageScore: 0 };
        }
        byCategory[cat].count++;
        byCategory[cat].averageScore += c.latestScore.displayScore;
      });
      Object.keys(byCategory).forEach(cat => {
        byCategory[cat].averageScore = Math.round(
          byCategory[cat].averageScore / byCategory[cat].count
        );
      });

      // Top risks (highest risk scores)
      const topRisks = [...comparisons]
        .sort((a, b) => b.latestScore.overallScore - a.latestScore.overallScore)
        .slice(0, 5);

      // Recent improvements
      const recentImprovements = comparisons
        .filter(c => c.scoreTrend === 'improving')
        .sort((a, b) => b.trendPercentage - a.trendPercentage)
        .slice(0, 5);

      return {
        organizationId,
        averageScore,
        medianScore,
        vendorCount: comparisons.length,
        byRiskLevel,
        byCategory,
        topRisks,
        recentImprovements,
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorScoringService.getScoringStatistics');
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get risk level label for display
   */
  static getRiskLevelLabel(level: RiskLevel, locale: 'fr' | 'en' = 'fr'): string {
    const labels: Record<RiskLevel, Record<'fr' | 'en', string>> = {
      Low: { fr: 'Faible', en: 'Low' },
      Medium: { fr: 'Moyen', en: 'Medium' },
      High: { fr: 'Élevé', en: 'High' },
      Critical: { fr: 'Critique', en: 'Critical' },
    };
    return labels[level][locale];
  }

  /**
   * Check if a score needs attention
   */
  static needsAttention(score: VendorScore): boolean {
    return (
      score.inherentRisk === 'Critical' ||
      score.inherentRisk === 'High' ||
      score.criticalIssuesCount > 0
    );
  }

  /**
   * Get score summary text
   */
  static getScoreSummary(score: VendorScore, locale: 'fr' | 'en' = 'fr'): string {
    const messages: Record<RiskLevel, Record<'fr' | 'en', string>> = {
      Low: {
        fr: 'Ce fournisseur présente un niveau de risque faible.',
        en: 'This vendor presents a low risk level.',
      },
      Medium: {
        fr: 'Ce fournisseur présente un niveau de risque modéré nécessitant une surveillance.',
        en: 'This vendor presents a moderate risk level requiring monitoring.',
      },
      High: {
        fr: 'Ce fournisseur présente un niveau de risque élevé nécessitant une attention.',
        en: 'This vendor presents a high risk level requiring attention.',
      },
      Critical: {
        fr: 'Ce fournisseur présente un niveau de risque critique nécessitant une action immédiate.',
        en: 'This vendor presents a critical risk level requiring immediate action.',
      },
    };
    return messages[score.inherentRisk][locale];
  }
}
