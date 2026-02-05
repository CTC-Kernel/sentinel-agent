/**
 * Unit tests for ObsidianService
 * Tests Obsidian markdown export functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianService } from '../ObsidianService';
import { Risk, Asset, Criticality } from '../../types';

// Mock JSZip and file-saver
vi.mock('jszip', () => ({
 default: vi.fn().mockImplementation(() => ({
 folder: vi.fn().mockReturnValue({
 file: vi.fn()
 }),
 generateAsync: vi.fn().mockResolvedValue(new Blob(['test']))
 }))
}));

vi.mock('file-saver', () => ({
 saveAs: vi.fn()
}));

describe('ObsidianService', () => {
 const createRisk = (overrides: Partial<Risk> = {}): Risk => ({
 id: 'risk-123',
 assetId: 'asset-456',
 threat: 'SQL Injection Attack',
 vulnerability: 'Unvalidated input parameters',
 scenario: 'Attacker exploits input form',
 probability: 4,
 impact: 5,
 score: 20,
 status: 'Ouvert',
 strategy: 'Atténuer',
 framework: 'ISO27001',
 owner: 'Security Team',
 residualScore: 8,
 organizationId: 'org-1',
 createdAt: new Date('2024-01-15').toISOString(),
 updatedAt: new Date('2024-06-15').toISOString(),
 ...overrides
 });

 const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
 id: 'asset-123',
 name: 'Production Server',
 type: 'Matériel',
 location: 'Datacenter Paris',
 owner: 'IT Team',
 confidentiality: Criticality.HIGH,
 integrity: Criticality.HIGH,
 availability: Criticality.CRITICAL,
 organizationId: 'org-1',
 createdAt: new Date('2024-01-01').toISOString(),
 updatedAt: new Date('2024-06-01').toISOString(),
 ...overrides
 });

 describe('formatRiskToMarkdown', () => {
 it('generates markdown with frontmatter', () => {
 const risk = createRisk();
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('---');
 expect(result).toContain('type: risk');
 expect(result).toContain('id: risk-123');
 });

 it('includes risk threat as title', () => {
 const risk = createRisk({ threat: 'Phishing Attack' });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('# Phishing Attack');
 expect(result).toContain('threat: "Phishing Attack"');
 });

 it('includes assessment details', () => {
 const risk = createRisk({ probability: 3, impact: 4, score: 12 });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('probability: 3');
 expect(result).toContain('impact: 4');
 expect(result).toContain('score: 12');
 expect(result).toContain('**Probability**: 3/5');
 expect(result).toContain('**Impact**: 4/5');
 });

 it('includes tags based on risk properties', () => {
 const risk = createRisk({ score: 15, status: 'Ouvert', strategy: 'Atténuer', framework: 'ISO27001' });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('risk');
 expect(result).toContain('score/15');
 expect(result).toContain('status/Ouvert');
 expect(result).toContain('strategy/Atténuer');
 expect(result).toContain('framework/ISO27001');
 });

 it('includes treatment plan details when available', () => {
 const risk = createRisk({
 treatment: {
  strategy: 'Atténuer',
  status: 'Planifié',
  dueDate: '2024-12-31',
  description: 'Implement WAF'
 }
 });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('**Status**: Planifié');
 expect(result).toContain('**Due Date**: 2024-12-31');
 expect(result).toContain('Implement WAF');
 });

 it('shows no treatment plan message when not available', () => {
 const risk = createRisk({ treatment: undefined });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('No detailed treatment plan linked');
 });

 it('includes linked asset reference', () => {
 const risk = createRisk({ assetId: 'asset-789' });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('[[ASSET-asset-789]]');
 });

 it('escapes quotes in strings', () => {
 const risk = createRisk({ threat: 'Risk with "quotes"' });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 expect(result).toContain('\\"quotes\\"');
 });

 it('handles undefined values with default fallbacks', () => {
 const risk = createRisk({
 vulnerability: undefined,
 scenario: undefined,
 owner: undefined
 });
 const result = ObsidianService.formatRiskToMarkdown(risk);

 // The function uses N/A for missing scenario, vulnerability
 expect(result).toContain('N/A');
 });
 });

 describe('formatAssetToMarkdown', () => {
 it('generates markdown with frontmatter', () => {
 const asset = createAsset();
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('---');
 expect(result).toContain('type: asset');
 expect(result).toContain('id: asset-123');
 });

 it('includes asset name as title', () => {
 const asset = createAsset({ name: 'Database Server' });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('# Database Server');
 expect(result).toContain('name: "Database Server"');
 });

 it('includes CIA classification', () => {
 const asset = createAsset({
 confidentiality: Criticality.CRITICAL,
 integrity: Criticality.HIGH,
 availability: Criticality.MEDIUM
 });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('confidentiality: Critique');
 expect(result).toContain('integrity: Élevée');
 expect(result).toContain('availability: Moyenne');
 });

 it('includes location and owner', () => {
 const asset = createAsset({ location: 'Cloud AWS', owner: 'DevOps Team' });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('location: "Cloud AWS"');
 expect(result).toContain('owner: "DevOps Team"');
 expect(result).toContain('**Location**: Cloud AWS');
 expect(result).toContain('**Owner**: DevOps Team');
 });

 it('includes tags based on asset type', () => {
 const asset = createAsset({ type: 'Matériel' });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('tags: [asset, type/Matériel]');
 });

 it('sanitizes type for tags (removes spaces)', () => {
 const asset = createAsset({ type: 'Poste de Travail' as Asset['type'] });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('type/Poste_de_Travail');
 });

 it('includes IP address when available', () => {
 const asset = createAsset({ ipAddress: '192.168.1.100' });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('**IP Address**: 192.168.1.100');
 });

 it('includes data details when available', () => {
 const asset = createAsset({
 type: 'Données',
 dataDetails: { format: 'Numérique', dataCategory: 'Client' }
 });
 const result = ObsidianService.formatAssetToMarkdown(asset);

 expect(result).toContain('**Data Format**: Numérique');
 });
 });

 describe('exportRisksToObsidian', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('exports risks to zip file', async () => {
 const { saveAs } = await import('file-saver');
 const risks = [createRisk()];

 await ObsidianService.exportRisksToObsidian(risks);

 expect(saveAs).toHaveBeenCalled();
 expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Sentinel_Risk_Register_Obsidian.zip');
 });

 it('creates file for each risk', async () => {
 const JSZip = (await import('jszip')).default;
 const mockFile = vi.fn();
 const mockFolder = vi.fn().mockReturnValue({ file: mockFile });
 vi.mocked(JSZip).mockImplementation(() => ({
 folder: mockFolder,
 generateAsync: vi.fn().mockResolvedValue(new Blob(['test']))
 } as unknown as ReturnType<typeof JSZip>));

 const risks = [
 createRisk({ id: 'risk-1', threat: 'Risk One' }),
 createRisk({ id: 'risk-2', threat: 'Risk Two' })
 ];

 await ObsidianService.exportRisksToObsidian(risks);

 expect(mockFile).toHaveBeenCalledTimes(2);
 });
 });

 describe('exportAssetsToObsidian', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('exports assets to zip file', async () => {
 const { saveAs } = await import('file-saver');
 const assets = [createAsset()];

 await ObsidianService.exportAssetsToObsidian(assets);

 expect(saveAs).toHaveBeenCalled();
 expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Sentinel_Asset_Inventory_Obsidian.zip');
 });
 });
});
