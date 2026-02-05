/**
 * Micro-Interactions UI Components
 *
 * Collection of animated components for creating "aha moments"
 * throughout the Sentinel GRC v2 application.
 *
 * @module ui/micro
 */

// Score & Counter Animations
export {
 AnimatedScoreCounter,
 type AnimatedScoreCounterProps,
} from './AnimatedScoreCounter';

// Widget Grid Animations
export {
 AnimatedWidgetGrid,
 AnimatedWidgetCard,
 type AnimatedWidgetGridProps,
 type AnimatedWidgetCardProps,
} from './AnimatedWidgetGrid';

// Blast Radius Visualizations
export {
 BlastRadiusReveal,
 WhatIfComparison,
 ImpactPulse,
 AnimatedStatsCard,
 type BlastRadiusRevealProps,
 type WhatIfComparisonProps,
 type ImpactPulseProps,
 type AffectedNodeData,
} from './BlastRadiusAnimations';
