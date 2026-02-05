/**
 * Unit tests for useAdminActions hook
 * Tests super admin verification and organization switching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
 getFunctions: vi.fn(() => ({})),
 httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args)
}));

// Mock Firebase Auth
const mockGetIdToken = vi.fn();
vi.mock('../../firebase', () => ({
 auth: {
 currentUser: {
 getIdToken: (...args: unknown[]) => mockGetIdToken(...args)
 }
 },
 app: {}
}));

// Mock store
const { mockT, mockGetState } = vi.hoisted(() => ({
 mockT: vi.fn((key: string, params?: object) =>
 params ? `${key}:${JSON.stringify(params)}` : key
 ),
 mockGetState: vi.fn(() => ({
 customRoles: []
 }))
}));

vi.mock('../../store', () => {
 const useStore = () => ({
 t: mockT
 });
 useStore.getState = mockGetState;
 return { useStore };
});

// Mock error logger
vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn()
 }
}));

// Mock AuditLogService
vi.mock('../../services/auditLogService', () => ({
 AuditLogService: {
 log: vi.fn()
 }
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/lib/toast', () => ({
 toast: {
 success: (...args: unknown[]) => mockToastSuccess(...args),
 error: (...args: unknown[]) => mockToastError(...args)
 }
}));

// Mock useAuth
const mockUser = {
 uid: 'test-uid',
 email: 'test@example.com',
 displayName: 'Test User',
 organizationId: 'org-123',
 role: 'admin'
};

vi.mock('../useAuth', () => ({
 useAuth: () => ({
 user: mockUser
 })
}));

import { useAdminActions } from '../useAdminActions';

describe('useAdminActions', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('initialization', () => {
 it('initializes with null switchingOrg state', () => {
 const { result } = renderHook(() => useAdminActions());

 expect(result.current.switchingOrg).toBeNull();
 });

 it('provides all expected functions', () => {
 const { result } = renderHook(() => useAdminActions());

 expect(typeof result.current.verifySuperAdmin).toBe('function');
 expect(typeof result.current.handleManage).toBe('function');
 });
 });

 describe('verifySuperAdmin', () => {
 it('returns true when user is super admin', async () => {
 const mockCallable = vi.fn().mockResolvedValue({
 data: { isSuperAdmin: true }
 });
 mockHttpsCallable.mockClear().mockReturnValue(mockCallable);

 const { result } = renderHook(() => useAdminActions());

 let isSuperAdmin: boolean;
 await act(async () => {
 isSuperAdmin = await result.current.verifySuperAdmin();
 });

 expect(isSuperAdmin!).toBe(true);
 expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'verifySuperAdmin');
 expect(mockCallable).toHaveBeenCalled();
 });

 it('returns false when user is not super admin', async () => {
 const mockCallable = vi.fn().mockResolvedValue({
 data: { isSuperAdmin: false }
 });
 mockHttpsCallable.mockReturnValue(mockCallable);

 const { result } = renderHook(() => useAdminActions());

 let isSuperAdmin: boolean;
 await act(async () => {
 isSuperAdmin = await result.current.verifySuperAdmin();
 });

 expect(isSuperAdmin!).toBe(false);
 });

 it('returns false on error', async () => {
 const mockCallable = vi.fn().mockRejectedValue(new Error('Network error'));
 mockHttpsCallable.mockReturnValue(mockCallable);

 const { result } = renderHook(() => useAdminActions());

 let isSuperAdmin: boolean;
 await act(async () => {
 isSuperAdmin = await result.current.verifySuperAdmin();
 });

 expect(isSuperAdmin!).toBe(false);
 });
 });

 describe('handleManage', () => {
 it('sets switchingOrg state during switch', async () => {
 const mockCallable = vi.fn().mockResolvedValue({});
 mockHttpsCallable.mockReturnValue(mockCallable);
 mockGetIdToken.mockResolvedValue('new-token');

 // Mock window.location
 const originalLocation = window.location;
 Object.defineProperty(window, 'location', {
 value: { href: '' },
 writable: true,
 configurable: true
 });

 const { result } = renderHook(() => useAdminActions());

 const managePromise = act(async () => {
 await result.current.handleManage('org-123', 'Test Org');
 });

 // During the operation, switchingOrg should be set
 await managePromise;

 // After completion, it redirects so we check toast was called
 expect(mockToastSuccess).toHaveBeenCalled();

 // Restore
 Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
 });

 it('calls switch organization function', async () => {
 const mockCallable = vi.fn().mockResolvedValue({});
 mockHttpsCallable.mockClear().mockReturnValue(mockCallable);
 mockGetIdToken.mockClear().mockResolvedValue('new-token');

 const originalLocation = window.location;
 const mockHref = { href: '' };
 Object.defineProperty(window, 'location', {
 value: mockHref,
 writable: true,
 configurable: true
 });

 const { result } = renderHook(() => useAdminActions());

 await act(async () => {
 await result.current.handleManage('org-456', 'Another Org');
 });

 expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'switchOrganization');
 expect(mockCallable).toHaveBeenCalledWith({ targetOrgId: 'org-456' });

 Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
 });

 it('refreshes ID token after switch', async () => {
 const mockCallable = vi.fn().mockResolvedValue({});
 mockHttpsCallable.mockClear().mockReturnValue(mockCallable);
 mockGetIdToken.mockClear().mockResolvedValue('new-token');

 const originalLocation = window.location;
 const mockHref = { href: '' };
 Object.defineProperty(window, 'location', {
 value: mockHref,
 writable: true,
 configurable: true
 });

 const { result } = renderHook(() => useAdminActions());

 await act(async () => {
 await result.current.handleManage('org-789', 'Test Org');
 });

 expect(mockGetIdToken).toHaveBeenCalledWith(true);

 Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
 });

 it('shows success toast on successful switch', async () => {
 const mockCallable = vi.fn().mockResolvedValue({});
 mockHttpsCallable.mockClear().mockReturnValue(mockCallable);
 mockGetIdToken.mockClear().mockResolvedValue('new-token');

 const originalLocation = window.location;
 const mockHref = { href: '' };
 Object.defineProperty(window, 'location', {
 value: mockHref,
 writable: true,
 configurable: true
 });

 const { result } = renderHook(() => useAdminActions());

 await act(async () => {
 await result.current.handleManage('org-123', 'My Org');
 });

 expect(mockToastSuccess).toHaveBeenCalledWith(
 expect.stringContaining('admin.toast.switchSuccess')
 );

 Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
 });

 it('handles error during switch', async () => {
 const mockCallable = vi.fn().mockRejectedValue(new Error('Switch failed'));
 mockHttpsCallable.mockReturnValue(mockCallable);

 const { result } = renderHook(() => useAdminActions());

 await act(async () => {
 await result.current.handleManage('org-fail', 'Failing Org');
 });

 expect(mockToastError).toHaveBeenCalledWith('admin.toast.switchError');
 expect(result.current.switchingOrg).toBeNull();
 });

 it('resets switchingOrg state on error', async () => {
 const mockCallable = vi.fn().mockRejectedValue(new Error('Error'));
 mockHttpsCallable.mockReturnValue(mockCallable);

 const { result } = renderHook(() => useAdminActions());

 await act(async () => {
 await result.current.handleManage('org-error', 'Error Org');
 });

 expect(result.current.switchingOrg).toBeNull();
 });

 it('redirects to root on success', async () => {
 const mockCallable = vi.fn().mockResolvedValue({});
 mockHttpsCallable.mockClear().mockReturnValue(mockCallable);
 mockGetIdToken.mockClear().mockResolvedValue('token');

 const originalLocation = window.location;
 const mockHref = { href: '' };
 Object.defineProperty(window, 'location', {
 value: mockHref,
 writable: true,
 configurable: true
 });

 const { result } = renderHook(() => useAdminActions());

 await act(async () => {
 await result.current.handleManage('org-123', 'Test');
 });

 expect(window.location.href).toBe('/');

 Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
 });
 });
});
