import type { ViewPreset, ViewPresetConfig } from '../types/voxel';

/**
 * View Presets Configuration
 *
 * Predefined camera positions, visible layers, and layouts for different user roles.
 * Each preset is optimized for a specific use case and user persona.
 */
export const VIEW_PRESETS: Record<ViewPreset, ViewPresetConfig> = {
  executive: {
    layers: ['risk', 'project'],
    layout: 'hierarchical',
    camera: { position: { x: 0, y: 30, z: 30 }, target: { x: 0, y: 0, z: 0 } },
    description: 'Vue Direction - KPIs et risques majeurs',
    icon: '👔',
  },
  rssi: {
    layers: ['asset', 'risk', 'control', 'incident', 'supplier'],
    layout: 'force',
    camera: { position: { x: 0, y: 15, z: 25 }, target: { x: 0, y: 0, z: 0 } },
    description: 'Vue RSSI - Posture sécurité complète',
    icon: '🛡️',
  },
  auditor: {
    layers: ['control', 'audit', 'risk'],
    layout: 'hierarchical',
    camera: { position: { x: 0, y: 20, z: 20 }, target: { x: 0, y: 0, z: 0 } },
    description: 'Vue Auditeur - Contrôles et conformité',
    icon: '📋',
  },
  soc: {
    layers: ['incident', 'asset', 'supplier'],
    layout: 'timeline',
    camera: { position: { x: 0, y: 10, z: 30 }, target: { x: 0, y: 0, z: 0 } },
    description: 'Vue SOC - Incidents temps réel',
    icon: '🔍',
  },
  compliance: {
    layers: ['control', 'risk', 'audit'],
    layout: 'radial',
    camera: { position: { x: 0, y: 25, z: 25 }, target: { x: 0, y: 0, z: 0 } },
    description: 'Vue Conformité - Standards et frameworks',
    icon: '✅',
  },
  custom: {
    layers: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
    layout: 'force',
    camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
    description: 'Vue personnalisée',
    icon: '⚙️',
  },
};

/**
 * Get a preset configuration by name
 */
export function getPresetConfig(preset: ViewPreset): ViewPresetConfig {
  return VIEW_PRESETS[preset];
}

/**
 * Get all available preset names
 */
export function getAvailablePresets(): ViewPreset[] {
  return Object.keys(VIEW_PRESETS) as ViewPreset[];
}

/**
 * Check if a preset name is valid
 */
export function isValidPreset(preset: string): preset is ViewPreset {
  return preset in VIEW_PRESETS;
}
