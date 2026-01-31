/**
 * VoxelFilterPanel - Filter panel for the 3D visualization
 *
 * Provides filtering controls for entity types, statuses, and search.
 * Displays active filters as removable badges with node count.
 *
 * @see Story VOX-5.1: Filter by Entity Type
 * @see Story VOX-5.2: Filter by Framework
 * @see Story VOX-5.3: Filter by Risk Severity
 * @see Story VOX-5.4: Filter Combinations
 * @see Story VOX-5.5: Filter Visual Feedback
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Filter,
  X,
  Search,
  Server,
  AlertTriangle,
  Shield,
  ClipboardCheck,
  FolderKanban,
  Flame,
  Building2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useVoxelStore, useFilteredNodes, useVoxelNodes } from '@/stores/voxelStore';
import type { VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelFilterPanelProps {
  /** Whether the panel is collapsed */
  collapsed?: boolean;
  /** Called when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_TYPE_CONFIG: Record<VoxelNodeType, { icon: React.ReactNode; label: string; color: string }> = {
  asset: { icon: <Server className="w-3.5 h-3.5" />, label: 'Assets', color: '#3B82F6' },
  risk: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Risks', color: '#EF4444' },
  control: { icon: <Shield className="w-3.5 h-3.5" />, label: 'Controls', color: '#8B5CF6' },
  audit: { icon: <ClipboardCheck className="w-3.5 h-3.5" />, label: 'Audits', color: '#F59E0B' },
  project: { icon: <FolderKanban className="w-3.5 h-3.5" />, label: 'Projects', color: '#10B981' },
  incident: { icon: <Flame className="w-3.5 h-3.5" />, label: 'Incidents', color: '#F97316' },
  supplier: { icon: <Building2 className="w-3.5 h-3.5" />, label: 'Suppliers', color: '#6366F1' },
};

const STATUS_CONFIG: Record<VoxelNodeStatus, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#22C55E' },
  warning: { label: 'Warning', color: '#F59E0B' },
  critical: { label: 'Critical', color: '#EF4444' },
  inactive: { label: 'Inactive', color: '#64748B' },
};

const ALL_NODE_TYPES: VoxelNodeType[] = ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'];
const ALL_STATUSES: VoxelNodeStatus[] = ['normal', 'warning', 'critical', 'inactive'];

// ============================================================================
// Sub-components
// ============================================================================

interface CheckboxFilterProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
  color?: string;
  count?: number;
}

const CheckboxFilter: React.FC<CheckboxFilterProps> = ({
  label,
  checked,
  onChange,
  icon,
  color,
  count,
}) => (
  <label className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-slate-700/50 transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus-visible:ring-brand-500 focus:ring-offset-0"
    />
    {icon && (
      <span style={{ color: color || '#94A3B8' }}>{icon}</span>
    )}
    <span className="text-sm text-slate-300 flex-1">{label}</span>
    {typeof count === 'number' && (
      <span className="text-xs text-slate-500">{count}</span>
    )}
  </label>
);

interface FilterBadgeProps {
  label: string;
  onRemove: () => void;
  color?: string;
}

const FilterBadge: React.FC<FilterBadgeProps> = ({ label, onRemove, color }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
    style={{
      background: color ? `${color}20` : 'rgba(59, 130, 246, 0.2)',
      color: color || '#3B82F6',
    }}
  >
    {label}
    <button
      onClick={onRemove}
      className="p-0.5 rounded-full hover:bg-white/20 transition-colors"
      aria-label={`Remove ${label} filter`}
    >
      <X className="w-3 h-3" />
    </button>
  </span>
);

// ============================================================================
// Component
// ============================================================================

export const VoxelFilterPanel: React.FC<VoxelFilterPanelProps> = ({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  className = '',
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;

  // Store state
  const filters = useVoxelStore((state) => state.filters);
  const toggleNodeType = useVoxelStore((state) => state.toggleNodeType);
  const toggleStatus = useVoxelStore((state) => state.toggleStatus);
  const setSearchQuery = useVoxelStore((state) => state.setSearchQuery);
  const setShowAnomaliesOnly = useVoxelStore((state) => state.setShowAnomaliesOnly);
  const resetFilters = useVoxelStore((state) => state.resetFilters);

  // Node counts
  const allNodes = useVoxelNodes();
  const filteredNodes = useFilteredNodes();

  // Calculate counts by type
  const countsByType = useMemo(() => {
    const counts: Record<VoxelNodeType, number> = {
      asset: 0, risk: 0, control: 0, audit: 0, project: 0, incident: 0, supplier: 0,
    };
    allNodes.forEach((node) => { counts[node.type]++; });
    return counts;
  }, [allNodes]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.nodeTypes.length < ALL_NODE_TYPES.length) count++;
    if (filters.statuses.length < ALL_STATUSES.length) count++;
    if (filters.searchQuery) count++;
    if (filters.showAnomaliesOnly) count++;
    if (filters.dateRange) count++;
    return count;
  }, [filters]);

  // Check if any filters are active
  const hasActiveFilters = activeFilterCount > 0;

  // Handlers
  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !collapsed;
    setInternalCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  }, [collapsed, onCollapsedChange]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  // Get active filter badges
  const getActiveFilterBadges = useMemo(() => {
    const badges: { label: string; onRemove: () => void; color?: string }[] = [];

    // Hidden node types
    ALL_NODE_TYPES.forEach((type) => {
      if (!filters.nodeTypes.includes(type)) {
        badges.push({
          label: `Hide ${NODE_TYPE_CONFIG[type].label}`,
          onRemove: () => toggleNodeType(type),
          color: NODE_TYPE_CONFIG[type].color,
        });
      }
    });

    // Hidden statuses
    ALL_STATUSES.forEach((status) => {
      if (!filters.statuses.includes(status)) {
        badges.push({
          label: `Hide ${STATUS_CONFIG[status].label}`,
          onRemove: () => toggleStatus(status),
          color: STATUS_CONFIG[status].color,
        });
      }
    });

    // Search query
    if (filters.searchQuery) {
      badges.push({
        label: `"${filters.searchQuery}"`,
        onRemove: () => setSearchQuery(''),
      });
    }

    // Anomalies only
    if (filters.showAnomaliesOnly) {
      badges.push({
        label: 'Anomalies Only',
        onRemove: () => setShowAnomaliesOnly(false),
        color: '#EF4444',
      });
    }

    return badges;
  }, [filters, toggleNodeType, toggleStatus, setSearchQuery, setShowAnomaliesOnly]);

  return (
    <div
      className={`fixed left-4 top-16 z-40 ${className}`}
      style={{
        width: collapsed ? '48px' : 'min(280px, calc(100vw - 2rem))',
        transition: 'width 0.2s ease-out',
      }}
    >
      {/* Panel Container */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-3 border-b"
          style={{ borderColor: 'rgba(148, 163, 184, 0.1)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-slate-200">Filters</span>
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  {activeFilterCount}
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleCollapseToggle}
            className="p-1.5 rounded hover:bg-slate-700/50 transition-colors text-muted-foreground hover:text-slate-200"
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsed View */}
        {collapsed && (
          <div className="p-2 flex flex-col items-center gap-2">
            <div className="relative">
              <Filter className="w-5 h-5 text-muted-foreground" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 text-[11px] text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Expanded View */}
        {!collapsed && (
          <div className="p-3 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Node Count */}
            <div className="text-xs text-muted-foreground text-center pb-2 border-b border-slate-700/50">
              Showing <span className="text-slate-200 font-medium">{filteredNodes.length}</span> of{' '}
              <span className="text-slate-200 font-medium">{allNodes.length}</span> nodes
            </div>

            {/* Search */}
            <div>
              <label htmlFor="voxel-search" className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="voxel-search"
                  type="text"
                  value={filters.searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search nodes..."
                  className="w-full pl-8 pr-8 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />

                {filters.searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-700/50 text-slate-500 dark:text-slate-300 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Entity Type Filter */}
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2 block">
                Entity Types
              </span>

              <div className="space-y-0.5">
                {ALL_NODE_TYPES.map((type) => (
                  <CheckboxFilter
                    key={type || 'unknown'}
                    label={NODE_TYPE_CONFIG[type].label}
                    checked={filters.nodeTypes.includes(type)}
                    onChange={() => toggleNodeType(type)}
                    icon={NODE_TYPE_CONFIG[type].icon}
                    color={NODE_TYPE_CONFIG[type].color}
                    count={countsByType[type]}
                  />
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2 block">
                Status
              </span>

              <div className="space-y-0.5">
                {ALL_STATUSES.map((status) => (
                  <CheckboxFilter
                    key={status || 'unknown'}
                    label={STATUS_CONFIG[status].label}
                    checked={filters.statuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                    color={STATUS_CONFIG[status].color}
                  />
                ))}
              </div>
            </div>

            {/* Show Anomalies Only */}
            <div>
              <CheckboxFilter
                label="Show anomalies only"
                checked={filters.showAnomaliesOnly}
                onChange={() => setShowAnomaliesOnly(!filters.showAnomaliesOnly)}
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                color="#EF4444"
              />
            </div>

            {/* Active Filter Badges */}
            {getActiveFilterBadges.length > 0 && (
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2 block">
                  Active Filters
                </span>
                <div className="flex flex-wrap gap-1.5">

                  {getActiveFilterBadges.map((badge, index) => (
                    <FilterBadge
                      key={index || 'unknown'}
                      label={badge.label}
                      onRemove={badge.onRemove}
                      color={badge.color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoxelFilterPanel;
