
/**
 * Unit tests for useReports hook
 * Tests report generation, saving, and deletion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReports } from '../useReports';
import { useStore } from '../../store';
import {
 addDoc,
 deleteDoc,
 getDoc,
 getDocs,
 doc,
 DocumentSnapshot,
 DocumentReference,
 QuerySnapshot
} from 'firebase/firestore';
import { UserProfile } from '../../types';
import { uploadBytes, getDownloadURL, UploadResult } from 'firebase/storage';

// Mock dependencies
vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 addDoc: vi.fn(),
 deleteDoc: vi.fn(),
 doc: vi.fn(),
 getDoc: vi.fn(),
 getDocs: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 limit: vi.fn(),
 serverTimestamp: vi.fn(() => 'server-timestamp')
}));

vi.mock('firebase/storage', () => ({
 ref: vi.fn(),
 uploadBytes: vi.fn(),
 getDownloadURL: vi.fn()
}));

vi.mock('../../firebase', () => ({
 db: {},
 storage: {}
}));

vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 handleErrorWithToast: vi.fn()
 }
}));

vi.mock('../../services/logger', () => ({
 logAction: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../store', () => ({
 useStore: vi.fn()
}));

vi.mock('../../utils/dataSanitizer', () => ({
 sanitizeData: (data: unknown) => data
}));

describe('useReports', () => {
 const mockAddToast = vi.fn();
 const mockT = vi.fn((key: string) => key);

 const mockUser: UserProfile = {
 organizationId: 'org-123',
 uid: 'user-1',
 displayName: 'Test User',
 email: 'test@example.com',
 role: 'admin'
 } as UserProfile;

 beforeEach(() => {
 vi.clearAllMocks();

 // Setup Store Mock
 vi.mocked(useStore).mockReturnValue({
 user: mockUser,
 addToast: mockAddToast,
 t: mockT
 });

 // Setup Firebase Mocks defaults
 vi.mocked(uploadBytes).mockResolvedValue({ ref: {} } as unknown as UploadResult);
 vi.mocked(getDownloadURL).mockResolvedValue('https://storage.example.com/file.pdf');
 vi.mocked(addDoc).mockResolvedValue({ id: 'doc-123' } as unknown as DocumentReference);
 vi.mocked(getDoc).mockResolvedValue({
 exists: () => true,
 data: () => ({ organizationId: 'org-123' })
 } as unknown as DocumentSnapshot);
 vi.mocked(deleteDoc).mockResolvedValue(undefined);
 vi.mocked(doc).mockReturnValue({ id: 'mock-doc-ref' } as unknown as DocumentReference);
 });

 describe('initialization', () => {
 it('initializes with loading false', () => {
 const { result } = renderHook(() => useReports());
 expect(result.current.loading).toBe(false);
 });

 it('provides all expected functions', () => {
 const { result } = renderHook(() => useReports());
 expect(typeof result.current.saveReport).toBe('function');
 expect(typeof result.current.deleteReport).toBe('function');
 expect(typeof result.current.fetchCompliancePackData).toBe('function');
 });
 });

 describe('saveReport', () => {
 it('uploads blob to storage and creates document', async () => {
 const { result } = renderHook(() => useReports());
 const blob = new Blob(['test content'], { type: 'application/pdf' });

 let savedDoc: unknown;
 await act(async () => {
 savedDoc = await result.current.saveReport(blob, 'report.pdf', 'Monthly Report');
 });

 expect(uploadBytes).toHaveBeenCalled();
 expect(getDownloadURL).toHaveBeenCalled();
 expect(addDoc).toHaveBeenCalled();
 expect(savedDoc).toMatchObject({
 id: 'doc-123',
 title: 'Monthly Report'
 });
 });

 it('shows success toast', async () => {
 const { result } = renderHook(() => useReports());
 const blob = new Blob(['test'], { type: 'application/pdf' });

 await act(async () => {
 await result.current.saveReport(blob, 'report.pdf', 'Test Report');
 });

 expect(mockAddToast).toHaveBeenCalledWith('reports.successSaved', 'success');
 });

 it('handles upload errors', async () => {
 vi.mocked(uploadBytes).mockRejectedValue(new Error('Upload failed'));

 const { result } = renderHook(() => useReports());
 const blob = new Blob(['test'], { type: 'application/pdf' });

 await expect(
 act(async () => {
  await result.current.saveReport(blob, 'report.pdf', 'Test');
 })
 ).rejects.toThrow();

 expect(result.current.loading).toBe(false);
 });

 it('creates document with correct metadata', async () => {
 const { result } = renderHook(() => useReports());
 const blob = new Blob(['test content with some data'], { type: 'application/pdf' });

 await act(async () => {
 await result.current.saveReport(blob, 'monthly-report.pdf', 'Monthly Security Report');
 });

 expect(addDoc).toHaveBeenCalled();
 const callArgs = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>;
 expect(callArgs.title).toBe('Monthly Security Report');
 expect(callArgs.type).toBe('Rapport');
 expect(callArgs.status).toBe('Validé');
 });
 });

 describe('deleteReport', () => {
 it('deletes document from Firestore', async () => {
 vi.mocked(deleteDoc).mockResolvedValue(undefined);

 const { result } = renderHook(() => useReports());

 await act(async () => {
 await result.current.deleteReport('doc-to-delete');
 });

 expect(deleteDoc).toHaveBeenCalled();
 expect(mockAddToast).toHaveBeenCalledWith('reports.deleteSuccess', 'success');
 });

 it('handles delete errors', async () => {
 vi.mocked(deleteDoc).mockRejectedValue(new Error('Delete failed'));

 const { result } = renderHook(() => useReports());

 await expect(
 act(async () => {
  await result.current.deleteReport('doc-error');
 })
 ).rejects.toThrow();

 expect(result.current.loading).toBe(false);
 });
 });

 describe('fetchCompliancePackData', () => {
 it('fetches incidents and documents', async () => {
 vi.mocked(getDocs)
 .mockResolvedValueOnce({
  docs: [
  { id: 'incident-1', data: () => ({ title: 'Incident 1' }) },
  { id: 'incident-2', data: () => ({ title: 'Incident 2' }) }
  ]
 } as unknown as QuerySnapshot)
 .mockResolvedValueOnce({
  docs: [
  { id: 'doc-1', data: () => ({ title: 'Document 1' }) }
  ]
 } as unknown as QuerySnapshot);

 const { result } = renderHook(() => useReports());

 let data: unknown;
 await act(async () => {
 data = await result.current.fetchCompliancePackData();
 });

 expect(getDocs).toHaveBeenCalledTimes(2);
 expect(data).toMatchObject({
 incidents: expect.arrayContaining([
  expect.objectContaining({ id: 'incident-1' }),
  expect.objectContaining({ id: 'incident-2' })
 ]),
 documents: expect.arrayContaining([
  expect.objectContaining({ id: 'doc-1' })
 ])
 });
 });

 it('handles fetch errors', async () => {
 vi.mocked(getDocs).mockRejectedValue(new Error('Fetch failed'));

 const { result } = renderHook(() => useReports());

 await expect(
 act(async () => {
  await result.current.fetchCompliancePackData();
 })
 ).rejects.toThrow();

 expect(result.current.loading).toBe(false);
 });

 it('returns null when user has no organizationId', async () => {
 // Re-mock store without organizationId
 vi.mocked(useStore).mockReturnValue({
 user: { ...mockUser, organizationId: undefined } as unknown as UserProfile,
 addToast: mockAddToast,
 t: mockT
 });

 const { result } = renderHook(() => useReports());

 // fetchCompliancePackData returns a function. Calling it returns null (Promise<null>).
 const retval = await result.current.fetchCompliancePackData();
 expect(retval).toBeNull();
 });
 });

 describe('no user', () => {
 beforeEach(() => {
 vi.mocked(useStore).mockReturnValue({
 user: null,
 addToast: mockAddToast,
 t: mockT
 });
 });

 it('saveReport does nothing without user', async () => {
 const { result } = renderHook(() => useReports());
 const blob = new Blob(['test'], { type: 'application/pdf' });
 await act(async () => {
 const res = await result.current.saveReport(blob, 'a', 'b');
 expect(res).toBeUndefined();
 });
 });

 it('deleteReport does nothing without user', async () => {
 const { result } = renderHook(() => useReports());
 await act(async () => {
 await result.current.deleteReport('id');
 });
 expect(deleteDoc).not.toHaveBeenCalled();
 });
 });
});
