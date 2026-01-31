/**
 * DependencyMatrix Component
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Interactive matrix showing vendor-to-service dependencies
 * with criticality indicators and filtering capabilities.
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Building2,
  Filter,
  Search,
  Layers,
  ChevronDown,
  ChevronRight,
} from '../ui/Icons';
import type {
  DependencyMatrix as DependencyMatrixType,
  DependencyMatrixCell,
  VendorSummary,
  DependencyLevel,
} from '../../types/vendorConcentration';
import {
  getDependencyLevelColor,
  getDependencyLevelBgColor,
} from '../../types/vendorConcentration';

// ============================================================================
// Types
// ============================================================================

interface DependencyMatrixProps {
  matrix: DependencyMatrixType;
  onVendorClick?: (vendor: VendorSummary) => void;
  onServiceClick?: (serviceId: string) => void;
}

type ViewMode = 'matrix' | 'list';

interface FilterState {
  showCriticalOnly: boolean;
  searchQuery: string;
  dependencyLevel: DependencyLevel | 'all';
}

// ============================================================================
// Dependency Cell Component
// ============================================================================

interface DependencyCellProps {
  cell: DependencyMatrixCell | undefined;
  onClick?: () => void;
}

const DependencyCell: React.FC<DependencyCellProps> = ({ cell, onClick }) => {
  if (!cell) {
    return <td className="p-2 text-center text-slate-300 dark:text-slate-700">-</td>;
  }

  const bgColor = getDependencyLevelBgColor(cell.dependencyLevel);
  const textColor = getDependencyLevelColor(cell.dependencyLevel);

  return (
    <td
      className={`p-2 text-center cursor-pointer hover:opacity-80 transition-opacity ${bgColor}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-center gap-1">
        {cell.isCritical && (
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        )}
        <span className={`text-xs font-medium ${textColor}`}>
          {cell.dependencyLevel.charAt(0).toUpperCase()}
        </span>
      </div>
    </td>
  );
};

// ============================================================================
// Vendor Row Component
// ============================================================================

interface VendorRowProps {
  vendor: VendorSummary;
  services: { id: string; name: string; isCritical: boolean }[];
  cells: DependencyMatrixCell[];
  onClick?: () => void;
}

const VendorRow: React.FC<VendorRowProps> = ({ vendor, services, cells, onClick }) => {
  const vendorCells = cells.filter(c => c.vendorId === vendor.supplierId);

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td
        className="p-3 sticky left-0 bg-white dark:bg-slate-900 border-r border-border/40 dark:border-slate-700 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
              {vendor.name}
            </p>
            <p className="text-xs text-slate-500">
              {vendor.category}
            </p>
          </div>
        </div>
      </td>
      {services.map(service => {
        const cell = vendorCells.find(c => c.serviceId === service.id);
        return (
          <DependencyCell
            key={`${vendor.supplierId || 'unknown'}-${service.id}`}
            cell={cell}
          />
        );
      })}
    </tr>
  );
};

// ============================================================================
// List View Item
// ============================================================================

interface ListItemProps {
  vendor: VendorSummary;
  cells: DependencyMatrixCell[];
  expanded: boolean;
  onToggle: () => void;
}

const ListItem: React.FC<ListItemProps> = ({ vendor, cells, expanded, onToggle }) => {
  const { t } = useTranslation();
  const vendorCells = cells.filter(c => c.vendorId === vendor.supplierId);
  const criticalCount = vendorCells.filter(c => c.isCritical).length;

  return (
    <div className="border border-border/40 dark:border-slate-700 rounded-3xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900 dark:text-white">
              {vendor.name}
            </p>
            <p className="text-sm text-slate-500">
              {vendor.category} • {vendorCells.length} {t('vendorConcentration.matrix.dependencies')}
              {criticalCount > 0 && (
                <span className="text-red-500 ml-1">
                  ({criticalCount} {t('vendorConcentration.matrix.critical')})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            vendor.riskLevel === 'Critical'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : vendor.riskLevel === 'High'
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                : vendor.riskLevel === 'Medium'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
          }`}>
            {vendor.riskLevel}
          </span>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/30">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-3">
            {t('vendorConcentration.matrix.services')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {vendorCells.map(cell => (
              <div
                key={cell.serviceId || 'unknown'}
                className={`flex items-center justify-between p-2 rounded-lg ${getDependencyLevelBgColor(cell.dependencyLevel)}`}
              >
                <div className="flex items-center gap-2">
                  {cell.isCritical && (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className="text-sm text-slate-900 dark:text-white">
                    {cell.serviceName}
                  </span>
                </div>
                <span className={`text-xs font-medium ${getDependencyLevelColor(cell.dependencyLevel)}`}>
                  {cell.dependencyLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const DependencyMatrix: React.FC<DependencyMatrixProps> = ({
  matrix,
  onVendorClick,
  onServiceClick,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [filters, setFilters] = useState<FilterState>({
    showCriticalOnly: false,
    searchQuery: '',
    dependencyLevel: 'all',
  });
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  // Filtered data
  const filteredData = useMemo(() => {
    let vendors = [...matrix.vendors];
    let services = [...matrix.services];
    let cells = [...matrix.cells];

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      vendors = vendors.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query)
      );
      const vendorIds = new Set(vendors.map(v => v.supplierId));
      cells = cells.filter(c => vendorIds.has(c.vendorId));
    }

    // Filter by critical only
    if (filters.showCriticalOnly) {
      services = services.filter(s => s.isCritical);
      cells = cells.filter(c => c.isCritical);
      // Also filter vendors to only those with critical dependencies
      const vendorIds = new Set(cells.map(c => c.vendorId));
      vendors = vendors.filter(v => vendorIds.has(v.supplierId));
    }

    // Filter by dependency level
    if (filters.dependencyLevel !== 'all') {
      cells = cells.filter(c => c.dependencyLevel === filters.dependencyLevel);
      const vendorIds = new Set(cells.map(c => c.vendorId));
      vendors = vendors.filter(v => vendorIds.has(v.supplierId));
    }

    return { vendors, services, cells };
  }, [matrix, filters]);

  // Toggle vendor expansion
  const toggleVendor = (vendorId: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            placeholder={t('vendorConcentration.matrix.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Critical only toggle */}
          <button
            onClick={() => setFilters(prev => ({ ...prev, showCriticalOnly: !prev.showCriticalOnly }))}
            className={`flex items-center gap-2 px-3 py-2 rounded-3xl text-sm transition-all ${
              filters.showCriticalOnly
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            {t('vendorConcentration.matrix.criticalOnly')}
          </button>

          {/* Dependency level filter */}
          <select
            value={filters.dependencyLevel}
            onChange={(e) => setFilters(prev => ({ ...prev, dependencyLevel: e.target.value as DependencyLevel | 'all' }))}
            className="px-3 py-2 rounded-3xl text-sm border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
          >
            <option value="all">{t('vendorConcentration.matrix.allLevels')}</option>
            <option value="critical">{t('vendorConcentration.matrix.levelCritical')}</option>
            <option value="high">{t('vendorConcentration.matrix.levelHigh')}</option>
            <option value="medium">{t('vendorConcentration.matrix.levelMedium')}</option>
            <option value="low">{t('vendorConcentration.matrix.levelLow')}</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center rounded-3xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode('matrix')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-muted-foreground">
        <span>{filteredData.vendors.length} {t('vendorConcentration.matrix.vendors')}</span>
        <span>•</span>
        <span>{filteredData.services.length} {t('vendorConcentration.matrix.services')}</span>
        <span>•</span>
        <span>{filteredData.cells.length} {t('vendorConcentration.matrix.dependencies')}</span>
        <span>•</span>
        <span className="text-red-500">
          {filteredData.cells.filter(c => c.isCritical).length} {t('vendorConcentration.matrix.critical')}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-slate-500 dark:text-slate-400">{t('vendorConcentration.matrix.legend')}:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
          <span className="text-slate-600 dark:text-muted-foreground">L = {t('vendorConcentration.matrix.levelLow')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30" />
          <span className="text-slate-600 dark:text-muted-foreground">M = {t('vendorConcentration.matrix.levelMedium')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/30" />
          <span className="text-slate-600 dark:text-muted-foreground">H = {t('vendorConcentration.matrix.levelHigh')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
          <span className="text-slate-600 dark:text-muted-foreground">C = {t('vendorConcentration.matrix.levelCritical')}</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          <span className="text-slate-600 dark:text-muted-foreground">= {t('vendorConcentration.matrix.criticalService')}</span>
        </div>
      </div>

      {/* Content */}
      {filteredData.vendors.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 text-slate-300 dark:text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">{t('vendorConcentration.matrix.noData')}</p>
        </div>
      ) : viewMode === 'matrix' ? (
        /* Matrix View */
        <div className="overflow-x-auto border border-border/40 dark:border-slate-700 rounded-3xl">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="p-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide sticky left-0 bg-slate-50 dark:bg-slate-800 border-r border-border/40 dark:border-slate-700">
                  {t('vendorConcentration.matrix.vendor')}
                </th>
                {filteredData.services.map(service => (
                  <th
                    key={service.id || 'unknown'}
                    className="p-2 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide min-w-[80px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => onServiceClick?.(service.id)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {service.isCritical && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="truncate max-w-[60px]" title={service.name}>
                        {service.name}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredData.vendors.map(vendor => (
                <VendorRow
                  key={vendor.supplierId || 'unknown'}
                  vendor={vendor}
                  services={filteredData.services}
                  cells={filteredData.cells}
                  onClick={() => onVendorClick?.(vendor)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredData.vendors.map(vendor => (
            <ListItem
              key={vendor.supplierId || 'unknown'}
              vendor={vendor}
              cells={filteredData.cells}
              expanded={expandedVendors.has(vendor.supplierId)}
              onToggle={() => toggleVendor(vendor.supplierId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DependencyMatrix;
