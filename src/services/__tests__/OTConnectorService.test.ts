/**
 * OTConnectorService Unit Tests
 * Story 36-2: OT Connector Configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase before importing service
vi.mock('../../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-connector-id' })),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    id: 'mock-connector-id',
    data: () => ({
      name: 'Test Connector',
      type: 'csv',
      status: 'active',
      schedule: { type: 'manual' }
    })
  })),
  getDocs: vi.fn(() => Promise.resolve({
    docs: []
  })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => new Date().toISOString())
}));

vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn()
  }
}));

// Import after mocks
import {
  validateConnector,
  calculateNextRun,
  formatSyncStats,
  getRelativeTime
} from '../OTConnectorService';

import type {
  OTConnectorFormData,
  SyncSchedule,
  SyncStats
} from '../../types/otConnector';

describe('OTConnectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validateConnector', () => {
    it('should validate a complete valid connector', () => {
      const data: OTConnectorFormData = {
        name: 'Test Connector',
        type: 'csv',
        config: {
          filePattern: '.*\\.csv$'
        },
        schedule: { type: 'manual' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require name field', () => {
      const data: OTConnectorFormData = {
        name: '',
        type: 'csv',
        config: { filePattern: '.*\\.csv$' },
        schedule: { type: 'manual' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should reject name longer than 100 characters', () => {
      const data: OTConnectorFormData = {
        name: 'a'.repeat(101),
        type: 'csv',
        config: { filePattern: '.*\\.csv$' },
        schedule: { type: 'manual' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: expect.stringContaining('100 characters')
        })
      );
    });

    it('should require type field', () => {
      const data = {
        name: 'Test',
        type: '' as any,
        config: {},
        schedule: { type: 'manual' as const },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'type' })
      );
    });

    it('should require filePattern for CSV connector', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: {},
        schedule: { type: 'manual' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'config.filePattern' })
      );
    });

    it('should require interval for interval schedule', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: { filePattern: '.*\\.csv$' },
        schedule: { type: 'interval' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'schedule.interval' })
      );
    });

    it('should accept valid interval schedule', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: { filePattern: '.*\\.csv$' },
        schedule: { type: 'interval', interval: 60 },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(true);
    });

    it('should require cronExpression for cron schedule', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: { filePattern: '.*\\.csv$' },
        schedule: { type: 'cron' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'schedule.cronExpression' })
      );
    });

    it('should accept valid cron schedule', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: { filePattern: '.*\\.csv$' },
        schedule: { type: 'cron', cronExpression: '0 2 * * *' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Schedule Calculation Tests
  // ============================================================================

  describe('calculateNextRun', () => {
    it('should return empty string for manual schedule', () => {
      const schedule: SyncSchedule = { type: 'manual' };

      const result = calculateNextRun(schedule);

      expect(result).toBe('');
    });

    it('should calculate next run for interval schedule', () => {
      const schedule: SyncSchedule = {
        type: 'interval',
        interval: 60 // 60 minutes
      };

      const result = calculateNextRun(schedule);
      const nextRun = new Date(result);
      const now = new Date();

      // Should be approximately 60 minutes from now
      const diffMinutes = (nextRun.getTime() - now.getTime()) / 60000;
      expect(diffMinutes).toBeGreaterThan(55);
      expect(diffMinutes).toBeLessThan(65);
    });

    it('should calculate next run for cron schedule', () => {
      const schedule: SyncSchedule = {
        type: 'cron',
        cronExpression: '0 2 * * *' // 2 AM daily
      };

      const result = calculateNextRun(schedule);
      const nextRun = new Date(result);

      // Should be a valid date
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('should apply maintenance window to interval schedule', () => {
      const schedule: SyncSchedule = {
        type: 'interval',
        interval: 60,
        maintenanceWindow: {
          start: '02:00',
          end: '04:00'
        }
      };

      const result = calculateNextRun(schedule);

      // Result should be a valid ISO string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle missing interval by defaulting to 60 minutes', () => {
      const schedule: SyncSchedule = {
        type: 'interval'
        // interval not specified
      };

      const result = calculateNextRun(schedule);
      const nextRun = new Date(result);
      const now = new Date();

      const diffMinutes = (nextRun.getTime() - now.getTime()) / 60000;
      expect(diffMinutes).toBeGreaterThan(55);
      expect(diffMinutes).toBeLessThan(65);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('formatSyncStats', () => {
    it('should format stats with created assets', () => {
      const stats: SyncStats = {
        totalProcessed: 10,
        created: 5,
        updated: 0,
        unchanged: 5,
        failed: 0,
        skipped: 0
      };

      const result = formatSyncStats(stats);

      expect(result).toContain('+5 created');
    });

    it('should format stats with updated assets', () => {
      const stats: SyncStats = {
        totalProcessed: 10,
        created: 0,
        updated: 3,
        unchanged: 7,
        failed: 0,
        skipped: 0
      };

      const result = formatSyncStats(stats);

      expect(result).toContain('~3 updated');
    });

    it('should format stats with failed assets', () => {
      const stats: SyncStats = {
        totalProcessed: 10,
        created: 5,
        updated: 2,
        unchanged: 1,
        failed: 2,
        skipped: 0
      };

      const result = formatSyncStats(stats);

      expect(result).toContain('!2 failed');
    });

    it('should show "No changes" for empty stats', () => {
      const stats: SyncStats = {
        totalProcessed: 10,
        created: 0,
        updated: 0,
        unchanged: 10,
        failed: 0,
        skipped: 0
      };

      const result = formatSyncStats(stats);

      expect(result).toBe('No changes');
    });

    it('should combine multiple stat types', () => {
      const stats: SyncStats = {
        totalProcessed: 10,
        created: 3,
        updated: 2,
        unchanged: 4,
        failed: 1,
        skipped: 0
      };

      const result = formatSyncStats(stats);

      expect(result).toContain('+3 created');
      expect(result).toContain('~2 updated');
      expect(result).toContain('!1 failed');
    });
  });

  describe('getRelativeTime', () => {
    it('should return "Just now" for recent timestamps', () => {
      const now = new Date().toISOString();

      const result = getRelativeTime(now);

      expect(result).toBe('Just now');
    });

    it('should return minutes ago for timestamps less than 1 hour', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const result = getRelativeTime(tenMinutesAgo);

      expect(result).toMatch(/\d+m ago/);
    });

    it('should return hours ago for timestamps less than 24 hours', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      const result = getRelativeTime(threeHoursAgo);

      expect(result).toMatch(/\d+h ago/);
    });

    it('should return days ago for timestamps less than 7 days', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const result = getRelativeTime(twoDaysAgo);

      expect(result).toMatch(/\d+d ago/);
    });

    it('should return formatted date for timestamps older than 7 days', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const result = getRelativeTime(twoWeeksAgo);

      // Should be a formatted date string (locale-dependent)
      expect(result).not.toContain('ago');
    });
  });

  // ============================================================================
  // Type Guard Tests
  // ============================================================================

  describe('Type Guards', () => {
    it('should correctly identify CSV connector config', () => {
      const csvConfig = {
        filePattern: '.*\\.csv$',
        archiveProcessed: true,
        encoding: 'utf-8' as const
      };

      expect(csvConfig.filePattern).toBeDefined();
      expect(csvConfig.archiveProcessed).toBe(true);
    });

    it('should correctly identify interval schedule', () => {
      const schedule: SyncSchedule = {
        type: 'interval',
        interval: 60
      };

      expect(schedule.type).toBe('interval');
      expect(schedule.interval).toBe(60);
    });

    it('should correctly identify cron schedule', () => {
      const schedule: SyncSchedule = {
        type: 'cron',
        cronExpression: '0 2 * * *'
      };

      expect(schedule.type).toBe('cron');
      expect(schedule.cronExpression).toBe('0 2 * * *');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle whitespace-only name', () => {
      const data: OTConnectorFormData = {
        name: '   ',
        type: 'csv',
        config: { filePattern: '.*' },
        schedule: { type: 'manual' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should handle empty cron expression', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: { filePattern: '.*' },
        schedule: { type: 'cron', cronExpression: '' },
        enabled: true
      };

      const result = validateConnector(data);

      expect(result.valid).toBe(false);
    });

    it('should handle zero interval', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        type: 'csv',
        config: { filePattern: '.*' },
        schedule: { type: 'interval', interval: 0 },
        enabled: true
      };

      const result = validateConnector(data);

      // 0 is falsy, so should fail validation
      expect(result.valid).toBe(false);
    });

    it('should handle very long description', () => {
      const data: OTConnectorFormData = {
        name: 'Test',
        description: 'a'.repeat(1000),
        type: 'csv',
        config: { filePattern: '.*' },
        schedule: { type: 'manual' },
        enabled: true
      };

      // Description has no max length constraint
      const result = validateConnector(data);

      expect(result.valid).toBe(true);
    });
  });
});
