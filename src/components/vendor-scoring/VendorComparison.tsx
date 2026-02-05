/**
 * Vendor Comparison Component
 * Displays vendor risk comparison matrix and list
 * Story 37-3: Automated Vendor Scoring
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  VendorComparisonEntry,
  ScoringStatistics,
  RiskLevel,
  getRiskLevelConfig,
  getScoreColor,
  getScoreBgColor,
  formatScore,
} from '../../types/vendorScoring';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ArrowUpDown,
  ChevronRight,
  Building2,
  BarChart3,
  Grid3X3,
  List,
} from '../ui/Icons';

interface VendorComparisonProps {
  vendors: VendorComparisonEntry[];
  statistics?: ScoringStatistics;
  onVendorClick?: (supplierId: string) => void;
  className?: string;
}

type SortField = 'score' | 'name' | 'trend' | 'lastAssessed';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'matrix';

/**
 * Risk Matrix Cell
 */
const RiskMatrixCell: React.FC<{
  vendors: VendorComparisonEntry[];
  riskLevel: RiskLevel;
  criticalityLevel: 'Low' | 'Medium' | 'High';
  onClick?: (supplierId: string) => void;
}> = ({ vendors, riskLevel, criticalityLevel: _criticalityLevel, onClick }) => {
  const config = getRiskLevelConfig(riskLevel);

  if (vendors.length === 0) {
    return (
      <div className="h-24 rounded-lg border-2 border-dashed border-border/40 dark:border-slate-700 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">-</span>
      </div>
    );
  }

  return (
    <div
      className={`h-24 rounded-lg ${config.bgColor} p-2 overflow-hidden`}
    >
      <div className="flex flex-wrap gap-1 overflow-y-auto max-h-full">
        {vendors.slice(0, 6).map((vendor) => (
          <button
            key={vendor.supplierId || 'unknown'}
            onClick={() => onClick?.(vendor.supplierId)}
            className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-medium text-slate-700 dark:text-slate-300 hover:ring-2 hover:ring-brand-500 transition-all truncate max-w-full"
            title={vendor.supplierName}
          >
            {vendor.supplierName.length > 12
              ? vendor.supplierName.slice(0, 12) + '...'
              : vendor.supplierName}
          </button>
        ))}
        {vendors.length > 6 && (
          <span className="px-2 py-1 text-xs text-slate-500">
            +{vendors.length - 6}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Risk Matrix View
 */
const RiskMatrixView: React.FC<{
  vendors: VendorComparisonEntry[];
  onVendorClick?: (supplierId: string) => void;
}> = ({ vendors, onVendorClick }) => {
  const { t } = useTranslation();

  // Group vendors by risk level and criticality
  const matrix = useMemo(() => {
    const result: Record<RiskLevel, Record<'Low' | 'Medium' | 'High', VendorComparisonEntry[]>> = {
      Low: { Low: [], Medium: [], High: [] },
      Medium: { Low: [], Medium: [], High: [] },
      High: { Low: [], Medium: [], High: [] },
      Critical: { Low: [], Medium: [], High: [] },
    };

    vendors.forEach((vendor) => {
      const riskLevel = vendor.latestScore.inherentRisk;
      // Determine criticality based on assessment count and critical issues
      let criticality: 'Low' | 'Medium' | 'High' = 'Low';
      if (vendor.latestScore.criticalIssuesCount > 2 || vendor.assessmentCount > 5) {
        criticality = 'High';
      } else if (vendor.latestScore.criticalIssuesCount > 0 || vendor.assessmentCount > 2) {
        criticality = 'Medium';
      }
      result[riskLevel][criticality].push(vendor);
    });

    return result;
  }, [vendors]);

  const riskLevels: RiskLevel[] = ['Critical', 'High', 'Medium', 'Low'];
  const criticalityLevels: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'Low'];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Header */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div className="text-sm font-medium text-muted-foreground text-center">
            {t('vendorScoring.riskLevel', 'Risk Level')}
          </div>
          {criticalityLevels.map((level) => (
            <div
              key={level || 'unknown'}
              className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center"
            >
              {t(`vendorScoring.criticality.${level.toLowerCase()}`, level)}
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {riskLevels.map((riskLevel) => (
          <div key={riskLevel || 'unknown'} className="grid grid-cols-4 gap-2 mb-2">
            <div
              className={`flex items-center justify-center rounded-lg ${getRiskLevelConfig(riskLevel).bgColor} ${getRiskLevelConfig(riskLevel).color} text-sm font-medium`}
            >
              {t(`vendorScoring.risk.${riskLevel.toLowerCase()}`, riskLevel)}
            </div>
            {criticalityLevels.map((critLevel) => (
              <RiskMatrixCell
                key={critLevel || 'unknown'}
                vendors={matrix[riskLevel][critLevel]}
                riskLevel={riskLevel}
                criticalityLevel={critLevel}
                onClick={onVendorClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Vendor List Item
 */
const VendorListItem: React.FC<{
  vendor: VendorComparisonEntry;
  onClick?: () => void;
}> = ({ vendor, onClick }) => {
  const { t } = useTranslation();
  const config = getRiskLevelConfig(vendor.latestScore.inherentRisk);
  const displayScore = vendor.latestScore.displayScore;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-3xl border border-border/40 dark:border-border/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
    >
      {/* Score */}
      <div
        className={`w-14 h-14 rounded-3xl flex flex-col items-center justify-center ${getScoreBgColor(displayScore)}`}
      >
        <span className={`font-bold text-lg ${getScoreColor(displayScore)}`}>
          {formatScore(displayScore)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-slate-900 dark:text-white truncate">
            {vendor.supplierName}
          </h4>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
          >
            {t(`vendorScoring.risk.${vendor.latestScore.inherentRisk.toLowerCase()}`)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-muted-foreground">
          {vendor.category && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {vendor.category}
            </span>
          )}
          <span>
            {vendor.assessmentCount}{' '}
            {t('vendorScoring.assessments', 'assessments')}
          </span>
        </div>
      </div>

      {/* Trend */}
      <div className="flex items-center gap-2">
        {vendor.scoreTrend === 'improving' && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
            <TrendingUp className="w-4 h-4" />
            +{vendor.trendPercentage}%
          </span>
        )}
        {vendor.scoreTrend === 'declining' && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
            <TrendingDown className="w-4 h-4" />
            -{vendor.trendPercentage}%
          </span>
        )}
        {vendor.scoreTrend === 'stable' && (
          <span className="flex items-center gap-1 text-slate-400 text-sm">
            <Minus className="w-4 h-4" />
          </span>
        )}
        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-300" />
      </div>
    </button>
  );
};

/**
 * Statistics Cards
 */
const StatisticsCards: React.FC<{ statistics: ScoringStatistics }> = ({
  statistics,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-border/40 dark:border-border/40">
        <div className="text-sm text-slate-500 dark:text-muted-foreground mb-1">
          {t('vendorScoring.averageScore', 'Average Score')}
        </div>
        <div className={`text-2xl font-bold ${getScoreColor(statistics.averageScore)}`}>
          {formatScore(statistics.averageScore)}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-border/40 dark:border-border/40">
        <div className="text-sm text-slate-500 dark:text-muted-foreground mb-1">
          {t('vendorScoring.vendorsAssessed', 'Vendors Assessed')}
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">
          {statistics.vendorCount}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-border/40 dark:border-border/40">
        <div className="text-sm text-slate-500 dark:text-muted-foreground mb-1">
          {t('vendorScoring.highRisk', 'High/Critical Risk')}
        </div>
        <div className="text-2xl font-bold text-red-600">
          {statistics.byRiskLevel.High + statistics.byRiskLevel.Critical}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-border/40 dark:border-border/40">
        <div className="text-sm text-slate-500 dark:text-muted-foreground mb-1">
          {t('vendorScoring.lowRisk', 'Low Risk')}
        </div>
        <div className="text-2xl font-bold text-green-600">
          {statistics.byRiskLevel.Low}
        </div>
      </div>
    </div>
  );
};

/**
 * Main Vendor Comparison Component
 */
export const VendorComparison: React.FC<VendorComparisonProps> = ({
  vendors,
  statistics,
  onVendorClick,
  className = '',
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all');

  // Sort and filter vendors
  const sortedVendors = useMemo(() => {
    let result = [...vendors];

    // Filter
    if (filterRisk !== 'all') {
      result = result.filter((v) => v.latestScore.inherentRisk === filterRisk);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'score':
          comparison = b.latestScore.displayScore - a.latestScore.displayScore;
          break;
        case 'name':
          comparison = a.supplierName.localeCompare(b.supplierName);
          break;
        case 'trend':
          comparison = b.trendPercentage - a.trendPercentage;
          break;
        case 'lastAssessed':
          comparison =
            new Date(b.lastAssessedAt).getTime() -
            new Date(a.lastAssessedAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [vendors, filterRisk, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className={className}>
      {/* Statistics */}
      {statistics && <StatisticsCards statistics={statistics} />}

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value as RiskLevel | 'all')}
              className="appearance-none pl-8 pr-8 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              <option value="all">{t('vendorScoring.allRisks', 'All Risks')}</option>
              <option value="Critical">{t('vendorScoring.risk.critical', 'Critical')}</option>
              <option value="High">{t('vendorScoring.risk.high', 'High')}</option>
              <option value="Medium">{t('vendorScoring.risk.medium', 'Medium')}</option>
              <option value="Low">{t('vendorScoring.risk.low', 'Low')}</option>
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Sort */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-muted-foreground">
              {t('vendorScoring.sortBy', 'Sort by')}:
            </span>
            {(['score', 'name', 'trend'] as SortField[]).map((field) => (
              <button
                key={field || 'unknown'}
                onClick={() => handleSort(field)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  sortField === field
                    ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t(`vendorScoring.sort.${field}`, field)}
                {sortField === field && (
                  <ArrowUpDown className="inline-block w-3 h-3 ml-1" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {sortedVendors.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-muted-foreground">
            {t('vendorScoring.noVendors', 'No vendors match the current filters')}
          </p>
        </div>
      ) : viewMode === 'matrix' ? (
        <RiskMatrixView vendors={sortedVendors} onVendorClick={onVendorClick} />
      ) : (
        <div className="space-y-3">
          {sortedVendors.map((vendor) => (
            <VendorListItem
              key={vendor.supplierId || 'unknown'}
              vendor={vendor}
              onClick={() => onVendorClick?.(vendor.supplierId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorComparison;
