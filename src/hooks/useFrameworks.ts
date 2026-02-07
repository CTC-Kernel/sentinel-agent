/**
 * useFrameworks - Hook for framework data management
 *
 * Provides TanStack Query integration for frameworks, requirements,
 * and control mappings with real-time subscriptions.
 *
 * @see Story EU-1.2: Implémenter FrameworkService
 * @see ADR-001: Multi-Framework Data Model
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { FrameworkService } from '../services/FrameworkService';
import { ErrorLogger } from '../services/errorLogger';
import type {
 ControlMapping,
 RegulatoryFrameworkCode,
} from '../types/framework';

// ============================================================================
// Query Keys (re-exported from constants/queryKeys.ts)
// ============================================================================

// Re-export query keys (moved to constants/queryKeys.ts to satisfy hooks naming convention)
export { frameworkQueryKeys } from '../constants/queryKeys';

// ============================================================================
// Options Types
// ============================================================================

export interface UseFrameworksOptions {
 /** Enable/disable fetching */
 enabled?: boolean;
 /** Enable real-time subscription */
 realtime?: boolean;
 /** Stale time in ms (default: 5min) */
 staleTime?: number;
}

export interface UseRequirementsOptions {
 /** Framework ID to fetch requirements for */
 frameworkId: string;
 /** Enable/disable fetching */
 enabled?: boolean;
 /** Group by category */
 groupByCategory?: boolean;
 /** Locale for category labels */
 locale?: 'en' | 'fr' | 'de';
 /** Enable real-time subscription */
 realtime?: boolean;
}

export interface UseMappingsOptions {
 /** Control ID to fetch mappings for */
 controlId: string;
 /** Enable/disable fetching */
 enabled?: boolean;
 /** Enable real-time subscription */
 realtime?: boolean;
}

// ============================================================================
// useFrameworks Hook
// ============================================================================

/**
 * Hook for fetching all available frameworks
 */
export function useFrameworks(options: UseFrameworksOptions = {}) {
 const { enabled = true, realtime = false, staleTime = 300000 } = options;
 const queryClient = useQueryClient();

 // Real-time subscription
 useEffect(() => {
 if (!enabled || !realtime) return;

 const unsubscribe = FrameworkService.subscribeToFrameworks((frameworks) => {
 queryClient.setQueryData(frameworkQueryKeys.list(), frameworks);
 });

 return () => unsubscribe();
 }, [enabled, realtime, queryClient]);

 return useQuery({
 queryKey: frameworkQueryKeys.list(),
 queryFn: () => FrameworkService.getFrameworks(),
 enabled,
 staleTime,
 gcTime: staleTime * 2,
 });
}

/**
 * Hook for fetching a single framework
 */
export function useFramework(frameworkId: string, options: { enabled?: boolean } = {}) {
 const { enabled = true } = options;

 return useQuery({
 queryKey: frameworkQueryKeys.detail(frameworkId),
 queryFn: () => FrameworkService.getFramework(frameworkId),
 enabled: enabled && !!frameworkId,
 staleTime: 300000,
 });
}

// ============================================================================
// useRequirements Hook
// ============================================================================

/**
 * Hook for fetching requirements for a framework
 */
export function useRequirements(options: UseRequirementsOptions) {
 const {
 frameworkId,
 enabled = true,
 groupByCategory = false,
 locale = 'fr',
 realtime = false,
 } = options;
 const queryClient = useQueryClient();

 // Real-time subscription
 useEffect(() => {
 if (!enabled || !realtime || !frameworkId) return;

 const unsubscribe = FrameworkService.subscribeToRequirements(
 frameworkId,
 (requirements) => {
 queryClient.setQueryData(
 frameworkQueryKeys.requirements(frameworkId),
 requirements
 );
 }
 );

 return () => unsubscribe();
 }, [enabled, realtime, frameworkId, queryClient]);

 // Grouped query
 const groupedQuery = useQuery({
 queryKey: frameworkQueryKeys.requirementsByCategory(frameworkId, locale),
 queryFn: () => FrameworkService.getRequirementsByCategory(frameworkId, locale),
 enabled: enabled && !!frameworkId && groupByCategory,
 staleTime: 300000,
 });

 // Flat query
 const flatQuery = useQuery({
 queryKey: frameworkQueryKeys.requirements(frameworkId),
 queryFn: () => FrameworkService.getRequirements(frameworkId),
 enabled: enabled && !!frameworkId && !groupByCategory,
 staleTime: 300000,
 });

 if (groupByCategory) {
 return {
 data: groupedQuery.data,
 isLoading: groupedQuery.isLoading,
 error: groupedQuery.error,
 refetch: groupedQuery.refetch,
 isGrouped: true as const,
 };
 }

 return {
 data: flatQuery.data,
 isLoading: flatQuery.isLoading,
 error: flatQuery.error,
 refetch: flatQuery.refetch,
 isGrouped: false as const,
 };
}

// ============================================================================
// useMappings Hook
// ============================================================================

/**
 * Hook for fetching control mappings
 */
export function useMappings(options: UseMappingsOptions) {
 const { controlId, enabled = true, realtime = false } = options;
 const { user } = useStore();
 const organizationId = user?.organizationId;
 const queryClient = useQueryClient();

 // Real-time subscription
 useEffect(() => {
 if (!enabled || !realtime || !organizationId || !controlId) return;

 const unsubscribe = FrameworkService.subscribeToMappings(
 organizationId,
 controlId,
 (mappings) => {
 queryClient.setQueryData(
 frameworkQueryKeys.mappings(organizationId, controlId),
 mappings
 );
 }
 );

 return () => unsubscribe();
 }, [enabled, realtime, organizationId, controlId, queryClient]);

 return useQuery({
 queryKey: frameworkQueryKeys.mappings(organizationId || '', controlId),
 queryFn: () => FrameworkService.getMappings(organizationId!, controlId),
 enabled: enabled && !!organizationId && !!controlId,
 staleTime: 60000,
 });
}

/**
 * Hook for fetching all mappings for a framework
 */
export function useMappingsByFramework(frameworkId: string, options: { enabled?: boolean } = {}) {
 const { enabled = true } = options;
 const { user } = useStore();
 const organizationId = user?.organizationId;

 return useQuery({
 queryKey: frameworkQueryKeys.mappingsByFramework(organizationId || '', frameworkId),
 queryFn: () => FrameworkService.getMappingsByFramework(organizationId!, frameworkId),
 enabled: enabled && !!organizationId && !!frameworkId,
 staleTime: 60000,
 });
}

// ============================================================================
// useActiveFrameworks Hook
// ============================================================================

/**
 * Hook for fetching active frameworks for the current organization
 */
export function useActiveFrameworks(options: { enabled?: boolean; realtime?: boolean } = {}) {
 const { enabled = true, realtime = false } = options;
 const { user } = useStore();
 const organizationId = user?.organizationId;
 const queryClient = useQueryClient();

 // Real-time subscription
 useEffect(() => {
 if (!enabled || !realtime || !organizationId) return;

 const unsubscribe = FrameworkService.subscribeToActiveFrameworks(
 organizationId,
 (activeFrameworks) => {
 queryClient.setQueryData(
 frameworkQueryKeys.activeFrameworks(organizationId),
 activeFrameworks
 );
 }
 );

 return () => unsubscribe();
 }, [enabled, realtime, organizationId, queryClient]);

 return useQuery({
 queryKey: frameworkQueryKeys.activeFrameworks(organizationId || ''),
 queryFn: () => FrameworkService.getActiveFrameworks(organizationId!),
 enabled: enabled && !!organizationId,
 staleTime: 60000,
 });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook for activating/deactivating frameworks
 */
export function useFrameworkActivation() {
 const { user } = useStore();
 const organizationId = user?.organizationId;
 const userId = user?.uid;
 const queryClient = useQueryClient();

 const activateMutation = useMutation({
 mutationFn: async ({
 frameworkId,
 frameworkCode,
 targetComplianceDate,
 notes,
 }: {
 frameworkId: string;
 frameworkCode: RegulatoryFrameworkCode;
 targetComplianceDate?: string;
 notes?: string;
 }) => {
 if (!organizationId || !userId) throw new Error('User not authenticated');
 return FrameworkService.activateFramework(
 organizationId,
 frameworkId,
 frameworkCode,
 userId,
 { targetComplianceDate, notes }
 );
 },
 onSuccess: () => {
 if (organizationId) {
 queryClient.invalidateQueries({
 queryKey: frameworkQueryKeys.activeFrameworks(organizationId),
 });
 }
 },
 onError: (error) => {
 ErrorLogger.handleErrorWithToast(error, 'useFrameworkActivation.activate', 'UPDATE_FAILED');
 },
 });

 const deactivateMutation = useMutation({
 mutationFn: async (frameworkId: string) => {
 if (!organizationId) throw new Error('User not authenticated');
 return FrameworkService.deactivateFramework(organizationId, frameworkId);
 },
 onSuccess: () => {
 if (organizationId) {
 queryClient.invalidateQueries({
 queryKey: frameworkQueryKeys.activeFrameworks(organizationId),
 });
 }
 },
 onError: (error) => {
 ErrorLogger.handleErrorWithToast(error, 'useFrameworkActivation.deactivate', 'UPDATE_FAILED');
 },
 });

 return {
 activate: activateMutation.mutate,
 activateAsync: activateMutation.mutateAsync,
 deactivate: deactivateMutation.mutate,
 deactivateAsync: deactivateMutation.mutateAsync,
 isActivating: activateMutation.isPending,
 isDeactivating: deactivateMutation.isPending,
 };
}

/**
 * Hook for managing control mappings
 */
export function useMappingMutations() {
 const { user } = useStore();
 const organizationId = user?.organizationId;
 const queryClient = useQueryClient();

 const createMutation = useMutation({
 mutationFn: async (mapping: Omit<ControlMapping, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
 if (!organizationId) throw new Error('User not authenticated');
 return FrameworkService.createMapping({
 ...mapping,
 organizationId,
 }, organizationId);
 },
 onSuccess: (_, variables) => {
 if (organizationId) {
 queryClient.invalidateQueries({
 queryKey: frameworkQueryKeys.mappings(organizationId, variables.controlId),
 });
 queryClient.invalidateQueries({
 queryKey: frameworkQueryKeys.mappingsByFramework(organizationId, variables.frameworkId),
 });
 }
 },
 onError: (error) => {
 ErrorLogger.handleErrorWithToast(error, 'useMappingMutations.create', 'CREATE_FAILED');
 },
 });

 const updateMutation = useMutation({
 mutationFn: async ({
 mappingId,
 updates,
 }: {
 mappingId: string;
 updates: Partial<Pick<ControlMapping, 'coveragePercentage' | 'coverageStatus' | 'notes' | 'isValidated'>>;
 }) => {
 if (!organizationId) throw new Error('User not authenticated');
 return FrameworkService.updateMapping(mappingId, organizationId, updates);
 },
 onSuccess: () => {
 // Invalidate all mapping queries
 queryClient.invalidateQueries({
 queryKey: frameworkQueryKeys.all,
 predicate: (query) => query.queryKey.includes('mappings'),
 });
 },
 onError: (error) => {
 ErrorLogger.handleErrorWithToast(error, 'useMappingMutations.update', 'UPDATE_FAILED');
 },
 });

 const deleteMutation = useMutation({
 mutationFn: async (mappingId: string) => {
 if (!organizationId) throw new Error('User not authenticated');
 return FrameworkService.deleteMapping(mappingId, organizationId);
 },
 onSuccess: () => {
 // Invalidate all mapping queries
 queryClient.invalidateQueries({
 queryKey: frameworkQueryKeys.all,
 predicate: (query) => query.queryKey.includes('mappings'),
 });
 },
 onError: (error) => {
 ErrorLogger.handleErrorWithToast(error, 'useMappingMutations.delete', 'DELETE_FAILED');
 },
 });

 return {
 create: createMutation.mutate,
 createAsync: createMutation.mutateAsync,
 update: updateMutation.mutate,
 updateAsync: updateMutation.mutateAsync,
 delete: deleteMutation.mutate,
 deleteAsync: deleteMutation.mutateAsync,
 isCreating: createMutation.isPending,
 isUpdating: updateMutation.isPending,
 isDeleting: deleteMutation.isPending,
 };
}

// ============================================================================
// useControlWithMappings Hook
// ============================================================================

/**
 * Hook for fetching a control with all its framework mappings
 */
export function useControlWithMappings(
 controlId: string,
 controlCode: string,
 controlName: string,
 options: { enabled?: boolean } = {}
) {
 const { enabled = true } = options;
 const { user } = useStore();
 const organizationId = user?.organizationId;

 return useQuery({
 queryKey: frameworkQueryKeys.controlWithMappings(organizationId || '', controlId),
 queryFn: () =>
 FrameworkService.getControlWithMappings(organizationId!, controlId, controlCode, controlName),
 enabled: enabled && !!organizationId && !!controlId,
 staleTime: 60000,
 });
}
