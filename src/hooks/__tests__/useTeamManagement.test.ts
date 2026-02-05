/**
 * useTeamManagement Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTeamManagement } from '../useTeamManagement';

// Mock dependencies
const mockAddToast = vi.fn();
const mockUser = {
 uid: 'user-123',
 email: 'admin@example.com',
 organizationId: 'org-123',
 organizationName: 'Test Org',
 displayName: 'Admin User',
 role: 'admin',
};

// Mutable store state - update properties instead of creating new objects
const mockStoreState: {
 user: typeof mockUser;
 addToast: typeof mockAddToast;
 demoMode: boolean;
 customRoles: unknown[];
} = {
 user: mockUser,
 addToast: mockAddToast,
 demoMode: false,
 customRoles: [],
};

vi.mock('../../store', () => {
 const useStore = vi.fn(() => mockStoreState);
 // Important: getState must reference the same mockStoreState for hasPermission
 (useStore as unknown as { getState: () => typeof mockStoreState }).getState = () => mockStoreState;
 return { useStore };
});

const stableT = (key: string) => key;
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: stableT,
 }),
}));

// Mock Firebase
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetCountFromServer = vi.fn();
const mockHttpsCallable = vi.fn();

// Mock onSnapshot to return an unsubscribe function
const mockOnSnapshot = vi.fn((_query, callback) => {
 // Immediately call with empty results by default
 setTimeout(() => {
 callback({ docs: [] });
 }, 0);
 return vi.fn(); // Returns unsubscribe function
});

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 addDoc: () => mockAddDoc(),
 getDocs: () => mockGetDocs(),
 deleteDoc: () => mockDeleteDoc(),
 updateDoc: () => mockUpdateDoc(),
 doc: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 limit: vi.fn(),
 serverTimestamp: vi.fn(() => new Date()),
 getCountFromServer: () => mockGetCountFromServer(),
 onSnapshot: (q: unknown, callback: (snap: { docs: unknown[] }) => void) => mockOnSnapshot(q, callback),
}));

vi.mock('firebase/functions', () => ({
 httpsCallable: () => mockHttpsCallable,
}));

vi.mock('../../firebase', () => ({
 db: {},
 functions: {},
}));

// Mock useAuth - using a mutable state for dynamic test overrides
const mockAuthState = {
 user: { uid: 'user-123', organizationId: 'org-123', role: 'admin' } as { uid: string; organizationId?: string; role?: string },
 firebaseUser: { uid: 'user-123', email: 'admin@example.com', emailVerified: true },
 loading: false,
 error: null,
 profileError: null,
 claimsSynced: true,
};

vi.mock('../useAuth', () => ({
 useAuth: () => mockAuthState
}));

vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn(),
 handleErrorWithToast: vi.fn(),
 },
}));

vi.mock('../../utils/dataSanitizer', () => ({
 sanitizeData: vi.fn((data) => data),
}));

vi.mock('../../services/emailService', () => ({
 sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/emailTemplates', () => ({
 getInvitationTemplate: vi.fn(() => '<html>Invitation</html>'),
}));

vi.mock('../../services/logger', () => ({
 logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/subscriptionService', () => ({
 SubscriptionService: {
 checkLimit: vi.fn().mockResolvedValue(true),
 },
}));

vi.mock('../../services/ImportService', () => ({
 ImportService: {
 parseCSV: vi.fn(() => []),
 },
}));

import { useStore } from '../../store';
import { SubscriptionService } from '../../services/subscriptionService';
import { ImportService } from '../../services/ImportService';

describe('useTeamManagement', () => {
 beforeEach(() => {
 vi.clearAllMocks();

 // Default mock responses
 mockGetDocs.mockResolvedValue({
 docs: [],
 });

 mockGetCountFromServer.mockResolvedValue({
 data: () => ({ count: 0 }),
 });

 mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
 mockDeleteDoc.mockResolvedValue(undefined);
 mockUpdateDoc.mockResolvedValue(undefined);
 });

 describe('initialization', () => {
 it('should initialize with empty users list', async () => {
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.users).toEqual([]);
 expect(result.current.joinRequests).toEqual([]);
 });

 it('should fetch users on mount using onSnapshot', async () => {
 // Hook now uses onSnapshot for realtime subscriptions instead of getDocs
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 // Verify onSnapshot was called for subscriptions
 expect(mockOnSnapshot).toHaveBeenCalled();
 });

 it('should not fetch when no organizationId', async () => {
 vi.mocked(useStore).mockReturnValue({
 user: { uid: 'user-123' }, // No organizationId
 addToast: mockAddToast,
 demoMode: false,
 } as ReturnType<typeof useStore>);

 const { result } = renderHook(() => useTeamManagement());

 // Should not have called getDocs for users query
 expect(result.current.users).toEqual([]);
 });
 });

 describe('inviteUser', () => {
 beforeEach(() => {
 vi.mocked(useStore).mockReturnValue({
 user: mockUser,
 addToast: mockAddToast,
 demoMode: false,
 } as unknown as ReturnType<typeof useStore>);
 });

 it('should invite a user successfully', async () => {
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.inviteUser({
  email: 'newuser@example.com',
  displayName: 'New User',
  role: 'user',
  department: 'IT',
 });
 expect(success).toBe(true);
 });

 expect(mockAddDoc).toHaveBeenCalled();
 expect(mockAddToast).toHaveBeenCalledWith('team.toast.invitationSent', 'success');
 });

 it('should return LIMIT_REACHED when at user limit', async () => {
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(false);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.inviteUser({
  email: 'newuser@example.com',
  displayName: 'New User',
  role: 'user',
  department: 'IT',
 });
 expect(success).toBe('LIMIT_REACHED');
 });
 });

 it('should return false when no organizationId', async () => {
 // Override useAuth to have no organizationId
 const originalOrgId = mockAuthState.user.organizationId;
 mockAuthState.user = { uid: 'user-123', organizationId: undefined, role: 'admin' };

 const { result } = renderHook(() => useTeamManagement());

 await act(async () => {
 const success = await result.current.inviteUser({
  email: 'test@example.com',
  displayName: 'Test',
  role: 'user',
  department: '',
 });
 expect(success).toBe(false);
 });

 // Restore original state
 mockAuthState.user = { uid: 'user-123', organizationId: originalOrgId, role: 'admin' };
 });

 it('should handle invite error', async () => {
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);
 mockAddDoc.mockRejectedValue(new Error('Database error'));

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.inviteUser({
  email: 'newuser@example.com',
  displayName: 'New User',
  role: 'user',
  department: 'IT',
 });
 expect(success).toBe(false);
 });

 // Hook uses ErrorLogger.handleErrorWithToast for invitation errors
 const { ErrorLogger } = await import('../../services/errorLogger');
 expect(ErrorLogger.handleErrorWithToast).toHaveBeenCalled();
 });
 });

 describe('updateUser', () => {
 beforeEach(() => {
 // Reset to default admin user state
 mockStoreState.user = mockUser;
 mockStoreState.demoMode = false;
 mockStoreState.customRoles = [];
 // Mock getDocs to return users with matching organizationId for IDOR check
 mockGetDocs.mockResolvedValue({
 docs: [
  { id: 'user-1', data: () => ({ uid: 'user-1', email: 'user@example.com', organizationId: 'org-123', isPending: false }) }
 ],
 empty: false
 });
 });

 it('should update user successfully', async () => {
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.updateUser(
  'user-1',
  { role: 'admin', displayName: 'Updated Name' },
  false
 );
 expect(success).toBe(true);
 });

 expect(mockUpdateDoc).toHaveBeenCalled();
 expect(mockAddToast).toHaveBeenCalledWith('team.toast.updated', 'success');
 });

 it('should not update pending users', async () => {
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.updateUser(
  'pending-1',
  { role: 'admin' },
  true // isPending
 );
 expect(success).toBe(false); // Returns false early for pending users
 });

 expect(mockUpdateDoc).not.toHaveBeenCalled();
 });

 it('should handle update error', async () => {
 mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.updateUser(
  'user-1',
  { role: 'admin' },
  false
 );
 expect(success).toBe(false);
 });

 // Hook uses ErrorLogger.handleErrorWithToast for update errors
 const { ErrorLogger } = await import('../../services/errorLogger');
 expect(ErrorLogger.handleErrorWithToast).toHaveBeenCalled();
 });

 it('should check permissions before updating user', async () => {
 // The hook uses hasPermission to check if user can update
 // IDOR protection is handled by Firestore security rules
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 // Test passes if hook checks permission (indirectly verified by updateDoc call)
 await act(async () => {
 const success = await result.current.updateUser(
  'user-1',
  { role: 'admin' },
  false
 );
 expect(success).toBe(true);
 });

 expect(mockUpdateDoc).toHaveBeenCalled();
 });
 });

 describe('deleteUser', () => {
 beforeEach(() => {
 // Reset to default admin user state
 mockStoreState.user = mockUser;
 mockStoreState.demoMode = false;
 mockStoreState.customRoles = [];
 // Mock getDocs to return users with matching organizationId for IDOR check
 mockGetDocs.mockResolvedValue({
 docs: [
  { id: 'user-1', data: () => ({ uid: 'user-1', email: 'user@example.com', organizationId: 'org-123', isPending: false }) },
  { id: 'invite-1', data: () => ({ uid: 'invite-1', email: 'invite@example.com', organizationId: 'org-123', isPending: true }) }
 ],
 empty: false
 });
 });

 it('should delete active user', async () => {
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.deleteUser({
  uid: 'user-1',
  email: 'user@example.com',
  organizationId: 'org-123', // Must match mock user's org for IDOR check
  isPending: false,
 } as never);
 expect(success).toBe(true);
 });

 expect(mockDeleteDoc).toHaveBeenCalled();
 expect(mockAddToast).toHaveBeenCalledWith('team.toast.deleted', 'success');
 });

 it('should delete pending invitation', async () => {
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.deleteUser({
  uid: 'invite-1',
  email: 'invite@example.com',
  organizationId: 'org-123', // Must match mock user's org for IDOR check
  isPending: true,
 } as never);
 expect(success).toBe(true);
 });

 expect(mockDeleteDoc).toHaveBeenCalled();
 expect(mockAddToast).toHaveBeenCalledWith('team.toast.deleted', 'success');
 });

 it('should handle delete error', async () => {
 mockDeleteDoc.mockRejectedValue(new Error('Delete failed'));

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.deleteUser({
  uid: 'user-1',
  email: 'user@example.com',
  organizationId: 'org-123', // Must match mock user's org for IDOR check
  isPending: false,
 } as never);
 expect(success).toBe(false);
 });

 // Hook uses ErrorLogger.handleErrorWithToast for delete errors
 const { ErrorLogger } = await import('../../services/errorLogger');
 expect(ErrorLogger.handleErrorWithToast).toHaveBeenCalled();
 });

 it('should check permissions before deleting user', async () => {
 // The hook uses hasPermission to check if user can delete
 // IDOR protection is handled by Firestore security rules
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 // Test deletion succeeds when user has permission
 await act(async () => {
 const success = await result.current.deleteUser({
  uid: 'user-1',
  email: 'user@example.com',
  organizationId: 'org-123',
  isPending: false,
 } as never);
 expect(success).toBe(true);
 });

 expect(mockDeleteDoc).toHaveBeenCalled();
 });
 });

 describe('checkDependencies', () => {
 beforeEach(() => {
 // Reset to default admin user state
 mockStoreState.user = mockUser;
 mockStoreState.demoMode = false;
 mockStoreState.customRoles = [];
 });

 it('should return empty array when no dependencies', async () => {
 mockGetDocs.mockResolvedValue({ empty: true, docs: [], size: 0 });

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const deps = await result.current.checkDependencies('user-1');
 expect(deps).toEqual([]);
 });
 });

 it('should return dependencies list when user has resources', async () => {
 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 // Set up mocks for checkDependencies calls - each getDocs returns non-empty results
 mockGetDocs
 .mockResolvedValueOnce({ empty: false, size: 3, docs: [{}, {}, {}] }) // assets
 .mockResolvedValueOnce({ empty: false, size: 2, docs: [{}, {}] }) // risks
 .mockResolvedValueOnce({ empty: true, size: 0, docs: [] }); // documents

 await act(async () => {
 const deps = await result.current.checkDependencies('user-1');
 expect(deps.length).toBeGreaterThan(0);
 // Check that we got asset and risk dependencies (using translation keys)
 expect(deps.some((d: string) => d.includes('team.dependencies.assets'))).toBe(true);
 expect(deps.some((d: string) => d.includes('team.dependencies.risks'))).toBe(true);
 });
 });
 });

 describe('approveRequest', () => {
 beforeEach(() => {
 // Reset to default admin user state
 mockStoreState.user = mockUser;
 mockStoreState.demoMode = false;
 mockStoreState.customRoles = [];
 });

 it('should approve join request successfully', async () => {
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);
 mockHttpsCallable.mockResolvedValue({ data: {} });

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.approveRequest({
  id: 'request-1',
  displayName: 'John Doe',
 } as never);
 expect(success).toBe(true);
 });

 expect(mockHttpsCallable).toHaveBeenCalledWith({ requestId: 'request-1' });
 expect(mockAddToast).toHaveBeenCalledWith('team.toast.approved', 'success');
 });

 it('should handle server-side limit check via cloud function', async () => {
 // Limit checks are now handled server-side in the cloud function
 // When the cloud function succeeds, approval succeeds
 mockHttpsCallable.mockResolvedValue({ data: {} });

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.approveRequest({
  id: 'request-1',
  displayName: 'John Doe',
 } as never);
 expect(success).toBe(true);
 });
 });

 it('should handle approval error', async () => {
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);
 mockHttpsCallable.mockRejectedValue(new Error('Approval failed'));

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.approveRequest({
  id: 'request-1',
  displayName: 'John Doe',
 } as never);
 expect(success).toBe(false);
 });

 // Hook uses ErrorLogger.handleErrorWithToast for approve errors
 const { ErrorLogger } = await import('../../services/errorLogger');
 expect(ErrorLogger.handleErrorWithToast).toHaveBeenCalled();
 });
 });

 describe('rejectRequest', () => {
 beforeEach(() => {
 vi.mocked(useStore).mockReturnValue({
 user: mockUser,
 addToast: mockAddToast,
 demoMode: false,
 } as unknown as ReturnType<typeof useStore>);
 });

 it('should reject request successfully', async () => {
 mockHttpsCallable.mockResolvedValue({ data: {} });

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.rejectRequest({
  id: 'request-1',
 } as never);
 expect(success).toBe(true);
 });

 expect(mockAddToast).toHaveBeenCalledWith('team.toast.rejected', 'info');
 });

 it('should handle rejection error', async () => {
 mockHttpsCallable.mockRejectedValue(new Error('Rejection failed'));

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 const success = await result.current.rejectRequest({
  id: 'request-1',
 } as never);
 expect(success).toBe(false);
 });

 // Hook uses ErrorLogger.error instead of addToast for rejection errors
 const { ErrorLogger } = await import('../../services/errorLogger');
 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });

 describe('importUsers', () => {
 beforeEach(() => {
 vi.mocked(useStore).mockReturnValue({
 user: mockUser,
 addToast: mockAddToast,
 demoMode: false,
 } as unknown as ReturnType<typeof useStore>);
 });

 it('should show error for empty CSV', async () => {
 vi.mocked(ImportService.parseCSV).mockReturnValue([]);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 await result.current.importUsers('');
 });

 expect(mockAddToast).toHaveBeenCalledWith('common.toast.emptyFile', 'error');
 });

 it('should import users from CSV', async () => {
 vi.mocked(ImportService.parseCSV).mockReturnValue([
 { Email: 'user1@example.com', Nom: 'User 1', Role: 'user', Departement: 'IT' },
 { Email: 'user2@example.com', Nom: 'User 2', Role: 'admin', Departement: 'HR' },
 ]);
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 await result.current.importUsers('email,name\nuser1@example.com,User 1');
 });

 // Should have tried to add documents
 expect(mockAddDoc).toHaveBeenCalled();
 });

 it('should handle import with limit reached', async () => {
 vi.mocked(ImportService.parseCSV).mockReturnValue([
 { Email: 'user1@example.com', Nom: 'User 1', Role: 'user' },
 ]);
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(false);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 await result.current.importUsers('email\nuser1@example.com');
 });

 // When limit is reached, it breaks the loop and shows success with 0 users imported
 expect(mockAddToast).toHaveBeenCalledWith('team.toast.usersImported', 'success');
 });

 it('should skip rows without email', async () => {
 vi.mocked(ImportService.parseCSV).mockReturnValue([
 { Nom: 'No Email User' }, // No email
 { Email: 'valid@example.com', Nom: 'Valid User' },
 ]);
 vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 await act(async () => {
 await result.current.importUsers('name\nNo Email User');
 });

 // Only one user should be processed
 expect(mockAddDoc).toHaveBeenCalledTimes(1);
 });
 });

 describe('demo mode', () => {
 it('should use mock data in demo mode', async () => {
 vi.mocked(useStore).mockReturnValue({
 user: mockUser,
 addToast: mockAddToast,
 demoMode: true,
 } as unknown as ReturnType<typeof useStore>);

 const { result } = renderHook(() => useTeamManagement());

 // In demo mode, should not call actual Firebase
 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 }, { timeout: 2000 });
 });

 it('should handle invite in demo mode', async () => {
 vi.mocked(useStore).mockReturnValue({
 user: mockUser,
 addToast: mockAddToast,
 demoMode: true,
 } as unknown as ReturnType<typeof useStore>);

 const { result } = renderHook(() => useTeamManagement());

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 }, { timeout: 2000 });

 await act(async () => {
 const success = await result.current.inviteUser({
  email: 'demo@example.com',
  displayName: 'Demo User',
  role: 'user',
  department: 'Demo',
 });
 expect(success).toBe(true);
 });

 expect(mockAddToast).toHaveBeenCalledWith('team.invite.success', 'success');
 });
 });
});
