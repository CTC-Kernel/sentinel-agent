/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAction } from '@/services/logger';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase';

// Mock Firebase
vi.mock('../../firebase', () => ({
  functions: {}
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

// Mock ErrorLogger
vi.mock('@/services/errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
    warn: vi.fn()
  }
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
    it('should call logEvent cloud function', async () => {
      const mockLogEvent = vi.fn().mockResolvedValue({ data: { success: true } });
      vi.mocked(httpsCallable).mockReturnValue(mockLogEvent as any);

      await logAction(mockUser, 'CREATE', 'Asset', 'Created new asset: Server 01');

      expect(httpsCallable).toHaveBeenCalledWith(functions, 'logEvent');
      expect(mockLogEvent).toHaveBeenCalledWith({
        organizationId: 'org-123',
        action: 'CREATE',
        resource: 'Asset',
        details: 'Created new asset: Server 01'
      });
    });

    it('should handle null user gracefully', async () => {
      const mockLogEvent = vi.fn();
      vi.mocked(httpsCallable).mockReturnValue(mockLogEvent as any);

      await logAction(null, 'SYSTEM', 'Backup', 'Automatic backup completed');

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('should handle user without organizationId', async () => {
      const mockLogEvent = vi.fn();
      vi.mocked(httpsCallable).mockReturnValue(mockLogEvent as any);

      const userWithoutOrg = {
        uid: 'user-123',
        email: 'test@example.com'
      };

      await logAction(userWithoutOrg, 'LOGIN', 'Auth', 'User logged in');

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('should log action without details', async () => {
      const mockLogEvent = vi.fn().mockResolvedValue({ data: { success: true } });
      vi.mocked(httpsCallable).mockReturnValue(mockLogEvent as any);

      await logAction(mockUser, 'DELETE', 'Risk');

      expect(mockLogEvent).toHaveBeenCalledWith({
        organizationId: 'org-123',
        action: 'DELETE',
        resource: 'Risk',
        details: ''
      });
    });

    it('should handle Cloud Function errors gracefully', async () => {
      const mockLogEvent = vi.fn().mockRejectedValue(new Error('Cloud Function error'));
      vi.mocked(httpsCallable).mockReturnValue(mockLogEvent as any);

      // We need to import ErrorLogger to check if it was called
      const { ErrorLogger } = await import("@/services/errorLogger");

      await logAction(mockUser, 'CREATE', 'Asset', 'Test error');

      expect(ErrorLogger.error).toHaveBeenCalled();
    });
  });
});
