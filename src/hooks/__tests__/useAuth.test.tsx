/**
 * Unit tests for useAuth hook
 * Tests AuthContext consumer hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthContext } from '../../contexts/AuthContextDefinition';
import { ReactNode } from 'react';

describe('useAuth', () => {
 const mockAuthContext = {
 user: { id: 'user-1', email: 'test@example.com' },
 loading: false,
 error: null as Error | null,
 login: vi.fn(),
 logout: vi.fn()
 };

 const createWrapper = (value: typeof mockAuthContext | undefined) =>
 ({ children }: { children: ReactNode }) => (
 <AuthContext.Provider value={value as unknown as React.ContextType<typeof AuthContext>}>
 {children}
 </AuthContext.Provider>
 );

 it('returns auth context when used within AuthProvider', () => {
 const { result } = renderHook(() => useAuth(), {
 wrapper: createWrapper(mockAuthContext)
 });

 expect(result.current).toBe(mockAuthContext);
 });

 it('throws error when used outside AuthProvider', () => {
 // Suppress console.error for this test
 const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

 expect(() => {
 renderHook(() => useAuth());
 }).toThrow('useAuth must be used within an AuthProvider');

 consoleError.mockRestore();
 });

 it('provides access to user data', () => {
 const { result } = renderHook(() => useAuth(), {
 wrapper: createWrapper(mockAuthContext)
 });

 expect(result.current.user).toEqual({
 id: 'user-1',
 email: 'test@example.com'
 });
 });

 it('provides loading state', () => {
 const loadingContext = { ...mockAuthContext, loading: true };

 const { result } = renderHook(() => useAuth(), {
 wrapper: createWrapper(loadingContext)
 });

 expect(result.current.loading).toBe(true);
 });

 it('provides error state', () => {
 const errorContext = { ...mockAuthContext, error: new Error('Authentication failed') };

 const { result } = renderHook(() => useAuth(), {
 wrapper: createWrapper(errorContext)
 });

 expect(result.current.error?.message).toBe('Authentication failed');
 });
});
