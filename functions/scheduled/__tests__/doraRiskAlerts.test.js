/**
 * DORA Risk Alerts Cloud Function Tests
 * Story 35-2: ICT Risk Assessment
 */

const {
    isReassessmentDue,
    isHighRisk,
    calculateOverallRisk,
    HIGH_RISK_CONCENTRATION_THRESHOLD,
    CRITICAL_CONCENTRATION_THRESHOLD,
    REASSESSMENT_THRESHOLD_DAYS
} = require('../doraRiskAlerts');

describe('DORA Risk Alerts Functions', () => {
    describe('isReassessmentDue', () => {
        it('should return true when no lastAssessment exists', () => {
            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {}
            };

            expect(isReassessmentDue(provider)).toBe(true);
        });

        it('should return true when lastAssessment is older than threshold', () => {
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    lastAssessment: twoYearsAgo.toISOString()
                }
            };

            expect(isReassessmentDue(provider)).toBe(true);
        });

        it('should return false when lastAssessment is within threshold', () => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    lastAssessment: sixMonthsAgo.toISOString()
                }
            };

            expect(isReassessmentDue(provider)).toBe(false);
        });

        it('should handle Firestore Timestamp format', () => {
            const recentDate = new Date();
            recentDate.setMonth(recentDate.getMonth() - 3);

            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    lastAssessment: {
                        seconds: Math.floor(recentDate.getTime() / 1000)
                    }
                }
            };

            expect(isReassessmentDue(provider)).toBe(false);
        });

        it('should handle toDate() method', () => {
            const recentDate = new Date();
            recentDate.setMonth(recentDate.getMonth() - 1);

            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    lastAssessment: {
                        toDate: () => recentDate
                    }
                }
            };

            expect(isReassessmentDue(provider)).toBe(false);
        });

        it('should return true for invalid date format', () => {
            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    lastAssessment: 'invalid-date'
                }
            };

            expect(isReassessmentDue(provider)).toBe(true);
        });
    });

    describe('isHighRisk', () => {
        it('should return true when concentration exceeds threshold', () => {
            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    concentration: HIGH_RISK_CONCENTRATION_THRESHOLD + 5
                }
            };

            expect(isHighRisk(provider)).toBe(true);
        });

        it('should return true for critical provider with moderate concentration', () => {
            const provider = {
                name: 'Test Provider',
                category: 'critical',
                riskAssessment: {
                    concentration: CRITICAL_CONCENTRATION_THRESHOLD + 5
                }
            };

            expect(isHighRisk(provider)).toBe(true);
        });

        it('should return false for standard provider with low concentration', () => {
            const provider = {
                name: 'Test Provider',
                category: 'standard',
                riskAssessment: {
                    concentration: 30
                }
            };

            expect(isHighRisk(provider)).toBe(false);
        });

        it('should return false for critical provider with low concentration', () => {
            const provider = {
                name: 'Test Provider',
                category: 'critical',
                riskAssessment: {
                    concentration: 40
                }
            };

            expect(isHighRisk(provider)).toBe(false);
        });

        it('should handle missing riskAssessment', () => {
            const provider = {
                name: 'Test Provider',
                category: 'standard'
            };

            expect(isHighRisk(provider)).toBe(false);
        });

        it('should handle missing concentration', () => {
            const provider = {
                name: 'Test Provider',
                category: 'critical',
                riskAssessment: {}
            };

            expect(isHighRisk(provider)).toBe(false);
        });
    });

    describe('calculateOverallRisk', () => {
        it('should calculate risk for critical provider with low substitutability', () => {
            const provider = {
                category: 'critical',
                riskAssessment: {
                    concentration: 60,
                    substitutability: 'low'
                }
            };

            const risk = calculateOverallRisk(provider);

            // 60 * 1.5 + 20 = 110, capped at 100
            expect(risk).toBe(100);
        });

        it('should calculate risk for important provider', () => {
            const provider = {
                category: 'important',
                riskAssessment: {
                    concentration: 50,
                    substitutability: 'medium'
                }
            };

            const risk = calculateOverallRisk(provider);

            // 50 * 1.2 + 10 = 70
            expect(risk).toBe(70);
        });

        it('should calculate risk for standard provider with high substitutability', () => {
            const provider = {
                category: 'standard',
                riskAssessment: {
                    concentration: 30,
                    substitutability: 'high'
                }
            };

            const risk = calculateOverallRisk(provider);

            // 30 * 1.0 + 0 = 30
            expect(risk).toBe(30);
        });

        it('should use default values for missing fields', () => {
            const provider = {
                category: 'standard'
            };

            const risk = calculateOverallRisk(provider);

            // 0 * 1.0 + 10 (default medium) = 10
            expect(risk).toBe(10);
        });

        it('should handle unknown category', () => {
            const provider = {
                category: 'unknown',
                riskAssessment: {
                    concentration: 50,
                    substitutability: 'medium'
                }
            };

            const risk = calculateOverallRisk(provider);

            // 50 * 1.0 (default) + 10 = 60
            expect(risk).toBe(60);
        });

        it('should cap risk at 100', () => {
            const provider = {
                category: 'critical',
                riskAssessment: {
                    concentration: 100,
                    substitutability: 'low'
                }
            };

            const risk = calculateOverallRisk(provider);

            expect(risk).toBe(100);
        });

        it('should return 0 for zero concentration and high substitutability', () => {
            const provider = {
                category: 'standard',
                riskAssessment: {
                    concentration: 0,
                    substitutability: 'high'
                }
            };

            const risk = calculateOverallRisk(provider);

            expect(risk).toBe(0);
        });
    });

    describe('Thresholds', () => {
        it('should have correct HIGH_RISK_CONCENTRATION_THRESHOLD', () => {
            expect(HIGH_RISK_CONCENTRATION_THRESHOLD).toBe(70);
        });

        it('should have correct CRITICAL_CONCENTRATION_THRESHOLD', () => {
            expect(CRITICAL_CONCENTRATION_THRESHOLD).toBe(50);
        });

        it('should have correct REASSESSMENT_THRESHOLD_DAYS', () => {
            expect(REASSESSMENT_THRESHOLD_DAYS).toBe(365);
        });
    });
});
