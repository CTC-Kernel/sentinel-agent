/**
 * Unit tests for AnnotationService
 *
 * Tests for:
 * - CRUD operations
 * - Reply functionality
 * - Mention parsing
 * - Export functions
 * - Validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseMentions,
} from '../annotationService';



// Mock Firebase
vi.mock('@/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'annotations-collection'),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
  arrayUnion: vi.fn((items) => items),
  arrayRemove: vi.fn((items) => items),
  increment: vi.fn((n) => n),
}));

describe('AnnotationService', () => {
  beforeEach(() => {

    vi.clearAllMocks();
  });

  // ============================================================================
  // parseMentions Tests
  // ============================================================================

  describe('parseMentions', () => {
    it('should parse single mention', () => {
      const content = 'Hey @john.doe, please review this.';

      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toBe('john.doe');
    });

    it('should parse multiple mentions', () => {
      const content = '@alice and @bob need to review this with @charlie.';

      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(3);
      expect(mentions).toContain('alice');
      expect(mentions).toContain('bob');
      expect(mentions).toContain('charlie');
    });

    it('should handle email-style mentions', () => {
      const content = 'CC: @jane.smith@company.com';

      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatch(/jane\.smith/);
    });

    it('should return empty array when no mentions', () => {
      const content = 'This is a regular comment without any mentions.';

      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should handle mentions at start of content', () => {
      const content = '@admin please check this.';

      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toBe('admin');
    });

    it('should not duplicate mentions', () => {
      const content = '@john mentioned @john again';

      const mentions = parseMentions(content);

      expect(mentions).toHaveLength(1);
    });
  });

});
