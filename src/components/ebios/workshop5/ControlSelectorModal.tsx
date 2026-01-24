/**
 * ControlSelectorModal.tsx
 * Modal for selecting ISO 27002 controls to mitigate risks
 *
 * Story 19.2: Sélection des Mesures ISO 27002
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Search,
  Shield,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Filter,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import { ISO_DOMAINS, ISO_SEED_CONTROLS } from '../../../data/complianceData';

interface ControlSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (controlIds: string[]) => void;
  selectedControlIds: string[];
  suggestedControlCodes?: string[];
  scenarioName?: string;
}

// Control with additional metadata for display
interface DisplayControl {
  code: string;
  name: string;
  domain: string;
  domainTitle: string;
  isSuggested: boolean;
}

export const ControlSelectorModal: React.FC<ControlSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedControlIds,
  suggestedControlCodes = [],
  scenarioName,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDomains, setExpandedDomains] = useState<string[]>(['A.5', 'A.8']); // Expand org & tech by default
  const [showOnlySuggested, setShowOnlySuggested] = useState(false);
  const [localSelection, setLocalSelection] = useState<string[]>(selectedControlIds);

  // Build controls with domain info
  const allControls: DisplayControl[] = useMemo(() => {
    return ISO_SEED_CONTROLS.map((ctrl) => {
      const domainId = ctrl.code.split('.').slice(0, 2).join('.');
      const domain = ISO_DOMAINS.find((d) => d.id === domainId);
      return {
        ...ctrl,
        domain: domainId,
        domainTitle: domain?.title || domainId,
        isSuggested: suggestedControlCodes.includes(ctrl.code),
      };
    });
  }, [suggestedControlCodes]);

  // Filter controls
  const filteredControls = useMemo(() => {
    let controls = allControls;

    if (showOnlySuggested) {
      controls = controls.filter((c) => c.isSuggested);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      controls = controls.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query)
      );
    }

    return controls;
  }, [allControls, searchQuery, showOnlySuggested]);

  // Group by domain
  const controlsByDomain = useMemo(() => {
    const grouped: Record<string, DisplayControl[]> = {};
    filteredControls.forEach((ctrl) => {
      if (!grouped[ctrl.domain]) {
        grouped[ctrl.domain] = [];
      }
      grouped[ctrl.domain].push(ctrl);
    });
    return grouped;
  }, [filteredControls]);

  // Toggle domain expansion
  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) =>
      prev.includes(domainId)
        ? prev.filter((d) => d !== domainId)
        : [...prev, domainId]
    );
  };

  // Toggle control selection
  const toggleControl = (code: string) => {
    setLocalSelection((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  };

  // Select all suggested
  const selectAllSuggested = () => {
    const suggestedCodes = allControls
      .filter((c) => c.isSuggested)
      .map((c) => c.code);
    setLocalSelection((prev) => [
      ...new Set([...prev, ...suggestedCodes]),
    ]);
  };

  // Handle save
  const handleSave = () => {
    onSelect(localSelection);
    onClose();
  };

  if (!isOpen) return null;

  const suggestedCount = allControls.filter((c) => c.isSuggested).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('ebios.workshop5.selectControls')}
              </h2>
              {scenarioName && (
                <p className="text-sm text-slate-500">{scenarioName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="py-4 space-y-3 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ebios.workshop5.searchControls')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {suggestedCount > 0 && (
                <button
                  onClick={() => setShowOnlySuggested(!showOnlySuggested)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    showOnlySuggested
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('ebios.workshop5.suggestedControls')} ({suggestedCount})
                </button>
              )}

              {suggestedCount > 0 && !showOnlySuggested && (
                <button
                  onClick={selectAllSuggested}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  {t('ebios.workshop5.selectAllSuggested')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="w-4 h-4" />
              {filteredControls.length} {t('ebios.workshop5.controlsAvailable')}
            </div>
          </div>
        </div>

        {/* Control List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {ISO_DOMAINS.map((domain) => {
            const domainControls = controlsByDomain[domain.id] || [];
            if (domainControls.length === 0) return null;

            const isExpanded = expandedDomains.includes(domain.id);
            const selectedInDomain = domainControls.filter((c) =>
              localSelection.includes(c.code)
            ).length;
            const suggestedInDomain = domainControls.filter((c) => c.isSuggested).length;

            return (
              <div key={domain.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {/* Domain Header */}
                <button
                  onClick={() => toggleDomain(domain.id)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="text-left">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {domain.id} - {domain.title}
                      </span>
                      <span className="ml-2 text-sm text-slate-500">
                        ({domainControls.length} {locale === 'fr' ? 'contrôles' : 'controls'})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestedInDomain > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium">
                        {suggestedInDomain} {locale === 'fr' ? 'suggérés' : 'suggested'}
                      </span>
                    )}
                    {selectedInDomain > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                        {selectedInDomain} {locale === 'fr' ? 'sélectionnés' : 'selected'}
                      </span>
                    )}
                  </div>
                </button>

                {/* Domain Controls */}
                {isExpanded && (
                  <div className="p-2 space-y-1">
                    {domainControls.map((ctrl) => {
                      const isSelected = localSelection.includes(ctrl.code);
                      return (
                        <button
                          key={ctrl.code}
                          onClick={() => toggleControl(ctrl.code)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left",
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-blue-500 border-blue-500"
                                  : "border-slate-300 dark:border-slate-600"
                              )}
                            >
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div>
                              <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                                {ctrl.code}
                              </span>
                              <span className="ml-2 text-sm text-slate-900 dark:text-white">
                                {ctrl.name}
                              </span>
                            </div>
                          </div>
                          {ctrl.isSuggested && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs">
                              <Sparkles className="w-3 h-3" />
                              {locale === 'fr' ? 'Suggéré' : 'Suggested'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredControls.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500">{t('ebios.workshop5.noControlsFound')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {localSelection.length} {locale === 'fr' ? 'contrôles sélectionnés' : 'controls selected'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              {t('ebios.workshop5.applyControls')}
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default ControlSelectorModal;
