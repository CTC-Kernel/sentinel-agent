/**
 * Workshop 3: Scénarios Stratégiques
 * Main content component for EBIOS RM Workshop 3
 *
 * Sections:
 * 1. Ecosystem Mapping (Parties Prenantes)
 * 2. Attack Paths (Chemins d'Attaque)
 * 3. Strategic Scenarios (Scénarios Stratégiques)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  TrendingUp,
  Map,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Users,
  Building,
  Cloud,
  Truck,
  ShieldAlert,
  Network,
  Crosshair,
  X,
  Info,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import type {
  Workshop3Data,
  Workshop2Data,
  Workshop1Data,
  EcosystemParty,
  AttackPath,
  StrategicScenario,
  EcosystemPartyType,
} from '../../../types/ebios';
import { GRAVITY_SCALE, LIKELIHOOD_SCALE } from '../../../data/ebiosLibrary';
import { v4 as uuidv4 } from 'uuid';
import { EcosystemPartyForm } from '../workshop3/EcosystemPartyForm';
import { AttackPathForm } from '../workshop3/AttackPathForm';
import { StrategicScenarioForm } from '../workshop3/StrategicScenarioForm';
import { EcosystemMap } from '../workshop3/EcosystemMap';

interface Workshop3ContentProps {
  data: Workshop3Data;
  workshop1Data: Workshop1Data;
  workshop2Data: Workshop2Data;
  onDataChange: (data: Partial<Workshop3Data>) => void;
  readOnly?: boolean;
}

type SectionKey = 'ecosystem' | 'attackPaths' | 'strategicScenarios';

const PARTY_TYPE_ICONS: Record<EcosystemPartyType, typeof Users> = {
  supplier: Truck,
  partner: Users,
  customer: Users,
  regulator: Building,
  subcontractor: Truck,
  cloud_provider: Cloud,
  software_vendor: Cloud,
  service_provider: Building,
  other: Globe,
};

export const Workshop3Content: React.FC<Workshop3ContentProps> = ({
  data,
  workshop1Data,
  workshop2Data,
  onDataChange,
  readOnly = false,
}) => {
  const { t } = useTranslation();

  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['ecosystem', 'attackPaths', 'strategicScenarios'])
  );
  // Visualization state (Story 17.5)
  const [showEcosystemMap, setShowEcosystemMap] = useState(false);
  // Form state
  const [editingParty, setEditingParty] = useState<EcosystemParty | null>(null);
  const [editingPath, setEditingPath] = useState<AttackPath | null>(null);
  const [editingScenario, setEditingScenario] = useState<StrategicScenario | null>(null);
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [showPathForm, setShowPathForm] = useState(false);
  const [showScenarioForm, setShowScenarioForm] = useState(false);

  // Get retained SR/OV pairs from Workshop 2
  const retainedPairs = useMemo(() =>
    workshop2Data.srOvPairs.filter(p => p.retainedForAnalysis),
    [workshop2Data.srOvPairs]
  );

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Ecosystem Party handlers
  const handleAddParty = useCallback(() => {
    const newParty: EcosystemParty = {
      id: uuidv4(),
      name: '',
      description: '',
      type: 'supplier',
      category: 'external',
      trustLevel: 3,
      exposure: 3,
      cyberDependency: 3,
      penetration: 3,
    };
    setEditingParty(newParty);
    setShowPartyForm(true);
  }, []);

  const handleDeleteParty = useCallback((id: string) => {
    const ecosystem = data.ecosystem.filter(p => p.id !== id);
    // Also remove related attack paths
    const attackPaths = data.attackPaths.filter(
      ap => ap.sourcePartyId !== id && !ap.intermediatePartyIds.includes(id)
    );
    onDataChange({ ecosystem, attackPaths });
  }, [data.ecosystem, data.attackPaths, onDataChange]);

  // Attack Path handlers
  const handleAddPath = useCallback(() => {
    const newPath: AttackPath = {
      id: uuidv4(),
      name: '',
      description: '',
      sourcePartyId: data.ecosystem[0]?.id || '',
      targetAssetId: workshop1Data.scope.essentialAssets[0]?.id || '',
      intermediatePartyIds: [],
      likelihood: 2,
      complexity: 2,
    };
    setEditingPath(newPath);
    setShowPathForm(true);
  }, [data.ecosystem, workshop1Data.scope.essentialAssets]);

  const handleDeletePath = useCallback((id: string) => {
    const attackPaths = data.attackPaths.filter(p => p.id !== id);
    // Also remove from strategic scenarios
    const strategicScenarios = data.strategicScenarios.map(s => ({
      ...s,
      attackPathIds: s.attackPathIds.filter(apId => apId !== id),
    }));
    onDataChange({ attackPaths, strategicScenarios });
  }, [data.attackPaths, data.strategicScenarios, onDataChange]);

  // Strategic Scenario handlers
  const handleAddScenario = useCallback(() => {
    const newScenario: StrategicScenario = {
      id: uuidv4(),
      name: '',
      description: '',
      srOvPairId: retainedPairs[0]?.id || '',
      attackPathIds: [],
      fearedEventIds: [],
      gravity: 2,
      gravityJustification: '',
    };
    setEditingScenario(newScenario);
    setShowScenarioForm(true);
  }, [retainedPairs]);

  const handleDeleteScenario = useCallback((id: string) => {
    const strategicScenarios = data.strategicScenarios.filter(s => s.id !== id);
    onDataChange({ strategicScenarios });
  }, [data.strategicScenarios, onDataChange]);

  // Save handlers for forms
  const handleSaveParty = useCallback((party: EcosystemParty) => {
    const existingIndex = data.ecosystem.findIndex(p => p.id === party.id);
    let ecosystem: EcosystemParty[];
    if (existingIndex >= 0) {
      ecosystem = [...data.ecosystem];
      ecosystem[existingIndex] = party;
    } else {
      ecosystem = [...data.ecosystem, party];
    }
    onDataChange({ ecosystem });
    setShowPartyForm(false);
    setEditingParty(null);
  }, [data.ecosystem, onDataChange]);

  const handleSavePath = useCallback((path: AttackPath) => {
    const existingIndex = data.attackPaths.findIndex(p => p.id === path.id);
    let attackPaths: AttackPath[];
    if (existingIndex >= 0) {
      attackPaths = [...data.attackPaths];
      attackPaths[existingIndex] = path;
    } else {
      attackPaths = [...data.attackPaths, path];
    }
    onDataChange({ attackPaths });
    setShowPathForm(false);
    setEditingPath(null);
  }, [data.attackPaths, onDataChange]);

  const handleSaveScenario = useCallback((scenario: StrategicScenario) => {
    const existingIndex = data.strategicScenarios.findIndex(s => s.id === scenario.id);
    let strategicScenarios: StrategicScenario[];
    if (existingIndex >= 0) {
      strategicScenarios = [...data.strategicScenarios];
      strategicScenarios[existingIndex] = scenario;
    } else {
      strategicScenarios = [...data.strategicScenarios, scenario];
    }
    onDataChange({ strategicScenarios });
    setShowScenarioForm(false);
    setEditingScenario(null);
  }, [data.strategicScenarios, onDataChange]);

  // Helper functions
  const getPartyById = (id: string) => data.ecosystem.find(p => p.id === id);
  const getAssetById = (id: string) => workshop1Data.scope.essentialAssets.find(a => a.id === id);

  const getTrustLevelColor = (level: number) => {
    if (level <= 2) return 'red';
    if (level <= 3) return 'yellow';
    return 'green';
  };

  return (
    <div className="space-y-6">
      {/* Ecosystem Map Visualization (Story 17.5) */}
      {showEcosystemMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-6xl h-[85vh] bg-white/90 dark:bg-slate-900/90 rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-scale-in">
            <div className="absolute top-6 right-6 z-10">
              <button
                onClick={() => setShowEcosystemMap(false)}
                className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:scale-110 transition-transform hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="absolute top-6 left-6 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500 text-white shadow-lg shadow-brand">
                  <Network className="w-5 h-5" />
                </div>
                {t('ebios.ecosystem.legend')}
              </h3>
            </div>
            <div className="pt-24 pb-6 px-6 h-full">
              <EcosystemMap
                parties={data.ecosystem}
                attackPaths={data.attackPaths}
                assets={workshop1Data.scope.essentialAssets}
                onPartyClick={(party) => {
                  setEditingParty(party);
                  setShowPartyForm(true);
                }}
                onPathClick={(path) => {
                  setEditingPath(path);
                  setShowPathForm(true);
                }}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      )}

      {/* Ecosystem Section */}
      <div className="animate-fade-in-up delay-0">
        <GlassCard className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-brand/5 hover:border-brand-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection('ecosystem')}
              className="flex-1 flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform duration-300">
                  <Globe className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {t('ebios.workshop3.ecosystem')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {data.ecosystem.length} {t('ebios.workshop3.partiesCount')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {expandedSections.has('ecosystem') ? (
                  <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-all">
                    <ChevronUp className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                )}
              </div>
            </button>

            {/* Visualization Button (Story 17.5) */}
            {data.ecosystem.length > 0 && expandedSections.has('ecosystem') && (
              <div className="ml-4 pl-4 border-l border-slate-200 dark:border-slate-700 hidden sm:block">
                <button
                  onClick={() => setShowEcosystemMap(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-all transform hover:-translate-y-0.5 hover:shadow-md font-medium"
                  title={t('ebios.ecosystem.legend')}
                >
                  <Network className="w-4 h-4" />
                  <span>Visualiser</span>
                </button>
              </div>
            )}
          </div>

          {expandedSections.has('ecosystem') && (
            <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 animate-accordion-down">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <Info className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                {t('ebios.workshop3.ecosystemHelp')}
              </p>

              {/* Ecosystem Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.ecosystem.map((party) => {
                  const Icon = PARTY_TYPE_ICONS[party.type];
                  const trustColor = getTrustLevelColor(party.trustLevel);

                  return (
                    <div
                      key={party.id}
                      className={cn(
                        "group relative p-5 rounded-2xl border transition-all duration-300",
                        "bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm hover:shadow-lg hover:-translate-y-1",
                        party.category === 'internal'
                          ? "border-info-border hover:border-info"
                          : "border-slate-200 dark:border-slate-700 hover:border-brand-300"
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-xl shadow-sm",
                            party.category === 'internal'
                              ? "bg-info-bg text-info-text"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                          )}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-base">
                              {party.name}
                            </h4>
                            <span className={cn(
                              "inline-block px-2 py-0.5 rounded text-[11px] uppercase font-bold tracking-wider mt-1",
                              party.category === 'internal'
                                ? "bg-info-bg text-info-text"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            )}>
                              {t(`ebios.partyTypes.${party.type}`)}
                            </span>
                          </div>
                        </div>

                        {!readOnly && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-70 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingParty(party);
                                setShowPartyForm(true);
                              }}
                              className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-muted-foreground hover:text-brand-500 transition-colors shadow-sm"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteParty(party.id);
                              }}
                              className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-muted-foreground hover:text-red-500 transition-colors shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Trust Level Indicator */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50">
                        <span className="text-xs font-medium text-slate-500">{t('ebios.workshop3.trustLevel')}</span>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={cn(
                                "w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-800", // Add ring for separation
                                level <= party.trustLevel
                                  ? `bg-${trustColor}-500 shadow-[0_0_8px_rgba(var(--${trustColor}-500-rgb),0.5)]`
                                  : "bg-slate-200 dark:bg-slate-700"
                              )}
                              title={`${level}/5`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!readOnly && (
                  <button
                    onClick={handleAddParty}
                    className="group relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-100 dark:hover:bg-brand-50 dark:bg-brand-900 transition-all duration-300 min-h-[160px]"
                  >
                    <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300 mb-3 shadow-sm group-hover:shadow-brand group-hover:scale-110">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {t('ebios.workshop3.addParty')}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Attack Paths Section */}
      <div className="animate-fade-in-up delay-100">
        <GlassCard className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/5 hover:border-orange-500/20">
          <button
            onClick={() => toggleSection('attackPaths')}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {t('ebios.workshop3.attackPaths')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {data.attackPaths.length} {t('ebios.workshop3.pathsCount')}
                </p>
              </div>
            </div>
            {expandedSections.has('attackPaths') ? (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-orange-500 group-hover:text-white transition-all">
                <ChevronUp className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                <ChevronDown className="w-5 h-5" />
              </div>
            )}
          </button>

          {expandedSections.has('attackPaths') && (
            <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 animate-accordion-down">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <Info className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                {t('ebios.workshop3.attackPathsHelp')}
              </p>

              {data.ecosystem.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    {t('ebios.workshop3.ecosystemRequired', 'Ecosystème requis')}
                  </h4>
                  <p className="text-slate-500">{t('ebios.workshop3.addEcosystemFirst')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.attackPaths.map((path) => {
                    const sourceParty = getPartyById(path.sourcePartyId);
                    const targetAsset = getAssetById(path.targetAssetId);
                    const likelihoodScale = LIKELIHOOD_SCALE.find(l => l.level === path.likelihood);

                    return (
                      <div
                        key={path.id}
                        className="group relative p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {path.name}
                            </h4>

                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700">
                                <Globe className="w-3.5 h-3.5" />
                                <span className="font-medium">{sourceParty?.name || '?'}</span>
                              </div>

                              <div className="flex items-center text-muted-foreground">
                                <span className="w-8 h-px bg-current"></span>
                                <span className="text-[11px] uppercase font-bold tracking-wider px-1">Via</span>
                                <span className="w-8 h-px bg-current"></span>
                              </div>

                              {path.intermediatePartyIds.length > 0 && (
                                <>
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-muted-foreground">
                                    <span className="font-medium">{path.intermediatePartyIds.length} {t('ebios.workshop3.intermediaries')}</span>
                                  </div>
                                  <div className="text-muted-foreground">→</div>
                                </>
                              )}

                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-800/50">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span className="font-medium">{targetAsset?.name || '?'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/50">
                            <div className="flex flex-col items-end">
                              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1">{t('ebios.workshop3.likelihood')}</span>
                              <span className={cn(
                                "px-3 py-1 rounded-lg text-sm font-bold shadow-sm border",
                                `bg-${likelihoodScale?.color || 'gray'}-50 dark:bg-${likelihoodScale?.color || 'gray'}-900/20`,
                                `text-${likelihoodScale?.color || 'gray'}-700 dark:text-${likelihoodScale?.color || 'gray'}-400`,
                                `border-${likelihoodScale?.color || 'gray'}-200 dark:border-${likelihoodScale?.color || 'gray'}-800`
                              )}>
                                V{path.likelihood}
                              </span>
                            </div>

                            {!readOnly && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingPath(path);
                                    setShowPathForm(true);
                                  }}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900 transition-all"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePath(path.id)}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!readOnly && (
                    <button
                      onClick={handleAddPath}
                      className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-orange-600 font-medium group"
                    >
                      <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                      {t('ebios.workshop3.addAttackPath')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Strategic Scenarios Section */}
      <div className="animate-fade-in-up delay-200">
        <GlassCard className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-error/5 hover:border-error/20">
          <button
            onClick={() => toggleSection('strategicScenarios')}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-error-bg text-error-text group-hover:scale-110 transition-transform duration-300">
                <Map className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-error-text transition-colors">
                  {t('ebios.workshop3.strategicScenarios')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {data.strategicScenarios.length} {t('ebios.workshop3.scenariosCount')}
                </p>
              </div>
            </div>
            {expandedSections.has('strategicScenarios') ? (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-error group-hover:text-white transition-all">
                <ChevronUp className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                <ChevronDown className="w-5 h-5" />
              </div>
            )}
          </button>

          {expandedSections.has('strategicScenarios') && (
            <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 animate-accordion-down">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <Info className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                {t('ebios.workshop3.strategicScenariosHelp')}
              </p>

              {retainedPairs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Crosshair className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    {t('ebios.workshop3.noRetainedPairs', 'Aucun pair retenu')}
                  </h4>
                  <p className="text-slate-500">{t('ebios.workshop3.retainPairsFirst')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.strategicScenarios.map((scenario) => {
                    const gravityScale = GRAVITY_SCALE.find(g => g.level === scenario.gravity);

                    return (
                      <div
                        key={scenario.id}
                        className="group relative p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm hover:shadow-lg hover:border-error/30 transition-all duration-300"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2 group-hover:text-error-text transition-colors">
                              {scenario.name}
                            </h4>
                            {scenario.description && (
                              <p className="text-sm text-slate-500 dark:text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                                {scenario.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 dark:text-orange-300 border border-orange-100 dark:border-orange-800/50">
                                <TrendingUp className="w-3.5 h-3.5" />
                                {scenario.attackPathIds.length} {t('ebios.workshop3.paths')}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-error-bg text-error-text border border-error-border">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {scenario.fearedEventIds.length} {t('ebios.workshop3.fearedEvents')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/50">
                            <div className="flex flex-col items-end">
                              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1">{t('ebios.workshop3.gravity')}</span>
                              <span className={cn(
                                "inline-block px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm border",
                                `bg-${gravityScale?.color || 'gray'}-50 dark:bg-${gravityScale?.color || 'gray'}-900/20`,
                                `text-${gravityScale?.color || 'gray'}-700 dark:text-${gravityScale?.color || 'gray'}-400`,
                                `border-${gravityScale?.color || 'gray'}-200 dark:border-${gravityScale?.color || 'gray'}-800`
                              )}>
                                G{scenario.gravity}
                              </span>
                            </div>

                            {!readOnly && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingScenario(scenario);
                                    setShowScenarioForm(true);
                                  }}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900 transition-all"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteScenario(scenario.id)}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!readOnly && (
                    <button
                      onClick={handleAddScenario}
                      className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-error/50 hover:bg-error-bg/50 transition-all flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-error-text font-medium group"
                    >
                      <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-error-bg transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                      {t('ebios.workshop3.addScenario')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Modal Forms */}
      {showPartyForm && (
        <EcosystemPartyForm
          party={editingParty}
          onSave={handleSaveParty}
          onDelete={editingParty?.name ? (id) => {
            handleDeleteParty(id);
            setShowPartyForm(false);
            setEditingParty(null);
          } : undefined}
          onClose={() => {
            setShowPartyForm(false);
            setEditingParty(null);
          }}
        />
      )}

      {showPathForm && (
        <AttackPathForm
          path={editingPath}
          parties={data.ecosystem}
          assets={workshop1Data.scope.essentialAssets}
          onSave={handleSavePath}
          onDelete={editingPath?.name ? (id) => {
            handleDeletePath(id);
            setShowPathForm(false);
            setEditingPath(null);
          } : undefined}
          onClose={() => {
            setShowPathForm(false);
            setEditingPath(null);
          }}
        />
      )}

      {showScenarioForm && (
        <StrategicScenarioForm
          scenario={editingScenario}
          retainedPairs={retainedPairs}
          attackPaths={data.attackPaths}
          fearedEvents={workshop1Data.fearedEvents}
          onSave={handleSaveScenario}
          onDelete={editingScenario?.name ? (id) => {
            handleDeleteScenario(id);
            setShowScenarioForm(false);
            setEditingScenario(null);
          } : undefined}
          onClose={() => {
            setShowScenarioForm(false);
            setEditingScenario(null);
          }}
        />
      )}
    </div>
  );
};

export default Workshop3Content;
