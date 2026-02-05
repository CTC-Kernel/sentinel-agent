/**
 * Training Store
 *
 * Zustand store for the Training & Awareness module (NIS2 Art. 21.2g).
 * Manages local state for courses, assignments, campaigns, and statistics.
 *
 * Design principles:
 * - Fine-grained selectors to minimize re-renders
 * - DevTools integration for debugging
 * - Clear separation between state and actions
 * - Type-safe with full TypeScript support
 *
 * @module trainingStore
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
 TrainingCourse,
 TrainingAssignment,
 TrainingCampaign,
 TrainingStats,
 AssignmentStatus,
 CampaignStatus,
 TrainingCategory,
} from '../types/training';

// ============================================================================
// Types
// ============================================================================

/**
 * Training filter state
 */
export interface TrainingFilters {
 category: TrainingCategory | 'all';
 source: string | 'all';
 searchQuery: string;
 showRequiredOnly: boolean;
}

/**
 * Assignment filter state
 */
export interface AssignmentFilters {
 status: AssignmentStatus | 'all';
 courseId: string | 'all';
 searchQuery: string;
}

/**
 * Campaign filter state
 */
export interface CampaignFilters {
 status: CampaignStatus | 'all';
 searchQuery: string;
}

/**
 * UI state for training module
 */
export interface TrainingUIState {
 selectedCourseId: string | null;
 selectedAssignmentId: string | null;
 selectedCampaignId: string | null;
 isLoading: boolean;
 error: string | null;
}

/**
 * Complete training store state
 */
export interface TrainingState {
 // Data
 courses: TrainingCourse[];
 assignments: TrainingAssignment[];
 campaigns: TrainingCampaign[];
 stats: TrainingStats | null;

 // Filters
 courseFilters: TrainingFilters;
 assignmentFilters: AssignmentFilters;
 campaignFilters: CampaignFilters;

 // UI State
 ui: TrainingUIState;
}

/**
 * Training store actions
 */
export interface TrainingActions {
 // Course actions
 setCourses: (courses: TrainingCourse[]) => void;
 addCourse: (course: TrainingCourse) => void;
 updateCourse: (courseId: string, updates: Partial<TrainingCourse>) => void;
 removeCourse: (courseId: string) => void;

 // Assignment actions
 setAssignments: (assignments: TrainingAssignment[]) => void;
 addAssignment: (assignment: TrainingAssignment) => void;
 addAssignments: (assignments: TrainingAssignment[]) => void;
 updateAssignment: (assignmentId: string, updates: Partial<TrainingAssignment>) => void;
 removeAssignment: (assignmentId: string) => void;

 // Campaign actions
 setCampaigns: (campaigns: TrainingCampaign[]) => void;
 addCampaign: (campaign: TrainingCampaign) => void;
 updateCampaign: (campaignId: string, updates: Partial<TrainingCampaign>) => void;
 removeCampaign: (campaignId: string) => void;

 // Stats actions
 setStats: (stats: TrainingStats) => void;
 clearStats: () => void;

 // Filter actions
 setCourseFilters: (filters: Partial<TrainingFilters>) => void;
 setAssignmentFilters: (filters: Partial<AssignmentFilters>) => void;
 setCampaignFilters: (filters: Partial<CampaignFilters>) => void;
 resetFilters: () => void;

 // UI actions
 selectCourse: (courseId: string | null) => void;
 selectAssignment: (assignmentId: string | null) => void;
 selectCampaign: (campaignId: string | null) => void;
 setLoading: (loading: boolean) => void;
 setError: (error: string | null) => void;

 // Global actions
 reset: () => void;
}

export type TrainingStore = TrainingState & TrainingActions;

// ============================================================================
// Initial State
// ============================================================================

const initialCourseFilters: TrainingFilters = {
 category: 'all',
 source: 'all',
 searchQuery: '',
 showRequiredOnly: false,
};

const initialAssignmentFilters: AssignmentFilters = {
 status: 'all',
 courseId: 'all',
 searchQuery: '',
};

const initialCampaignFilters: CampaignFilters = {
 status: 'all',
 searchQuery: '',
};

const initialUI: TrainingUIState = {
 selectedCourseId: null,
 selectedAssignmentId: null,
 selectedCampaignId: null,
 isLoading: false,
 error: null,
};

const initialState: TrainingState = {
 courses: [],
 assignments: [],
 campaigns: [],
 stats: null,
 courseFilters: initialCourseFilters,
 assignmentFilters: initialAssignmentFilters,
 campaignFilters: initialCampaignFilters,
 ui: initialUI,
};

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Training store with devtools and subscribeWithSelector middleware.
 */
export const useTrainingStore = create<TrainingStore>()(
 devtools(
 subscribeWithSelector((set) => ({
 // Initial state
 ...initialState,

 // ========================================================================
 // Course Actions
 // ========================================================================

 setCourses: (courses) =>
 set({ courses }, false, 'setCourses'),

 addCourse: (course) =>
 set(
 (state) => ({ courses: [...state.courses, course] }),
 false,
 'addCourse'
 ),

 updateCourse: (courseId, updates) =>
 set(
 (state) => ({
 courses: state.courses.map((c) =>
 c.id === courseId ? { ...c, ...updates } : c
 ),
 }),
 false,
 'updateCourse'
 ),

 removeCourse: (courseId) =>
 set(
 (state) => ({
 courses: state.courses.filter((c) => c.id !== courseId),
 }),
 false,
 'removeCourse'
 ),

 // ========================================================================
 // Assignment Actions
 // ========================================================================

 setAssignments: (assignments) =>
 set({ assignments }, false, 'setAssignments'),

 addAssignment: (assignment) =>
 set(
 (state) => ({ assignments: [...state.assignments, assignment] }),
 false,
 'addAssignment'
 ),

 addAssignments: (newAssignments) =>
 set(
 (state) => ({ assignments: [...state.assignments, ...newAssignments] }),
 false,
 'addAssignments'
 ),

 updateAssignment: (assignmentId, updates) =>
 set(
 (state) => ({
 assignments: state.assignments.map((a) =>
 a.id === assignmentId ? { ...a, ...updates } : a
 ),
 }),
 false,
 'updateAssignment'
 ),

 removeAssignment: (assignmentId) =>
 set(
 (state) => ({
 assignments: state.assignments.filter((a) => a.id !== assignmentId),
 }),
 false,
 'removeAssignment'
 ),

 // ========================================================================
 // Campaign Actions
 // ========================================================================

 setCampaigns: (campaigns) =>
 set({ campaigns }, false, 'setCampaigns'),

 addCampaign: (campaign) =>
 set(
 (state) => ({ campaigns: [...state.campaigns, campaign] }),
 false,
 'addCampaign'
 ),

 updateCampaign: (campaignId, updates) =>
 set(
 (state) => ({
 campaigns: state.campaigns.map((c) =>
 c.id === campaignId ? { ...c, ...updates } : c
 ),
 }),
 false,
 'updateCampaign'
 ),

 removeCampaign: (campaignId) =>
 set(
 (state) => ({
 campaigns: state.campaigns.filter((c) => c.id !== campaignId),
 }),
 false,
 'removeCampaign'
 ),

 // ========================================================================
 // Stats Actions
 // ========================================================================

 setStats: (stats) =>
 set({ stats }, false, 'setStats'),

 clearStats: () =>
 set({ stats: null }, false, 'clearStats'),

 // ========================================================================
 // Filter Actions
 // ========================================================================

 setCourseFilters: (filters) =>
 set(
 (state) => ({
 courseFilters: { ...state.courseFilters, ...filters },
 }),
 false,
 'setCourseFilters'
 ),

 setAssignmentFilters: (filters) =>
 set(
 (state) => ({
 assignmentFilters: { ...state.assignmentFilters, ...filters },
 }),
 false,
 'setAssignmentFilters'
 ),

 setCampaignFilters: (filters) =>
 set(
 (state) => ({
 campaignFilters: { ...state.campaignFilters, ...filters },
 }),
 false,
 'setCampaignFilters'
 ),

 resetFilters: () =>
 set(
 {
 courseFilters: initialCourseFilters,
 assignmentFilters: initialAssignmentFilters,
 campaignFilters: initialCampaignFilters,
 },
 false,
 'resetFilters'
 ),

 // ========================================================================
 // UI Actions
 // ========================================================================

 selectCourse: (courseId) =>
 set(
 (state) => ({ ui: { ...state.ui, selectedCourseId: courseId } }),
 false,
 'selectCourse'
 ),

 selectAssignment: (assignmentId) =>
 set(
 (state) => ({ ui: { ...state.ui, selectedAssignmentId: assignmentId } }),
 false,
 'selectAssignment'
 ),

 selectCampaign: (campaignId) =>
 set(
 (state) => ({ ui: { ...state.ui, selectedCampaignId: campaignId } }),
 false,
 'selectCampaign'
 ),

 setLoading: (loading) =>
 set(
 (state) => ({ ui: { ...state.ui, isLoading: loading } }),
 false,
 'setLoading'
 ),

 setError: (error) =>
 set(
 (state) => ({ ui: { ...state.ui, error } }),
 false,
 'setError'
 ),

 // ========================================================================
 // Global Actions
 // ========================================================================

 reset: () =>
 set(initialState, false, 'reset'),
 })),
 { name: 'TrainingStore' }
 )
);

// ============================================================================
// Selectors - Fine-grained hooks to prevent unnecessary re-renders
// ============================================================================

/**
 * Select all courses.
 */
export const useCourses = (): TrainingCourse[] =>
 useTrainingStore((state) => state.courses);

/**
 * Select a single course by ID.
 */
export const useCourse = (courseId: string): TrainingCourse | undefined =>
 useTrainingStore((state) => state.courses.find((c) => c.id === courseId));

/**
 * Select courses filtered by current filters.
 */
export const useFilteredCourses = (): TrainingCourse[] =>
 useTrainingStore(
 useShallow((state) => {
 const { courses, courseFilters } = state;

 return courses.filter((course) => {
 // Category filter
 if (
 courseFilters.category !== 'all' &&
 course.category !== courseFilters.category
 ) {
 return false;
 }

 // Source filter
 if (
 courseFilters.source !== 'all' &&
 course.source !== courseFilters.source
 ) {
 return false;
 }

 // Required only filter
 if (courseFilters.showRequiredOnly && !course.isRequired) {
 return false;
 }

 // Search query filter
 if (courseFilters.searchQuery) {
 const query = courseFilters.searchQuery.toLowerCase();
 const matchesTitle = course.title.toLowerCase().includes(query);
 const matchesDescription = course.description.toLowerCase().includes(query);
 if (!matchesTitle && !matchesDescription) {
 return false;
 }
 }

 return true;
 });
 })
 );

/**
 * Select all assignments.
 */
export const useAssignments = (): TrainingAssignment[] =>
 useTrainingStore((state) => state.assignments);

/**
 * Select assignments for a specific user.
 */
export const useUserAssignments = (userId: string): TrainingAssignment[] =>
 useTrainingStore(
 useShallow((state) =>
 state.assignments.filter((a) => a.userId === userId)
 )
 );

/**
 * Select assignments filtered by current filters.
 */
export const useFilteredAssignments = (): TrainingAssignment[] =>
 useTrainingStore(
 useShallow((state) => {
 const { assignments, assignmentFilters } = state;

 return assignments.filter((assignment) => {
 // Status filter
 if (
 assignmentFilters.status !== 'all' &&
 assignment.status !== assignmentFilters.status
 ) {
 return false;
 }

 // Course filter
 if (
 assignmentFilters.courseId !== 'all' &&
 assignment.courseId !== assignmentFilters.courseId
 ) {
 return false;
 }

 return true;
 });
 })
 );

/**
 * Select overdue assignments.
 */
export const useOverdueAssignments = (): TrainingAssignment[] =>
 useTrainingStore(
 useShallow((state) =>
 state.assignments.filter((a) => a.status === 'overdue')
 )
 );

/**
 * Select all campaigns.
 */
export const useCampaigns = (): TrainingCampaign[] =>
 useTrainingStore((state) => state.campaigns);

/**
 * Select campaigns filtered by current filters.
 */
export const useFilteredCampaigns = (): TrainingCampaign[] =>
 useTrainingStore(
 useShallow((state) => {
 const { campaigns, campaignFilters } = state;

 return campaigns.filter((campaign) => {
 // Status filter
 if (
 campaignFilters.status !== 'all' &&
 campaign.status !== campaignFilters.status
 ) {
 return false;
 }

 // Search query filter
 if (campaignFilters.searchQuery) {
 const query = campaignFilters.searchQuery.toLowerCase();
 if (!campaign.name.toLowerCase().includes(query)) {
 return false;
 }
 }

 return true;
 });
 })
 );

/**
 * Select active campaigns.
 */
export const useActiveCampaigns = (): TrainingCampaign[] =>
 useTrainingStore(
 useShallow((state) =>
 state.campaigns.filter((c) => c.status === 'active')
 )
 );

/**
 * Select training stats.
 */
export const useTrainingStats = (): TrainingStats | null =>
 useTrainingStore((state) => state.stats);

/**
 * Select course filters.
 */
export const useCourseFilters = (): TrainingFilters =>
 useTrainingStore(useShallow((state) => state.courseFilters));

/**
 * Select assignment filters.
 */
export const useAssignmentFilters = (): AssignmentFilters =>
 useTrainingStore(useShallow((state) => state.assignmentFilters));

/**
 * Select campaign filters.
 */
export const useCampaignFilters = (): CampaignFilters =>
 useTrainingStore(useShallow((state) => state.campaignFilters));

/**
 * Select UI state.
 */
export const useTrainingUI = (): TrainingUIState =>
 useTrainingStore(useShallow((state) => state.ui));

/**
 * Select loading state.
 */
export const useTrainingLoading = (): boolean =>
 useTrainingStore((state) => state.ui.isLoading);

/**
 * Select error state.
 */
export const useTrainingError = (): string | null =>
 useTrainingStore((state) => state.ui.error);

/**
 * Select the currently selected course.
 */
export const useSelectedCourse = (): TrainingCourse | null =>
 useTrainingStore((state) => {
 const { selectedCourseId } = state.ui;
 if (!selectedCourseId) return null;
 return state.courses.find((c) => c.id === selectedCourseId) ?? null;
 });

/**
 * Select the currently selected assignment.
 */
export const useSelectedAssignment = (): TrainingAssignment | null =>
 useTrainingStore((state) => {
 const { selectedAssignmentId } = state.ui;
 if (!selectedAssignmentId) return null;
 return state.assignments.find((a) => a.id === selectedAssignmentId) ?? null;
 });

/**
 * Select the currently selected campaign.
 */
export const useSelectedCampaign = (): TrainingCampaign | null =>
 useTrainingStore((state) => {
 const { selectedCampaignId } = state.ui;
 if (!selectedCampaignId) return null;
 return state.campaigns.find((c) => c.id === selectedCampaignId) ?? null;
 });

// ============================================================================
// Store Actions (for non-hook usage)
// ============================================================================

/**
 * Direct access to store actions without hooks.
 * Useful for service layers, event handlers, and tests.
 */
export const trainingStoreActions = {
 // Course actions
 setCourses: useTrainingStore.getState().setCourses,
 addCourse: useTrainingStore.getState().addCourse,
 updateCourse: useTrainingStore.getState().updateCourse,
 removeCourse: useTrainingStore.getState().removeCourse,

 // Assignment actions
 setAssignments: useTrainingStore.getState().setAssignments,
 addAssignment: useTrainingStore.getState().addAssignment,
 addAssignments: useTrainingStore.getState().addAssignments,
 updateAssignment: useTrainingStore.getState().updateAssignment,
 removeAssignment: useTrainingStore.getState().removeAssignment,

 // Campaign actions
 setCampaigns: useTrainingStore.getState().setCampaigns,
 addCampaign: useTrainingStore.getState().addCampaign,
 updateCampaign: useTrainingStore.getState().updateCampaign,
 removeCampaign: useTrainingStore.getState().removeCampaign,

 // Stats actions
 setStats: useTrainingStore.getState().setStats,
 clearStats: useTrainingStore.getState().clearStats,

 // Filter actions
 setCourseFilters: useTrainingStore.getState().setCourseFilters,
 setAssignmentFilters: useTrainingStore.getState().setAssignmentFilters,
 setCampaignFilters: useTrainingStore.getState().setCampaignFilters,
 resetFilters: useTrainingStore.getState().resetFilters,

 // UI actions
 selectCourse: useTrainingStore.getState().selectCourse,
 selectAssignment: useTrainingStore.getState().selectAssignment,
 selectCampaign: useTrainingStore.getState().selectCampaign,
 setLoading: useTrainingStore.getState().setLoading,
 setError: useTrainingStore.getState().setError,

 // Global actions
 reset: useTrainingStore.getState().reset,
};
