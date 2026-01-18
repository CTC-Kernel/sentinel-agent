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

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  AnnotationService,
  parseMentions,
  formatAnnotationContent,
  validateAnnotationContent,
  sortAnnotations,
  groupAnnotationsByNode,
  getAnnotationThreadDepth,
} from '../annotationService';
import type {
  VoxelAnnotation,
  AnnotationReply,
  CreateAnnotationDTO,
  CreateReplyDTO,
  UpdateAnnotationDTO,
  AnnotationFilters,
} from '@/types/voxelAnnotation';
import {
  createVoxelAnnotation,
  createAnnotationReply,
  createAnnotationDTO,
  createReplyDTO,
  createAnnotationAuthor,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

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
    resetIdCounter();
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

  // ============================================================================
  // formatAnnotationContent Tests
  // ============================================================================

  describe('formatAnnotationContent', () => {
    it('should trim whitespace', () => {
      const content = '  Hello world  ';

      const formatted = formatAnnotationContent(content);

      expect(formatted).toBe('Hello world');
    });

    it('should normalize line breaks', () => {
      const content = 'Line 1\r\nLine 2\rLine 3';

      const formatted = formatAnnotationContent(content);

      expect(formatted).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should limit consecutive newlines', () => {
      const content = 'Paragraph 1\n\n\n\n\nParagraph 2';

      const formatted = formatAnnotationContent(content);

      expect(formatted).toBe('Paragraph 1\n\nParagraph 2');
    });

    it('should handle empty content', () => {
      const content = '   ';

      const formatted = formatAnnotationContent(content);

      expect(formatted).toBe('');
    });
  });

  // ============================================================================
  // validateAnnotationContent Tests
  // ============================================================================

  describe('validateAnnotationContent', () => {
    it('should accept valid content', () => {
      const result = validateAnnotationContent('This is a valid annotation.');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty content', () => {
      const result = validateAnnotationContent('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content cannot be empty');
    });

    it('should reject whitespace-only content', () => {
      const result = validateAnnotationContent('   \n\t  ');

      expect(result.valid).toBe(false);
    });

    it('should reject content exceeding max length', () => {
      const longContent = 'a'.repeat(10001);

      const result = validateAnnotationContent(longContent);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('length'))).toBe(true);
    });

    it('should accept content at max length', () => {
      const maxContent = 'a'.repeat(10000);

      const result = validateAnnotationContent(maxContent);

      expect(result.valid).toBe(true);
    });

    it('should detect potentially harmful content', () => {
      const result = validateAnnotationContent('<script>alert("xss")</script>');

      expect(result.warnings?.some((w) => w.includes('script'))).toBe(true);
    });
  });

  // ============================================================================
  // sortAnnotations Tests
  // ============================================================================

  describe('sortAnnotations', () => {
    const createAnnotationWithDate = (id: string, createdAt: string) =>
      createVoxelAnnotation({ id, createdAt, updatedAt: createdAt });

    it('should sort by created date descending by default', () => {
      const annotations = [
        createAnnotationWithDate('1', '2024-01-01T10:00:00Z'),
        createAnnotationWithDate('2', '2024-01-03T10:00:00Z'),
        createAnnotationWithDate('3', '2024-01-02T10:00:00Z'),
      ];

      const sorted = sortAnnotations(annotations);

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should sort by created date ascending', () => {
      const annotations = [
        createAnnotationWithDate('1', '2024-01-01T10:00:00Z'),
        createAnnotationWithDate('2', '2024-01-03T10:00:00Z'),
        createAnnotationWithDate('3', '2024-01-02T10:00:00Z'),
      ];

      const sorted = sortAnnotations(annotations, { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('2');
    });

    it('should sort by reply count', () => {
      const annotations = [
        createVoxelAnnotation({ id: '1', replyCount: 5 }),
        createVoxelAnnotation({ id: '2', replyCount: 2 }),
        createVoxelAnnotation({ id: '3', replyCount: 10 }),
      ];

      const sorted = sortAnnotations(annotations, { sortBy: 'replyCount', sortOrder: 'desc' });

      expect(sorted[0].id).toBe('3');
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('2');
    });

    it('should prioritize pinned annotations', () => {
      const annotations = [
        createAnnotationWithDate('1', '2024-01-01T10:00:00Z'),
        createVoxelAnnotation({ id: '2', createdAt: '2024-01-01T10:00:00Z', isPinned: true }),
        createAnnotationWithDate('3', '2024-01-03T10:00:00Z'),
      ];

      const sorted = sortAnnotations(annotations, { pinnedFirst: true });

      expect(sorted[0].id).toBe('2');
    });
  });

  // ============================================================================
  // groupAnnotationsByNode Tests
  // ============================================================================

  describe('groupAnnotationsByNode', () => {
    it('should group annotations by nodeId', () => {
      const annotations = [
        createVoxelAnnotation({ id: '1', nodeId: 'node-a' }),
        createVoxelAnnotation({ id: '2', nodeId: 'node-b' }),
        createVoxelAnnotation({ id: '3', nodeId: 'node-a' }),
        createVoxelAnnotation({ id: '4', nodeId: undefined }),
      ];

      const grouped = groupAnnotationsByNode(annotations);

      expect(grouped.get('node-a')).toHaveLength(2);
      expect(grouped.get('node-b')).toHaveLength(1);
      expect(grouped.get('_global')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupAnnotationsByNode([]);

      expect(grouped.size).toBe(0);
    });
  });

  // ============================================================================
  // getAnnotationThreadDepth Tests
  // ============================================================================

  describe('getAnnotationThreadDepth', () => {
    it('should return 1 for annotation without replies', () => {
      const annotation = createVoxelAnnotation({ replies: [] });

      const depth = getAnnotationThreadDepth(annotation);

      expect(depth).toBe(1);
    });

    it('should return 2 for annotation with flat replies', () => {
      const annotation = createVoxelAnnotation({
        replies: [
          createAnnotationReply('ann-1'),
          createAnnotationReply('ann-1'),
        ],
      });

      const depth = getAnnotationThreadDepth(annotation);

      expect(depth).toBe(2);
    });
  });

  // ============================================================================
  // AnnotationService Class Methods Tests
  // ============================================================================

  describe('AnnotationService.filterAnnotations', () => {
    const annotations = [
      createVoxelAnnotation({
        id: '1',
        type: 'note',
        status: 'open',
        author: createAnnotationAuthor({ id: 'user-1' }),
        nodeId: 'node-a',
      }),
      createVoxelAnnotation({
        id: '2',
        type: 'question',
        status: 'resolved',
        author: createAnnotationAuthor({ id: 'user-2' }),
        nodeId: 'node-b',
      }),
      createVoxelAnnotation({
        id: '3',
        type: 'note',
        status: 'open',
        author: createAnnotationAuthor({ id: 'user-1' }),
        nodeId: 'node-a',
      }),
    ];

    it('should filter by type', () => {
      const filtered = AnnotationService.filterAnnotations(annotations, {
        types: ['question'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should filter by status', () => {
      const filtered = AnnotationService.filterAnnotations(annotations, {
        statuses: ['open'],
      });

      expect(filtered).toHaveLength(2);
    });

    it('should filter by author', () => {
      const filtered = AnnotationService.filterAnnotations(annotations, {
        authorId: 'user-1',
      });

      expect(filtered).toHaveLength(2);
    });

    it('should filter by nodeId', () => {
      const filtered = AnnotationService.filterAnnotations(annotations, {
        nodeId: 'node-a',
      });

      expect(filtered).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const filtered = AnnotationService.filterAnnotations(annotations, {
        types: ['note'],
        statuses: ['open'],
        nodeId: 'node-a',
      });

      expect(filtered).toHaveLength(2);
    });

    it('should filter by search query', () => {
      const annotationsWithContent = [
        createVoxelAnnotation({ id: '1', content: 'This is about security' }),
        createVoxelAnnotation({ id: '2', content: 'This is about compliance' }),
        createVoxelAnnotation({ id: '3', content: 'Security and compliance together' }),
      ];

      const filtered = AnnotationService.filterAnnotations(annotationsWithContent, {
        searchQuery: 'security',
      });

      expect(filtered).toHaveLength(2);
    });
  });

  describe('AnnotationService.getStatistics', () => {
    it('should calculate statistics correctly', () => {
      const annotations = [
        createVoxelAnnotation({
          type: 'note',
          status: 'open',
          replyCount: 3,
          author: createAnnotationAuthor({ id: 'user-1' }),
        }),
        createVoxelAnnotation({
          type: 'question',
          status: 'open',
          replyCount: 5,
          author: createAnnotationAuthor({ id: 'user-2' }),
        }),
        createVoxelAnnotation({
          type: 'note',
          status: 'resolved',
          replyCount: 0,
          author: createAnnotationAuthor({ id: 'user-1' }),
        }),
      ];

      const stats = AnnotationService.getStatistics(annotations);

      expect(stats.total).toBe(3);
      expect(stats.byType.note).toBe(2);
      expect(stats.byType.question).toBe(1);
      expect(stats.byStatus.open).toBe(2);
      expect(stats.byStatus.resolved).toBe(1);
      expect(stats.totalReplies).toBe(8);
      expect(stats.uniqueAuthors).toBe(2);
    });

    it('should handle empty array', () => {
      const stats = AnnotationService.getStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.totalReplies).toBe(0);
      expect(stats.uniqueAuthors).toBe(0);
    });
  });

  describe('AnnotationService.exportToJSON', () => {
    it('should export annotations to JSON string', () => {
      const annotations = [
        createVoxelAnnotation({ id: '1', content: 'Test annotation' }),
        createVoxelAnnotation({ id: '2', content: 'Another annotation' }),
      ];

      const json = AnnotationService.exportToJSON(annotations);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('1');
    });

    it('should include metadata when specified', () => {
      const annotations = [createVoxelAnnotation()];
      const metadata = { exportDate: new Date().toISOString(), version: '1.0' };

      const json = AnnotationService.exportToJSON(annotations, metadata);

      const parsed = JSON.parse(json);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.version).toBe('1.0');
    });
  });

  describe('AnnotationService.exportToCSV', () => {
    it('should export annotations to CSV format', () => {
      const annotations = [
        createVoxelAnnotation({
          id: '1',
          content: 'Test content',
          author: createAnnotationAuthor({ displayName: 'John Doe' }),
          type: 'note',
          status: 'open',
        }),
      ];

      const csv = AnnotationService.exportToCSV(annotations);

      expect(csv).toContain('ID');
      expect(csv).toContain('Content');
      expect(csv).toContain('Author');
      expect(csv).toContain('John Doe');
      expect(csv).toContain('note');
      expect(csv).toContain('open');
    });

    it('should escape special characters in CSV', () => {
      const annotations = [
        createVoxelAnnotation({
          content: 'Content with "quotes" and, commas',
        }),
      ];

      const csv = AnnotationService.exportToCSV(annotations);

      // Should properly escape quotes
      expect(csv).toContain('"');
    });

    it('should handle newlines in content', () => {
      const annotations = [
        createVoxelAnnotation({
          content: 'Line 1\nLine 2',
        }),
      ];

      const csv = AnnotationService.exportToCSV(annotations);

      // Should be quoted to handle newline
      expect(csv).toMatch(/"/);
    });
  });

  // ============================================================================
  // DTO Validation Tests
  // ============================================================================

  describe('AnnotationService.validateCreateDTO', () => {
    it('should validate valid CreateAnnotationDTO', () => {
      const dto: CreateAnnotationDTO = createAnnotationDTO({
        content: 'Valid content',
        type: 'note',
        visibility: 'public',
      });

      const result = AnnotationService.validateCreateDTO(dto);

      expect(result.valid).toBe(true);
    });

    it('should reject empty content', () => {
      const dto: CreateAnnotationDTO = createAnnotationDTO({ content: '' });

      const result = AnnotationService.validateCreateDTO(dto);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid type', () => {
      const dto = createAnnotationDTO({
        type: 'invalid-type' as any,
      });

      const result = AnnotationService.validateCreateDTO(dto);

      expect(result.valid).toBe(false);
    });
  });

  describe('AnnotationService.validateReplyDTO', () => {
    it('should validate valid CreateReplyDTO', () => {
      const dto: CreateReplyDTO = createReplyDTO('annotation-1', {
        content: 'Valid reply content',
      });

      const result = AnnotationService.validateReplyDTO(dto);

      expect(result.valid).toBe(true);
    });

    it('should reject empty content', () => {
      const dto: CreateReplyDTO = createReplyDTO('annotation-1', { content: '' });

      const result = AnnotationService.validateReplyDTO(dto);

      expect(result.valid).toBe(false);
    });

    it('should reject missing annotationId', () => {
      const dto = { content: 'Reply content' } as CreateReplyDTO;

      const result = AnnotationService.validateReplyDTO(dto);

      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // Thread Operations Tests
  // ============================================================================

  describe('AnnotationService.flattenThread', () => {
    it('should flatten annotation with replies', () => {
      const annotation = createVoxelAnnotation({
        id: 'ann-1',
        replies: [
          createAnnotationReply('ann-1', { id: 'reply-1' }),
          createAnnotationReply('ann-1', { id: 'reply-2' }),
        ],
      });

      const flattened = AnnotationService.flattenThread(annotation);

      expect(flattened).toHaveLength(3);
      expect(flattened[0].id).toBe('ann-1');
      expect(flattened[1].id).toBe('reply-1');
      expect(flattened[2].id).toBe('reply-2');
    });

    it('should handle annotation without replies', () => {
      const annotation = createVoxelAnnotation({ replies: [] });

      const flattened = AnnotationService.flattenThread(annotation);

      expect(flattened).toHaveLength(1);
    });
  });

  describe('AnnotationService.getReplyCount', () => {
    it('should count direct replies', () => {
      const annotation = createVoxelAnnotation({
        replies: [
          createAnnotationReply('ann-1'),
          createAnnotationReply('ann-1'),
          createAnnotationReply('ann-1'),
        ],
      });

      const count = AnnotationService.getReplyCount(annotation);

      expect(count).toBe(3);
    });

    it('should return 0 for no replies', () => {
      const annotation = createVoxelAnnotation({ replies: [] });

      const count = AnnotationService.getReplyCount(annotation);

      expect(count).toBe(0);
    });
  });

  describe('AnnotationService.getMentionedUsers', () => {
    it('should extract mentioned users from annotation and replies', () => {
      const annotation = createVoxelAnnotation({
        content: '@alice mentioned here',
        replies: [
          createAnnotationReply('ann-1', { content: '@bob in reply' }),
          createAnnotationReply('ann-1', { content: '@charlie also' }),
        ],
      });

      const mentioned = AnnotationService.getMentionedUsers(annotation);

      expect(mentioned).toContain('alice');
      expect(mentioned).toContain('bob');
      expect(mentioned).toContain('charlie');
    });

    it('should return unique mentions', () => {
      const annotation = createVoxelAnnotation({
        content: '@alice mentioned twice @alice',
        replies: [
          createAnnotationReply('ann-1', { content: '@alice in reply too' }),
        ],
      });

      const mentioned = AnnotationService.getMentionedUsers(annotation);

      expect(mentioned.filter((m) => m === 'alice')).toHaveLength(1);
    });
  });
});
