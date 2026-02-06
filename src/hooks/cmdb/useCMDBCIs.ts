/**
 * CMDB CIs Hook
 *
 * React Query hook for CI operations with optimistic updates.
 *
 * @module hooks/cmdb/useCMDBCIs
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { CMDBService } from '@/services/CMDBService';
import { useCMDBStore, useCMDBFilters } from '@/stores/cmdbStore';
import { useStore } from '@/store';
import { ErrorLogger } from '@/services/errorLogger';
import {
  ConfigurationItem,
  CMDBFilters,
  CMDBPagination,
} from '@/types/cmdb';
import { CreateCIFormData } from '@/schemas/cmdbSchema';

// Query keys
export const cmdbKeys = {
  all: ['cmdb'] as const,
  cis: () => [...cmdbKeys.all, 'cis'] as const,
  ciList: (orgId: string, filters: CMDBFilters) =>
    [...cmdbKeys.cis(), 'list', orgId, filters] as const,
  ciDetail: (orgId: string, ciId: string) =>
    [...cmdbKeys.cis(), 'detail', orgId, ciId] as const,
  ciSearch: (orgId: string, query: string) =>
    [...cmdbKeys.cis(), 'search', orgId, query] as const,
  stats: (orgId: string) => [...cmdbKeys.all, 'stats', orgId] as const,
  relationships: (orgId: string, ciId: string) =>
    [...cmdbKeys.all, 'relationships', orgId, ciId] as const,
};

/**
 * Hook to fetch paginated CIs with filters
 */
export function useCMDBCIs(customFilters?: CMDBFilters) {
  const { user } = useStore();
  const storeFilters = useCMDBFilters();
  const filters = customFilters || storeFilters;
  const { setCIs, setCIsLoading, setCIsError } = useCMDBStore.getState();

  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: cmdbKeys.ciList(organizationId, filters),
    queryFn: async () => {
      setCIsLoading(true);
      try {
        const result = await CMDBService.listCIs(organizationId, filters, { limit: 50 });
        setCIs(result.items);
        setCIsError(null);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch CIs';
        setCIsError(message);
        throw error;
      } finally {
        setCIsLoading(false);
      }
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for infinite scroll CI list
 */
export function useCMDBCIsInfinite(filters?: CMDBFilters) {
  const { user } = useStore();
  const storeFilters = useCMDBFilters();
  const activeFilters = filters || storeFilters;
  const organizationId = user?.organizationId || '';

  return useInfiniteQuery({
    queryKey: [...cmdbKeys.ciList(organizationId, activeFilters), 'infinite'],
    queryFn: async ({ pageParam }) => {
      const pagination: CMDBPagination = {
        limit: 50,
        cursor: pageParam,
      };
      return CMDBService.listCIs(organizationId, activeFilters, pagination);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!organizationId,
  });
}

/**
 * Hook to fetch a single CI
 */
export function useCMDBCI(ciId: string | null) {
  const { user } = useStore();
  const { setSelectedCI } = useCMDBStore.getState();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: cmdbKeys.ciDetail(organizationId, ciId || ''),
    queryFn: async () => {
      if (!ciId) return null;
      const ci = await CMDBService.getCI(organizationId, ciId);
      setSelectedCI(ci);
      return ci;
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to search CIs
 */
export function useCMDBSearch(searchQuery: string) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: cmdbKeys.ciSearch(organizationId, searchQuery),
    queryFn: () => CMDBService.searchCIs(organizationId, searchQuery),
    enabled: !!organizationId && searchQuery.length >= 2,
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * Hook to fetch discovery stats
 */
export function useDiscoveryStats() {
  const { user } = useStore();
  const { setDiscoveryStats } = useCMDBStore.getState();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: cmdbKeys.stats(organizationId),
    queryFn: async () => {
      const stats = await CMDBService.getDiscoveryStats(organizationId);
      setDiscoveryStats(stats);
      return stats;
    },
    enabled: !!organizationId,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });
}

/**
 * Hook for CI mutations (create, update, delete)
 */
export function useCMDBMutations() {
  const { user, addToast } = useStore();
  const queryClient = useQueryClient();
  const organizationId = user?.organizationId || '';
  const userId = user?.uid || '';

  // Create CI
  const createCI = useMutation({
    mutationFn: (data: CreateCIFormData) =>
      CMDBService.createCI(organizationId, data, userId),
    onSuccess: (_ciId) => {
      queryClient.invalidateQueries({ queryKey: cmdbKeys.cis() });
      queryClient.invalidateQueries({ queryKey: cmdbKeys.stats(organizationId) });
      addToast('Configuration Item created successfully', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.createError');
    },
  });

  // Update CI
  const updateCI = useMutation({
    mutationFn: ({ ciId, data }: { ciId: string; data: Partial<CreateCIFormData> }) =>
      CMDBService.updateCI(organizationId, ciId, data, userId),
    onMutate: async ({ ciId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: cmdbKeys.ciDetail(organizationId, ciId) });

      // Snapshot previous value
      const previousCI = queryClient.getQueryData<ConfigurationItem>(
        cmdbKeys.ciDetail(organizationId, ciId)
      );

      // Optimistically update
      if (previousCI) {
        queryClient.setQueryData(cmdbKeys.ciDetail(organizationId, ciId), {
          ...previousCI,
          ...data,
        });
      }

      return { previousCI };
    },
    onError: (error, { ciId }, context) => {
      // Rollback on error
      if (context?.previousCI) {
        queryClient.setQueryData(
          cmdbKeys.ciDetail(organizationId, ciId),
          context.previousCI
        );
      }
      ErrorLogger.handleErrorWithToast(error, 'cmdb.updateError');
    },
    onSettled: (_, __, { ciId }) => {
      queryClient.invalidateQueries({ queryKey: cmdbKeys.ciDetail(organizationId, ciId) });
      queryClient.invalidateQueries({ queryKey: cmdbKeys.cis() });
    },
    onSuccess: () => {
      addToast('Configuration Item updated successfully', 'success');
    },
  });

  // Delete CI
  const deleteCI = useMutation({
    mutationFn: (ciId: string) => CMDBService.deleteCI(organizationId, ciId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cmdbKeys.cis() });
      queryClient.invalidateQueries({ queryKey: cmdbKeys.stats(organizationId) });
      addToast('Configuration Item retired successfully', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.deleteError');
    },
  });

  return {
    createCI,
    updateCI,
    deleteCI,
  };
}

/**
 * Combined hook for common CMDB operations
 */
export function useCMDB() {
  const cisQuery = useCMDBCIs();
  const statsQuery = useDiscoveryStats();
  const mutations = useCMDBMutations();

  return {
    // Data
    cis: cisQuery.data?.items || [],
    stats: statsQuery.data,

    // Loading states
    isLoading: cisQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,

    // Errors
    error: cisQuery.error,
    statsError: statsQuery.error,

    // Refetch
    refetch: cisQuery.refetch,
    refetchStats: statsQuery.refetch,

    // Mutations
    ...mutations,
  };
}
