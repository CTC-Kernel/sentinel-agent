/**
 * Story 32.4 - Web Worker for Force-Directed Layout Calculations
 *
 * Moves expensive force-directed layout calculations to a Web Worker
 * to prevent blocking the main thread. Handles large graphs (1000+ nodes).
 */

// ============================================================================
// Types
// ============================================================================

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

export interface LayoutConfig {
  /** Repulsion force between nodes */
  repulsion: number;
  /** Attraction force along edges */
  attraction: number;
  /** Gravity towards center */
  gravity: number;
  /** Damping factor (0-1) */
  damping: number;
  /** Minimum distance for force calculations */
  minDistance: number;
  /** Maximum velocity */
  maxVelocity: number;
  /** Time step for simulation */
  timeStep: number;
  /** Use Barnes-Hut optimization for large graphs */
  useBarnesHut: boolean;
  /** Barnes-Hut theta threshold */
  barnesHutTheta: number;
  /** 3D layout (vs 2D) */
  is3D: boolean;
  /** Center of gravity */
  center: { x: number; y: number; z: number };
}

export type WorkerMessageType =
  | 'init'
  | 'start'
  | 'stop'
  | 'step'
  | 'update-nodes'
  | 'update-edges'
  | 'update-config'
  | 'fix-node'
  | 'release-node';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: unknown;
}

export interface InitPayload {
  nodes: WorkerNode[];
  edges: WorkerEdge[];
  config: Partial<LayoutConfig>;
}

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
  z: number;
}

export type WorkerResponseType = 'positions' | 'converged' | 'error' | 'stats';

export interface WorkerResponse {
  type: WorkerResponseType;
  payload: unknown;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: LayoutConfig = {
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
// Barnes-Hut Octree Implementation
// ============================================================================

interface OctreeNode {
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  centerOfMass: { x: number; y: number; z: number };
  totalMass: number;
  body: WorkerNode | null;
  children: (OctreeNode | null)[];
  isLeaf: boolean;
}

function createOctreeNode(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): OctreeNode {
  return {
    bounds: { minX, minY, minZ, maxX, maxY, maxZ },
    centerOfMass: { x: 0, y: 0, z: 0 },
    totalMass: 0,
    body: null,
    children: [null, null, null, null, null, null, null, null],
    isLeaf: true,
  };
}

function getOctant(node: OctreeNode, x: number, y: number, z: number): number {
  const { bounds } = node;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;

  let octant = 0;
  if (x > midX) octant |= 1;
  if (y > midY) octant |= 2;
  if (z > midZ) octant |= 4;
  return octant;
}

function createChildBounds(
  parent: OctreeNode,
  octant: number
): { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } {
  const { bounds } = parent;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;

  return {
    minX: octant & 1 ? midX : bounds.minX,
    maxX: octant & 1 ? bounds.maxX : midX,
    minY: octant & 2 ? midY : bounds.minY,
    maxY: octant & 2 ? bounds.maxY : midY,
    minZ: octant & 4 ? midZ : bounds.minZ,
    maxZ: octant & 4 ? bounds.maxZ : midZ,
  };
}

function insertIntoOctree(node: OctreeNode, body: WorkerNode): void {
  if (node.body === null && node.isLeaf) {
    // Empty leaf - insert directly
    node.body = body;
    node.centerOfMass = { x: body.x, y: body.y, z: body.z };
    node.totalMass = body.mass;
    return;
  }

  if (node.isLeaf) {
    // Subdivide
    node.isLeaf = false;
    const existingBody = node.body!;
    node.body = null;

    // Reinsert existing body
    const existingOctant = getOctant(node, existingBody.x, existingBody.y, existingBody.z);
    if (!node.children[existingOctant]) {
      const bounds = createChildBounds(node, existingOctant);
      node.children[existingOctant] = createOctreeNode(
        bounds.minX,
        bounds.minY,
        bounds.minZ,
        bounds.maxX,
        bounds.maxY,
        bounds.maxZ
      );
    }
    insertIntoOctree(node.children[existingOctant]!, existingBody);
  }

  // Insert new body
  const octant = getOctant(node, body.x, body.y, body.z);
  if (!node.children[octant]) {
    const bounds = createChildBounds(node, octant);
    node.children[octant] = createOctreeNode(
      bounds.minX,
      bounds.minY,
      bounds.minZ,
      bounds.maxX,
      bounds.maxY,
      bounds.maxZ
    );
  }
  insertIntoOctree(node.children[octant]!, body);

  // Update center of mass
  const totalMass = node.totalMass + body.mass;
  node.centerOfMass.x = (node.centerOfMass.x * node.totalMass + body.x * body.mass) / totalMass;
  node.centerOfMass.y = (node.centerOfMass.y * node.totalMass + body.y * body.mass) / totalMass;
  node.centerOfMass.z = (node.centerOfMass.z * node.totalMass + body.z * body.mass) / totalMass;
  node.totalMass = totalMass;
}

function buildOctree(nodes: WorkerNode[]): OctreeNode | null {
  if (nodes.length === 0) return null;

  // Find bounds
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    minZ = Math.min(minZ, node.z);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
    maxZ = Math.max(maxZ, node.z);
  }

  // Add padding
  const padding = 10;
  const root = createOctreeNode(
    minX - padding,
    minY - padding,
    minZ - padding,
    maxX + padding,
    maxY + padding,
    maxZ + padding
  );

  for (const node of nodes) {
    insertIntoOctree(root, node);
  }

  return root;
}

// ============================================================================
// Layout Simulation
// ============================================================================

let nodes: WorkerNode[] = [];
let edges: WorkerEdge[] = [];
let config: LayoutConfig = { ...DEFAULT_CONFIG };
let running = false;
let animationFrameId: ReturnType<typeof setTimeout> | null = null;

function calculateRepulsion(
  node: WorkerNode,
  tree: OctreeNode | null,
  theta: number
): { fx: number; fy: number; fz: number } {
  let fx = 0,
    fy = 0,
    fz = 0;

  if (!tree || tree.totalMass === 0) return { fx, fy, fz };

  const dx = tree.centerOfMass.x - node.x;
  const dy = tree.centerOfMass.y - node.y;
  const dz = tree.centerOfMass.z - node.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const dist = Math.sqrt(distSq);

  if (dist < config.minDistance) return { fx, fy, fz };

  // Check if we can use this node as a single body
  const size =
    (tree.bounds.maxX - tree.bounds.minX + tree.bounds.maxY - tree.bounds.minY + tree.bounds.maxZ - tree.bounds.minZ) /
    3;

  if (tree.isLeaf || size / dist < theta) {
    // Treat as single body
    const force = -config.repulsion * node.mass * tree.totalMass / distSq;
    fx = (force * dx) / dist;
    fy = (force * dy) / dist;
    fz = (force * fz) / dist;
  } else {
    // Recurse into children
    for (const child of tree.children) {
      if (child) {
        const childForce = calculateRepulsion(node, child, theta);
        fx += childForce.fx;
        fy += childForce.fy;
        fz += childForce.fz;
      }
    }
  }

  return { fx, fy, fz };
}

function calculateForces(): void {
  // Build octree for Barnes-Hut
  const tree = config.useBarnesHut && nodes.length > 100 ? buildOctree(nodes) : null;

  // Create node lookup map
  const nodeMap = new Map<string, WorkerNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Calculate forces for each node
  for (const node of nodes) {
    if (node.fixed) continue;

    let fx = 0,
      fy = 0,
      fz = 0;

    // Repulsion forces
    if (tree && config.useBarnesHut) {
      const repulsion = calculateRepulsion(node, tree, config.barnesHutTheta);
      fx += repulsion.fx;
      fy += repulsion.fy;
      fz += repulsion.fz;
    } else {
      // Direct calculation for small graphs
      for (const other of nodes) {
        if (other.id === node.id) continue;

        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dz = other.z - node.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        if (dist < config.minDistance) continue;

        const force = -config.repulsion * node.mass * other.mass / distSq;
        fx += (force * dx) / dist;
        fy += (force * dy) / dist;
        fz += (force * dz) / dist;
      }
    }

    // Attraction forces (edges)
    for (const edge of edges) {
      let other: WorkerNode | undefined;
      if (edge.source === node.id) {
        other = nodeMap.get(edge.target);
      } else if (edge.target === node.id) {
        other = nodeMap.get(edge.source);
      }

      if (other) {
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dz = other.z - node.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > config.minDistance) {
          const force = config.attraction * edge.weight * dist;
          fx += (force * dx) / dist;
          fy += (force * dy) / dist;
          fz += (force * dz) / dist;
        }
      }
    }

    // Gravity towards center
    const dx = config.center.x - node.x;
    const dy = config.center.y - node.y;
    const dz = config.center.z - node.z;
    fx += config.gravity * dx;
    fy += config.gravity * dy;
    fz += config.gravity * dz;

    // Update velocities
    node.vx = (node.vx + fx * config.timeStep) * config.damping;
    node.vy = (node.vy + fy * config.timeStep) * config.damping;
    node.vz = (node.vz + fz * config.timeStep) * config.damping;

    // Clamp velocities
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy + node.vz * node.vz);
    if (speed > config.maxVelocity) {
      const scale = config.maxVelocity / speed;
      node.vx *= scale;
      node.vy *= scale;
      node.vz *= scale;
    }
  }
}

function updatePositions(): void {
  for (const node of nodes) {
    if (node.fixed) continue;

    node.x += node.vx * config.timeStep;
    node.y += node.vy * config.timeStep;
    if (config.is3D) {
      node.z += node.vz * config.timeStep;
    }
  }
}

function calculateKineticEnergy(): number {
  let energy = 0;
  for (const node of nodes) {
    energy += 0.5 * node.mass * (node.vx * node.vx + node.vy * node.vy + node.vz * node.vz);
  }
  return energy;
}

function simulationStep(): void {
  calculateForces();
  updatePositions();

  // Send position updates
  const positions: PositionUpdate[] = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    z: n.z,
  }));

  self.postMessage({ type: 'positions', payload: positions } as WorkerResponse);

  // Check for convergence
  const energy = calculateKineticEnergy();
  if (energy < 0.01) {
    self.postMessage({ type: 'converged', payload: { energy } } as WorkerResponse);
    stopSimulation();
    return;
  }

  // Send stats periodically
  self.postMessage({
    type: 'stats',
    payload: {
      energy,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  } as WorkerResponse);

  if (running) {
    // Use setTimeout for consistent timing in worker
    animationFrameId = setTimeout(simulationStep, 16);
  }
}

function startSimulation(): void {
  if (running) return;
  running = true;
  simulationStep();
}

function stopSimulation(): void {
  running = false;
  if (animationFrameId !== null) {
    clearTimeout(animationFrameId);
    animationFrameId = null;
  }
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'init': {
        const data = payload as InitPayload;
        nodes = data.nodes.map((n) => ({
          ...n,
          vx: 0,
          vy: 0,
          vz: 0,
        }));
        edges = data.edges;
        config = { ...DEFAULT_CONFIG, ...data.config };
        break;
      }

      case 'start':
        startSimulation();
        break;

      case 'stop':
        stopSimulation();
        break;

      case 'step':
        if (!running) {
          simulationStep();
        }
        break;

      case 'update-nodes':
        nodes = (payload as WorkerNode[]).map((n) => ({
          ...n,
          vx: n.vx || 0,
          vy: n.vy || 0,
          vz: n.vz || 0,
        }));
        break;

      case 'update-edges':
        edges = payload as WorkerEdge[];
        break;

      case 'update-config':
        config = { ...config, ...(payload as Partial<LayoutConfig>) };
        break;

      case 'fix-node': {
        const nodeId = payload as string;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          node.fixed = true;
          node.vx = 0;
          node.vy = 0;
          node.vz = 0;
        }
        break;
      }

      case 'release-node': {
        const nodeId = payload as string;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          node.fixed = false;
        }
        break;
      }

      default:
        self.postMessage({
          type: 'error',
          payload: { message: `Unknown message type: ${type}` },
        } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { message: (error as Error).message },
    } as WorkerResponse);
  }
};

// Types are exported directly from interface declarations above
