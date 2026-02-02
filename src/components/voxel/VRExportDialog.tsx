/**
 * Story 34.5 - VR Export Dialog Component
 *
 * Dialog for configuring and downloading VR-optimized GLTF exports
 * for different VR platforms (Meta Quest, Apple Vision Pro, Generic).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Scene, Object3D } from 'three';
import type { VoxelNode, VoxelEdge } from '@/types/voxel';
import {
  VRTargetPlatform,
  VRQualityPreset,
  VRExportOptions,
  VRExportResult,
  VR_PLATFORM_SETTINGS,
  downloadVRExport,
  estimateVRExportSize,
  validateVRExportOptions,
  getVRPlatformInstructions,
} from '@/services/voxelExportService';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export interface VRExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** The scene to export */
  scene: Scene | Object3D | null;
  /** Nodes in the scene */
  nodes: VoxelNode[];
  /** Edges in the scene */
  edges?: VoxelEdge[];
  /** Callback when export completes */
  onExportComplete?: (result: VRExportResult) => void;
  /** Callback on export error */
  onExportError?: (error: Error) => void;
  /** Default filename */
  defaultFilename?: string;
}

// ============================================================================
// Icons
// ============================================================================

const CloseIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const QuestIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 10a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-3l-2 2h-6l-2-2H4a2 2 0 01-2-2v-4z" />
    <circle cx="8" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="16" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const VisionProIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="8" width="20" height="8" rx="4" />
    <circle cx="8" cy="12" r="2" fill="#1e293b" />
    <circle cx="16" cy="12" r="2" fill="#1e293b" />
    <rect x="10" y="10" width="4" height="4" rx="1" fill="#475569" />
  </svg>
);

const GenericIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
  </svg>
);

// ============================================================================
// Platform Card Component
// ============================================================================

interface PlatformCardProps {
  platform: VRTargetPlatform;
  isSelected: boolean;
  onSelect: () => void;
}

const PlatformCard: React.FC<PlatformCardProps> = ({ platform, isSelected, onSelect }) => {
  const settings = VR_PLATFORM_SETTINGS[platform];

  const Icon = useMemo(() => {
    switch (platform) {
      case 'quest':
        return QuestIcon;
      case 'visionPro':
        return VisionProIcon;
      default:
        return GenericIcon;
    }
  }, [platform]);

  return (
    <button
      onClick={onSelect}
      className={`
        relative p-4 rounded-3xl border-2 transition-all duration-200 text-left
        ${isSelected
          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10'
          : 'border-border/40 bg-white/5 hover:border-white/20 hover:bg-white/10'
        }
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Icon */}
      <div className={`mb-3 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`}>
        <Icon />
      </div>

      {/* Name */}
      <h3 className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
        {settings.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{settings.description}</p>
    </button>
  );
};

// ============================================================================
// Quality Selector Component
// ============================================================================

interface QualitySelectorProps {
  quality: VRQualityPreset;
  onChange: (quality: VRQualityPreset) => void;
  platform: VRTargetPlatform;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({ quality, onChange, platform: _platform }) => {
  const qualities: { value: VRQualityPreset; label: string; description: string }[] = [
    { value: 'low', label: 'Low', description: 'Smallest file, fastest loading' },
    { value: 'medium', label: 'Medium', description: 'Balanced quality and size' },
    { value: 'high', label: 'High', description: 'Best quality, larger file' },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Quality Preset</h3>
      <div className="grid grid-cols-3 gap-2">
        {qualities.map((q) => (
          <button
            key={q.value || 'unknown'}
            onClick={() => onChange(q.value)}
            className={`
              p-3 rounded-lg border transition-all text-center
              ${quality === q.value
                ? 'border-blue-500 bg-blue-500/20 text-white'
                : 'border-border/40 bg-white/5 text-slate-400 hover:border-white/20'
              }
            `}
          >
            <div className="font-medium text-sm">{q.label}</div>
            <div className="text-xs opacity-60 mt-0.5">{q.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Options Toggle Component
// ============================================================================

interface OptionsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const OptionsToggle: React.FC<OptionsToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => (
  <label className={`flex items-center justify-between py-2 ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {description && <div className="text-xs text-slate-500">{description}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative w-11 h-6 rounded-full transition-colors
        ${checked ? 'bg-blue-500' : 'bg-slate-600'}
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  </label>
);

// ============================================================================
// Instructions Panel Component
// ============================================================================

interface InstructionsPanelProps {
  platform: VRTargetPlatform;
}

const InstructionsPanel: React.FC<InstructionsPanelProps> = ({ platform }) => {
  const instructions = getVRPlatformInstructions(platform);

  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-slate-300 mb-3">How to use on {VR_PLATFORM_SETTINGS[platform].name}</h4>
      <ol className="space-y-2">
        {instructions.map((instruction, index) => (
          <li key={index || 'unknown'} className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">
              {index + 1}
            </span>
            <span className="pt-0.5">{instruction}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

// ============================================================================
// Main VR Export Dialog Component
// ============================================================================

export const VRExportDialog: React.FC<VRExportDialogProps> = ({
  isOpen,
  onClose,
  scene,
  nodes,
  edges = [],
  onExportComplete,
  onExportError,
  defaultFilename = 'voxel-vr-export',
}) => {
  // Form state
  const [platform, setPlatform] = useState<VRTargetPlatform>('quest');
  const [quality, setQuality] = useState<VRQualityPreset>('medium');
  const [includeLabels, setIncludeLabels] = useState(false);
  const [includeEdges, setIncludeEdges] = useState(true);
  const [includeStatusIndicators, setIncludeStatusIndicators] = useState(true);
  const [filename, setFilename] = useState(defaultFilename);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState<VRExportResult | null>(null);

  // Build options object
  const exportOptions: VRExportOptions = useMemo(
    () => ({
      platform,
      quality,
      includeLabels,
      includeEdges,
      includeStatusIndicators,
      bakeLighting: true,
    }),
    [platform, quality, includeLabels, includeEdges, includeStatusIndicators]
  );

  // Validate options
  const validation = useMemo(() => validateVRExportOptions(exportOptions), [exportOptions]);

  // Estimate file size
  const sizeEstimate = useMemo(
    () => estimateVRExportSize(nodes.length, edges.length, exportOptions),
    [nodes.length, edges.length, exportOptions]
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setExportResult(null);
      setExportProgress(0);
      setIsExporting(false);
    }
  }, [isOpen]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!scene) {
      onExportError?.(new Error('No scene available for export'));
      return;
    }

    setIsExporting(true);
    setExportProgress(10);

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const result = await downloadVRExport(scene, nodes, edges, filename, exportOptions);

      clearInterval(progressInterval);
      setExportProgress(100);
      setExportResult(result);
      onExportComplete?.(result);
    } catch (error) {
      ErrorLogger.error(error, 'VRExportDialog.export');
      onExportError?.(error instanceof Error ? error : new Error('Export failed'));
    } finally {
      setIsExporting(false);
    }
  }, [scene, nodes, edges, filename, exportOptions, onExportComplete, onExportError]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-border/40 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <div>
            <h2 className="text-lg font-semibold text-white">Export for VR</h2>
            <p className="text-sm text-muted-foreground">Download optimized GLTF for VR headsets</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Platform Selection */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3 block">Target Platform</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['quest', 'visionPro', 'generic'] as VRTargetPlatform[]).map((p) => (
                <PlatformCard
                  key={p || 'unknown'}
                  platform={p}
                  isSelected={platform === p}
                  onSelect={() => setPlatform(p)}
                />
              ))}
            </div>
          </div>

          {/* Quality Selection */}
          <QualitySelector quality={quality} onChange={setQuality} platform={platform} />

          {/* Export Options */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2 block">Include Options</h3>
            <div className="bg-slate-800/50 rounded-lg px-4 divide-y divide-white/5">
              <OptionsToggle
                label="Node Labels"
                description="Include text labels on nodes"
                checked={includeLabels}
                onChange={setIncludeLabels}
              />
              <OptionsToggle
                label="Connection Edges"
                description="Include lines between connected nodes"
                checked={includeEdges}
                onChange={setIncludeEdges}
              />
              <OptionsToggle
                label="Status Indicators"
                description="Include colored status rings"
                checked={includeStatusIndicators}
                onChange={setIncludeStatusIndicators}
              />
            </div>
          </div>

          {/* Filename */}
          <div>
            <label htmlFor="filename-input" className="text-sm font-medium text-slate-300 mb-2 block">Filename</label>
            <input
              id="filename-input"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-border/40 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="voxel-vr-export"
            />
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
              File will be saved as {filename}.{VR_PLATFORM_SETTINGS[platform].recommendedFormat}
            </p>
          </div>

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
                <WarningIcon />
                <span>Warnings</span>
              </div>
              <ul className="text-xs text-amber-300/80 space-y-1">
                {validation.warnings.map((warning, i) => (
                  <li key={i || 'unknown'}>- {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Export Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Export Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Nodes</span>
                <span className="float-right text-muted-foreground">{nodes.length}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Edges</span>
                <span className="float-right text-muted-foreground">{includeEdges ? edges.length : 0}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Format</span>
                <span className="float-right text-slate-300 uppercase">
                  {VR_PLATFORM_SETTINGS[platform].recommendedFormat}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Est. Size</span>
                <span className="float-right text-muted-foreground">{sizeEstimate.formatted}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <InstructionsPanel platform={platform} />

          {/* Export Result */}
          {exportResult && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                <CheckIcon className="w-5 h-5" />
                <span>Export Complete!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-300/80">
                <div>File size: {(exportResult.fileSize / 1024).toFixed(1)} KB</div>
                <div>Triangles: {exportResult.metadata.triangleCount.toLocaleString()}</div>
                <div>Format: {exportResult.extension.toUpperCase()}</div>
                <div>Nodes: {exportResult.metadata.nodeCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/40 bg-slate-900/50">
          <div className="text-xs text-slate-500">
            {isExporting && `Exporting... ${exportProgress}%`}
            {!isExporting && !exportResult && 'Ready to export'}
            {exportResult && 'Download started'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              {exportResult ? 'Done' : 'Cancel'}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || !scene || !validation.valid}
              className={`
                flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium
                transition-all duration-200
                ${isExporting || !scene || !validation.valid
                  ? 'bg-slate-600 text-muted-foreground cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                }
              `}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4" />
                  <span>Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VRExportDialog;
