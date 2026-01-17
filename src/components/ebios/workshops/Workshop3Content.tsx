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
  X,
} from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-6xl h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setShowEcosystemMap(false)}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="absolute top-4 left-4 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-indigo-500" />
                {t('ebios.ecosystem.legend')} - {t('ebios.workshop3.ecosystem')}
              </h3>
            </div>
            <div className="pt-16 pb-4 px-4 h-full">
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
      <GlassCard>
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleSection('ecosystem')}
            className="flex-1 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('ebios.workshop3.ecosystem')}
                </h3>
                <p className="text-sm text-gray-500">
                  {data.ecosystem.length} {t('ebios.workshop3.partiesCount')}
                </p>
              </div>
            </div>
            {expandedSections.has('ecosystem') ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {/* Visualization Button (Story 17.5) */}
          {data.ecosystem.length > 0 && (
            <button
              onClick={() => setShowEcosystemMap(true)}
              className="ml-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              title={t('ebios.ecosystem.legend')}
            >
              <Network className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Visualiser</span>
            </button>
          )}
        </div>

        {expandedSections.has('ecosystem') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-500 mb-4">
              {t('ebios.workshop3.ecosystemHelp')}
            </p>

            {/* Ecosystem Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.ecosystem.map((party) => {
                const Icon = PARTY_TYPE_ICONS[party.type];
                const trustColor = getTrustLevelColor(party.trustLevel);

                return (
                  <div
                    key={party.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      "bg-white/50 dark:bg-gray-800/50",
                      party.category === 'internal'
                        ? "border-blue-200 dark:border-blue-800"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          party.category === 'internal'
                            ? "bg-blue-100 dark:bg-blue-900/30"
                            : "bg-gray-100 dark:bg-gray-800"
                        )}>
                          <Icon className={cn(
                            "w-4 h-4",
                            party.category === 'internal'
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-600 dark:text-gray-400"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {party.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t(`ebios.partyTypes.${party.type}`)}
                          </p>
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingParty(party);
                              setShowPartyForm(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Pencil className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteParty(party.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Trust Level Indicator */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">{t('ebios.workshop3.trustLevel')}:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={cn(
                              "w-3 h-3 rounded-full",
                              level <= party.trustLevel
                                ? `bg-${trustColor}-500`
                                : "bg-gray-200 dark:bg-gray-700"
                            )}
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
                  className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-indigo-500 min-h-[120px]"
                >
                  <Plus className="w-5 h-5" />
                  {t('ebios.workshop3.addParty')}
                </button>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Attack Paths Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('attackPaths')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop3.attackPaths')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.attackPaths.length} {t('ebios.workshop3.pathsCount')}
              </p>
            </div>
          </div>
          {expandedSections.has('attackPaths') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('attackPaths') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-500 mb-4">
              {t('ebios.workshop3.attackPathsHelp')}
            </p>

            {data.ecosystem.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t('ebios.workshop3.addEcosystemFirst')}
              </div>
            ) : (
              <div className="space-y-3">
                {data.attackPaths.map((path) => {
                  const sourceParty = getPartyById(path.sourcePartyId);
                  const targetAsset = getAssetById(path.targetAssetId);
                  const likelihoodScale = LIKELIHOOD_SCALE.find(l => l.level === path.likelihood);

                  return (
                    <div
                      key={path.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {path.name}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                              {sourceParty?.name || '?'}
                            </span>
                            <span className="text-gray-400">→</span>
                            {path.intermediatePartyIds.length > 0 && (
                              <>
                                <span className="text-gray-500">
                                  {path.intermediatePartyIds.length} {t('ebios.workshop3.intermediaries')}
                                </span>
                                <span className="text-gray-400">→</span>
                              </>
                            )}
                            <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              {targetAsset?.name || '?'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">{t('ebios.workshop3.likelihood')}</p>
                            <span className={cn(
                              "inline-block px-2 py-1 rounded text-sm font-medium mt-1",
                              `bg-${likelihoodScale?.color || 'gray'}-100 dark:bg-${likelihoodScale?.color || 'gray'}-900/30`,
                              `text-${likelihoodScale?.color || 'gray'}-700 dark:text-${likelihoodScale?.color || 'gray'}-400`
                            )}>
                              {path.likelihood}
                            </span>
                          </div>

                          {!readOnly && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingPath(path);
                                  setShowPathForm(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Pencil className="w-4 h-4 text-gray-400" />
                              </button>
                              <button
                                onClick={() => handleDeletePath(path.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
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
                    className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-orange-500"
                  >
                    <Plus className="w-5 h-5" />
                    {t('ebios.workshop3.addAttackPath')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Strategic Scenarios Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('strategicScenarios')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
              <Map className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop3.strategicScenarios')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.strategicScenarios.length} {t('ebios.workshop3.scenariosCount')}
              </p>
            </div>
          </div>
          {expandedSections.has('strategicScenarios') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('strategicScenarios') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-500 mb-4">
              {t('ebios.workshop3.strategicScenariosHelp')}
            </p>

            {retainedPairs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t('ebios.workshop3.noRetainedPairs')}
              </div>
            ) : (
              <div className="space-y-3">
                {data.strategicScenarios.map((scenario) => {
                  const gravityScale = GRAVITY_SCALE.find(g => g.level === scenario.gravity);

                  return (
                    <div
                      key={scenario.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {scenario.name}
                          </p>
                          {scenario.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                              <TrendingUp className="w-3 h-3" />
                              {scenario.attackPathIds.length} {t('ebios.workshop3.paths')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                              <ShieldAlert className="w-3 h-3" />
                              {scenario.fearedEventIds.length} {t('ebios.workshop3.fearedEvents')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">{t('ebios.workshop3.gravity')}</p>
                            <span className={cn(
                              "inline-block px-3 py-1.5 rounded-lg text-sm font-bold mt-1",
                              `bg-${gravityScale?.color || 'gray'}-100 dark:bg-${gravityScale?.color || 'gray'}-900/30`,
                              `text-${gravityScale?.color || 'gray'}-700 dark:text-${gravityScale?.color || 'gray'}-400`
                            )}>
                              G{scenario.gravity}
                            </span>
                          </div>

                          {!readOnly && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingScenario(scenario);
                                  setShowScenarioForm(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Pencil className="w-4 h-4 text-gray-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteScenario(scenario.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
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
                    className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-red-500"
                  >
                    <Plus className="w-5 h-5" />
                    {t('ebios.workshop3.addScenario')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </GlassCard>

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
