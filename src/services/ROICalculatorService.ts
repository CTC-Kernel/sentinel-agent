/**
 * Security ROI Calculator Service
 * Epic 39: Financial Risk Quantification
 * Story 39-3: Security ROI Calculator
 *
 * Calculate Return on Security Investment (ROSI) based on FAIR analysis.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import type { SimulationResults } from '../types/fair';
import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';

// ============================================================================
// Types
// ============================================================================

/**
 * Security control investment
 */
export interface SecurityInvestment {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category: InvestmentCategory;

  // Costs
  initialCost: number; // One-time implementation cost
  annualCost: number; // Recurring annual cost (maintenance, licensing, etc.)
  implementationPeriod: number; // Months to implement

  // Expected impact
  expectedControlImprovement: number; // 0-100 percentage increase in control strength
  affectedRiskCategories: string[]; // e.g., ['data_breach', 'ransomware']

  // Timeline
  startDate?: string;
  expectedCompletionDate?: string;

  // Status
  status: InvestmentStatus;

  // Linked FAIR analyses
  linkedFairConfigs: string[];

  // Calculated ROI (populated after analysis)
  roiAnalysis?: ROIAnalysis;

  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type InvestmentCategory =
  | 'technology' // Tools, software, hardware
  | 'people' // Training, hiring, consultants
  | 'process' // Policy, procedures, frameworks
  | 'governance' // Compliance, audits, certifications
  | 'insurance' // Cyber insurance
  | 'other';

export type InvestmentStatus =
  | 'proposed'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/**
 * ROI Analysis result
 */
export interface ROIAnalysis {
  // Core metrics
  riskReductionAbsolute: number; // ALE reduction in currency
  riskReductionPercentage: number; // ALE reduction as percentage
  totalInvestmentCost: number; // Initial + (Annual * Years)
  netBenefit: number; // Risk reduction - Investment cost
  rosiPercentage: number; // (Net Benefit / Investment) * 100
  paybackPeriod: number; // Months to break even

  // Detailed breakdown
  beforeState: {
    ale: number;
    var95: number;
    controlStrength: number;
  };
  afterState: {
    ale: number;
    var95: number;
    controlStrength: number;
  };

  // Time-based analysis
  yearlyAnalysis: {
    year: number;
    cumulativeCost: number;
    cumulativeRiskReduction: number;
    netPosition: number;
  }[];

  // Risk metrics
  breakEvenProbability: number; // Probability of achieving positive ROI

  // Analysis metadata
  analysisDate: string;
  assumptionNotes?: string[];
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Investment comparison
 */
export interface InvestmentComparison {
  investments: {
    id: string;
    name: string;
    totalCost: number;
    riskReduction: number;
    rosi: number;
    paybackMonths: number;
    rank: number;
  }[];
  recommendations: string[];
  optimalPortfolio?: {
    investmentIds: string[];
    totalCost: number;
    totalRiskReduction: number;
    combinedRosi: number;
  };
}

// ============================================================================
// Collection Reference
// ============================================================================

const getInvestmentCollection = (organizationId: string) =>
  collection(db, 'organizations', organizationId, 'securityInvestments');

// ============================================================================
// Service
// ============================================================================

export class ROICalculatorService {
  /**
   * Get all investments for an organization
   */
  static async getInvestments(organizationId: string): Promise<SecurityInvestment[]> {
    const q = query(
      getInvestmentCollection(organizationId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as SecurityInvestment[];
  }

  /**
   * Get a specific investment
   */
  static async getInvestment(
    organizationId: string,
    investmentId: string
  ): Promise<SecurityInvestment | null> {
    const docRef = doc(getInvestmentCollection(organizationId), investmentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as SecurityInvestment;
  }

  /**
   * Create a new investment
   */
  static async createInvestment(
    organizationId: string,
    userId: string,
    data: Omit<SecurityInvestment, 'id' | 'organizationId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<string> {
    const docRef = await addDoc(getInvestmentCollection(organizationId), sanitizeData({
      ...data,
      organizationId,
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }));

    return docRef.id;
  }

  /**
   * Update an investment
   */
  static async updateInvestment(
    organizationId: string,
    investmentId: string,
    userId: string,
    updates: Partial<SecurityInvestment>
  ): Promise<void> {
    const docRef = doc(getInvestmentCollection(organizationId), investmentId);
    await updateDoc(docRef, sanitizeData({
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }));
  }

  /**
   * Delete an investment
   */
  static async deleteInvestment(
    organizationId: string,
    investmentId: string
  ): Promise<void> {
    const docRef = doc(getInvestmentCollection(organizationId), investmentId);
    await deleteDoc(docRef);
  }

  // ============================================================================
  // ROI Calculation
  // ============================================================================

  /**
   * Calculate ROI for an investment based on FAIR analysis
   */
  static calculateROI(
    investment: SecurityInvestment,
    beforeSimulation: SimulationResults,
    afterSimulation: SimulationResults,
    analysisYears: number = 3
  ): ROIAnalysis {
    // Calculate risk reduction
    const aleReduction = beforeSimulation.annualLossExpectancy.total - afterSimulation.annualLossExpectancy.total;
    const aleReductionPercent = beforeSimulation.annualLossExpectancy.total > 0
      ? (aleReduction / beforeSimulation.annualLossExpectancy.total) * 100
      : 0;

    // Calculate total investment cost over analysis period
    const totalInvestmentCost = investment.initialCost + (investment.annualCost * analysisYears);

    // Calculate total risk reduction over analysis period
    const totalRiskReduction = aleReduction * analysisYears;

    // Calculate net benefit
    const netBenefit = totalRiskReduction - totalInvestmentCost;

    // Calculate ROSI percentage
    const rosiPercentage = totalInvestmentCost > 0
      ? (netBenefit / totalInvestmentCost) * 100
      : 0;

    // Calculate payback period in months
    const monthlyBenefit = aleReduction / 12;
    const paybackPeriod = monthlyBenefit > 0
      ? Math.ceil((investment.initialCost + investment.annualCost) / monthlyBenefit)
      : 999; // No payback if no benefit

    // Yearly analysis
    const yearlyAnalysis = [];
    for (let year = 1; year <= analysisYears; year++) {
      const cumulativeCost = investment.initialCost + (investment.annualCost * year);
      const cumulativeRiskReduction = aleReduction * year;
      yearlyAnalysis.push({
        year,
        cumulativeCost,
        cumulativeRiskReduction,
        netPosition: cumulativeRiskReduction - cumulativeCost
      });
    }

    // Estimate break-even probability based on confidence intervals
    // If the P5 scenario still shows positive benefit, higher confidence
    const var5Before = beforeSimulation.statistics.percentiles[5] || 0;
    const var5After = afterSimulation.statistics.percentiles[5] || 0;
    const worstCaseReduction = var5Before - var5After;
    const breakEvenProbability = worstCaseReduction > (investment.initialCost / analysisYears) ? 0.9 : 0.6;

    // Determine confidence level
    const confidence: 'low' | 'medium' | 'high' =
      aleReductionPercent > 30 ? 'high' :
      aleReductionPercent > 10 ? 'medium' : 'low';

    return {
      riskReductionAbsolute: aleReduction,
      riskReductionPercentage: aleReductionPercent,
      totalInvestmentCost,
      netBenefit,
      rosiPercentage,
      paybackPeriod,

      beforeState: {
        ale: beforeSimulation.annualLossExpectancy.total,
        var95: beforeSimulation.valueAtRisk.var95,
        controlStrength: 0 // Would need config to get this
      },
      afterState: {
        ale: afterSimulation.annualLossExpectancy.total,
        var95: afterSimulation.valueAtRisk.var95,
        controlStrength: 0
      },

      yearlyAnalysis,
      breakEvenProbability,
      analysisDate: new Date().toISOString(),
      confidence
    };
  }

  /**
   * Compare multiple investments
   */
  static compareInvestments(
    investments: SecurityInvestment[],
    budget?: number
  ): InvestmentComparison {
    // Filter investments with ROI analysis
    const analyzedInvestments = investments.filter(i => i.roiAnalysis);

    // Sort by ROSI
    const sorted = [...analyzedInvestments].sort((a, b) =>
      (b.roiAnalysis?.rosiPercentage || 0) - (a.roiAnalysis?.rosiPercentage || 0)
    );

    // Create comparison list
    const comparisonList = sorted.map((inv, index) => ({
      id: inv.id,
      name: inv.name,
      totalCost: inv.roiAnalysis?.totalInvestmentCost || 0,
      riskReduction: inv.roiAnalysis?.riskReductionAbsolute || 0,
      rosi: inv.roiAnalysis?.rosiPercentage || 0,
      paybackMonths: inv.roiAnalysis?.paybackPeriod || 999,
      rank: index + 1
    }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (comparisonList.length > 0) {
      const topInvestment = comparisonList[0];
      if (topInvestment.rosi > 100) {
        recommendations.push(
          `"${topInvestment.name}" offers the best return with ${topInvestment.rosi.toFixed(0)}% ROSI`
        );
      }

      // Quick wins (low cost, positive ROI)
      const quickWins = comparisonList.filter(i => i.totalCost < 50000 && i.rosi > 0);
      if (quickWins.length > 0) {
        recommendations.push(
          `${quickWins.length} quick-win investment(s) available under 50K€`
        );
      }

      // Negative ROI investments
      const negativeRoi = comparisonList.filter(i => i.rosi < 0);
      if (negativeRoi.length > 0) {
        recommendations.push(
          `${negativeRoi.length} investment(s) show negative ROSI - review justification`
        );
      }
    }

    // Calculate optimal portfolio if budget specified
    let optimalPortfolio;
    if (budget && comparisonList.length > 0) {
      // Simple greedy algorithm: select highest ROSI investments within budget
      const selected: typeof comparisonList = [];
      let remainingBudget = budget;

      for (const inv of comparisonList) {
        if (inv.rosi > 0 && inv.totalCost <= remainingBudget) {
          selected.push(inv);
          remainingBudget -= inv.totalCost;
        }
      }

      if (selected.length > 0) {
        const totalCost = selected.reduce((sum, i) => sum + i.totalCost, 0);
        const totalReduction = selected.reduce((sum, i) => sum + i.riskReduction, 0);
        const combinedRosi = totalCost > 0 ? ((totalReduction - totalCost) / totalCost) * 100 : 0;

        optimalPortfolio = {
          investmentIds: selected.map(i => i.id),
          totalCost,
          totalRiskReduction: totalReduction,
          combinedRosi
        };
      }
    }

    return {
      investments: comparisonList,
      recommendations,
      optimalPortfolio
    };
  }

  /**
   * Calculate ROSI (Return on Security Investment) formula
   * ROSI = (Risk Reduction - Cost of Investment) / Cost of Investment * 100
   */
  static calculateROSI(
    riskReductionPerYear: number,
    investmentCost: number,
    years: number = 1
  ): number {
    const totalReduction = riskReductionPerYear * years;
    if (investmentCost === 0) return 0;
    return ((totalReduction - investmentCost) / investmentCost) * 100;
  }

  /**
   * Quick estimate based on control improvement
   */
  static quickEstimate(
    currentALE: number,
    controlImprovement: number, // percentage points (e.g., 20 for 20%)
    investmentCost: number,
    annualCost: number,
    years: number = 3
  ): {
    estimatedReduction: number;
    rosi: number;
    paybackMonths: number;
  } {
    // Rough formula: Each 10% control improvement reduces ALE by ~15%
    const aleReductionFactor = (controlImprovement / 10) * 0.15;
    const estimatedAleReduction = currentALE * Math.min(aleReductionFactor, 0.8); // Cap at 80% reduction

    const totalCost = investmentCost + (annualCost * years);
    const totalReduction = estimatedAleReduction * years;
    const rosi = totalCost > 0 ? ((totalReduction - totalCost) / totalCost) * 100 : 0;

    const monthlyBenefit = estimatedAleReduction / 12;
    const paybackMonths = monthlyBenefit > 0
      ? Math.ceil((investmentCost + annualCost) / monthlyBenefit)
      : 999;

    return {
      estimatedReduction: estimatedAleReduction,
      rosi,
      paybackMonths
    };
  }

  // ============================================================================
  // Formatting Utilities
  // ============================================================================

  /**
   * Format currency
   */
  static formatCurrency(
    value: number,
    currency: 'EUR' | 'USD' | 'GBP' = 'EUR',
    locale: string = getLocaleConfig(i18n.language as SupportedLocale).intlLocale
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  /**
   * Format payback period
   */
  static formatPayback(months: number): string {
    if (months >= 999) return 'N/A';
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} an${years > 1 ? 's' : ''}`;
    return `${years} an${years > 1 ? 's' : ''} ${remainingMonths} mois`;
  }

  /**
   * Get ROSI status badge
   */
  static getROSIStatus(rosi: number): {
    label: string;
    color: string;
    recommendation: string;
  } {
    if (rosi >= 200) {
      return {
        label: 'Excellent',
        color: 'text-emerald-600 bg-emerald-100',
        recommendation: 'Highly recommended investment'
      };
    }
    if (rosi >= 100) {
      return {
        label: 'Good',
        color: 'text-green-600 bg-green-100',
        recommendation: 'Solid return on investment'
      };
    }
    if (rosi >= 50) {
      return {
        label: 'Moderate',
        color: 'text-amber-600 bg-amber-100',
        recommendation: 'Acceptable if strategic'
      };
    }
    if (rosi >= 0) {
      return {
        label: 'Low',
        color: 'text-orange-600 bg-orange-100',
        recommendation: 'Consider alternatives'
      };
    }
    return {
      label: 'Negative',
      color: 'text-red-600 bg-red-100',
      recommendation: 'Not recommended without justification'
    };
  }
}

export default ROICalculatorService;
