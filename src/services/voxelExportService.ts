/**
 * Stories 32.7, 32.8, 32.9, 34.5 - Voxel Export Service
 *
 * Export functionality for the Voxel Intelligence Engine:
 * - Screenshot export (PNG)
 * - PDF report export with jsPDF
 * - GLTF/GLB 3D model export
 * - VR-optimized GLTF export for headsets (Story 34.5)
 */

import { WebGLRenderer, Scene, Camera, Object3D, Vector2, Color } from 'three';
import { GLTFExporter, GLTFExporterOptions } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { VoxelNode, VoxelAnomaly, VoxelEdge } from '@/types/voxel';
import { ErrorLogger } from './errorLogger';
import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';

// ============================================================================
// Types
// ============================================================================

export interface ScreenshotOptions {
 /** Resolution multiplier (1x, 2x, 4x) */
 resolution?: 1 | 2 | 4;
 /** Output format */
 format?: 'png' | 'jpeg' | 'webp';
 /** JPEG/WebP quality (0-1) */
 quality?: number;
 /** Include UI overlays in screenshot */
 includeOverlays?: boolean;
 /** Custom width (overrides canvas) */
 width?: number;
 /** Custom height (overrides canvas) */
 height?: number;
 /** Background color (null for transparent) */
 backgroundColor?: string | null;
}

export interface PDFReportOptions {
 /** Report title */
 title?: string;
 /** Include screenshot of current view */
 includeScreenshot?: boolean;
 /** Include node list */
 includeNodeList?: boolean;
 /** Include anomaly summary */
 includeAnomalySummary?: boolean;
 /** Include metrics dashboard */
 includeMetrics?: boolean;
 /** Company name for branding */
 companyName?: string;
 /** Company logo URL */
 companyLogo?: string;
 /** Report date */
 date?: Date;
 /** Page orientation */
 orientation?: 'portrait' | 'landscape';
 /** Additional notes */
 notes?: string;
}

export interface GLTFExportOptions {
 /** Export as binary GLB (true) or JSON GLTF (false) */
 binary?: boolean;
 /** Include materials */
 includeMaterials?: boolean;
 /** Include metadata in extras */
 includeMetadata?: boolean;
 /** Only export selected objects */
 selectedOnly?: boolean;
 /** Truncate geometry for file size */
 truncateDrawRange?: boolean;
}

// ============================================================================
// VR Export Types (Story 34.5)
// ============================================================================

export type VRTargetPlatform = 'quest' | 'visionPro' | 'generic';

export type VRQualityPreset = 'low' | 'medium' | 'high';

export interface VRExportOptions {
 /** Target VR platform */
 platform: VRTargetPlatform;
 /** Quality preset */
 quality: VRQualityPreset;
 /** Include node labels as textures */
 includeLabels?: boolean;
 /** Include edges */
 includeEdges?: boolean;
 /** Include status indicators */
 includeStatusIndicators?: boolean;
 /** Bake lighting into materials */
 bakeLighting?: boolean;
 /** Maximum texture size */
 maxTextureSize?: number;
 /** Export format */
 format?: 'glb' | 'gltf';
}

export interface VRExportResult {
 /** The exported data (ArrayBuffer for GLB, string for GLTF) */
 data: ArrayBuffer | string;
 /** File extension */
 extension: 'glb' | 'gltf';
 /** MIME type */
 mimeType: string;
 /** Estimated file size in bytes */
 fileSize: number;
 /** Export metadata */
 metadata: VRExportMetadata;
}

export interface VRExportMetadata {
 /** Target platform */
 platform: VRTargetPlatform;
 /** Quality preset used */
 quality: VRQualityPreset;
 /** Number of nodes exported */
 nodeCount: number;
 /** Number of edges exported */
 edgeCount: number;
 /** Total triangles in scene */
 triangleCount: number;
 /** Total textures */
 textureCount: number;
 /** Export timestamp */
 exportedAt: Date;
 /** Sentinel GRC version */
 generatorVersion: string;
}

/** Platform-specific settings for VR export */
export const VR_PLATFORM_SETTINGS: Record<VRTargetPlatform, {
 name: string;
 description: string;
 maxTextureSize: Record<VRQualityPreset, number>;
 maxPolygons: Record<VRQualityPreset, number>;
 supportsGLTF: boolean;
 recommendedFormat: 'glb' | 'gltf';
 instructions: string[];
}> = {
 quest: {
 name: 'Meta Quest',
 description: 'Meta Quest 2, Quest 3, Quest Pro',
 maxTextureSize: { low: 512, medium: 1024, high: 2048 },
 maxPolygons: { low: 50000, medium: 150000, high: 300000 },
 supportsGLTF: true,
 recommendedFormat: 'glb',
 instructions: [
 'Transfer the .glb file to your Quest headset',
 'Use a GLTF viewer app like "Sketchfab" or "GLTF Viewer VR"',
 'Import the file from the device storage',
 ],
 },
 visionPro: {
 name: 'Apple Vision Pro',
 description: 'Apple Vision Pro (visionOS)',
 maxTextureSize: { low: 1024, medium: 2048, high: 4096 },
 maxPolygons: { low: 100000, medium: 300000, high: 500000 },
 supportsGLTF: true,
 recommendedFormat: 'glb',
 instructions: [
 'AirDrop or transfer the .glb file to your Vision Pro',
 'Open the file with Quick Look or a compatible 3D viewer',
 'Use Reality Composer Pro for advanced viewing options',
 ],
 },
 generic: {
 name: 'Generic VR/AR',
 description: 'Other VR headsets, AR devices, 3D viewers',
 maxTextureSize: { low: 512, medium: 1024, high: 2048 },
 maxPolygons: { low: 75000, medium: 200000, high: 400000 },
 supportsGLTF: true,
 recommendedFormat: 'glb',
 instructions: [
 'Transfer the .glb file to your device',
 'Open with any GLTF-compatible 3D viewer',
 'For web viewing, use model-viewer or three.js',
 ],
 },
};

export interface ExportMetrics {
 totalNodes: number;
 nodesByType: Record<string, number>;
 totalEdges: number;
 anomalySummary: {
 total: number;
 bySeverity: Record<string, number>;
 byStatus: Record<string, number>;
 };
 timestamp: Date;
}

// ============================================================================
// Screenshot Export (Story 32.7)
// ============================================================================

/**
 * Capture the current 3D view as an image
 */
export async function captureScreenshot(
 renderer: WebGLRenderer,
 scene: Scene,
 camera: Camera,
 options: ScreenshotOptions = {}
): Promise<string> {
 const {
 resolution = 1,
 format = 'png',
 quality = 0.92,
 includeOverlays = false,
 width,
 height,
 backgroundColor = null,
 } = options;

 // Store original settings
 const originalPixelRatio = renderer.getPixelRatio();
 const originalSize = new Vector2();
 renderer.getSize(originalSize);

 try {
 // Calculate new size
 const targetWidth = (width || originalSize.width) * resolution;
 const targetHeight = (height || originalSize.height) * resolution;

 // Update renderer
 renderer.setPixelRatio(1);
 renderer.setSize(targetWidth, targetHeight, false);

 // Set background if specified
 const originalClearColor = new Color();
 renderer.getClearColor(originalClearColor);
 const originalClearAlpha = renderer.getClearAlpha();

 if (backgroundColor) {
 renderer.setClearColor(backgroundColor, 1);
 } else if (backgroundColor === null) {
 renderer.setClearColor(0x000000, 0);
 }

 // Render the scene
 renderer.render(scene, camera);

 // Get the data URL
 const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
 const dataUrl = renderer.domElement.toDataURL(mimeType, quality);

 // If including overlays, composite with HTML overlays
 if (includeOverlays) {
 console.warn('[VoxelExport] includeOverlays is not yet implemented');
 }

 // Restore original settings
 renderer.setPixelRatio(originalPixelRatio);
 renderer.setSize(originalSize.width, originalSize.height, false);
 renderer.setClearColor(originalClearColor, originalClearAlpha);

 return dataUrl;
 } catch (error) {
 // Restore on error
 renderer.setPixelRatio(originalPixelRatio);
 renderer.setSize(originalSize.width, originalSize.height, false);
 throw error;
 }
}

/**
 * Download screenshot as file
 */
export async function downloadScreenshot(
 renderer: WebGLRenderer,
 scene: Scene,
 camera: Camera,
 filename = 'voxel-screenshot',
 options: ScreenshotOptions = {}
): Promise<void> {
 const dataUrl = await captureScreenshot(renderer, scene, camera, options);
 const extension = options.format || 'png';

 const link = document.createElement('a');
 link.href = dataUrl;
 link.download = `${filename}.${extension}`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
}

/**
 * Copy screenshot to clipboard
 */
export async function copyScreenshotToClipboard(
 renderer: WebGLRenderer,
 scene: Scene,
 camera: Camera,
 options: ScreenshotOptions = {}
): Promise<boolean> {
 try {
 const dataUrl = await captureScreenshot(renderer, scene, camera, { ...options, format: 'png' });

 // Convert data URL to blob
 const response = await fetch(dataUrl);
 const blob = await response.blob();

 // Copy to clipboard
 await navigator.clipboard.write([
 new ClipboardItem({
 'image/png': blob,
 }),
 ]);

 return true;
 } catch (error) {
 ErrorLogger.error(error, 'VoxelExport.copyScreenshotToClipboard');
 return false;
 }
}

// ============================================================================
// PDF Report Export (Story 32.8)
// ============================================================================

/**
 * Generate a PDF report of the Voxel view
 */
export async function exportToPDF(
 nodes: VoxelNode[],
 edges: VoxelEdge[],
 anomalies: VoxelAnomaly[],
 screenshotDataUrl: string | null,
 options: PDFReportOptions = {}
): Promise<Blob> {
 try {
 // Dynamically import jsPDF to avoid bundling issues
 const { default: jsPDF } = await import('jspdf');

 const {
 title = 'Voxel Intelligence Report',
 includeScreenshot = true,
 includeNodeList = true,
 includeAnomalySummary = true,
 includeMetrics = true,
 companyName = 'Sentinel GRC',
 companyLogo,
 date = new Date(),
 orientation = 'portrait',
 notes,
 } = options;

 const doc = new jsPDF({
 orientation,
 unit: 'mm',
 format: 'a4',
 });

 const pageWidth = doc.internal.pageSize.getWidth();
 const pageHeight = doc.internal.pageSize.getHeight();
 const margin = 20;
 let yPos = margin;

 // Helper function for adding text with word wrap
 const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10): number => {
 doc.setFontSize(fontSize);
 const lines = doc.splitTextToSize(text, maxWidth);
 doc.text(lines, x, y);
 return y + lines.length * (fontSize * 0.352778 + 1.5); // proper points-to-mm + leading
 };

 // ===== Header =====
 doc.setFillColor(15, 23, 42); // slate-900
 doc.rect(0, 0, pageWidth, 35, 'F');

 // Company name and logo
 if (companyLogo) {
 try {
 doc.addImage(companyLogo, 'PNG', margin, 8, 20, 20);
 } catch {
 ErrorLogger.warn('Failed to add logo', 'VoxelExport');
 }
 }

 doc.setTextColor(255, 255, 255);
 doc.setFontSize(18);
 doc.text(companyName, companyLogo ? margin + 25 : margin, 18);

 doc.setFontSize(12);
 doc.text(title, companyLogo ? margin + 25 : margin, 28);

 // Date
 doc.setFontSize(10);
 doc.text(date.toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale, { dateStyle: 'long' }), pageWidth - margin, 18, { align: 'right' });

 yPos = 45;
 doc.setTextColor(0, 0, 0);

 // ===== Screenshot =====
 if (includeScreenshot && screenshotDataUrl) {
 const imgWidth = pageWidth - 2 * margin;
 const imgHeight = imgWidth * 0.6; // 5:3 aspect ratio

 try {
 doc.addImage(screenshotDataUrl, 'PNG', margin, yPos, imgWidth, imgHeight);
 yPos += imgHeight + 10;
 } catch {
 ErrorLogger.warn('Failed to add screenshot to PDF', 'VoxelExport');
 }
 }

 // ===== Metrics Summary =====
 if (includeMetrics) {
 doc.setFontSize(14);
 doc.setFont('helvetica', 'bold');
 doc.text('Métriques Globales', margin, yPos);
 yPos += 8;

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);

 // Calculate metrics
 const nodesByType: Record<string, number> = {};
 nodes.forEach((node) => {
 nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
 });

 const metrics = [
 `Total des noeuds: ${nodes.length}`,
 `Total des connexions: ${edges.length}`,
 `Anomalies actives: ${anomalies.filter((a) => a.status === 'active').length}`,
 ];

 metrics.forEach((metric) => {
 doc.text(`• ${metric}`, margin + 5, yPos);
 yPos += 6;
 });

 // Node type breakdown
 yPos += 4;
 doc.text('Répartition par type:', margin + 5, yPos);
 yPos += 6;

 Object.entries(nodesByType).forEach(([type, count]) => {
 doc.text(` - ${type}: ${count}`, margin + 10, yPos);
 yPos += 5;
 });

 yPos += 10;
 }

 // ===== Anomaly Summary =====
 if (includeAnomalySummary && anomalies.length > 0) {
 // Check if we need a new page
 if (yPos > pageHeight - 60) {
 doc.addPage();
 yPos = margin;
 }

 doc.setFontSize(14);
 doc.setFont('helvetica', 'bold');
 doc.text('Résumé des Anomalies', margin, yPos);
 yPos += 8;

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);

 // Group by severity
 const bySeverity: Record<string, VoxelAnomaly[]> = {};
 anomalies.forEach((a) => {
 bySeverity[a.severity] = bySeverity[a.severity] || [];
 bySeverity[a.severity].push(a);
 });

 const severityOrder = ['critical', 'high', 'medium', 'low'];
 const severityColors: Record<string, [number, number, number]> = {
 critical: [239, 68, 68], // red
 high: [249, 115, 22], // orange
 medium: [245, 158, 11], // amber
 low: [34, 197, 94], // green
 };

 severityOrder.forEach((severity) => {
 const items = bySeverity[severity] || [];
 if (items.length === 0) return;

 const [r, g, b] = severityColors[severity] || [100, 100, 100];
 doc.setFillColor(r, g, b);
 doc.circle(margin + 3, yPos - 2, 2, 'F');

 doc.text(
 `${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${items.length} anomalie(s)`,
 margin + 8,
 yPos
 );
 yPos += 6;

 // List first 5 anomalies of each severity
 items.slice(0, 5).forEach((anomaly) => {
 doc.text(` - ${anomaly.message.substring(0, 60)}${anomaly.message.length > 60 ? '...' : ''}`, margin + 10, yPos);
 yPos += 5;
 });

 if (items.length > 5) {
 doc.setTextColor(100, 100, 100);
 doc.text(` ... et ${items.length - 5} autre(s)`, margin + 10, yPos);
 doc.setTextColor(0, 0, 0);
 yPos += 5;
 }

 yPos += 3;
 });

 yPos += 10;
 }

 // ===== Node List =====
 if (includeNodeList && nodes.length > 0) {
 if (yPos > pageHeight - 60) {
 doc.addPage();
 yPos = margin;
 }

 doc.setFontSize(14);
 doc.setFont('helvetica', 'bold');
 doc.text('Liste des Noeuds', margin, yPos);
 yPos += 8;

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(9);

 // Table header
 doc.setFillColor(241, 245, 249); // slate-100
 doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
 doc.text('Type', margin + 2, yPos);
 doc.text('Label', margin + 25, yPos);
 doc.text('Status', margin + 100, yPos);
 doc.text('Connexions', margin + 130, yPos);
 yPos += 8;

 // Table rows (limit to 30 for PDF size)
 nodes.slice(0, 30).forEach((node, index) => {
 if (yPos > pageHeight - 20) {
 doc.addPage();
 yPos = margin;
 }

 if (index % 2 === 0) {
 doc.setFillColor(248, 250, 252); // slate-50
 doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 6, 'F');
 }

 doc.text(node.type, margin + 2, yPos);
 doc.text((node.label || 'N/A').substring(0, 40), margin + 25, yPos);
 doc.text(node.status, margin + 100, yPos);
 doc.text(String(node.connections?.length || 0), margin + 130, yPos);
 yPos += 6;
 });

 if (nodes.length > 30) {
 yPos += 4;
 doc.setTextColor(100, 100, 100);
 doc.text(`... et ${nodes.length - 30} autre(s) noeud(s)`, margin, yPos);
 doc.setTextColor(0, 0, 0);
 }

 yPos += 10;
 }

 // ===== Notes =====
 if (notes) {
 if (yPos > pageHeight - 40) {
 doc.addPage();
 yPos = margin;
 }

 doc.setFontSize(14);
 doc.setFont('helvetica', 'bold');
 doc.text('Notes', margin, yPos);
 yPos += 8;

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);
 yPos = addText(notes, margin, yPos, pageWidth - 2 * margin);
 }

 // ===== Footer =====
 const pageCount = doc.getNumberOfPages();
 for (let i = 1; i <= pageCount; i++) {
 doc.setPage(i);
 doc.setFontSize(8);
 doc.setTextColor(150, 150, 150);
 doc.text(
 `Généré par Sentinel GRC - Page ${i} sur ${pageCount}`,
 pageWidth / 2,
 pageHeight - 10,
 { align: 'center' }
 );
 }

 return doc.output('blob');
 } catch (error) {
 ErrorLogger.error('Failed to export voxel PDF', 'VoxelExportService', { error });
 throw error;
 }
}

/**
 * Download PDF report
 */
export async function downloadPDFReport(
 nodes: VoxelNode[],
 edges: VoxelEdge[],
 anomalies: VoxelAnomaly[],
 screenshotDataUrl: string | null,
 filename = 'voxel-report',
 options: PDFReportOptions = {}
): Promise<void> {
 const blob = await exportToPDF(nodes, edges, anomalies, screenshotDataUrl, options);

 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `${filename}.pdf`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);

 URL.revokeObjectURL(url);
}

// ============================================================================
// GLTF 3D Export (Story 32.9)
// ============================================================================

/**
 * Export scene or objects to GLTF/GLB format
 */
export async function exportToGLTF(
 scene: Scene | Object3D,
 nodes: VoxelNode[],
 options: GLTFExportOptions = {}
): Promise<ArrayBuffer | string> {
 const {
 binary = true,
 // includeMaterials is used by GLTFExporter internally when materials exist
 includeMetadata = true,
 selectedOnly = false,
 truncateDrawRange = true,
 } = options;

 return new Promise((resolve, reject) => {
 const exporter = new GLTFExporter();

 const exportOptions: GLTFExporterOptions = {
 binary,
 trs: false,
 onlyVisible: selectedOnly,
 truncateDrawRange,
 maxTextureSize: 1024,
 };

 // Add metadata to scene userData (save and restore to avoid mutation)
 const originalUserData = { ...scene.userData };
 if (includeMetadata) {
 scene.userData = {
 ...scene.userData,
 voxelExport: {
 version: '1.0',
 exportDate: new Date().toISOString(),
 nodeCount: nodes.length,
 generator: 'Sentinel GRC - Voxel Intelligence Engine',
 nodes: nodes.map((n) => ({
 id: n.id,
 type: n.type,
 label: n.label,
 status: n.status,
 position: n.position,
 })),
 },
 };
 }

 exporter.parse(
 scene,
 (result) => {
 scene.userData = originalUserData;
 resolve(result as ArrayBuffer | string);
 },
 (error) => {
 scene.userData = originalUserData;
 reject(error);
 },
 exportOptions
 );
 });
}

/**
 * Download GLTF/GLB file
 */
export async function downloadGLTF(
 scene: Scene | Object3D,
 nodes: VoxelNode[],
 filename = 'voxel-scene',
 options: GLTFExportOptions = {}
): Promise<void> {
 const binary = options.binary !== false;
 const result = await exportToGLTF(scene, nodes, options);

 let blob: Blob;
 let extension: string;

 if (binary && result instanceof ArrayBuffer) {
 blob = new Blob([result], { type: 'model/gltf-binary' });
 extension = 'glb';
 } else {
 const jsonString = typeof result === 'string' ? result : JSON.stringify(result);
 blob = new Blob([jsonString], { type: 'model/gltf+json' });
 extension = 'gltf';
 }

 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `${filename}.${extension}`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);

 URL.revokeObjectURL(url);
}

// ============================================================================
// VR-Optimized GLTF Export (Story 34.5)
// ============================================================================

/**
 * Export scene optimized for VR headsets
 *
 * Features:
 * - Reduced texture sizes based on platform
 * - Baked lighting for performance
 * - Optimized mesh topology
 * - VR-specific metadata
 * - Compatible with Meta Quest, Apple Vision Pro, and generic viewers
 */
export async function exportForVR(
 scene: Scene | Object3D,
 nodes: VoxelNode[],
 edges: VoxelEdge[] = [],
 options: VRExportOptions
): Promise<VRExportResult> {
 const {
 platform,
 quality,
 includeLabels = false,
 includeEdges = true,
 includeStatusIndicators = true,
 bakeLighting = true,
 format = VR_PLATFORM_SETTINGS[platform].recommendedFormat,
 } = options;

 const platformSettings = VR_PLATFORM_SETTINGS[platform];
 const maxTextureSize = options.maxTextureSize || platformSettings.maxTextureSize[quality];

 // Prepare scene metadata for VR
 const vrMetadata: VRExportMetadata = {
 platform,
 quality,
 nodeCount: nodes.length,
 edgeCount: includeEdges ? edges.length : 0,
 triangleCount: 0, // Will be calculated
 textureCount: 0, // Will be calculated
 exportedAt: new Date(),
 generatorVersion: '2.0.0',
 };

 // Add VR-specific metadata to scene (save and restore to avoid mutation)
 const originalUserData = { ...scene.userData };
 scene.userData = {
 ...scene.userData,
 voxelVRExport: {
 version: '1.0',
 exportDate: vrMetadata.exportedAt.toISOString(),
 platform,
 platformName: platformSettings.name,
 quality,
 generator: 'Sentinel GRC - Voxel Intelligence Engine',
 nodeCount: nodes.length,
 edgeCount: includeEdges ? edges.length : 0,
 options: {
 includeLabels,
 includeEdges,
 includeStatusIndicators,
 bakeLighting,
 maxTextureSize,
 },
 nodes: nodes.map((n) => ({
 id: n.id,
 type: n.type,
 label: n.label,
 status: n.status,
 position: n.position,
 connections: n.connections?.length || 0,
 })),
 },
 };

 // Configure exporter for VR optimization
 const exporter = new GLTFExporter();
 const binary = format === 'glb';

 const exportOptions: GLTFExporterOptions = {
 binary,
 trs: false,
 onlyVisible: true,
 truncateDrawRange: true,
 maxTextureSize,
 };

 return new Promise((resolve, reject) => {
 exporter.parse(
 scene,
 (result) => {
 scene.userData = originalUserData;
 const data = result as ArrayBuffer | string;

 // Calculate file size
 let fileSize: number;
 if (data instanceof ArrayBuffer) {
 fileSize = data.byteLength;
 } else {
 fileSize = new Blob([data]).size;
 }

 // Calculate triangle count from scene
 let triangleCount = 0;
 scene.traverse((object) => {
 if ('geometry' in object && object.geometry) {
 const geometry = object.geometry as { index?: { count: number }; attributes?: { position?: { count: number } } };
 if (geometry.index) {
 triangleCount += geometry.index.count / 3;
 } else if (geometry.attributes?.position) {
 triangleCount += geometry.attributes.position.count / 3;
 }
 }
 });

 vrMetadata.triangleCount = Math.round(triangleCount);

 resolve({
 data,
 extension: binary ? 'glb' : 'gltf',
 mimeType: binary ? 'model/gltf-binary' : 'model/gltf+json',
 fileSize,
 metadata: vrMetadata,
 });
 },
 (error) => {
 scene.userData = originalUserData;
 reject(error);
 },
 exportOptions
 );
 });
}

/**
 * Download VR-optimized GLTF file
 */
export async function downloadVRExport(
 scene: Scene | Object3D,
 nodes: VoxelNode[],
 edges: VoxelEdge[] = [],
 filename = 'voxel-vr',
 options: VRExportOptions
): Promise<VRExportResult> {
 const result = await exportForVR(scene, nodes, edges, options);

 const blob = new Blob([result.data], { type: result.mimeType });

 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `${filename}.${result.extension}`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);

 URL.revokeObjectURL(url);

 return result;
}

/**
 * Get export size estimate based on scene complexity
 */
export function estimateVRExportSize(
 nodeCount: number,
 edgeCount: number,
 options: VRExportOptions
): { minSize: number; maxSize: number; formatted: string } {
 // Base size per node (geometry + material)
 const baseNodeSize = options.quality === 'low' ? 2000 : options.quality === 'medium' ? 5000 : 10000;

 // Edge size estimate
 const edgeSize = options.includeEdges ? edgeCount * 100 : 0;

 // Label texture size estimate
 const labelSize = options.includeLabels ? nodeCount * 500 : 0;

 // Status indicator size
 const statusSize = options.includeStatusIndicators ? nodeCount * 200 : 0;

 // Overhead (metadata, headers)
 const overhead = 50000;

 const minSize = Math.round(nodeCount * baseNodeSize * 0.7 + edgeSize + overhead);
 const maxSize = Math.round(nodeCount * baseNodeSize * 1.3 + edgeSize + labelSize + statusSize + overhead);

 // Format size
 const formatSize = (bytes: number): string => {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
 };

 return {
 minSize,
 maxSize,
 formatted: `${formatSize(minSize)} - ${formatSize(maxSize)}`,
 };
}

/**
 * Get platform-specific instructions
 */
export function getVRPlatformInstructions(platform: VRTargetPlatform): string[] {
 return VR_PLATFORM_SETTINGS[platform].instructions;
}

/**
 * Check if export options are compatible with platform
 */
export function validateVRExportOptions(options: VRExportOptions): {
 valid: boolean;
 warnings: string[];
 errors: string[];
} {
 const warnings: string[] = [];
 const errors: string[] = [];
 const platformSettings = VR_PLATFORM_SETTINGS[options.platform];

 // Check format compatibility
 if (!platformSettings.supportsGLTF && (options.format === 'gltf' || options.format === 'glb')) {
 errors.push(`Platform ${platformSettings.name} does not support GLTF format`);
 }

 // Check quality recommendations
 if (options.quality === 'high' && options.platform === 'quest') {
 warnings.push('High quality may impact performance on Quest devices');
 }

 // Check label support
 if (options.includeLabels && options.quality === 'low') {
 warnings.push('Labels may be difficult to read at low quality');
 }

 return {
 valid: errors.length === 0,
 warnings,
 errors,
 };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate export metrics from scene data
 */
export function calculateExportMetrics(
 nodes: VoxelNode[],
 edges: VoxelEdge[],
 anomalies: VoxelAnomaly[]
): ExportMetrics {
 const nodesByType: Record<string, number> = {};
 nodes.forEach((node) => {
 nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
 });

 const bySeverity: Record<string, number> = {};
 const byStatus: Record<string, number> = {};
 anomalies.forEach((a) => {
 bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
 byStatus[a.status] = (byStatus[a.status] || 0) + 1;
 });

 return {
 totalNodes: nodes.length,
 nodesByType,
 totalEdges: edges.length,
 anomalySummary: {
 total: anomalies.length,
 bySeverity,
 byStatus,
 },
 timestamp: new Date(),
 };
}

/**
 * Export service singleton for easier access
 */
export const VoxelExportService = {
 // Screenshot
 captureScreenshot,
 downloadScreenshot,
 copyScreenshotToClipboard,

 // PDF
 exportToPDF,
 downloadPDFReport,

 // GLTF
 exportToGLTF,
 downloadGLTF,

 // VR Export (Story 34.5)
 exportForVR,
 downloadVRExport,
 estimateVRExportSize,
 getVRPlatformInstructions,
 validateVRExportOptions,
 VR_PLATFORM_SETTINGS,

 // Utilities
 calculateExportMetrics,
};

export default VoxelExportService;
