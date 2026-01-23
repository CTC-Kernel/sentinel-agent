/**
 * Voxel Anomaly Detection Cloud Function Tests
 * Epic 29: Voxel Anomaly Detection
 *
 * Tests utility functions for GRC anomaly detection
 */

// Mock firebase-admin before importing
jest.mock('firebase-admin', () => {
    const firestoreFn = jest.fn(() => ({
        collection: jest.fn(),
    }));
    firestoreFn.FieldValue = {
        serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    };
    return {
        initializeApp: jest.fn(),
        firestore: firestoreFn,
    };
});

const {
    _internal: {
        calculateSeverity,
        createAnomaly,
    },
} = require('../detectAnomalies');

describe('Voxel Anomaly Detection Functions', () => {
    describe('calculateSeverity', () => {
        describe('circular_dependency', () => {
            it('should always return critical', () => {
                expect(calculateSeverity('circular_dependency')).toBe('critical');
                expect(calculateSeverity('circular_dependency', {})).toBe('critical');
                expect(calculateSeverity('circular_dependency', { riskScore: 1 })).toBe('critical');
            });
        });

        describe('coverage_gap', () => {
            it('should return critical for high risk score (>= 15)', () => {
                expect(calculateSeverity('coverage_gap', { riskScore: 15 })).toBe('critical');
                expect(calculateSeverity('coverage_gap', { riskScore: 20 })).toBe('critical');
                expect(calculateSeverity('coverage_gap', { riskScore: 25 })).toBe('critical');
            });

            it('should return high for medium-high risk score (10-14)', () => {
                expect(calculateSeverity('coverage_gap', { riskScore: 10 })).toBe('high');
                expect(calculateSeverity('coverage_gap', { riskScore: 12 })).toBe('high');
                expect(calculateSeverity('coverage_gap', { riskScore: 14 })).toBe('high');
            });

            it('should return medium for medium risk score (5-9)', () => {
                expect(calculateSeverity('coverage_gap', { riskScore: 5 })).toBe('medium');
                expect(calculateSeverity('coverage_gap', { riskScore: 7 })).toBe('medium');
                expect(calculateSeverity('coverage_gap', { riskScore: 9 })).toBe('medium');
            });

            it('should return low for low risk score (< 5)', () => {
                expect(calculateSeverity('coverage_gap', { riskScore: 0 })).toBe('low');
                expect(calculateSeverity('coverage_gap', { riskScore: 2 })).toBe('low');
                expect(calculateSeverity('coverage_gap', { riskScore: 4 })).toBe('low');
            });

            it('should return low when no riskScore provided', () => {
                expect(calculateSeverity('coverage_gap', {})).toBe('low');
                expect(calculateSeverity('coverage_gap')).toBe('low');
            });
        });

        describe('orphan_control', () => {
            it('should always return medium', () => {
                expect(calculateSeverity('orphan_control')).toBe('medium');
                expect(calculateSeverity('orphan_control', {})).toBe('medium');
                expect(calculateSeverity('orphan_control', { someContext: 'value' })).toBe('medium');
            });
        });

        describe('stale_assessment', () => {
            it('should return critical for very stale (> 180 days)', () => {
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 181 })).toBe('critical');
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 365 })).toBe('critical');
            });

            it('should return high for moderately stale (121-180 days)', () => {
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 121 })).toBe('high');
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 150 })).toBe('high');
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 180 })).toBe('high');
            });

            it('should return medium for slightly stale (90-120 days)', () => {
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 90 })).toBe('medium');
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 100 })).toBe('medium');
                expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 120 })).toBe('medium');
            });

            it('should return medium when no daysSinceAssessment provided', () => {
                expect(calculateSeverity('stale_assessment', {})).toBe('medium');
            });
        });

        describe('compliance_drift', () => {
            it('should return critical for very low effectiveness (< 30)', () => {
                expect(calculateSeverity('compliance_drift', { actualValue: 0 })).toBe('critical');
                expect(calculateSeverity('compliance_drift', { actualValue: 15 })).toBe('critical');
                expect(calculateSeverity('compliance_drift', { actualValue: 29 })).toBe('critical');
            });

            it('should return high for low effectiveness (30-49)', () => {
                expect(calculateSeverity('compliance_drift', { actualValue: 30 })).toBe('high');
                expect(calculateSeverity('compliance_drift', { actualValue: 40 })).toBe('high');
                expect(calculateSeverity('compliance_drift', { actualValue: 49 })).toBe('high');
            });

            it('should return medium at threshold (50)', () => {
                // At exactly 50, it's no longer < 50, so medium
                expect(calculateSeverity('compliance_drift', { actualValue: 50 })).toBe('medium');
            });

            it('should return medium for higher values', () => {
                expect(calculateSeverity('compliance_drift', { actualValue: 60 })).toBe('medium');
                expect(calculateSeverity('compliance_drift', { actualValue: 80 })).toBe('medium');
            });
        });

        describe('unknown type', () => {
            it('should return medium for unknown anomaly types', () => {
                expect(calculateSeverity('unknown_type')).toBe('medium');
                expect(calculateSeverity('new_type', { someContext: true })).toBe('medium');
            });
        });
    });

    describe('createAnomaly', () => {
        it('should create anomaly with correct structure', () => {
            const result = createAnomaly(
                'orphan_control',
                'control-123',
                'Control not linked to any risk',
                { controlCode: 'CTRL-001' },
                'org-456'
            );

            expect(result).toMatchObject({
                type: 'orphan_control',
                nodeId: 'control-123',
                message: 'Control not linked to any risk',
                details: { controlCode: 'CTRL-001' },
                organizationId: 'org-456',
                status: 'active',
                detectionSource: 'server',
            });
        });

        it('should calculate severity based on type and details', () => {
            const criticalAnomaly = createAnomaly(
                'circular_dependency',
                'node-1',
                'Circular dependency detected',
                {},
                'org-1'
            );
            expect(criticalAnomaly.severity).toBe('critical');

            const coverageGap = createAnomaly(
                'coverage_gap',
                'risk-1',
                'Risk without controls',
                { riskScore: 20 },
                'org-1'
            );
            expect(coverageGap.severity).toBe('critical');

            const orphanControl = createAnomaly(
                'orphan_control',
                'ctrl-1',
                'Orphan control',
                {},
                'org-1'
            );
            expect(orphanControl.severity).toBe('medium');
        });

        it('should include detectedAt timestamp', () => {
            const result = createAnomaly('orphan_control', 'id', 'msg', {}, 'org');

            expect(result.detectedAt).toBe('SERVER_TIMESTAMP');
        });

        it('should set status to active', () => {
            const result = createAnomaly('orphan_control', 'id', 'msg', {}, 'org');

            expect(result.status).toBe('active');
        });

        it('should set detectionSource to server', () => {
            const result = createAnomaly('orphan_control', 'id', 'msg', {}, 'org');

            expect(result.detectionSource).toBe('server');
        });

        it('should handle empty details', () => {
            const result = createAnomaly('stale_assessment', 'id', 'msg', {}, 'org');

            expect(result.details).toEqual({});
        });

        it('should preserve complex details', () => {
            const details = {
                riskScore: 15,
                affectedAssets: ['asset-1', 'asset-2'],
                controlEffectiveness: 45,
                metadata: { source: 'audit', date: '2024-01-15' },
            };

            const result = createAnomaly('coverage_gap', 'id', 'msg', details, 'org');

            expect(result.details).toEqual(details);
        });
    });

    describe('Anomaly Type Coverage', () => {
        const anomalyTypes = [
            'orphan_control',
            'coverage_gap',
            'stale_assessment',
            'circular_dependency',
            'compliance_drift',
        ];

        it('should handle all documented anomaly types', () => {
            anomalyTypes.forEach(type => {
                const severity = calculateSeverity(type, {});
                expect(['low', 'medium', 'high', 'critical']).toContain(severity);
            });
        });

        it('should create valid anomalies for all types', () => {
            anomalyTypes.forEach(type => {
                const anomaly = createAnomaly(type, 'node-id', 'Test message', {}, 'org-id');

                expect(anomaly.type).toBe(type);
                expect(anomaly.nodeId).toBe('node-id');
                expect(anomaly.message).toBe('Test message');
                expect(anomaly.organizationId).toBe('org-id');
                expect(['low', 'medium', 'high', 'critical']).toContain(anomaly.severity);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined context gracefully', () => {
            expect(() => calculateSeverity('coverage_gap', undefined)).not.toThrow();
            expect(() => calculateSeverity('stale_assessment')).not.toThrow();
        });

        it('should handle negative values in context', () => {
            expect(calculateSeverity('coverage_gap', { riskScore: -5 })).toBe('low');
            expect(calculateSeverity('stale_assessment', { daysSinceAssessment: -10 })).toBe('medium');
        });

        it('should handle very large values', () => {
            expect(calculateSeverity('coverage_gap', { riskScore: 1000 })).toBe('critical');
            expect(calculateSeverity('stale_assessment', { daysSinceAssessment: 10000 })).toBe('critical');
        });

        it('should handle null values in context', () => {
            expect(calculateSeverity('coverage_gap', { riskScore: null })).toBe('low');
        });
    });
});
