/**
 * FileUploadService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile, deleteFile, listFiles, generateFilePath, UploadProgress, FileMetadata } from '../fileUploadService';

// Mock Firebase Storage
vi.mock('../../firebase', () => ({
 storage: {}
}));

const mockOn = vi.fn();
const mockUploadTask = {
 on: mockOn,
 snapshot: {
 ref: {}
 }
};

vi.mock('firebase/storage', () => ({
 ref: vi.fn(() => ({})),
 uploadBytesResumable: vi.fn(() => mockUploadTask),
 getDownloadURL: vi.fn(() => Promise.resolve('https://storage.example.com/file.pdf')),
 deleteObject: vi.fn(() => Promise.resolve()),
 listAll: vi.fn(() => Promise.resolve({
 items: [
 { name: 'file1.pdf', fullPath: 'documents/org-1/file1.pdf' },
 { name: 'file2.pdf', fullPath: 'documents/org-1/file2.pdf' }
 ],
 prefixes: []
 }))
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

describe('uploadFile', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 // Setup default success behavior for upload
 mockOn.mockImplementation((event, onProgress, _onError, onSuccess) => {
 if (event === 'state_changed') {
 // Simulate progress
 onProgress({ bytesTransferred: 50, totalBytes: 100 });
 // Simulate success
 setTimeout(() => onSuccess(), 0);
 }
 });
 });

 it('should upload file and return download URL', async () => {
 const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
 const path = 'documents/org-1/test.pdf';

 const url = await uploadFile(file, path);

 expect(url).toBe('https://storage.example.com/file.pdf');
 });

 it('should call onProgress callback during upload', async () => {
 const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
 const onProgress = vi.fn();

 await uploadFile(file, 'path/file.pdf', {}, onProgress);

 expect(onProgress).toHaveBeenCalledWith(50);
 });

 it('should include metadata in upload', async () => {
 const { uploadBytesResumable } = await import('firebase/storage');
 const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
 const metadata: Partial<FileMetadata> = {
 uploadedBy: 'user-1',
 organizationId: 'org-1',
 name: 'Custom Name'
 };

 await uploadFile(file, 'path/file.pdf', metadata);

 expect(uploadBytesResumable).toHaveBeenCalledWith(
 expect.anything(),
 file,
 expect.objectContaining({
 customMetadata: expect.objectContaining({
  uploadedBy: 'user-1',
  organizationId: 'org-1'
 })
 })
 );
 });

 it('should reject on upload error', async () => {
 mockOn.mockImplementation((event, _onProgress, onError) => {
 if (event === 'state_changed') {
 onError(new Error('Upload failed'));
 }
 });

 const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

 await expect(uploadFile(file, 'path/file.pdf')).rejects.toThrow('Failed to upload file');
 });

 it('should reject on getDownloadURL error', async () => {
 const { getDownloadURL } = await import('firebase/storage');
 vi.mocked(getDownloadURL).mockRejectedValueOnce(new Error('URL error'));

 mockOn.mockImplementation((event, _onProgress, _onError, onSuccess) => {
 if (event === 'state_changed') {
 setTimeout(() => onSuccess(), 0);
 }
 });

 const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

 await expect(uploadFile(file, 'path/file.pdf')).rejects.toThrow('Failed to get download URL');
 });
});

describe('deleteFile', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should delete file successfully', async () => {
 const { deleteObject } = await import('firebase/storage');

 await deleteFile('documents/org-1/file.pdf');

 expect(deleteObject).toHaveBeenCalled();
 });

 it('should throw on delete error', async () => {
 const { deleteObject } = await import('firebase/storage');
 vi.mocked(deleteObject).mockRejectedValueOnce(new Error('Delete error'));

 await expect(deleteFile('path/file.pdf')).rejects.toThrow('Failed to delete file');
 });

 it('should log errors', async () => {
 const { deleteObject } = await import('firebase/storage');
 vi.mocked(deleteObject).mockRejectedValueOnce(new Error('Delete error'));
 const { ErrorLogger } = await import('../errorLogger');

 try {
 await deleteFile('path/file.pdf');
 } catch {
 // Expected
 }

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 expect.any(Error),
 'FileUploadService.deleteFile'
 );
 });
});

describe('listFiles', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should list files in directory', async () => {
 const files = await listFiles('documents/org-1');

 expect(files).toHaveLength(2);
 expect(files[0].name).toBe('file1.pdf');
 });

 it('should throw on list error', async () => {
 const { listAll } = await import('firebase/storage');
 vi.mocked(listAll).mockRejectedValueOnce(new Error('List error'));

 await expect(listFiles('path')).rejects.toThrow('Failed to list files');
 });

 it('should log errors', async () => {
 const { listAll } = await import('firebase/storage');
 vi.mocked(listAll).mockRejectedValueOnce(new Error('List error'));
 const { ErrorLogger } = await import('../errorLogger');

 try {
 await listFiles('path');
 } catch {
 // Expected
 }

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 expect.any(Error),
 'FileUploadService.listFiles'
 );
 });
});

describe('generateFilePath', () => {
 it('should generate path with organization, category, and filename', () => {
 const path = generateFilePath('org-123', 'documents', 'test.pdf');

 expect(path).toContain('documents/org-123/');
 expect(path).toContain('test.pdf');
 });

 it('should sanitize filename', () => {
 const path = generateFilePath('org-1', 'documents', 'my file (copy).pdf');

 expect(path).toContain('my_file__copy_.pdf');
 });

 it('should include timestamp', () => {
 const before = Date.now();
 const path = generateFilePath('org-1', 'documents', 'test.pdf');
 const after = Date.now();

 // Extract timestamp from path
 const timestampMatch = path.match(/\/(\d+)_/);
 expect(timestampMatch).toBeTruthy();

 const timestamp = parseInt(timestampMatch![1]);
 expect(timestamp).toBeGreaterThanOrEqual(before);
 expect(timestamp).toBeLessThanOrEqual(after);
 });

 it('should work with different categories', () => {
 const docPath = generateFilePath('org-1', 'documents', 'doc.pdf');
 const evidencePath = generateFilePath('org-1', 'evidence', 'evidence.png');
 const avatarPath = generateFilePath('org-1', 'avatars', 'avatar.jpg');

 expect(docPath).toContain('documents/');
 expect(evidencePath).toContain('evidence/');
 expect(avatarPath).toContain('avatars/');
 });
});

describe('UploadProgress interface', () => {
 it('should have correct structure', () => {
 const progress: UploadProgress = {
 progress: 50,
 status: 'uploading'
 };

 expect(progress.progress).toBe(50);
 expect(progress.status).toBe('uploading');
 });

 it('should support all status values', () => {
 const statuses: UploadProgress['status'][] = ['uploading', 'success', 'error'];

 statuses.forEach(status => {
 const progress: UploadProgress = { progress: 0, status };
 expect(progress.status).toBe(status);
 });
 });

 it('should support optional error', () => {
 const progress: UploadProgress = {
 progress: 0,
 status: 'error',
 error: 'Upload failed'
 };

 expect(progress.error).toBe('Upload failed');
 });
});

describe('FileMetadata interface', () => {
 it('should have correct structure', () => {
 const metadata: FileMetadata = {
 name: 'document.pdf',
 size: 1024,
 type: 'application/pdf',
 uploadedBy: 'user-1',
 uploadedAt: '2024-01-01T00:00:00Z',
 organizationId: 'org-1'
 };

 expect(metadata.name).toBe('document.pdf');
 expect(metadata.size).toBe(1024);
 expect(metadata.organizationId).toBe('org-1');
 });

 it('should support optional fields', () => {
 const metadata: FileMetadata = {
 name: 'doc.pdf',
 size: 512,
 type: 'application/pdf',
 uploadedBy: 'user-1',
 uploadedAt: '2024-01-01',
 organizationId: 'org-1',
 hash: 'abc123',
 isSecure: 'true'
 };

 expect(metadata.hash).toBe('abc123');
 expect(metadata.isSecure).toBe('true');
 });
});
