/**
 * Impact Blast Radius Visualization
 *
 * Premium animated visualization showing the blast radius of a CI failure.
 * Features concentric rings, animated impact waves, and interactive nodes.
 *
 * @module components/cmdb/visualizations/ImpactBlastRadius
 */

import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  AlertTriangle,
  Users,
  Zap,
  Target,
} from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { useStore } from '@/store';
import {
  ConfigurationItem,
  CIClass,
  ImpactNode,
  ImpactLevel,
  AffectedService,
} from '@/types/cmdb';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ImpactBlastRadiusProps {
  /** Center CI */
  centerCI: ConfigurationItem;
  /** Direct impact nodes (1 hop) */
  directImpact: ImpactNode[];
  /** Indirect impact nodes (2+ hops) */
  indirectImpact: ImpactNode[];
  /** Affected services */
  affectedServices: AffectedService[];
  /** Total affected users */
  estimatedUsers: number;
  /** Max hops displayed */
  maxDepth?: number;
  /** On node click callback */
  onNodeClick?: (node: ImpactNode) => void;
  /** Height of visualization */
  height?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const IMPACT_COLORS: Record<ImpactLevel, { primary: string; glow: string; ring: string }> = {
  Critical: {
    primary: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    ring: 'ring-destructive',
  },
  High: {
    primary: '#F97316',
    glow: 'rgba(249, 115, 22, 0.4)',
    ring: 'ring-orange-500',
  },
  Medium: {
    primary: '#EAB308',
    glow: 'rgba(234, 179, 8, 0.4)',
    ring: 'ring-warning',
  },
  Low: {
    primary: '#6B7280',
    glow: 'rgba(107, 114, 128, 0.3)',
    ring: 'ring-muted',
  },
};

const CI_CLASS_ICONS: Record<CIClass, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  Hardware: Server,
  Software: Database,
  Service: Globe,
  Cloud: Cloud,
  Document: FileText,
  Network: Network,
  Container: Box,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getImpactRingRadius = (depth: number, maxDepth: number, containerSize: number): number => {
  const minRadius = containerSize * 0.15;
  const maxRadius = containerSize * 0.45;
  const step = (maxRadius - minRadius) / maxDepth;
  return minRadius + step * depth;
};

// =============================================================================
// PULSE WAVE COMPONENT
// =============================================================================

const PulseWave: React.FC<{ radius: number; delay: number; color: string }> = ({
  radius,
  delay,
  color,
}) => (
  <motion.circle
    cx="50%"
    cy="50%"
    r={radius}
    fill="none"
    stroke={color}
    strokeWidth={2}
    initial={{ opacity: 0.6, scale: 0.8 }}
    animate={{
      opacity: [0.6, 0],
      scale: [0.8, 1.5],
    }}
    transition={{
      duration: 3,
      delay,
      repeat: Infinity,
      ease: 'easeOut',
    }}
  />
);

// =============================================================================
// IMPACT NODE COMPONENT
// =============================================================================

interface ImpactNodeDisplayProps {
  node: ImpactNode;
  x: number;
  y: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}

const ImpactNodeDisplay: React.FC<ImpactNodeDisplayProps> = ({
  node,
  x,
  y,
  isHovered,
  onHover,
  onClick,
}) => {
  const colors = IMPACT_COLORS[node.impactLevel];
  const Icon = CI_CLASS_ICONS[node.ci.ciClass] || Server;
  const size = 36;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: node.hop * 0.15,
      }}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onMouseEnter={() => onHover(node.ciId)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      className="cursor-pointer"
    >
      {/* Glow effect */}
      <motion.circle
        r={size * 0.7}
        fill={colors.glow}
        animate={{
          r: isHovered ? size * 1.1 : size * 0.7,
          opacity: isHovered ? 0.8 : 0.4,
        }}
        transition={{ duration: 0.2 }}
        style={{ filter: 'blur(8px)' }}
      />

      {/* Main circle */}
      <motion.circle
        r={size / 2}
        fill={colors.primary}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={2}
        animate={{
          scale: isHovered ? 1.15 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
        }}
      />

      {/* Icon */}
      <foreignObject
        x={-10}
        y={-10}
        width={20}
        height={20}
      >
        <Icon className="w-full h-full text-white" />
      </foreignObject>

      {/* Impact level indicator */}
      {node.impactLevel === 'Critical' && (
        <motion.circle
          cx={size / 2 - 4}
          cy={-size / 2 + 4}
          r={5}
          fill="#EF4444"
          stroke="white"
          strokeWidth={2}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.g>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ImpactBlastRadius: React.FC<ImpactBlastRadiusProps> = ({
  centerCI,
  directImpact,
  indirectImpact,
  affectedServices,
  estimatedUsers,
  maxDepth = 3,
  onNodeClick,
  height = 500,
}) => {
  const { t: _t } = useStore();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerSize = height;

  // Calculate node positions
  const nodePositions = useMemo(() => {
    const positions: { node: ImpactNode; x: number; y: number }[] = [];
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;

    // Group nodes by hop
    const nodesByHop = new Map<number, ImpactNode[]>();
    [...directImpact, ...indirectImpact].forEach((node) => {
      const hopNodes = nodesByHop.get(node.hop) || [];
      hopNodes.push(node);
      nodesByHop.set(node.hop, hopNodes);
    });

    // Position nodes in concentric circles
    nodesByHop.forEach((nodes, hop) => {
      const radius = getImpactRingRadius(hop, maxDepth, containerSize);
      const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);

      nodes.forEach((node, index) => {
        const angle = angleStep * index - Math.PI / 2;
        positions.push({
          node,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        });
      });
    });

    return positions;
  }, [directImpact, indirectImpact, containerSize, maxDepth]);

  const handleNodeClick = useCallback(
    (node: ImpactNode) => {
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  // Calculate stats
  const totalAffected = directImpact.length + indirectImpact.length;
  const criticalCount = [...directImpact, ...indirectImpact].filter(
    (n) => n.impactLevel === 'Critical'
  ).length;

  return (
    <div
      className="glass-premium rounded-3xl border border-border/40 relative overflow-hidden"
      style={{ height }}
    >
      {/* Tech corners */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-destructive/40 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-destructive/40 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-destructive/40 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-destructive/40 rounded-br-lg" />
      </div>

      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1)_0%,transparent_70%)] pointer-events-none" />

      {/* Stats bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Badge variant="glass" className="bg-destructive/10 text-destructive border-destructive/20">
            <Target className="h-3 w-3 mr-1" />
            {totalAffected} CIs impactés
          </Badge>
          {criticalCount > 0 && (
            <Badge variant="glass" className="bg-destructive/20 text-destructive animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {criticalCount} critiques
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {affectedServices.length > 0 && (
            <Badge variant="glass" className="bg-orange-500/10 text-orange-600">
              <Globe className="h-3 w-3 mr-1" />
              {affectedServices.length} services
            </Badge>
          )}
          {estimatedUsers > 0 && (
            <Badge variant="glass" className="bg-warning/10 text-warning">
              <Users className="h-3 w-3 mr-1" />
              ~{estimatedUsers.toLocaleString()} utilisateurs
            </Badge>
          )}
        </div>
      </div>

      {/* SVG Visualization */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${containerSize} ${containerSize}`}
        className="absolute inset-0"
      >
        {/* Definitions */}
        <defs>
          <filter id="blastGlow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="centerGradient">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* Pulse waves from center */}
        <g className="pulse-waves">
          <PulseWave
            radius={containerSize * 0.15}
            delay={0}
            color="rgba(239, 68, 68, 0.3)"
          />
          <PulseWave
            radius={containerSize * 0.25}
            delay={1}
            color="rgba(239, 68, 68, 0.2)"
          />
          <PulseWave
            radius={containerSize * 0.35}
            delay={2}
            color="rgba(239, 68, 68, 0.1)"
          />
        </g>

        {/* Concentric rings */}
        {Array.from({ length: maxDepth }, (_, i) => i + 1).map((hop) => (
          <motion.circle
            key={hop}
            cx="50%"
            cy="50%"
            r={getImpactRingRadius(hop, maxDepth, containerSize)}
            fill="none"
            stroke={`hsl(var(--border) / ${0.4 - hop * 0.1})`}
            strokeWidth={1}
            strokeDasharray="4 4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: hop * 0.2 }}
          />
        ))}

        {/* Connection lines from center to nodes */}
        <g className="connections">
          {nodePositions.map(({ node, x, y }) => (
            <motion.line
              key={`line-${node.ciId}`}
              x1={containerSize / 2}
              y1={containerSize / 2}
              x2={x}
              y2={y}
              stroke={IMPACT_COLORS[node.impactLevel].primary}
              strokeWidth={hoveredNode === node.ciId ? 2 : 1}
              strokeOpacity={hoveredNode === node.ciId ? 0.6 : 0.2}
              strokeDasharray={node.hop > 1 ? '4 4' : ''}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: node.hop * 0.1 }}
            />
          ))}
        </g>

        {/* Center node (impacted CI) */}
        <g style={{ transform: `translate(${containerSize / 2}px, ${containerSize / 2}px)` }}>
          {/* Pulsing danger ring */}
          <motion.circle
            r={50}
            fill="none"
            stroke="#EF4444"
            strokeWidth={3}
            animate={{
              r: [50, 60, 50],
              opacity: [0.8, 0.3, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Center circle */}
          <circle
            r={40}
            fill="url(#centerGradient)"
            stroke="white"
            strokeWidth={3}
            filter="url(#blastGlow)"
          />

          {/* Danger icon */}
          <foreignObject x={-16} y={-16} width={32} height={32}>
            <Zap className="w-full h-full text-white drop-shadow-lg" />
          </foreignObject>

          {/* Label */}
          <text
            y={60}
            textAnchor="middle"
            fill="currentColor"
            className="text-xs font-bold"
          >
            {centerCI.name}
          </text>
        </g>

        {/* Impact nodes */}
        <g className="impact-nodes">
          {nodePositions.map(({ node, x, y }) => (
            <ImpactNodeDisplay
              key={node.ciId}
              node={node}
              x={x}
              y={y}
              isHovered={hoveredNode === node.ciId}
              onHover={setHoveredNode}
              onClick={() => handleNodeClick(node)}
            />
          ))}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-10">
        {Object.entries(IMPACT_COLORS).map(([level, colors]) => (
          <Badge
            key={level}
            variant="glass"
            className="text-[10px] gap-1"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: colors.primary }}
            />
            {level}
          </Badge>
        ))}
      </div>

      {/* Hovered node tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-4 glass-premium p-4 rounded-2xl border border-border/40 max-w-xs z-20"
          >
            {(() => {
              const pos = nodePositions.find((p) => p.node.ciId === hoveredNode);
              if (!pos) return null;
              const { node } = pos;
              const colors = IMPACT_COLORS[node.impactLevel];

              return (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 rounded-xl"
                      style={{ backgroundColor: colors.glow }}
                    >
                      {React.createElement(CI_CLASS_ICONS[node.ci.ciClass], {
                        className: 'h-5 w-5',
                        style: { color: colors.primary },
                      })}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{node.ci.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {node.ci.ciClass} • {node.hop} hop{node.hop > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="soft"
                      className={cn(
                        'text-xs',
                        node.impactLevel === 'Critical' && 'bg-destructive/10 text-destructive',
                        node.impactLevel === 'High' && 'bg-orange-500/10 text-orange-600',
                        node.impactLevel === 'Medium' && 'bg-warning/10 text-warning',
                        node.impactLevel === 'Low' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      Impact: {node.impactLevel}
                    </Badge>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImpactBlastRadius;
