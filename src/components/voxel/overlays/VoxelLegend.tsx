/**
 * VoxelLegend - Legend component showing node types and their visual representations
 *
 * Displays both colors AND shapes for accessibility (colorblind users).
 * Includes status indicators and relationship type explanations.
 *
 * @see Story VOX-8.1: Daltonisme-Safe Visuals
 * @see Story VOX-8.3: Text Labels for All Indicators
 */

import React, { useState } from 'react';
import {
  Info,
  ChevronDown,
  ChevronUp,
  Server,
  AlertTriangle,
  Shield,
  ClipboardCheck,
  FolderKanban,
  Flame,
  Building2,
  Circle,
  Triangle,
  Square,
  Octagon,
  Hexagon,
  Diamond,
  Pentagon,
} from 'lucide-react';
import type { VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelLegendProps {
  /** Whether the legend is initially expanded */
  defaultExpanded?: boolean;
  /** Custom className */
  className?: string;
  /** Show status legend */
  showStatus?: boolean;
  /** Show edge types legend */
  showEdges?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_TYPE_LEGEND: {
  type: VoxelNodeType;
  label: string;
  color: string;
  shape: string;
  icon: React.ReactNode;
  shapeIcon: React.ReactNode;
}[] = [
  {
    type: 'asset',
    label: 'Asset',
    color: '#3B82F6',
    shape: 'Sphere',
    icon: <Server className="w-4 h-4" />,
    shapeIcon: <Circle className="w-4 h-4" />,
  },
  {
    type: 'risk',
    label: 'Risk',
    color: '#EF4444',
    shape: 'Icosahedron',
    icon: <AlertTriangle className="w-4 h-4" />,
    shapeIcon: <Triangle className="w-4 h-4" />,
  },
  {
    type: 'control',
    label: 'Control',
    color: '#8B5CF6',
    shape: 'Octahedron',
    icon: <Shield className="w-4 h-4" />,
    shapeIcon: <Octagon className="w-4 h-4" />,
  },
  {
    type: 'audit',
    label: 'Audit',
    color: '#F59E0B',
    shape: 'Box',
    icon: <ClipboardCheck className="w-4 h-4" />,
    shapeIcon: <Square className="w-4 h-4" />,
  },
  {
    type: 'project',
    label: 'Project',
    color: '#10B981',
    shape: 'Dodecahedron',
    icon: <FolderKanban className="w-4 h-4" />,
    shapeIcon: <Pentagon className="w-4 h-4" />,
  },
  {
    type: 'incident',
    label: 'Incident',
    color: '#F97316',
    shape: 'Tetrahedron',
    icon: <Flame className="w-4 h-4" />,
    shapeIcon: <Diamond className="w-4 h-4" />,
  },
  {
    type: 'supplier',
    label: 'Supplier',
    color: '#6366F1',
    shape: 'Cylinder',
    icon: <Building2 className="w-4 h-4" />,
    shapeIcon: <Hexagon className="w-4 h-4" />,
  },
];

const STATUS_LEGEND: {
  status: VoxelNodeStatus;
  label: string;
  color: string;
  description: string;
}[] = [
  {
    status: 'normal',
    label: 'Normal',
    color: '#22C55E',
    description: 'Entity is in good standing',
  },
  {
    status: 'warning',
    label: 'Warning',
    color: '#F59E0B',
    description: 'Entity requires attention',
  },
  {
    status: 'critical',
    label: 'Critical',
    color: '#EF4444',
    description: 'Entity needs immediate action',
  },
  {
    status: 'inactive',
    label: 'Inactive',
    color: '#64748B',
    description: 'Entity is closed or disabled',
  },
];

const EDGE_TYPE_LEGEND = [
  {
    type: 'impact',
    label: 'Impact',
    color: '#EF4444',
    description: 'Shows how risks affect assets',
  },
  {
    type: 'mitigation',
    label: 'Mitigation',
    color: '#22C55E',
    description: 'Shows controls protecting against risks',
  },
  {
    type: 'dependency',
    label: 'Dependency',
    color: '#3B82F6',
    description: 'Shows relationships between entities',
  },
  {
    type: 'assignment',
    label: 'Assignment',
    color: '#8B5CF6',
    description: 'Shows ownership or responsibility',
  },
];

// ============================================================================
// Component
// ============================================================================

export const VoxelLegend: React.FC<VoxelLegendProps> = ({
  defaultExpanded = false,
  className = '',
  showStatus = true,
  showEdges = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 ${className}`}
      role="region"
      aria-label="Visualization legend"
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
        }}
        className="rounded-3xl overflow-hidden"
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-700/30 transition-colors"
          aria-expanded={isExpanded}
          aria-controls="legend-content"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-medium">Legend</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        {/* Content */}
        {isExpanded && (
          <div
            id="legend-content"
            className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto"
          >
            {/* Node Types */}
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Entity Types
              </h3>
              <div className="space-y-1">
                {NODE_TYPE_LEGEND.map(({ type, label, color, shape, icon, shapeIcon }) => (
                  <div
                    key={type || 'unknown'}
                    className="flex items-center gap-3 py-1.5"
                    role="listitem"
                  >
                    {/* Color indicator */}
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                    {/* Shape indicator */}
                    <div
                      className="flex-shrink-0"
                      style={{ color }}
                      aria-hidden="true"
                    >
                      {shapeIcon}
                    </div>
                    {/* Icon */}
                    <div className="text-muted-foreground flex-shrink-0" aria-hidden="true">
                      {icon}
                    </div>
                    {/* Label */}
                    <div className="flex-1">
                      <span className="text-sm text-slate-200">{label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({shape})</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Status */}
            {showStatus && (
              <section>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Status Indicators
                </h3>
                <div className="space-y-1">
                  {STATUS_LEGEND.map(({ status, label, color, description }) => (
                    <div
                      key={status || 'unknown'}
                      className="flex items-center gap-3 py-1.5"
                      role="listitem"
                    >
                      {/* Status dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      {/* Label and description */}
                      <div className="flex-1">
                        <span className="text-sm text-slate-200">{label}</span>
                        <span className="text-xs text-muted-foreground block">{description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Edge Types */}
            {showEdges && (
              <section>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Connection Types
                </h3>
                <div className="space-y-1">
                  {EDGE_TYPE_LEGEND.map(({ type, label, color, description }) => (
                    <div
                      key={type || 'unknown'}
                      className="flex items-center gap-3 py-1.5"
                      role="listitem"
                    >
                      {/* Line indicator */}
                      <div
                        className="w-6 h-0.5 flex-shrink-0 rounded-full"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      {/* Label and description */}
                      <div className="flex-1">
                        <span className="text-sm text-slate-200">{label}</span>
                        <span className="text-xs text-muted-foreground block">{description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Accessibility note */}
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">
                Entities are distinguished by both color and shape for accessibility.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoxelLegend;
