/**
 * ContractExpirationService Tests
 * Story 35-4: Contract Expiration Alerts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
 ContractExpirationService,
 ExpirationThresholds,
 ExpiringContract,
 ExpiringContractsGrouped
} from '../ContractExpirationService';
import { ICTProvider } from '../../types/dora';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {}
}));

const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 getDocs: () => mockGetDocs(),
 getDoc: () => mockGetDoc(),
 setDoc: () => mockSetDoc(),
 doc: vi.fn()
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

// Helper to create date strings
const daysFromNow = (days: number): string => {
 const date = new Date();
 date.setDate(date.getDate() + days);
 return date.toISOString().split('T')[0];
};

// Sample test data
const createMockProvider = (overrides: Partial<ICTProvider> = {}): ICTProvider => ({
 id: 'provider-1',
 organizationId: 'org-1',
 name: 'Test Provider',
 category: 'critical',
 status: 'active',
 contractInfo: {
 startDate: '2024-01-01',
 endDate: daysFromNow(45), // Default: 45 days from now
 exitStrategy: 'Migration to alternative provider',
 auditRights: true
 },
 createdAt: '2024-01-01',
 updatedAt: '2025-01-01',
 ...overrides
});

describe('ContractExpirationService', () => {
 const defaultThresholds: ExpirationThresholds = {
 critical: 30,
 warning: 60,
 notice: 90
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('calculateDaysRemaining', () => {
 it('should calculate positive days for future date', () => {
 const futureDate = daysFromNow(30);
 const result = ContractExpirationService.calculateDaysRemaining(futureDate);
 expect(result).toBe(30);
 });

 it('should calculate zero for today', () => {
 const today = new Date().toISOString().split('T')[0];
 const result = ContractExpirationService.calculateDaysRemaining(today);
 expect(result).toBe(0);
 });

 it('should calculate negative days for past date', () => {
 const pastDate = daysFromNow(-10);
 const result = ContractExpirationService.calculateDaysRemaining(pastDate);
 expect(result).toBe(-10);
 });

 it('should return null for null input', () => {
 const result = ContractExpirationService.calculateDaysRemaining(null);
 expect(result).toBeNull();
 });

 it('should return null for undefined input', () => {
 const result = ContractExpirationService.calculateDaysRemaining(undefined);
 expect(result).toBeNull();
 });

 it('should return null for invalid date string', () => {
 const result = ContractExpirationService.calculateDaysRemaining('not-a-date');
 expect(result).toBeNull();
 });

 it('should handle ISO date strings', () => {
 const futureDate = new Date();
 futureDate.setDate(futureDate.getDate() + 15);
 const result = ContractExpirationService.calculateDaysRemaining(futureDate.toISOString());
 expect(result).toBe(15);
 });
 });

 describe('classifyUrgency', () => {
 it('should classify as expired for 0 days', () => {
 const result = ContractExpirationService.classifyUrgency(0, defaultThresholds);
 expect(result).toBe('expired');
 });

 it('should classify as expired for negative days', () => {
 const result = ContractExpirationService.classifyUrgency(-5, defaultThresholds);
 expect(result).toBe('expired');
 });

 it('should classify as critical for 1-30 days', () => {
 expect(ContractExpirationService.classifyUrgency(1, defaultThresholds)).toBe('critical');
 expect(ContractExpirationService.classifyUrgency(15, defaultThresholds)).toBe('critical');
 expect(ContractExpirationService.classifyUrgency(30, defaultThresholds)).toBe('critical');
 });

 it('should classify as warning for 31-60 days', () => {
 expect(ContractExpirationService.classifyUrgency(31, defaultThresholds)).toBe('warning');
 expect(ContractExpirationService.classifyUrgency(45, defaultThresholds)).toBe('warning');
 expect(ContractExpirationService.classifyUrgency(60, defaultThresholds)).toBe('warning');
 });

 it('should classify as notice for 61-90 days', () => {
 expect(ContractExpirationService.classifyUrgency(61, defaultThresholds)).toBe('notice');
 expect(ContractExpirationService.classifyUrgency(75, defaultThresholds)).toBe('notice');
 expect(ContractExpirationService.classifyUrgency(90, defaultThresholds)).toBe('notice');
 });

 it('should use custom thresholds', () => {
 const customThresholds: ExpirationThresholds = {
 critical: 15,
 warning: 30,
 notice: 45
 };

 expect(ContractExpirationService.classifyUrgency(10, customThresholds)).toBe('critical');
 expect(ContractExpirationService.classifyUrgency(20, customThresholds)).toBe('warning');
 expect(ContractExpirationService.classifyUrgency(40, customThresholds)).toBe('notice');
 });
 });

 describe('checkContractExpiration', () => {
 it('should return null for provider without end date', () => {
 const provider = createMockProvider({
 contractInfo: {
  startDate: '2024-01-01'
 }
 });

 const result = ContractExpirationService.checkContractExpiration(provider);
 expect(result).toBeNull();
 });

 it('should return null for provider beyond notice threshold', () => {
 const provider = createMockProvider({
 contractInfo: {
  startDate: '2024-01-01',
  endDate: daysFromNow(120)
 }
 });

 const result = ContractExpirationService.checkContractExpiration(provider);
 expect(result).toBeNull();
 });

 it('should return expiring contract for provider within threshold', () => {
 const provider = createMockProvider({
 contractInfo: {
  startDate: '2024-01-01',
  endDate: daysFromNow(25),
  exitStrategy: 'Exit plan exists',
  auditRights: true
 }
 });

 const result = ContractExpirationService.checkContractExpiration(provider);

 expect(result).not.toBeNull();
 expect(result?.providerId).toBe('provider-1');
 expect(result?.providerName).toBe('Test Provider');
 expect(result?.category).toBe('critical');
 expect(result?.daysRemaining).toBe(25);
 expect(result?.urgency).toBe('critical');
 expect(result?.hasExitStrategy).toBe(true);
 expect(result?.hasAuditRights).toBe(true);
 });

 it('should return expired contract for past date', () => {
 const provider = createMockProvider({
 contractInfo: {
  startDate: '2024-01-01',
  endDate: daysFromNow(-5)
 }
 });

 const result = ContractExpirationService.checkContractExpiration(provider);

 expect(result).not.toBeNull();
 expect(result?.urgency).toBe('expired');
 expect(result?.daysRemaining).toBe(-5);
 });

 it('should detect missing exit strategy', () => {
 const provider = createMockProvider({
 contractInfo: {
  startDate: '2024-01-01',
  endDate: daysFromNow(20)
  // No exitStrategy
 }
 });

 const result = ContractExpirationService.checkContractExpiration(provider);

 expect(result?.hasExitStrategy).toBe(false);
 });
 });

 describe('groupExpiringContracts', () => {
 it('should group providers by urgency', () => {
 const providers = [
 createMockProvider({ id: 'expired', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(-5) } }),
 createMockProvider({ id: 'critical', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(15) } }),
 createMockProvider({ id: 'warning', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(45) } }),
 createMockProvider({ id: 'notice', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(75) } })
 ];

 const result = ContractExpirationService.groupExpiringContracts(providers);

 expect(result.expired).toHaveLength(1);
 expect(result.critical).toHaveLength(1);
 expect(result.warning).toHaveLength(1);
 expect(result.notice).toHaveLength(1);
 expect(result.total).toBe(4);
 });

 it('should exclude providers beyond notice threshold', () => {
 const providers = [
 createMockProvider({ id: 'p1', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(15) } }),
 createMockProvider({ id: 'p2', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(150) } }) // Beyond threshold
 ];

 const result = ContractExpirationService.groupExpiringContracts(providers);

 expect(result.total).toBe(1);
 expect(result.critical).toHaveLength(1);
 });

 it('should sort each group by days remaining', () => {
 const providers = [
 createMockProvider({ id: 'c2', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(25) } }),
 createMockProvider({ id: 'c1', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(10) } }),
 createMockProvider({ id: 'c3', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(20) } })
 ];

 const result = ContractExpirationService.groupExpiringContracts(providers);

 expect(result.critical[0].providerId).toBe('c1');
 expect(result.critical[1].providerId).toBe('c3');
 expect(result.critical[2].providerId).toBe('c2');
 });

 it('should return empty groups when no contracts are expiring', () => {
 const providers = [
 createMockProvider({ id: 'p1', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(200) } }),
 createMockProvider({ id: 'p2', contractInfo: { startDate: '2024-01-01' } }) // No end date
 ];

 const result = ContractExpirationService.groupExpiringContracts(providers);

 expect(result.expired).toHaveLength(0);
 expect(result.critical).toHaveLength(0);
 expect(result.warning).toHaveLength(0);
 expect(result.notice).toHaveLength(0);
 expect(result.total).toBe(0);
 });
 });

 describe('getExpirationStats', () => {
 it('should calculate correct stats', () => {
 const grouped: ExpiringContractsGrouped = {
 expired: [{ providerId: 'e1' } as ExpiringContract],
 critical: [{ providerId: 'c1' } as ExpiringContract, { providerId: 'c2' } as ExpiringContract],
 warning: [{ providerId: 'w1' } as ExpiringContract],
 notice: [{ providerId: 'n1' } as ExpiringContract, { providerId: 'n2' } as ExpiringContract, { providerId: 'n3' } as ExpiringContract],
 total: 7
 };

 const stats = ContractExpirationService.getExpirationStats(grouped);

 expect(stats.expiredCount).toBe(1);
 expect(stats.criticalCount).toBe(2);
 expect(stats.warningCount).toBe(1);
 expect(stats.noticeCount).toBe(3);
 expect(stats.total).toBe(7);
 expect(stats.hasUrgent).toBe(true);
 });

 it('should detect no urgent contracts', () => {
 const grouped: ExpiringContractsGrouped = {
 expired: [],
 critical: [],
 warning: [{ providerId: 'w1' } as ExpiringContract],
 notice: [{ providerId: 'n1' } as ExpiringContract],
 total: 2
 };

 const stats = ContractExpirationService.getExpirationStats(grouped);

 expect(stats.hasUrgent).toBe(false);
 });
 });

 describe('formatExpirationMessage', () => {
 it('should format expired message in French', () => {
 const contract: ExpiringContract = {
 providerId: 'p1',
 providerName: 'AWS',
 category: 'critical',
 endDate: '2025-01-01',
 daysRemaining: -5,
 urgency: 'expired',
 hasExitStrategy: false,
 hasAuditRights: false
 };

 const message = ContractExpirationService.formatExpirationMessage(contract, 'fr');
 expect(message).toContain('AWS');
 expect(message).toContain('expiré');
 });

 it('should format critical message in English', () => {
 const contract: ExpiringContract = {
 providerId: 'p1',
 providerName: 'Azure',
 category: 'critical',
 endDate: '2025-02-15',
 daysRemaining: 15,
 urgency: 'critical',
 hasExitStrategy: true,
 hasAuditRights: true
 };

 const message = ContractExpirationService.formatExpirationMessage(contract, 'en');
 expect(message).toContain('Azure');
 expect(message).toContain('15');
 expect(message).toContain('day');
 });
 });

 describe('getNotificationTitle', () => {
 it('should return correct title for expired contracts', () => {
 const title = ContractExpirationService.getNotificationTitle('expired', 3, 'fr');
 expect(title).toContain('3');
 expect(title).toContain('expiré');
 });

 it('should return correct title for critical contracts', () => {
 const title = ContractExpirationService.getNotificationTitle('critical', 2, 'en');
 expect(title).toContain('2');
 expect(title).toContain('30 days');
 });
 });

 describe('getUrgencyColor', () => {
 it('should return red colors for expired', () => {
 // expired uses slate colors now
 const colors = ContractExpirationService.getUrgencyColor('expired');
 expect(colors.bg).toContain('slate');
 });

 it('should return red colors for critical', () => {
 const colors = ContractExpirationService.getUrgencyColor('critical');
 expect(colors.bg).toContain('red');
 expect(colors.text).toContain('red');
 });

 it('should return amber colors for warning', () => {
 const colors = ContractExpirationService.getUrgencyColor('warning');
 expect(colors.bg).toContain('amber');
 expect(colors.text).toContain('amber');
 });

 it('should return yellow colors for notice', () => {
 const colors = ContractExpirationService.getUrgencyColor('notice');
 expect(colors.bg).toContain('yellow');
 expect(colors.text).toContain('yellow');
 });
 });

 describe('getExpiringContracts', () => {
 it('should fetch and group providers from Firestore', async () => {
 const mockProviders = [
 createMockProvider({ id: 'p1', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(10) } }),
 createMockProvider({ id: 'p2', contractInfo: { startDate: '2024-01-01', endDate: daysFromNow(50) } })
 ];

 mockGetDocs.mockResolvedValueOnce({
 docs: mockProviders.map(p => ({
  id: p.id,
  data: () => p
 }))
 });

 const result = await ContractExpirationService.getExpiringContracts('org-1');

 expect(result.total).toBe(2);
 expect(result.critical).toHaveLength(1);
 expect(result.warning).toHaveLength(1);
 });

 it('should return empty groups on error', async () => {
 mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

 const result = await ContractExpirationService.getExpiringContracts('org-1');

 expect(result.total).toBe(0);
 expect(result.expired).toHaveLength(0);
 });
 });

 describe('getAlertConfig', () => {
 it('should return default config when none exists', async () => {
 mockGetDoc.mockResolvedValueOnce({
 exists: () => false
 });

 const config = await ContractExpirationService.getAlertConfig('org-1');

 expect(config.enabled).toBe(true);
 expect(config.thresholds.critical).toBe(30);
 expect(config.thresholds.warning).toBe(60);
 expect(config.thresholds.notice).toBe(90);
 });

 it('should merge stored config with defaults', async () => {
 mockGetDoc.mockResolvedValueOnce({
 exists: () => true,
 data: () => ({
  enabled: false,
  thresholds: { critical: 15 }
 })
 });

 const config = await ContractExpirationService.getAlertConfig('org-1');

 expect(config.enabled).toBe(false);
 expect(config.thresholds.critical).toBe(15);
 });
 });

 describe('edge cases', () => {
 it('should handle provider with empty contractInfo object', () => {
 const provider = createMockProvider({
 contractInfo: {}
 });

 const result = ContractExpirationService.checkContractExpiration(provider);
 expect(result).toBeNull();
 });

 it('should handle provider with undefined contractInfo', () => {
 const provider = createMockProvider();
 delete (provider as Partial<ICTProvider>).contractInfo;

 const result = ContractExpirationService.checkContractExpiration(provider);
 expect(result).toBeNull();
 });

 it('should handle boundary day values correctly', () => {
 // Exactly at boundary
 expect(ContractExpirationService.classifyUrgency(30, defaultThresholds)).toBe('critical');
 expect(ContractExpirationService.classifyUrgency(60, defaultThresholds)).toBe('warning');
 expect(ContractExpirationService.classifyUrgency(90, defaultThresholds)).toBe('notice');

 // Just over boundary
 expect(ContractExpirationService.classifyUrgency(31, defaultThresholds)).toBe('warning');
 expect(ContractExpirationService.classifyUrgency(61, defaultThresholds)).toBe('notice');
 });
 });
});
