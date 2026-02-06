/**
 * CMDB Zustand Store
 *
 * State management for CMDB module.
 * Uses fine-grained selectors to prevent over-subscription.
 *
 * @module stores/cmdbStore
 */

import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import {
  ConfigurationItem,
  CMDBRelationship,
  CMDBFilters,
  CMDBValidationItem,
  DiscoveryStats,
  ImpactAssessment,
  ImpactScenario,
  CIClass,
  CIStatus,
  CIEnvironment,
  CICriticality,
} from '@/types/cmdb';

// =============================================================================
// STATE INTERFACE
// =============================================================================

interface CMDBState {
  // Selected CI
  selectedCIId: string | null;
  selectedCI: ConfigurationItem | null;

  // CI List
  cis: ConfigurationItem[];
  cisLoading: boolean;
  cisError: string | null;

  // Filters
  filters: CMDBFilters;

  // Discovery
  pendingValidation: CMDBValidationItem[];
  pendingValidationLoading: boolean;
  discoveryStats: DiscoveryStats | null;

  // Relationships
  selectedCIRelationships: CMDBRelationship[];
  relationshipsLoading: boolean;

  // Impact Analysis
  impactAnalysis: {
    isCalculating: boolean;
    result: ImpactAssessment | null;
    scenario: ImpactScenario;
    depth: number;
    error: string | null;
  };

  // UI State
  inspectorOpen: boolean;
  createRelationshipModalOpen: boolean;
  impactAnalysisModalOpen: boolean;

  // Actions
  selectCI: (id: string | null) => void;
  setSelectedCI: (ci: ConfigurationItem | null) => void;
  setCIs: (cis: ConfigurationItem[]) => void;
  setCIsLoading: (loading: boolean) => void;
  setCIsError: (error: string | null) => void;

  // Filter actions
  setFilter: <K extends keyof CMDBFilters>(key: K, value: CMDBFilters[K]) => void;
  setFilters: (filters: Partial<CMDBFilters>) => void;
  resetFilters: () => void;

  // Discovery actions
  setPendingValidation: (items: CMDBValidationItem[]) => void;
  setPendingValidationLoading: (loading: boolean) => void;
  removePendingValidation: (id: string) => void;
  setDiscoveryStats: (stats: DiscoveryStats | null) => void;

  // Relationship actions
  setSelectedCIRelationships: (relationships: CMDBRelationship[]) => void;
  setRelationshipsLoading: (loading: boolean) => void;

  // Impact actions
  setImpactCalculating: (calculating: boolean) => void;
  setImpactResult: (result: ImpactAssessment | null) => void;
  setImpactScenario: (scenario: ImpactScenario) => void;
  setImpactDepth: (depth: number) => void;
  setImpactError: (error: string | null) => void;
  clearImpact: () => void;

  // UI actions
  openInspector: (ciId?: string) => void;
  closeInspector: () => void;
  openCreateRelationshipModal: () => void;
  closeCreateRelationshipModal: () => void;
  openImpactAnalysisModal: () => void;
  closeImpactAnalysisModal: () => void;

  // Reset
  reset: () => void;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const defaultFilters: CMDBFilters = {
  ciClass: null,
  status: null,
  environment: null,
  criticality: null,
  ownerId: null,
  discoverySource: null,
  search: '',
  lowQuality: false,
  stale: false,
};

const defaultImpactAnalysis = {
  isCalculating: false,
  result: null,
  scenario: 'down' as ImpactScenario,
  depth: 3,
  error: null,
};

// =============================================================================
// STORE CREATION
// =============================================================================

export const useCMDBStore = create<CMDBState>((set, get) => ({
  // Initial state
  selectedCIId: null,
  selectedCI: null,
  cis: [],
  cisLoading: false,
  cisError: null,
  filters: defaultFilters,
  pendingValidation: [],
  pendingValidationLoading: false,
  discoveryStats: null,
  selectedCIRelationships: [],
  relationshipsLoading: false,
  impactAnalysis: defaultImpactAnalysis,
  inspectorOpen: false,
  createRelationshipModalOpen: false,
  impactAnalysisModalOpen: false,

  // CI Selection
  selectCI: (id) => set({ selectedCIId: id, selectedCI: null }),

  setSelectedCI: (ci) => set({ selectedCI: ci, selectedCIId: ci?.id || null }),

  // CI List
  setCIs: (cis) => set({ cis }),
  setCIsLoading: (loading) => set({ cisLoading: loading }),
  setCIsError: (error) => set({ cisError: error }),

  // Filters
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  resetFilters: () => set({ filters: defaultFilters }),

  // Discovery
  setPendingValidation: (items) => set({ pendingValidation: items }),
  setPendingValidationLoading: (loading) => set({ pendingValidationLoading: loading }),

  removePendingValidation: (id) =>
    set((state) => ({
      pendingValidation: state.pendingValidation.filter((item) => item.id !== id),
    })),

  setDiscoveryStats: (stats) => set({ discoveryStats: stats }),

  // Relationships
  setSelectedCIRelationships: (relationships) => set({ selectedCIRelationships: relationships }),
  setRelationshipsLoading: (loading) => set({ relationshipsLoading: loading }),

  // Impact Analysis
  setImpactCalculating: (calculating) =>
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, isCalculating: calculating },
    })),

  setImpactResult: (result) =>
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, result, error: null },
    })),

  setImpactScenario: (scenario) =>
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, scenario },
    })),

  setImpactDepth: (depth) =>
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, depth },
    })),

  setImpactError: (error) =>
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, error, isCalculating: false },
    })),

  clearImpact: () =>
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, result: null, error: null },
    })),

  // UI
  openInspector: (ciId) =>
    set({
      inspectorOpen: true,
      selectedCIId: ciId || null,
    }),

  closeInspector: () =>
    set({
      inspectorOpen: false,
      selectedCIId: null,
      selectedCI: null,
      selectedCIRelationships: [],
    }),

  openCreateRelationshipModal: () => set({ createRelationshipModalOpen: true }),
  closeCreateRelationshipModal: () => set({ createRelationshipModalOpen: false }),

  openImpactAnalysisModal: () => set({ impactAnalysisModalOpen: true }),
  closeImpactAnalysisModal: () =>
    set({
      impactAnalysisModalOpen: false,
      impactAnalysis: defaultImpactAnalysis,
    }),

  // Reset
  reset: () =>
    set({
      selectedCIId: null,
      selectedCI: null,
      cis: [],
      cisLoading: false,
      cisError: null,
      filters: defaultFilters,
      pendingValidation: [],
      pendingValidationLoading: false,
      discoveryStats: null,
      selectedCIRelationships: [],
      relationshipsLoading: false,
      impactAnalysis: defaultImpactAnalysis,
      inspectorOpen: false,
      createRelationshipModalOpen: false,
      impactAnalysisModalOpen: false,
    }),
}));

// =============================================================================
// SELECTORS (Fine-grained to prevent over-subscription)
// =============================================================================

// CI Selection
export const useSelectedCIId = () => useCMDBStore((s) => s.selectedCIId);
export const useSelectedCI = () => useCMDBStore((s) => s.selectedCI);

// CI List
export const useCIs = () => useCMDBStore((s) => s.cis);
export const useCIsLoading = () => useCMDBStore((s) => s.cisLoading);
export const useCIsError = () => useCMDBStore((s) => s.cisError);

// Filters
export const useCMDBFilters = () => useCMDBStore((s) => s.filters, shallow);
export const useCMDBFilterValue = <K extends keyof CMDBFilters>(key: K) =>
  useCMDBStore((s) => s.filters[key]);

// Discovery
export const usePendingValidation = () => useCMDBStore((s) => s.pendingValidation);
export const usePendingValidationLoading = () => useCMDBStore((s) => s.pendingValidationLoading);
export const usePendingValidationCount = () => useCMDBStore((s) => s.pendingValidation.length);
export const useDiscoveryStats = () => useCMDBStore((s) => s.discoveryStats);

// Relationships
export const useSelectedCIRelationships = () => useCMDBStore((s) => s.selectedCIRelationships);
export const useRelationshipsLoading = () => useCMDBStore((s) => s.relationshipsLoading);

// Impact Analysis
export const useImpactAnalysis = () => useCMDBStore((s) => s.impactAnalysis, shallow);
export const useImpactResult = () => useCMDBStore((s) => s.impactAnalysis.result);
export const useImpactCalculating = () => useCMDBStore((s) => s.impactAnalysis.isCalculating);

// UI State
export const useInspectorOpen = () => useCMDBStore((s) => s.inspectorOpen);
export const useCreateRelationshipModalOpen = () =>
  useCMDBStore((s) => s.createRelationshipModalOpen);
export const useImpactAnalysisModalOpen = () => useCMDBStore((s) => s.impactAnalysisModalOpen);

// Actions (stable references)
export const useCMDBActions = () =>
  useCMDBStore(
    (s) => ({
      selectCI: s.selectCI,
      setSelectedCI: s.setSelectedCI,
      setFilter: s.setFilter,
      resetFilters: s.resetFilters,
      openInspector: s.openInspector,
      closeInspector: s.closeInspector,
      openCreateRelationshipModal: s.openCreateRelationshipModal,
      closeCreateRelationshipModal: s.closeCreateRelationshipModal,
      openImpactAnalysisModal: s.openImpactAnalysisModal,
      closeImpactAnalysisModal: s.closeImpactAnalysisModal,
      clearImpact: s.clearImpact,
      removePendingValidation: s.removePendingValidation,
    }),
    shallow
  );

// Computed selectors
export const useActiveCICount = () =>
  useCMDBStore((s) => s.cis.filter((ci) => ci.status === 'In_Use').length);

export const useLowQualityCICount = () =>
  useCMDBStore((s) => s.cis.filter((ci) => ci.dataQualityScore < 50).length);
