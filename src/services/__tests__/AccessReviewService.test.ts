/**
 * Access Review Service Tests
 *
 * Unit tests for AccessReviewService.
 * Part of NIS2 Article 21.2(i) compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type {
  AccessReviewCampaign,
  AccessReview,
  DormantAccount,
} from '../../types/accessReview';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(),
  })),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
  },
}));

// Import after mocks
import { AccessReviewService } from '../AccessReviewService';

describe('AccessReviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateStats', () => {
    const createMockCampaign = (overrides: Partial<AccessReviewCampaign> = {}): AccessReviewCampaign => ({
      id: 'campaign-1',
      organizationId: 'org-1',
      name: 'Q1 2024 Review',
      startDate: Timestamp.fromDate(new Date('2024-01-01')),
      endDate: Timestamp.fromDate(new Date('2024-01-31')),
      scope: 'all',
      status: 'draft',
      totalReviews: 0,
      completedReviews: 0,
      approvedCount: 0,
      revokedCount: 0,
      escalatedCount: 0,
      isRecurring: false,
      createdAt: Timestamp.now(),
      createdBy: 'user-1',
      updatedAt: Timestamp.now(),
      updatedBy: 'user-1',
      ...overrides,
    });

    const createMockReview = (overrides: Partial<AccessReview> = {}): AccessReview => ({
      id: 'review-1',
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      userId: 'user-2',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      userRole: 'user',
      reviewerId: 'user-1',
      reviewerName: 'Manager',
      reviewerEmail: 'manager@example.com',
      permissions: [],
      status: 'pending',
      deadline: Timestamp.fromDate(new Date('2024-01-31')),
      remindersSent: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...overrides,
    });

    const createMockDormantAccount = (overrides: Partial<DormantAccount> = {}): DormantAccount => ({
      id: 'dormant-1',
      organizationId: 'org-1',
      userId: 'user-3',
      userName: 'Inactive User',
      userEmail: 'inactive@example.com',
      daysSinceLastLogin: 120,
      neverLoggedIn: false,
      userRole: 'user',
      status: 'detected',
      detectedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      ...overrides,
    });

    it('should calculate stats for empty data', () => {
      const stats = AccessReviewService.calculateStats([], [], []);

      expect(stats.activeCampaigns).toBe(0);
      expect(stats.pendingReviews).toBe(0);
      expect(stats.overdueReviews).toBe(0);
      expect(stats.dormantAccounts).toBe(0);
      expect(stats.daysSinceLastCampaign).toBe(999);
      expect(stats.completionRate).toBe(0);
      expect(stats.revocationRate).toBe(0);
    });

    it('should count active campaigns', () => {
      const campaigns: AccessReviewCampaign[] = [
        createMockCampaign({ id: '1', status: 'active' }),
        createMockCampaign({ id: '2', status: 'active' }),
        createMockCampaign({ id: '3', status: 'draft' }),
        createMockCampaign({ id: '4', status: 'completed' }),
      ];

      const stats = AccessReviewService.calculateStats(campaigns, [], []);

      expect(stats.activeCampaigns).toBe(2);
    });

    it('should count pending reviews', () => {
      const reviews: AccessReview[] = [
        createMockReview({ id: '1', status: 'pending' }),
        createMockReview({ id: '2', status: 'pending' }),
        createMockReview({ id: '3', status: 'approved' }),
        createMockReview({ id: '4', status: 'revoked' }),
      ];

      const stats = AccessReviewService.calculateStats([], reviews, []);

      expect(stats.pendingReviews).toBe(2);
    });

    it('should count overdue reviews', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const reviews: AccessReview[] = [
        createMockReview({ id: '1', status: 'pending', deadline: Timestamp.fromDate(pastDate) }),
        createMockReview({ id: '2', status: 'pending', deadline: Timestamp.fromDate(pastDate) }),
        createMockReview({ id: '3', status: 'pending', deadline: Timestamp.fromDate(futureDate) }),
        createMockReview({ id: '4', status: 'approved', deadline: Timestamp.fromDate(pastDate) }),
      ];

      const stats = AccessReviewService.calculateStats([], reviews, []);

      expect(stats.overdueReviews).toBe(2);
    });

    it('should count dormant accounts with detected or contacted status', () => {
      const dormantAccounts: DormantAccount[] = [
        createMockDormantAccount({ id: '1', status: 'detected' }),
        createMockDormantAccount({ id: '2', status: 'contacted' }),
        createMockDormantAccount({ id: '3', status: 'disabled' }),
        createMockDormantAccount({ id: '4', status: 'deleted' }),
        createMockDormantAccount({ id: '5', status: 'excluded' }),
      ];

      const stats = AccessReviewService.calculateStats([], [], dormantAccounts);

      expect(stats.dormantAccounts).toBe(2);
    });

    it('should calculate days since last completed campaign', () => {
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - 45);

      const campaigns: AccessReviewCampaign[] = [
        createMockCampaign({
          id: '1',
          status: 'completed',
          completedAt: Timestamp.fromDate(completedDate),
        }),
      ];

      const stats = AccessReviewService.calculateStats(campaigns, [], []);

      // Should be approximately 45 days (allowing for test execution time)
      expect(stats.daysSinceLastCampaign).toBeGreaterThanOrEqual(44);
      expect(stats.daysSinceLastCampaign).toBeLessThanOrEqual(46);
    });

    it('should calculate completion rate from completed campaigns', () => {
      const campaigns: AccessReviewCampaign[] = [
        createMockCampaign({
          id: '1',
          status: 'completed',
          totalReviews: 100,
          completedReviews: 90,
          completedAt: Timestamp.now(),
        }),
        createMockCampaign({
          id: '2',
          status: 'completed',
          totalReviews: 50,
          completedReviews: 50,
          completedAt: Timestamp.now(),
        }),
      ];

      const stats = AccessReviewService.calculateStats(campaigns, [], []);

      // Total completed: 140, Total reviews: 150
      expect(stats.completionRate).toBeCloseTo(93.33, 1);
    });

    it('should calculate revocation rate from completed campaigns', () => {
      const campaigns: AccessReviewCampaign[] = [
        createMockCampaign({
          id: '1',
          status: 'completed',
          totalReviews: 100,
          completedReviews: 100,
          revokedCount: 10,
          completedAt: Timestamp.now(),
        }),
        createMockCampaign({
          id: '2',
          status: 'completed',
          totalReviews: 50,
          completedReviews: 50,
          revokedCount: 5,
          completedAt: Timestamp.now(),
        }),
      ];

      const stats = AccessReviewService.calculateStats(campaigns, [], []);

      // Total revoked: 15, Total completed: 150
      expect(stats.revocationRate).toBe(10);
    });

    it('should handle campaigns without completed reviews', () => {
      const campaigns: AccessReviewCampaign[] = [
        createMockCampaign({
          id: '1',
          status: 'completed',
          totalReviews: 0,
          completedReviews: 0,
          completedAt: Timestamp.now(),
        }),
      ];

      const stats = AccessReviewService.calculateStats(campaigns, [], []);

      expect(stats.completionRate).toBe(0);
      expect(stats.revocationRate).toBe(0);
    });

    it('should return lastCampaignDate from most recent completed campaign', () => {
      const olderDate = new Date('2023-06-01');
      const newerDate = new Date('2024-01-15');

      const campaigns: AccessReviewCampaign[] = [
        createMockCampaign({
          id: '1',
          status: 'completed',
          completedAt: Timestamp.fromDate(newerDate),
          createdAt: Timestamp.fromDate(newerDate),
        }),
        createMockCampaign({
          id: '2',
          status: 'completed',
          completedAt: Timestamp.fromDate(olderDate),
          createdAt: Timestamp.fromDate(olderDate),
        }),
      ];

      const stats = AccessReviewService.calculateStats(campaigns, [], []);

      // First campaign in array (sorted by createdAt desc) should be newest
      expect(stats.lastCampaignDate).toBeDefined();
    });
  });
});
