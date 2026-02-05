/**
 * Preset Slice
 *
 * Manages view presets for the voxel visualization.
 * Handles applying predefined view configurations and saving custom presets.
 */

// Types imported via ./types
import type { PresetSlice, VoxelSliceCreator } from './types';
import { VIEW_PRESETS } from '../viewPresets';

/**
 * Creates the preset slice with all preset-related state and actions.
 *
 * @returns Preset slice state and actions
 */
export const createPresetSlice: VoxelSliceCreator<PresetSlice> = (set) => ({
 currentPreset: 'custom',

 /**
 * Apply a predefined view preset.
 * Updates filters, UI settings, and camera position based on preset configuration.
 *
 * @param preset - The preset key to apply
 */
 applyPreset: (preset) =>
 set(
 (state) => {
 const config = VIEW_PRESETS[preset];
 return {
 currentPreset: preset,
 filters: {
 ...state.filters,
 nodeTypes: config.layers,
 },
 ui: {
 ...state.ui,
 layoutType: config.layout,
 cameraPosition: config.camera.position,
 cameraTarget: config.camera.target,
 },
 };
 },
 false,
 'applyPreset'
 ),

 /**
 * Save the current configuration as a custom preset.
 * Sets the current preset to 'custom' to indicate user modifications.
 */
 saveCustomPreset: () =>
 set(() => ({ currentPreset: 'custom' }), false, 'saveCustomPreset'),
});
