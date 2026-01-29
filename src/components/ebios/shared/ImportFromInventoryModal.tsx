/**
 * Import From Inventory Modal
 * Story 15.7: Liaison avec Actifs Existants
 *
 * Modal for importing assets from the global inventory into EBIOS analysis
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Link2, Package, Check, AlertCircle } from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import { useAssets } from '../../../hooks/assets/useAssets';
import type { Asset } from '../../../types/assets';
import type { SupportingAsset } from '../../../types/ebios';
import { mapAssetToSupportingAsset, mapAssetTypeToEbiosType } from '../../../utils/ebiosUtils';

interface ImportFromInventoryModalProps {
  onImport: (assets: SupportingAsset[]) => void;
  onClose: () => void;
  existingLinkedAssetIds?: string[];
  essentialAssetIds?: string[]; // To pre-link to essential assets
}

export const ImportFromInventoryModal: React.FC<ImportFromInventoryModalProps> = ({
  onImport,
  onClose,
  existingLinkedAssetIds = [],
  essentialAssetIds = [],
}) => {
  const { t } = useTranslation();
  const { assets, loading } = useAssets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Asset['type'] | 'all'>('all');

  // Filter out already linked assets
  const availableAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter((asset) => !existingLinkedAssetIds.includes(asset.id));
  }, [assets, existingLinkedAssetIds]);

  // Apply search and type filters
  const filteredAssets = useMemo(() => {
    let result = availableAssets;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (asset) =>
          asset.name.toLowerCase().includes(query) ||
          asset.type.toLowerCase().includes(query) ||
          asset.location?.toLowerCase().includes(query) ||
          asset.owner?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((asset) => asset.type === typeFilter);
    }

    return result;
  }, [availableAssets, searchQuery, typeFilter]);

  // Group assets by type for display
  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    filteredAssets.forEach((asset) => {
      if (!groups[asset.type]) {
        groups[asset.type] = [];
      }
      groups[asset.type].push(asset);
    });
    return groups;
  }, [filteredAssets]);

  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
  }, [filteredAssets]);

  const deselectAll = useCallback(() => {
    setSelectedAssetIds(new Set());
  }, []);

  const handleImport = useCallback(() => {
    const selectedAssets = availableAssets.filter((asset) =>
      selectedAssetIds.has(asset.id)
    );

    const supportingAssets = selectedAssets.map((asset) =>
      mapAssetToSupportingAsset(asset, essentialAssetIds)
    );

    onImport(supportingAssets);
    onClose();
  }, [availableAssets, selectedAssetIds, essentialAssetIds, onImport, onClose]);

  const assetTypes: Asset['type'][] = ['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <PremiumCard glass className="max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-blue-100 dark:bg-blue-900/30">
              <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('ebios.workshop1.importFromInventory', 'Importer depuis l\'inventaire')}
              </h3>
              <p className="text-sm text-slate-600">
                {availableAssets.length} {t('ebios.workshop1.assetsAvailable', 'actifs disponibles')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-3xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="py-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ebios.workshop1.searchAssets', 'Rechercher des actifs...')}
              className="w-full pl-10 pr-4 py-2.5 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                typeFilter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {t('common.all', 'Tous')}
            </button>
            {assetTypes.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  typeFilter === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Selection controls */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-600">
              {selectedAssetIds.size} {t('common.selected', 'sélectionné(s)')}
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-blue-500 hover:text-blue-600 font-medium"
              >
                {t('common.selectAll', 'Tout sélectionner')}
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={deselectAll}
                className="text-slate-600 hover:text-slate-600 font-medium"
              >
                {t('common.deselectAll', 'Tout désélectionner')}
              </button>
            </div>
          </div>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-slate-300 dark:text-slate-300 mb-3" />
              <p className="text-slate-600 dark:text-muted-foreground">
                {searchQuery
                  ? t('ebios.workshop1.noAssetsMatchSearch', 'Aucun actif ne correspond à votre recherche')
                  : t('ebios.workshop1.noAssetsAvailable', 'Aucun actif disponible dans l\'inventaire')}
              </p>
            </div>
          ) : (
            Object.entries(groupedAssets).map(([type, typeAssets]) => (
              <div key={type}>
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                  {type} ({typeAssets.length})
                </h4>
                <div className="space-y-2">
                  {typeAssets.map((asset) => (
                    <label
                      key={asset.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-3xl border cursor-pointer transition-all',
                        selectedAssetIds.has(asset.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-border/40 dark:border-slate-700 hover:border-border/40 dark:hover:border-slate-600'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded flex items-center justify-center border-2 transition-colors',
                          selectedAssetIds.has(asset.id)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-border/40 dark:border-slate-600'
                        )}
                      >
                        {selectedAssetIds.has(asset.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.has(asset.id)}
                        onChange={() => toggleAssetSelection(asset.id)}
                        className="sr-only"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-white truncate">
                            {asset.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-600">
                            {mapAssetTypeToEbiosType(asset.type)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                          {asset.owner && `${asset.owner} • `}
                          {asset.location || t('common.noLocation', 'Emplacement non spécifié')}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border/40 dark:border-slate-700/50 flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {t('ebios.workshop1.importNote', 'Les actifs importés seront liés à l\'inventaire')}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-3xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              onClick={handleImport}
              disabled={selectedAssetIds.size === 0}
              className={cn(
                'px-5 py-2 rounded-3xl font-medium transition-colors',
                selectedAssetIds.size > 0
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-not-allowed'
              )}
            >
              {t('ebios.workshop1.importSelected', 'Importer')} ({selectedAssetIds.size})
            </button>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
};

export default ImportFromInventoryModal;
