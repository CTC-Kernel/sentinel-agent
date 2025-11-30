/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAction } from '../../services/logger';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn()
}));

describe('logger', () => {
  const mockUser = {
    uid: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAction', () => {
    it('should log user action to Firestore', async () => {
      const mockAddDoc = vi.mocked(addDoc);
      const mockCollection = vi.fn().mockReturnValue('collection-ref');
      vi.mocked(collection).mockImplementation(mockCollection as any);

      await logAction(mockUser, 'CREATE', 'Asset', 'Created new asset: Server 01');

      expect(collection).toHaveBeenCalledWith(db, 'system_logs');
      expect(mockAddDoc).toHaveBeenCalledWith('collection-ref', expect.objectContaining({
        organizationId: 'org-123',
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: 'CREATE',
        resource: 'Asset',
        details: 'Created new asset: Server 01',
        timestamp: expect.any(String)
      }));
    });

    it('should handle null user gracefully', async () => {
      const mockAddDoc = vi.mocked(addDoc);

      await logAction(null, 'SYSTEM', 'Backup', 'Automatic backup completed');

      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should handle user without organizationId', async () => {
      const mockAddDoc = vi.mocked(addDoc);
      const userWithoutOrg = {
        uid: 'user-123',
        email: 'test@example.com'
      };

      await logAction(userWithoutOrg, 'LOGIN', 'Auth', 'User logged in');

      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should log action without details', async () => {
      const mockAddDoc = vi.mocked(addDoc);
      const mockCollection = vi.fn().mockReturnValue('collection-ref');
      vi.mocked(collection).mockImplementation(mockCollection as any);

      await logAction(mockUser, 'DELETE', 'Risk');

      expect(mockAddDoc).toHaveBeenCalledWith('collection-ref', expect.objectContaining({
        organizationId: 'org-123',
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: 'DELETE',
        resource: 'Risk',
        details: '',
        timestamp: expect.any(String)
      }));
    });

    it('should handle Firestore errors gracefully', async () => {
      const mockAddDoc = vi.mocked(addDoc);
      const mockCollection = vi.fn().mockReturnValue('collection-ref');
      vi.mocked(collection).mockImplementation(mockCollection as any);
      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      await logAction(mockUser, 'CREATE', 'Asset', 'Test error');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
