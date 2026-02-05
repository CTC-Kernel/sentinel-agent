/**
 * ICTProviderService Tests
 * Story 35-2: ICT Risk Assessment
 *
 * Tests the risk calculation logic which is the core of Story 35-2
 */

import { describe, it, expect } from 'vitest';
import { ICTProviderService } from '../ICTProviderService';
import type { ICTProvider } from '../../types/dora';

describe('ICTProviderService - Risk Calculation', () => {
 describe('calculateOverallRisk', () => {
 it('should calculate risk for a critical provider with high concentration', () => {
 const provider: Partial<ICTProvider> = {
 category: 'critical',
 riskAssessment: {
  concentration: 80,
  substitutability: 'low',
  lastAssessment: new Date().toISOString()
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 80 * 1.5 (critical) + 20 (low substitutability) = 140, capped at 100
 expect(risk).toBe(100);
 });

 it('should calculate risk for a standard provider with low concentration', () => {
 const provider: Partial<ICTProvider> = {
 category: 'standard',
 riskAssessment: {
  concentration: 20,
  substitutability: 'high',
  lastAssessment: new Date().toISOString()
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 20 * 1.0 (standard) + 0 (high substitutability) = 20
 expect(risk).toBe(20);
 });

 it('should calculate risk for an important provider with medium values', () => {
 const provider: Partial<ICTProvider> = {
 category: 'important',
 riskAssessment: {
  concentration: 50,
  substitutability: 'medium',
  lastAssessment: new Date().toISOString()
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 50 * 1.2 (important) + 10 (medium substitutability) = 70
 expect(risk).toBe(70);
 });

 it('should handle provider without risk assessment', () => {
 const provider: Partial<ICTProvider> = {
 category: 'standard'
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 0 * 1.0 + 10 (default medium) = 10
 expect(risk).toBe(10);
 });

 it('should handle provider without category', () => {
 const provider: Partial<ICTProvider> = {
 riskAssessment: {
  concentration: 40,
  substitutability: 'high'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 40 * 1.0 (default) + 0 (high) = 40
 expect(risk).toBe(40);
 });

 it('should handle zero concentration', () => {
 const provider: Partial<ICTProvider> = {
 category: 'critical',
 riskAssessment: {
  concentration: 0,
  substitutability: 'high'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 0 * 1.5 + 0 = 0
 expect(risk).toBe(0);
 });

 it('should handle 100% concentration', () => {
 const provider: Partial<ICTProvider> = {
 category: 'critical',
 riskAssessment: {
  concentration: 100,
  substitutability: 'low'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 100 * 1.5 + 20 = 170, capped at 100
 expect(risk).toBe(100);
 });

 it('should handle undefined substitutability', () => {
 const provider: Partial<ICTProvider> = {
 category: 'standard',
 riskAssessment: {
  concentration: 50
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);

 // 50 * 1.0 + 10 (default medium) = 60
 expect(risk).toBe(60);
 });
 });

 describe('Risk Level Categories', () => {
 it('should identify high risk for concentration > 70', () => {
 const provider: Partial<ICTProvider> = {
 category: 'standard',
 riskAssessment: {
  concentration: 75
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 75 * 1.0 + 10 = 85
 expect(risk).toBeGreaterThan(70);
 });

 it('should identify high risk for critical provider with moderate concentration', () => {
 const provider: Partial<ICTProvider> = {
 category: 'critical',
 riskAssessment: {
  concentration: 55,
  substitutability: 'low'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 55 * 1.5 + 20 = 102.5, capped at 100
 expect(risk).toBe(100);
 });

 it('should identify medium risk for important provider', () => {
 const provider: Partial<ICTProvider> = {
 category: 'important',
 riskAssessment: {
  concentration: 40,
  substitutability: 'medium'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 40 * 1.2 + 10 = 58
 expect(risk).toBeGreaterThanOrEqual(40);
 expect(risk).toBeLessThanOrEqual(70);
 });

 it('should identify low risk for standard provider with low concentration', () => {
 const provider: Partial<ICTProvider> = {
 category: 'standard',
 riskAssessment: {
  concentration: 15,
  substitutability: 'high'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 15 * 1.0 + 0 = 15
 expect(risk).toBeLessThan(40);
 });
 });

 describe('Category Multipliers', () => {
 const baseConcentration = 50;

 it('should apply 1.5x multiplier for critical category', () => {
 const provider: Partial<ICTProvider> = {
 category: 'critical',
 riskAssessment: {
  concentration: baseConcentration,
  substitutability: 'high' // 0 impact
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 50 * 1.5 + 0 = 75
 expect(risk).toBe(75);
 });

 it('should apply 1.2x multiplier for important category', () => {
 const provider: Partial<ICTProvider> = {
 category: 'important',
 riskAssessment: {
  concentration: baseConcentration,
  substitutability: 'high' // 0 impact
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 50 * 1.2 + 0 = 60
 expect(risk).toBe(60);
 });

 it('should apply 1.0x multiplier for standard category', () => {
 const provider: Partial<ICTProvider> = {
 category: 'standard',
 riskAssessment: {
  concentration: baseConcentration,
  substitutability: 'high' // 0 impact
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // 50 * 1.0 + 0 = 50
 expect(risk).toBe(50);
 });
 });

 describe('Substitutability Impact', () => {
 const baseProvider: Partial<ICTProvider> = {
 category: 'standard',
 riskAssessment: {
 concentration: 0
 }
 };

 it('should add 20 points for low substitutability', () => {
 const provider = {
 ...baseProvider,
 riskAssessment: { concentration: 0, substitutability: 'low' as const }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 expect(risk).toBe(20);
 });

 it('should add 10 points for medium substitutability', () => {
 const provider = {
 ...baseProvider,
 riskAssessment: { concentration: 0, substitutability: 'medium' as const }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 expect(risk).toBe(10);
 });

 it('should add 0 points for high substitutability', () => {
 const provider = {
 ...baseProvider,
 riskAssessment: { concentration: 0, substitutability: 'high' as const }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 expect(risk).toBe(0);
 });
 });
});

describe('ICTProviderService - Edge Cases', () => {
 it('should handle completely empty provider', () => {
 const provider = {} as ICTProvider;
 const risk = ICTProviderService.calculateOverallRisk(provider);
 // Should use all defaults: 0 * 1.0 + 10 = 10
 expect(risk).toBe(10);
 });

 it('should handle null-like values gracefully', () => {
 const provider: Partial<ICTProvider> = {
 category: undefined,
 riskAssessment: undefined
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 // Should use defaults
 expect(risk).toBeGreaterThanOrEqual(0);
 expect(risk).toBeLessThanOrEqual(100);
 });

 it('should never exceed 100', () => {
 const provider: Partial<ICTProvider> = {
 category: 'critical',
 riskAssessment: {
 concentration: 200, // Invalid but should be handled
 substitutability: 'low'
 }
 };

 const risk = ICTProviderService.calculateOverallRisk(provider as ICTProvider);
 expect(risk).toBeLessThanOrEqual(100);
 });
});
