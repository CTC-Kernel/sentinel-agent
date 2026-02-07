/**
 * Story 32.5 - Memory Management Hook for Three.js
 *
 * Monitors and manages Three.js memory usage.
 * Implements geometry/material disposal, node pooling, and GC hints.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import {
 WebGLRenderer,
 BufferGeometry,
 Material,
 Texture,
 Object3D,
 Mesh,
 Points,
 Line,
} from 'three';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export interface MemoryStats {
 /** Number of geometries in memory */
 geometries: number;
 /** Number of textures in memory */
 textures: number;
 /** Estimated GPU memory usage in MB */
 gpuMemoryMB: number;
 /** Number of draw calls per frame */
 drawCalls: number;
 /** Number of triangles rendered */
 triangles: number;
 /** Number of active Three.js programs */
 programs: number;
 /** Total objects in scene */
 objects: number;
 /** JS heap size in MB (if available) */
 heapUsedMB: number | null;
 /** JS heap limit in MB (if available) */
 heapTotalMB: number | null;
}

export interface PooledResource<T> {
 /** The resource */
 resource: T;
 /** Whether it's currently in use */
 inUse: boolean;
 /** When it was last used */
 lastUsed: number;
 /** Unique identifier */
 id: string;
}

export interface MemoryConfig {
 /** Maximum pool size per resource type */
 maxPoolSize: number;
 /** Time in ms before unused resources are disposed */
 disposeAfterMs: number;
 /** Warning threshold for GPU memory (MB) */
 gpuWarningThresholdMB: number;
 /** Critical threshold for GPU memory (MB) */
 gpuCriticalThresholdMB: number;
 /** How often to check memory stats (ms) */
 checkIntervalMs: number;
 /** Enable automatic disposal of unused resources */
 autoDispose: boolean;
 /** Enable memory usage logging */
 logging: boolean;
}

export interface UseMemoryManagementOptions extends Partial<MemoryConfig> {
 /** Callback when memory warning threshold is exceeded */
 onWarning?: (stats: MemoryStats) => void;
 /** Callback when memory critical threshold is exceeded */
 onCritical?: (stats: MemoryStats) => void;
}

export interface UseMemoryManagementReturn {
 /** Current memory statistics */
 stats: MemoryStats;
 /** Memory health status */
 status: 'healthy' | 'warning' | 'critical';
 /** Dispose a specific geometry */
 disposeGeometry: (geometry: BufferGeometry) => void;
 /** Dispose a specific material */
 disposeMaterial: (material: Material) => void;
 /** Dispose a specific texture */
 disposeTexture: (texture: Texture) => void;
 /** Dispose an entire object tree */
 disposeObject: (object: Object3D) => void;
 /** Get a pooled geometry */
 getPooledGeometry: <T extends BufferGeometry>(type: string, factory: () => T) => T;
 /** Return a geometry to the pool */
 returnToPool: (type: string, geometry: BufferGeometry) => void;
 /** Force garbage collection hint */
 requestGC: () => void;
 /** Dispose all unused pooled resources */
 cleanupPools: () => void;
 /** Get detailed pool statistics */
 getPoolStats: () => Record<string, { total: number; inUse: number; available: number }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MemoryConfig = {
 maxPoolSize: 100,
 disposeAfterMs: 30000, // 30 seconds
 gpuWarningThresholdMB: 256,
 gpuCriticalThresholdMB: 512,
 checkIntervalMs: 1000,
 autoDispose: true,
 logging: false,
};

// ============================================================================
// Main Hook
// ============================================================================

export function useMemoryManagement(options: UseMemoryManagementOptions = {}): UseMemoryManagementReturn {
 const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...options }), [options]);
 const { gl } = useThree();

 const [stats, setStats] = useState<MemoryStats>({
 geometries: 0,
 textures: 0,
 gpuMemoryMB: 0,
 drawCalls: 0,
 triangles: 0,
 programs: 0,
 objects: 0,
 heapUsedMB: null,
 heapTotalMB: null,
 });

 const [status, setStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');

 // Resource pools
 const geometryPoolsRef = useRef<Map<string, PooledResource<BufferGeometry>[]>>(new Map());
 const disposedSetRef = useRef<Set<BufferGeometry | Material | Texture>>(new Set());

 // Store callbacks in ref
 const callbacksRef = useRef({ onWarning: options.onWarning, onCritical: options.onCritical });
 callbacksRef.current = { onWarning: options.onWarning, onCritical: options.onCritical };

 // Calculate memory stats
 const calculateStats = useCallback((): MemoryStats => {
 const renderer = gl as WebGLRenderer;
 const info = renderer.info;

 // Get renderer memory info
 const geometries = info.memory?.geometries ?? 0;
 const textures = info.memory?.textures ?? 0;

 // Estimate GPU memory (rough calculation)
 // Geometries: ~1KB each on average, Textures: ~4MB each on average
 const gpuMemoryMB = geometries * 0.001 + textures * 4;

 // Render info
 const drawCalls = info.render?.calls ?? 0;
 const triangles = info.render?.triangles ?? 0;
 const programs = info.programs?.length ?? 0;

 // Object count (traverse scene)
 let objects = 0;
 renderer.domElement.parentElement?.querySelectorAll('*').forEach(() => objects++);

 // JS heap (if available via performance API)
 let heapUsedMB: number | null = null;
 let heapTotalMB: number | null = null;

 if (typeof performance !== 'undefined' && 'memory' in performance) {
 const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
 if (memory) {
 heapUsedMB = memory.usedJSHeapSize / (1024 * 1024);
 heapTotalMB = memory.totalJSHeapSize / (1024 * 1024);
 }
 }

 return {
 geometries,
 textures,
 gpuMemoryMB,
 drawCalls,
 triangles,
 programs,
 objects,
 heapUsedMB,
 heapTotalMB,
 };
 }, [gl]);

 // Update stats periodically
 useEffect(() => {
 const interval = setInterval(() => {
 const newStats = calculateStats();
 setStats(newStats);

 // Check thresholds
 let newStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
 if (newStats.gpuMemoryMB >= config.gpuCriticalThresholdMB) {
 newStatus = 'critical';
 callbacksRef.current.onCritical?.(newStats);
 } else if (newStats.gpuMemoryMB >= config.gpuWarningThresholdMB) {
 newStatus = 'warning';
 callbacksRef.current.onWarning?.(newStats);
 }
 setStatus(newStatus);

 if (config.logging && newStatus !== 'healthy') {
 ErrorLogger.warn(`Status: ${newStatus}`, 'MemoryManagement', { metadata: newStats as unknown as Record<string, unknown> });
 }
 }, config.checkIntervalMs);

 return () => clearInterval(interval);
 }, [calculateStats, config]);

 // Auto-dispose unused pooled resources
 useEffect(() => {
 if (!config.autoDispose) return;

 const interval = setInterval(() => {
 const now = Date.now();
 const pools = geometryPoolsRef.current;

 for (const [type, pool] of pools) {
 const toRemove: number[] = [];

 pool.forEach((item, index) => {
 if (!item.inUse && now - item.lastUsed > config.disposeAfterMs) {
 item.resource.dispose();
 toRemove.push(index);
 }
 });

 // Remove disposed items (in reverse order to maintain indices)
 toRemove.reverse().forEach((index) => pool.splice(index, 1));

 if (config.logging && toRemove.length > 0) {
 ErrorLogger.debug(`Disposed ${toRemove.length} unused ${type} geometries`, 'MemoryManagement');
 }
 }
 }, config.disposeAfterMs / 2);

 return () => clearInterval(interval);
 }, [config]);

 // Dispose geometry
 const disposeGeometry = useCallback((geometry: BufferGeometry) => {
 if (disposedSetRef.current.has(geometry)) return;
 geometry.dispose();
 disposedSetRef.current.add(geometry);
 }, []);

 // Dispose material
 const disposeMaterial = useCallback((material: Material) => {
 if (disposedSetRef.current.has(material)) return;

 // Dispose associated maps/textures
 const mat = material as unknown as Record<string, unknown>;
 const mapNames = ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap', 'alphaMap', 'aoMap', 'displacementMap', 'emissiveMap', 'gradientMap', 'metalnessMap', 'roughnessMap'];

 mapNames.forEach((name) => {
 const tex = mat[name] as Texture | undefined;
 if (tex && tex.dispose) {
 tex.dispose();
 disposedSetRef.current.add(tex);
 }
 });

 material.dispose();
 disposedSetRef.current.add(material);
 }, []);

 // Dispose texture
 const disposeTexture = useCallback((texture: Texture) => {
 if (disposedSetRef.current.has(texture)) return;
 texture.dispose();
 disposedSetRef.current.add(texture);
 }, []);

 // Dispose entire object tree
 const disposeObject = useCallback(
 (object: Object3D) => {
 object.traverse((child) => {
 if (child instanceof Mesh || child instanceof Points || child instanceof Line) {
 if (child.geometry) {
 disposeGeometry(child.geometry);
 }
 if (child.material) {
 if (Array.isArray(child.material)) {
 child.material.forEach(disposeMaterial);
 } else {
 disposeMaterial(child.material);
 }
 }
 }
 });

 // Remove from parent
 if (object.parent) {
 object.parent.remove(object);
 }
 },
 [disposeGeometry, disposeMaterial]
 );

 // Get pooled geometry
 const getPooledGeometry = useCallback(
 <T extends BufferGeometry>(type: string, factory: () => T): T => {
 const pools = geometryPoolsRef.current;

 if (!pools.has(type)) {
 pools.set(type, []);
 }

 const pool = pools.get(type)!;

 // Find available geometry
 const available = pool.find((item) => !item.inUse);
 if (available) {
 available.inUse = true;
 available.lastUsed = Date.now();
 return available.resource as T;
 }

 // Create new if pool not full
 if (pool.length < config.maxPoolSize) {
 const geometry = factory();
 const item: PooledResource<BufferGeometry> = {
 resource: geometry,
 inUse: true,
 lastUsed: Date.now(),
 id: `${type}-${pool.length}`,
 };
 pool.push(item);
 return geometry;
 }

 // Pool full - create without pooling
 if (config.logging) {
 ErrorLogger.warn(`Pool for ${type} is full, creating unpooled geometry`, 'MemoryManagement');
 }
 return factory();
 },
 [config]
 );

 // Return geometry to pool
 const returnToPool = useCallback((type: string, geometry: BufferGeometry) => {
 const pools = geometryPoolsRef.current;
 const pool = pools.get(type);

 if (!pool) return;

 const item = pool.find((p) => p.resource === geometry);
 if (item) {
 item.inUse = false;
 item.lastUsed = Date.now();
 }
 }, []);

 // Request GC hint
 const requestGC = useCallback(() => {
 // Reset disposed set to free references
 disposedSetRef.current.clear();

 // Force Three.js to reset render info
 const renderer = gl as WebGLRenderer;
 renderer.info.reset();

 // Trigger minor GC via allocation (browser hint)
 const arr = new Array(1000).fill(null);
 arr.length = 0;

 if (config.logging) {
 ErrorLogger.debug('GC hint requested', 'MemoryManagement');
 }
 }, [gl, config.logging]);

 // Cleanup all pools
 const cleanupPools = useCallback(() => {
 const pools = geometryPoolsRef.current;
 let disposed = 0;

 for (const [type, pool] of pools) {
 pool.forEach((item) => {
 if (!item.inUse) {
 item.resource.dispose();
 disposed++;
 }
 });
 pools.set(
 type,
 pool.filter((item) => item.inUse)
 );
 }

 if (config.logging) {
 ErrorLogger.debug(`Cleaned up ${disposed} pooled resources`, 'MemoryManagement');
 }
 }, [config.logging]);

 // Get pool statistics
 const getPoolStats = useCallback(() => {
 const pools = geometryPoolsRef.current;
 const result: Record<string, { total: number; inUse: number; available: number }> = {};

 for (const [type, pool] of pools) {
 const inUse = pool.filter((item) => item.inUse).length;
 result[type] = {
 total: pool.length,
 inUse,
 available: pool.length - inUse,
 };
 }

 return result;
 }, []);

 return {
 stats,
 status,
 disposeGeometry,
 disposeMaterial,
 disposeTexture,
 disposeObject,
 getPooledGeometry,
 returnToPool,
 requestGC,
 cleanupPools,
 getPoolStats,
 };
}

// ============================================================================
// Utility Functions
// ============================================================================








// Re-export utilities (moved to utils/memoryUtils.ts to satisfy hooks naming convention)
export { formatMemorySize, getMemoryStatusColor, calculateTextureMemory } from '@/utils/memoryUtils';

export default useMemoryManagement;
