/**
 * Story 36-4: OT Impact Section for Vulnerability Form
 *
 * Composable section to add OT impact analysis to vulnerability forms:
 * - Shows auto-matched OT assets based on CVE/manufacturer/model
 * - Allows manual OT asset linking
 * - Displays OT-adjusted score preview with breakdown
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cpu,
  Plus,
  X,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Eye,
  RefreshCw,
  Network,
  Clock,
  Wrench,
  ChevronDown,
  ChevronUp,
  Search,
} from '../ui/Icons';
import { OTVulnerabilityService } from '@/services/OTVulnerabilityService';
import type { Asset } from '@/types';
import type {
  OTAssetMatch,
  OTRiskAdjustment,
  OTAdjustedScore,
} from '@/types/otVulnerability';
import type { OTCriticality, NetworkSegment } from '@/types/assets';

// ============================================================================
// Constants
// ============================================================================

const CRITICALITY_COLORS: Record<OTCriticality, { bg: string; text: string; border: string }> = {
  safety: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  production: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  operations: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  monitoring: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const SEGMENT_COLORS: Record<NetworkSegment, { bg: string; text: string }> = {
  IT: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  OT: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  DMZ: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
};

const SEVERITY_COLORS = {
  Critical: 'bg-red-500/10 text-red-500 border-red-500/30',
  High: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  Low: 'bg-green-500/10 text-green-500 border-green-500/30',
};

// ============================================================================
// Types
// ============================================================================

export interface OTImpactSectionProps {
  /** Current CVE ID for auto-matching */
  cveId?: string;
  /** Base CVSS score */
  baseScore: number;
  /** Whether a patch is available */
  patchAvailable?: boolean;
  /** All available OT assets for manual linking */
  availableOTAssets: Asset[];
  /** Currently linked OT asset IDs */
  linkedAssetIds: string[];
  /** Callback when linked assets change */
  onLinkedAssetsChange: (assetIds: string[]) => void;
  /** Optional: callback when adjusted score is calculated */
  onAdjustedScoreChange?: (score: number, factors: OTRiskAdjustment[]) => void;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface MatchedAssetDisplay extends OTAssetMatch {
  isManual?: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Asset match card
 */
const AssetMatchCard: React.FC<{
  asset: MatchedAssetDisplay;
  onRemove?: () => void;
  onView?: () => void;
  compact?: boolean;
}> = ({ asset, onRemove, onView, compact }) => {
  const critColors = CRITICALITY_COLORS[asset.otCriticality];
  const segColors = SEGMENT_COLORS[asset.networkSegment];

  return (
    <div
      className={`
        rounded-xl border transition-colors
        ${compact ? 'p-2' : 'p-3'}
        ${asset.isManual ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/10 bg-white/5'}
        hover:bg-white/10
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center shrink-0`}>
          <Cpu className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-orange-400`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-900 dark:text-white truncate`}>
              {asset.assetName}
            </span>
            {asset.isManual && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/20 text-indigo-400 uppercase">
                Manual
              </span>
            )}
            {!asset.isManual && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  asset.matchType === 'exact'
                    ? 'bg-green-500/20 text-green-500'
                    : asset.matchType === 'partial'
                    ? 'bg-yellow-500/20 text-yellow-500'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                {asset.matchConfidence}% {asset.matchType}
              </span>
            )}
          </div>

          <div className="mt-0.5 text-xs text-slate-500 dark:text-white/50">
            {asset.manufacturer} {asset.model}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${critColors.bg} ${critColors.text}`}>
              {asset.otCriticality}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${segColors.bg} ${segColors.text}`}>
              {asset.networkSegment}
            </span>
            {asset.safetyRating && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
                SIL: {asset.safetyRating}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              title="View asset"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Score preview component
 */
const ScorePreview: React.FC<{
  baseScore: number;
  adjustedScore: OTAdjustedScore | null;
  compact?: boolean;
}> = ({ baseScore, adjustedScore, compact }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!adjustedScore) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-300 dark:border-white/20 ${compact ? 'p-3' : 'p-4'} text-center`}>
        <p className="text-sm text-slate-500 dark:text-white/50">
          Link OT assets to calculate adjusted score
        </p>
      </div>
    );
  }

  const delta = adjustedScore.delta;
  const severityClass = SEVERITY_COLORS[adjustedScore.severity];

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${compact ? '' : ''}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full ${compact ? 'p-3' : 'p-4'} flex items-center justify-between hover:bg-white/5 transition-colors`}
      >
        <div className="flex items-center gap-4">
          {/* Base score */}
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40">Base</p>
            <p className="text-lg font-bold text-slate-700 dark:text-white/70">{baseScore.toFixed(1)}</p>
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            {delta > 0 ? (
              <TrendingUp className="h-5 w-5 text-red-400" />
            ) : delta < 0 ? (
              <TrendingDown className="h-5 w-5 text-green-400" />
            ) : (
              <span className="text-white/30">=</span>
            )}
          </div>

          {/* Adjusted score */}
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40">OT-Adjusted</p>
            <p className={`text-2xl font-bold ${adjustedScore.severity === 'Critical' ? 'text-red-500' : adjustedScore.severity === 'High' ? 'text-orange-500' : adjustedScore.severity === 'Medium' ? 'text-yellow-500' : 'text-green-500'}`}>
              {adjustedScore.adjustedScore.toFixed(1)}
            </p>
          </div>

          {/* Delta badge */}
          {delta !== 0 && (
            <span className={`px-2 py-1 rounded-lg text-sm font-medium ${delta > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
        </div>

        {/* Severity badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border ${severityClass}`}>
            {adjustedScore.severity}
          </span>
          {showDetails ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Factor breakdown */}
      {showDetails && adjustedScore.factors.length > 0 && (
        <div className={`border-t border-white/10 ${compact ? 'p-3' : 'p-4'} space-y-2`}>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 mb-2">
            Adjustment Factors
          </p>
          {adjustedScore.factors.map((factor, i) => (
            <div
              key={`${factor.factor}-${i}`}
              className={`flex items-center justify-between p-2 rounded-lg ${factor.adjustment > 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                  {factor.factor === 'criticality' && <AlertTriangle className="h-3.5 w-3.5 text-white/70" />}
                  {factor.factor === 'network' && <Network className="h-3.5 w-3.5 text-white/70" />}
                  {factor.factor === 'patching' && <Wrench className="h-3.5 w-3.5 text-white/70" />}
                  {factor.factor === 'safety' && <Shield className="h-3.5 w-3.5 text-white/70" />}
                  {factor.factor === 'age' && <Clock className="h-3.5 w-3.5 text-white/70" />}
                  {factor.factor === 'exposure' && <Eye className="h-3.5 w-3.5 text-white/70" />}
                </div>
                <span className="text-xs text-slate-600 dark:text-white/70">{factor.reason}</span>
              </div>
              <span className={`text-sm font-bold ${factor.adjustment > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {factor.adjustment > 0 ? '+' : ''}{factor.adjustment.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const OTImpactSection: React.FC<OTImpactSectionProps> = ({
  cveId,
  baseScore,
  patchAvailable = true,
  availableOTAssets,
  linkedAssetIds,
  onLinkedAssetsChange,
  onAdjustedScoreChange,
  isLoading = false,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoMatchedAssets, setAutoMatchedAssets] = useState<OTAssetMatch[]>([]);
  const [isAutoMatching, setIsAutoMatching] = useState(false);

  // Filter OT assets only
  const otAssets = useMemo(() => {
    return availableOTAssets.filter((a) => a.otDetails?.isOTAsset);
  }, [availableOTAssets]);

  // Get manually linked assets (not auto-matched)
  const manuallyLinkedAssets = useMemo((): MatchedAssetDisplay[] => {
    const autoMatchedIds = new Set(autoMatchedAssets.map((a) => a.assetId));

    return linkedAssetIds
      .filter((id) => !autoMatchedIds.has(id))
      .map((id) => {
        const asset = otAssets.find((a) => a.id === id);
        if (!asset) return null;

        return {
          assetId: asset.id,
          assetName: asset.name,
          manufacturer: asset.otDetails?.manufacturer || '',
          model: asset.otDetails?.model || '',
          firmwareVersion: asset.otDetails?.firmwareVersion || '',
          matchConfidence: 100,
          matchType: 'exact' as const,
          otCriticality: asset.otDetails?.otCriticality || 'operations',
          networkSegment: asset.networkSegment || 'OT',
          safetyRating: asset.otDetails?.safetyRating,
          connectedToIT: asset.otDetails?.connectedToIT,
          isManual: true,
        };
      })
      .filter((a): a is MatchedAssetDisplay => a !== null);
  }, [linkedAssetIds, autoMatchedAssets, otAssets]);

  // Combine auto-matched and manual assets
  const allMatchedAssets = useMemo((): MatchedAssetDisplay[] => {
    return [...autoMatchedAssets, ...manuallyLinkedAssets];
  }, [autoMatchedAssets, manuallyLinkedAssets]);

  // Calculate adjusted score
  const adjustedScore = useMemo((): OTAdjustedScore | null => {
    if (allMatchedAssets.length === 0) return null;

    // Find highest criticality asset for score calculation
    const highestCriticalityAsset = allMatchedAssets.reduce((highest, current) => {
      const order = { safety: 4, production: 3, operations: 2, monitoring: 1 };
      return order[current.otCriticality] > order[highest.otCriticality] ? current : highest;
    });

    return OTVulnerabilityService.calculateOTAdjustedScore(
      baseScore,
      {
        otCriticality: highestCriticalityAsset.otCriticality,
        connectedToIT: highestCriticalityAsset.connectedToIT,
        safetyRating: highestCriticalityAsset.safetyRating,
      },
      patchAvailable
    );
  }, [allMatchedAssets, baseScore, patchAvailable]);

  // Notify parent of adjusted score changes
  useEffect(() => {
    if (adjustedScore && onAdjustedScoreChange) {
      onAdjustedScoreChange(adjustedScore.adjustedScore, adjustedScore.factors);
    }
  }, [adjustedScore, onAdjustedScoreChange]);

  // Filter available assets for manual linking
  const filteredAvailableAssets = useMemo(() => {
    const linkedSet = new Set(linkedAssetIds);
    let filtered = otAssets.filter((a) => !linkedSet.has(a.id));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.otDetails?.manufacturer?.toLowerCase().includes(query) ||
          a.otDetails?.model?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [otAssets, linkedAssetIds, searchQuery]);

  // Handle manual asset linking
  const handleLinkAsset = useCallback(
    (assetId: string) => {
      if (!linkedAssetIds.includes(assetId)) {
        onLinkedAssetsChange([...linkedAssetIds, assetId]);
      }
      setShowAddAsset(false);
      setSearchQuery('');
    },
    [linkedAssetIds, onLinkedAssetsChange]
  );

  // Handle asset removal
  const handleRemoveAsset = useCallback(
    (assetId: string) => {
      onLinkedAssetsChange(linkedAssetIds.filter((id) => id !== assetId));
      // Also remove from auto-matched if present
      setAutoMatchedAssets((prev) => prev.filter((a) => a.assetId !== assetId));
    },
    [linkedAssetIds, onLinkedAssetsChange]
  );

  // Trigger auto-matching (mock for now)
  const handleAutoMatch = useCallback(async () => {
    if (!cveId) return;

    setIsAutoMatching(true);
    try {
      // In a real implementation, this would query the CVE database
      // and match against OT asset details
      // For now, simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock: randomly match some OT assets if they exist
      const mockMatches = otAssets.slice(0, 2).map((asset): OTAssetMatch => ({
        assetId: asset.id,
        assetName: asset.name,
        manufacturer: asset.otDetails?.manufacturer || '',
        model: asset.otDetails?.model || '',
        firmwareVersion: asset.otDetails?.firmwareVersion || '',
        matchConfidence: Math.floor(Math.random() * 30) + 70,
        matchType: Math.random() > 0.5 ? 'exact' : 'partial',
        otCriticality: asset.otDetails?.otCriticality || 'operations',
        networkSegment: asset.networkSegment || 'OT',
        safetyRating: asset.otDetails?.safetyRating,
        connectedToIT: asset.otDetails?.connectedToIT,
      }));

      setAutoMatchedAssets(mockMatches);

      // Add to linked assets
      const newLinkedIds = [...new Set([...linkedAssetIds, ...mockMatches.map((m) => m.assetId)])];
      onLinkedAssetsChange(newLinkedIds);
    } finally {
      setIsAutoMatching(false);
    }
  }, [cveId, otAssets, linkedAssetIds, onLinkedAssetsChange]);

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('otVulnerability.otImpact', 'OT Impact')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-white/50">
              {allMatchedAssets.length} {t('otVulnerability.assetsLinked', 'assets linked')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cveId && (
            <button
              type="button"
              onClick={handleAutoMatch}
              disabled={isAutoMatching || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isAutoMatching ? 'animate-spin' : ''}`} />
              {t('otVulnerability.autoMatch', 'Auto-Match')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddAsset(!showAddAsset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-600 dark:text-white/70 text-xs font-medium transition-colors border border-slate-200 dark:border-white/10"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('otVulnerability.addAsset', 'Add Asset')}
          </button>
        </div>
      </div>

      {/* Add asset dropdown */}
      {showAddAsset && (
        <div className="rounded-xl border border-white/10 bg-white dark:bg-slate-900/50 p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('otVulnerability.searchAssets', 'Search OT assets...')}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Asset list */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {filteredAvailableAssets.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-white/50 text-center py-4">
                {searchQuery
                  ? t('otVulnerability.noAssetsFound', 'No OT assets found')
                  : t('otVulnerability.noOTAssets', 'No OT assets available')}
              </p>
            ) : (
              filteredAvailableAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleLinkAsset(asset.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Cpu className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{asset.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/50 truncate">
                      {asset.otDetails?.manufacturer} {asset.otDetails?.model}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Matched assets list */}
      {allMatchedAssets.length > 0 && (
        <div className={`space-y-2 ${compact ? '' : 'space-y-3'}`}>
          {allMatchedAssets.map((asset) => (
            <AssetMatchCard
              key={asset.assetId}
              asset={asset}
              onRemove={() => handleRemoveAsset(asset.assetId)}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Score preview */}
      <ScorePreview
        baseScore={baseScore}
        adjustedScore={adjustedScore}
        compact={compact}
      />

      {/* Empty state */}
      {allMatchedAssets.length === 0 && !showAddAsset && (
        <div className={`rounded-xl border border-dashed border-slate-300 dark:border-white/20 ${compact ? 'p-4' : 'p-6'} text-center`}>
          <Cpu className="h-8 w-8 mx-auto text-slate-300 dark:text-white/30 mb-2" />
          <p className="text-sm text-slate-500 dark:text-white/50 mb-1">
            {t('otVulnerability.noOTImpact', 'No OT assets linked')}
          </p>
          <p className="text-xs text-slate-400 dark:text-white/40">
            {cveId
              ? t('otVulnerability.useAutoMatch', 'Use Auto-Match or add assets manually')
              : t('otVulnerability.addManually', 'Add OT assets manually to calculate adjusted score')}
          </p>
        </div>
      )}
    </div>
  );
};

export default OTImpactSection;
