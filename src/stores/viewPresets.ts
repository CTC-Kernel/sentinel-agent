import type { ViewPreset, ViewPresetConfig, VoxelNodeType, VoxelUIState } from '../types/voxel';
import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Extended preset configuration with additional display options
 */
export interface ExtendedViewPresetConfig extends ViewPresetConfig {
 /** Color scheme for nodes in this preset */
 colorScheme: 'default' | 'status' | 'severity' | 'type';
 /** Filter predicates to apply */
 filters?: {
 showAnomaliesOnly?: boolean;
 statusFilter?: ('normal' | 'warning' | 'critical' | 'inactive')[];
 };
 /** Preview thumbnail (base64 or URL) */
 thumbnail?: string;
}

/**
 * User-saved custom view configuration
 */
export interface CustomViewConfig extends ExtendedViewPresetConfig {
 id: string;
 name: string;
 createdAt: Date;
 updatedAt: Date;
 createdBy: string;
}

/**
 * Zod schema for validating preset configurations
 */
const Vector3Schema = z.object({
 x: z.number(),
 y: z.number(),
 z: z.number(),
});

const CameraSchema = z.object({
 position: Vector3Schema,
 target: Vector3Schema,
});

const LayerTypeSchema = z.enum(['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit']);
const LayoutTypeSchema = z.enum(['force', 'hierarchical', 'radial', 'timeline']);
const ColorSchemeSchema = z.enum(['default', 'status', 'severity', 'type']);

export const ViewPresetConfigSchema = z.object({
 layers: z.array(LayerTypeSchema).min(1),
 layout: LayoutTypeSchema,
 camera: CameraSchema,
 description: z.string().min(1).max(200),
 icon: z.string().min(1).max(10),
 colorScheme: ColorSchemeSchema.optional().default('default'),
 filters: z.object({
 showAnomaliesOnly: z.boolean().optional(),
 statusFilter: z.array(z.enum(['normal', 'warning', 'critical', 'inactive'])).optional(),
 }).optional(),
 thumbnail: z.string().optional(),
});

export const CustomViewConfigSchema = ViewPresetConfigSchema.extend({
 id: z.string().uuid(),
 name: z.string().min(1).max(50),
 createdAt: z.date(),
 updatedAt: z.date(),
 createdBy: z.string().min(1),
});

// ============================================================================
// Preset Definitions
// ============================================================================

/**
 * View Presets Configuration
 *
 * Predefined camera positions, visible layers, and layouts for different user roles.
 * Each preset is optimized for a specific use case and user persona.
 */
export const VIEW_PRESETS: Record<ViewPreset, ExtendedViewPresetConfig> = {
 executive: {
 layers: ['risk', 'project'],
 layout: 'hierarchical',
 camera: { position: { x: 0, y: 30, z: 30 }, target: { x: 0, y: 0, z: 0 } },
 description: 'Vue Direction - KPIs et risques majeurs',
 icon: '👔',
 colorScheme: 'severity',
 filters: {
 statusFilter: ['warning', 'critical'],
 },
 },
 rssi: {
 layers: ['asset', 'risk', 'control', 'incident', 'supplier'],
 layout: 'force',
 camera: { position: { x: 0, y: 15, z: 25 }, target: { x: 0, y: 0, z: 0 } },
 description: 'Vue RSSI - Posture sécurité complète',
 icon: '🛡️',
 colorScheme: 'status',
 },
 auditor: {
 layers: ['control', 'audit', 'risk'],
 layout: 'hierarchical',
 camera: { position: { x: 0, y: 20, z: 20 }, target: { x: 0, y: 0, z: 0 } },
 description: 'Vue Auditeur - Contrôles et conformité',
 icon: '📋',
 colorScheme: 'default',
 },
 soc: {
 layers: ['incident', 'asset', 'supplier'],
 layout: 'timeline',
 camera: { position: { x: 0, y: 10, z: 30 }, target: { x: 0, y: 0, z: 0 } },
 description: 'Vue SOC - Incidents temps réel',
 icon: '🔍',
 colorScheme: 'severity',
 filters: {
 showAnomaliesOnly: false,
 },
 },
 compliance: {
 layers: ['control', 'risk', 'audit'],
 layout: 'radial',
 camera: { position: { x: 0, y: 25, z: 25 }, target: { x: 0, y: 0, z: 0 } },
 description: 'Vue Conformité - Standards et frameworks',
 icon: '✅',
 colorScheme: 'type',
 },
 custom: {
 layers: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
 layout: 'force',
 camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
 description: 'Vue personnalisée',
 icon: '⚙️',
 colorScheme: 'default',
 },
};

/**
 * Get a preset configuration by name
 */
export function getPresetConfig(preset: ViewPreset): ExtendedViewPresetConfig {
 return VIEW_PRESETS[preset];
}

/**
 * Get all available preset names
 */
export function getAvailablePresets(): { key: ViewPreset; config: ExtendedViewPresetConfig }[] {
 return (Object.keys(VIEW_PRESETS) as ViewPreset[]).map(key => ({
 key,
 config: VIEW_PRESETS[key],
 }));
}

/**
 * Check if a preset name is valid
 */
export function isValidPreset(preset: string): preset is ViewPreset {
 return preset in VIEW_PRESETS;
}

/**
 * Validate a preset configuration
 */
export function validatePresetConfig(config: unknown): {
 success: boolean;
 data?: ExtendedViewPresetConfig;
 error?: string;
} {
 const result = ViewPresetConfigSchema.safeParse(config);
 if (result.success) {
 return { success: true, data: result.data as ExtendedViewPresetConfig };
 }
 return { success: false, error: result.error.message };
}

/**
 * Validate a custom view configuration
 */
export function validateCustomViewConfig(config: unknown): {
 success: boolean;
 data?: CustomViewConfig;
 error?: string;
} {
 const result = CustomViewConfigSchema.safeParse(config);
 if (result.success) {
 return { success: true, data: result.data as CustomViewConfig };
 }
 return { success: false, error: result.error.message };
}

/**
 * Serialize a preset configuration to a URL-safe string
 */
export function serializePresetToUrl(config: ExtendedViewPresetConfig): string {
 const minimal = {
 l: config.layers.map(l => l[0]).join(''), // First letter of each layer
 y: config.layout[0], // First letter of layout
 c: [
 Math.round(config.camera.position.x),
 Math.round(config.camera.position.y),
 Math.round(config.camera.position.z),
 ].join(','),
 t: [
 Math.round(config.camera.target.x),
 Math.round(config.camera.target.y),
 Math.round(config.camera.target.z),
 ].join(','),
 s: config.colorScheme[0], // First letter of color scheme
 };
 return btoa(JSON.stringify(minimal));
}

/**
 * Deserialize a URL string back to a preset configuration
 */
export function deserializePresetFromUrl(encoded: string): Partial<ExtendedViewPresetConfig> | null {
 try {
 const minimal = JSON.parse(atob(encoded));

 const layerMap: Record<string, VoxelNodeType> = {
 a: 'asset', r: 'risk', c: 'control', i: 'incident', s: 'supplier', p: 'project', u: 'audit',
 };
 const layoutMap: Record<string, VoxelUIState['layoutType']> = {
 f: 'force', h: 'hierarchical', r: 'radial', t: 'timeline',
 };
 const colorSchemeMap: Record<string, ExtendedViewPresetConfig['colorScheme']> = {
 d: 'default', s: 'status', e: 'severity', t: 'type',
 };

 const layers = minimal.l.split('').map((l: string) => layerMap[l]).filter(Boolean);
 const layout = layoutMap[minimal.y] || 'force';
 const [px, py, pz] = minimal.c.split(',').map(Number);
 const [tx, ty, tz] = minimal.t.split(',').map(Number);
 const colorScheme = colorSchemeMap[minimal.s] || 'default';

 return {
 layers,
 layout,
 camera: {
 position: { x: px, y: py, z: pz },
 target: { x: tx, y: ty, z: tz },
 },
 colorScheme,
 description: '',
 icon: '⚙️',
 };
 } catch {
 return null;
 }
}

/**
 * Create a default custom view from current state
 */
export function createDefaultCustomView(
 name: string,
 currentConfig: Partial<ExtendedViewPresetConfig>,
 userId: string
): CustomViewConfig {
 const now = new Date();
 return {
 id: crypto.randomUUID(),
 name,
 layers: currentConfig.layers || ['asset', 'risk', 'control'],
 layout: currentConfig.layout || 'force',
 camera: currentConfig.camera || {
 position: { x: 0, y: 10, z: 20 },
 target: { x: 0, y: 0, z: 0 },
 },
 description: `Vue personnalisée: ${name}`,
 icon: '⚙️',
 colorScheme: currentConfig.colorScheme || 'default',
 filters: currentConfig.filters,
 createdAt: now,
 updatedAt: now,
 createdBy: userId,
 };
}
