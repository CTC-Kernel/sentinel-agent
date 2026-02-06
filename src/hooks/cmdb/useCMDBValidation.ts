/**
 * CMDB Validation Hooks
 *
 * React Query hooks for validation queue operations.
 *
 * @module hooks/cmdb/useCMDBValidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CMDBValidationService } from '@/services/CMDBValidationService';
import { useCMDBStore } from '@/stores/cmdbStore';
import { useStore } from '@/store';
import { ErrorLogger } from '@/services/errorLogger';
import { cmdbKeys } from './useCMDBCIs';

// Query keys
export const validationKeys = {
  all: ['cmdb', 'validation'] as const,
  pending: (orgId: string) => [...validationKeys.all, 'pending', orgId] as const,
  count: (orgId: string) => [...validationKeys.all, 'count', orgId] as const,
  item: (orgId: string, itemId: string) => [...validationKeys.all, 'item', orgId, itemId] as const,
};

/**
 * Hook to fetch pending validation items
 */
export function usePendingValidations(limitCount: number = 50) {
  const { user } = useStore();
  const { setPendingValidation, setPendingValidationLoading } = useCMDBStore.getState();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: validationKeys.pending(organizationId),
    queryFn: async () => {
      setPendingValidationLoading(true);
      try {
        const items = await CMDBValidationService.getPendingItems(organizationId, limitCount);
        setPendingValidation(items);
        return items;
      } finally {
        setPendingValidationLoading(false);
      }
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

/**
 * Hook to get pending validation count
 */
export function usePendingValidationCount() {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: validationKeys.count(organizationId),
    queryFn: () => CMDBValidationService.getPendingCount(organizationId),
    enabled: !!organizationId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Hook for validation mutations (approve, reject, merge)
 */
export function useValidationMutations() {
  const { user, addToast } = useStore();
  const queryClient = useQueryClient();
  const organizationId = user?.organizationId || '';
  const userId = user?.uid || '';

  // Approve validation item
  const approveValidation = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: string; notes?: string }) =>
      CMDBValidationService.approveItem(organizationId, itemId, userId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: validationKeys.pending(organizationId) });
      queryClient.invalidateQueries({ queryKey: validationKeys.count(organizationId) });
      queryClient.invalidateQueries({ queryKey: cmdbKeys.cis() });
      queryClient.invalidateQueries({ queryKey: cmdbKeys.stats(organizationId) });
      addToast('CI approuvé et créé avec succès', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.validation.approveError');
    },
  });

  // Reject validation item
  const rejectValidation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      CMDBValidationService.rejectItem(organizationId, itemId, userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: validationKeys.pending(organizationId) });
      queryClient.invalidateQueries({ queryKey: validationKeys.count(organizationId) });
      addToast('CI rejeté', 'info');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.validation.rejectError');
    },
  });

  // Merge validation item
  const mergeValidation = useMutation({
    mutationFn: ({ itemId, targetCIId, notes }: { itemId: string; targetCIId: string; notes?: string }) =>
      CMDBValidationService.mergeItem(organizationId, itemId, targetCIId, userId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: validationKeys.pending(organizationId) });
      queryClient.invalidateQueries({ queryKey: validationKeys.count(organizationId) });
      queryClient.invalidateQueries({ queryKey: cmdbKeys.cis() });
      addToast('CI fusionné avec succès', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.validation.mergeError');
    },
  });

  return {
    approveValidation,
    rejectValidation,
    mergeValidation,
    isProcessing:
      approveValidation.isPending ||
      rejectValidation.isPending ||
      mergeValidation.isPending,
  };
}
