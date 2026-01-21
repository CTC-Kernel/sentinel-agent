/**
 * Monte Carlo Simulation Service
 * Epic 39: Financial Risk Quantification
 * Story 39-2: Monte Carlo Simulation
 *
 * Probabilistic simulation engine for FAIR risk quantification.
 * Implements PERT, Normal, Lognormal, and Uniform distributions.
 */

import type {
  DistributionParams,
  FAIRModelConfig,
  SimulationResults,
  SimulationSettings,
  VaRResults,
  ALEBreakdown
} from '../types/fair';

// ============================================================================
// Random Number Generation
// ============================================================================

/**
 * Seeded random number generator (Mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Distribution Samplers
// ============================================================================

/**
 * Sample from uniform distribution
 */
function sampleUniform(min: number, max: number, random: () => number): number {
  return min + random() * (max - min);
}

/**
 * Sample from normal distribution using Box-Muller transform
 */
function sampleNormal(mean: number, stdDev: number, random: () => number): number {
  const u1 = random();
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/**
 * Sample from lognormal distribution
 */
function sampleLognormal(mean: number, stdDev: number, random: () => number): number {
  // Convert to log-space parameters
  const variance = stdDev * stdDev;
  const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean));
  const sigma = Math.sqrt(Math.log(1 + variance / (mean * mean)));

  return Math.exp(sampleNormal(mu, sigma, random));
}

/**
 * Sample from triangular distribution
 */
function sampleTriangular(
  min: number,
  mostLikely: number,
  max: number,
  random: () => number
): number {
  const u = random();
  const fc = (mostLikely - min) / (max - min);

  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mostLikely - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mostLikely));
  }
}

/**
 * Sample from PERT distribution (modified beta)
 */
function samplePERT(
  min: number,
  mostLikely: number,
  max: number,
  lambda: number = 4,
  random: () => number
): number {
  // PERT uses a modified beta distribution
  const range = max - min;
  if (range === 0) return min;

  // Calculate alpha and beta parameters
  const mean = (min + lambda * mostLikely + max) / (lambda + 2);
  const alpha = ((mean - min) * (2 * mostLikely - min - max)) / ((mostLikely - mean) * (max - min));

  // Handle edge cases
  if (alpha <= 0 || !isFinite(alpha)) {
    // Fall back to triangular
    return sampleTriangular(min, mostLikely, max, random);
  }

  const beta = (alpha * (max - mean)) / (mean - min);

  if (beta <= 0 || !isFinite(beta)) {
    return sampleTriangular(min, mostLikely, max, random);
  }

  // Sample from beta distribution using Jöhnk's algorithm
  const u1 = Math.pow(random(), 1 / alpha);
  const u2 = Math.pow(random(), 1 / beta);
  const sum = u1 + u2;

  if (sum <= 1) {
    return min + (u1 / sum) * range;
  } else {
    // Rejection method for beta - simplified approach
    return sampleTriangular(min, mostLikely, max, random);
  }
}

/**
 * Sample from a distribution based on parameters
 */
function sampleDistribution(params: DistributionParams, random: () => number): number {
  switch (params.type) {
    case 'uniform':
      return sampleUniform(params.min, params.max, random);

    case 'normal':
      return Math.max(
        params.min,
        Math.min(params.max, sampleNormal(params.mean || 0, params.standardDeviation || 1, random))
      );

    case 'lognormal':
      return Math.max(
        params.min,
        Math.min(params.max, sampleLognormal(params.mean || 1, params.standardDeviation || 0.5, random))
      );

    case 'triangular':
      return sampleTriangular(params.min, params.mostLikely || (params.min + params.max) / 2, params.max, random);

    case 'pert':
    default:
      return samplePERT(
        params.min,
        params.mostLikely || (params.min + params.max) / 2,
        params.max,
        4,
        random
      );
  }
}

// ============================================================================
// Statistics Calculations
// ============================================================================

/**
 * Calculate mean of array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate median of sorted array
 */
function median(sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

/**
 * Calculate mode (most frequent value, binned)
 */
function mode(values: number[], binCount: number = 50): number {
  if (values.length === 0) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / binCount;

  const bins: number[] = new Array(binCount).fill(0);
  for (const v of values) {
    const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[binIndex]++;
  }

  const maxBinIndex = bins.indexOf(Math.max(...bins));
  return min + (maxBinIndex + 0.5) * binSize;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - m, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

/**
 * Calculate skewness
 */
function skewness(values: number[]): number {
  if (values.length < 3) return 0;
  const n = values.length;
  const m = mean(values);
  const s = standardDeviation(values);
  if (s === 0) return 0;

  const sum = values.reduce((acc, v) => acc + Math.pow((v - m) / s, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/**
 * Calculate kurtosis (excess kurtosis)
 */
function kurtosis(values: number[]): number {
  if (values.length < 4) return 0;
  const n = values.length;
  const m = mean(values);
  const s = standardDeviation(values);
  if (s === 0) return 0;

  const sum = values.reduce((acc, v) => acc + Math.pow((v - m) / s, 4), 0);
  const k = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum;
  const correction = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  return k - correction;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Create histogram bins
 */
function createHistogram(values: number[], binCount: number = 50): { bins: number[]; frequencies: number[] } {
  if (values.length === 0) return { bins: [], frequencies: [] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / binCount;

  const bins: number[] = [];
  const frequencies: number[] = new Array(binCount).fill(0);

  for (let i = 0; i < binCount; i++) {
    bins.push(min + (i + 0.5) * binSize);
  }

  for (const v of values) {
    const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    frequencies[binIndex]++;
  }

  return { bins, frequencies };
}

// ============================================================================
// Monte Carlo Simulation Engine
// ============================================================================

export class MonteCarloService {
  /**
   * Run Monte Carlo simulation on FAIR configuration
   */
  static runSimulation(
    config: FAIRModelConfig,
    settings?: Partial<SimulationSettings>
  ): SimulationResults {
    const startTime = performance.now();
    const simSettings = { ...config.simulationSettings, ...settings };
    const { iterations, seed, includeSecondaryLoss } = simSettings;

    // Initialize random number generator
    const random = seed ? createSeededRandom(seed) : Math.random;

    // Arrays to store simulation results
    const lossEventFrequencies: number[] = [];
    const primaryLosses: number[] = [];
    const secondaryLosses: number[] = [];
    const totalLosses: number[] = [];

    // Run simulation iterations
    for (let i = 0; i < iterations; i++) {
      // Sample Loss Event Frequency
      let lef = sampleDistribution(config.lossEventFrequency.distribution, random);

      // Apply vulnerability factor
      const vulnerabilityFactor = config.vulnerability.vulnerabilityScore / 100;
      lef = lef * (0.5 + vulnerabilityFactor);
      lossEventFrequencies.push(lef);

      // Sample Primary Loss Magnitude
      const plm = sampleDistribution(config.primaryLossMagnitude.distribution, random);
      const primaryLoss = lef * plm;
      primaryLosses.push(primaryLoss);

      // Sample Secondary Loss if enabled
      let secondaryLoss = 0;
      if (
        includeSecondaryLoss &&
        config.secondaryLossEventFrequency &&
        config.secondaryLossMagnitude
      ) {
        const slef = sampleDistribution(config.secondaryLossEventFrequency.distribution, random);
        const slm = sampleDistribution(config.secondaryLossMagnitude.distribution, random);
        secondaryLoss = lef * slef * slm; // Secondary occurs given primary occurred
      }
      secondaryLosses.push(secondaryLoss);

      // Total loss
      totalLosses.push(primaryLoss + secondaryLoss);
    }

    // Sort for percentile calculations
    const sortedTotalLosses = [...totalLosses].sort((a, b) => a - b);
    const _sortedPrimaryLosses = [...primaryLosses].sort((a, b) => a - b);

    // Calculate ALE breakdown
    const aleBreakdown: ALEBreakdown = {
      primary: mean(primaryLosses),
      secondary: mean(secondaryLosses),
      total: mean(totalLosses),
      byComponent: {}
    };

    // Calculate VaR
    const var95 = percentile(sortedTotalLosses, 95);
    const var99 = percentile(sortedTotalLosses, 99);

    // CVaR (Conditional VaR) - average of losses above VaR
    const lossesAbove95 = sortedTotalLosses.filter((v) => v >= var95);
    const lossesAbove99 = sortedTotalLosses.filter((v) => v >= var99);

    const valueAtRisk: VaRResults = {
      var95,
      var99,
      cvar95: lossesAbove95.length > 0 ? mean(lossesAbove95) : var95,
      cvar99: lossesAbove99.length > 0 ? mean(lossesAbove99) : var99
    };

    // Calculate percentiles for confidence intervals
    const percentiles: Record<number, number> = {};
    for (const ci of simSettings.confidenceIntervals) {
      percentiles[ci * 100] = percentile(sortedTotalLosses, ci * 100);
    }

    // Create histogram
    const histogram = createHistogram(totalLosses, 50);

    const endTime = performance.now();

    // Build results
    const results: SimulationResults = {
      id: '', // Will be set when saved
      configId: config.id,
      runAt: new Date().toISOString(),

      annualLossExpectancy: aleBreakdown,
      lossEventFrequencyMean: mean(lossEventFrequencies),
      lossMagnitudeMean: mean(primaryLosses) / Math.max(mean(lossEventFrequencies), 0.001),

      valueAtRisk,

      statistics: {
        mean: mean(totalLosses),
        median: median(sortedTotalLosses),
        mode: mode(totalLosses),
        standardDeviation: standardDeviation(totalLosses),
        skewness: skewness(totalLosses),
        kurtosis: kurtosis(totalLosses),
        min: sortedTotalLosses[0] || 0,
        max: sortedTotalLosses[sortedTotalLosses.length - 1] || 0,
        percentiles
      },

      histogram,
      iterations,
      executionTimeMs: endTime - startTime,
      warnings: this.generateWarnings(config, sortedTotalLosses)
    };

    return results;
  }

  /**
   * Generate warnings for simulation results
   */
  static generateWarnings(config: FAIRModelConfig, sortedLosses: number[]): string[] {
    const warnings: string[] = [];

    // Check for high variance
    const cv = standardDeviation(sortedLosses) / mean(sortedLosses);
    if (cv > 2) {
      warnings.push('High variance in results - consider reviewing input distributions');
    }

    // Check for extreme values
    const p99 = percentile(sortedLosses, 99);
    const p50 = percentile(sortedLosses, 50);
    if (p99 > p50 * 10) {
      warnings.push('Extreme tail risk detected - 99th percentile is 10x the median');
    }

    // Check vulnerability score
    if (config.vulnerability.vulnerabilityScore > 75) {
      warnings.push('High vulnerability score - consider strengthening controls');
    }

    // Check for missing secondary loss configuration
    if (
      config.simulationSettings.includeSecondaryLoss &&
      (!config.secondaryLossEventFrequency || !config.secondaryLossMagnitude)
    ) {
      warnings.push('Secondary loss enabled but not configured');
    }

    return warnings;
  }

  /**
   * Run sensitivity analysis on a parameter
   */
  static runSensitivityAnalysis(
    config: FAIRModelConfig,
    parameter: 'lef' | 'plm' | 'controlStrength',
    variations: number[] = [-50, -25, 0, 25, 50]
  ): { variation: number; ale: number; var95: number }[] {
    const results: { variation: number; ale: number; var95: number }[] = [];

    for (const variation of variations) {
      // Clone config
      const modifiedConfig = JSON.parse(JSON.stringify(config)) as FAIRModelConfig;
      const factor = 1 + variation / 100;

      // Apply variation
      switch (parameter) {
        case 'lef':
          modifiedConfig.lossEventFrequency.distribution.min *= factor;
          modifiedConfig.lossEventFrequency.distribution.max *= factor;
          if (modifiedConfig.lossEventFrequency.distribution.mostLikely) {
            modifiedConfig.lossEventFrequency.distribution.mostLikely *= factor;
          }
          break;
        case 'plm':
          modifiedConfig.primaryLossMagnitude.distribution.min *= factor;
          modifiedConfig.primaryLossMagnitude.distribution.max *= factor;
          if (modifiedConfig.primaryLossMagnitude.distribution.mostLikely) {
            modifiedConfig.primaryLossMagnitude.distribution.mostLikely *= factor;
          }
          break;
        case 'controlStrength': {
          const newStrength = Math.max(0, Math.min(100, modifiedConfig.vulnerability.controlStrength.overall * factor));
          modifiedConfig.vulnerability.controlStrength.overall = newStrength;
          modifiedConfig.vulnerability.controlStrength.preventive = newStrength;
          modifiedConfig.vulnerability.controlStrength.detective = newStrength;
          modifiedConfig.vulnerability.controlStrength.corrective = newStrength;
          modifiedConfig.vulnerability.vulnerabilityScore = Math.max(
            0,
            modifiedConfig.vulnerability.threatCapability.capabilityScore - newStrength
          );
          break;
        }
      }

      // Run simulation with fewer iterations for speed
      const simResult = this.runSimulation(modifiedConfig, { iterations: 5000 });

      results.push({
        variation,
        ale: simResult.annualLossExpectancy.total,
        var95: simResult.valueAtRisk.var95
      });
    }

    return results;
  }

  /**
   * Compare two FAIR configurations
   */
  static compareConfigurations(
    configA: FAIRModelConfig,
    configB: FAIRModelConfig,
    iterations: number = 10000
  ): {
    configA: SimulationResults;
    configB: SimulationResults;
    comparison: {
      aleDifference: number;
      aleReduction: number;
      var95Difference: number;
      var95Reduction: number;
    };
  } {
    const resultA = this.runSimulation(configA, { iterations });
    const resultB = this.runSimulation(configB, { iterations });

    return {
      configA: resultA,
      configB: resultB,
      comparison: {
        aleDifference: resultB.annualLossExpectancy.total - resultA.annualLossExpectancy.total,
        aleReduction: resultA.annualLossExpectancy.total > 0
          ? (resultA.annualLossExpectancy.total - resultB.annualLossExpectancy.total) / resultA.annualLossExpectancy.total
          : 0,
        var95Difference: resultB.valueAtRisk.var95 - resultA.valueAtRisk.var95,
        var95Reduction: resultA.valueAtRisk.var95 > 0
          ? (resultA.valueAtRisk.var95 - resultB.valueAtRisk.var95) / resultA.valueAtRisk.var95
          : 0
      }
    };
  }

  /**
   * Get summary statistics for display
   */
  static getSummaryStats(results: SimulationResults): {
    label: string;
    value: number;
    formatted: string;
    description: string;
  }[] {
    const formatCurrency = (v: number) =>
      new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
      }).format(v);

    return [
      {
        label: 'ALE (Mean)',
        value: results.annualLossExpectancy.total,
        formatted: formatCurrency(results.annualLossExpectancy.total),
        description: 'Expected annual loss'
      },
      {
        label: 'Median Loss',
        value: results.statistics.median,
        formatted: formatCurrency(results.statistics.median),
        description: '50th percentile annual loss'
      },
      {
        label: 'VaR 95%',
        value: results.valueAtRisk.var95,
        formatted: formatCurrency(results.valueAtRisk.var95),
        description: '95% confidence worst case'
      },
      {
        label: 'VaR 99%',
        value: results.valueAtRisk.var99,
        formatted: formatCurrency(results.valueAtRisk.var99),
        description: '99% confidence worst case'
      },
      {
        label: 'CVaR 95%',
        value: results.valueAtRisk.cvar95,
        formatted: formatCurrency(results.valueAtRisk.cvar95),
        description: 'Average loss beyond VaR 95%'
      },
      {
        label: 'Standard Deviation',
        value: results.statistics.standardDeviation,
        formatted: formatCurrency(results.statistics.standardDeviation),
        description: 'Volatility of annual loss'
      }
    ];
  }
}

export default MonteCarloService;
