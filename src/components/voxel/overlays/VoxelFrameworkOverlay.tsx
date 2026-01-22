/**
 * VoxelFrameworkOverlay - Compliance framework coverage visualization
 *
 * Shows compliance framework coverage as an overlay on the 3D visualization.
 * Displays control mappings to frameworks like ISO 27001, SOC 2, GDPR, etc.
 *
 * @see Story VOX-9.6: Framework Overlay
 * @see FR50: Users can view compliance framework coverage on 3D visualization
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Layers,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FrameworkMapping {
  /** Framework identifier */
  frameworkId: string;
  /** Control/requirement ID within the framework */
  controlId: string;
  /** Compliance status */
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  /** Evidence or notes */
  notes?: string;
}

export interface ComplianceFramework {
  /** Unique framework ID */
  id: string;
  /** Display name */
  name: string;
  /** Short code (ISO27001, SOC2, etc.) */
  code: string;
  /** Framework color */
  color: string;
  /** Total controls in framework */
  totalControls: number;
  /** Controls with mappings */
  mappedControls: number;
  /** Compliance percentage */
  complianceScore: number;
  /** Control status breakdown */
  breakdown: {
    compliant: number;
    partial: number;
    nonCompliant: number;
    notApplicable: number;
  };
}

export interface VoxelFrameworkOverlayProps {
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Available compliance frameworks */
  frameworks?: ComplianceFramework[];
  /** Currently selected framework ID */
  selectedFrameworkId?: string;
  /** Callback when framework is selected */
  onFrameworkSelect?: (frameworkId: string | null) => void;
  /** Callback when hovering a framework */
  onFrameworkHover?: (frameworkId: string | null) => void;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'iso27001',
    name: 'ISO 27001:2022',
    code: 'ISO',
    color: '#3B82F6',
    totalControls: 93,
    mappedControls: 78,
    complianceScore: 84,
    breakdown: { compliant: 65, partial: 10, nonCompliant: 3, notApplicable: 15 },
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    code: 'SOC2',
    color: '#8B5CF6',
    totalControls: 64,
    mappedControls: 58,
    complianceScore: 91,
    breakdown: { compliant: 52, partial: 4, nonCompliant: 2, notApplicable: 6 },
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    code: 'GDPR',
    color: '#10B981',
    totalControls: 42,
    mappedControls: 40,
    complianceScore: 95,
    breakdown: { compliant: 38, partial: 2, nonCompliant: 0, notApplicable: 2 },
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    code: 'HIPAA',
    color: '#F59E0B',
    totalControls: 54,
    mappedControls: 32,
    complianceScore: 59,
    breakdown: { compliant: 19, partial: 8, nonCompliant: 5, notApplicable: 22 },
  },
];

const STATUS_CONFIG = {
  compliant: { icon: CheckCircle, color: '#10B981', label: 'Compliant' },
  partial: { icon: AlertTriangle, color: '#F59E0B', label: 'Partial' },
  nonCompliant: { icon: XCircle, color: '#EF4444', label: 'Non-Compliant' },
  notApplicable: { icon: Filter, color: '#6B7280', label: 'N/A' },
};

// ============================================================================
// Helper Components
// ============================================================================

interface FrameworkCardProps {
  framework: ComplianceFramework;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onHover: (hovering: boolean) => void;
}

const FrameworkCard: React.FC<FrameworkCardProps> = ({
  framework,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onHover,
}) => {
  const scoreColor =
    framework.complianceScore >= 80
      ? '#10B981'
      : framework.complianceScore >= 60
        ? '#F59E0B'
        : '#EF4444';

  return (
    <div
      className={`rounded-lg transition-all duration-200 cursor-pointer ${
        isSelected ? 'ring-2' : 'hover:bg-slate-700/30'
      }`}
      style={{
        background: isSelected ? `${framework.color}15` : 'rgba(30, 41, 59, 0.5)',
        borderColor: isSelected ? framework.color : 'transparent',
        // Ring color applied via CSS variable for Tailwind ring-2
        ['--tw-ring-color' as string]: framework.color,
      }}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${framework.name} framework`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${framework.color}20` }}
            >
              <Shield className="w-4 h-4" style={{ color: framework.color }} />
            </div>
            <div>
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${framework.color}30`, color: framework.color }}
              >
                {framework.code}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">{framework.name}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold" style={{ color: scoreColor }}>
              {framework.complianceScore}%
            </span>
            <p className="text-xs text-slate-500">Coverage</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${framework.complianceScore}%`,
              background: `linear-gradient(90deg, ${framework.color}, ${scoreColor})`,
            }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {framework.mappedControls}/{framework.totalControls} controls
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 hover:bg-slate-600/50 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Expanded breakdown */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-600/50 space-y-1.5">
            {(
              Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]][]
            ).map(([key, config]) => {
              const count =
                key === 'nonCompliant'
                  ? framework.breakdown.nonCompliant
                  : key === 'notApplicable'
                    ? framework.breakdown.notApplicable
                    : framework.breakdown[key as keyof typeof framework.breakdown];

              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <config.icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    <span className="text-xs text-slate-300">{config.label}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: config.color }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const VoxelFrameworkOverlay: React.FC<VoxelFrameworkOverlayProps> = ({
  visible = true,
  frameworks = DEFAULT_FRAMEWORKS,
  selectedFrameworkId,
  onFrameworkSelect,
  onFrameworkHover,
  showBreakdown = true,
  className = '',
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Calculate overall compliance
  const overallStats = useMemo(() => {
    if (frameworks.length === 0) {
      return { avgScore: 0, totalMapped: 0, totalControls: 0 };
    }
    const totalControls = frameworks.reduce((sum, f) => sum + f.totalControls, 0);
    const totalMapped = frameworks.reduce((sum, f) => sum + f.mappedControls, 0);
    const avgScore = Math.round(
      frameworks.reduce((sum, f) => sum + f.complianceScore, 0) / frameworks.length
    );
    return { avgScore, totalMapped, totalControls };
  }, [frameworks]);

  const handleSelect = useCallback(
    (frameworkId: string) => {
      if (onFrameworkSelect) {
        onFrameworkSelect(selectedFrameworkId === frameworkId ? null : frameworkId);
      }
    },
    [selectedFrameworkId, onFrameworkSelect]
  );

  const handleToggleExpand = useCallback((frameworkId: string) => {
    setExpandedId((prev) => (prev === frameworkId ? null : frameworkId));
  }, []);

  const handleHover = useCallback(
    (frameworkId: string, hovering: boolean) => {
      if (onFrameworkHover) {
        onFrameworkHover(hovering ? frameworkId : null);
      }
    },
    [onFrameworkHover]
  );

  if (!visible) return null;

  return (
    <div className={`fixed top-20 right-4 z-40 ${className}`}>
      <div
        className="rounded-xl overflow-hidden transition-all duration-300"
        style={{
          width: isMinimized ? '56px' : '280px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div className="p-3 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            {!isMinimized && (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Frameworks</span>
              </div>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label={isMinimized ? 'Expand panel' : 'Minimize panel'}
            >
              <Layers className={`w-4 h-4 text-slate-400 ${isMinimized ? '' : 'hidden'}`} />
              {!isMinimized &&
                (isMinimized ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ))}
            </button>
          </div>

          {!isMinimized && (
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Overall Coverage</span>
              <span
                className="font-bold"
                style={{
                  color:
                    overallStats.avgScore >= 80
                      ? '#10B981'
                      : overallStats.avgScore >= 60
                        ? '#F59E0B'
                        : '#EF4444',
                }}
              >
                {overallStats.avgScore}%
              </span>
            </div>
          )}
        </div>

        {/* Framework list */}
        {!isMinimized && (
          <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {frameworks.map((framework) => (
              <FrameworkCard
                key={framework.id}
                framework={framework}
                isSelected={selectedFrameworkId === framework.id}
                isExpanded={showBreakdown && expandedId === framework.id}
                onSelect={() => handleSelect(framework.id)}
                onToggleExpand={() => handleToggleExpand(framework.id)}
                onHover={(hovering) => handleHover(framework.id, hovering)}
              />
            ))}

            {frameworks.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">
                No frameworks configured
              </div>
            )}
          </div>
        )}

        {/* Minimized icons */}
        {isMinimized && (
          <div className="p-2 space-y-2">
            {frameworks.slice(0, 4).map((framework) => (
              <button
                key={framework.id}
                onClick={() => handleSelect(framework.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  selectedFrameworkId === framework.id ? 'ring-2' : 'hover:bg-slate-700/50'
                }`}
                style={{
                  background:
                    selectedFrameworkId === framework.id
                      ? `${framework.color}20`
                      : 'transparent',
                  ['--tw-ring-color' as string]: framework.color,
                }}
                title={framework.name}
                aria-label={`Select ${framework.name}`}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: framework.color }}
                >
                  {framework.code.slice(0, 3)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoxelFrameworkOverlay;
