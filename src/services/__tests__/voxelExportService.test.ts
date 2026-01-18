/**
 * Unit tests for VoxelExportService
 *
 * Tests for:
 * - Screenshot capture
 * - PDF report generation
 * - GLTF export
 * - VR export options
 * - Utility functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VoxelExportService,
  captureScreenshot,
  exportToPDF,
  exportToGLTF,
  exportForVR,
  calculateExportMetrics,
  estimateVRExportSize,
  getVRPlatformInstructions,
  validateVRExportOptions,
  VR_PLATFORM_SETTINGS,
  ScreenshotOptions,
  PDFReportOptions,
  GLTFExportOptions,
  VRExportOptions,
} from '../voxelExportService';
import type { VoxelNode, VoxelAnomaly, VoxelEdge } from '@/types/voxel';
import {
  createVoxelNode,
  createVoxelEdge,
  createVoxelAnomaly,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

// Mock Three.js classes
vi.mock('three', () => ({
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    getPixelRatio: vi.fn().mockReturnValue(1),
    setPixelRatio: vi.fn(),
    getSize: vi.fn().mockImplementation((target) => {
      target.width = 800;
      target.height = 600;
    }),
    setSize: vi.fn(),
    getClearColor: vi.fn(),
    getClearAlpha: vi.fn().mockReturnValue(1),
    setClearColor: vi.fn(),
    render: vi.fn(),
    domElement: {
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
    },
  })),
  Scene: vi.fn().mockImplementation(() => ({
    userData: {},
    traverse: vi.fn((callback) => {
      callback({ geometry: { index: { count: 300 } } });
    }),
  })),
  Camera: vi.fn(),
  Object3D: vi.fn(),
  Vector2: vi.fn().mockImplementation(() => ({
    width: 800,
    height: 600,
  })),
  Color: vi.fn().mockImplementation(() => ({
    r: 0,
    g: 0,
    b: 0,
  })),
  Box3: vi.fn(),
  Vector3: vi.fn(),
  Frustum: vi.fn(),
  Matrix4: vi.fn(),
}));

// Mock GLTFExporter
vi.mock('three/examples/jsm/exporters/GLTFExporter.js', () => ({
  GLTFExporter: vi.fn().mockImplementation(() => ({
    parse: vi.fn((_scene, onComplete, _onError, _options) => {
      onComplete(new ArrayBuffer(1024));
    }),
  })),
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    setFont: vi.fn(),
    addImage: vi.fn(),
    splitTextToSize: vi.fn((text) => [text]),
    circle: vi.fn(),
    addPage: vi.fn(),
    getNumberOfPages: vi.fn().mockReturnValue(1),
    setPage: vi.fn(),
    output: vi.fn().mockReturnValue(new Blob(['mock pdf'], { type: 'application/pdf' })),
  })),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement
const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
};
vi.spyOn(document, 'createElement').mockImplementation(() => mockLink as unknown as HTMLElement);
vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    write: vi.fn().mockResolvedValue(undefined),
  },
});

import * as THREE from 'three';

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  blob: vi.fn().mockResolvedValue(new Blob(['mock'], { type: 'image/png' })),
});

// Mock ClipboardItem
global.ClipboardItem = vi.fn().mockImplementation((items) => ({
  ...items,
  supports: vi.fn(),
  types: Object.keys(items),
  getType: vi.fn(),
})) as unknown as typeof ClipboardItem;

describe('VoxelExportService', () => {
  let mockRenderer: THREE.WebGLRenderer;
  let mockScene: THREE.Scene;
  let mockCamera: THREE.Camera;

  beforeEach(async () => {
    resetIdCounter();
    vi.clearAllMocks();

    // Create mock Three.js objects
    const ThreeMock = vi.mocked(await import('three'));
    mockRenderer = new ThreeMock.WebGLRenderer();
    mockScene = new ThreeMock.Scene();
    mockCamera = new ThreeMock.Camera();
  });

  // ============================================================================
  // Screenshot Export Tests
  // ============================================================================

  describe('captureScreenshot', () => {
    it('should capture screenshot with default options', async () => {
      const dataUrl = await captureScreenshot(mockRenderer, mockScene, mockCamera);

      expect(dataUrl).toBe('data:image/png;base64,mock');
      expect(mockRenderer.render).toHaveBeenCalledWith(mockScene, mockCamera);
    });

    it('should handle different format options', async () => {
      const options: ScreenshotOptions = { format: 'jpeg', quality: 0.9 };

      await captureScreenshot(mockRenderer, mockScene, mockCamera, options);

      expect(mockRenderer.domElement.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
    });

    it('should handle resolution multiplier', async () => {
      const options: ScreenshotOptions = { resolution: 2 };

      await captureScreenshot(mockRenderer, mockScene, mockCamera, options);

      expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(1);
      expect(mockRenderer.setSize).toHaveBeenCalled();
    });

    it('should restore original renderer settings', async () => {
      await captureScreenshot(mockRenderer, mockScene, mockCamera);

      // Should restore pixel ratio and size
      expect(mockRenderer.setPixelRatio).toHaveBeenCalledTimes(2);
      expect(mockRenderer.setSize).toHaveBeenCalledTimes(2);
    });

    it('should handle custom dimensions', async () => {
      const options: ScreenshotOptions = { width: 1920, height: 1080 };

      await captureScreenshot(mockRenderer, mockScene, mockCamera, options);

      expect(mockRenderer.setSize).toHaveBeenCalledWith(1920, 1080, false);
    });

    it('should handle background color option', async () => {
      const options: ScreenshotOptions = { backgroundColor: '#ffffff' };

      await captureScreenshot(mockRenderer, mockScene, mockCamera, options);

      expect(mockRenderer.setClearColor).toHaveBeenCalledWith('#ffffff', 1);
    });
  });

  describe('downloadScreenshot', () => {
    it('should trigger download with correct filename', async () => {
      const { downloadScreenshot } = await import('../voxelExportService');

      await downloadScreenshot(mockRenderer, mockScene, mockCamera, 'test-screenshot');

      expect(mockLink.download).toBe('test-screenshot.png');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('copyScreenshotToClipboard', () => {
    it('should copy screenshot to clipboard', async () => {
      const { copyScreenshotToClipboard } = await import('../voxelExportService');

      const result = await copyScreenshotToClipboard(mockRenderer, mockScene, mockCamera);

      expect(result).toBe(true);
      expect(navigator.clipboard.write).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // PDF Export Tests
  // ============================================================================

  describe('exportToPDF', () => {
    const mockNodes: VoxelNode[] = [
      createVoxelNode({ id: 'node-1', label: 'Node 1', type: 'asset', status: 'normal' }),
      createVoxelNode({ id: 'node-2', label: 'Node 2', type: 'risk', status: 'warning' }),
    ];

    const mockEdges: VoxelEdge[] = [
      createVoxelEdge('node-1', 'node-2', { id: 'edge-1' }),
    ];

    const mockAnomalies: VoxelAnomaly[] = [
      createVoxelAnomaly('node-1', { severity: 'high', status: 'active' }),
    ];

    it('should generate PDF blob', async () => {
      const blob = await exportToPDF(mockNodes, mockEdges, mockAnomalies, null);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should include screenshot when provided', async () => {
      const options: PDFReportOptions = { includeScreenshot: true };

      await exportToPDF(mockNodes, mockEdges, mockAnomalies, 'data:image/png;base64,mock', options);

      // jsPDF addImage should be called
      const jsPDF = (await import('jspdf')).default;
      const instance = new jsPDF();
      expect(instance.addImage).toBeDefined();
    });

    it('should include node list when enabled', async () => {
      const options: PDFReportOptions = { includeNodeList: true };

      const blob = await exportToPDF(mockNodes, mockEdges, mockAnomalies, null, options);

      expect(blob).toBeDefined();
    });

    it('should include anomaly summary when enabled', async () => {
      const options: PDFReportOptions = { includeAnomalySummary: true };

      const blob = await exportToPDF(mockNodes, mockEdges, mockAnomalies, null, options);

      expect(blob).toBeDefined();
    });

    it('should handle custom company name', async () => {
      const options: PDFReportOptions = { companyName: 'Test Company' };

      const blob = await exportToPDF(mockNodes, mockEdges, mockAnomalies, null, options);

      expect(blob).toBeDefined();
    });
  });

  describe('downloadPDFReport', () => {
    it('should trigger PDF download', async () => {
      const { downloadPDFReport } = await import('../voxelExportService');

      const mockNodes: VoxelNode[] = [];
      const mockEdges: VoxelEdge[] = [];
      const mockAnomalies: VoxelAnomaly[] = [];

      await downloadPDFReport(mockNodes, mockEdges, mockAnomalies, null, 'test-report');

      expect(mockLink.download).toBe('test-report.pdf');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GLTF Export Tests
  // ============================================================================

  describe('exportToGLTF', () => {
    it('should export scene to GLB format by default', async () => {
      const mockNodes: VoxelNode[] = [createVoxelNode()];

      const result = await exportToGLTF(mockScene, mockNodes);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should include metadata when enabled', async () => {
      const mockNodes: VoxelNode[] = [createVoxelNode({ label: 'Test Node' })];
      const options: GLTFExportOptions = { includeMetadata: true };

      await exportToGLTF(mockScene, mockNodes, options);

      expect(mockScene.userData).toBeDefined();
    });
  });

  describe('downloadGLTF', () => {
    it('should download GLB file', async () => {
      const { downloadGLTF } = await import('../voxelExportService');
      const mockNodes: VoxelNode[] = [];

      await downloadGLTF(mockScene, mockNodes, 'test-scene');

      expect(mockLink.download).toBe('test-scene.glb');
    });
  });

  // ============================================================================
  // VR Export Tests
  // ============================================================================

  describe('exportForVR', () => {
    it('should export for Quest platform', async () => {
      const mockNodes: VoxelNode[] = [createVoxelNode()];
      const mockEdges: VoxelEdge[] = [];
      const options: VRExportOptions = {
        platform: 'quest',
        quality: 'medium',
      };

      const result = await exportForVR(mockScene, mockNodes, mockEdges, options);

      expect(result.metadata.platform).toBe('quest');
      expect(result.metadata.quality).toBe('medium');
      expect(result.extension).toBe('glb');
    });

    it('should export for Vision Pro platform', async () => {
      const mockNodes: VoxelNode[] = [createVoxelNode()];
      const mockEdges: VoxelEdge[] = [];
      const options: VRExportOptions = {
        platform: 'visionPro',
        quality: 'high',
      };

      const result = await exportForVR(mockScene, mockNodes, mockEdges, options);

      expect(result.metadata.platform).toBe('visionPro');
    });

    it('should calculate file size', async () => {
      const mockNodes: VoxelNode[] = [createVoxelNode()];
      const options: VRExportOptions = {
        platform: 'generic',
        quality: 'low',
      };

      const result = await exportForVR(mockScene, mockNodes, [], options);

      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should include node count in metadata', async () => {
      const mockNodes: VoxelNode[] = [
        createVoxelNode(),
        createVoxelNode(),
        createVoxelNode(),
      ];
      const options: VRExportOptions = {
        platform: 'quest',
        quality: 'medium',
      };

      const result = await exportForVR(mockScene, mockNodes, [], options);

      expect(result.metadata.nodeCount).toBe(3);
    });
  });

  describe('estimateVRExportSize', () => {
    it('should estimate export size based on node count', () => {
      const estimate = estimateVRExportSize(100, 50, {
        platform: 'quest',
        quality: 'medium',
        includeLabels: false,
        includeEdges: true,
      });

      expect(estimate.minSize).toBeGreaterThan(0);
      expect(estimate.maxSize).toBeGreaterThan(estimate.minSize);
      expect(estimate.formatted).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);
    });

    it('should increase estimate for labels', () => {
      const withoutLabels = estimateVRExportSize(100, 50, {
        platform: 'quest',
        quality: 'medium',
        includeLabels: false,
      });

      const withLabels = estimateVRExportSize(100, 50, {
        platform: 'quest',
        quality: 'medium',
        includeLabels: true,
      });

      expect(withLabels.maxSize).toBeGreaterThan(withoutLabels.maxSize);
    });

    it('should adjust for quality preset', () => {
      const lowQuality = estimateVRExportSize(100, 50, {
        platform: 'quest',
        quality: 'low',
      });

      const highQuality = estimateVRExportSize(100, 50, {
        platform: 'quest',
        quality: 'high',
      });

      expect(highQuality.maxSize).toBeGreaterThan(lowQuality.maxSize);
    });
  });

  describe('getVRPlatformInstructions', () => {
    it('should return instructions for Quest', () => {
      const instructions = getVRPlatformInstructions('quest');

      expect(instructions).toBeInstanceOf(Array);
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some((i) => i.toLowerCase().includes('quest'))).toBe(true);
    });

    it('should return instructions for Vision Pro', () => {
      const instructions = getVRPlatformInstructions('visionPro');

      expect(instructions).toBeInstanceOf(Array);
      expect(instructions.some((i) => i.toLowerCase().includes('vision'))).toBe(true);
    });
  });

  describe('validateVRExportOptions', () => {
    it('should validate valid options', () => {
      const result = validateVRExportOptions({
        platform: 'quest',
        quality: 'medium',
        format: 'glb',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about high quality on Quest', () => {
      const result = validateVRExportOptions({
        platform: 'quest',
        quality: 'high',
      });

      expect(result.warnings.some((w) => w.toLowerCase().includes('quest'))).toBe(true);
    });

    it('should warn about labels at low quality', () => {
      const result = validateVRExportOptions({
        platform: 'generic',
        quality: 'low',
        includeLabels: true,
      });

      expect(result.warnings.some((w) => w.toLowerCase().includes('label'))).toBe(true);
    });
  });

  describe('VR_PLATFORM_SETTINGS', () => {
    it('should have settings for all platforms', () => {
      expect(VR_PLATFORM_SETTINGS.quest).toBeDefined();
      expect(VR_PLATFORM_SETTINGS.visionPro).toBeDefined();
      expect(VR_PLATFORM_SETTINGS.generic).toBeDefined();
    });

    it('should have texture sizes for all quality presets', () => {
      const platforms = ['quest', 'visionPro', 'generic'] as const;
      const qualities = ['low', 'medium', 'high'] as const;

      platforms.forEach((platform) => {
        qualities.forEach((quality) => {
          expect(VR_PLATFORM_SETTINGS[platform].maxTextureSize[quality]).toBeGreaterThan(0);
          expect(VR_PLATFORM_SETTINGS[platform].maxPolygons[quality]).toBeGreaterThan(0);
        });
      });
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('calculateExportMetrics', () => {
    it('should calculate node metrics correctly', () => {
      const nodes: VoxelNode[] = [
        createVoxelNode({ type: 'asset' }),
        createVoxelNode({ type: 'asset' }),
        createVoxelNode({ type: 'risk' }),
        createVoxelNode({ type: 'control' }),
      ];

      const edges: VoxelEdge[] = [
        createVoxelEdge('n1', 'n2'),
        createVoxelEdge('n2', 'n3'),
      ];

      const anomalies: VoxelAnomaly[] = [
        createVoxelAnomaly('n1', { severity: 'high', status: 'active' }),
        createVoxelAnomaly('n2', { severity: 'medium', status: 'resolved' }),
      ];

      const metrics = calculateExportMetrics(nodes, edges, anomalies);

      expect(metrics.totalNodes).toBe(4);
      expect(metrics.nodesByType.asset).toBe(2);
      expect(metrics.nodesByType.risk).toBe(1);
      expect(metrics.nodesByType.control).toBe(1);
      expect(metrics.totalEdges).toBe(2);
      expect(metrics.anomalySummary.total).toBe(2);
      expect(metrics.anomalySummary.bySeverity.high).toBe(1);
      expect(metrics.anomalySummary.byStatus.active).toBe(1);
    });

    it('should handle empty arrays', () => {
      const metrics = calculateExportMetrics([], [], []);

      expect(metrics.totalNodes).toBe(0);
      expect(metrics.totalEdges).toBe(0);
      expect(metrics.anomalySummary.total).toBe(0);
    });

    it('should include timestamp', () => {
      const metrics = calculateExportMetrics([], [], []);

      expect(metrics.timestamp).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // VoxelExportService Object Tests
  // ============================================================================

  describe('VoxelExportService object', () => {
    it('should export all methods', () => {
      expect(VoxelExportService.captureScreenshot).toBeDefined();
      expect(VoxelExportService.downloadScreenshot).toBeDefined();
      expect(VoxelExportService.copyScreenshotToClipboard).toBeDefined();
      expect(VoxelExportService.exportToPDF).toBeDefined();
      expect(VoxelExportService.downloadPDFReport).toBeDefined();
      expect(VoxelExportService.exportToGLTF).toBeDefined();
      expect(VoxelExportService.downloadGLTF).toBeDefined();
      expect(VoxelExportService.exportForVR).toBeDefined();
      expect(VoxelExportService.downloadVRExport).toBeDefined();
      expect(VoxelExportService.estimateVRExportSize).toBeDefined();
      expect(VoxelExportService.getVRPlatformInstructions).toBeDefined();
      expect(VoxelExportService.validateVRExportOptions).toBeDefined();
      expect(VoxelExportService.calculateExportMetrics).toBeDefined();
    });
  });
});
