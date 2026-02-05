/**
 * DataExportService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataExportService } from '../dataExportService';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {}
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(() => ({})),
 query: vi.fn(() => ({})),
 where: vi.fn(() => ({})),
 getDocs: vi.fn(() => Promise.resolve({
 docs: [
 {
 id: 'doc-1',
 data: () => ({ name: 'Test Item 1', organizationId: 'org-1' })
 },
 {
 id: 'doc-2',
 data: () => ({ name: 'Test Item 2', organizationId: 'org-1' })
 }
 ]
 }))
}));

// Mock file-saver
vi.mock('file-saver', () => ({
 saveAs: vi.fn()
}));

// Mock JSZip
vi.mock('jszip', () => {
 return {
 default: vi.fn().mockImplementation(() => ({
 file: vi.fn(),
 generateAsync: vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'application/zip' })))
 } as unknown as any)) // eslint-disable-line @typescript-eslint/no-explicit-any
 };
});

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

describe('DataExportService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('exportOrganizationData', () => {
 it('should export organization data to ZIP with full access', async () => {
 const { saveAs } = await import('file-saver');

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'enterprise',
 hasApiAccess: true
 });

 expect(saveAs).toHaveBeenCalledWith(
 expect.any(Blob),
 expect.stringContaining('sentinel_export_org-1')
 );
 });

 it('should export limited data for Discovery plan', async () => {
 const { saveAs } = await import('file-saver');

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'discovery',
 hasApiAccess: false
 });

 expect(saveAs).toHaveBeenCalledWith(
 expect.any(Blob),
 expect.stringContaining('sentinel_export_limited_org-1')
 );
 });

 it('should include date in filename', async () => {
 const { saveAs } = await import('file-saver');
 const today = new Date().toISOString().split('T')[0];

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'enterprise',
 hasApiAccess: true
 });

 expect(saveAs).toHaveBeenCalledWith(
 expect.any(Blob),
 expect.stringContaining(today)
 );
 });

 it('should query all required collections for full export', async () => {
 const { collection, query, where } = await import('firebase/firestore');

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'enterprise',
 hasApiAccess: true
 });

 // Should query 6 collections: assets, risks, controls, documents, audits, incidents
 expect(collection).toHaveBeenCalledTimes(6);
 expect(query).toHaveBeenCalledTimes(6);
 expect(where).toHaveBeenCalledTimes(6);
 });

 it('should query limited collections for Discovery plan', async () => {
 const { collection, query, where } = await import('firebase/firestore');

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'discovery',
 hasApiAccess: false
 });

 // Should query only 2 collections: assets, risks
 expect(collection).toHaveBeenCalledTimes(2);
 expect(query).toHaveBeenCalledTimes(2);
 expect(where).toHaveBeenCalledTimes(2);
 });

 it('should create ZIP with collection files', async () => {
 const JSZip = (await import('jszip')).default;

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'enterprise',
 hasApiAccess: true
 });

 const mockZipInstance = vi.mocked(JSZip).mock.results[0]?.value;
 expect(mockZipInstance.file).toHaveBeenCalled();
 expect(mockZipInstance.generateAsync).toHaveBeenCalledWith({ type: 'blob' });
 });

 it('should call onUpgradeRequired when no API access', async () => {
 const onUpgradeRequired = vi.fn();

 await DataExportService.exportOrganizationData({
 organizationId: 'org-1',
 planId: 'discovery',
 hasApiAccess: false,
 onUpgradeRequired
 });

 expect(onUpgradeRequired).toHaveBeenCalledWith(
 expect.stringContaining('L\'export de données complètes nécessite le plan Enterprise')
 );
 });

 it('should throw on Firestore error', async () => {
 const { getDocs } = await import('firebase/firestore');
 vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

 await expect(
 DataExportService.exportOrganizationData({
  organizationId: 'org-1',
  planId: 'enterprise',
  hasApiAccess: true
 })
 ).rejects.toThrow();
 });

 it('should log errors', async () => {
 const { getDocs } = await import('firebase/firestore');
 vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));
 // ErrorLogger is called internally by the service
 void import('../errorLogger');
 const onError = vi.fn();

 try {
 await DataExportService.exportOrganizationData({
  organizationId: 'org-1',
  planId: 'enterprise',
  hasApiAccess: true,
  onError
 });
 } catch {
 // Expected
 }

 expect(onError).toHaveBeenCalledWith(expect.any(Error));
 });

 it('should throw on ZIP generation error', async () => {
 const JSZip = (await import('jszip')).default;
 vi.mocked(JSZip).mockImplementationOnce(() => ({
 file: vi.fn(),
 generateAsync: vi.fn().mockRejectedValueOnce(new Error('ZIP error'))
 } as unknown as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

 await expect(
 DataExportService.exportOrganizationData({
  organizationId: 'org-1',
  planId: 'enterprise',
  hasApiAccess: true
 })
 ).rejects.toThrow();
 });
 });
});
