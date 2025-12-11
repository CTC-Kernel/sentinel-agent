/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '@/services/notificationService';
import { collection, doc, getDocs, query, where, orderBy, limit, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserProfile } from '@/types';

// Mock Firebase
vi.mock('@/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  Timestamp: vi.fn(),
  initializeFirestore: vi.fn(),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn()
}));

describe('NotificationService', () => {
  const mockUser: UserProfile = {
    uid: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
    role: 'user',
    organizationId: 'org-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification with required fields', async () => {
      const mockAddDoc = vi.mocked(addDoc);
      const mockCollection = vi.fn().mockReturnValue('collection-ref');
      vi.mocked(collection).mockImplementation(mockCollection as any);

      await NotificationService.create(
        mockUser,
        'warning',
        'Test Notification',
        'Test message',
        '/test'
      );

      expect(collection).toHaveBeenCalledWith(db, 'notifications');
      expect(mockAddDoc).toHaveBeenCalledWith(
        'collection-ref',
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-123',
          type: 'warning',
          title: 'Test Notification',
          message: 'Test message',
          link: '/test',
          read: false,
          createdAt: expect.any(String)
        })
      );
    });
  });

  describe('getAll', () => {
    it('should fetch notifications for a user', async () => {
      const mockDocs = [
        { id: 'n1', data: () => ({ title: 'Notif 1', read: false }) },
        { id: 'n2', data: () => ({ title: 'Notif 2', read: true }) }
      ];
      vi.mocked(getDocs).mockResolvedValue({ docs: mockDocs } as any);

      const result = await NotificationService.getAll('user-123', 10);

      expect(getDocs).toHaveBeenCalledWith(
        query(
          collection(db, 'notifications'),
          where('userId', '==', 'user-123'),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'n1', title: 'Notif 1', read: false });
    });
  });

  describe('getUnread', () => {
    it('should return unread notifications', async () => {
      const mockDocs = [
        { id: 'n1', data: () => ({ read: false }) },
        { id: 'n2', data: () => ({ read: false }) },
        { id: 'n3', data: () => ({ read: true }) }
      ];
      vi.mocked(getDocs).mockResolvedValue({ docs: mockDocs } as any);

      const result = await NotificationService.getUnread('user-123');

      expect(getDocs).toHaveBeenCalledWith(
        query(
          collection(db, 'notifications'),
          where('userId', '==', 'user-123'),
          where('read', '==', false),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      );
      expect(result).toHaveLength(3);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockUpdateDoc = vi.mocked(updateDoc);
      const mockDoc = vi.fn().mockReturnValue('doc-ref');
      vi.mocked(doc).mockImplementation(mockDoc as any);

      await NotificationService.markAsRead('notif-123');

      expect(doc).toHaveBeenCalledWith(db, 'notifications', 'notif-123');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'doc-ref',
        { read: true }
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      const mockDocs = [
        { id: 'n1', ref: 'ref1', data: () => ({ userId: 'user-123', read: false }) },
        { id: 'n2', ref: 'ref2', data: () => ({ userId: 'user-123', read: false }) }
      ];
      vi.mocked(getDocs).mockResolvedValue({ docs: mockDocs } as any);
      const mockUpdateDoc = vi.mocked(updateDoc);

      await NotificationService.markAllAsRead('user-123');

      expect(getDocs).toHaveBeenCalledWith(
        query(
          collection(db, 'notifications'),
          where('userId', '==', 'user-123'),
          where('read', '==', false)
        )
      );
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('runAutomatedChecks', () => {
    it('should run all automated check functions', async () => {
      const checkUpcomingAudits = vi.spyOn(NotificationService as any, 'checkUpcomingAudits').mockResolvedValue(undefined);
      const checkOverdueDocuments = vi.spyOn(NotificationService as any, 'checkOverdueDocuments').mockResolvedValue(undefined);
      const checkUpcomingMaintenance = vi.spyOn(NotificationService as any, 'checkUpcomingMaintenance').mockResolvedValue(undefined);
      const checkCriticalRisks = vi.spyOn(NotificationService as any, 'checkCriticalRisks').mockResolvedValue(undefined);

      await NotificationService.runAutomatedChecks('org-123');

      expect(checkUpcomingAudits).toHaveBeenCalledWith('org-123');
      expect(checkOverdueDocuments).toHaveBeenCalledWith('org-123');
      expect(checkUpcomingMaintenance).toHaveBeenCalledWith('org-123');
      expect(checkCriticalRisks).toHaveBeenCalledWith('org-123');
    });

    it('should not fail if individual checks fail', async () => {
      vi.spyOn(NotificationService as any, 'checkUpcomingAudits').mockRejectedValue(new Error('Audit check failed'));
      vi.spyOn(NotificationService as any, 'checkOverdueDocuments').mockResolvedValue(undefined);
      vi.spyOn(NotificationService as any, 'checkUpcomingMaintenance').mockResolvedValue(undefined);
      vi.spyOn(NotificationService as any, 'checkCriticalRisks').mockResolvedValue(undefined);

      await expect(NotificationService.runAutomatedChecks('org-123')).resolves.toBeUndefined();
    });
  });

  describe('createForOrganization', () => {
    it('should create notifications for all users in organization', async () => {
      const mockUsers = [
        { id: 'u1', data: () => ({ uid: 'u1', displayName: 'User 1', email: 'u1@example.com' }) },
        { id: 'u2', data: () => ({ uid: 'u2', displayName: 'User 2', email: 'u2@example.com' }) }
      ];
      const mockAddDoc = vi.mocked(addDoc).mockResolvedValue({ id: 'notif-123' } as any);
      const mockCollection = vi.fn().mockReturnValue('collection-ref');
      vi.mocked(collection).mockImplementation(mockCollection as any);
      vi.mocked(getDocs).mockResolvedValue({ docs: mockUsers } as any);

      await NotificationService.createForOrganization('org-123', 'info', 'System Update', 'System will be updated tonight');

      expect(getDocs).toHaveBeenCalledWith(
        query(collection(db, 'users'), where('organizationId', '==', 'org-123'))
      );
      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });
  });
});
