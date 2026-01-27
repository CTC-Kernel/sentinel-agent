/**
 * Story 32.4 - useLayoutWorker Hook
 *
 * Hook to communicate with the layout Web Worker.
 * Manages force-directed layout calculations off the main thread.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoxelNode, VoxelEdge } from '@/types/voxel';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export interface LayoutWorkerConfig {
  /** Repulsion force between nodes */
  repulsion?: number;
  /** Attraction force along edges */
  attraction?: number;
  /** Gravity towards center */
  gravity?: number;
  /** Damping factor (0-1) */
  damping?: number;
  /** Minimum distance for force calculations */
  minDistance?: number;
  /** Maximum velocity */
  maxVelocity?: number;
  /** Time step for simulation */
  timeStep?: number;
  /** Use Barnes-Hut optimization for large graphs */
  useBarnesHut?: boolean;
  /** Barnes-Hut theta threshold */
  barnesHutTheta?: number;
  /** 3D layout (vs 2D) */
  is3D?: boolean;
  /** Center of gravity */
  center?: { x: number; y: number; z: number };
}

export interface WorkerNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
  fixed: boolean;
}

export interface WorkerEdge {
  source: string;
  target: string;
  weight: number;
}

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface LayoutStats {
  energy: number;
  nodeCount: number;
  edgeCount: number;
}

export interface UseLayoutWorkerOptions {
  /** Auto-start simulation when nodes change */
  autoStart?: boolean;
  /** Configuration for the layout algorithm */
  config?: LayoutWorkerConfig;
  /** Callback when positions are updated */
  onPositionUpdate?: (positions: PositionUpdate[]) => void;
  /** Callback when simulation converges */
  onConverged?: () => void;
  /** Callback for layout stats */
  onStats?: (stats: LayoutStats) => void;
}

export interface UseLayoutWorkerReturn {
  /** Whether the worker is initialized */
  isReady: boolean;
  /** Whether the simulation is running */
  isRunning: boolean;
  /** Start the simulation */
  start: () => void;
  /** Stop the simulation */
  stop: () => void;
  /** Run a single simulation step */
  step: () => void;
  /** Update nodes */
  updateNodes: (nodes: VoxelNode[]) => void;
  /** Update edges */
  updateEdges: (edges: VoxelEdge[]) => void;
  /** Update configuration */
  updateConfig: (config: Partial<LayoutWorkerConfig>) => void;
  /** Fix a node in place */
  fixNode: (nodeId: string) => void;
  /** Release a fixed node */
  releaseNode: (nodeId: string) => void;
  /** Current layout stats */
  stats: LayoutStats | null;
  /** Current positions map */
  positions: Map<string, { x: number; y: number; z: number }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: LayoutWorkerConfig = {
  repulsion: 1000,
  attraction: 0.01,
  gravity: 0.1,
  damping: 0.9,
  minDistance: 1,
  maxVelocity: 10,
  timeStep: 0.1,
  useBarnesHut: true,
  barnesHutTheta: 0.8,
  is3D: true,
  center: { x: 0, y: 0, z: 0 },
};

// ============================================================================
// Helper Functions
// ============================================================================

function voxelNodeToWorkerNode(node: VoxelNode): WorkerNode {
  const pos = node.position;
  return {
    id: node.id,
    x: typeof pos.x === 'number' ? pos.x : 0,
    y: typeof pos.y === 'number' ? pos.y : 0,
    z: typeof pos.z === 'number' ? pos.z : 0,
    vx: 0,
    vy: 0,
    vz: 0,
    mass: 1,
    fixed: false,
  };
}

function voxelEdgeToWorkerEdge(edge: VoxelEdge): WorkerEdge {
  return {
    source: edge.source,
    target: edge.target,
    weight: edge.weight || 1,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useLayoutWorker(
  nodes: VoxelNode[],
  edges: VoxelEdge[],
  options: UseLayoutWorkerOptions = {}
): UseLayoutWorkerReturn {
  const { autoStart = false, config = {}, onPositionUpdate, onConverged, onStats } = options;

  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<LayoutStats | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; z: number }>>(new Map());

  // Store callbacks in refs to avoid recreating worker on callback changes
  const callbacksRef = useRef({ onPositionUpdate, onConverged, onStats });
  useEffect(() => {
    callbacksRef.current = { onPositionUpdate, onConverged, onStats };
  }, [onPositionUpdate, onConverged, onStats]);

  // Initialize worker
  useEffect(() => {
    // Create worker from blob to avoid build configuration issues
    const workerCode = `
      // Web Worker for force-directed layout
      let nodes = [];
      let edges = [];
      let config = {
        repulsion: 1000,
        attraction: 0.01,
        gravity: 0.1,
        damping: 0.9,
        minDistance: 1,
        maxVelocity: 10,
        timeStep: 0.1,
        useBarnesHut: true,
        barnesHutTheta: 0.8,
        is3D: true,
        center: { x: 0, y: 0, z: 0 }
      };
      let running = false;
      let animationId = null;

      function calculateForces() {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        for (const node of nodes) {
          if (node.fixed) continue;

          let fx = 0, fy = 0, fz = 0;

          // Repulsion
          for (const other of nodes) {
            if (other.id === node.id) continue;
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const dz = other.z - node.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            const dist = Math.sqrt(distSq);
            if (dist < config.minDistance) continue;
            const force = -config.repulsion / distSq;
            fx += force * dx / dist;
            fy += force * dy / dist;
            fz += force * dz / dist;
          }

          // Attraction
          for (const edge of edges) {
            let other;
            if (edge.source === node.id) other = nodeMap.get(edge.target);
            else if (edge.target === node.id) other = nodeMap.get(edge.source);
            if (other) {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dz = other.z - node.z;
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (dist > config.minDistance) {
                const force = config.attraction * edge.weight * dist;
                fx += force * dx / dist;
                fy += force * dy / dist;
                fz += force * dz / dist;
              }
            }
          }

          // Gravity
          fx += config.gravity * (config.center.x - node.x);
          fy += config.gravity * (config.center.y - node.y);
          fz += config.gravity * (config.center.z - node.z);

          // Update velocity
          node.vx = (node.vx + fx * config.timeStep) * config.damping;
          node.vy = (node.vy + fy * config.timeStep) * config.damping;
          node.vz = (node.vz + fz * config.timeStep) * config.damping;

          // Clamp velocity
          const speed = Math.sqrt(node.vx*node.vx + node.vy*node.vy + node.vz*node.vz);
          if (speed > config.maxVelocity) {
            const scale = config.maxVelocity / speed;
            node.vx *= scale;
            node.vy *= scale;
            node.vz *= scale;
          }
        }
      }

      function updatePositions() {
        for (const node of nodes) {
          if (node.fixed) continue;
          node.x += node.vx * config.timeStep;
          node.y += node.vy * config.timeStep;
          if (config.is3D) node.z += node.vz * config.timeStep;
        }
      }

      function calculateEnergy() {
        let energy = 0;
        for (const node of nodes) {
          energy += 0.5 * (node.vx*node.vx + node.vy*node.vy + node.vz*node.vz);
        }
        return energy;
      }

      function step() {
        calculateForces();
        updatePositions();

        const positions = nodes.map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z }));
        self.postMessage({ type: 'positions', payload: positions });

        const energy = calculateEnergy();
        self.postMessage({ type: 'stats', payload: { energy, nodeCount: nodes.length, edgeCount: edges.length }});

        if (energy < 0.01) {
          self.postMessage({ type: 'converged', payload: { energy }});
          running = false;
          return;
        }

        if (running) {
          animationId = setTimeout(step, 16);
        }
      }

      self.onmessage = (e) => {
        const { type, payload } = e.data;

        switch(type) {
          case 'init':
            nodes = payload.nodes.map(n => ({ ...n, vx: 0, vy: 0, vz: 0 }));
            edges = payload.edges;
            config = { ...config, ...payload.config };
            break;
          case 'start':
            if (!running) { running = true; step(); }
            break;
          case 'stop':
            running = false;
            if (animationId) { clearTimeout(animationId); animationId = null; }
            break;
          case 'step':
            if (!running) step();
            break;
          case 'update-nodes':
            nodes = payload.map(n => ({ ...n, vx: n.vx || 0, vy: n.vy || 0, vz: n.vz || 0 }));
            break;
          case 'update-edges':
            edges = payload;
            break;
          case 'update-config':
            config = { ...config, ...payload };
            break;
          case 'fix-node':
            const fn = nodes.find(n => n.id === payload);
            if (fn) { fn.fixed = true; fn.vx = fn.vy = fn.vz = 0; }
            break;
          case 'release-node':
            const rn = nodes.find(n => n.id === payload);
            if (rn) rn.fixed = false;
            break;
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'positions': {
          const posUpdates = payload as PositionUpdate[];
          const newPositions = new Map<string, { x: number; y: number; z: number }>();
          posUpdates.forEach((p) => {
            newPositions.set(p.id, { x: p.x, y: p.y, z: p.z });
          });
          setPositions(newPositions);
          callbacksRef.current.onPositionUpdate?.(posUpdates);
          break;
        }
        case 'converged':
          setIsRunning(false);
          callbacksRef.current.onConverged?.();
          break;
        case 'stats':
          setStats(payload as LayoutStats);
          callbacksRef.current.onStats?.(payload as LayoutStats);
          break;
        case 'error':
          ErrorLogger.error(payload, 'LayoutWorker.onmessage');
          break;
      }
    };

    worker.onerror = (error) => {
      ErrorLogger.error(error, 'LayoutWorker.onerror');
    };

    workerRef.current = worker;
    setTimeout(() => setIsReady(true), 0);

    // Cleanup
    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      workerRef.current = null;
      setIsReady(false);
    };
  }, []);

  // Initialize with nodes and edges
  useEffect(() => {
    if (!workerRef.current || nodes.length === 0) return;

    const workerNodes = nodes.map(voxelNodeToWorkerNode);
    const workerEdges = edges.map(voxelEdgeToWorkerEdge);

    workerRef.current.postMessage({
      type: 'init',
      payload: {
        nodes: workerNodes,
        edges: workerEdges,
        config: { ...DEFAULT_CONFIG, ...config },
      },
    });

    if (autoStart) {
      workerRef.current.postMessage({ type: 'start' });
      setTimeout(() => setIsRunning(true), 0);
    }
  }, [nodes, edges, config, autoStart]);

  // Actions
  const start = useCallback(() => {
    if (workerRef.current && !isRunning) {
      workerRef.current.postMessage({ type: 'start' });
      setIsRunning(true);
    }
  }, [isRunning]);

  const stop = useCallback(() => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: 'stop' });
      setIsRunning(false);
    }
  }, [isRunning]);

  const step = useCallback(() => {
    if (workerRef.current && !isRunning) {
      workerRef.current.postMessage({ type: 'step' });
    }
  }, [isRunning]);

  const updateNodes = useCallback((newNodes: VoxelNode[]) => {
    if (workerRef.current) {
      const workerNodes = newNodes.map(voxelNodeToWorkerNode);
      workerRef.current.postMessage({ type: 'update-nodes', payload: workerNodes });
    }
  }, []);

  const updateEdges = useCallback((newEdges: VoxelEdge[]) => {
    if (workerRef.current) {
      const workerEdges = newEdges.map(voxelEdgeToWorkerEdge);
      workerRef.current.postMessage({ type: 'update-edges', payload: workerEdges });
    }
  }, []);

  const updateConfig = useCallback((newConfig: Partial<LayoutWorkerConfig>) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'update-config', payload: newConfig });
    }
  }, []);

  const fixNode = useCallback((nodeId: string) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'fix-node', payload: nodeId });
    }
  }, []);

  const releaseNode = useCallback((nodeId: string) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'release-node', payload: nodeId });
    }
  }, []);

  return {
    isReady,
    isRunning,
    start,
    stop,
    step,
    updateNodes,
    updateEdges,
    updateConfig,
    fixNode,
    releaseNode,
    stats,
    positions,
  };
}

export default useLayoutWorker;
