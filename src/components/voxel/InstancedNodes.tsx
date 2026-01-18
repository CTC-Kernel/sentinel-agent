/**
 * Story 32.1 - Instanced Rendering for Voxel Nodes
 *
 * Uses Three.js InstancedMesh for efficient rendering of many similar nodes.
 * Groups nodes by type and supports up to 10,000 nodes with dynamic updates.
 */

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  Color,
  Object3D,
  BoxGeometry,
  SphereGeometry,
  OctahedronGeometry,
  CylinderGeometry,
  BufferGeometry,
  MeshPhysicalMaterial,
} from 'three';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface InstancedNodesProps {
  /** Array of nodes to render */
  nodes: VoxelNode[];
  /** Callback when a node is clicked */
  onNodeClick?: (node: VoxelNode) => void;
  /** ID of the currently selected node */
  selectedNodeId?: string | null;
  /** Set of node IDs that are highlighted */
  highlightedNodeIds?: Set<string>;
  /** Set of node IDs that are dimmed */
  dimmedNodeIds?: Set<string>;
  /** Enable/disable instanced rendering (fallback to individual meshes) */
  enabled?: boolean;
  /** Maximum number of instances per group */
  maxInstances?: number;
}

export interface InstanceGroupProps {
  /** Type of nodes in this group */
  nodeType: VoxelNodeType;
  /** Nodes to render in this group */
  nodes: VoxelNode[];
  /** Maximum instances to allocate */
  maxInstances: number;
  /** Callback when a node is clicked */
  onNodeClick?: (node: VoxelNode) => void;
  /** ID of the currently selected node */
  selectedNodeId?: string | null;
  /** Set of highlighted node IDs */
  highlightedNodeIds?: Set<string>;
  /** Set of dimmed node IDs */
  dimmedNodeIds?: Set<string>;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum supported instances per mesh type */
const DEFAULT_MAX_INSTANCES = 10000;

/** Colors for different node types */
const NODE_TYPE_COLORS: Record<VoxelNodeType, string> = {
  asset: '#3b82f6',
  risk: '#ef4444',
  control: '#22c55e',
  incident: '#f43f5e',
  supplier: '#8b5cf6',
  project: '#f59e0b',
  audit: '#06b6d4',
};

/** Geometry configurations per node type */
const NODE_GEOMETRIES: Record<VoxelNodeType, () => BufferGeometry> = {
  asset: () => new BoxGeometry(1, 0.5, 0.8),
  risk: () => new OctahedronGeometry(0.6),
  control: () => new SphereGeometry(0.5, 16, 16),
  incident: () => new OctahedronGeometry(0.7),
  supplier: () => new CylinderGeometry(0.4, 0.6, 0.8, 6),
  project: () => new CylinderGeometry(0.5, 0.5, 0.7, 32),
  audit: () => new CylinderGeometry(0.5, 0.5, 0.6, 8),
};

// ============================================================================
// Helper Object for Matrix Calculations
// ============================================================================

const tempObject = new Object3D();
const tempMatrix = new Matrix4();
const tempColor = new Color();
const tempPosition = new Vector3();

// ============================================================================
// Instance Group Component
// ============================================================================

const InstanceGroup: React.FC<InstanceGroupProps> = React.memo(
  ({
    nodeType,
    nodes,
    maxInstances,
    onNodeClick,
    selectedNodeId,
    highlightedNodeIds,
    dimmedNodeIds,
  }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const nodeMapRef = useRef<Map<number, VoxelNode>>(new Map());
    useThree(); // Access Three context for frustum culling

    // Create geometry and material for this node type
    const { geometry, material } = useMemo(() => {
      const geo = NODE_GEOMETRIES[nodeType]();
      const mat = new MeshPhysicalMaterial({
        color: NODE_TYPE_COLORS[nodeType],
        metalness: 0.3,
        roughness: 0.4,
        transparent: true,
        opacity: 0.95,
        emissive: NODE_TYPE_COLORS[nodeType],
        emissiveIntensity: 0.2,
      });

      return { geometry: geo, material: mat };
    }, [nodeType]);

    // Update instance matrices and colors when nodes change
    useEffect(() => {
      if (!meshRef.current) return;

      const mesh = meshRef.current;
      nodeMapRef.current.clear();

      // Update each instance
      nodes.forEach((node, index) => {
        if (index >= maxInstances) return;

        // Store node reference for click handling
        nodeMapRef.current.set(index, node);

        // Calculate position
        const pos = node.position;
        tempObject.position.set(
          typeof pos.x === 'number' ? pos.x : 0,
          typeof pos.y === 'number' ? pos.y : 0,
          typeof pos.z === 'number' ? pos.z : 0
        );

        // Calculate scale based on selection/highlight state
        let scale = 1;
        if (selectedNodeId === node.id) {
          scale = 1.3;
        } else if (highlightedNodeIds?.has(node.id)) {
          scale = 1.15;
        } else if (dimmedNodeIds?.has(node.id)) {
          scale = 0.8;
        }
        tempObject.scale.setScalar(scale);

        // Apply rotation based on node type
        if (nodeType === 'risk' || nodeType === 'incident') {
          tempObject.rotation.set(0, 0, Math.PI / 4);
        } else {
          tempObject.rotation.set(0, 0, 0);
        }

        // Update instance matrix
        tempObject.updateMatrix();
        mesh.setMatrixAt(index, tempObject.matrix);

        // Update instance color
        const baseColor = NODE_TYPE_COLORS[nodeType];
        if (selectedNodeId === node.id) {
          tempColor.set('#fde047'); // Selected: yellow
        } else if (highlightedNodeIds?.has(node.id)) {
          tempColor.set('#4ecdc4'); // Highlighted: teal
        } else if (dimmedNodeIds?.has(node.id)) {
          tempColor.setStyle(baseColor);
          tempColor.multiplyScalar(0.4); // Dimmed
        } else {
          tempColor.set(baseColor);
        }
        mesh.setColorAt(index, tempColor);
      });

      // Mark for updates
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }

      // Set visible count
      mesh.count = Math.min(nodes.length, maxInstances);
    }, [nodes, selectedNodeId, highlightedNodeIds, dimmedNodeIds, maxInstances, nodeType]);

    // Animation frame for subtle rotation on certain node types
    useFrame((_, delta) => {
      if (!meshRef.current) return;

      if (nodeType === 'risk' || nodeType === 'incident') {
        // Animate matrices for risk/incident nodes
        const mesh = meshRef.current;
        const rotationSpeed = nodeType === 'incident' ? 0.5 : 0.3;

        nodes.forEach((_, index) => {
          if (index >= maxInstances) return;

          mesh.getMatrixAt(index, tempMatrix);
          tempPosition.setFromMatrixPosition(tempMatrix);

          tempObject.position.copy(tempPosition);

          // Get current scale from matrix
          const scale = tempMatrix.getMaxScaleOnAxis();
          tempObject.scale.setScalar(scale);

          // Apply rotation
          tempObject.rotation.y += delta * rotationSpeed;

          tempObject.updateMatrix();
          mesh.setMatrixAt(index, tempObject.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
      }
    });

    // Handle pointer events
    const handlePointerDown = useCallback(
      (event: { stopPropagation: () => void; instanceId?: number }) => {
        event.stopPropagation();
        if (event.instanceId !== undefined) {
          const node = nodeMapRef.current.get(event.instanceId);
          if (node && onNodeClick) {
            onNodeClick(node);
          }
        }
      },
      [onNodeClick]
    );

    if (nodes.length === 0) return null;

    return (
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, maxInstances]}
        frustumCulled={true}
        onPointerDown={handlePointerDown}
      />
    );
  }
);

InstanceGroup.displayName = 'InstanceGroup';

// ============================================================================
// Main Component
// ============================================================================

export const InstancedNodes: React.FC<InstancedNodesProps> = ({
  nodes,
  onNodeClick,
  selectedNodeId,
  highlightedNodeIds = new Set(),
  dimmedNodeIds = new Set(),
  enabled = true,
  maxInstances = DEFAULT_MAX_INSTANCES,
}) => {
  // Group nodes by type
  const nodeGroups = useMemo(() => {
    const groups: Record<VoxelNodeType, VoxelNode[]> = {
      asset: [],
      risk: [],
      control: [],
      incident: [],
      supplier: [],
      project: [],
      audit: [],
    };

    nodes.forEach((node) => {
      if (groups[node.type]) {
        groups[node.type].push(node);
      }
    });

    return groups;
  }, [nodes]);

  // Calculate max instances per group
  const perGroupMaxInstances = useMemo(() => {
    const totalGroups = Object.values(nodeGroups).filter((g) => g.length > 0).length;
    return Math.floor(maxInstances / Math.max(1, totalGroups));
  }, [nodeGroups, maxInstances]);

  if (!enabled) {
    // Return null - fallback to individual meshes should be handled by parent
    return null;
  }

  return (
    <group name="instanced-nodes">
      {(Object.entries(nodeGroups) as [VoxelNodeType, VoxelNode[]][]).map(
        ([type, typeNodes]) =>
          typeNodes.length > 0 && (
            <InstanceGroup
              key={type}
              nodeType={type}
              nodes={typeNodes}
              maxInstances={perGroupMaxInstances}
              onNodeClick={onNodeClick}
              selectedNodeId={selectedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              dimmedNodeIds={dimmedNodeIds}
            />
          )
      )}
    </group>
  );
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if instanced rendering is recommended based on node count
 */
// eslint-disable-next-line react-refresh/only-export-components
export function shouldUseInstancedRendering(nodeCount: number, threshold = 100): boolean {
  return nodeCount >= threshold;
}

/**
 * Calculate memory usage for instanced mesh
 */
// eslint-disable-next-line react-refresh/only-export-components
export function calculateInstancedMemory(instanceCount: number): {
  matrixBytes: number;
  colorBytes: number;
  totalMB: number;
} {
  // Matrix4 = 16 floats * 4 bytes = 64 bytes per instance
  const matrixBytes = instanceCount * 64;
  // Color = 3 floats * 4 bytes = 12 bytes per instance
  const colorBytes = instanceCount * 12;
  const totalBytes = matrixBytes + colorBytes;

  return {
    matrixBytes,
    colorBytes,
    totalMB: totalBytes / (1024 * 1024),
  };
}

export default InstancedNodes;
