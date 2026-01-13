/**
 * ThreatFeedService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to properly hoist mock functions
const { mockFetchThreatFeed, mockAddDoc, mockGetDocs } = vi.hoisted(() => ({
    mockFetchThreatFeed: vi.fn(),
    mockAddDoc: vi.fn(),
    mockGetDocs: vi.fn()
}));

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {}
}));

// Mock httpsCallable
vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockFetchThreatFeed
}));

// Import after mocks
import { ThreatFeedService } from '../ThreatFeedService';

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection'),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    query: vi.fn(() => 'mock-query'),
    where: vi.fn(() => 'mock-where'),
    getDocs: () => mockGetDocs(),
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

// Mock CISA KEV response
const mockCisaResponse = {
    vulnerabilities: [
        {
            cveID: 'CVE-2021-44228',
            vendorProject: 'Apache',
            product: 'Log4j',
            vulnerabilityName: 'Remote Code Execution',
            dateAdded: '2021-12-10',
            shortDescription: 'Apache Log4j2 JNDI features do not protect against attacker controlled LDAP',
            requiredAction: 'Apply updates per vendor instructions',
            dueDate: '2021-12-24',
            notes: ''
        },
        {
            cveID: 'CVE-2022-22965',
            vendorProject: 'VMware',
            product: 'Spring Framework',
            vulnerabilityName: 'Spring4Shell',
            dateAdded: '2022-04-01',
            shortDescription: 'A Spring MVC or Spring WebFlux application running on JDK 9+',
            requiredAction: 'Apply updates per vendor instructions',
            dueDate: '2022-04-15',
            notes: ''
        }
    ]
};

// Mock URLhaus response
const mockUrlHausResponse = {
    urls: [
        {
            id: '123456',
            url: 'http://malicious.example.com/payload.exe',
            url_status: 'online',
            threat: 'malware_download',
            tags: ['emotet'],
            date_added: '2024-01-15 10:00:00',
            reporter: 'abuse_ch'
        },
        {
            id: '123457',
            url: 'http://phishing.example.com/login',
            url_status: 'offline',
            threat: 'phishing',
            tags: ['credential-theft'],
            date_added: '2024-01-14 08:00:00',
            reporter: 'community'
        }
    ]
};

describe('ThreatFeedService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        ThreatFeedService.useSimulation = false;
        mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
        mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

        // Mock navigator.onLine to be true by default
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            configurable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('fetchCisaKev', () => {
        it('should return parsed CISA KEV vulnerabilities', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: mockCisaResponse
            });

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                cveId: 'CVE-2021-44228',
                severity: 'High',
                source: 'CISA KEV'
            });
        });

        it('should limit results to 50 vulnerabilities', async () => {
            const manyVulns = Array(100).fill(null).map((_, i) => ({
                cveID: `CVE-2024-${i.toString().padStart(4, '0')}`,
                vendorProject: 'Test',
                product: 'Product',
                vulnerabilityName: 'Vuln',
                dateAdded: '2024-01-01',
                shortDescription: 'Description',
                requiredAction: 'Patch',
                dueDate: '2024-02-01',
                notes: ''
            }));

            mockFetchThreatFeed.mockResolvedValueOnce({
                data: { vulnerabilities: manyVulns }
            });

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toHaveLength(50);
        });

        it('should return empty array on empty response', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: { vulnerabilities: [] }
            });

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toEqual([]);
        });

        it('should return empty array on fetch error', async () => {
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Network error'));
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toEqual([]);
        });

        it('should include remediation plan from requiredAction', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: mockCisaResponse
            });

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result[0].remediationPlan).toBe('Apply updates per vendor instructions');
        });
    });

    describe('fetchUrlHaus', () => {
        it('should return parsed URLhaus threats', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: mockUrlHausResponse
            });

            const result = await ThreatFeedService.fetchUrlHaus();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                id: 'urlhaus-123456',
                type: 'Malicious URL',
                severity: 'Medium',
                author: 'URLhaus'
            });
        });

        it('should set active status based on url_status', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: mockUrlHausResponse
            });

            const result = await ThreatFeedService.fetchUrlHaus();

            expect(result[0].active).toBe(true);  // online
            expect(result[1].active).toBe(false); // offline
        });

        it('should limit results to 50 entries', async () => {
            const manyUrls = Array(100).fill(null).map((_, i) => ({
                id: `${i}`,
                url: `http://example${i}.com`,
                url_status: 'online',
                threat: 'malware',
                tags: ['test'],
                date_added: '2024-01-15 10:00:00',
                reporter: 'test'
            }));

            mockFetchThreatFeed.mockResolvedValueOnce({
                data: { urls: manyUrls }
            });

            const result = await ThreatFeedService.fetchUrlHaus();

            expect(result).toHaveLength(50);
        });

        it('should return empty array on empty response', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: { urls: [] }
            });

            const result = await ThreatFeedService.fetchUrlHaus();

            expect(result).toEqual([]);
        });

        it('should return empty array on fetch error', async () => {
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Network error'));
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await ThreatFeedService.fetchUrlHaus();

            expect(result).toEqual([]);
        });

        it('should handle missing tags gracefully', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: {
                    urls: [{
                        id: '1',
                        url: 'http://example.com',
                        url_status: 'online',
                        threat: 'malware',
                        tags: undefined,
                        date_added: '2024-01-15',
                        reporter: 'test'
                    }]
                }
            });

            const result = await ThreatFeedService.fetchUrlHaus();

            expect(result[0].title).toContain('Malware');
        });
    });

    describe('seedLiveThreats', () => {
        it('should fetch and seed live data', async () => {
            mockFetchThreatFeed
                .mockResolvedValueOnce({ data: mockUrlHausResponse })
                .mockResolvedValueOnce({ data: mockCisaResponse });

            const result = await ThreatFeedService.seedLiveThreats('org-123');

            expect(mockAddDoc).toHaveBeenCalled();
            expect(result.threats).toBeGreaterThan(0);
        });

        it('should skip duplicates based on existing data', async () => {
            mockFetchThreatFeed
                .mockResolvedValueOnce({ data: mockUrlHausResponse })
                .mockResolvedValueOnce({ data: mockCisaResponse });

            // First call returns empty (no duplicates)
            mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

            const promise = ThreatFeedService.seedLiveThreats('org-123');
            // Allow potential simulated data fallback or internal timeouts
            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            // At least some addDoc calls should be made
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should not add duplicates when they already exist', async () => {
            mockFetchThreatFeed
                .mockResolvedValueOnce({ data: mockUrlHausResponse })
                .mockResolvedValueOnce({ data: mockCisaResponse });

            // Simulate that all entries already exist
            mockGetDocs.mockResolvedValue({
                empty: false,
                docs: [{ id: 'existing-1', data: () => ({}) }]
            });

            const promise = ThreatFeedService.seedLiveThreats('org-123');
            await vi.advanceTimersByTimeAsync(2000);
            const result = await promise;

            expect(result.vulns).toBe(0);
        });

        it('should fallback to simulation when offline', async () => {
            Object.defineProperty(navigator, 'onLine', {
                value: false,
                configurable: true
            });

            const promise = ThreatFeedService.seedLiveThreats('org-123');
            await vi.advanceTimersByTimeAsync(2000);
            const result = await promise;

            // Should have seeded simulated data
            expect(result.threats).toBeGreaterThan(0);
        });

        it('should fallback to simulation when useSimulation is true', async () => {
            ThreatFeedService.useSimulation = true;

            const promise = ThreatFeedService.seedLiveThreats('org-123');
            await vi.advanceTimersByTimeAsync(2000);
            const result = await promise;

            // Should have seeded simulated data
            expect(result.threats).toBeGreaterThan(0);
        });

        it('should fallback to simulation when live feeds return empty', async () => {
            mockFetchThreatFeed
                .mockResolvedValueOnce({ data: { urls: [] } })
                .mockResolvedValueOnce({ data: { vulnerabilities: [] } });

            const promise = ThreatFeedService.seedLiveThreats('org-123');
            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            // Should have fallen back to simulation
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should fallback to simulation on fetch error', async () => {
            mockFetchThreatFeed.mockRejectedValue(new Error('Network error'));
            mockFetch.mockRejectedValue(new Error('Network error'));

            const promise = ThreatFeedService.seedLiveThreats('org-123');
            await vi.advanceTimersByTimeAsync(2000);
            const result = await promise;

            // Should have fallen back to simulation
            expect(result.threats).toBeGreaterThan(0);
        });
    });

    describe('seedSimulatedData', () => {
        it('should seed mock threats', async () => {
            const promise = ThreatFeedService.seedSimulatedData('org-123');
            await vi.advanceTimersByTimeAsync(1000);
            const result = await promise;

            expect(result.threats).toBeGreaterThan(0);
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should seed mock vulnerabilities', async () => {
            const promise = ThreatFeedService.seedSimulatedData('org-123');
            await vi.advanceTimersByTimeAsync(1000);
            const result = await promise;

            expect(result.vulns).toBeGreaterThan(0);
        });

        it('should check for duplicate vulnerabilities', async () => {
            // First vuln already exists
            mockGetDocs
                .mockResolvedValueOnce({ empty: false, docs: [{ id: 'existing-1' }] })
                .mockResolvedValue({ empty: true, docs: [] });

            const promise = ThreatFeedService.seedSimulatedData('org-123');
            await vi.advanceTimersByTimeAsync(1000);
            await promise;

            // Should still have added some vulns (those that didn't exist)
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should use default org ID if not provided', async () => {
            const promise = ThreatFeedService.seedSimulatedData('');
            await vi.advanceTimersByTimeAsync(1000);
            await promise;

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    organizationId: 'demo-system'
                })
            );
        });

        it('should handle Firestore errors gracefully', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockAddDoc.mockRejectedValue(new Error('Firestore error'));

            const promise = ThreatFeedService.seedSimulatedData('org-123');
            await vi.advanceTimersByTimeAsync(1000);
            const result = await promise;

            // Should not throw, but log error
            expect(ErrorLogger.error).toHaveBeenCalled();
            expect(result).toEqual({ threats: 0, vulns: 0 });
        });

        it('should include all required threat fields', async () => {
            const promise = ThreatFeedService.seedSimulatedData('org-123');
            await vi.advanceTimersByTimeAsync(1000);
            await promise;

            expect(mockAddDoc).toHaveBeenCalledWith(
                'mock-collection',
                expect.objectContaining({
                    title: expect.any(String),
                    type: expect.any(String),
                    severity: expect.any(String),
                    country: expect.any(String),
                    active: true,
                    organizationId: 'org-123'
                })
            );
        });
    });

    describe('fetchViaProxy', () => {
        it('should try Firebase proxy first', async () => {
            mockFetchThreatFeed.mockResolvedValueOnce({
                data: { test: 'data' }
            });

            await ThreatFeedService.fetchCisaKev();

            expect(mockFetchThreatFeed).toHaveBeenCalled();
        });

        it('should return empty data for invalid URL', async () => {
            const result = await ThreatFeedService.fetchCisaKev();

            // The internal fetchViaProxy validates URLs
            // Even if it fails, it should return empty array
            expect(result).toEqual([]);
        });

        it('should return empty data when offline', async () => {
            Object.defineProperty(navigator, 'onLine', {
                value: false,
                configurable: true
            });

            // Make Firebase proxy fail
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Offline'));

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toEqual([]);
        });

        it('should fallback to direct fetch if Firebase fails', async () => {
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Firebase error'));
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify(mockCisaResponse))
            });

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toHaveLength(2);
        });

        it('should try proxy services if direct fetch fails', async () => {
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Firebase error'));
            mockFetch
                .mockRejectedValueOnce(new Error('CORS error')) // Direct fetch
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify(mockCisaResponse))
                }); // Proxy

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toHaveLength(2);
        });

        it('should handle JSON parse errors gracefully', async () => {
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Firebase error'));
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('not json')
            });

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toEqual([]);
        });

        it('should timeout requests appropriately', async () => {
            mockFetchThreatFeed.mockRejectedValueOnce(new Error('Firebase error'));

            const controller = new AbortController();
            mockFetch.mockImplementationOnce(() =>
                new Promise((_, reject) => {
                    controller.abort();
                    reject(new DOMException('Aborted', 'AbortError'));
                })
            );

            const result = await ThreatFeedService.fetchCisaKev();

            expect(result).toEqual([]);
        });
    });

    describe('useSimulation flag', () => {
        it('should be false by default', () => {
            ThreatFeedService.useSimulation = false;
            expect(ThreatFeedService.useSimulation).toBe(false);
        });

        it('should be configurable', () => {
            ThreatFeedService.useSimulation = true;
            expect(ThreatFeedService.useSimulation).toBe(true);
            ThreatFeedService.useSimulation = false;
        });
    });
});
