/**
 * VR Performance utilities
 * 
 * Extracted from hooks/voxel/useVRPerformance.ts
 * 
 * @module utils/vrPerformanceUtils
 */

export type VRPerformanceStatus = 'excellent' | 'good' | 'warning' | 'critical';

/**
 * Get color for performance status
 */
export function getVRPerformanceColor(status: VRPerformanceStatus): string {
 switch (status) {
 case 'excellent':
 return '#22c55e';
 case 'good':
 return '#84cc16';
 case 'warning':
 return '#f59e0b';
 case 'critical':
 return '#ef4444';
 }
}
