/**
 * Epic 30: Story 30.2 & 30.5 - Blast Radius Hook
 *
 * React hook for blast radius simulation and What-If analysis:
 * - Wraps BlastRadiusService for React integration
 * - State management for simulation
 * - Memoized calculations for performance
 * - Integration with voxelStore
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVoxelStore } from '@/stores/voxelStore';
import {
 BlastRadiusService,
 BlastRadiusAnalysis,
 RootCauseResult,
 WhatIfScenario,
 WhatIfComparison,
 ExtendedBlastRadiusConfig,
 AffectedNode,
 PotentialCause,
} from '@/services/blastRadiusService';
import type { VoxelNodeType } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export type SimulationMode = 'blast-radius' | 'root-cause' | 'what-if';

export interface BlastRadiusState {
 /** Current source/incident node ID */
 sourceNodeId: string | null;
 /** Current simulation mode */
 mode: SimulationMode;
 /** Whether simulation is running */
 isSimulating: boolean;
 /** Current blast radius results */
 blastRadiusResult: BlastRadiusAnalysis | null;
 /** Current root cause results */
 rootCauseResult: RootCauseResult | null;
 /** What-If comparison results */
 whatIfResult: WhatIfComparison | null;
 /** Current What-If scenario */
 whatIfScenario: WhatIfScenario | null;
 /** Configuration */
 config: ExtendedBlastRadiusConfig;
 /** Simulation history for undo */
 history: BlastRadiusAnalysis[];
 /** Error state */
 error: string | null;
}

export interface BlastRadiusActions {
 /** Start blast radius simulation from a node */
 startSimulation: (nodeId: string) => void;
 /** Stop current simulation */
 stopSimulation: () => void;
 /** Start root cause analysis from an incident node */
 startRootCauseAnalysis: (incidentNodeId: string) => void;
 /** Set simulation configuration */
 setConfig: (config: Partial<ExtendedBlastRadiusConfig>) => void;
 /** Reset configuration to defaults */
 resetConfig: () => void;
 /** Set What-If scenario and calculate comparison */
 applyWhatIfScenario: (scenario: WhatIfScenario) => void;
 /** Clear What-If scenario */
 clearWhatIfScenario: () => void;
 /** Focus on a specific affected node */
 focusNode: (nodeId: string) => void;
 /** Clear all results */
 clearResults: () => void;
 /** Set simulation mode */
 setMode: (mode: SimulationMode) => void;
}

export interface UseBlastRadiusReturn extends BlastRadiusState, BlastRadiusActions {
 /** Affected node IDs for highlighting */
 affectedNodeIds: Set<string>;
 /** Impact paths for visualization */
 impactPaths: string[][];
 /** Stats summary */
 stats: {
 totalAffected: number;
 totalImpact: number;
 maxDepth: number;
 criticalCount: number;
 highCount: number;
 mediumCount: number;
 lowCount: number;
 byType: Record<VoxelNodeType, number>;
 };
 /** Root cause node IDs with likelihood */
 rootCauseNodeIds: Map<string, number>;
 /** Get affected node by ID */
 getAffectedNode: (nodeId: string) => AffectedNode | undefined;
 /** Get potential cause by ID */
 getPotentialCause: (nodeId: string) => PotentialCause | undefined;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ExtendedBlastRadiusConfig = {
 startNodeId: '',
 maxDepth: 4,
 minProbability: 0.1,
 decayRate: 0.25,
 bidirectional: false,
 edgeTypes: undefined,
 includeNodeTypes: undefined,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for blast radius simulation and root cause analysis
 */
export function useBlastRadius(): UseBlastRadiusReturn {
 // Voxel store state
 const nodes = useVoxelStore((s) => s.nodes);
 const edges = useVoxelStore((s) => s.edges);
 const selectNode = useVoxelStore((s) => s.selectNode);
 const setCameraTarget = useVoxelStore((s) => s.setCameraTarget);

 // Local state
 const [state, setState] = useState<BlastRadiusState>({
 sourceNodeId: null,
 mode: 'blast-radius',
 isSimulating: false,
 blastRadiusResult: null,
 rootCauseResult: null,
 whatIfResult: null,
 whatIfScenario: null,
 config: DEFAULT_CONFIG,
 history: [],
 error: null,
 });

 // Refs for performance
 const simulationIdRef = useRef<number>(0);

 // ============================================================================
 // Memoized Calculations
 // ============================================================================

 /**
 * Set of affected node IDs for quick lookup
 */
 const affectedNodeIds = useMemo<Set<string>>(() => {
 if (!state.blastRadiusResult) return new Set();
 return new Set(state.blastRadiusResult.affectedNodes.map((n) => n.nodeId));
 }, [state.blastRadiusResult]);

 /**
 * Impact paths for visualization
 */
 const impactPaths = useMemo<string[][]>(() => {
 if (!state.blastRadiusResult) return [];
 return state.blastRadiusResult.paths;
 }, [state.blastRadiusResult]);

 /**
 * Statistics summary
 */
 const stats = useMemo(() => {
 const result = state.blastRadiusResult;
 if (!result) {
 return {
 totalAffected: 0,
 totalImpact: 0,
 maxDepth: 0,
 criticalCount: 0,
 highCount: 0,
 mediumCount: 0,
 lowCount: 0,
 byType: {
 asset: 0,
 risk: 0,
 control: 0,
 incident: 0,
 supplier: 0,
 project: 0,
 audit: 0,
 } as Record<VoxelNodeType, number>,
 };
 }

 const byType: Record<VoxelNodeType, number> = {
 asset: 0,
 risk: 0,
 control: 0,
 incident: 0,
 supplier: 0,
 project: 0,
 audit: 0,
 };

 let criticalCount = 0;
 let highCount = 0;
 let mediumCount = 0;
 let lowCount = 0;

 result.affectedNodes.forEach((node) => {
 byType[node.node.type]++;

 // Count by impact level
 if (node.impact >= 0.75) criticalCount++;
 else if (node.impact >= 0.5) highCount++;
 else if (node.impact >= 0.25) mediumCount++;
 else lowCount++;
 });

 return {
 totalAffected: result.affectedNodes.length,
 totalImpact: result.totalImpact,
 maxDepth: result.maxDepth,
 criticalCount,
 highCount,
 mediumCount,
 lowCount,
 byType,
 };
 }, [state.blastRadiusResult]);

 /**
 * Root cause node IDs with likelihood
 */
 const rootCauseNodeIds = useMemo<Map<string, number>>(() => {
 if (!state.rootCauseResult) return new Map();
 const map = new Map<string, number>();
 state.rootCauseResult.potentialCauses.forEach((cause) => {
 map.set(cause.nodeId, cause.likelihood);
 });
 return map;
 }, [state.rootCauseResult]);

 // ============================================================================
 // Actions
 // ============================================================================

 /**
 * Start blast radius simulation
 */
 const startSimulation = useCallback(
 (nodeId: string) => {
 if (!nodes.has(nodeId)) {
 setState((prev) => ({ ...prev, error: `Node ${nodeId} not found` }));
 return;
 }

 const currentSimId = ++simulationIdRef.current;

 setState((prev) => ({
 ...prev,
 sourceNodeId: nodeId,
 mode: 'blast-radius',
 isSimulating: true,
 error: null,
 }));

 // Run simulation (could be deferred for large graphs)
 requestAnimationFrame(() => {
 if (simulationIdRef.current !== currentSimId) return;

 try {
 const result = BlastRadiusService.calculateBlastRadius(
 nodeId,
 nodes,
 edges,
 { ...state.config, startNodeId: nodeId }
 );

 setState((prev) => {
 if (simulationIdRef.current !== currentSimId) return prev;
 return {
 ...prev,
 blastRadiusResult: result,
 isSimulating: false,
 history: prev.blastRadiusResult
 ? [...prev.history.slice(-9), prev.blastRadiusResult]
 : prev.history,
 };
 });
 } catch (err) {
 setState((prev) => ({
 ...prev,
 isSimulating: false,
 error: err instanceof Error ? err.message : 'Simulation failed',
 }));
 }
 });
 },
 [nodes, edges, state.config]
 );

 /**
 * Stop current simulation
 */
 const stopSimulation = useCallback(() => {
 simulationIdRef.current++;
 setState((prev) => ({
 ...prev,
 isSimulating: false,
 }));
 }, []);

 /**
 * Start root cause analysis
 */
 const startRootCauseAnalysis = useCallback(
 (incidentNodeId: string) => {
 if (!nodes.has(incidentNodeId)) {
 setState((prev) => ({ ...prev, error: `Node ${incidentNodeId} not found` }));
 return;
 }

 const currentSimId = ++simulationIdRef.current;

 setState((prev) => ({
 ...prev,
 sourceNodeId: incidentNodeId,
 mode: 'root-cause',
 isSimulating: true,
 error: null,
 }));

 requestAnimationFrame(() => {
 if (simulationIdRef.current !== currentSimId) return;

 try {
 const result = BlastRadiusService.analyzeRootCauses(
 incidentNodeId,
 nodes,
 edges,
 state.config
 );

 setState((prev) => {
 if (simulationIdRef.current !== currentSimId) return prev;
 return {
 ...prev,
 rootCauseResult: result,
 isSimulating: false,
 };
 });
 } catch (err) {
 setState((prev) => ({
 ...prev,
 isSimulating: false,
 error: err instanceof Error ? err.message : 'Root cause analysis failed',
 }));
 }
 });
 },
 [nodes, edges, state.config]
 );

 /**
 * Set configuration
 */
 const setConfig = useCallback((config: Partial<ExtendedBlastRadiusConfig>) => {
 setState((prev) => ({
 ...prev,
 config: { ...prev.config, ...config },
 }));
 }, []);

 /**
 * Reset configuration
 */
 const resetConfig = useCallback(() => {
 setState((prev) => ({
 ...prev,
 config: DEFAULT_CONFIG,
 }));
 }, []);

 /**
 * Apply What-If scenario
 */
 const applyWhatIfScenario = useCallback(
 (scenario: WhatIfScenario) => {
 if (!state.sourceNodeId) {
 setState((prev) => ({ ...prev, error: 'No source node selected' }));
 return;
 }

 const currentSimId = ++simulationIdRef.current;

 setState((prev) => ({
 ...prev,
 mode: 'what-if',
 whatIfScenario: scenario,
 isSimulating: true,
 error: null,
 }));

 requestAnimationFrame(() => {
 if (simulationIdRef.current !== currentSimId) return;

 try {
 const result = BlastRadiusService.applyWhatIfScenario(
 state.sourceNodeId!,
 nodes,
 edges,
 { ...state.config, startNodeId: state.sourceNodeId! },
 scenario
 );

 setState((prev) => {
 if (simulationIdRef.current !== currentSimId) return prev;
 return {
 ...prev,
 whatIfResult: result,
 blastRadiusResult: result.scenario,
 isSimulating: false,
 };
 });
 } catch (err) {
 setState((prev) => ({
 ...prev,
 isSimulating: false,
 error: err instanceof Error ? err.message : 'What-If analysis failed',
 }));
 }
 });
 },
 [state.sourceNodeId, state.config, nodes, edges]
 );

 /**
 * Clear What-If scenario
 */
 const clearWhatIfScenario = useCallback(() => {
 setState((prev) => ({
 ...prev,
 mode: 'blast-radius',
 whatIfScenario: null,
 whatIfResult: null,
 blastRadiusResult: prev.whatIfResult?.baseline || prev.blastRadiusResult,
 }));
 }, []);

 /**
 * Focus on a node in 3D view
 */
 const focusNode = useCallback(
 (nodeId: string) => {
 const node = nodes.get(nodeId);
 if (node) {
 selectNode(nodeId);
 setCameraTarget(node.position);
 }
 },
 [nodes, selectNode, setCameraTarget]
 );

 /**
 * Clear all results
 */
 const clearResults = useCallback(() => {
 simulationIdRef.current++;
 setState({
 sourceNodeId: null,
 mode: 'blast-radius',
 isSimulating: false,
 blastRadiusResult: null,
 rootCauseResult: null,
 whatIfResult: null,
 whatIfScenario: null,
 config: state.config,
 history: [],
 error: null,
 });
 }, [state.config]);

 /**
 * Set simulation mode
 */
 const setMode = useCallback((mode: SimulationMode) => {
 setState((prev) => ({ ...prev, mode }));
 }, []);

 /**
 * Get affected node by ID
 */
 const getAffectedNode = useCallback(
 (nodeId: string): AffectedNode | undefined => {
 return state.blastRadiusResult?.affectedNodes.find((n) => n.nodeId === nodeId);
 },
 [state.blastRadiusResult]
 );

 /**
 * Get potential cause by ID
 */
 const getPotentialCause = useCallback(
 (nodeId: string): PotentialCause | undefined => {
 return state.rootCauseResult?.potentialCauses.find((c) => c.nodeId === nodeId);
 },
 [state.rootCauseResult]
 );

 // ============================================================================
 // Re-run simulation when config changes (if simulating)
 // ============================================================================

 useEffect(() => {
 if (state.sourceNodeId && state.blastRadiusResult) {
 // Debounce config changes
 const timer = setTimeout(() => {
 if (state.mode === 'blast-radius') {
 startSimulation(state.sourceNodeId!);
 } else if (state.mode === 'root-cause') {
 startRootCauseAnalysis(state.sourceNodeId!);
 }
 }, 100);
 return () => clearTimeout(timer);
 }
 }, [state.config, startSimulation, startRootCauseAnalysis, state.sourceNodeId, state.mode, state.blastRadiusResult]); // Only re-run when config changes

 // ============================================================================
 // Return
 // ============================================================================

 return {
 // State
 ...state,
 // Computed
 affectedNodeIds,
 impactPaths,
 stats,
 rootCauseNodeIds,
 // Actions
 startSimulation,
 stopSimulation,
 startRootCauseAnalysis,
 setConfig,
 resetConfig,
 applyWhatIfScenario,
 clearWhatIfScenario,
 focusNode,
 clearResults,
 setMode,
 getAffectedNode,
 getPotentialCause,
 };
}

export default useBlastRadius;
