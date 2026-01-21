/**
 * VendorConcentrationService
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Service for calculating vendor concentration metrics,
 * identifying single points of failure, and generating
 * diversification recommendations.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import type {
  ConcentrationMetrics,
  CategoryConcentration,
  VendorSummary,
  SPOFAlert,
  SPOFSummary,
  DiversificationRecommendation,
  RecommendationsSummary,
  ConcentrationTrends,
  ConcentrationTrendPoint,
  DependencyMatrix,
  DependencyMatrixCell,
  VendorDependency,
  ConcentrationFilters,
  DependencyLevel,
  ImpactLevel,
} from '../types/vendorConcentration';
import {
  calculateHHI,
  getHHILevel,
  getDependencyLevel,
  isSPOF,
  getImpactLevel,
  getUrgencyLevel,
  getCategoryLabel,
} from '../types/vendorConcentration';

// ============================================================================
// Types
// ============================================================================

interface SupplierData {
  id: string;
  name: string;
  category?: string;
  status?: string;
  services?: string[];
  criticalServices?: string[];
  processes?: string[];
  contractValue?: number;
  contractEndDate?: string;
  lastAssessedAt?: string;
  riskScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
}

// ============================================================================
// Service Class
// ============================================================================

export class VendorConcentrationService {
  private static readonly COLLECTION = 'suppliers';
  private static readonly METRICS_COLLECTION = 'concentrationMetrics';
  private static readonly TRENDS_COLLECTION = 'concentrationTrends';

  // ==========================================================================
  // Core Metrics Calculation
  // ==========================================================================

  /**
   * Calculate concentration metrics for an organization
   */
  static async calculateConcentrationMetrics(
    organizationId: string,
    filters?: ConcentrationFilters
  ): Promise<ConcentrationMetrics> {
    try {
      // Fetch all suppliers for the organization
      const suppliers = await this.fetchSuppliers(organizationId, filters);

      // Group suppliers by category
      const categoryGroups = this.groupByCategory(suppliers);

      // Calculate category concentration
      const categoryConcentration = this.calculateCategoryConcentration(
        categoryGroups,
        suppliers.length
      );

      // Calculate overall metrics
      const totalVendors = suppliers.length;
      const activeVendors = suppliers.filter(s => s.status === 'active').length;
      const totalCategories = categoryConcentration.length;

      // Calculate SPOF count
      const spofCount = categoryConcentration.filter(c => c.hasSPOF).length;

      // Calculate high dependency count
      const highDependencyCount = this.countHighDependencyVendors(suppliers);

      // Calculate overall HHI (across all categories)
      const categoryShares = categoryConcentration.map(c => c.percentage);
      const overallHHI = calculateHHI(categoryShares);

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore(
        categoryConcentration,
        spofCount,
        highDependencyCount,
        totalVendors
      );

      const metrics: ConcentrationMetrics = {
        organizationId,
        totalVendors,
        totalCategories,
        activeVendors,
        categoryConcentration,
        spofCount,
        highDependencyCount,
        overallHHI,
        overallRiskScore,
        concentrationLevel: getHHILevel(overallHHI),
        calculatedAt: new Date().toISOString(),
      };

      // Save metrics for historical tracking
      await this.saveMetrics(organizationId, metrics);

      return metrics;
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentrationService.calculateConcentrationMetrics');
      throw error;
    }
  }

  /**
   * Group suppliers by category
   */
  private static groupByCategory(suppliers: SupplierData[]): Map<string, SupplierData[]> {
    const groups = new Map<string, SupplierData[]>();

    for (const supplier of suppliers) {
      const category = supplier.category?.toLowerCase() || 'other';
      const existing = groups.get(category) || [];
      existing.push(supplier);
      groups.set(category, existing);
    }

    return groups;
  }

  /**
   * Calculate concentration for each category
   */
  private static calculateCategoryConcentration(
    categoryGroups: Map<string, SupplierData[]>,
    totalVendors: number
  ): CategoryConcentration[] {
    const concentrations: CategoryConcentration[] = [];

    for (const [category, vendors] of categoryGroups) {
      const vendorCount = vendors.length;
      const percentage = totalVendors > 0 ? (vendorCount / totalVendors) * 100 : 0;

      // Calculate vendor shares within category for HHI
      const vendorShares = vendors.map(v => {
        const categoryTotal = vendors.reduce((sum, ven) => sum + (ven.contractValue || 1), 0);
        return ((v.contractValue || 1) / categoryTotal) * 100;
      });
      const herfindahlIndex = calculateHHI(vendorShares);

      // Find dominant vendor
      const sortedByValue = [...vendors].sort(
        (a, b) => (b.contractValue || 0) - (a.contractValue || 0)
      );
      const dominantVendor = sortedByValue[0];
      const totalValue = vendors.reduce((sum, v) => sum + (v.contractValue || 1), 0);
      const dominantShare = dominantVendor
        ? ((dominantVendor.contractValue || 1) / totalValue) * 100
        : 0;

      // Check for SPOF
      const criticalServicesCount = vendors.reduce(
        (sum, v) => sum + (v.criticalServices?.length || 0),
        0
      );
      const hasSPOF = isSPOF(vendorCount, dominantShare, criticalServicesCount);

      // Create vendor summaries
      const vendorSummaries: VendorSummary[] = vendors.map(v => ({
        supplierId: v.id,
        name: v.name,
        category: category,
        riskLevel: v.riskLevel || 'Medium',
        score: v.riskScore || 50,
        servicesCount: v.services?.length || 0,
        criticalServicesCount: v.criticalServices?.length || 0,
        contractValue: v.contractValue,
        lastAssessedAt: v.lastAssessedAt,
      }));

      concentrations.push({
        category,
        categoryLabel: getCategoryLabel(category),
        vendorCount,
        percentage,
        vendors: vendorSummaries,
        isCritical: percentage > 30 || hasSPOF,
        hasSPOF,
        herfindahlIndex,
        dominantVendor: dominantVendor
          ? {
              supplierId: dominantVendor.id,
              name: dominantVendor.name,
              category,
              riskLevel: dominantVendor.riskLevel || 'Medium',
              score: dominantVendor.riskScore || 50,
              servicesCount: dominantVendor.services?.length || 0,
              criticalServicesCount: dominantVendor.criticalServices?.length || 0,
              contractValue: dominantVendor.contractValue,
            }
          : undefined,
        dominantVendorShare: dominantShare,
      });
    }

    // Sort by concentration percentage (descending)
    return concentrations.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Count vendors with high or critical dependency
   */
  private static countHighDependencyVendors(suppliers: SupplierData[]): number {
    return suppliers.filter(s => {
      const criticalCount = s.criticalServices?.length || 0;
      const level = getDependencyLevel(s.services?.length || 0, criticalCount, 0);
      return level === 'high' || level === 'critical';
    }).length;
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private static calculateOverallRiskScore(
    categories: CategoryConcentration[],
    spofCount: number,
    highDependencyCount: number,
    totalVendors: number
  ): number {
    let score = 0;

    // SPOF penalty: 20 points per SPOF (max 60)
    score += Math.min(spofCount * 20, 60);

    // High concentration penalty
    const highConcentrationCategories = categories.filter(c => c.herfindahlIndex > 2500);
    score += Math.min(highConcentrationCategories.length * 10, 30);

    // High dependency ratio
    if (totalVendors > 0) {
      const dependencyRatio = highDependencyCount / totalVendors;
      score += dependencyRatio * 30;
    }

    // Low vendor diversity penalty
    if (totalVendors < 5) {
      score += (5 - totalVendors) * 5;
    }

    return Math.min(Math.round(score), 100);
  }

  // ==========================================================================
  // SPOF Detection
  // ==========================================================================

  /**
   * Identify all Single Points of Failure
   */
  static async identifySPOFs(organizationId: string): Promise<SPOFSummary> {
    try {
      const metrics = await this.calculateConcentrationMetrics(organizationId);
      const alerts: SPOFAlert[] = [];

      for (const category of metrics.categoryConcentration) {
        if (category.hasSPOF && category.dominantVendor) {
          const vendor = category.dominantVendor;
          const criticalCount = vendor.criticalServicesCount;
          const impactLevel = getImpactLevel(criticalCount, vendor.servicesCount);

          // Get affected services and processes from the vendor data
          const supplierData = await this.getSupplierDetails(organizationId, vendor.supplierId);

          alerts.push({
            id: `spof-${category.category}-${vendor.supplierId}`,
            category: category.category,
            categoryLabel: category.categoryLabel,
            vendor,
            impactLevel,
            affectedServices: supplierData?.services || [],
            affectedProcesses: supplierData?.processes || [],
            estimatedDowntimeRisk: this.estimateDowntimeRisk(impactLevel),
            recommendation: this.generateSPOFRecommendation(category, vendor),
            urgency: getUrgencyLevel(impactLevel),
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Sort by impact level
      const impactOrder: Record<ImpactLevel, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      alerts.sort((a, b) => impactOrder[a.impactLevel] - impactOrder[b.impactLevel]);

      return {
        totalSPOFs: alerts.length,
        criticalSPOFs: alerts.filter(a => a.impactLevel === 'critical').length,
        highImpactSPOFs: alerts.filter(a => a.impactLevel === 'high').length,
        alerts,
        topCategories: alerts.slice(0, 3).map(a => a.categoryLabel),
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentrationService.identifySPOFs');
      throw error;
    }
  }

  /**
   * Estimate downtime risk based on impact level
   */
  private static estimateDowntimeRisk(impactLevel: ImpactLevel): string {
    const risks: Record<ImpactLevel, string> = {
      critical: '> 24 hours',
      high: '4-24 hours',
      medium: '1-4 hours',
      low: '< 1 hour',
    };
    return risks[impactLevel];
  }

  /**
   * Generate recommendation for a SPOF
   */
  private static generateSPOFRecommendation(
    category: CategoryConcentration,
    vendor: VendorSummary
  ): string {
    if (category.vendorCount === 1) {
      return `Identify and onboard at least one alternative ${category.categoryLabel} provider to eliminate single vendor dependency on ${vendor.name}.`;
    }
    if (category.dominantVendorShare && category.dominantVendorShare > 80) {
      return `Redistribute services across multiple ${category.categoryLabel} providers. ${vendor.name} currently handles ${Math.round(category.dominantVendorShare)}% of this category.`;
    }
    return `Review critical service dependencies on ${vendor.name} and develop contingency plans.`;
  }

  // ==========================================================================
  // Diversification Recommendations
  // ==========================================================================

  /**
   * Generate diversification recommendations
   */
  static async generateRecommendations(
    organizationId: string
  ): Promise<RecommendationsSummary> {
    try {
      const metrics = await this.calculateConcentrationMetrics(organizationId);
      const spofs = await this.identifySPOFs(organizationId);
      const recommendations: DiversificationRecommendation[] = [];

      // Generate recommendations for each problematic category
      for (const category of metrics.categoryConcentration) {
        // High concentration recommendation
        if (category.herfindahlIndex > 2500) {
          recommendations.push(
            this.createConcentrationRecommendation(category)
          );
        }

        // SPOF recommendation
        if (category.hasSPOF) {
          const spofAlert = spofs.alerts.find(a => a.category === category.category);
          if (spofAlert) {
            recommendations.push(
              this.createSPOFRecommendation(category, spofAlert)
            );
          }
        }

        // Single vendor category
        if (category.vendorCount === 1) {
          recommendations.push(
            this.createSingleVendorRecommendation(category)
          );
        }
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Calculate total risk reduction
      const estimatedTotalRiskReduction = recommendations.reduce(
        (sum, r) => sum + r.expectedRiskReduction,
        0
      );

      return {
        totalRecommendations: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        estimatedTotalRiskReduction: Math.min(estimatedTotalRiskReduction, 100),
        recommendations,
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentrationService.generateRecommendations');
      throw error;
    }
  }

  /**
   * Create recommendation for high concentration
   */
  private static createConcentrationRecommendation(
    category: CategoryConcentration
  ): DiversificationRecommendation {
    const hhiLevel = getHHILevel(category.herfindahlIndex);
    const priority = hhiLevel === 'high' ? 'high' : 'medium';

    return {
      id: `rec-concentration-${category.category}`,
      priority,
      category: category.category,
      categoryLabel: category.categoryLabel,
      currentState: `HHI of ${Math.round(category.herfindahlIndex)} indicates ${hhiLevel} concentration`,
      targetState: 'HHI below 1500 (competitive market)',
      recommendation: `Diversify ${category.categoryLabel} providers to reduce concentration risk`,
      rationale: `High vendor concentration increases operational risk and reduces negotiating power. The ${category.categoryLabel} category has ${category.vendorCount} vendor(s) with a concentration index of ${Math.round(category.herfindahlIndex)}.`,
      expectedRiskReduction: hhiLevel === 'high' ? 15 : 10,
      estimatedEffort: 'medium',
      estimatedTimeline: '3-6 months',
      actions: [
        {
          id: `${category.category}-action-1`,
          title: 'Market research',
          description: `Identify alternative ${category.categoryLabel} providers in the market`,
          effort: 'low',
          timeline: '2-4 weeks',
        },
        {
          id: `${category.category}-action-2`,
          title: 'RFP process',
          description: 'Issue RFP to qualified alternative vendors',
          effort: 'medium',
          timeline: '1-2 months',
        },
        {
          id: `${category.category}-action-3`,
          title: 'Gradual migration',
          description: 'Migrate non-critical services first to new vendors',
          effort: 'high',
          timeline: '2-3 months',
        },
      ],
    };
  }

  /**
   * Create recommendation for SPOF
   */
  private static createSPOFRecommendation(
    category: CategoryConcentration,
    spofAlert: SPOFAlert
  ): DiversificationRecommendation {
    return {
      id: `rec-spof-${category.category}`,
      priority: spofAlert.impactLevel === 'critical' ? 'high' : 'medium',
      category: category.category,
      categoryLabel: category.categoryLabel,
      currentState: `Single point of failure: ${spofAlert.vendor.name}`,
      targetState: 'At least 2 qualified vendors for critical services',
      recommendation: spofAlert.recommendation,
      rationale: `${spofAlert.vendor.name} is a single point of failure for ${category.categoryLabel}. If this vendor experiences disruption, estimated downtime is ${spofAlert.estimatedDowntimeRisk}.`,
      expectedRiskReduction: spofAlert.impactLevel === 'critical' ? 20 : 15,
      estimatedEffort: 'high',
      estimatedTimeline: '6-12 months',
      actions: [
        {
          id: `${category.category}-spof-action-1`,
          title: 'Immediate risk assessment',
          description: 'Document all services and processes dependent on this vendor',
          effort: 'low',
          timeline: '1-2 weeks',
        },
        {
          id: `${category.category}-spof-action-2`,
          title: 'Business continuity plan',
          description: 'Develop contingency procedures in case of vendor failure',
          effort: 'medium',
          timeline: '2-4 weeks',
        },
        {
          id: `${category.category}-spof-action-3`,
          title: 'Alternative vendor qualification',
          description: 'Identify and qualify backup vendor(s)',
          effort: 'high',
          timeline: '3-6 months',
        },
      ],
      relatedSPOF: spofAlert.id,
    };
  }

  /**
   * Create recommendation for single vendor category
   */
  private static createSingleVendorRecommendation(
    category: CategoryConcentration
  ): DiversificationRecommendation {
    return {
      id: `rec-single-${category.category}`,
      priority: category.isCritical ? 'high' : 'low',
      category: category.category,
      categoryLabel: category.categoryLabel,
      currentState: `Only 1 vendor in ${category.categoryLabel}`,
      targetState: 'Minimum 2 vendors for redundancy',
      recommendation: `Add a secondary ${category.categoryLabel} provider for redundancy`,
      rationale: `Having only one vendor in the ${category.categoryLabel} category creates unnecessary risk. Even for non-critical services, vendor diversification improves resilience.`,
      expectedRiskReduction: 10,
      estimatedEffort: 'medium',
      estimatedTimeline: '3-6 months',
      actions: [
        {
          id: `${category.category}-single-action-1`,
          title: 'Needs assessment',
          description: 'Evaluate current and future needs for this category',
          effort: 'low',
          timeline: '1-2 weeks',
        },
        {
          id: `${category.category}-single-action-2`,
          title: 'Vendor selection',
          description: 'Research and select secondary vendor',
          effort: 'medium',
          timeline: '1-2 months',
        },
      ],
    };
  }

  // ==========================================================================
  // Dependency Matrix
  // ==========================================================================

  /**
   * Build dependency matrix
   */
  static async buildDependencyMatrix(
    organizationId: string
  ): Promise<DependencyMatrix> {
    try {
      const suppliers = await this.fetchSuppliers(organizationId);

      // Collect all unique services
      const servicesMap = new Map<string, { id: string; name: string; isCritical: boolean }>();
      const vendorSummaries: VendorSummary[] = [];
      const cells: DependencyMatrixCell[] = [];

      for (const supplier of suppliers) {
        const vendorSummary: VendorSummary = {
          supplierId: supplier.id,
          name: supplier.name,
          category: supplier.category || 'other',
          riskLevel: supplier.riskLevel || 'Medium',
          score: supplier.riskScore || 50,
          servicesCount: supplier.services?.length || 0,
          criticalServicesCount: supplier.criticalServices?.length || 0,
          contractValue: supplier.contractValue,
        };
        vendorSummaries.push(vendorSummary);

        // Process services
        const allServices = supplier.services || [];
        const criticalServices = new Set(supplier.criticalServices || []);

        for (const service of allServices) {
          const serviceId = service.toLowerCase().replace(/\s+/g, '-');
          const isCritical = criticalServices.has(service);

          if (!servicesMap.has(serviceId)) {
            servicesMap.set(serviceId, {
              id: serviceId,
              name: service,
              isCritical,
            });
          } else if (isCritical) {
            // Update to critical if any vendor marks it as critical
            const existing = servicesMap.get(serviceId)!;
            existing.isCritical = true;
          }

          // Create dependency cell
          const dependencyLevel = getDependencyLevel(
            allServices.length,
            supplier.criticalServices?.length || 0,
            0
          );

          cells.push({
            vendorId: supplier.id,
            vendorName: supplier.name,
            serviceId,
            serviceName: service,
            isCritical,
            dependencyLevel,
          });
        }
      }

      const services = Array.from(servicesMap.values());
      const criticalDependencies = cells.filter(c => c.isCritical).length;

      return {
        vendors: vendorSummaries,
        services,
        cells,
        totalDependencies: cells.length,
        criticalDependencies,
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentrationService.buildDependencyMatrix');
      throw error;
    }
  }

  /**
   * Get vendor dependencies list
   */
  static async getVendorDependencies(
    organizationId: string
  ): Promise<VendorDependency[]> {
    try {
      const suppliers = await this.fetchSuppliers(organizationId);
      const dependencies: VendorDependency[] = [];

      for (const supplier of suppliers) {
        const criticalCount = supplier.criticalServices?.length || 0;
        const servicesCount = supplier.services?.length || 0;
        const dependencyLevel = getDependencyLevel(servicesCount, criticalCount, 0);

        dependencies.push({
          supplierId: supplier.id,
          vendorName: supplier.name,
          category: supplier.category || 'other',
          dependencyLevel,
          servicesDependent: supplier.services || [],
          criticalServices: supplier.criticalServices || [],
          processesDependent: supplier.processes || [],
          alternativeAvailable: false, // Would need additional data
          switchingCost: this.estimateSwitchingCost(criticalCount, servicesCount),
          contractEndDate: supplier.contractEndDate,
        });
      }

      // Sort by dependency level (critical first)
      const levelOrder: Record<DependencyLevel, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      dependencies.sort((a, b) => levelOrder[a.dependencyLevel] - levelOrder[b.dependencyLevel]);

      return dependencies;
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentrationService.getVendorDependencies');
      throw error;
    }
  }

  /**
   * Estimate switching cost based on dependencies
   */
  private static estimateSwitchingCost(
    criticalCount: number,
    totalCount: number
  ): 'low' | 'medium' | 'high' {
    if (criticalCount >= 3 || totalCount >= 10) return 'high';
    if (criticalCount >= 1 || totalCount >= 5) return 'medium';
    return 'low';
  }

  // ==========================================================================
  // Trend Tracking
  // ==========================================================================

  /**
   * Get concentration trends over time
   */
  static async getConcentrationTrends(
    organizationId: string,
    period: '30d' | '90d' | '180d' | '365d' = '90d'
  ): Promise<ConcentrationTrends> {
    try {
      const daysMap = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
      const days = daysMap[period];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch historical metrics
      const trendsRef = collection(db, this.TRENDS_COLLECTION);
      const q = query(
        trendsRef,
        where('organizationId', '==', organizationId),
        where('calculatedAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('calculatedAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const overallTrend: ConcentrationTrendPoint[] = [];
      const categoryTrends: Record<string, { date: string; category: string; vendorCount: number; concentration: number }[]> = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        overallTrend.push({
          date: data.calculatedAt.toDate().toISOString(),
          vendorCount: data.totalVendors || 0,
          spofCount: data.spofCount || 0,
          hhi: data.overallHHI || 0,
          overallRisk: data.overallRiskScore || 0,
        });

        // Process category trends
        if (data.categoryConcentration) {
          for (const cat of data.categoryConcentration) {
            if (!categoryTrends[cat.category]) {
              categoryTrends[cat.category] = [];
            }
            categoryTrends[cat.category].push({
              date: data.calculatedAt.toDate().toISOString(),
              category: cat.category,
              vendorCount: cat.vendorCount,
              concentration: cat.herfindahlIndex,
            });
          }
        }
      });

      // Determine trend direction
      let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';
      let changePercentage = 0;

      if (overallTrend.length >= 2) {
        const first = overallTrend[0];
        const last = overallTrend[overallTrend.length - 1];
        const riskChange = last.overallRisk - first.overallRisk;
        changePercentage = first.overallRisk > 0
          ? Math.round((riskChange / first.overallRisk) * 100)
          : 0;

        if (riskChange < -5) trendDirection = 'improving';
        else if (riskChange > 5) trendDirection = 'worsening';
      }

      return {
        organizationId,
        period,
        overallTrend,
        categoryTrends,
        trendDirection,
        changePercentage: Math.abs(changePercentage),
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentrationService.getConcentrationTrends');
      // Return empty trends on error
      return {
        organizationId,
        period,
        overallTrend: [],
        categoryTrends: {},
        trendDirection: 'stable',
        changePercentage: 0,
      };
    }
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Fetch suppliers from Firestore
   */
  private static async fetchSuppliers(
    organizationId: string,
    filters?: ConcentrationFilters
  ): Promise<SupplierData[]> {
    const suppliersRef = collection(db, this.COLLECTION);
    let q = query(suppliersRef, where('organizationId', '==', organizationId));

    const snapshot = await getDocs(q);
    let suppliers: SupplierData[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      suppliers.push({
        id: doc.id,
        name: data.name || 'Unknown',
        category: data.category,
        status: data.status,
        services: data.services || [],
        criticalServices: data.criticalServices || [],
        processes: data.processes || [],
        contractValue: data.contractValue,
        contractEndDate: data.contractEndDate,
        lastAssessedAt: data.lastAssessedAt,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
      });
    });

    // Apply filters
    if (filters) {
      if (filters.categories?.length) {
        suppliers = suppliers.filter(s =>
          filters.categories!.includes(s.category?.toLowerCase() || 'other')
        );
      }
      if (filters.riskLevels?.length) {
        suppliers = suppliers.filter(s =>
          filters.riskLevels!.includes(s.riskLevel || 'Medium')
        );
      }
      if (filters.showSPOFOnly) {
        // This would need additional logic
      }
      if (filters.showCriticalOnly) {
        suppliers = suppliers.filter(s =>
          (s.criticalServices?.length || 0) > 0
        );
      }
    }

    return suppliers;
  }

  /**
   * Get detailed supplier data
   */
  private static async getSupplierDetails(
    organizationId: string,
    supplierId: string
  ): Promise<SupplierData | null> {
    try {
      const docRef = doc(db, this.COLLECTION, supplierId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      if (data.organizationId !== organizationId) return null;

      return {
        id: docSnap.id,
        name: data.name || 'Unknown',
        category: data.category,
        status: data.status,
        services: data.services || [],
        criticalServices: data.criticalServices || [],
        processes: data.processes || [],
        contractValue: data.contractValue,
        contractEndDate: data.contractEndDate,
        lastAssessedAt: data.lastAssessedAt,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save metrics for historical tracking
   */
  private static async saveMetrics(
    organizationId: string,
    metrics: ConcentrationMetrics
  ): Promise<void> {
    try {
      // Save to trends collection for historical tracking
      const trendId = `${organizationId}-${Date.now()}`;
      const trendRef = doc(db, this.TRENDS_COLLECTION, trendId);
      await setDoc(trendRef, {
        ...metrics,
        calculatedAt: Timestamp.now(),
      });

      // Save current metrics
      const metricsRef = doc(db, this.METRICS_COLLECTION, organizationId);
      await setDoc(metricsRef, {
        ...metrics,
        calculatedAt: Timestamp.now(),
      });
    } catch (error) {
      ErrorLogger.warn('Failed to save concentration metrics', 'VendorConcentrationService.saveMetrics');
    }
  }

  /**
   * Get cached metrics (if recent)
   */
  static async getCachedMetrics(
    organizationId: string,
    maxAgeMinutes: number = 60
  ): Promise<ConcentrationMetrics | null> {
    try {
      const metricsRef = doc(db, this.METRICS_COLLECTION, organizationId);
      const docSnap = await getDoc(metricsRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      const calculatedAt = data.calculatedAt?.toDate();

      if (!calculatedAt) return null;

      const ageMinutes = (Date.now() - calculatedAt.getTime()) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes) return null;

      return {
        organizationId: data.organizationId,
        totalVendors: data.totalVendors,
        totalCategories: data.totalCategories,
        activeVendors: data.activeVendors,
        categoryConcentration: data.categoryConcentration,
        spofCount: data.spofCount,
        highDependencyCount: data.highDependencyCount,
        overallHHI: data.overallHHI,
        overallRiskScore: data.overallRiskScore,
        concentrationLevel: data.concentrationLevel,
        calculatedAt: calculatedAt.toISOString(),
      };
    } catch {
      return null;
    }
  }
}

export default VendorConcentrationService;
