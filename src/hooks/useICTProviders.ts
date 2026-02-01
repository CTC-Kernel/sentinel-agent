/**
 * useICTProviders Hook
 * DORA Art. 28 - ICT Provider Management
 * Story 35.1: React hook for ICT Provider operations
 */

import { useCallback, useMemo } from 'react';
import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { useFirestoreCollection } from './useFirestore';
import { useStore } from '../store';
import { ICTProviderService } from '../services/ICTProviderService';
import {
    ICTProvider,
    ICTProviderFormData,
    ICTProviderFilters,
    ICTCriticality,
    ConcentrationAnalysis
} from '../types/dora';
import { useAuth } from './useAuth';
import { parseDate } from '../utils/dateUtils';

interface UseICTProvidersOptions {
    realtime?: boolean;
    filters?: ICTProviderFilters;
}

interface UseICTProvidersReturn {
    // Data
    providers: ICTProvider[];
    loading: boolean;
    error: Error | null;

    // Stats
    stats: {
        total: number;
        critical: number;
        important: number;
        standard: number;
        expiringSoon: number;
        nonCompliant: number;
    };

    // Story 35-2: Risk Stats
    riskStats: {
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        reassessmentsDueCount: number;
    };

    // Concentration Analysis
    concentrationAnalysis: ConcentrationAnalysis;

    // Actions
    createProvider: (data: ICTProviderFormData) => Promise<string>;
    updateProvider: (id: string, data: Partial<ICTProviderFormData>) => Promise<void>;
    deleteProvider: (id: string) => Promise<void>;
    refresh: () => Promise<void>;

    // Utilities
    getProviderById: (id: string) => ICTProvider | undefined;
    getProvidersByCategory: (category: ICTCriticality) => ICTProvider[];
    getExpiringContracts: (daysAhead?: number) => ICTProvider[];

    // Story 35-2: Risk Utilities
    getHighRiskProviders: () => ICTProvider[];
    getReassessmentsDue: (days?: number) => ICTProvider[];
}

export const useICTProviders = (
    options: UseICTProvidersOptions = {}
): UseICTProvidersReturn => {
    const { realtime = true, filters } = options;
    const { organization } = useStore();
    const { user } = useAuth();

    // Build query constraints
    const constraints = useMemo(() => {
        const result: QueryConstraint[] = [];

        if (organization?.id) {
            result.push(where('organizationId', '==', organization.id));
        }

        if (filters?.category) {
            result.push(where('category', '==', filters.category));
        }

        if (filters?.status) {
            result.push(where('status', '==', filters.status));
        }

        result.push(orderBy('name'));

        return result;
    }, [organization?.id, filters?.category, filters?.status]);

    // Use Firestore collection hook
    const {
        data: rawProviders,
        loading,
        error,
        refresh
    } = useFirestoreCollection<ICTProvider>(
        'ict_providers',
        constraints,
        {
            realtime,
            enabled: !!organization?.id
        }
    );

    // Apply client-side filters
    const providers = useMemo(() => {
        let result = rawProviders;

        // Search term filter
        if (filters?.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.description?.toLowerCase().includes(term) ||
                p.services?.some(s => s.name.toLowerCase().includes(term))
            );
        }

        // DORA compliance filter
        if (filters?.doraCompliant !== undefined) {
            result = result.filter(p => p.compliance?.doraCompliant === filters.doraCompliant);
        }

        // Expiring contracts filter
        if (filters?.contractExpiringSoon) {
            const ninetyDays = new Date();
            ninetyDays.setDate(ninetyDays.getDate() + 90);
            const now = new Date();

            result = result.filter(p => {
                const endDate = parseDate(p.contractInfo?.endDate);
                return endDate && endDate > now && endDate <= ninetyDays;
            });
        }

        return result;
    }, [rawProviders, filters?.searchTerm, filters?.doraCompliant, filters?.contractExpiringSoon]);

    // Calculate stats
    const stats = useMemo(() => {
        const ninetyDays = new Date();
        ninetyDays.setDate(ninetyDays.getDate() + 90);
        const now = new Date();

        return {
            total: providers.length,
            critical: providers.filter(p => p.category === 'critical').length,
            important: providers.filter(p => p.category === 'important').length,
            standard: providers.filter(p => p.category === 'standard').length,
            expiringSoon: providers.filter(p => {
                const endDate = parseDate(p.contractInfo?.endDate);
                return endDate && endDate > now && endDate <= ninetyDays;
            }).length,
            nonCompliant: providers.filter(p => !p.compliance?.doraCompliant).length
        };
    }, [providers]);

    // Calculate concentration analysis
    const concentrationAnalysis = useMemo(() => {
        return ICTProviderService.calculateConcentrationAnalysis(providers);
    }, [providers]);

    // Story 35-2: Calculate risk stats
    const riskStats = useMemo(() => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        let highRisk = 0;
        let mediumRisk = 0;
        let lowRisk = 0;
        let reassessmentsDue = 0;

        providers.forEach(p => {
            const overallRisk = ICTProviderService.calculateOverallRisk(p);
            if (overallRisk > 70) highRisk++;
            else if (overallRisk > 40) mediumRisk++;
            else lowRisk++;

            const lastAssessment = parseDate(p.riskAssessment?.lastAssessment);
            if (!lastAssessment || lastAssessment < oneYearAgo) reassessmentsDue++;
        });

        return {
            highRiskCount: highRisk,
            mediumRiskCount: mediumRisk,
            lowRiskCount: lowRisk,
            reassessmentsDueCount: reassessmentsDue
        };
    }, [providers]);

    // Create provider
    const createProvider = useCallback(async (data: ICTProviderFormData): Promise<string> => {
        if (!organization?.id || !user?.uid) {
            throw new Error('Organization or user not found');
        }
        return ICTProviderService.create(organization.id, data, user.uid);
    }, [organization?.id, user?.uid]);

    // Update provider
    const updateProvider = useCallback(async (id: string, data: Partial<ICTProviderFormData>): Promise<void> => {
        if (!user?.uid) {
            throw new Error('User not found');
        }
        return ICTProviderService.update(id, data, user.uid);
    }, [user?.uid]);

    // Delete provider
    const deleteProvider = useCallback(async (id: string): Promise<void> => {
        if (!organization?.id) throw new Error('Organization not found');
        return ICTProviderService.delete(id, organization.id);
    }, [organization?.id]);

    // Get provider by ID
    const getProviderById = useCallback((id: string): ICTProvider | undefined => {
        return providers.find(p => p.id === id);
    }, [providers]);

    // Get providers by category
    const getProvidersByCategory = useCallback((category: ICTCriticality): ICTProvider[] => {
        return providers.filter(p => p.category === category);
    }, [providers]);

    // Get expiring contracts
    const getExpiringContracts = useCallback((daysAhead: number = 90): ICTProvider[] => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        const now = new Date();

        return providers.filter(p => {
            const endDate = parseDate(p.contractInfo?.endDate);
            return endDate && endDate > now && endDate <= futureDate;
        }).sort((a, b) => {
            const dateA = parseDate(a.contractInfo?.endDate)?.getTime() || 0;
            const dateB = parseDate(b.contractInfo?.endDate)?.getTime() || 0;
            return dateA - dateB;
        });
    }, [providers]);

    // Story 35-2: Get high risk providers
    const getHighRiskProviders = useCallback((): ICTProvider[] => {
        return providers.filter(p => {
            const overallRisk = ICTProviderService.calculateOverallRisk(p);
            return overallRisk > 70;
        });
    }, [providers]);

    // Story 35-2: Get providers with reassessment due
    const getReassessmentsDue = useCallback((days: number = 365): ICTProvider[] => {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - days);

        return providers.filter(p => {
            const lastAssessment = parseDate(p.riskAssessment?.lastAssessment);
            return !lastAssessment || lastAssessment < thresholdDate;
        });
    }, [providers]);

    return {
        providers,
        loading,
        error,
        stats,
        riskStats,
        concentrationAnalysis,
        createProvider,
        updateProvider,
        deleteProvider,
        refresh,
        getProviderById,
        getProvidersByCategory,
        getExpiringContracts,
        getHighRiskProviders,
        getReassessmentsDue
    };
};

/**
 * Hook for a single ICT Provider
 */
export const useICTProvider = (providerId: string | undefined) => {
    const { organization } = useStore();
    const { user } = useAuth();

    // Extract IDs for stable memoization
    const organizationId = organization?.id;
    const userId = user?.uid;

    const constraints = useMemo(() => {
        if (!organizationId || !providerId) return [];
        return [
            where('organizationId', '==', organizationId)
        ];
    }, [organizationId, providerId]);

    const { data, loading, error, refresh } = useFirestoreCollection<ICTProvider>(
        'ict_providers',
        constraints,
        { realtime: true, enabled: !!providerId && !!organizationId }
    );

    const provider = useMemo(() => {
        return data.find(p => p.id === providerId) || null;
    }, [data, providerId]);

    const updateProvider = useCallback(async (updates: Partial<ICTProviderFormData>) => {
        if (!providerId || !userId) {
            throw new Error('Provider ID or user not found');
        }
        return ICTProviderService.update(providerId, updates, userId);
    }, [providerId, userId]);

    return {
        provider,
        loading,
        error,
        refresh,
        updateProvider
    };
};
