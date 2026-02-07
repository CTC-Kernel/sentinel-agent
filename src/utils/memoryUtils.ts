/**
 * Memory management utilities
 * 
 * Extracted from hooks/voxel/useMemoryManagement.ts
 * 
 * @module utils/memoryUtils
 */

/**
 * Format memory size for display
 */
export function formatMemorySize(mb: number): string {
 if (mb < 1) {
 return `${(mb * 1024).toFixed(0)} KB`;
 }
 if (mb >= 1024) {
 return `${(mb / 1024).toFixed(2)} GB`;
 }
 return `${mb.toFixed(1)} MB`;
}

/**
 * Get memory health color based on status
 */
export function getMemoryStatusColor(status: 'healthy' | 'warning' | 'critical'): string {
 switch (status) {
 case 'healthy':
 return '#22c55e';
 case 'warning':
 return '#f59e0b';
 case 'critical':
 return '#ef4444';
 default:
 return '#6b7280';
 }
}

/**
 * Calculate approximate texture memory usage
 */
export function calculateTextureMemory(
 width: number,
 height: number,
 hasAlpha: boolean,
 mipmaps: boolean
): number {
 const bytesPerPixel = hasAlpha ? 4 : 3;
 let bytes = width * height * bytesPerPixel;

 if (mipmaps) {
 bytes = Math.floor(bytes * 1.33);
 }

 return bytes / (1024 * 1024); // Convert to MB
}
