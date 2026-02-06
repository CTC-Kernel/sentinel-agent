/**
 * CMDB Topology Map
 *
 * Premium network topology visualization with 3D perspective,
 * animated connections, and interactive exploration.
 *
 * @module components/cmdb/visualizations/CMDBTopologyMap
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
  Eye,
  EyeOff,
  Layers,
  Filter,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { useStore } from '@/store';
import { ConfigurationItem, CMDBRelationship, CIClass, CIEnvironment } from '@/types/cmdb';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface TopologyNode {
  id: string;
  ci: ConfigurationItem;
  x: number;
  y: number;
  z: number;
  layer: number;
  connections: number;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  relationship: CMDBRelationship;
}

interface CMDBTopologyMapProps {
  /** All CIs to display */
  cis: ConfigurationItem[];
  /** All relationships */
  relationships: CMDBRelationship[];
  /** Selected CI ID */
  selectedCIId?: string | null;
  /** On CI select callback */
  onCISelect?: (ci: ConfigurationItem) => void;
  /** Height of visualization */
  height?: number;
  /** Enable 3D perspective */
  enable3D?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LAYER_CONFIG: Record<string, { y: number; label: string; color: string }> = {
  Service: { y: 0, label: 'Services', color: '#8B5CF6' },
  Software: { y: 1, label: 'Applications', color: '#22C55E' },
  Container: { y: 2, label: 'Containers', color: '#EC4899' },
  Hardware: { y: 3, label: 'Infrastructure', color: '#3B82F6' },
  Network: { y: 4, label: 'Réseau', color: '#EF4444' },
  Cloud: { y: 5, label: 'Cloud', color: '#06B6D4' },
  Document: { y: 6, label: 'Documents', color: '#F59E0B' },
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

const ENVIRONMENT_COLORS: Record<CIEnvironment, string> = {
  Production: '#EF4444',
  Staging: '#F59E0B',
  Development: '#22C55E',
  Test: '#3B82F6',
  DR: '#8B5CF6',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const get3DTransform = (node: TopologyNode, perspective: number, rotateY: number): string => {
  const translateZ = node.z * 50;
  return `
    perspective(${perspective}px)
    rotateY(${rotateY}deg)
    translateZ(${translateZ}px)
  `;
};

// =============================================================================
// TOPOLOGY NODE COMPONENT
// =============================================================================

interface TopologyNodeComponentProps {
  node: TopologyNode;
  isSelected: boolean;
  isHovered: boolean;
  isConnected: boolean;
  onSelect: (ci: ConfigurationItem) => void;
  onHover: (id: string | null) => void;
  enable3D: boolean;
  perspective: number;
  rotateY: number;
}

const TopologyNodeComponent: React.FC<TopologyNodeComponentProps> = ({
  node,
  isSelected,
  isHovered,
  isConnected,
  onSelect,
  onHover,
  enable3D,
  perspective,
  rotateY,
}) => {
  const layerConfig = LAYER_CONFIG[node.ci.ciClass] || LAYER_CONFIG.Hardware;
  const Icon = CI_CLASS_ICONS[node.ci.ciClass] || Server;
  const envColor = ENVIRONMENT_COLORS[node.ci.environment] || ENVIRONMENT_COLORS.Production;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: isSelected ? 1.2 : isHovered ? 1.1 : 1,
        opacity: isConnected || isSelected || isHovered ? 1 : 0.6,
        z: isSelected ? 50 : 0,
      }}
      whileHover={{ scale: 1.15 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        transform: enable3D ? get3DTransform(node, perspective, rotateY) : 'none',
        transformStyle: 'preserve-3d',
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(node.ci)}
      className="cursor-pointer"
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full blur-lg"
        style={{ backgroundColor: layerConfig.color }}
        animate={{
          scale: isSelected ? 2 : isHovered ? 1.5 : 1,
          opacity: isSelected ? 0.4 : isHovered ? 0.3 : 0.1,
        }}
      />

      {/* Main node */}
      <div
        className={cn(
          'relative w-12 h-12 rounded-xl flex items-center justify-center',
          'border-2 shadow-lg transition-all duration-200',
          isSelected && 'ring-4 ring-primary/50',
          !isConnected && !isSelected && !isHovered && 'grayscale'
        )}
        style={{
          backgroundColor: `${layerConfig.color}20`,
          borderColor: layerConfig.color,
          boxShadow: `0 0 20px ${layerConfig.color}40`,
        }}
      >
        <Icon className="h-6 w-6" style={{ color: layerConfig.color }} />

        {/* Environment indicator */}
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background"
          style={{ backgroundColor: envColor }}
        />

        {/* Connection count badge */}
        {node.connections > 0 && (
          <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-background border">
            {node.connections}
          </div>
        )}
      </div>

      {/* Label */}
      {(isHovered || isSelected) && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap"
        >
          <div className="px-2 py-1 rounded-lg bg-popover border text-xs font-medium shadow-lg">
            {node.ci.name}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// =============================================================================
// TOPOLOGY EDGE COMPONENT
// =============================================================================

interface TopologyEdgeComponentProps {
  edge: TopologyEdge;
  sourceNode: TopologyNode;
  targetNode: TopologyNode;
  isHighlighted: boolean;
}

const TopologyEdgeComponent: React.FC<TopologyEdgeComponentProps> = ({
  edge,
  sourceNode,
  targetNode,
  isHighlighted,
}) => {
  const sourceLayer = LAYER_CONFIG[sourceNode.ci.ciClass] || LAYER_CONFIG.Hardware;
  const targetLayer = LAYER_CONFIG[targetNode.ci.ciClass] || LAYER_CONFIG.Hardware;

  // Use gradient between the two layer colors
  const gradientId = `edge-gradient-${edge.id}`;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={sourceLayer.color} stopOpacity={isHighlighted ? 0.8 : 0.2} />
          <stop offset="100%" stopColor={targetLayer.color} stopOpacity={isHighlighted ? 0.8 : 0.2} />
        </linearGradient>
      </defs>

      <motion.line
        x1={sourceNode.x + 24}
        y1={sourceNode.y + 24}
        x2={targetNode.x + 24}
        y2={targetNode.y + 24}
        stroke={`url(#${gradientId})`}
        strokeWidth={isHighlighted ? 3 : 1}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Animated particle on highlighted edges */}
      {isHighlighted && (
        <motion.circle
          r={4}
          fill={sourceLayer.color}
          animate={{
            cx: [sourceNode.x + 24, targetNode.x + 24],
            cy: [sourceNode.y + 24, targetNode.y + 24],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </svg>
  );
};

// =============================================================================
// LAYER LABEL COMPONENT
// =============================================================================

interface LayerLabelProps {
  layer: string;
  config: { y: number; label: string; color: string };
  yPosition: number;
}

const LayerLabel: React.FC<LayerLabelProps> = ({ layer: _layer, config, yPosition }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="absolute left-4 flex items-center gap-2"
    style={{ top: yPosition }}
  >
    <div
      className="w-2 h-8 rounded-full"
      style={{ backgroundColor: config.color }}
    />
    <span className="text-xs font-medium text-muted-foreground">
      {config.label}
    </span>
  </motion.div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CMDBTopologyMap: React.FC<CMDBTopologyMapProps> = ({
  cis,
  relationships,
  selectedCIId,
  onCISelect,
  height = 600,
  enable3D = false,
}) => {
  const { t: _t } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [filterEnv, setFilterEnv] = useState<string>('all');
  const [perspective, _setPerspective] = useState(1000);
  const [rotateY, setRotateY] = useState(0);

  // Calculate node positions
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, TopologyNode>();
    const edgeList: TopologyEdge[] = [];

    // Filter CIs by environment
    const filteredCIs = filterEnv === 'all'
      ? cis
      : cis.filter((ci) => ci.environment === filterEnv);

    // Group CIs by layer (class)
    const layerGroups = new Map<string, ConfigurationItem[]>();
    filteredCIs.forEach((ci) => {
      const group = layerGroups.get(ci.ciClass) || [];
      group.push(ci);
      layerGroups.set(ci.ciClass, group);
    });

    // Position nodes in layers
    const layerHeight = (dimensions.height - 100) / Object.keys(LAYER_CONFIG).length;
    const padding = 100;

    layerGroups.forEach((ciList, layer) => {
      const layerConfig = LAYER_CONFIG[layer];
      if (!layerConfig) return;

      const yPosition = 50 + layerConfig.y * layerHeight;
      const spacing = (dimensions.width - 2 * padding) / Math.max(ciList.length + 1, 2);

      ciList.forEach((ci, index) => {
        // Count connections
        const connectionCount = relationships.filter(
          (r) => r.sourceId === ci.id || r.targetId === ci.id
        ).length;

        nodeMap.set(ci.id, {
          id: ci.id,
          ci,
          x: padding + spacing * (index + 1) - 24,
          y: yPosition - 24,
          z: Math.random() * 2 - 1, // Random z for 3D effect
          layer: layerConfig.y,
          connections: connectionCount,
        });
      });
    });

    // Create edges
    relationships.forEach((rel) => {
      if (nodeMap.has(rel.sourceId) && nodeMap.has(rel.targetId)) {
        edgeList.push({
          id: rel.id,
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
  }, [cis, relationships, dimensions, filterEnv]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  // Get connected nodes
  const connectedNodes = useMemo(() => {
    const activeNode = hoveredNode || selectedCIId;
    if (!activeNode) return new Set<string>();

    const connected = new Set<string>([activeNode]);
    edges.forEach((edge) => {
      if (edge.source === activeNode) connected.add(edge.target);
      if (edge.target === activeNode) connected.add(edge.source);
    });
    return connected;
  }, [edges, hoveredNode, selectedCIId]);

  // Get highlighted edges
  const highlightedEdges = useMemo(() => {
    const activeNode = hoveredNode || selectedCIId;
    if (!activeNode) return new Set<string>();

    return new Set(
      edges
        .filter((e) => e.source === activeNode || e.target === activeNode)
        .map((e) => e.id)
    );
  }, [edges, hoveredNode, selectedCIId]);

  const handleNodeSelect = useCallback(
    (ci: ConfigurationItem) => {
      onCISelect?.(ci);
    },
    [onCISelect]
  );

  return (
    <div
      ref={containerRef}
      className="glass-premium rounded-3xl border border-border/40 relative overflow-hidden"
      style={{ height }}
    >
      {/* Tech corners */}
      <div className="pointer-events-none">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
      </div>

      {/* Background grid */}
      <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
        <defs>
          <pattern id="topoGrid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#topoGrid)" />
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <Select value={filterEnv} onValueChange={setFilterEnv}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {Object.keys(ENVIRONMENT_COLORS).map((env) => (
              <SelectItem key={env} value={env}>{env}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <CustomTooltip content="Afficher/masquer labels">
          <Button
            variant="glass"
            size="icon"
            onClick={() => setShowLabels(!showLabels)}
            className="h-8 w-8"
          >
            {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </CustomTooltip>

        <CustomTooltip content="Zoom +">
          <Button
            variant="glass"
            size="icon"
            onClick={() => setScale((s) => Math.min(2, s + 0.2))}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </CustomTooltip>

        <CustomTooltip content="Zoom -">
          <Button
            variant="glass"
            size="icon"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </CustomTooltip>

        <CustomTooltip content="Réinitialiser">
          <Button
            variant="glass"
            size="icon"
            onClick={() => {
              setScale(1);
              setRotateY(0);
            }}
            className="h-8 w-8"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CustomTooltip>
      </div>

      {/* Stats */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-20">
        <Badge variant="soft" className="bg-primary/10 text-primary">
          <Layers className="h-3 w-3 mr-1" />
          {nodes.length} CIs
        </Badge>
        <Badge variant="soft" className="bg-purple-500/10 text-purple-600">
          {edges.length} Relations
        </Badge>
      </div>

      {/* Layer labels */}
      {Object.entries(LAYER_CONFIG).map(([layer, config]) => {
        const layerHeight = (dimensions.height - 100) / Object.keys(LAYER_CONFIG).length;
        const yPosition = 50 + config.y * layerHeight;

        return (
          <LayerLabel
            key={layer}
            layer={layer}
            config={config}
            yPosition={yPosition}
          />
        );
      })}

      {/* Topology container */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          perspective: enable3D ? `${perspective}px` : 'none',
        }}
      >
        {/* Edges */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          return (
            <TopologyEdgeComponent
              key={edge.id}
              edge={edge}
              sourceNode={sourceNode}
              targetNode={targetNode}
              isHighlighted={highlightedEdges.has(edge.id)}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <TopologyNodeComponent
            key={node.id}
            node={node}
            isSelected={selectedCIId === node.id}
            isHovered={hoveredNode === node.id}
            isConnected={connectedNodes.has(node.id) || connectedNodes.size === 0}
            onSelect={handleNodeSelect}
            onHover={setHoveredNode}
            enable3D={enable3D}
            perspective={perspective}
            rotateY={rotateY}
          />
        ))}
      </div>

      {/* Selected CI details */}
      <AnimatePresence>
        {selectedCIId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-4 right-4 glass-premium p-4 rounded-2xl border border-border/40 w-72 z-20"
          >
            {(() => {
              const node = nodes.find((n) => n.id === selectedCIId);
              if (!node) return null;
              const layerConfig = LAYER_CONFIG[node.ci.ciClass] || LAYER_CONFIG.Hardware;
              const Icon = CI_CLASS_ICONS[node.ci.ciClass] || Server;

              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="p-2 rounded-xl"
                      style={{ backgroundColor: `${layerConfig.color}20` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: layerConfig.color }} />
                    </div>
                    <div>
                      <p className="font-semibold">{node.ci.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {node.ci.ciClass} • {node.ci.ciType}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Env:</span>
                      <span className="ml-1 font-medium">{node.ci.environment}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-1 font-medium">{node.ci.status}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">DQS:</span>
                      <span className="ml-1 font-medium">{node.ci.dataQualityScore}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Relations:</span>
                      <span className="ml-1 font-medium">{node.connections}</span>
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

export default CMDBTopologyMap;
