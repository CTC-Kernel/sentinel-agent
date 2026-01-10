import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreService } from '../scoreService';
import type { ScoreHistory, ScoreBreakdown } from '../../types/score.types';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {},
}));

// Mock Firestore
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  collection: vi.fn(() => 'mock-collection-ref'),
  query: vi.fn(() => 'mock-query'),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ScoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getComplianceScore', () => {
    it('should return null when score document does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await ScoreService.getComplianceScore('org-123');
      expect(result).toBeNull();
    });

    it('should return compliance score when document exists', async () => {
      const mockData = {
        global: 75,
        byFramework: {
          iso27001: 80,
          nis2: 70,
          dora: 65,
          rgpd: 85,
        },
        trend: 'up',
        lastCalculated: { toDate: () => new Date('2026-01-10') },
        breakdown: {
          risks: { score: 70, weight: 0.30 },
          controls: { score: 80, weight: 0.40 },
          documents: { score: 75, weight: 0.10 },
          audits: { score: 72, weight: 0.20 },
        },
        calculationDetails: {
          totalRisks: 50,
          criticalRisks: 5,
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockData,
      });

      const result = await ScoreService.getComplianceScore('org-123');

      expect(result).not.toBeNull();
      expect(result?.global).toBe(75);
      expect(result?.trend).toBe('up');
      expect(result?.breakdown.controls.score).toBe(80);
      expect(result?.byFramework.iso27001).toBe(80);
    });

    it('should handle missing optional fields with defaults', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      const result = await ScoreService.getComplianceScore('org-123');

      expect(result).not.toBeNull();
      expect(result?.global).toBe(0);
      expect(result?.trend).toBe('stable');
      expect(result?.byFramework.iso27001).toBe(0);
    });

    it('should throw and log error on Firestore failure', async () => {
      const error = new Error('Firestore error');
      mockGetDoc.mockRejectedValue(error);

      await expect(ScoreService.getComplianceScore('org-123')).rejects.toThrow('Firestore error');
    });
  });

  describe('getScoreHistory', () => {
    it('should return empty array when no history exists', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: vi.fn(),
      });

      const result = await ScoreService.getScoreHistory('org-123', 30);
      expect(result).toEqual([]);
    });

    it('should return sorted history entries', async () => {
      const mockDocs = [
        { id: '2026-01-10', data: () => ({ global: 75 }) },
        { id: '2026-01-09', data: () => ({ global: 72 }) },
        { id: '2026-01-08', data: () => ({ global: 70 }) },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: { id: string; data: () => { global: number } }) => void) => {
          mockDocs.forEach(callback);
        },
      });

      const result = await ScoreService.getScoreHistory('org-123', 30);

      expect(result).toHaveLength(3);
      // Should be sorted ascending by date
      expect(result[0].date).toBe('2026-01-08');
      expect(result[1].date).toBe('2026-01-09');
      expect(result[2].date).toBe('2026-01-10');
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await ScoreService.getScoreHistory('org-123', 30);
      expect(result).toEqual([]);
    });
  });

  describe('subscribeToScore', () => {
    it('should call callback with null when document does not exist', () => {
      const callback = vi.fn();
      const unsubscribe = vi.fn();

      mockOnSnapshot.mockImplementation((ref, onNext) => {
        onNext({ exists: () => false });
        return unsubscribe;
      });

      const unsub = ScoreService.subscribeToScore('org-123', callback);

      expect(callback).toHaveBeenCalledWith(null);
      expect(unsub).toBe(unsubscribe);
    });

    it('should call callback with score when document exists', () => {
      const callback = vi.fn();
      const unsubscribe = vi.fn();

      const mockData = {
        global: 75,
        byFramework: { iso27001: 80, nis2: 70, dora: 65, rgpd: 85 },
        trend: 'up',
        lastCalculated: { toDate: () => new Date('2026-01-10') },
        breakdown: {
          risks: { score: 70, weight: 0.30 },
          controls: { score: 80, weight: 0.40 },
          documents: { score: 75, weight: 0.10 },
          audits: { score: 72, weight: 0.20 },
        },
      };

      mockOnSnapshot.mockImplementation((ref, onNext) => {
        onNext({
          exists: () => true,
          data: () => mockData,
        });
        return unsubscribe;
      });

      ScoreService.subscribeToScore('org-123', callback);

      expect(callback).toHaveBeenCalled();
      const callArg = callback.mock.calls[0][0];
      expect(callArg.global).toBe(75);
      expect(callArg.trend).toBe('up');
    });

    it('should call callback with error on snapshot error', () => {
      const callback = vi.fn();
      const error = new Error('Snapshot error');

      mockOnSnapshot.mockImplementation((ref, onNext, onError) => {
        onError(error);
        return vi.fn();
      });

      ScoreService.subscribeToScore('org-123', callback);

      expect(callback).toHaveBeenCalledWith(null, error);
    });
  });

  describe('calculateTrend', () => {
    it('should return stable when no history', () => {
      const result = ScoreService.calculateTrend(75, []);
      expect(result).toBe('stable');
    });

    it('should return up when current > avg + 5', () => {
      const history: ScoreHistory[] = [
        { date: '2026-01-08', global: 60 },
        { date: '2026-01-09', global: 60 },
        { date: '2026-01-10', global: 60 },
      ];
      // avg = 60, current = 70, diff = 10 > 5
      const result = ScoreService.calculateTrend(70, history);
      expect(result).toBe('up');
    });

    it('should return down when current < avg - 5', () => {
      const history: ScoreHistory[] = [
        { date: '2026-01-08', global: 80 },
        { date: '2026-01-09', global: 80 },
        { date: '2026-01-10', global: 80 },
      ];
      // avg = 80, current = 70, diff = -10 < -5
      const result = ScoreService.calculateTrend(70, history);
      expect(result).toBe('down');
    });

    it('should return stable when within ±5', () => {
      const history: ScoreHistory[] = [
        { date: '2026-01-08', global: 72 },
        { date: '2026-01-09', global: 73 },
        { date: '2026-01-10', global: 74 },
      ];
      // avg = 73, current = 75, diff = 2 within ±5
      const result = ScoreService.calculateTrend(75, history);
      expect(result).toBe('stable');
    });

    it('should return stable at exactly +5 boundary', () => {
      const history: ScoreHistory[] = [
        { date: '2026-01-08', global: 70 },
        { date: '2026-01-09', global: 70 },
      ];
      // avg = 70, current = 75, diff = 5 (not > 5)
      const result = ScoreService.calculateTrend(75, history);
      expect(result).toBe('stable');
    });

    it('should return up at just above +5 boundary', () => {
      const history: ScoreHistory[] = [
        { date: '2026-01-08', global: 70 },
        { date: '2026-01-09', global: 70 },
      ];
      // avg = 70, current = 75.01, diff = 5.01 > 5
      const result = ScoreService.calculateTrend(75.01, history);
      expect(result).toBe('up');
    });
  });

  describe('calculateGlobalScore', () => {
    it('should calculate weighted global score correctly', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: 70, weight: 0.30 },
        controls: { score: 80, weight: 0.40 },
        documents: { score: 60, weight: 0.10 },
        audits: { score: 75, weight: 0.20 },
      };
      // Expected: 70*0.30 + 80*0.40 + 60*0.10 + 75*0.20 = 21 + 32 + 6 + 15 = 74
      const result = ScoreService.calculateGlobalScore(breakdown);
      expect(result).toBe(74);
    });

    it('should clamp score to 0 minimum', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: -50, weight: 0.30 },
        controls: { score: -50, weight: 0.40 },
        documents: { score: -50, weight: 0.10 },
        audits: { score: -50, weight: 0.20 },
      };
      const result = ScoreService.calculateGlobalScore(breakdown);
      expect(result).toBe(0);
    });

    it('should clamp score to 100 maximum', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: 150, weight: 0.30 },
        controls: { score: 150, weight: 0.40 },
        documents: { score: 150, weight: 0.10 },
        audits: { score: 150, weight: 0.20 },
      };
      const result = ScoreService.calculateGlobalScore(breakdown);
      expect(result).toBe(100);
    });

    it('should return 0 when all scores are 0', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: 0, weight: 0.30 },
        controls: { score: 0, weight: 0.40 },
        documents: { score: 0, weight: 0.10 },
        audits: { score: 0, weight: 0.20 },
      };
      const result = ScoreService.calculateGlobalScore(breakdown);
      expect(result).toBe(0);
    });

    it('should return 100 when all scores are 100', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: 100, weight: 0.30 },
        controls: { score: 100, weight: 0.40 },
        documents: { score: 100, weight: 0.10 },
        audits: { score: 100, weight: 0.20 },
      };
      const result = ScoreService.calculateGlobalScore(breakdown);
      expect(result).toBe(100);
    });

    it('should handle decimal scores with proper rounding', () => {
      const breakdown: ScoreBreakdown = {
        risks: { score: 73.5, weight: 0.30 },
        controls: { score: 81.3, weight: 0.40 },
        documents: { score: 65.8, weight: 0.10 },
        audits: { score: 77.2, weight: 0.20 },
      };
      // 73.5*0.30 + 81.3*0.40 + 65.8*0.10 + 77.2*0.20 = 22.05 + 32.52 + 6.58 + 15.44 = 76.59
      const result = ScoreService.calculateGlobalScore(breakdown);
      expect(result).toBe(76.59);
    });
  });
});
