/**
 * CMDB Relationships Hook
 *
 * React Query hook for relationship operations.
 *
 * @module hooks/cmdb/useCMDBRelationships
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CMDBRelationshipService } from '@/services/CMDBRelationshipService';
import { useStore } from '@/store';
import { ErrorLogger } from '@/services/errorLogger';
import { CMDBRelationship } from '@/types/cmdb';
import { CreateRelationshipFormData } from '@/schemas/cmdbSchema';

// Relationship-specific query keys
export const relationshipKeys = {
  all: ['cmdb-relationships'] as const,
  forCI: (orgId: string, ciId: string) =>
    [...relationshipKeys.all, 'ci', orgId, ciId] as const,
  detail: (orgId: string, relId: string) =>
    [...relationshipKeys.all, 'detail', orgId, relId] as const,
  graph: (orgId: string, ciId: string, depth: number) =>
    [...relationshipKeys.all, 'graph', orgId, ciId, depth] as const,
};

/**
 * Hook to fetch relationships for a CI
 */
export function useCMDBRelationships(ciId: string) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: relationshipKeys.forCI(organizationId, ciId),
    queryFn: async () => {
      return CMDBRelationshipService.getRelationshipsForCI(organizationId, ciId);
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch upstream dependencies (CIs this one depends on)
 */
export function useUpstreamDependencies(ciId: string) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: [...relationshipKeys.forCI(organizationId, ciId), 'upstream'],
    queryFn: async () => {
      return CMDBRelationshipService.getUpstreamDependencies(organizationId, ciId);
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch downstream dependents (CIs that depend on this one)
 */
export function useDownstreamDependents(ciId: string) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: [...relationshipKeys.forCI(organizationId, ciId), 'downstream'],
    queryFn: async () => {
      return CMDBRelationshipService.getDownstreamDependents(organizationId, ciId);
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch relationship graph for visualization
 */
export function useRelationshipGraph(ciId: string, depth: number = 2) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: relationshipKeys.graph(organizationId, ciId, depth),
    queryFn: async () => {
      return CMDBRelationshipService.getRelationshipGraph(organizationId, ciId, depth);
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for relationship mutations
 */
export function useCMDBRelationshipMutations() {
  const { user, addToast } = useStore();
  const queryClient = useQueryClient();
  const organizationId = user?.organizationId || '';
  const userId = user?.uid || '';

  // Create relationship
  const createRelationship = useMutation({
    mutationFn: (data: CreateRelationshipFormData) =>
      CMDBRelationshipService.createRelationship(organizationId, data, userId),
    onSuccess: (_, variables) => {
      // Invalidate relationships for both CIs
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forCI(organizationId, variables.sourceId),
      });
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forCI(organizationId, variables.targetId),
      });
      addToast('Relation créée avec succès', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.relationship.createError');
    },
  });

  // Update relationship
  const updateRelationship = useMutation({
    mutationFn: ({
      relationshipId,
      data,
    }: {
      relationshipId: string;
      data: Partial<CMDBRelationship>;
    }) => CMDBRelationshipService.updateRelationship(organizationId, relationshipId, data, userId),
    onMutate: async ({ relationshipId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: relationshipKeys.detail(organizationId, relationshipId),
      });

      // Snapshot previous value
      const previousRelationship = queryClient.getQueryData<CMDBRelationship>(
        relationshipKeys.detail(organizationId, relationshipId)
      );

      // Optimistically update
      if (previousRelationship) {
        queryClient.setQueryData(
          relationshipKeys.detail(organizationId, relationshipId),
          { ...previousRelationship, ...data }
        );
      }

      return { previousRelationship };
    },
    onError: (error, { relationshipId }, context) => {
      // Rollback on error
      if (context?.previousRelationship) {
        queryClient.setQueryData(
          relationshipKeys.detail(organizationId, relationshipId),
          context.previousRelationship
        );
      }
      ErrorLogger.handleErrorWithToast(error, 'cmdb.relationship.updateError');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: relationshipKeys.all });
    },
    onSuccess: () => {
      addToast('Relation mise à jour avec succès', 'success');
    },
  });

  // Delete relationship
  const deleteRelationship = useMutation({
    mutationFn: (relationshipId: string) =>
      CMDBRelationshipService.deleteRelationship(organizationId, relationshipId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: relationshipKeys.all });
      addToast('Relation supprimée', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.relationship.deleteError');
    },
  });

  // Validate relationship
  const validateRelationship = useMutation({
    mutationFn: (relationshipId: string) =>
      CMDBRelationshipService.validateRelationship(organizationId, relationshipId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: relationshipKeys.all });
      addToast('Relation validée', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.relationship.validateError');
    },
  });

  return {
    createRelationship,
    updateRelationship,
    deleteRelationship,
    validateRelationship,
  };
}

/**
 * Combined hook for relationship operations
 */
export function useCMDBRelationshipsForCI(ciId: string) {
  const relationshipsQuery = useCMDBRelationships(ciId);
  const upstreamQuery = useUpstreamDependencies(ciId);
  const downstreamQuery = useDownstreamDependents(ciId);
  const mutations = useCMDBRelationshipMutations();

  return {
    // Data
    relationships: relationshipsQuery.data || [],
    upstream: upstreamQuery.data || [],
    downstream: downstreamQuery.data || [],

    // Loading states
    isLoading: relationshipsQuery.isLoading,
    isUpstreamLoading: upstreamQuery.isLoading,
    isDownstreamLoading: downstreamQuery.isLoading,

    // Errors
    error: relationshipsQuery.error,
    upstreamError: upstreamQuery.error,
    downstreamError: downstreamQuery.error,

    // Refetch
    refetch: relationshipsQuery.refetch,

    // Mutations
    ...mutations,
  };
}
