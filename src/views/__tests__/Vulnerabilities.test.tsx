import { describe, it, expect } from 'vitest';

describe('Vulnerability Data Structure', () => {
    it('should have correct vulnerability properties', () => {
        const vulnerability = {
            id: 'vuln-1',
            cve: 'CVE-2024-1234',
            title: 'Test Vulnerability',
            description: 'A test vulnerability',
            severity: 'critical' as const,
            status: 'open' as const,
            affectedAsset: 'Server',
            discoveredDate: new Date(),
            organizationId: 'org-123'
        };

        expect(vulnerability.id).toBeDefined();
        expect(vulnerability.cve).toMatch(/^CVE-\d{4}-\d+$/);
        expect(['critical', 'high', 'medium', 'low']).toContain(vulnerability.severity);
        expect(['open', 'in_progress', 'resolved', 'closed']).toContain(vulnerability.status);
    });

    it('should calculate CVSS score correctly', () => {
        const calculateCVSS = (severity: string): number => {
            const scores: Record<string, number> = {
                critical: 9.0,
                high: 7.0,
                medium: 5.0,
                low: 3.0
            };
            return scores[severity] || 0;
        };

        expect(calculateCVSS('critical')).toBeGreaterThanOrEqual(9.0);
        expect(calculateCVSS('high')).toBeGreaterThanOrEqual(7.0);
        expect(calculateCVSS('medium')).toBeGreaterThanOrEqual(4.0);
        expect(calculateCVSS('low')).toBeGreaterThanOrEqual(0.1);
    });

    it('should prioritize vulnerabilities by severity', () => {
        const vulnerabilities = [
            { id: '1', severity: 'low' },
            { id: '2', severity: 'critical' },
            { id: '3', severity: 'medium' },
            { id: '4', severity: 'high' }
        ];

        const severityOrder: Record<string, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3
        };

        const sorted = [...vulnerabilities].sort(
            (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
        );

        expect(sorted[0].severity).toBe('critical');
        expect(sorted[1].severity).toBe('high');
        expect(sorted[2].severity).toBe('medium');
        expect(sorted[3].severity).toBe('low');
    });

    it('should validate CVE format', () => {
        const isValidCVE = (cve: string): boolean => {
            return /^CVE-\d{4}-\d{4,}$/.test(cve);
        };

        expect(isValidCVE('CVE-2024-1234')).toBe(true);
        expect(isValidCVE('CVE-2024-12345')).toBe(true);
        expect(isValidCVE('CVE-2024-123')).toBe(false);
        expect(isValidCVE('invalid')).toBe(false);
    });

    it('should filter vulnerabilities by status', () => {
        const vulnerabilities = [
            { id: '1', status: 'open' },
            { id: '2', status: 'resolved' },
            { id: '3', status: 'open' },
            { id: '4', status: 'closed' }
        ];

        const openVulns = vulnerabilities.filter(v => v.status === 'open');
        expect(openVulns).toHaveLength(2);
    });

    it('should calculate vulnerability age', () => {
        const calculateAge = (discoveredDate: Date): number => {
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - discoveredDate.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        expect(calculateAge(yesterday)).toBe(1);
    });

    it('should determine if vulnerability is SLA compliant', () => {
        const isSLACompliant = (severity: string, ageInDays: number): boolean => {
            const slaLimits: Record<string, number> = {
                critical: 1,
                high: 7,
                medium: 30,
                low: 90
            };
            return ageInDays <= (slaLimits[severity] || 90);
        };

        expect(isSLACompliant('critical', 0)).toBe(true);
        expect(isSLACompliant('critical', 2)).toBe(false);
        expect(isSLACompliant('high', 5)).toBe(true);
        expect(isSLACompliant('high', 10)).toBe(false);
    });
});

describe('Vulnerability Statistics', () => {
    it('should calculate vulnerability counts by severity', () => {
        const vulnerabilities = [
            { severity: 'critical' },
            { severity: 'critical' },
            { severity: 'high' },
            { severity: 'medium' },
            { severity: 'medium' },
            { severity: 'medium' },
            { severity: 'low' }
        ];

        const countBySeverity = vulnerabilities.reduce((acc, v) => {
            acc[v.severity] = (acc[v.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        expect(countBySeverity.critical).toBe(2);
        expect(countBySeverity.high).toBe(1);
        expect(countBySeverity.medium).toBe(3);
        expect(countBySeverity.low).toBe(1);
    });

    it('should calculate risk score', () => {
        const calculateRiskScore = (vulnerabilities: Array<{ severity: string }>): number => {
            const weights: Record<string, number> = {
                critical: 10,
                high: 5,
                medium: 2,
                low: 1
            };

            return vulnerabilities.reduce((score, v) => {
                return score + (weights[v.severity] || 0);
            }, 0);
        };

        const vulns = [
            { severity: 'critical' },
            { severity: 'high' },
            { severity: 'medium' }
        ];

        expect(calculateRiskScore(vulns)).toBe(17); // 10 + 5 + 2
    });
});
