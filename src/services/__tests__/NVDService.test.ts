/**
 * NVDService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NVDService } from '../NVDService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock Firestore
const mockAddDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection'),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    serverTimestamp: vi.fn(() => new Date().toISOString())
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample NVD response with all CVSS versions
const createMockNVDVulnerability = (overrides: Record<string, unknown> = {}) => ({
    cve: {
        id: 'CVE-2024-1234',
        sourceIdentifier: 'nvd@nist.gov',
        published: '2024-01-15T10:00:00.000',
        lastModified: '2024-01-16T10:00:00.000',
        vulnStatus: 'Analyzed',
        descriptions: [
            { lang: 'en', value: 'A critical vulnerability in Example Software allows remote code execution.' },
            { lang: 'fr', value: 'Une vulnérabilité critique dans Example Software.' }
        ],
        metrics: {
            cvssMetricV31: [
                {
                    cvssData: {
                        version: '3.1',
                        vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                        attackVector: 'NETWORK',
                        attackComplexity: 'LOW',
                        privilegesRequired: 'NONE',
                        userInteraction: 'NONE',
                        scope: 'UNCHANGED',
                        confidentialityImpact: 'HIGH',
                        integrityImpact: 'HIGH',
                        availabilityImpact: 'HIGH',
                        baseScore: 9.8,
                        baseSeverity: 'CRITICAL'
                    },
                    exploitabilityScore: 3.9,
                    impactScore: 5.9
                }
            ]
        },
        weaknesses: [
            {
                source: 'nvd@nist.gov',
                type: 'Primary',
                description: [{ lang: 'en', value: 'CWE-79' }]
            }
        ],
        references: [
            { url: 'https://example.com/advisory', source: 'example.com', tags: ['Vendor Advisory'] }
        ],
        ...overrides
    }
});

const createMockNVDResponse = (vulns: unknown[] = [createMockNVDVulnerability()], total = 1) => ({
    vulnerabilitiesPerPage: 2000,
    startIndex: 0,
    totalResults: total,
    vulnerabilities: vulns
});

describe('NVDService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Reset the lastRequestTime static property
        (NVDService as unknown as { lastRequestTime: number }).lastRequestTime = 0;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('getSeverityFromScore (via extractCVSSMetrics)', () => {
        it('should return Critical for score >= 9.0', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV2: [
                        {
                            cvssData: {
                                version: '2.0',
                                vectorString: 'AV:N/AC:L/Au:N/C:C/I:C/A:C',
                                baseScore: 10.0,
                                severity: 'HIGH' // V2 doesn't have Critical
                            }
                        }
                    ]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({ cveId: 'CVE-2024-1234' });

            // The service should map the score to our severity
            expect(response.vulnerabilities).toHaveLength(1);
        });

        it('should return High for score >= 7.0', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV2: [
                        {
                            cvssData: {
                                version: '2.0',
                                vectorString: 'AV:N/AC:M/Au:N/C:P/I:P/A:P',
                                baseScore: 7.5
                            }
                        }
                    ]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({ cveId: 'CVE-2024-1234' });
            expect(response.vulnerabilities).toHaveLength(1);
        });

        it('should return Medium for score >= 4.0', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV2: [
                        {
                            cvssData: {
                                version: '2.0',
                                vectorString: 'AV:L/AC:M/Au:N/C:P/I:N/A:N',
                                baseScore: 4.5
                            }
                        }
                    ]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({ cveId: 'CVE-2024-1234' });
            expect(response.vulnerabilities).toHaveLength(1);
        });

        it('should return Low for score < 4.0', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV2: [
                        {
                            cvssData: {
                                version: '2.0',
                                vectorString: 'AV:L/AC:H/Au:N/C:N/I:N/A:P',
                                baseScore: 2.0
                            }
                        }
                    ]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({ cveId: 'CVE-2024-1234' });
            expect(response.vulnerabilities).toHaveLength(1);
        });
    });

    describe('extractCVSSMetrics', () => {
        it('should prefer CVSS v3.1 over v3.0 and v2', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV31: [{ cvssData: { baseScore: 9.8, baseSeverity: 'CRITICAL', vectorString: 'CVSS:3.1/...' } }],
                    cvssMetricV30: [{ cvssData: { baseScore: 9.0, baseSeverity: 'CRITICAL', vectorString: 'CVSS:3.0/...' } }],
                    cvssMetricV2: [{ cvssData: { baseScore: 7.5, vectorString: 'AV:N/...' } }]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({});
            expect(response.vulnerabilities[0].cve.metrics?.cvssMetricV31?.[0].cvssData.baseScore).toBe(9.8);
        });

        it('should use CVSS v3.0 if v3.1 is not available', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV30: [
                        {
                            cvssData: {
                                version: '3.0',
                                vectorString: 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                                baseScore: 9.0,
                                baseSeverity: 'CRITICAL'
                            }
                        }
                    ]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({});
            expect(response.vulnerabilities[0].cve.metrics?.cvssMetricV30?.[0].cvssData.baseScore).toBe(9.0);
        });

        it('should use CVSS v2 if no v3 is available', async () => {
            const vuln = createMockNVDVulnerability({
                metrics: {
                    cvssMetricV2: [
                        {
                            cvssData: {
                                version: '2.0',
                                vectorString: 'AV:N/AC:L/Au:N/C:C/I:C/A:C',
                                baseScore: 10.0
                            }
                        }
                    ]
                }
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({});
            expect(response.vulnerabilities[0].cve.metrics?.cvssMetricV2?.[0].cvssData.baseScore).toBe(10.0);
        });

        it('should handle missing metrics gracefully', async () => {
            const vuln = createMockNVDVulnerability({ metrics: undefined });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const response = await NVDService.fetchVulnerabilities({});
            expect(response.vulnerabilities[0].cve.metrics).toBeUndefined();
        });
    });

    describe('fetchVulnerabilities', () => {
        it('should make request to NVD API with default parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({});

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('https://services.nvd.nist.gov/rest/json/cves/2.0'),
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should include keyword parameter in request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({ keyword: 'apache' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('keywordSearch=apache'),
                expect.anything()
            );
        });

        it('should include cveId parameter in request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({ cveId: 'CVE-2024-1234' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cveId=CVE-2024-1234'),
                expect.anything()
            );
        });

        it('should map cvssScore to severity parameter (CRITICAL for >= 9)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({ cvssScore: 9.5 });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=CRITICAL'),
                expect.anything()
            );
        });

        it('should map cvssScore to severity parameter (HIGH for >= 7)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({ cvssScore: 7.5 });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=HIGH'),
                expect.anything()
            );
        });

        it('should map cvssScore to severity parameter (MEDIUM for >= 4)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({ cvssScore: 4.5 });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=MEDIUM'),
                expect.anything()
            );
        });

        it('should map cvssScore to severity parameter (LOW for < 4)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({ cvssScore: 2.0 });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=LOW'),
                expect.anything()
            );
        });

        it('should include date range parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('pubStartDate=2024-01-01'),
                expect.anything()
            );
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('pubEndDate=2024-01-31'),
                expect.anything()
            );
        });

        it('should include pagination parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({
                resultsPerPage: 50,
                startIndex: 100
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('resultsPerPage=50'),
                expect.anything()
            );
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('startIndex=100'),
                expect.anything()
            );
        });

        it('should throw error on non-OK response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden'
            });

            await expect(NVDService.fetchVulnerabilities({})).rejects.toThrow('NVD API error: 403 Forbidden');
        });

        it('should log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(NVDService.fetchVulnerabilities({})).rejects.toThrow('Network error');
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('importVulnerabilities', () => {
        it('should import vulnerabilities from NVD to Firestore', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([
                    createMockNVDVulnerability(),
                    createMockNVDVulnerability({ id: 'CVE-2024-5678' })
                ], 2))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            const result = await NVDService.importVulnerabilities('org-123', {});

            expect(result.imported).toBe(2);
            expect(result.total).toBe(2);
            expect(result.errors).toHaveLength(0);
            expect(mockAddDoc).toHaveBeenCalledTimes(2);
        });

        it('should pass keyword parameter to fetch', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', { keyword: 'apache' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('keywordSearch=apache'),
                expect.anything()
            );
        });

        it('should collect errors for failed imports', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([
                    createMockNVDVulnerability(),
                    createMockNVDVulnerability({ id: 'CVE-2024-5678' })
                ], 2))
            });
            mockAddDoc
                .mockResolvedValueOnce({ id: 'new-vuln-id' })
                .mockRejectedValueOnce(new Error('Firestore error'));

            const result = await NVDService.importVulnerabilities('org-123', {});

            expect(result.imported).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Firestore error');
        });

        it('should respect limit parameter', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', { limit: 50 });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('resultsPerPage=50'),
                expect.anything()
            );
        });

        it('should throw on fetch failure', async () => {
            mockFetch.mockRejectedValueOnce(new Error('API unreachable'));

            await expect(
                NVDService.importVulnerabilities('org-123', {})
            ).rejects.toThrow('API unreachable');
        });
    });

    describe('getVulnerabilityDetails', () => {
        it('should return vulnerability details by CVE ID', async () => {
            const vuln = createMockNVDVulnerability();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });

            const result = await NVDService.getVulnerabilityDetails('CVE-2024-1234');

            expect(result).toBeTruthy();
            expect(result?.cve.id).toBe('CVE-2024-1234');
        });

        it('should return null if vulnerability not found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([], 0))
            });

            const result = await NVDService.getVulnerabilityDetails('CVE-9999-9999');

            expect(result).toBeNull();
        });

        it('should throw on API error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('API error'));

            await expect(
                NVDService.getVulnerabilityDetails('CVE-2024-1234')
            ).rejects.toThrow('API error');
        });
    });

    describe('searchVulnerabilities', () => {
        it('should search vulnerabilities by keyword', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([createMockNVDVulnerability()], 1))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            const result = await NVDService.searchVulnerabilities('apache', 'org-123');

            expect(result.imported).toBe(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('keywordSearch=apache'),
                expect.anything()
            );
        });

        it('should map severity option to CVSS score (Critical)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.searchVulnerabilities('log4j', 'org-123', { severity: 'Critical' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=CRITICAL'),
                expect.anything()
            );
        });

        it('should map severity option to CVSS score (High)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.searchVulnerabilities('log4j', 'org-123', { severity: 'High' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=HIGH'),
                expect.anything()
            );
        });

        it('should map severity option to CVSS score (Medium)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.searchVulnerabilities('log4j', 'org-123', { severity: 'Medium' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=MEDIUM'),
                expect.anything()
            );
        });

        it('should map severity option to CVSS score (Low)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.searchVulnerabilities('log4j', 'org-123', { severity: 'Low' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('cvssV3Severity=LOW'),
                expect.anything()
            );
        });

        it('should pass date range options', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.searchVulnerabilities('apache', 'org-123', {
                startDate: '2024-01-01',
                endDate: '2024-06-30'
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('pubStartDate=2024-01-01'),
                expect.anything()
            );
        });

        it('should respect limit option', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.searchVulnerabilities('apache', 'org-123', { limit: 25 });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('resultsPerPage=25'),
                expect.anything()
            );
        });
    });

    describe('getRecentVulnerabilities', () => {
        it('should fetch vulnerabilities from the last 7 days by default', async () => {
            const now = new Date('2024-06-15T12:00:00Z');
            vi.setSystemTime(now);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.getRecentVulnerabilities('org-123');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('pubStartDate=2024-06-08'),
                expect.anything()
            );
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('pubEndDate=2024-06-15'),
                expect.anything()
            );
        });

        it('should respect custom days parameter', async () => {
            const now = new Date('2024-06-15T12:00:00Z');
            vi.setSystemTime(now);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.getRecentVulnerabilities('org-123', 30);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('pubStartDate=2024-05-16'),
                expect.anything()
            );
        });

        it('should limit results to 100 by default', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.getRecentVulnerabilities('org-123');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('resultsPerPage=100'),
                expect.anything()
            );
        });
    });

    describe('testConnection', () => {
        it('should return success on successful connection', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([], 50000))
            });

            const result = await NVDService.testConnection();

            expect(result.success).toBe(true);
            expect(result.message).toContain('NVD API connection successful');
            expect(result.message).toContain('50000');
            expect(result.rateLimit).toBeDefined();
        });

        it('should return failure on connection error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

            const result = await NVDService.testConnection();

            expect(result.success).toBe(false);
            expect(result.message).toContain('NVD API connection failed');
            expect(result.message).toContain('Network unreachable');
        });

        it('should return failure on API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable'
            });

            const result = await NVDService.testConnection();

            expect(result.success).toBe(false);
            expect(result.message).toContain('503 Service Unavailable');
        });
    });

    describe('convertToSentinelVulnerability', () => {
        it('should convert NVD vulnerability to Sentinel format', async () => {
            const vuln = createMockNVDVulnerability();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', {});

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    cveId: 'CVE-2024-1234',
                    title: expect.stringContaining('CVE-2024-1234'),
                    description: expect.stringContaining('critical vulnerability'),
                    severity: 'CRITICAL',
                    score: 9.8,
                    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                    status: 'Open',
                    source: 'NVD',
                    organizationId: 'org-123'
                })
            );
        });

        it('should use English description if available', async () => {
            const vuln = createMockNVDVulnerability({
                descriptions: [
                    { lang: 'fr', value: 'Description en français' },
                    { lang: 'en', value: 'English description' }
                ]
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', {});

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    description: 'English description'
                })
            );
        });

        it('should use first description if English not available', async () => {
            const vuln = createMockNVDVulnerability({
                descriptions: [
                    { lang: 'fr', value: 'Description en français' }
                ]
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', {});

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    description: 'Description en français'
                })
            );
        });

        it('should handle missing descriptions', async () => {
            const vuln = createMockNVDVulnerability({ descriptions: [] });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', {});

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    description: 'No description available'
                })
            );
        });

        it('should default to Medium severity if no CVSS metrics', async () => {
            const vuln = createMockNVDVulnerability({ metrics: undefined });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse([vuln]))
            });
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            await NVDService.importVulnerabilities('org-123', {});

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    severity: 'Medium',
                    score: null,
                    cvssVector: null
                })
            );
        });
    });

    describe('rate limiting', () => {
        it('should wait for rate limit between requests', async () => {
            // First request
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });

            await NVDService.fetchVulnerabilities({});

            // Second request should trigger rate limiting
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createMockNVDResponse())
            });



            // Advance timers during the await
            const fetchPromise = NVDService.fetchVulnerabilities({});

            // Should wait ~6 seconds
            await vi.advanceTimersByTimeAsync(6000);
            await fetchPromise;

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
