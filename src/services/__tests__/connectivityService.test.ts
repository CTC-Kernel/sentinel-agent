/**
 * Connectivity Service Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectivityService } from '../connectivityService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    storage: {}
}));

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    limit: vi.fn()
}));

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    listAll: vi.fn()
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        warn: vi.fn()
    }
}));

describe('ConnectivityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('checkFirestore', () => {
        it('should return operational status on successful query', async () => {
            const { getDocs } = await import('firebase/firestore');
            (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });

            const result = await ConnectivityService.checkFirestore();

            expect(result.name).toBe('Firestore Database');
            expect(result.status).toBe('operational');
            expect(result.latency).toBeGreaterThanOrEqual(0);
        });

        it('should return degraded status for slow response', async () => {
            const { getDocs } = await import('firebase/firestore');
            (getDocs as ReturnType<typeof vi.fn>).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ docs: [] }), 1100))
            );

            const result = await ConnectivityService.checkFirestore();

            expect(result.status).toBe('degraded');
        });

        it('should return outage status on error', async () => {
            const { getDocs } = await import('firebase/firestore');
            (getDocs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection failed'));

            const result = await ConnectivityService.checkFirestore();

            expect(result.name).toBe('Firestore Database');
            expect(result.status).toBe('outage');
            expect(result.error).toBe('Connection failed');
        });
    });

    describe('checkStorage', () => {
        it('should return operational status on successful list', async () => {
            const { listAll } = await import('firebase/storage');
            (listAll as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], prefixes: [] });

            const result = await ConnectivityService.checkStorage();

            expect(result.name).toBe('Storage');
            expect(result.status).toBe('operational');
            expect(result.latency).toBeGreaterThanOrEqual(0);
        });

        it('should return operational for unauthorized error (proves connectivity)', async () => {
            const { listAll } = await import('firebase/storage');
            (listAll as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'storage/unauthorized', message: 'Unauthorized' });

            const result = await ConnectivityService.checkStorage();

            expect(result.name).toBe('Storage');
            expect(result.status).toBe('operational');
        });

        it('should return outage status for other errors', async () => {
            const { listAll } = await import('firebase/storage');
            (listAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

            const result = await ConnectivityService.checkStorage();

            expect(result.name).toBe('Storage');
            expect(result.status).toBe('outage');
            expect(result.error).toBe('Network error');
        });
    });

    describe('checkCloudFunctions', () => {
        it('should return degraded status until health endpoint is implemented', async () => {
            const result = await ConnectivityService.checkCloudFunctions();

            expect(result.name).toBe('Cloud Functions');
            expect(result.status).toBe('degraded');
            expect(result.latency).toBe(0);
        });
    });
});
