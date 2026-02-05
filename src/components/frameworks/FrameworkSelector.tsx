/**
 * FrameworkSelector Component
 *
 * Main component for selecting and managing regulatory frameworks.
 * Displays all available frameworks and allows activation/deactivation.
 *
 * @see Story EU-1.3: Créer le composant FrameworkSelector
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Shield, CheckCircle } from 'lucide-react';
import {
  useFrameworks,
  useActiveFrameworks,
  useFrameworkActivation,
} from '../../hooks/useFrameworks';
import { FrameworkCard } from './FrameworkCard';
import { ActivateFrameworkModal } from './ActivateFrameworkModal';
import { DeactivateFrameworkModal } from './DeactivateFrameworkModal';
import { cn } from '../../utils/cn';
import type { RegulatoryFramework, ActiveFramework } from '../../types/framework';

// ============================================================================
// Types
// ============================================================================

type FilterMode = 'all' | 'active' | 'inactive';

interface FrameworkSelectorProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const FrameworkSelector: React.FC<FrameworkSelectorProps> = ({ className }) => {
  const { t } = useTranslation();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activateModal, setActivateModal] = useState<RegulatoryFramework | null>(null);
  const [deactivateModal, setDeactivateModal] = useState<RegulatoryFramework | null>(null);

  // Data
  const { data: frameworks = [], isLoading: isLoadingFrameworks } = useFrameworks({
    realtime: true,
  });
  const { data: activeFrameworks = [], isLoading: isLoadingActive } = useActiveFrameworks({
    realtime: true,
  });
  const { activate, deactivate, isActivating, isDeactivating } = useFrameworkActivation();

  // Create a map for quick lookup
  const activeFrameworkMap = useMemo(() => {
    const map = new Map<string, ActiveFramework>();
    for (const af of activeFrameworks) {
      map.set(af.frameworkId, af);
    }
    return map;
  }, [activeFrameworks]);

  // Filter frameworks
  const filteredFrameworks = useMemo(() => {
    let result = frameworks;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.code.toLowerCase().includes(query) ||
          f.name.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterMode === 'active') {
      result = result.filter((f) => activeFrameworkMap.has(f.id));
    } else if (filterMode === 'inactive') {
      result = result.filter((f) => !activeFrameworkMap.has(f.id));
    }

    return result;
  }, [frameworks, searchQuery, filterMode, activeFrameworkMap]);

  // Handlers
  const handleActivate = (framework: RegulatoryFramework) => {
    setActivateModal(framework);
  };

  const handleDeactivate = (framework: RegulatoryFramework) => {
    setDeactivateModal(framework);
  };

  const handleConfirmActivate = (targetDate?: string, notes?: string) => {
    if (!activateModal) return;
    activate(
      {
        frameworkId: activateModal.id,
        frameworkCode: activateModal.code,
        targetComplianceDate: targetDate,
        notes,
      },
      {
        onSuccess: () => {
          setActivateModal(null);
        },
      }
    );
  };

  const handleConfirmDeactivate = () => {
    if (!deactivateModal) return;
    deactivate(deactivateModal.id, {
      onSuccess: () => {
        setDeactivateModal(null);
      },
    });
  };

  const isLoading = isLoadingFrameworks || isLoadingActive;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Stats */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {activeFrameworks.length} {t('frameworks.activated', 'activés')}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-white/5">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">
            {frameworks.length} {t('frameworks.available', 'disponibles')}
          </span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('frameworks.searchPlaceholder', 'Rechercher un framework...')}
            className="w-full pl-11 pr-4 py-3 rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-muted-foreground focus:ring-2 focus-visible:ring-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-3xl bg-slate-100 dark:bg-slate-800/50">
          {(['all', 'active', 'inactive'] as FilterMode[]).map((mode) => (
            <button
              key={mode || 'unknown'}
              onClick={() => setFilterMode(mode)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filterMode === mode
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {mode === 'all' && t('frameworks.filterAll', 'Tous')}
              {mode === 'active' && t('frameworks.filterActive', 'Actifs')}
              {mode === 'inactive' && t('frameworks.filterInactive', 'Inactifs')}
            </button>
          ))}
        </div>
      </div>

      {/* Frameworks Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i || 'unknown'}
              className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-pulse"
            />
          ))}
        </div>
      ) : filteredFrameworks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-16 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Filter className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            {t('frameworks.noResults', 'Aucun framework trouvé')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            {t('frameworks.tryDifferentSearch', 'Essayez avec d\'autres critères de recherche')}
          </p>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredFrameworks.map((framework) => (
              <FrameworkCard
                key={framework.id || 'unknown'}
                framework={framework}
                activeFramework={activeFrameworkMap.get(framework.id)}
                onActivate={handleActivate}
                onDeactivate={handleDeactivate}
                isLoading={isActivating || isDeactivating}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals */}
      <ActivateFrameworkModal
        isOpen={!!activateModal}
        onClose={() => setActivateModal(null)}
        onConfirm={handleConfirmActivate}
        framework={activateModal}
        isLoading={isActivating}
      />

      <DeactivateFrameworkModal
        isOpen={!!deactivateModal}
        onClose={() => setDeactivateModal(null)}
        onConfirm={handleConfirmDeactivate}
        framework={deactivateModal}
        isLoading={isDeactivating}
      />
    </div>
  );
};

export default FrameworkSelector;
