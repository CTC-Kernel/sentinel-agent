/**
 * useNodeClustering Tests
 *
 * @see Story VOX-9.4: Clustering Automatique
 */

import { describe, it, expect } from 'vitest';
import { clusterNodes, type ClusterConfig } from '../useNodeClustering';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockNode(
 id: string,
 position: { x: number; y: number; z: number },
 type: VoxelNode['type'] = 'asset',
 status: VoxelNode['status'] = 'normal'
): VoxelNode {
 return {
 id,
 type,
 label: `Node ${id}`,
 position,
 status,
 size: 1,
 data: {},
 connections: [],
 createdAt: new Date(),
 updatedAt: new Date(),
 };
}

// ============================================================================
// Tests
// ============================================================================

describe('clusterNodes', () => {
 const defaultConfig: ClusterConfig = {
 clusterDistance: 50,
 minNodesPerCluster: 3,
 maxNodesPerCluster: 20,
 enabled: true,
 clusterZoomThreshold: 500,
 cameraDistance: 1000, // Zoomed out enough to cluster
 };

 describe('Basic Clustering', () => {
 it('should cluster nearby nodes', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 10, y: 0, z: 10 }),
 createMockNode('3', { x: 20, y: 0, z: 20 }),
 createMockNode('far', { x: 500, y: 0, z: 500 }),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters.length).toBe(1);
 expect(result.clusters[0].count).toBe(3);
 expect(result.standaloneNodes.length).toBe(1);
 expect(result.standaloneNodes[0].id).toBe('far');
 });

 it('should not cluster when disabled', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 10, y: 0, z: 10 }),
 createMockNode('3', { x: 20, y: 0, z: 20 }),
 ];

 const result = clusterNodes(nodes, { ...defaultConfig, enabled: false });

 expect(result.clusters.length).toBe(0);
 expect(result.standaloneNodes.length).toBe(3);
 expect(result.isActive).toBe(false);
 });

 it('should not cluster when zoomed in', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 10, y: 0, z: 10 }),
 createMockNode('3', { x: 20, y: 0, z: 20 }),
 ];

 const result = clusterNodes(nodes, { ...defaultConfig, cameraDistance: 100 });

 expect(result.clusters.length).toBe(0);
 expect(result.standaloneNodes.length).toBe(3);
 expect(result.isActive).toBe(false);
 });
 });

 describe('Cluster Properties', () => {
 it('should calculate cluster center correctly', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 30, y: 0, z: 0 }),
 createMockNode('3', { x: 15, y: 0, z: 30 }),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters.length).toBe(1);
 expect(result.clusters[0].position.x).toBeCloseTo(15, 0);
 expect(result.clusters[0].position.z).toBeCloseTo(10, 0);
 });

 it('should identify dominant type', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }, 'risk'),
 createMockNode('2', { x: 10, y: 0, z: 10 }, 'risk'),
 createMockNode('3', { x: 20, y: 0, z: 20 }, 'asset'),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters[0].dominantType).toBe('risk');
 });

 it('should identify max severity status', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }, 'risk', 'normal'),
 createMockNode('2', { x: 10, y: 0, z: 10 }, 'risk', 'critical'),
 createMockNode('3', { x: 20, y: 0, z: 20 }, 'risk', 'warning'),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters[0].maxStatus).toBe('critical');
 });

 it('should generate appropriate label', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }, 'control'),
 createMockNode('2', { x: 10, y: 0, z: 10 }, 'control'),
 createMockNode('3', { x: 20, y: 0, z: 20 }, 'control'),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters[0].label).toBe('3 Controls');
 });
 });

 describe('Minimum Cluster Size', () => {
 it('should not form cluster with fewer than minNodesPerCluster', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 10, y: 0, z: 10 }),
 // Only 2 nearby nodes, not enough for default min of 3
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters.length).toBe(0);
 expect(result.standaloneNodes.length).toBe(2);
 });

 it('should respect custom minNodesPerCluster', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 10, y: 0, z: 10 }),
 ];

 const result = clusterNodes(nodes, { ...defaultConfig, minNodesPerCluster: 2 });

 expect(result.clusters.length).toBe(1);
 expect(result.clusters[0].count).toBe(2);
 });
 });

 describe('Maximum Cluster Size', () => {
 it('should respect maxNodesPerCluster', () => {
 const nodes: VoxelNode[] = Array.from({ length: 10 }, (_, i) =>
 createMockNode(`${i}`, { x: i * 5, y: 0, z: i * 5 })
 );

 const result = clusterNodes(nodes, { ...defaultConfig, maxNodesPerCluster: 5 });

 // Should create multiple clusters respecting max size
 const maxClusterSize = Math.max(...result.clusters.map((c) => c.count));
 expect(maxClusterSize).toBeLessThanOrEqual(5);
 });
 });

 describe('Multiple Clusters', () => {
 it('should form multiple separate clusters', () => {
 const nodes: VoxelNode[] = [
 // Cluster 1
 createMockNode('1a', { x: 0, y: 0, z: 0 }),
 createMockNode('1b', { x: 10, y: 0, z: 10 }),
 createMockNode('1c', { x: 20, y: 0, z: 20 }),
 // Cluster 2 (far away)
 createMockNode('2a', { x: 500, y: 0, z: 500 }),
 createMockNode('2b', { x: 510, y: 0, z: 510 }),
 createMockNode('2c', { x: 520, y: 0, z: 520 }),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters.length).toBe(2);
 expect(result.standaloneNodes.length).toBe(0);
 });
 });

 describe('Cluster Distance', () => {
 it('should not cluster nodes beyond clusterDistance', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 100, y: 0, z: 0 }), // 100 units away
 createMockNode('3', { x: 200, y: 0, z: 0 }), // 200 units away
 ];

 const result = clusterNodes(nodes, { ...defaultConfig, clusterDistance: 50 });

 // Nodes are too far apart to cluster
 expect(result.clusters.length).toBe(0);
 expect(result.standaloneNodes.length).toBe(3);
 });

 it('should cluster nodes within clusterDistance', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 20, y: 0, z: 0 }),
 createMockNode('3', { x: 40, y: 0, z: 0 }),
 ];

 const result = clusterNodes(nodes, { ...defaultConfig, clusterDistance: 100 });

 expect(result.clusters.length).toBe(1);
 expect(result.clusters[0].count).toBe(3);
 });
 });

 describe('Empty and Edge Cases', () => {
 it('should handle empty node array', () => {
 const result = clusterNodes([], defaultConfig);

 expect(result.clusters.length).toBe(0);
 expect(result.standaloneNodes.length).toBe(0);
 expect(result.isActive).toBe(false);
 });

 it('should handle single node', () => {
 const nodes: VoxelNode[] = [createMockNode('1', { x: 0, y: 0, z: 0 })];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters.length).toBe(0);
 expect(result.standaloneNodes.length).toBe(1);
 });

 it('should handle default config', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 10, y: 0, z: 10 }),
 createMockNode('3', { x: 20, y: 0, z: 20 }),
 ];

 // Default config has cameraDistance: 0, so clustering won't be active
 const result = clusterNodes(nodes);

 expect(result.isActive).toBe(false);
 expect(result.standaloneNodes.length).toBe(3);
 });
 });

 describe('Cluster Result Properties', () => {
 it('should include unique cluster IDs', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1a', { x: 0, y: 0, z: 0 }),
 createMockNode('1b', { x: 10, y: 0, z: 10 }),
 createMockNode('1c', { x: 20, y: 0, z: 20 }),
 createMockNode('2a', { x: 500, y: 0, z: 500 }),
 createMockNode('2b', { x: 510, y: 0, z: 510 }),
 createMockNode('2c', { x: 520, y: 0, z: 520 }),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 const ids = result.clusters.map((c) => c.id);
 const uniqueIds = new Set(ids);
 expect(uniqueIds.size).toBe(ids.length);
 });

 it('should calculate positive radius', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 30, y: 0, z: 30 }),
 createMockNode('3', { x: 15, y: 30, z: 15 }),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusters[0].radius).toBeGreaterThan(0);
 });

 it('should track cluster count correctly', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1a', { x: 0, y: 0, z: 0 }),
 createMockNode('1b', { x: 10, y: 0, z: 10 }),
 createMockNode('1c', { x: 20, y: 0, z: 20 }),
 createMockNode('2a', { x: 500, y: 0, z: 500 }),
 createMockNode('2b', { x: 510, y: 0, z: 510 }),
 createMockNode('2c', { x: 520, y: 0, z: 520 }),
 ];

 const result = clusterNodes(nodes, defaultConfig);

 expect(result.clusterCount).toBe(result.clusters.length);
 });
 });

 describe('Adaptive Distance', () => {
 it('should increase cluster distance at higher zoom levels', () => {
 const nodes: VoxelNode[] = [
 createMockNode('1', { x: 0, y: 0, z: 0 }),
 createMockNode('2', { x: 60, y: 0, z: 0 }),
 createMockNode('3', { x: 120, y: 0, z: 0 }),
 ];

 // At low camera distance (close zoom), these nodes are too far apart
 const closeResult = clusterNodes(nodes, {
 ...defaultConfig,
 clusterDistance: 50,
 cameraDistance: 600,
 });

 // At high camera distance (far zoom), adaptive distance is larger
 const farResult = clusterNodes(nodes, {
 ...defaultConfig,
 clusterDistance: 50,
 cameraDistance: 2000,
 });

 // Far zoom should be more likely to cluster
 expect(farResult.clusters.length).toBeGreaterThanOrEqual(closeResult.clusters.length);
 });
 });
});
