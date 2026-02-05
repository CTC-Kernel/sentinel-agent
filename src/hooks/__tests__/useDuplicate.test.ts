/**
 * Unit tests for useDuplicate hook (Story 1.6)
 *
 * Tests duplicate functionality with locale-aware suffix and Firestore integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDuplicate, addDuplicateSuffix } from '../useDuplicate';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
 addDoc: vi.fn(),
 collection: vi.fn(),
 serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

vi.mock('../../firebase', () => ({
 db: {},
}));

// Mock hooks
vi.mock('../useAuth', () => ({
 useAuth: vi.fn(() => ({
 user: {
 uid: 'test-user-id',
 organizationId: 'test-org-id',
 displayName: 'Test User',
 },
 })),
}));

vi.mock('../useLocale', () => ({
 useLocale: vi.fn(() => ({
 locale: 'fr',
 })),
}));

// Mock services
vi.mock('../../services/logger', () => ({
 logAction: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn(),
 },
}));

import { addDoc, collection } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useLocale } from '../useLocale';

const mockAddDoc = vi.mocked(addDoc);
const mockCollection = vi.mocked(collection);
const mockUseAuth = vi.mocked(useAuth);
const mockUseLocale = vi.mocked(useLocale);

interface TestEntity {
 id: string;
 name: string;
 status: string;
 description?: string;
}

describe('addDuplicateSuffix', () => {
 it('adds French suffix for fr locale', () => {
 const result = addDuplicateSuffix('Test Item', 'fr');
 expect(result).toBe('Test Item (Copie)');
 });

 it('adds English suffix for en locale', () => {
 const result = addDuplicateSuffix('Test Item', 'en');
 expect(result).toBe('Test Item (Copy)');
 });

 it('handles empty string', () => {
 const result = addDuplicateSuffix('', 'fr');
 expect(result).toBe(' (Copie)');
 });

 it('handles items with existing suffix', () => {
 const result = addDuplicateSuffix('Item (Copie)', 'fr');
 expect(result).toBe('Item (Copie) (Copie)');
 });
});

describe('useDuplicate', () => {
 const defaultOptions = {
 collectionName: 'test-entities',
 nameField: 'name' as keyof TestEntity,
 entityType: 'TestEntity',
 };

 const mockEntity: TestEntity = {
 id: 'original-id',
 name: 'Original Entity',
 status: 'active',
 description: 'Test description',
 };

 beforeEach(() => {
 vi.clearAllMocks();

 // Default mock implementations
 mockUseAuth.mockReturnValue({
 user: {
 uid: 'test-user-id',
 organizationId: 'test-org-id',
 },
 } as ReturnType<typeof useAuth>);

 mockUseLocale.mockReturnValue({
 locale: 'fr',
 } as ReturnType<typeof useLocale>);

 mockCollection.mockReturnValue({} as never);
 mockAddDoc.mockResolvedValue({ id: 'new-doc-id' } as never);
 });

 afterEach(() => {
 vi.clearAllMocks();
 });

 describe('initial state', () => {
 it('returns isDuplicating as false initially', () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 expect(result.current.isDuplicating).toBe(false);
 });

 it('returns error as null initially', () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 expect(result.current.error).toBeNull();
 });

 it('returns duplicate function', () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 expect(typeof result.current.duplicate).toBe('function');
 });
 });

 describe('duplicate function', () => {
 it('creates new document with correct name suffix', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 expect(mockAddDoc).toHaveBeenCalledTimes(1);
 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.name).toBe('Original Entity (Copie)');
 });

 it('generates new ID via Firestore addDoc', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 let newId: string | null = null;
 await act(async () => {
 newId = await result.current.duplicate(mockEntity);
 });

 expect(newId).toBe('new-doc-id');
 });

 it('preserves original entity data', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.status).toBe('active');
 expect(callArgs.description).toBe('Test description');
 });

 it('applies resetFields to duplicate', async () => {
 const { result } = renderHook(() =>
 useDuplicate<TestEntity>({
 ...defaultOptions,
 resetFields: { status: 'draft' },
 })
 );

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.status).toBe('draft');
 });

 it('adds organizationId from user', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.organizationId).toBe('test-org-id');
 });

 it('adds createdBy from user', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.createdBy).toBe('test-user-id');
 });

 it('adds duplicatedFrom reference', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.duplicatedFrom).toBe('original-id');
 });

 it('does not include original id in duplicate', async () => {
 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.id).toBeUndefined();
 });
 });

 describe('loading state', () => {
 it('sets isDuplicating to true during operation', async () => {
 let resolvePromise: (value: { id: string }) => void;
 mockAddDoc.mockReturnValue(
 new Promise((resolve) => {
 resolvePromise = resolve;
 }) as never
 );

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 act(() => {
 result.current.duplicate(mockEntity);
 });

 expect(result.current.isDuplicating).toBe(true);

 await act(async () => {
 resolvePromise!({ id: 'new-id' });
 });

 await waitFor(() => {
 expect(result.current.isDuplicating).toBe(false);
 });
 });

 it('prevents double-click during duplication', async () => {
 let resolvePromise: (value: { id: string }) => void;
 mockAddDoc.mockReturnValue(
 new Promise((resolve) => {
 resolvePromise = resolve;
 }) as never
 );

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 act(() => {
 result.current.duplicate(mockEntity);
 result.current.duplicate(mockEntity); // Second call should be ignored
 });

 await act(async () => {
 resolvePromise!({ id: 'new-id' });
 });

 expect(mockAddDoc).toHaveBeenCalledTimes(1);
 });
 });

 describe('error handling', () => {
 it('sets error state on failure', async () => {
 const testError = new Error('Firestore error');
 mockAddDoc.mockRejectedValue(testError);

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 expect(result.current.error).toEqual(testError);
 });

 it('returns null on failure', async () => {
 mockAddDoc.mockRejectedValue(new Error('Firestore error'));

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 let newId: string | null = null;
 await act(async () => {
 newId = await result.current.duplicate(mockEntity);
 });

 expect(newId).toBeNull();
 });

 it('calls onError callback on failure', async () => {
 const onError = vi.fn();
 mockAddDoc.mockRejectedValue(new Error('Test error'));

 const { result } = renderHook(() =>
 useDuplicate<TestEntity>({
 ...defaultOptions,
 onError,
 })
 );

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 expect(onError).toHaveBeenCalledWith(expect.any(Error));
 });

 it('clears error with clearError', async () => {
 mockAddDoc.mockRejectedValue(new Error('Test error'));

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 expect(result.current.error).not.toBeNull();

 act(() => {
 result.current.clearError();
 });

 expect(result.current.error).toBeNull();
 });

 it('returns null when user is not authenticated', async () => {
 mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 let newId: string | null = null;
 await act(async () => {
 newId = await result.current.duplicate(mockEntity);
 });

 expect(newId).toBeNull();
 expect(result.current.error).not.toBeNull();
 });
 });

 describe('callbacks', () => {
 it('calls onSuccess with new entity on success', async () => {
 const onSuccess = vi.fn();

 const { result } = renderHook(() =>
 useDuplicate<TestEntity>({
 ...defaultOptions,
 onSuccess,
 })
 );

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 expect(onSuccess).toHaveBeenCalledWith(
 expect.objectContaining({
 id: 'new-doc-id',
 name: 'Original Entity (Copie)',
 })
 );
 });
 });

 describe('locale handling', () => {
 it('uses English suffix when locale is en', async () => {
 mockUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

 const { result } = renderHook(() => useDuplicate<TestEntity>(defaultOptions));

 await act(async () => {
 await result.current.duplicate(mockEntity);
 });

 const callArgs = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.name).toBe('Original Entity (Copy)');
 });
 });
});
