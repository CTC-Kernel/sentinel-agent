/**
 * usePlanLimits Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlanLimits } from '../usePlanLimits';

// Mock store
const mockOrganization = {
 id: 'org-123',
 subscription: {
 planId: 'professional',
 },
};

vi.mock('../../store', () => ({
 useStore: vi.fn(() => ({
 organization: mockOrganization,
 })),
}));

// Mock plan config
vi.mock('../../config/plans', () => ({
 getPlanLimits: (plan: string) => {
 const plans: Record<string, { maxUsers: number; maxProjects: number; maxAssets: number; maxStorageGB: number; maxFrameworks: number; features: { apiAccess: boolean; sso: boolean; whiteLabelReports: boolean; customTemplates: boolean; aiAssistant: boolean } }> = {
 discovery: {
 maxUsers: 5,
 maxProjects: 1,
 maxAssets: 100,
 maxStorageGB: 1,
 maxFrameworks: 2,
 features: { apiAccess: false, sso: false, whiteLabelReports: false, customTemplates: false, aiAssistant: false },
 },
 professional: {
 maxUsers: 25,
 maxProjects: 10,
 maxAssets: 1000,
 maxStorageGB: 10,
 maxFrameworks: 5,
 features: { apiAccess: true, sso: true, whiteLabelReports: false, customTemplates: true, aiAssistant: true },
 },
 enterprise: {
 maxUsers: 999999,
 maxProjects: 999999,
 maxAssets: 999999,
 maxStorageGB: 999999,
 maxFrameworks: 999999,
 features: { apiAccess: true, sso: true, whiteLabelReports: true, customTemplates: true, aiAssistant: true },
 },
 };
 return plans[plan] || plans.discovery;
 },
}));

import { useStore } from '../../store';

describe('usePlanLimits', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 vi.mocked(useStore).mockReturnValue({
 organization: mockOrganization,
 } as ReturnType<typeof useStore>);
 });

 it('should return planId from organization subscription', () => {
 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.planId).toBe('professional');
 });

 it('should return discovery when no subscription', () => {
 vi.mocked(useStore).mockReturnValue({
 organization: { id: 'org-123' },
 } as ReturnType<typeof useStore>);

 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.planId).toBe('discovery');
 });

 it('should return discovery when no organization', () => {
 vi.mocked(useStore).mockReturnValue({
 organization: null,
 } as unknown as ReturnType<typeof useStore>);

 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.planId).toBe('discovery');
 });

 it('should return limits based on plan', () => {
 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.limits.maxUsers).toBe(25);
 expect(result.current.limits.maxProjects).toBe(10);
 });

 it('should check hasFeature correctly for true features', () => {
 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.hasFeature('apiAccess')).toBe(true);
 expect(result.current.hasFeature('sso')).toBe(true);
 });

 it('should check hasFeature correctly for false features', () => {
 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.hasFeature('whiteLabelReports')).toBe(false);
 });

 it('should return false for non-existent features', () => {
 const { result } = renderHook(() => usePlanLimits());

 // Using a non-existent feature key - should return false due to ?? false
 expect(result.current.hasFeature('nonExistentFeature' as never)).toBe(false);
 });

 it('should return true from checkLimit', () => {
 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.checkLimit('users')).toBe(true);
 expect(result.current.checkLimit('projects')).toBe(true);
 });

 it('should return limits for discovery plan', () => {
 vi.mocked(useStore).mockReturnValue({
 organization: { id: 'org-123', subscription: { planId: 'discovery' } },
 } as unknown as ReturnType<typeof useStore>);

 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.limits.maxUsers).toBe(5);
 expect(result.current.limits.maxProjects).toBe(1);
 });

 it('should return limits for enterprise plan', () => {
 vi.mocked(useStore).mockReturnValue({
 organization: { id: 'org-123', subscription: { planId: 'enterprise' } },
 } as unknown as ReturnType<typeof useStore>);

 const { result } = renderHook(() => usePlanLimits());

 expect(result.current.limits.maxUsers).toBe(999999);
 expect(result.current.hasFeature('whiteLabelReports')).toBe(true);
 });
});
