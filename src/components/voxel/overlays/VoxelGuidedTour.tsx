/**
 * VoxelGuidedTour - Interactive guided tour for the 3D visualization
 *
 * Provides step-by-step navigation through important areas:
 * - Critical risk areas
 * - Key assets
 * - Control coverage
 *
 * @see Story VOX-9.3: Mode Guidé
 * @see FR47: Users can activate guided navigation to critical points
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
 Play,
 Pause,
 SkipForward,
 X,
 ChevronLeft,
 ChevronRight,
 MapPin,
 AlertTriangle,
 Shield,
 Server,
 CheckCircle,
} from 'lucide-react';
import { useVoxelStore } from '@/stores/voxelStore';
import type { VoxelNode } from '@/types/voxel';
import {
  VOXEL_NODE_TYPE_COLORS_CSS,
  VOXEL_STATUS_COLORS_CSS,
  getVoxelPanelStyles,
} from '../voxelTheme';

// ============================================================================
// Types
// ============================================================================

export interface TourStop {
 /** Unique identifier */
 id: string;
 /** Title displayed in the tour panel */
 title: string;
 /** Description of this stop */
 description: string;
 /** Target position to navigate to [x, y, z] */
 targetPosition: [number, number, number];
 /** Camera position for this stop [x, y, z] */
 cameraPosition?: [number, number, number];
 /** Node ID to highlight (optional) */
 highlightNodeId?: string;
 /** Icon type */
 icon: 'risk' | 'asset' | 'control' | 'location' | 'check';
 /** Duration to stay at this stop (ms) */
 duration?: number;
}

export interface VoxelGuidedTourProps {
 /** Whether the tour is visible */
 visible?: boolean;
 /** Custom tour stops (if not provided, auto-generates from data) */
 stops?: TourStop[];
 /** Callback when tour completes */
 onComplete?: () => void;
 /** Callback to close tour */
 onClose?: () => void;
 /** Callback when navigating to a stop */
 onNavigate?: (stop: TourStop) => void;
 /** Auto-play interval in ms (0 = disabled) */
 autoPlayInterval?: number;
 /** Custom className */
 className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ICON_MAP = {
 risk: AlertTriangle,
 asset: Server,
 control: Shield,
 location: MapPin,
 check: CheckCircle,
};

// Icon background colors using CSS variables with opacity
const ICON_BG_COLORS = {
 risk: 'color-mix(in srgb, hsl(var(--chart-critical)) 20%, transparent)',
 asset: 'color-mix(in srgb, hsl(var(--chart-series-1)) 20%, transparent)',
 control: 'color-mix(in srgb, hsl(var(--chart-series-3)) 20%, transparent)',
 location: 'color-mix(in srgb, hsl(var(--chart-series-1)) 20%, transparent)',
 check: 'color-mix(in srgb, hsl(var(--chart-series-1)) 20%, transparent)',
};

// Icon colors using CSS variables
const ICON_COLORS = {
 risk: VOXEL_STATUS_COLORS_CSS.critical,
 asset: VOXEL_NODE_TYPE_COLORS_CSS.asset,
 control: VOXEL_NODE_TYPE_COLORS_CSS.control,
 location: VOXEL_NODE_TYPE_COLORS_CSS.asset,
 check: VOXEL_NODE_TYPE_COLORS_CSS.asset,
};

const DEFAULT_STOP_DURATION = 5000; // 5 seconds
const DEFAULT_AUTO_PLAY_INTERVAL = 8000; // 8 seconds

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate tour stops from node data
 */
function generateTourStops(nodes: VoxelNode[]): TourStop[] {
 const stops: TourStop[] = [];

 // Find critical risks
 const criticalRisks = nodes.filter((n) => n.type === 'risk' && n.status === 'critical');
 if (criticalRisks.length > 0) {
 const firstCritical = criticalRisks[0];
 const avgX = criticalRisks.reduce((sum, n) => sum + n.position.x, 0) / criticalRisks.length;
 const avgZ = criticalRisks.reduce((sum, n) => sum + n.position.z, 0) / criticalRisks.length;

 stops.push({
 id: 'critical-risks',
 title: 'Critical Risks',
 description: `You have ${criticalRisks.length} critical risk${criticalRisks.length > 1 ? 's' : ''} that require immediate attention.`,
 targetPosition: [avgX, 0, avgZ],
 cameraPosition: [avgX, 80, avgZ + 100],
 highlightNodeId: firstCritical.id,
 icon: 'risk',
 duration: 6000,
 });
 }

 // Find assets with most connections
 const assetsWithConnections = nodes
 .filter((n) => n.type === 'asset')
 .sort((a, b) => (b.connections?.length || 0) - (a.connections?.length || 0));

 if (assetsWithConnections.length > 0) {
 const topAsset = assetsWithConnections[0];
 stops.push({
 id: 'key-assets',
 title: 'Key Assets',
 description: `Your most connected asset "${topAsset.label}" has ${topAsset.connections?.length || 0} relationships.`,
 targetPosition: [topAsset.position.x, topAsset.position.y, topAsset.position.z],
 cameraPosition: [topAsset.position.x + 50, 60, topAsset.position.z + 80],
 highlightNodeId: topAsset.id,
 icon: 'asset',
 duration: 5000,
 });
 }

 // Find controls
 const controls = nodes.filter((n) => n.type === 'control');
 if (controls.length > 0) {
 const avgX = controls.reduce((sum, n) => sum + n.position.x, 0) / controls.length;
 const avgZ = controls.reduce((sum, n) => sum + n.position.z, 0) / controls.length;

 stops.push({
 id: 'controls-overview',
 title: 'Control Coverage',
 description: `You have ${controls.length} controls protecting your assets and mitigating risks.`,
 targetPosition: [avgX, 0, avgZ],
 cameraPosition: [avgX - 50, 100, avgZ + 120],
 icon: 'control',
 duration: 5000,
 });
 }

 // Overview stop
 const allX = nodes.map((n) => n.position.x);
 const allZ = nodes.map((n) => n.position.z);
 const centerX = (Math.min(...allX) + Math.max(...allX)) / 2;
 const centerZ = (Math.min(...allZ) + Math.max(...allZ)) / 2;
 const spread = Math.max(Math.max(...allX) - Math.min(...allX), Math.max(...allZ) - Math.min(...allZ));

 stops.push({
 id: 'overview',
 title: 'Full Overview',
 description: `Your GRC landscape contains ${nodes.length} entities across multiple categories.`,
 targetPosition: [centerX, 0, centerZ],
 cameraPosition: [centerX, spread * 0.8, centerZ + spread * 0.6],
 icon: 'check',
 duration: 4000,
 });

 return stops;
}

// ============================================================================
// Component
// ============================================================================

export const VoxelGuidedTour: React.FC<VoxelGuidedTourProps> = ({
 visible = true,
 stops: customStops,
 onComplete,
 onClose,
 onNavigate,
 autoPlayInterval = DEFAULT_AUTO_PLAY_INTERVAL,
 className = '',
}) => {
 const [currentStopIndex, setCurrentStopIndex] = useState(0);
 const [isPlaying, setIsPlaying] = useState(false);
 const [hasStarted, setHasStarted] = useState(false);

 // Get nodes from store
 const nodes = useVoxelStore((state) => Array.from(state.nodes.values()));
 const selectNode = useVoxelStore((state) => state.selectNode);

 // Generate or use custom stops
 // If customStops is explicitly provided (even empty), use it; otherwise auto-generate
 const tourStops = useMemo(() => {
 if (customStops !== undefined) {
 return customStops;
 }
 return generateTourStops(nodes);
 }, [customStops, nodes]);

 const currentStop = tourStops[currentStopIndex];
 const isFirstStop = currentStopIndex === 0;
 const isLastStop = currentStopIndex === tourStops.length - 1;
 const progress = ((currentStopIndex + 1) / tourStops.length) * 100;

 // Navigate to a stop
 const navigateToStop = useCallback(
 (index: number) => {
 if (index < 0 || index >= tourStops.length) return;

 setCurrentStopIndex(index);
 const stop = tourStops[index];

 // Highlight node if specified
 if (stop.highlightNodeId) {
 selectNode(stop.highlightNodeId);
 }

 // Trigger navigation callback
 if (onNavigate) {
 onNavigate(stop);
 }
 },
 [tourStops, selectNode, onNavigate]
 );

 // Auto-play logic
 useEffect(() => {
 if (!isPlaying || !hasStarted || autoPlayInterval === 0) return;

 const stopDuration = currentStop?.duration || DEFAULT_STOP_DURATION;
 const interval = Math.max(stopDuration, autoPlayInterval);

 const timer = setTimeout(() => {
 if (isLastStop) {
 setIsPlaying(false);
 if (onComplete) onComplete();
 } else {
 navigateToStop(currentStopIndex + 1);
 }
 }, interval);

 return () => clearTimeout(timer);
 }, [
 isPlaying,
 hasStarted,
 currentStopIndex,
 isLastStop,
 autoPlayInterval,
 currentStop?.duration,
 navigateToStop,
 onComplete,
 ]);

 // Start tour
 const startTour = useCallback(() => {
 setHasStarted(true);
 setIsPlaying(true);
 navigateToStop(0);
 }, [navigateToStop]);

 // Controls
 const handlePrevious = useCallback(() => {
 navigateToStop(currentStopIndex - 1);
 }, [currentStopIndex, navigateToStop]);

 const handleNext = useCallback(() => {
 if (isLastStop) {
 if (onComplete) onComplete();
 } else {
 navigateToStop(currentStopIndex + 1);
 }
 }, [currentStopIndex, isLastStop, navigateToStop, onComplete]);

 const handleSkip = useCallback(() => {
 setIsPlaying(false);
 if (onComplete) onComplete();
 }, [onComplete]);

 const togglePlay = useCallback(() => {
 setIsPlaying((prev) => !prev);
 }, []);

 const panelStyles = getVoxelPanelStyles();

 if (!visible || tourStops.length === 0) return null;

 const IconComponent = currentStop ? ICON_MAP[currentStop.icon] : MapPin;

 // Start screen
 if (!hasStarted) {
 return (
 <div
 className={`fixed inset-0 z-modal flex items-center justify-center ${className}`}
 style={{ background: 'var(--overlay-heavy, hsl(var(--foreground) / 0.7))' }}
 >
 <div
 className="max-w-md p-6 rounded-2xl text-center"
 style={{
 ...panelStyles,
 }}
 >
 <div
   className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
   style={{ background: 'color-mix(in srgb, hsl(var(--chart-series-1)) 20%, transparent)' }}
 >
 <MapPin className="w-8 h-8" style={{ color: VOXEL_NODE_TYPE_COLORS_CSS.asset }} />
 </div>
 <h2 className="text-xl font-semibold text-foreground mb-2">Guided Tour</h2>
 <p className="text-muted-foreground mb-6">
 Take a quick tour through your GRC landscape and discover key areas that need attention.
 </p>
 <div className="flex gap-3 justify-center">
 <button
 onClick={onClose}
 className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
 Skip
 </button>
 <button
 onClick={startTour}
 className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
 <Play className="w-4 h-4" />
 Start Tour
 </button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-modal ${className}`}>
 <div
 className="w-96 rounded-3xl overflow-hidden"
 style={{
 ...panelStyles,
 }}
 >
 {/* Progress bar */}
 <div className="h-1 bg-muted">
 <div
 className="h-full transition-all duration-500"
 style={{
   width: `${progress}%`,
   background: VOXEL_NODE_TYPE_COLORS_CSS.asset,
 }}
 />
 </div>

 {/* Content */}
 <div className="p-4">
 <div className="flex items-start gap-3 mb-3">
 <div
 className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
 style={{
 background: currentStop ? ICON_BG_COLORS[currentStop.icon] : ICON_BG_COLORS.location,
 }}
 >
 <IconComponent
 className="w-5 h-5"
 style={{
  color: currentStop ? ICON_COLORS[currentStop.icon] : ICON_COLORS.location,
 }}
 />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between mb-1">
 <h3 className="text-sm font-medium text-foreground truncate">{currentStop?.title}</h3>
 <span className="text-xs text-muted-foreground flex-shrink-0">
  {currentStopIndex + 1} / {tourStops.length}
 </span>
 </div>
 <p className="text-sm text-muted-foreground">{currentStop?.description}</p>
 </div>
 </div>

 {/* Controls */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <button
 onClick={handlePrevious}
 disabled={isFirstStop}
 className="min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted/50 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 aria-label="Arrêt précédent"
 >
 <ChevronLeft className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
 </button>
 <button
 onClick={togglePlay}
 className="min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 aria-label={isPlaying ? 'Mettre en pause la visite' : 'Lancer la visite'}
 >
 {isPlaying ? (
  <Pause className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
 ) : (
  <Play className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
 )}
 </button>
 <button
 onClick={handleNext}
 className="min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 aria-label={isLastStop ? 'Terminer la visite' : 'Arrêt suivant'}
 >
 <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
 </button>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={handleSkip}
 className="px-3 py-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
 <SkipForward className="w-3 h-3" />
 Skip
 </button>
 <button
 onClick={onClose}
 className="min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 aria-label="Fermer la visite"
 >
 <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

export default VoxelGuidedTour;
