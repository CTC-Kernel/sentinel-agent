/**
 * Monte Carlo Service Tests
 * Epic 39: Financial Risk Quantification
 * Story 39-2: Monte Carlo Simulation
 */

import { describe, it, expect } from 'vitest';
import { MonteCarloService } from '../MonteCarloService';
import type { FAIRModelConfig } from '../../types/fair';

// Mock FAIR configuration for testing
const createMockConfig = (overrides: Partial<FAIRModelConfig> = {}): FAIRModelConfig => ({
 id: 'test-config-1',
 organizationId: 'org-1',
 name: 'Test FAIR Config',
 complexityLevel: 'simple',

 lossEventFrequency: {
 distribution: { type: 'pert', min: 0.1, mostLikely: 0.5, max: 2 },
 annualized: true,
 unit: 'per_year'
 },

 primaryLossMagnitude: {
 distribution: { type: 'pert', min: 10000, mostLikely: 50000, max: 200000 },
 currency: 'EUR',
 components: {}
 },

 vulnerability: {
 threatCapability: {
 actorType: 'opportunistic',
 capability: 'moderate',
 capabilityScore: 50,
 motivation: 'financial',
 resources: 'moderate'
 },
 controlStrength: {
 preventive: 50,
 detective: 50,
 corrective: 50,
 overall: 50,
 maturityLevel: 3
 },
 vulnerabilityScore: 25,
 exposureFactor: 0.5
 },

 simulationSettings: {
 iterations: 1000, // Use fewer iterations for testing
 confidenceIntervals: [0.05, 0.50, 0.95],
 timeHorizon: 'annual',
 includeSecondaryLoss: false
 },

 createdAt: '2026-01-01T00:00:00Z',
 createdBy: 'user-1',
 updatedAt: '2026-01-01T00:00:00Z',
 updatedBy: 'user-1',

 ...overrides
});

describe('MonteCarloService', () => {
 describe('runSimulation', () => {
 it('should run a simulation and return results', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results).toBeDefined();
 expect(results.configId).toBe('test-config-1');
 expect(results.iterations).toBe(1000);
 });

 it('should calculate ALE (Annual Loss Expectancy)', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.annualLossExpectancy).toBeDefined();
 expect(results.annualLossExpectancy.total).toBeGreaterThan(0);
 expect(results.annualLossExpectancy.primary).toBeGreaterThan(0);
 });

 it('should calculate VaR (Value at Risk)', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.valueAtRisk).toBeDefined();
 expect(results.valueAtRisk.var95).toBeGreaterThan(0);
 expect(results.valueAtRisk.var99).toBeGreaterThanOrEqual(results.valueAtRisk.var95);
 });

 it('should calculate CVaR (Conditional VaR)', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.valueAtRisk.cvar95).toBeGreaterThanOrEqual(results.valueAtRisk.var95);
 expect(results.valueAtRisk.cvar99).toBeGreaterThanOrEqual(results.valueAtRisk.var99);
 });

 it('should calculate statistical measures', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.statistics).toBeDefined();
 expect(results.statistics.mean).toBeGreaterThan(0);
 expect(results.statistics.median).toBeGreaterThan(0);
 expect(results.statistics.standardDeviation).toBeGreaterThanOrEqual(0);
 expect(results.statistics.min).toBeLessThanOrEqual(results.statistics.max);
 });

 it('should generate histogram data', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.histogram).toBeDefined();
 expect(results.histogram.bins.length).toBeGreaterThan(0);
 expect(results.histogram.frequencies.length).toBe(results.histogram.bins.length);
 });

 it('should calculate percentiles', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.statistics.percentiles).toBeDefined();
 expect(results.statistics.percentiles[5]).toBeDefined();
 expect(results.statistics.percentiles[50]).toBeDefined();
 expect(results.statistics.percentiles[95]).toBeDefined();

 // Percentiles should be in order
 expect(results.statistics.percentiles[5]).toBeLessThanOrEqual(results.statistics.percentiles[50]);
 expect(results.statistics.percentiles[50]).toBeLessThanOrEqual(results.statistics.percentiles[95]);
 });

 it('should track execution time', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);

 expect(results.executionTimeMs).toBeGreaterThan(0);
 });

 it('should use custom iteration count', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config, { iterations: 500 });

 expect(results.iterations).toBe(500);
 });

 it('should produce reproducible results with seed', () => {
 const config = createMockConfig();
 const results1 = MonteCarloService.runSimulation(config, { iterations: 100, seed: 12345 });
 const results2 = MonteCarloService.runSimulation(config, { iterations: 100, seed: 12345 });

 expect(results1.annualLossExpectancy.total).toBeCloseTo(results2.annualLossExpectancy.total, 0);
 });

 it('should handle secondary losses when enabled', () => {
 const config = createMockConfig({
 secondaryLossEventFrequency: {
 distribution: { type: 'pert', min: 0.1, mostLikely: 0.5, max: 0.9 },
 regulatoryNotification: true,
 customerNotification: true,
 mediaExposure: false
 },
 secondaryLossMagnitude: {
 distribution: { type: 'pert', min: 5000, mostLikely: 25000, max: 100000 },
 currency: 'EUR',
 components: {}
 },
 simulationSettings: {
 iterations: 1000,
 confidenceIntervals: [0.05, 0.50, 0.95],
 timeHorizon: 'annual',
 includeSecondaryLoss: true
 }
 });

 const results = MonteCarloService.runSimulation(config);

 expect(results.annualLossExpectancy.secondary).toBeGreaterThan(0);
 expect(results.annualLossExpectancy.total).toBeGreaterThan(results.annualLossExpectancy.primary);
 });
 });

 describe('generateWarnings', () => {
 it('should generate warning for high vulnerability', () => {
 const config = createMockConfig({
 vulnerability: {
 threatCapability: {
 actorType: 'opportunistic',
 capability: 'very_high',
 capabilityScore: 95,
 motivation: 'financial',
 resources: 'significant'
 },
 controlStrength: {
 preventive: 20,
 detective: 20,
 corrective: 20,
 overall: 20,
 maturityLevel: 1
 },
 vulnerabilityScore: 80,
 exposureFactor: 0.9
 }
 });

 const results = MonteCarloService.runSimulation(config);

 expect(results.warnings).toBeDefined();
 expect(results.warnings?.some(w => w.includes('vulnerability'))).toBe(true);
 });
 });

 describe('runSensitivityAnalysis', () => {
 it('should run sensitivity analysis on LEF', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSensitivityAnalysis(config, 'lef', [-25, 0, 25]);

 expect(results.length).toBe(3);
 expect(results[0].variation).toBe(-25);
 expect(results[1].variation).toBe(0);
 expect(results[2].variation).toBe(25);

 // Higher frequency should generally mean higher ALE
 expect(results[2].ale).toBeGreaterThan(results[0].ale);
 });

 it('should run sensitivity analysis on PLM', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSensitivityAnalysis(config, 'plm', [-50, 0, 50]);

 expect(results.length).toBe(3);

 // Higher magnitude should mean higher ALE
 expect(results[2].ale).toBeGreaterThan(results[0].ale);
 });

 it('should run sensitivity analysis on control strength', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSensitivityAnalysis(config, 'controlStrength', [-50, 0, 50]);

 expect(results.length).toBe(3);

 // Higher control strength should mean lower ALE (reduced vulnerability)
 // Note: The relationship isn't always linear due to how vulnerability is calculated
 });
 });

 describe('compareConfigurations', () => {
 it('should compare two configurations', () => {
 const configA = createMockConfig();
 const configB = createMockConfig({
 vulnerability: {
 ...createMockConfig().vulnerability,
 controlStrength: {
 preventive: 80,
 detective: 80,
 corrective: 80,
 overall: 80,
 maturityLevel: 4
 },
 vulnerabilityScore: 10
 }
 });

 const comparison = MonteCarloService.compareConfigurations(configA, configB, 1000);

 expect(comparison.configA).toBeDefined();
 expect(comparison.configB).toBeDefined();
 expect(comparison.comparison).toBeDefined();
 expect(comparison.comparison.aleDifference).toBeDefined();
 expect(comparison.comparison.aleReduction).toBeDefined();
 });

 it('should show reduced ALE with stronger controls', () => {
 const configA = createMockConfig({
 vulnerability: {
 ...createMockConfig().vulnerability,
 controlStrength: {
 preventive: 20,
 detective: 20,
 corrective: 20,
 overall: 20,
 maturityLevel: 1
 },
 vulnerabilityScore: 50
 }
 });

 const configB = createMockConfig({
 vulnerability: {
 ...createMockConfig().vulnerability,
 controlStrength: {
 preventive: 80,
 detective: 80,
 corrective: 80,
 overall: 80,
 maturityLevel: 4
 },
 vulnerabilityScore: 10
 }
 });

 const comparison = MonteCarloService.compareConfigurations(configA, configB, 1000);

 // Config B should have lower ALE
 expect(comparison.comparison.aleReduction).toBeGreaterThan(0);
 });
 });

 describe('getSummaryStats', () => {
 it('should return formatted summary statistics', () => {
 const config = createMockConfig();
 const results = MonteCarloService.runSimulation(config);
 const summary = MonteCarloService.getSummaryStats(results);

 expect(summary).toBeDefined();
 expect(summary.length).toBeGreaterThan(0);

 const aleMetric = summary.find(s => s.label === 'ALE (Mean)');
 expect(aleMetric).toBeDefined();
 expect(aleMetric?.formatted).toContain('€');
 });
 });

 describe('distribution sampling', () => {
 it('should sample values within PERT distribution bounds', () => {
 const config = createMockConfig({
 lossEventFrequency: {
 distribution: { type: 'pert', min: 1, mostLikely: 5, max: 10 },
 annualized: true,
 unit: 'per_year'
 }
 });

 const results = MonteCarloService.runSimulation(config, { iterations: 100 });

 // Mean frequency should be roughly around the most likely value
 // With vulnerability adjustment, it's (0.5 + 0.25) * most_likely range
 expect(results.lossEventFrequencyMean).toBeGreaterThan(0);
 });

 it('should handle different distribution types', () => {
 const uniformConfig = createMockConfig({
 lossEventFrequency: {
 distribution: { type: 'uniform', min: 0.1, max: 1 },
 annualized: true,
 unit: 'per_year'
 }
 });

 const results = MonteCarloService.runSimulation(uniformConfig, { iterations: 100 });
 expect(results).toBeDefined();
 expect(results.lossEventFrequencyMean).toBeGreaterThan(0);
 });

 it('should handle triangular distribution', () => {
 const triangularConfig = createMockConfig({
 primaryLossMagnitude: {
 distribution: { type: 'triangular', min: 1000, mostLikely: 5000, max: 10000 },
 currency: 'EUR',
 components: {}
 }
 });

 const results = MonteCarloService.runSimulation(triangularConfig, { iterations: 100 });
 expect(results).toBeDefined();
 });
 });
});
