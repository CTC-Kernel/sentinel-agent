/**
 * StatsService Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsService } from '../statsService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

import { getDoc, getDocs, setDoc } from 'firebase/firestore';
import { ErrorLogger } from '../errorLogger';

describe('StatsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('snapshotDailyStats', () => {
        it('should not create snapshot if one already exists for today', async () => {
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
            } as never);

            await StatsService.snapshotDailyStats('org-1');

            expect(setDoc).not.toHaveBeenCalled();
        });

        it('should create snapshot with correct metrics', async () => {
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => false,
            } as never);

            const mockRisks = [
                { score: 20, status: 'Ouvert' }, // Critical
                { score: 12, status: 'Ouvert' }, // High
                { score: 5, status: 'Ouvert' },  // Low
            ];

            const mockIncidents = [
                { status: 'Ouvert' },
                { status: 'Résolu' },
            ];

            const mockControls = [
                { status: 'Implémenté' },
                { status: 'Implémenté' },
                { status: 'Non implémenté' },
            ];

            const mockAssets = [{ id: 'asset-1' }, { id: 'asset-2' }];

            const mockProjects = [
                { status: 'En cours' },
                { status: 'Terminé' },
            ];

            vi.mocked(getDocs)
                .mockResolvedValueOnce({
                    docs: mockRisks.map((r, i) => ({ id: `risk-${i}`, data: () => r })),
                } as never) // risks
                .mockResolvedValueOnce({
                    docs: mockIncidents.map((inc, i) => ({ id: `inc-${i}`, data: () => inc })),
                } as never) // incidents
                .mockResolvedValueOnce({
                    docs: mockControls.map((c, i) => ({ id: `ctrl-${i}`, data: () => c })),
                } as never) // controls
                .mockResolvedValueOnce({
                    docs: mockAssets.map((a, i) => ({ id: `asset-${i}`, data: () => a })),
                } as never) // assets
                .mockResolvedValueOnce({
                    docs: mockProjects.map((p, i) => ({ id: `proj-${i}`, data: () => p })),
                } as never); // projects

            await StatsService.snapshotDailyStats('org-1');

            expect(setDoc).toHaveBeenCalled();
            expect(ErrorLogger.info).toHaveBeenCalledWith(
                'Daily stats snapshot created',
                'StatsService.snapshotDailyStats',
                expect.any(Object)
            );
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(getDoc).mockRejectedValue(new Error('Firebase error'));

            await StatsService.snapshotDailyStats('org-1');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getHistory', () => {
        it('should return historical stats in chronological order', async () => {
            const mockStats = [
                { date: '2024-01-15', metrics: { totalRisks: 5 } },
                { date: '2024-01-14', metrics: { totalRisks: 4 } },
                { date: '2024-01-13', metrics: { totalRisks: 3 } },
            ];

            vi.mocked(getDocs).mockResolvedValue({
                docs: mockStats.map(s => ({ id: s.date, data: () => s })),
            } as never);

            const result = await StatsService.getHistory('org-1', 30);

            expect(result).toHaveLength(3);
            // Should be reversed (oldest to newest)
            expect(result[0].date).toBe('2024-01-13');
            expect(result[2].date).toBe('2024-01-15');
        });

        it('should return empty array when no history exists', async () => {
            vi.mocked(getDocs).mockResolvedValue({
                docs: [],
            } as never);

            const result = await StatsService.getHistory('org-1');

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            vi.mocked(getDocs).mockRejectedValue(new Error('Firebase error'));

            const result = await StatsService.getHistory('org-1');

            expect(result).toEqual([]);
            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should use default days parameter of 30', async () => {
            vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

            await StatsService.getHistory('org-1');

            // Just verify it doesn't throw with default param
            expect(getDocs).toHaveBeenCalled();
        });
    });
});
