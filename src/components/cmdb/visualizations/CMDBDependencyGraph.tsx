/**
 * CMDB Dependency Graph
 *
 * Premium interactive visualization of CI dependencies using force-directed layout.
 * Features glassmorphic nodes, animated connections, and 3D perspective.
 *
 * @module components/cmdb/visualizations/CMDBDependencyGraph
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { useStore } from '@/store';
import { ConfigurationItem, CMDBRelationship, CIClass, RelationshipType } from '@/types/cmdb';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface GraphNode {
  id: string;
  ci: ConfigurationItem;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCenter: boolean;
  depth: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: CMDBRelationship;
}

interface CMDBDependencyGraphProps {
  /** Center CI */
  centerCI: ConfigurationItem;
  /** Related CIs */
  relatedCIs: ConfigurationItem[];
  /** Relationships between CIs */
  relationships: CMDBRelationship[];
  /** Max depth to display */
  depth?: number;
  /** Callback when a node is clicked */
  onNodeClick?: (ci: ConfigurationItem) => void;
  /** Interactive mode */
  interactive?: boolean;
  /** Show labels */
  showLabels?: boolean;
  /** Height of the graph */
  height?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CI_CLASS_COLORS: Record<CIClass, { primary: string; glow: string; gradient: string }> = {
  Hardware: {
    primary: 'hsl(221, 83%, 53%)',
    glow: 'rgba(59, 130, 246, 0.4)',
    gradient: 'from-blue-500 to-blue-600',
  },
  Software: {
    primary: 'hsl(142, 71%, 45%)',
    glow: 'rgba(34, 197, 94, 0.4)',
    gradient: 'from-green-500 to-green-600',
  },
  Service: {
    primary: 'hsl(262, 83%, 58%)',
    glow: 'rgba(139, 92, 246, 0.4)',
    gradient: 'from-purple-500 to-purple-600',
  },
  Cloud: {
    primary: 'hsl(199, 89%, 48%)',
    glow: 'rgba(14, 165, 233, 0.4)',
    gradient: 'from-cyan-500 to-cyan-600',
  },
  Document: {
    primary: 'hsl(38, 92%, 50%)',
    glow: 'rgba(245, 158, 11, 0.4)',
    gradient: 'from-amber-500 to-amber-600',
  },
  Network: {
    primary: 'hsl(0, 84%, 60%)',
    glow: 'rgba(239, 68, 68, 0.4)',
    gradient: 'from-red-500 to-red-600',
  },
  Container: {
    primary: 'hsl(328, 85%, 57%)',
    glow: 'rgba(236, 72, 153, 0.4)',
    gradient: 'from-pink-500 to-pink-600',
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

const RELATIONSHIP_STYLES: Record<RelationshipType, { color: string; dashArray: string }> = {
  depends_on: { color: 'hsl(0, 84%, 60%)', dashArray: '' },
  uses: { color: 'hsl(38, 92%, 50%)', dashArray: '5,5' },
  runs_on: { color: 'hsl(221, 83%, 53%)', dashArray: '' },
  hosted_on: { color: 'hsl(142, 71%, 45%)', dashArray: '' },
  installed_on: { color: 'hsl(199, 89%, 48%)', dashArray: '5,5' },
  connects_to: { color: 'hsl(262, 83%, 58%)', dashArray: '10,5' },
  interfaces_with: { color: 'hsl(328, 85%, 57%)', dashArray: '10,5' },
  contains: { color: 'hsl(142, 71%, 45%)', dashArray: '' },
  member_of: { color: 'hsl(221, 83%, 53%)', dashArray: '5,5' },
  instance_of: { color: 'hsl(38, 92%, 50%)', dashArray: '5,5' },
  provides: { color: 'hsl(142, 71%, 45%)', dashArray: '' },
  consumes: { color: 'hsl(0, 84%, 60%)', dashArray: '5,5' },
  owned_by: { color: 'hsl(262, 83%, 58%)', dashArray: '10,5' },
  supported_by: { color: 'hsl(199, 89%, 48%)', dashArray: '10,5' },
  // Inverse types
  hosts: { color: 'hsl(221, 83%, 53%)', dashArray: '' },
  has_installed: { color: 'hsl(199, 89%, 48%)', dashArray: '5,5' },
  contained_in: { color: 'hsl(142, 71%, 45%)', dashArray: '' },
  has_member: { color: 'hsl(221, 83%, 53%)', dashArray: '5,5' },
  owns: { color: 'hsl(262, 83%, 58%)', dashArray: '10,5' },
  supports: { color: 'hsl(199, 89%, 48%)', dashArray: '10,5' },
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('pointer-events-none', className)}>
    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
  </div>
);

// =============================================================================
// GRAPH NODE COMPONENT
// =============================================================================

interface GraphNodeComponentProps {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (ci: ConfigurationItem) => void;
  showLabel: boolean;
  scale: number;
}

const GraphNodeComponent: React.FC<GraphNodeComponentProps> = ({
  node,
  isHovered,
  isSelected,
  onHover,
  onClick,
  showLabel,
  scale: _scale,
}) => {
  const colors = CI_CLASS_COLORS[node.ci.ciClass];
  const Icon = CI_CLASS_ICONS[node.ci.ciClass];
  const size = node.isCenter ? 60 : 44;
  const iconSize = node.isCenter ? 28 : 20;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: node.depth * 0.1,
      }}
      style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node.ci)}
      className="cursor-pointer"
    >
      {/* Glow effect */}
      <motion.circle
        r={size * 0.8}
        fill={colors.glow}
        animate={{
          r: isHovered || isSelected ? size * 1.2 : size * 0.8,
          opacity: isHovered || isSelected ? 0.6 : 0.3,
        }}
        transition={{ duration: 0.3 }}
        style={{ filter: 'blur(12px)' }}
      />

      {/* Pulse ring for center node */}
      {node.isCenter && (
        <motion.circle
          r={size * 0.9}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          animate={{
            r: [size * 0.9, size * 1.3, size * 0.9],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Main circle with gradient */}
      <defs>
        <linearGradient id={`grad-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.primary} stopOpacity={0.7} />
        </linearGradient>
        <filter id={`shadow-${node.id}`}>
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
        </filter>
      </defs>

      <motion.circle
        r={size / 2}
        fill={`url(#grad-${node.id})`}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={2}
        filter={`url(#shadow-${node.id})`}
        animate={{
          r: isHovered ? (size / 2) * 1.15 : size / 2,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />

      {/* Icon */}
      <foreignObject
        x={-iconSize / 2}
        y={-iconSize / 2}
        width={iconSize}
        height={iconSize}
      >
        <Icon className="w-full h-full text-white drop-shadow-lg" />
      </foreignObject>

      {/* Criticality indicator */}
      {node.ci.criticality === 'Critical' && (
        <motion.circle
          cx={size / 2 - 5}
          cy={-size / 2 + 5}
          r={6}
          fill="#EF4444"
          stroke="white"
          strokeWidth={2}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Label */}
      {showLabel && (
        <motion.text
          y={size / 2 + 18}
          textAnchor="middle"
          fill="currentColor"
          className="text-xs font-medium pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {node.ci.name.length > 15
            ? node.ci.name.substring(0, 15) + '...'
            : node.ci.name}
        </motion.text>
      )}
    </motion.g>
  );
};

// =============================================================================
// GRAPH EDGE COMPONENT
// =============================================================================

interface GraphEdgeComponentProps {
  edge: GraphEdge;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  isHighlighted: boolean;
}

const GraphEdgeComponent: React.FC<GraphEdgeComponentProps> = ({
  edge,
  sourceNode,
  targetNode,
  isHighlighted,
}) => {
  const style = RELATIONSHIP_STYLES[edge.relationship.relationshipType];

  // Calculate path with slight curve
  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;
  const dr = Math.sqrt(dx * dx + dy * dy) * 0.5;

  const path = `M ${sourceNode.x} ${sourceNode.y} A ${dr} ${dr} 0 0 1 ${targetNode.x} ${targetNode.y}`;

  return (
    <g>
      {/* Glow effect for highlighted edges */}
      {isHighlighted && (
        <motion.path
          d={path}
          fill="none"
          stroke={style.color}
          strokeWidth={6}
          strokeOpacity={0.3}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Main path */}
      <motion.path
        d={path}
        fill="none"
        stroke={style.color}
        strokeWidth={isHighlighted ? 3 : 2}
        strokeOpacity={isHighlighted ? 1 : 0.5}
        strokeDasharray={style.dashArray}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />

      {/* Animated flow indicator */}
      {isHighlighted && (
        <motion.circle
          r={4}
          fill={style.color}
          animate={{
            offsetDistance: ['0%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            offsetPath: `path("${path}")`,
          }}
        />
      )}

      {/* Arrow marker */}
      <defs>
        <marker
          id={`arrow-${edge.source}-${edge.target}`}
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={style.color}
            fillOpacity={isHighlighted ? 1 : 0.5}
          />
        </marker>
      </defs>
    </g>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CMDBDependencyGraph: React.FC<CMDBDependencyGraphProps> = ({
  centerCI,
  relatedCIs,
  relationships,
  depth: _depth = 2,
  onNodeClick,
  interactive: _interactive = true,
  showLabels = true,
  height = 500,
}) => {
  const { t } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [scale, setScale] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(centerCI.id);

  // Build graph data
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    // Add center node
    nodeMap.set(centerCI.id, {
      id: centerCI.id,
      ci: centerCI,
      x: dimensions.width / 2,
      y: dimensions.height / 2,
      vx: 0,
      vy: 0,
      radius: 30,
      isCenter: true,
      depth: 0,
    });

    // Add related nodes with circular layout
    const angleStep = (2 * Math.PI) / Math.max(relatedCIs.length, 1);
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35;

    relatedCIs.forEach((ci, index) => {
      const angle = angleStep * index - Math.PI / 2;
      nodeMap.set(ci.id, {
        id: ci.id,
        ci,
        x: dimensions.width / 2 + Math.cos(angle) * radius,
        y: dimensions.height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: 22,
        isCenter: false,
        depth: 1,
      });
    });

    // Add edges
    relationships.forEach((rel) => {
      if (nodeMap.has(rel.sourceId) && nodeMap.has(rel.targetId)) {
        edgeList.push({
          source: rel.sourceId,
          target: rel.targetId,
          relationship: rel,
        });
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
    };
  }, [centerCI, relatedCIs, relationships, dimensions]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  const handleNodeClick = useCallback(
    (ci: ConfigurationItem) => {
      setSelectedNode(ci.id);
      onNodeClick?.(ci);
    },
    [onNodeClick]
  );

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.max(0.5, Math.min(2, prev + delta)));
  };

  // Get highlighted edges (connected to hovered/selected node)
  const highlightedEdges = useMemo(() => {
    const activeNode = hoveredNode || selectedNode;
    if (!activeNode) return new Set<string>();

    return new Set(
      edges
        .filter((e) => e.source === activeNode || e.target === activeNode)
        .map((e) => `${e.source}-${e.target}`)
    );
  }, [edges, hoveredNode, selectedNode]);

  return (
    <div
      ref={containerRef}
      className="glass-premium rounded-3xl border border-border/40 relative overflow-hidden"
      style={{ height }}
    >
      <TechCorners />

      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-decorator">
        <CustomTooltip content={t('cmdb.graph.zoomIn', { defaultValue: 'Zoom +' })}>
          <Button
            variant="glass"
            size="icon"
            onClick={() => handleZoom(0.2)}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </CustomTooltip>
        <CustomTooltip content={t('cmdb.graph.zoomOut', { defaultValue: 'Zoom -' })}>
          <Button
            variant="glass"
            size="icon"
            onClick={() => handleZoom(-0.2)}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </CustomTooltip>
        <CustomTooltip content={t('cmdb.graph.reset', { defaultValue: 'Réinitialiser' })}>
          <Button
            variant="glass"
            size="icon"
            onClick={() => setScale(1)}
            className="h-8 w-8"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CustomTooltip>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-decorator">
        {Object.entries(CI_CLASS_COLORS).map(([cls, colors]) => (
          <Badge
            key={cls}
            variant="glass"
            className="text-xs gap-1"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: colors.primary }}
            />
            {cls}
          </Badge>
        ))}
      </div>

      {/* Stats */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-decorator">
        <Badge variant="soft" className="bg-primary/10 text-primary">
          <Layers className="h-3 w-3 mr-1" />
          {nodes.length} CIs
        </Badge>
        <Badge variant="soft" className="bg-purple-500/10 text-purple-600">
          {edges.length} Relations
        </Badge>
      </div>

      {/* SVG Graph */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Render edges first (below nodes) */}
        <g className="edges">
          {edges.length > 0 && edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <GraphEdgeComponent
                key={`${edge.source}-${edge.target}`}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                isHighlighted={highlightedEdges.has(`${edge.source}-${edge.target}`)}
              />
            );
          })}
        </g>

        {/* Render nodes */}
        <g className="nodes">
          {nodes.map((node) => (
            <GraphNodeComponent
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id}
              isSelected={selectedNode === node.id}
              onHover={setHoveredNode}
              onClick={handleNodeClick}
              showLabel={showLabels}
              scale={scale}
            />
          ))}
        </g>
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-4 glass-premium p-4 rounded-2xl border border-border/40 max-w-xs z-20"
          >
            {(() => {
              const node = nodes.find((n) => n.id === hoveredNode);
              if (!node) return null;
              const colors = CI_CLASS_COLORS[node.ci.ciClass];

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
                        {node.ci.ciClass} • {node.ci.ciType}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-1 font-medium">{node.ci.status}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DQS:</span>
                      <span className="ml-1 font-medium">{node.ci.dataQualityScore}%</span>
                    </div>
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

export default CMDBDependencyGraph;
