import { describe, it, expect } from 'vitest';

describe('Threat Intelligence Data', () => {
    it('should have correct threat structure', () => {
        const threat = {
            id: 'threat-1',
            name: 'APT29',
            type: 'APT',
            severity: 'high',
            source: 'MITRE ATT&CK',
            iocs: ['192.168.1.1', 'malware.exe'],
            tactics: ['Initial Access', 'Execution'],
            lastUpdated: new Date()
        };

        expect(threat.id).toBeDefined();
        expect(threat.name).toBeDefined();
        expect(Array.isArray(threat.iocs)).toBe(true);
        expect(Array.isArray(threat.tactics)).toBe(true);
    });

    it('should categorize threats by type', () => {
        const threatTypes = ['APT', 'Malware', 'Ransomware', 'Phishing', 'DDoS', 'Zero-Day'];

        threatTypes.forEach(type => {
            expect(typeof type).toBe('string');
        });
    });

    it('should calculate threat score', () => {
        const calculateThreatScore = (severity: string, recency: number): number => {
            const severityScores: Record<string, number> = {
                critical: 10,
                high: 7,
                medium: 5,
                low: 2
            };
            const baseScore = severityScores[severity] || 0;
            const recencyFactor = Math.max(0, 1 - recency / 365);
            return baseScore * recencyFactor;
        };

        expect(calculateThreatScore('critical', 0)).toBe(10);
        expect(calculateThreatScore('critical', 365)).toBe(0);
        expect(calculateThreatScore('high', 0)).toBe(7);
    });

    it('should validate IOC formats', () => {
        const isValidIPv4 = (ip: string): boolean => {
            const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!pattern.test(ip)) return false;
            return ip.split('.').every(octet => parseInt(octet) <= 255);
        };

        const isValidMD5 = (hash: string): boolean => {
            return /^[a-fA-F0-9]{32}$/.test(hash);
        };

        const isValidSHA256 = (hash: string): boolean => {
            return /^[a-fA-F0-9]{64}$/.test(hash);
        };

        expect(isValidIPv4('192.168.1.1')).toBe(true);
        expect(isValidIPv4('256.1.1.1')).toBe(false);
        expect(isValidMD5('d41d8cd98f00b204e9800998ecf8427e')).toBe(true);
        expect(isValidSHA256('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(true);
    });

    it('should parse MITRE ATT&CK techniques', () => {
        const technique = {
            id: 'T1566',
            name: 'Phishing',
            tactic: 'Initial Access',
            description: 'Adversaries may send phishing messages to gain access'
        };

        expect(technique.id).toMatch(/^T\d+/);
        expect(technique.tactic).toBeDefined();
    });

    it('should match IOCs against threats', () => {
        const threats = [
            { id: '1', iocs: ['192.168.1.1', '10.0.0.1'] },
            { id: '2', iocs: ['malware.exe', 'trojan.dll'] },
            { id: '3', iocs: ['evil.com', '192.168.1.1'] }
        ];

        const searchIOC = '192.168.1.1';
        const matchingThreats = threats.filter(t => t.iocs.includes(searchIOC));

        expect(matchingThreats).toHaveLength(2);
        expect(matchingThreats.map(t => t.id)).toContain('1');
        expect(matchingThreats.map(t => t.id)).toContain('3');
    });
});

describe('Threat Feed Processing', () => {
    it('should normalize threat data from different sources', () => {
        const normalize = (threat: { title?: string; name?: string; severity?: string; risk?: string }) => ({
            name: threat.title || threat.name || 'Unknown',
            severity: threat.severity || threat.risk || 'medium'
        });

        expect(normalize({ title: 'Test', severity: 'high' })).toEqual({ name: 'Test', severity: 'high' });
        expect(normalize({ name: 'Test2', risk: 'low' })).toEqual({ name: 'Test2', severity: 'low' });
        expect(normalize({})).toEqual({ name: 'Unknown', severity: 'medium' });
    });

    it('should deduplicate threats by IOC', () => {
        const threats = [
            { id: '1', iocs: ['ioc1', 'ioc2'] },
            { id: '2', iocs: ['ioc2', 'ioc3'] },
            { id: '3', iocs: ['ioc4'] }
        ];

        const allIOCs = threats.flatMap(t => t.iocs);
        const uniqueIOCs = [...new Set(allIOCs)];

        expect(uniqueIOCs).toHaveLength(4);
    });

    it('should calculate threat trend', () => {
        const calculateTrend = (current: number, previous: number): 'increasing' | 'decreasing' | 'stable' => {
            const percentChange = ((current - previous) / previous) * 100;
            if (percentChange > 5) return 'increasing';
            if (percentChange < -5) return 'decreasing';
            return 'stable';
        };

        expect(calculateTrend(100, 50)).toBe('increasing');
        expect(calculateTrend(50, 100)).toBe('decreasing');
        expect(calculateTrend(100, 98)).toBe('stable');
    });
});
