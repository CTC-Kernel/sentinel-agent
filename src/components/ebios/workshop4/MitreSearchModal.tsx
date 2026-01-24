/**
 * MitreSearchModal.tsx
 * Modal for searching and selecting MITRE ATT&CK techniques
 *
 * Story 18.2: Séquences d'Attaque avec MITRE ATT&CK
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Search,
  ChevronRight,
  Shield,
  Target,
  Sparkles,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import {
  MITRE_TACTICS,
  MITRE_TECHNIQUES,
  searchMitreTechniques,
  getTechniquesForTactic,
  getMitreSuggestions,
  MitreTechniqueData,
  MitreSubtechnique,
} from '../../../data/ebiosLibrary';
import type { MitreReference, AttackStep } from '../../../types/ebios';

interface MitreSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reference: MitreReference) => void;
  previousSteps?: AttackStep[];
}

export const MitreSearchModal: React.FC<MitreSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  previousSteps = [],
}) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === 'fr' ? 'fr' : 'en') as 'fr' | 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTacticId, setSelectedTacticId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Get the last tactic from previous steps for suggestions
  const lastTacticId = useMemo(() => {
    if (previousSteps.length === 0) return null;
    const lastStep = previousSteps[previousSteps.length - 1];
    if (!lastStep.mitreReference) return null;
    const technique = MITRE_TECHNIQUES.find(t => t.id === lastStep.mitreReference?.techniqueId);
    return technique?.tacticId || null;
  }, [previousSteps]);

  // Get suggestions based on previous steps
  const suggestions = useMemo(() => {
    return getMitreSuggestions(lastTacticId);
  }, [lastTacticId]);

  // Search results
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    return searchMitreTechniques(searchQuery, locale);
  }, [searchQuery, locale]);

  // Techniques for selected tactic
  const tacticTechniques = useMemo(() => {
    if (!selectedTacticId) return [];
    return getTechniquesForTactic(selectedTacticId);
  }, [selectedTacticId]);

  // Handle technique selection
  const handleSelectTechnique = (technique: MitreTechniqueData, subtechnique?: MitreSubtechnique) => {
    const tactic = MITRE_TACTICS.find(t => t.id === technique.tacticId);

    const reference: MitreReference = {
      tacticId: technique.tacticId,
      tacticName: tactic?.name[locale] || technique.tacticId,
      techniqueId: subtechnique?.id || technique.id,
      techniqueName: subtechnique?.name[locale] || technique.name[locale],
      ...(subtechnique && {
        subtechniqueId: subtechnique.id,
        subtechniqueName: subtechnique.name[locale],
      }),
    };

    onSelect(reference);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('ebios.workshop4.selectMitreTechnique')}
              </h2>
              <p className="text-sm text-slate-500">
                MITRE ATT&CK Framework
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedTacticId(null);
              setShowSuggestions(false);
            }}
            placeholder={t('ebios.workshop4.searchMitre')}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-hidden flex">
          {/* Left Column - Tactics or Search Results */}
          <div className="w-1/3 border-r border-slate-200/50 dark:border-slate-700/50 overflow-y-auto pr-4">
            {/* Suggestions Section */}
            {showSuggestions && suggestions.length > 0 && !searchQuery && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('ebios.workshop4.suggestedTechniques')}
                </h3>
                <div className="space-y-1">
                  {suggestions.slice(0, 5).map((technique) => (
                    <button
                      key={technique.id}
                      onClick={() => handleSelectTechnique(technique)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm"
                    >
                      <code className="text-xs bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded text-purple-700 dark:text-purple-400">
                        {technique.id}
                      </code>
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {technique.name[locale]}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('ebios.workshop4.browseAll')}
                </button>
              </div>
            )}

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t('ebios.workshop4.searchResults')} ({searchResults.length})
                </h3>
                {searchResults.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    {t('ebios.workshop4.noResults')}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((technique) => (
                      <button
                        key={technique.id}
                        onClick={() => handleSelectTechnique(technique)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm",
                          "hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-muted-foreground">
                          {technique.id}
                        </code>
                        <span className="text-slate-700 dark:text-slate-300 truncate">
                          {technique.name[locale]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tactics List */}
            {!searchQuery && !showSuggestions && (
              <>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t('ebios.workshop4.tactics')}
                </h3>
                <div className="space-y-1">
                  {MITRE_TACTICS.map((tactic) => (
                    <button
                      key={tactic.id}
                      onClick={() => setSelectedTacticId(tactic.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors",
                        selectedTacticId === tactic.id
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-xs flex items-center justify-center font-medium">
                          {tactic.order}
                        </span>
                        <span className="truncate">{tactic.name[locale]}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right Column - Techniques */}
          <div className="w-2/3 overflow-y-auto pl-4">
            {selectedTacticId && !searchQuery ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {MITRE_TACTICS.find(t => t.id === selectedTacticId)?.name[locale]}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {MITRE_TACTICS.find(t => t.id === selectedTacticId)?.description[locale]}
                  </p>
                </div>

                <div className="space-y-3">
                  {tacticTechniques.map((technique) => (
                    <div
                      key={technique.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      {/* Technique Header */}
                      <button
                        onClick={() => handleSelectTechnique(technique)}
                        className="w-full flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left"
                      >
                        <code className="flex-shrink-0 text-sm bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded font-mono text-red-700 dark:text-red-400">
                          {technique.id}
                        </code>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {technique.name[locale]}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {technique.description[locale]}
                          </p>
                        </div>
                        <Target className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>

                      {/* Subtechniques */}
                      {technique.subtechniques && technique.subtechniques.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-2">
                          <p className="text-xs text-slate-500 mb-2 px-2">
                            {t('ebios.workshop4.subtechniques')}
                          </p>
                          <div className="space-y-1">
                            {technique.subtechniques.map((sub) => (
                              <button
                                key={sub.id}
                                onClick={() => handleSelectTechnique(technique, sub)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-white dark:hover:bg-slate-800"
                              >
                                <code className="text-xs bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-mono text-orange-700 dark:text-orange-400">
                                  {sub.id}
                                </code>
                                <span className="text-slate-700 dark:text-slate-300 truncate">
                                  {sub.name[locale]}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : !searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500">
                  {t('ebios.workshop4.selectTacticOrSearch')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('ebios.workshop4.killChainDescription')}
                </p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((technique) => (
                  <div
                    key={technique.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <button
                      onClick={() => handleSelectTechnique(technique)}
                      className="w-full flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left"
                    >
                      <code className="flex-shrink-0 text-sm bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded font-mono text-red-700 dark:text-red-400">
                        {technique.id}
                      </code>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {technique.name[locale]}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {MITRE_TACTICS.find(t => t.id === technique.tacticId)?.name[locale]}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {technique.description[locale]}
                        </p>
                      </div>
                      <Target className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>

                    {technique.subtechniques && technique.subtechniques.length > 0 && (
                      <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-2">
                        <div className="space-y-1">
                          {technique.subtechniques.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => handleSelectTechnique(technique, sub)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-white dark:hover:bg-slate-800"
                            >
                              <code className="text-xs bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-mono text-orange-700 dark:text-orange-400">
                                {sub.id}
                              </code>
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {sub.name[locale]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {MITRE_TECHNIQUES.length} {t('ebios.workshop4.techniquesAvailable')}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default MitreSearchModal;
