/**
 * useHomologation Hook
 * ANSSI Homologation - ADR-011
 * Story 38-1: React hook for Homologation operations
 */

import { useCallback, useMemo, useState } from 'react';
import { orderBy, QueryConstraint } from 'firebase/firestore';
import { useFirestoreCollection } from './useFirestore';
import { useStore } from '../store';
import { useAuth } from './useAuth';
import { HomologationService } from '../services/HomologationService';
import type {
  HomologationDossier,
  HomologationLevel,
  HomologationStatus,
  HomologationDocumentType,
  LevelDeterminationAnswer,
  LevelRecommendation,
  CreateHomologationDossierInput,
  UpdateHomologationDossierInput
} from '../types/homologation';
import { LEVEL_DETERMINATION_QUESTIONS } from '../data/homologationQuestions';

interface UseHomologationOptions {
  realtime?: boolean;
  statusFilter?: HomologationStatus;
}

interface UseHomologationReturn {
  // Data
  dossiers: HomologationDossier[];
  loading: boolean;
  error: Error | null;

  // Stats
  stats: {
    total: number;
    byStatus: Record<HomologationStatus, number>;
    byLevel: Record<HomologationLevel, number>;
    expiringSoon: number;
    expired: number;
  };

  // CRUD Actions
  createDossier: (input: CreateHomologationDossierInput) => Promise<string>;
  updateDossier: (id: string, input: UpdateHomologationDossierInput) => Promise<void>;
  updateStatus: (id: string, status: HomologationStatus) => Promise<void>;
  updateDocumentStatus: (
    dossierId: string,
    documentType: HomologationDocumentType,
    status: 'not_started' | 'in_progress' | 'completed' | 'validated',
    documentId?: string
  ) => Promise<void>;
  deleteDossier: (id: string) => Promise<void>;
  refresh: () => Promise<void>;

  // Utilities
  getDossierById: (id: string) => HomologationDossier | undefined;
  getDossiersByLevel: (level: HomologationLevel) => HomologationDossier[];
  getDossiersByStatus: (status: HomologationStatus) => HomologationDossier[];
  getExpiringDossiers: (daysAhead?: number) => HomologationDossier[];
}

export const useHomologation = (
  options: UseHomologationOptions = {}
): UseHomologationReturn => {
  const { realtime = true, statusFilter } = options;
  const { organization } = useStore();
  const { user } = useAuth();

  // Extract IDs for stable memoization
  const organizationId = organization?.id;
  const userId = user?.uid;

  // Build query constraints
  const constraints = useMemo(() => {
    const result: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    return result;
  }, []);

  // Collection path
  const collectionPath = useMemo(() => {
    if (!organizationId) return null;
    return `organizations/${organizationId}/homologations`;
  }, [organizationId]);

  // Use Firestore collection hook
  const {
    data: rawDossiers,
    loading,
    error,
    refresh
  } = useFirestoreCollection<HomologationDossier>(collectionPath ?? '', constraints, {
    enabled: !!organizationId && !!collectionPath,
    realtime
  });

  // Filter dossiers by status if needed
  const dossiers = useMemo(() => {
    if (!rawDossiers) return [];
    if (statusFilter) {
      return rawDossiers.filter((d) => d.status === statusFilter);
    }
    return rawDossiers;
  }, [rawDossiers, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const result = {
      total: dossiers.length,
      byStatus: {
        draft: 0,
        in_progress: 0,
        pending_decision: 0,
        homologated: 0,
        expired: 0,
        revoked: 0
      } as Record<HomologationStatus, number>,
      byLevel: {
        etoile: 0,
        simple: 0,
        standard: 0,
        renforce: 0
      } as Record<HomologationLevel, number>,
      expiringSoon: 0,
      expired: 0
    };

    for (const dossier of dossiers) {
      result.byStatus[dossier.status]++;
      result.byLevel[dossier.level]++;

      if (dossier.validityEndDate) {
        const endDate = new Date(dossier.validityEndDate);
        if (endDate < now) {
          result.expired++;
        } else if (endDate <= thirtyDaysFromNow) {
          result.expiringSoon++;
        }
      }
    }

    return result;
  }, [dossiers]);

  // Create dossier
  const createDossier = useCallback(
    async (input: CreateHomologationDossierInput): Promise<string> => {
      // Validation des entrées
      if (!input) {
        throw new Error('Invalid input provided to createDossier');
      }

      const { organizationId: inputOrgId, userId: inputUserId } = input;

      // Vérifications avec messages d'erreur améliorés
      if (!inputOrgId) {
        throw new Error('Organization ID is required for dossier creation');
      }

      if (!inputUserId) {
        throw new Error('User ID is required for dossier creation');
      }

      try {
        const dossier = await HomologationService.createDossier(
          inputOrgId,
          inputUserId,
          input
        );
        return dossier.id;
      } catch (error) {
        console.error('Error creating dossier:', error);
        throw error;
      }
    },
    []
  );

  // Update dossier
  const updateDossier = useCallback(
    async (id: string, input: UpdateHomologationDossierInput): Promise<void> => {
      if (!organizationId || !userId) {
        throw new Error('Organization and user required');
      }

      await HomologationService.updateDossier(organizationId, id, userId, input);
    },
    [organizationId, userId]
  );

  // Update status
  const updateStatus = useCallback(
    async (id: string, status: HomologationStatus): Promise<void> => {
      if (!organizationId || !userId) {
        throw new Error('Organization and user required');
      }

      await HomologationService.updateDossierStatus(organizationId, id, userId, status);
    },
    [organizationId, userId]
  );

  // Update document status
  const updateDocumentStatus = useCallback(
    async (
      dossierId: string,
      documentType: HomologationDocumentType,
      status: 'not_started' | 'in_progress' | 'completed' | 'validated',
      documentId?: string
    ): Promise<void> => {
      if (!organizationId || !userId) {
        throw new Error('Organization and user required');
      }

      await HomologationService.updateDocumentStatus(
        organizationId,
        dossierId,
        userId,
        documentType,
        status,
        documentId
      );
    },
    [organizationId, userId]
  );

  // Delete dossier
  const deleteDossier = useCallback(
    async (id: string): Promise<void> => {
      if (!organizationId) {
        throw new Error('Organization required');
      }

      await HomologationService.deleteDossier(organizationId, id);
    },
    [organizationId]
  );

  // Get dossier by ID
  const getDossierById = useCallback(
    (id: string): HomologationDossier | undefined => {
      return dossiers.find((d) => d.id === id);
    },
    [dossiers]
  );

  // Get dossiers by level
  const getDossiersByLevel = useCallback(
    (level: HomologationLevel): HomologationDossier[] => {
      return dossiers.filter((d) => d.level === level);
    },
    [dossiers]
  );

  // Get dossiers by status
  const getDossiersByStatus = useCallback(
    (status: HomologationStatus): HomologationDossier[] => {
      return dossiers.filter((d) => d.status === status);
    },
    [dossiers]
  );

  // Get expiring dossiers
  const getExpiringDossiers = useCallback(
    (daysAhead: number = 90): HomologationDossier[] => {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() + daysAhead);

      return dossiers.filter((d) => {
        if (d.status !== 'homologated' || !d.validityEndDate) return false;
        const endDate = new Date(d.validityEndDate);
        return endDate <= threshold && endDate >= new Date();
      });
    },
    [dossiers]
  );

  return {
    dossiers,
    loading,
    error,
    stats,
    createDossier,
    updateDossier,
    updateStatus,
    updateDocumentStatus,
    deleteDossier,
    refresh,
    getDossierById,
    getDossiersByLevel,
    getDossiersByStatus,
    getExpiringDossiers
  };
};

// ============================================================================
// Level Determination Hook
// ============================================================================

interface UseLevelDeterminationReturn {
  // Current state
  answers: Map<string, LevelDeterminationAnswer>;
  recommendation: LevelRecommendation | null;

  // Actions
  setAnswer: (questionId: string, value: string | string[]) => void;
  clearAnswers: () => void;
  calculateRecommendation: () => LevelRecommendation;

  // Utilities
  getProgress: () => { answered: number; total: number; percentage: number };
  isComplete: () => boolean;
}

export const useLevelDetermination = (): UseLevelDeterminationReturn => {
  const [answers, setAnswers] = useState<Map<string, LevelDeterminationAnswer>>(new Map());
  const [recommendation, setRecommendation] = useState<LevelRecommendation | null>(null);

  // Set an answer
  const setAnswer = useCallback((questionId: string, value: string | string[]) => {
    const processedAnswer = HomologationService.processAnswer(questionId, value);
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, processedAnswer);
      return next;
    });
    // Clear recommendation when answers change
    setRecommendation(null);
  }, []);

  // Clear all answers
  const clearAnswers = useCallback(() => {
    setAnswers(new Map());
    setRecommendation(null);
  }, []);

  // Calculate recommendation
  const calculateRecommendation = useCallback((): LevelRecommendation => {
    const answersArray = Array.from(answers.values());
    const result = HomologationService.calculateLevelRecommendation(answersArray);
    setRecommendation(result);
    return result;
  }, [answers]);

  // Get progress
  const getProgress = useCallback(() => {
    const total = LEVEL_DETERMINATION_QUESTIONS.filter((q) => q.required).length;
    const answered = Array.from(answers.values()).filter((a) => {
      const question = LEVEL_DETERMINATION_QUESTIONS.find((q) => q.id === a.questionId);
      return question?.required;
    }).length;
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    };
  }, [answers]);

  // Check if complete
  const isComplete = useCallback(() => {
    const requiredQuestions = LEVEL_DETERMINATION_QUESTIONS.filter((q) => q.required);
    return requiredQuestions.every((q) => answers.has(q.id));
  }, [answers]);

  return {
    answers,
    recommendation,
    setAnswer,
    clearAnswers,
    calculateRecommendation,
    getProgress,
    isComplete
  };
};

export default useHomologation;
