/**
 * Story 34.3 - VR Performance Monitoring Hook
 *
 * Monitors VR frame timing, provides auto-quality adjustment,
 * and warns about dropped frames to maintain VR comfort (72+ FPS target).
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export type VRQualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export type VRPerformanceStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface VRFrameStats {
 /** Current frames per second */
 fps: number;
 /** Average FPS over sample window */
 averageFPS: number;
 /** Minimum FPS in sample window */
 minFPS: number;
 /** Maximum FPS in sample window */
 maxFPS: number;
 /** Frame time in milliseconds */
 frameTimeMs: number;
 /** Average frame time in milliseconds */
 averageFrameTimeMs: number;
 /** Number of dropped frames detected */
 droppedFrames: number;
 /** Time since last dropped frame (ms) */
 timeSinceLastDrop: number;
 /** GPU frame time if available */
 gpuFrameTimeMs: number | null;
}

export interface VRQualitySettings {
 /** Current quality level */
 level: VRQualityLevel;
 /** Polygon reduction factor (0-1) */
 polygonBudget: number;
 /** Texture resolution multiplier */
 textureScale: number;
 /** Shadow quality (0 = off, 1 = low, 2 = medium, 3 = high) */
 shadowQuality: 0 | 1 | 2 | 3;
 /** Enable post-processing effects */
 enablePostProcessing: boolean;
 /** Enable antialiasing */
 enableAA: boolean;
 /** Draw distance multiplier */
 drawDistanceScale: number;
 /** Enable dynamic lighting */
 enableDynamicLights: boolean;
 /** Max simultaneous particle effects */
 maxParticles: number;
 /** LOD bias (lower = more aggressive LOD switching) */
 lodBias: number;
}

export interface UseVRPerformanceOptions {
 /** Target FPS (default: 72 for VR) */
 targetFPS?: number;
 /** Warning threshold FPS */
 warningFPS?: number;
 /** Critical threshold FPS */
 criticalFPS?: number;
 /** Enable auto quality adjustment */
 autoAdjustQuality?: boolean;
 /** Sample window size for averaging */
 sampleWindowSize?: number;
 /** Callback when dropped frames detected */
 onDroppedFrames?: (count: number, stats: VRFrameStats) => void;
 /** Callback when quality is auto-adjusted */
 onQualityAdjusted?: (oldLevel: VRQualityLevel, newLevel: VRQualityLevel) => void;
 /** Callback when status changes */
 onStatusChange?: (status: VRPerformanceStatus) => void;
 /** Enable logging */
 logging?: boolean;
}

export interface UseVRPerformanceReturn {
 /** Current frame statistics */
 stats: VRFrameStats;
 /** Current performance status */
 status: VRPerformanceStatus;
 /** Current quality settings */
 qualitySettings: VRQualitySettings;
 /** Current quality level */
 qualityLevel: VRQualityLevel;
 /** Manually set quality level */
 setQualityLevel: (level: VRQualityLevel) => void;
 /** Reset quality to default */
 resetQuality: () => void;
 /** Force quality recalculation */
 recalculateQuality: () => void;
 /** Whether performance is acceptable for VR */
 isVRReady: boolean;
 /** Recommendation message */
 recommendation: string;
 /** Raw frame times for advanced debugging */
 frameHistory: number[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TARGET_FPS = 72;
const DEFAULT_WARNING_FPS = 60;
const DEFAULT_CRITICAL_FPS = 45;
const DEFAULT_SAMPLE_SIZE = 60;

// VR refresh rates for different headsets
const VR_REFRESH_RATES = {
 quest2: 72, // or 90, 120
 quest3: 72, // or 90, 120
 visionPro: 90, // or 96, 100
 psvr2: 90, // or 120
 generic: 72,
};

// Quality presets
const QUALITY_PRESETS: Record<VRQualityLevel, VRQualitySettings> = {
 low: {
 level: 'low',
 polygonBudget: 0.25,
 textureScale: 0.5,
 shadowQuality: 0,
 enablePostProcessing: false,
 enableAA: false,
 drawDistanceScale: 0.5,
 enableDynamicLights: false,
 maxParticles: 100,
 lodBias: 0.5,
 },
 medium: {
 level: 'medium',
 polygonBudget: 0.5,
 textureScale: 0.75,
 shadowQuality: 1,
 enablePostProcessing: false,
 enableAA: true,
 drawDistanceScale: 0.75,
 enableDynamicLights: true,
 maxParticles: 500,
 lodBias: 0.75,
 },
 high: {
 level: 'high',
 polygonBudget: 0.8,
 textureScale: 1,
 shadowQuality: 2,
 enablePostProcessing: true,
 enableAA: true,
 drawDistanceScale: 1,
 enableDynamicLights: true,
 maxParticles: 1000,
 lodBias: 1,
 },
 ultra: {
 level: 'ultra',
 polygonBudget: 1,
 textureScale: 1,
 shadowQuality: 3,
 enablePostProcessing: true,
 enableAA: true,
 drawDistanceScale: 1.5,
 enableDynamicLights: true,
 maxParticles: 2000,
 lodBias: 1.5,
 },
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateStatus(fps: number, targetFPS: number, warningFPS: number, criticalFPS: number): VRPerformanceStatus {
 if (fps >= targetFPS) return 'excellent';
 if (fps >= warningFPS) return 'good';
 if (fps >= criticalFPS) return 'warning';
 return 'critical';
}

function getRecommendation(status: VRPerformanceStatus, qualityLevel: VRQualityLevel, stats: VRFrameStats): string {
 switch (status) {
 case 'excellent':
 return qualityLevel !== 'ultra'
 ? 'Performance is excellent. You can try increasing quality.'
 : 'Performance is excellent at maximum quality.';
 case 'good':
 return 'Performance is good. VR experience should be comfortable.';
 case 'warning':
 return `Performance is below target (${stats.averageFPS.toFixed(0)} FPS). Consider reducing quality or scene complexity.`;
 case 'critical':
 return `Performance is critical (${stats.averageFPS.toFixed(0)} FPS). Reduce quality immediately to avoid VR discomfort.`;
 }
}

function selectOptimalQuality(fps: number, currentLevel: VRQualityLevel, targetFPS: number): VRQualityLevel {
 const levels: VRQualityLevel[] = ['low', 'medium', 'high', 'ultra'];
 const currentIndex = levels.indexOf(currentLevel);

 // Need to decrease quality
 if (fps < targetFPS * 0.9 && currentIndex > 0) {
 return levels[currentIndex - 1];
 }

 // Can increase quality
 if (fps > targetFPS * 1.15 && currentIndex < levels.length - 1) {
 return levels[currentIndex + 1];
 }

 return currentLevel;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useVRPerformance(options: UseVRPerformanceOptions = {}): UseVRPerformanceReturn {
 const {
 targetFPS = DEFAULT_TARGET_FPS,
 warningFPS = DEFAULT_WARNING_FPS,
 criticalFPS = DEFAULT_CRITICAL_FPS,
 autoAdjustQuality = true,
 sampleWindowSize = DEFAULT_SAMPLE_SIZE,
 onDroppedFrames,
 onQualityAdjusted,
 onStatusChange,
 logging = false,
 } = options;

 useThree();

 // State
 const [qualityLevel, setQualityLevel] = useState<VRQualityLevel>('high');
 const [status, setStatus] = useState<VRPerformanceStatus>('good');
 const [stats, setStats] = useState<VRFrameStats>({
 fps: targetFPS,
 averageFPS: targetFPS,
 minFPS: targetFPS,
 maxFPS: targetFPS,
 frameTimeMs: 1000 / targetFPS,
 averageFrameTimeMs: 1000 / targetFPS,
 droppedFrames: 0,
 timeSinceLastDrop: Infinity,
 gpuFrameTimeMs: null,
 });
 const [frameHistory, setFrameHistory] = useState<number[]>([]);

 // Refs for frame timing
 // Refs for frame timing
 const frameTimesRef = useRef<number[]>([]);
 const lastFrameTimeRef = useRef(0);
 const lastDropTimeRef = useRef(0);
 const droppedFramesRef = useRef(0);
 const lastUpdateRef = useRef(0);
 const lastQualityCheckRef = useRef(0);
 const lastStatusRef = useRef<VRPerformanceStatus>('good');

 useEffect(() => {
 const now = performance.now();
 lastFrameTimeRef.current = now;
 lastUpdateRef.current = now;
 lastQualityCheckRef.current = now;
 }, []);

 // Frame update
 useFrame(() => {
 const now = performance.now();
 const delta = now - lastFrameTimeRef.current;
 lastFrameTimeRef.current = now;

 // Calculate FPS from frame time
 const fps = delta > 0 ? 1000 / delta : targetFPS;
 frameTimesRef.current.push(delta);

 // Keep only the sample window
 if (frameTimesRef.current.length > sampleWindowSize) {
 frameTimesRef.current.shift();
 }

 // Detect dropped frames (frame took more than 1.5x the target)
 const targetFrameTime = 1000 / targetFPS;
 if (delta > targetFrameTime * 1.5) {
 droppedFramesRef.current++;
 lastDropTimeRef.current = now;

 if (logging) {
 ErrorLogger.warn(`Dropped frame detected: ${delta.toFixed(2)}ms (target: ${targetFrameTime.toFixed(2)}ms)`, 'VRPerformance');
 }
 }

 // Update stats at lower frequency (10Hz)
 if (now - lastUpdateRef.current >= 100) {
 lastUpdateRef.current = now;

 const frameTimes = frameTimesRef.current;
 const fpsValues = frameTimes.map((t) => (t > 0 ? 1000 / t : targetFPS));

 const currentFPS = fps;
 const avgFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
 const minFPS = Math.min(...fpsValues);
 const maxFPS = Math.max(...fpsValues);
 const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

 const newStats: VRFrameStats = {
 fps: currentFPS,
 averageFPS: avgFPS,
 minFPS,
 maxFPS,
 frameTimeMs: delta,
 averageFrameTimeMs: avgFrameTime,
 droppedFrames: droppedFramesRef.current,
 timeSinceLastDrop: now - lastDropTimeRef.current,
 gpuFrameTimeMs: null, // Would need WebGL timer queries for accurate GPU timing
 };

 setStats(newStats);
 setFrameHistory([...frameTimesRef.current]);

 // Update status
 const newStatus = calculateStatus(avgFPS, targetFPS, warningFPS, criticalFPS);
 if (newStatus !== lastStatusRef.current) {
 lastStatusRef.current = newStatus;
 setStatus(newStatus);
 onStatusChange?.(newStatus);
 }

 // Notify about dropped frames
 if (droppedFramesRef.current > 0 && newStats.timeSinceLastDrop < 1000) {
 onDroppedFrames?.(droppedFramesRef.current, newStats);
 }

 // Reset dropped frames counter periodically
 if (newStats.timeSinceLastDrop > 5000) {
 droppedFramesRef.current = 0;
 }
 }

 // Auto-adjust quality (check every 2 seconds)
 if (autoAdjustQuality && now - lastQualityCheckRef.current >= 2000) {
 lastQualityCheckRef.current = now;

 const avgFPS = frameTimesRef.current.length > 0
 ? frameTimesRef.current.map((t) => 1000 / t).reduce((a, b) => a + b, 0) / frameTimesRef.current.length
 : targetFPS;

 const optimalLevel = selectOptimalQuality(avgFPS, qualityLevel, targetFPS);

 if (optimalLevel !== qualityLevel) {
 if (logging) {
 ErrorLogger.debug(`Auto-adjusting quality: ${qualityLevel} -> ${optimalLevel}`, 'VRPerformance');
 }
 onQualityAdjusted?.(qualityLevel, optimalLevel);
 setQualityLevel(optimalLevel);
 }
 }
 });

 // Quality settings based on current level
 const qualitySettings = useMemo(() => QUALITY_PRESETS[qualityLevel], [qualityLevel]);

 // Manual quality control
 const handleSetQualityLevel = useCallback((level: VRQualityLevel) => {
 const oldLevel = qualityLevel;
 setQualityLevel(level);
 if (level !== oldLevel) {
 onQualityAdjusted?.(oldLevel, level);
 }
 }, [qualityLevel, onQualityAdjusted]);

 const resetQuality = useCallback(() => {
 handleSetQualityLevel('high');
 }, [handleSetQualityLevel]);

 const recalculateQuality = useCallback(() => {
 const avgFPS = frameTimesRef.current.length > 0
 ? frameTimesRef.current.map((t) => 1000 / t).reduce((a, b) => a + b, 0) / frameTimesRef.current.length
 : targetFPS;

 const optimalLevel = selectOptimalQuality(avgFPS, qualityLevel, targetFPS);
 if (optimalLevel !== qualityLevel) {
 handleSetQualityLevel(optimalLevel);
 }
 }, [qualityLevel, targetFPS, handleSetQualityLevel]);

 // Derived values
 const isVRReady = stats.averageFPS >= criticalFPS;
 const recommendation = useMemo(
 () => getRecommendation(status, qualityLevel, stats),
 [status, qualityLevel, stats]
 );
 // useMemo removed - frameHistory state updated in setStats
 // But wait, the hook returns frameHistory.
 // I need to add frameHistory to state definition.

 return {
 stats,
 status,
 qualitySettings,
 qualityLevel,
 setQualityLevel: handleSetQualityLevel,
 resetQuality,
 recalculateQuality,
 isVRReady,
 recommendation,
 frameHistory,
 };
}

// ============================================================================
// Utility Functions
// ============================================================================

// Re-export utility (moved to utils/vrPerformanceUtils.ts to satisfy hooks naming convention)
export { getVRPerformanceColor } from '@/utils/vrPerformanceUtils';

/**
 * Format frame time for display
 */
function formatFrameTime(ms: number): string {
 return `${ms.toFixed(2)}ms`;
}

/**
 * Calculate headroom percentage (how much buffer before target)
 */
function calculateHeadroom(currentFPS: number, targetFPS: number): number {
 return Math.max(0, ((currentFPS - targetFPS) / targetFPS) * 100);
}

export default useVRPerformance;
