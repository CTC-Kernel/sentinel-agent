/**
 * useExportCapture - Hook for capturing the Voxel canvas as an image
 *
 * Provides functionality to export the current 3D view as a PNG image.
 * Supports standard and high-resolution (2x) exports with optional watermark.
 *
 * @see Story VOX-9.7: Export View
 * @see FR51: Users can export the current view as an image
 */

import { useCallback, useState, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  /** Export filename (without extension) */
  filename?: string;
  /** High resolution export (2x scale) */
  highResolution?: boolean;
  /** Add watermark with user/date info */
  watermark?: WatermarkOptions;
  /** Image format */
  format?: 'png' | 'jpeg' | 'webp';
  /** JPEG/WebP quality (0-1) */
  quality?: number;
}

export interface WatermarkOptions {
  /** User name or identifier */
  user?: string;
  /** Organization name */
  organization?: string;
  /** Include timestamp */
  includeDate?: boolean;
  /** Custom text */
  customText?: string;
  /** Position */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface UseExportCaptureReturn {
  /** Capture and download the canvas as an image */
  exportImage: (options?: ExportOptions) => Promise<void>;
  /** Capture canvas and return as blob */
  captureBlob: (options?: Omit<ExportOptions, 'filename'>) => Promise<Blob>;
  /** Capture canvas and return as data URL */
  captureDataUrl: (options?: Omit<ExportOptions, 'filename'>) => Promise<string>;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Last export error, if any */
  error: Error | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FILENAME = 'voxel-export';
const DEFAULT_FORMAT = 'png';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate timestamp string for filename
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

/**
 * Apply watermark to canvas
 */
function applyWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WatermarkOptions
): void {
  const {
    user,
    organization,
    includeDate = true,
    customText,
    position = 'bottom-right',
  } = options;

  // Build watermark text
  const lines: string[] = [];
  if (customText) lines.push(customText);
  if (organization) lines.push(organization);
  if (user) lines.push(`By: ${user}`);
  if (includeDate) lines.push(new Date().toLocaleDateString());

  if (lines.length === 0) return;

  // Style settings
  const padding = 16;
  const fontSize = 12;
  const lineHeight = 16;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = position.includes('right') ? 'right' : 'left';

  // Calculate position
  let x: number;
  let y: number;

  switch (position) {
    case 'top-left':
      x = padding;
      y = padding + fontSize;
      break;
    case 'top-right':
      x = width - padding;
      y = padding + fontSize;
      break;
    case 'bottom-left':
      x = padding;
      y = height - padding - (lines.length - 1) * lineHeight;
      break;
    case 'bottom-right':
    default:
      x = width - padding;
      y = height - padding - (lines.length - 1) * lineHeight;
      break;
  }

  // Draw text with shadow for readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Get MIME type for format
 */
function getMimeType(format: 'png' | 'jpeg' | 'webp'): string {
  const mimeTypes = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return mimeTypes[format] || 'image/png';
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for capturing and exporting the Voxel 3D canvas as an image.
 *
 * Uses the Three.js renderer to capture the current scene and converts
 * it to a downloadable image file.
 *
 * @example
 * ```tsx
 * const { exportImage, isExporting } = useExportCapture();
 *
 * const handleExport = async () => {
 *   await exportImage({
 *     filename: 'risk-map',
 *     highResolution: true,
 *     watermark: {
 *       organization: 'Acme Corp',
 *       user: 'John Doe',
 *       includeDate: true,
 *     },
 *   });
 * };
 * ```
 */
export function useExportCapture(): UseExportCaptureReturn {
  const { gl, scene, camera, size } = useThree();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const exportingRef = useRef(false);

  /**
   * Capture the canvas and return as blob
   */
  const captureBlob = useCallback(
    async (options: Omit<ExportOptions, 'filename'> = {}): Promise<Blob> => {
      const { highResolution = false, watermark, format = DEFAULT_FORMAT, quality = 0.92 } = options;

      // Render the current scene
      gl.render(scene, camera);

      // Get the canvas
      const canvas = gl.domElement;

      // For high resolution, we need to render at 2x size
      if (highResolution) {
        const targetWidth = size.width * 2;
        const targetHeight = size.height * 2;

        // Create a new canvas at 2x size
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        const ctx = exportCanvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get 2D context for export');
        }

        // Draw the WebGL canvas scaled up
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

        // Apply watermark if requested
        if (watermark) {
          applyWatermark(ctx, targetWidth, targetHeight, watermark);
        }

        return new Promise((resolve, reject) => {
          exportCanvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to create blob'));
            },
            getMimeType(format),
            quality
          );
        });
      }

      // Standard resolution
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get 2D context for export');
      }

      ctx.drawImage(canvas, 0, 0);

      // Apply watermark if requested
      if (watermark) {
        applyWatermark(ctx, canvas.width, canvas.height, watermark);
      }

      return new Promise((resolve, reject) => {
        exportCanvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob'));
          },
          getMimeType(format),
          quality
        );
      });
    },
    [gl, scene, camera, size]
  );

  /**
   * Capture the canvas and return as data URL
   */
  const captureDataUrl = useCallback(
    async (options: Omit<ExportOptions, 'filename'> = {}): Promise<string> => {
      const blob = await captureBlob(options);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
      });
    },
    [captureBlob]
  );

  /**
   * Capture and download the image
   */
  const exportImage = useCallback(
    async (options: ExportOptions = {}): Promise<void> => {
      // Prevent concurrent exports
      if (exportingRef.current) return;

      exportingRef.current = true;
      setIsExporting(true);
      setError(null);

      try {
        const { filename = DEFAULT_FILENAME, format = DEFAULT_FORMAT, ...captureOptions } = options;

        const blob = await captureBlob({ format, ...captureOptions });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${getTimestamp()}.${format}`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(url);

        ErrorLogger.debug(`Export complete: ${link.download}`, 'useExportCapture.exportImage');
      } catch (err) {
        const exportError = err instanceof Error ? err : new Error('Export failed');
        setError(exportError);
        ErrorLogger.error(exportError, 'useExportCapture.exportImage');
        throw exportError;
      } finally {
        setIsExporting(false);
        exportingRef.current = false;
      }
    },
    [captureBlob]
  );

  return {
    exportImage,
    captureBlob,
    captureDataUrl,
    isExporting,
    error,
  };
}

export default useExportCapture;
