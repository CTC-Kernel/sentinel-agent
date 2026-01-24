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

  if (!visible || tourStops.length === 0) return null;

  const IconComponent = currentStop ? ICON_MAP[currentStop.icon] : MapPin;

  // Start screen
  if (!hasStarted) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${className}`}
        style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      >
        <div
          className="max-w-md p-6 rounded-2xl text-center"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Guided Tour</h2>
          <p className="text-muted-foreground mb-6">
            Take a quick tour through your GRC landscape and discover key areas that need attention.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={startTour}
              className="px-6 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-2"
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
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 ${className}`}>
      <div
        className="w-96 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-700">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  currentStop?.icon === 'risk'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : currentStop?.icon === 'control'
                      ? 'rgba(139, 92, 246, 0.2)'
                      : 'rgba(59, 130, 246, 0.2)',
              }}
            >
              <IconComponent
                className="w-5 h-5"
                style={{
                  color:
                    currentStop?.icon === 'risk'
                      ? '#EF4444'
                      : currentStop?.icon === 'control'
                        ? '#8B5CF6'
                        : '#3B82F6',
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-white truncate">{currentStop?.title}</h3>
                <span className="text-xs text-slate-500 flex-shrink-0">
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
                className="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous stop"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                aria-label={isPlaying ? 'Pause tour' : 'Play tour'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Play className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={handleNext}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                aria-label={isLastStop ? 'Finish tour' : 'Next stop'}
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                aria-label="Close tour"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoxelGuidedTour;
