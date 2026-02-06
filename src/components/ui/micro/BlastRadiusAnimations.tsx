/**
 * BlastRadiusAnimations Component
 *
 * Animated visualization components for blast radius analysis.
 * Creates "aha moments" when users see impact propagation visually.
 *
 * Components:
 * - BlastRadiusReveal: Animated cascade of affected nodes
 * - ImpactPropagationLine: Animated connection lines
 * - WhatIfComparison: Before/after impact comparison
 * - ImpactPulse: Pulsing effect for critical nodes
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Shield, AlertTriangle, TrendingDown, TrendingUp, Zap, Check } from '../Icons';
import { cn } from '@/lib/utils';
import {
 appleEasing,
 triggerConfetti,
 triggerHaptic,
} from '@/utils/microInteractions';

// ============================================================================
// Types
// ============================================================================

export interface AffectedNodeData {
 id: string;
 label: string;
 type: string;
 impact: number;
 depth: number;
 path?: string[];
}

export interface BlastRadiusRevealProps {
 /** Source node information */
 sourceNode: {
 id: string;
 label: string;
 type: string;
 };
 /** List of affected nodes */
 affectedNodes: AffectedNodeData[];
 /** Whether animation is active */
 isAnimating?: boolean;
 /** Callback when node is clicked */
 onNodeClick?: (nodeId: string) => void;
 /** Animation speed multiplier (1 = normal) */
 speed?: number;
 /** Custom class name */
 className?: string;
}

export interface WhatIfComparisonProps {
 /** Baseline impact value */
 baselineImpact: number;
 /** Scenario impact value */
 scenarioImpact: number;
 /** Baseline affected count */
 baselineCount: number;
 /** Scenario affected count */
 scenarioCount: number;
 /** Nodes no longer affected */
 protectedNodes?: string[];
 /** Whether to show celebration on improvement */
 celebrateImprovement?: boolean;
 /** Custom class name */
 className?: string;
}

export interface ImpactPulseProps {
 /** Severity level */
 severity: 'critical' | 'high' | 'medium' | 'low';
 /** Size of the pulse */
 size?: 'sm' | 'md' | 'lg';
 /** Children to wrap */
 children: React.ReactNode;
 /** Whether pulse is active */
 active?: boolean;
}

// ============================================================================
// Animation Variants
// ============================================================================

const nodeRevealVariants: Variants = {
 hidden: {
 opacity: 0,
 scale: 0,
 y: 20,
 },
 visible: (custom: { delay: number; impact: number }) => ({
 opacity: 1,
 scale: 1,
 y: 0,
 transition: {
 delay: custom.delay,
 duration: 0.5,
 ease: appleEasing,
 },
 }),
 exit: {
 opacity: 0,
 scale: 0.8,
 transition: { duration: 0.3 },
 },
};



// ============================================================================
// Components
// ============================================================================

/**
 * Impact Pulse - Pulsing effect for nodes based on severity
 */
export const ImpactPulse: React.FC<ImpactPulseProps> = ({
 severity,
 size = 'md',
 children,
 active = true,
}) => {
 const severityColors = {
 critical: 'rgba(239, 68, 68, 0.4)', // red-500
 high: 'rgba(249, 115, 22, 0.4)', // orange-500
 medium: 'rgba(234, 179, 8, 0.4)', // yellow-500
 low: 'rgba(34, 197, 94, 0.4)', // green-500
 };

 const sizeClasses = {
 sm: 'p-1',
 md: 'p-2',
 lg: 'p-3',
 };

 const color = severityColors[severity];

 return (
 <motion.div
 className={cn('relative inline-flex rounded-full', sizeClasses[size])}
 animate={
 active && severity === 'critical'
 ? {
 boxShadow: [
 `0 0 0 0 ${color}`,
 `0 0 0 ${size === 'lg' ? '20px' : '12px'} rgba(239, 68, 68, 0)`,
 ],
 }
 : {}
 }
 transition={{
 repeat: Infinity,
 duration: 1.5,
 ease: 'easeOut',
 }}
 >
 {children}
 </motion.div>
 );
};

/**
 * Animated node in the blast radius list
 */
const AnimatedAffectedNode: React.FC<{
 node: AffectedNodeData;
 index: number;
 speed: number;
 onClick?: (nodeId: string) => void;
}> = ({ node, index, speed, onClick }) => {
 const delay = (node.depth * 0.2 + index * 0.05) / speed;
 const impactLevel =
 node.impact >= 0.75
 ? 'critical'
 : node.impact >= 0.5
 ? 'high'
 : node.impact >= 0.25
 ? 'medium'
 : 'low';

 return (
 <motion.div
 variants={nodeRevealVariants}
 initial="hidden"
 animate="visible"
 exit="exit"
 custom={{ delay, impact: node.impact }}
 whileHover={{ x: 4, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
 onClick={() => onClick?.(node.id)}
 className={cn(
 'flex items-center gap-3 p-3 rounded-lg cursor-pointer',
 'border border-transparent hover:border-primary/30',
 'transition-colors duration-200'
 )}
 >
 {/* Depth indicator */}
 <div className="flex items-center gap-1">
 {Array.from({ length: node.depth }).map((_, i) => (
 <motion.div
 key={i || 'unknown'}
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: delay + i * 0.05 }}
 className="w-1.5 h-1.5 rounded-full bg-muted"
 />
 ))}
 </div>

 {/* Node info */}
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm text-foreground truncate">
 {node.label}
 </p>
 <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
 </div>

 {/* Impact badge with pulse for critical */}
 <ImpactPulse severity={impactLevel} size="sm" active={impactLevel === 'critical'}>
 <motion.span
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
 className={cn(
 'px-2 py-1 rounded-full text-xs font-bold',
 impactLevel === 'critical' && 'bg-error-100 text-error-600',
 impactLevel === 'high' && 'bg-warning-100 text-warning-600',
 impactLevel === 'medium' && 'bg-yellow-100 text-yellow-600',
 impactLevel === 'low' && 'bg-success-100 text-success-600'
 )}
 >
 {Math.round(node.impact * 100)}%
 </motion.span>
 </ImpactPulse>
 </motion.div>
 );
};

/**
 * BlastRadiusReveal - Main animated list of affected nodes
 */
export const BlastRadiusReveal: React.FC<BlastRadiusRevealProps> = ({
 sourceNode,
 affectedNodes,
 isAnimating = true,
 onNodeClick,
 speed = 1,
 className,
}) => {
 const [revealed, setRevealed] = useState(false);

 useEffect(() => {
 if (isAnimating && affectedNodes.length > 0) {
 const timer = setTimeout(() => {
 setRevealed(true);
 // Trigger haptic on significant impact
 if (affectedNodes.length > 5) {
 triggerHaptic('medium');
 }
 }, 100);
 return () => clearTimeout(timer);
 }
 }, [isAnimating, affectedNodes.length]);

 // Sort by depth then impact
 const sortedNodes = [...affectedNodes].sort((a, b) => {
 if (a.depth !== b.depth) return a.depth - b.depth;
 return b.impact - a.impact;
 });

 // Group by depth for visual hierarchy
 const nodesByDepth = sortedNodes.reduce((acc, node) => {
 if (!acc[node.depth]) acc[node.depth] = [];
 acc[node.depth].push(node);
 return acc;
 }, {} as Record<number, AffectedNodeData[]>);

 const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number), 0);

 return (
 <div className={cn('space-y-4', className)}>
 {/* Source node */}
 <motion.div
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 className="flex items-center gap-3 p-4 bg-primary/10 dark:bg-primary rounded-3xl border border-primary/30 dark:border-primary/90"
 >
 <motion.div
 animate={{
 boxShadow: [
 '0 0 0 0 rgba(59, 130, 246, 0.4)',
 '0 0 0 12px rgba(59, 130, 246, 0)',
 ],
 }}
 transition={{ repeat: Infinity, duration: 2 }}
 className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
 >
 <Zap className="w-5 h-5 text-white" />
 </motion.div>
 <div>
 <p className="font-bold text-primary dark:text-primary/50">
 {sourceNode.label}
 </p>
 <p className="text-xs text-primary">Source de l'impact</p>
 </div>
 </motion.div>

 {/* Propagation indicator */}
 {maxDepth > 0 && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 transition={{ delay: 0.3 }}
 className="flex items-center gap-2 text-sm text-muted-foreground"
 >
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: '100%' }}
 transition={{ delay: 0.5, duration: 0.8, ease: appleEasing }}
 className="h-0.5 bg-gradient-to-r from-primary via-orange-500 to-red-500 rounded-full"
 />
 <span className="whitespace-nowrap font-medium">
 {affectedNodes.length} elements impactes
 </span>
 </motion.div>
 )}

 {/* Affected nodes by depth */}
 <div className="space-y-2 max-h-[400px] overflow-y-auto">
 <AnimatePresence mode="popLayout">
 {revealed &&
 sortedNodes.map((node, index) => (
 <AnimatedAffectedNode
 key={node.id || 'unknown'}
 node={node}
 index={index}
 speed={speed}
 onClick={onNodeClick}
 />
 ))}
 </AnimatePresence>
 </div>

 {/* Summary message - AHA MOMENT */}
 {revealed && affectedNodes.length > 0 && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: (maxDepth * 0.2 + affectedNodes.length * 0.05) / speed + 0.5 }}
 className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-200 dark:border-amber-800 dark:border-amber-800"
 >
 <div className="flex items-start gap-3">
 <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
 <div>
 <p className="font-medium text-amber-800 dark:text-amber-200">
 Zone d'impact identifiee
 </p>
 <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">
 Si ce risque se materialise, <strong>{affectedNodes.length} elements</strong> seront
 impactes sur <strong>{maxDepth} niveaux</strong> de profondeur.
 </p>
 </div>
 </div>
 </motion.div>
 )}
 </div>
 );
};

/**
 * WhatIfComparison - Before/After comparison visualization
 */
export const WhatIfComparison: React.FC<WhatIfComparisonProps> = ({
 baselineImpact,
 scenarioImpact,
 protectedNodes = [],
 celebrateImprovement = true,
 className,
}) => {
 const impactDelta = scenarioImpact - baselineImpact;
 // const countDelta = scenarioCount - baselineCount;
 const isImprovement = impactDelta < 0;
 const improvementPercent = baselineImpact > 0
 ? Math.abs(Math.round((impactDelta / baselineImpact) * 100))
 : 0;

 useEffect(() => {
 // Trigger celebration for significant improvements
 if (celebrateImprovement && isImprovement && improvementPercent >= 20) {
 setTimeout(() => {
 triggerConfetti({ particleCount: 60, spread: 50 });
 triggerHaptic('heavy');
 }, 1000);
 }
 }, [celebrateImprovement, isImprovement, improvementPercent]);

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className={cn('space-y-4', className)}
 >
 {/* Comparison bars */}
 <div className="space-y-3">
 {/* Baseline */}
 <div className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Situation actuelle</span>
 <span className="font-medium">{Math.round(baselineImpact * 100)}%</span>
 </div>
 <div className="h-3 bg-muted rounded-full overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${baselineImpact * 100}%` }}
 transition={{ duration: 0.8, ease: appleEasing }}
 className="h-full bg-muted-foreground rounded-full"
 />
 </div>
 </div>

 {/* Scenario */}
 <div className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Avec mitigation</span>
 <span className={cn('font-medium', isImprovement ? 'text-success-500' : 'text-error-500')}>
 {Math.round(scenarioImpact * 100)}%
 </span>
 </div>
 <div className="h-3 bg-muted rounded-full overflow-hidden">
 <motion.div
 initial={{ width: `${baselineImpact * 100}%` }}
 animate={{ width: `${scenarioImpact * 100}%` }}
 transition={{ duration: 0.8, delay: 0.3, ease: appleEasing }}
 className={cn(
 'h-full rounded-full',
 isImprovement ? 'bg-success-500' : 'bg-error-500'
 )}
 />
 </div>
 </div>
 </div>

 {/* Delta indicator - AHA MOMENT */}
 <motion.div
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
 className={cn(
 'flex items-center justify-center gap-3 p-4 rounded-3xl',
 isImprovement
 ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
 : 'bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800'
 )}
 >
 <motion.div
 initial={{ rotate: 0 }}
 animate={{ rotate: isImprovement ? 0 : 180 }}
 transition={{ delay: 1, type: 'spring' }}
 >
 {isImprovement ? (
 <TrendingDown className="w-8 h-8 text-success-500" />
 ) : (
 <TrendingUp className="w-8 h-8 text-error-500" />
 )}
 </motion.div>
 <div className="text-center">
 <motion.p
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 1 }}
 className={cn(
 'text-2xl font-bold',
 isImprovement ? 'text-success-600' : 'text-error-600'
 )}
 >
 {isImprovement ? '-' : '+'}
 {improvementPercent}%
 </motion.p>
 <p className={cn('text-sm', isImprovement ? 'text-success-600' : 'text-error-600')}>
 {isImprovement ? "Reduction de l'impact" : "Augmentation de l'impact"}
 </p>
 </div>
 </motion.div>

 {/* Protected nodes count */}
 {protectedNodes.length > 0 && (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 1.2 }}
 className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg"
 >
 <Shield className="w-5 h-5 text-success-500" />
 <span className="text-sm text-success-700 dark:text-success-300">
 <strong>{protectedNodes.length}</strong> elements proteges par cette mitigation
 </span>
 {celebrateImprovement && protectedNodes.length >= 5 && (
 <motion.span
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: 1.5, type: 'spring' }}
 >
 🎉
 </motion.span>
 )}
 </motion.div>
 )}

 {/* Success message for major improvements */}
 {isImprovement && improvementPercent >= 30 && (
 <motion.div
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 1.5, type: 'spring' }}
 className="flex items-center gap-3 p-4 bg-gradient-to-r from-success-500 to-success-600 rounded-3xl text-white"
 >
 <motion.div
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: 1.8, type: 'spring', stiffness: 300 }}
 >
 <Check className="w-6 h-6" />
 </motion.div>
 <div>
 <p className="font-bold">Excellente mitigation !</p>
 <p className="text-sm text-success-100">
 Cette action reduit significativement la zone d'impact.
 </p>
 </div>
 </motion.div>
 )}
 </motion.div>
 );
};

/**
 * AnimatedStatsCard - Animated statistics card for blast radius
 */
export const AnimatedStatsCard: React.FC<{
 label: string;
 value: number | string;
 icon: React.ReactNode;
 color?: 'default' | 'success' | 'warning' | 'danger';
 delay?: number;
 animate?: boolean;
}> = ({ label, value, icon, color = 'default', delay = 0, animate = true }) => {
 const colorClasses = {
 default: 'bg-muted text-muted-foreground ',
 success: 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
 warning: 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400',
 danger: 'bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400',
 };

 return (
 <motion.div
 initial={animate ? { opacity: 0, y: 20, scale: 0.9 } : false}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 transition={{ delay, duration: 0.4, ease: appleEasing }}
 className={cn(
 'flex items-center gap-3 p-3 rounded-3xl',
 colorClasses[color]
 )}
 >
 <div className="flex-shrink-0">{icon}</div>
 <div>
 <p className="text-xs opacity-70">{label}</p>
 <p className="text-lg font-bold">{value}</p>
 </div>
 </motion.div>
 );
};

export default {
 BlastRadiusReveal,
 WhatIfComparison,
 ImpactPulse,
 AnimatedStatsCard,
};
