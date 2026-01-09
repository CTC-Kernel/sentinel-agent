/**
 * Tests unitaires pour RiskCalculationService
 *
 * Teste les calculs de risque selon ISO 27005
 */

import { describe, it, expect } from 'vitest';
import { RiskCalculationService, RiskLevel } from '../RiskCalculationService';
import { Risk, Control } from '../../types';

describe('RiskCalculationService', () => {
  describe('calculateScore', () => {
    it('should calculate correct risk score for valid inputs', () => {
      expect(RiskCalculationService.calculateScore(1, 1)).toBe(1);
      expect(RiskCalculationService.calculateScore(3, 3)).toBe(9);
      expect(RiskCalculationService.calculateScore(5, 5)).toBe(25);
      expect(RiskCalculationService.calculateScore(4, 5)).toBe(20);
    });

    it('should throw error for probability < 1', () => {
      expect(() => {
        RiskCalculationService.calculateScore(0, 3);
      }).toThrow('La probabilité doit être un entier entre 1 et 5');
    });

    it('should throw error for probability > 5', () => {
      expect(() => {
        RiskCalculationService.calculateScore(6, 3);
      }).toThrow('La probabilité doit être un entier entre 1 et 5');
    });

    it('should throw error for non-integer probability', () => {
      expect(() => {
        RiskCalculationService.calculateScore(2.5, 3);
      }).toThrow('La probabilité doit être un entier entre 1 et 5');
    });

    it('should throw error for impact < 1', () => {
      expect(() => {
        RiskCalculationService.calculateScore(3, 0);
      }).toThrow('L\'impact doit être un entier entre 1 et 5');
    });

    it('should throw error for impact > 5', () => {
      expect(() => {
        RiskCalculationService.calculateScore(3, 6);
      }).toThrow('L\'impact doit être un entier entre 1 et 5');
    });

    it('should throw error for non-integer impact', () => {
      expect(() => {
        RiskCalculationService.calculateScore(3, 3.7);
      }).toThrow('L\'impact doit être un entier entre 1 et 5');
    });
  });

  describe('getRiskLevel', () => {
    it('should return VERY_LOW for scores <= 4', () => {
      expect(RiskCalculationService.getRiskLevel(1)).toBe(RiskLevel.VERY_LOW);
      expect(RiskCalculationService.getRiskLevel(4)).toBe(RiskLevel.VERY_LOW);
    });

    it('should return LOW for scores 5-8', () => {
      expect(RiskCalculationService.getRiskLevel(5)).toBe(RiskLevel.LOW);
      expect(RiskCalculationService.getRiskLevel(8)).toBe(RiskLevel.LOW);
    });

    it('should return MEDIUM for scores 9-12', () => {
      expect(RiskCalculationService.getRiskLevel(9)).toBe(RiskLevel.MEDIUM);
      expect(RiskCalculationService.getRiskLevel(12)).toBe(RiskLevel.MEDIUM);
    });

    it('should return HIGH for scores 13-16', () => {
      expect(RiskCalculationService.getRiskLevel(13)).toBe(RiskLevel.HIGH);
      expect(RiskCalculationService.getRiskLevel(16)).toBe(RiskLevel.HIGH);
    });

    it('should return CRITICAL for scores > 16', () => {
      expect(RiskCalculationService.getRiskLevel(17)).toBe(RiskLevel.CRITICAL);
      expect(RiskCalculationService.getRiskLevel(25)).toBe(RiskLevel.CRITICAL);
    });

    it('should respect custom thresholds', () => {
      const customThresholds = {
        veryLow: 3,
        low: 6,
        medium: 10,
        high: 15,
        critical: 25
      };

      expect(RiskCalculationService.getRiskLevel(3, customThresholds)).toBe(RiskLevel.VERY_LOW);
      expect(RiskCalculationService.getRiskLevel(5, customThresholds)).toBe(RiskLevel.LOW);
      expect(RiskCalculationService.getRiskLevel(9, customThresholds)).toBe(RiskLevel.MEDIUM);
      expect(RiskCalculationService.getRiskLevel(14, customThresholds)).toBe(RiskLevel.HIGH);
      expect(RiskCalculationService.getRiskLevel(20, customThresholds)).toBe(RiskLevel.CRITICAL);
    });
  });

  describe('assessRisk', () => {
    it('should return complete risk assessment', () => {
      const assessment = RiskCalculationService.assessRisk(4, 5);

      expect(assessment.score).toBe(20);
      expect(assessment.level).toBe(RiskLevel.CRITICAL);
      expect(assessment.color).toBe('#dc2626');
      expect(assessment.priority).toBe(1);
      expect(assessment.requiresAction).toBe(true);
    });

    it('should not require action for low risks', () => {
      const assessment = RiskCalculationService.assessRisk(2, 2);

      expect(assessment.score).toBe(4);
      expect(assessment.level).toBe(RiskLevel.VERY_LOW);
      expect(assessment.requiresAction).toBe(false);
    });

    it('should require action for high and critical risks', () => {
      const highRisk = RiskCalculationService.assessRisk(4, 4);
      const criticalRisk = RiskCalculationService.assessRisk(5, 5);

      expect(highRisk.requiresAction).toBe(true);
      expect(criticalRisk.requiresAction).toBe(true);
    });
  });

  describe('calculateResidualRisk', () => {
    const mockRisk: Risk = {
      id: 'risk-1',
      organizationId: 'org-1',
      threat: 'Ransomware attack',
      vulnerability: 'No backup system',
      assetId: 'asset-1',
      probability: 5,
      impact: 5,
      riskLevel: 25,
      strategy: 'Atténuer',
      status: 'Ouvert',
      owner: 'RSSI',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    it('should return original risk when no controls implemented', () => {
      const result = RiskCalculationService.calculateResidualRisk(mockRisk, []);

      expect(result.probability).toBe(5);
      expect(result.impact).toBe(5);
      expect(result.score).toBe(25);
      expect(result.reduction).toBe(0);
    });

    it('should return original risk when controls not implemented', () => {
      const controls: Control[] = [
        {
          id: 'ctrl-1',
          organizationId: 'org-1',
          name: 'Backup daily',
          description: 'Daily automated backup',
          category: 'Technique',
          status: 'Planned',
          implementationStatus: 'Planifié',
          effectiveness: 'Élevée',
          owner: 'IT Team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = RiskCalculationService.calculateResidualRisk(mockRisk, controls);

      expect(result.probability).toBe(5);
      expect(result.impact).toBe(5);
      expect(result.score).toBe(25);
      expect(result.reduction).toBe(0);
    });

    it('should reduce risk with high effectiveness control', () => {
      const controls: Control[] = [
        {
          id: 'ctrl-1',
          organizationId: 'org-1',
          name: 'Backup daily',
          description: 'Daily automated backup',
          category: 'Technique',
          status: 'Active',
          implementationStatus: 'Implémenté',
          effectiveness: 'Élevée', // 70% reduction
          owner: 'IT Team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = RiskCalculationService.calculateResidualRisk(mockRisk, controls);

      expect(result.probability).toBeLessThan(mockRisk.probability);
      expect(result.impact).toBeLessThan(mockRisk.impact);
      expect(result.score).toBeLessThan(mockRisk.riskLevel);
      expect(result.reduction).toBeGreaterThan(0);
    });

    it('should apply multiple controls cumulatively', () => {
      const controls: Control[] = [
        {
          id: 'ctrl-1',
          organizationId: 'org-1',
          name: 'Daily backup',
          description: 'Automated backup',
          category: 'Technique',
          status: 'Active',
          implementationStatus: 'Implémenté',
          effectiveness: 'Élevée', // 70%
          owner: 'IT Team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'ctrl-2',
          organizationId: 'org-1',
          name: 'Antivirus',
          description: 'EDR solution',
          category: 'Technique',
          status: 'Active',
          implementationStatus: 'En place',
          effectiveness: 'Moyenne', // 40%
          owner: 'Security Team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const resultSingle = RiskCalculationService.calculateResidualRisk(mockRisk, [controls[0]]);
      const resultMultiple = RiskCalculationService.calculateResidualRisk(mockRisk, controls);

      // Multiple controls should reduce risk more
      expect(resultMultiple.score).toBeLessThan(resultSingle.score);
      expect(resultMultiple.reduction).toBeGreaterThan(resultSingle.reduction);
    });

    it('should never reduce probability or impact below 1', () => {
      const controls: Control[] = Array(10).fill(null).map((_, i) => ({
        id: `ctrl-${i}`,
        organizationId: 'org-1',
        name: `Control ${i}`,
        description: 'Super effective',
        category: 'Technique' as const,
        status: 'Active' as const,
        implementationStatus: 'Implémenté' as const,
        effectiveness: 'Élevée' as const,
        owner: 'Team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const result = RiskCalculationService.calculateResidualRisk(mockRisk, controls);

      expect(result.probability).toBeGreaterThanOrEqual(1);
      expect(result.impact).toBeGreaterThanOrEqual(1);
    });

    it('should cap reduction at 95%', () => {
      // Even with many high-effectiveness controls, reduction should not exceed 95%
      const controls: Control[] = Array(20).fill(null).map((_, i) => ({
        id: `ctrl-${i}`,
        organizationId: 'org-1',
        name: `Control ${i}`,
        description: 'Very effective',
        category: 'Technique' as const,
        status: 'Active' as const,
        implementationStatus: 'Implémenté' as const,
        effectiveness: 'Élevée' as const,
        owner: 'Team',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const result = RiskCalculationService.calculateResidualRisk(mockRisk, controls);

      // With risk of 25, 95% reduction would be 23.75, so score should be at least 1
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.reduction).toBeLessThanOrEqual(95);
    });
  });

  describe('calculateRiskMatrix', () => {
    it('should return empty 5x5 matrix for no risks', () => {
      const matrix = RiskCalculationService.calculateRiskMatrix([]);

      expect(matrix).toHaveLength(5);
      expect(matrix[0]).toHaveLength(5);
      expect(matrix.flat().every(count => count === 0)).toBe(true);
    });

    it('should count risks in correct cells', () => {
      const risks: Risk[] = [
        {
          id: '1',
          organizationId: 'org-1',
          threat: 'Threat 1',
          vulnerability: 'Vuln 1',
          assetId: 'asset-1',
          probability: 1,
          impact: 1,
          riskLevel: 1,
          strategy: 'Accepter',
          status: 'Ouvert',
          owner: 'Owner',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          organizationId: 'org-1',
          threat: 'Threat 2',
          vulnerability: 'Vuln 2',
          assetId: 'asset-2',
          probability: 5,
          impact: 5,
          riskLevel: 25,
          strategy: 'Atténuer',
          status: 'Ouvert',
          owner: 'Owner',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '3',
          organizationId: 'org-1',
          threat: 'Threat 3',
          vulnerability: 'Vuln 3',
          assetId: 'asset-3',
          probability: 3,
          impact: 3,
          riskLevel: 9,
          strategy: 'Atténuer',
          status: 'Ouvert',
          owner: 'Owner',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const matrix = RiskCalculationService.calculateRiskMatrix(risks);

      expect(matrix[0][0]).toBe(1); // Probability 1, Impact 1
      expect(matrix[4][4]).toBe(1); // Probability 5, Impact 5
      expect(matrix[2][2]).toBe(1); // Probability 3, Impact 3
    });
  });

  describe('calculateRiskStatistics', () => {
    const sampleRisks: Risk[] = [
      {
        id: '1',
        organizationId: 'org-1',
        threat: 'Low risk',
        vulnerability: 'Minor',
        assetId: 'asset-1',
        probability: 2,
        impact: 2,
        riskLevel: 4, // VERY_LOW
        strategy: 'Accepter',
        status: 'Ouvert',
        owner: 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        organizationId: 'org-1',
        threat: 'High risk',
        vulnerability: 'Critical',
        assetId: 'asset-2',
        probability: 5,
        impact: 5,
        riskLevel: 25, // CRITICAL
        strategy: 'Atténuer',
        status: 'En cours',
        owner: 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '3',
        organizationId: 'org-1',
        threat: 'Medium risk',
        vulnerability: 'Moderate',
        assetId: 'asset-3',
        probability: 3,
        impact: 3,
        riskLevel: 9, // MEDIUM
        strategy: 'Atténuer',
        status: 'Ouvert',
        owner: 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    it('should calculate correct statistics', () => {
      const stats = RiskCalculationService.calculateRiskStatistics(sampleRisks);

      expect(stats.total).toBe(3);
      expect(stats.byLevel[RiskLevel.VERY_LOW]).toBe(1);
      expect(stats.byLevel[RiskLevel.MEDIUM]).toBe(1);
      expect(stats.byLevel[RiskLevel.CRITICAL]).toBe(1);
      expect(stats.averageScore).toBe(Math.round((4 + 25 + 9) / 3));
    });

    it('should count risks by status', () => {
      const stats = RiskCalculationService.calculateRiskStatistics(sampleRisks);

      expect(stats.byStatus['Ouvert']).toBe(2);
      expect(stats.byStatus['En cours']).toBe(1);
    });

    it('should return top risks sorted by score', () => {
      const stats = RiskCalculationService.calculateRiskStatistics(sampleRisks);

      expect(stats.topRisks).toHaveLength(3);
      expect(stats.topRisks[0].riskLevel).toBe(25);
      expect(stats.topRisks[1].riskLevel).toBe(9);
      expect(stats.topRisks[2].riskLevel).toBe(4);
    });

    it('should limit top risks to 10', () => {
      const manyRisks: Risk[] = Array(20).fill(null).map((_, i) => ({
        id: `risk-${i}`,
        organizationId: 'org-1',
        threat: `Threat ${i}`,
        vulnerability: `Vuln ${i}`,
        assetId: 'asset-1',
        probability: 3,
        impact: 3,
        riskLevel: 9,
        strategy: 'Atténuer' as const,
        status: 'Ouvert' as const,
        owner: 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const stats = RiskCalculationService.calculateRiskStatistics(manyRisks);

      expect(stats.topRisks).toHaveLength(10);
    });
  });

  describe('recommendTreatmentStrategy', () => {
    it('should recommend immediate action for CRITICAL risks', () => {
      const strategies = RiskCalculationService.recommendTreatmentStrategy(RiskLevel.CRITICAL);

      expect(strategies).toContain('Atténuer');
      expect(strategies).toContain('Traitement immédiat requis');
    });

    it('should recommend mitigation or transfer for HIGH risks', () => {
      const strategies = RiskCalculationService.recommendTreatmentStrategy(RiskLevel.HIGH);

      expect(strategies).toContain('Atténuer');
      expect(strategies).toContain('Transférer');
    });

    it('should allow acceptance for LOW risks', () => {
      const strategies = RiskCalculationService.recommendTreatmentStrategy(RiskLevel.LOW);

      expect(strategies).toContain('Accepter');
    });

    it('should allow acceptance for VERY_LOW risks', () => {
      const strategies = RiskCalculationService.recommendTreatmentStrategy(RiskLevel.VERY_LOW);

      expect(strategies).toContain('Accepter');
      expect(strategies.length).toBeGreaterThan(0);
    });
  });
});
