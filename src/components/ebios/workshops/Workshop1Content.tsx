/**
 * Workshop 1: Cadrage et Socle de Sécurité
 * Main content component for EBIOS RM Workshop 1
 *
 * Sections:
 * 1. Scope Definition (Missions, Essential Assets, Supporting Assets)
 * 2. Feared Events (Événements Redoutés)
 * 3. Security Baseline (Socle de Sécurité)
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Box,
  Server,
  AlertTriangle,
  ShieldCheck,
  Plus,
  ChevronDown,
  ChevronUp,
  Link2,
  Download,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import type { Workshop1Data, Mission, EssentialAsset, SupportingAsset, FearedEvent } from '../../../types/ebios';
import { MissionForm } from './forms/MissionForm';
import { EssentialAssetForm } from './forms/EssentialAssetForm';
import { SupportingAssetForm } from './forms/SupportingAssetForm';
import { FearedEventForm } from './forms/FearedEventForm';
import { SecurityBaselinePanel } from './SecurityBaselinePanel';
import { ImportFromInventoryModal } from '../shared/ImportFromInventoryModal';
import { GRAVITY_SCALE } from '../../../data/ebiosLibrary';

interface Workshop1ContentProps {
  data: Workshop1Data;
  onDataChange: (data: Partial<Workshop1Data>) => void;
  readOnly?: boolean;
}

type SectionKey = 'missions' | 'essentialAssets' | 'supportingAssets' | 'fearedEvents' | 'securityBaseline';

export const Workshop1Content: React.FC<Workshop1ContentProps> = ({
  data,
  onDataChange,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['missions', 'essentialAssets', 'fearedEvents'])
  );
  const [editingItem, setEditingItem] = useState<{
    type: SectionKey;
    item: Mission | EssentialAsset | SupportingAsset | FearedEvent | null;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

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

  // Mission handlers
  const handleAddMission = useCallback(() => {
    setEditingItem({ type: 'missions', item: null });
  }, []);

  const handleEditMission = useCallback((mission: Mission) => {
    setEditingItem({ type: 'missions', item: mission });
  }, []);

  const handleSaveMission = useCallback((mission: Mission) => {
    const existing = data.scope.missions.find((m) => m.id === mission.id);
    const missions = existing
      ? data.scope.missions.map((m) => (m.id === mission.id ? mission : m))
      : [...data.scope.missions, mission];
    onDataChange({ scope: { ...data.scope, missions } });
    setEditingItem(null);
  }, [data.scope, onDataChange]);

  const handleDeleteMission = useCallback((id: string) => {
    const missions = data.scope.missions.filter((m) => m.id !== id);
    onDataChange({ scope: { ...data.scope, missions } });
  }, [data.scope, onDataChange]);

  // Essential Asset handlers
  const handleAddEssentialAsset = useCallback(() => {
    setEditingItem({ type: 'essentialAssets', item: null });
  }, []);

  const handleEditEssentialAsset = useCallback((asset: EssentialAsset) => {
    setEditingItem({ type: 'essentialAssets', item: asset });
  }, []);

  const handleSaveEssentialAsset = useCallback((asset: EssentialAsset) => {
    const existing = data.scope.essentialAssets.find((a) => a.id === asset.id);
    const essentialAssets = existing
      ? data.scope.essentialAssets.map((a) => (a.id === asset.id ? asset : a))
      : [...data.scope.essentialAssets, asset];
    onDataChange({ scope: { ...data.scope, essentialAssets } });
    setEditingItem(null);
  }, [data.scope, onDataChange]);

  const handleDeleteEssentialAsset = useCallback((id: string) => {
    const essentialAssets = data.scope.essentialAssets.filter((a) => a.id !== id);
    onDataChange({ scope: { ...data.scope, essentialAssets } });
  }, [data.scope, onDataChange]);

  // Supporting Asset handlers
  const handleAddSupportingAsset = useCallback(() => {
    setEditingItem({ type: 'supportingAssets', item: null });
  }, []);

  const handleEditSupportingAsset = useCallback((asset: SupportingAsset) => {
    setEditingItem({ type: 'supportingAssets', item: asset });
  }, []);

  const handleSaveSupportingAsset = useCallback((asset: SupportingAsset) => {
    const existing = data.scope.supportingAssets.find((a) => a.id === asset.id);
    const supportingAssets = existing
      ? data.scope.supportingAssets.map((a) => (a.id === asset.id ? asset : a))
      : [...data.scope.supportingAssets, asset];
    onDataChange({ scope: { ...data.scope, supportingAssets } });
    setEditingItem(null);
  }, [data.scope, onDataChange]);

  const handleDeleteSupportingAsset = useCallback((id: string) => {
    const supportingAssets = data.scope.supportingAssets.filter((a) => a.id !== id);
    onDataChange({ scope: { ...data.scope, supportingAssets } });
  }, [data.scope, onDataChange]);

  // Import from inventory handler
  const handleImportFromInventory = useCallback((importedAssets: SupportingAsset[]) => {
    const supportingAssets = [...data.scope.supportingAssets, ...importedAssets];
    onDataChange({ scope: { ...data.scope, supportingAssets } });
    setShowImportModal(false);
  }, [data.scope, onDataChange]);

  // Get existing linked asset IDs for filtering
  const existingLinkedAssetIds = data.scope.supportingAssets
    .filter((a) => a.linkedAssetId)
    .map((a) => a.linkedAssetId as string);

  // Feared Event handlers
  const handleAddFearedEvent = useCallback(() => {
    setEditingItem({ type: 'fearedEvents', item: null });
  }, []);

  const handleEditFearedEvent = useCallback((event: FearedEvent) => {
    setEditingItem({ type: 'fearedEvents', item: event });
  }, []);

  const handleSaveFearedEvent = useCallback((event: FearedEvent) => {
    const existing = data.fearedEvents.find((e) => e.id === event.id);
    const fearedEvents = existing
      ? data.fearedEvents.map((e) => (e.id === event.id ? event : e))
      : [...data.fearedEvents, event];
    onDataChange({ fearedEvents });
    setEditingItem(null);
  }, [data.fearedEvents, onDataChange]);

  const handleDeleteFearedEvent = useCallback((id: string) => {
    const fearedEvents = data.fearedEvents.filter((e) => e.id !== id);
    onDataChange({ fearedEvents });
  }, [data.fearedEvents, onDataChange]);

  // Security Baseline handler
  const handleSecurityBaselineChange = useCallback((baseline: Workshop1Data['securityBaseline']) => {
    onDataChange({ securityBaseline: baseline });
  }, [onDataChange]);

  const getCriticalityColor = (level: number) => {
    const scale = GRAVITY_SCALE.find((s) => s.level === level);
    return scale?.color || 'gray';
  };

  const getCriticalityLabel = (level: number) => {
    const scale = GRAVITY_SCALE.find((s) => s.level === level);
    return scale?.[locale] || '';
  };

  return (
    <div className="space-y-6">
      {/* Missions Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('missions')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop1.missions')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.scope.missions.length} {t('ebios.workshop1.missionCount')}
              </p>
            </div>
          </div>
          {expandedSections.has('missions') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('missions') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-3">
            {data.scope.missions.map((mission) => (
              <div
                key={mission.id}
                onClick={() => !readOnly && handleEditMission(mission)}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  "bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
                  !readOnly && "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {mission.name}
                    </h4>
                    {mission.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {mission.description}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                    `bg-${getCriticalityColor(mission.criticality)}-100 dark:bg-${getCriticalityColor(mission.criticality)}-900/30`,
                    `text-${getCriticalityColor(mission.criticality)}-700 dark:text-${getCriticalityColor(mission.criticality)}-400`
                  )}>
                    {getCriticalityLabel(mission.criticality)}
                  </span>
                </div>
              </div>
            ))}

            {!readOnly && (
              <button
                onClick={handleAddMission}
                className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-blue-500"
              >
                <Plus className="w-5 h-5" />
                {t('ebios.workshop1.addMission')}
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* Essential Assets Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('essentialAssets')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Box className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop1.essentialAssets')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.scope.essentialAssets.length} {t('ebios.workshop1.assetCount')}
              </p>
            </div>
          </div>
          {expandedSections.has('essentialAssets') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('essentialAssets') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-3">
            {data.scope.essentialAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => !readOnly && handleEditEssentialAsset(asset)}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  "bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
                  !readOnly && "cursor-pointer hover:border-purple-300 dark:hover:border-purple-700"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {asset.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {t(`ebios.assetTypes.${asset.type}`)}
                      </span>
                    </div>
                    {asset.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {asset.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {asset.linkedMissionIds.length} {t('ebios.workshop1.linkedMissions')}
                    </p>
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                    `bg-${getCriticalityColor(asset.criticality)}-100 dark:bg-${getCriticalityColor(asset.criticality)}-900/30`,
                    `text-${getCriticalityColor(asset.criticality)}-700 dark:text-${getCriticalityColor(asset.criticality)}-400`
                  )}>
                    {getCriticalityLabel(asset.criticality)}
                  </span>
                </div>
              </div>
            ))}

            {!readOnly && (
              <button
                onClick={handleAddEssentialAsset}
                className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-purple-500"
              >
                <Plus className="w-5 h-5" />
                {t('ebios.workshop1.addEssentialAsset')}
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* Supporting Assets Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('supportingAssets')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
              <Server className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop1.supportingAssets')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.scope.supportingAssets.length} {t('ebios.workshop1.assetCount')}
              </p>
            </div>
          </div>
          {expandedSections.has('supportingAssets') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('supportingAssets') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-3">
            {data.scope.supportingAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => !readOnly && handleEditSupportingAsset(asset)}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  "bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
                  !readOnly && "cursor-pointer hover:border-cyan-300 dark:hover:border-cyan-700"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {asset.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {t(`ebios.supportingAssetTypes.${asset.type}`)}
                    </span>
                    {asset.linkedAssetId && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        title={t('ebios.workshop1.linkedToInventory', 'Lié à l\'inventaire')}
                      >
                        <Link2 className="w-3 h-3" />
                        {t('ebios.workshop1.linked', 'Lié')}
                      </span>
                    )}
                  </div>
                  {asset.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {asset.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {asset.linkedEssentialAssetIds.length} {t('ebios.workshop1.linkedEssentialAssets')}
                  </p>
                </div>
              </div>
            ))}

            {!readOnly && (
              <div className="flex gap-3">
                <button
                  onClick={handleAddSupportingAsset}
                  className="flex-1 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-cyan-500"
                >
                  <Plus className="w-5 h-5" />
                  {t('ebios.workshop1.addSupportingAsset')}
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex-1 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-blue-500"
                >
                  <Download className="w-5 h-5" />
                  {t('ebios.workshop1.importFromInventory', 'Importer depuis l\'inventaire')}
                </button>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Feared Events Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('fearedEvents')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop1.fearedEvents')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.fearedEvents.length} {t('ebios.workshop1.eventCount')}
              </p>
            </div>
          </div>
          {expandedSections.has('fearedEvents') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('fearedEvents') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-3">
            {data.fearedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => !readOnly && handleEditFearedEvent(event)}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  "bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
                  !readOnly && "cursor-pointer hover:border-red-300 dark:hover:border-red-700"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {event.name}
                      </h4>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        event.impactType === 'confidentiality' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
                        event.impactType === 'integrity' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                        event.impactType === 'availability' && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                      )}>
                        {t(`ebios.impactTypes.${event.impactType}`)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {event.linkedMissionIds.length} {t('ebios.workshop1.linkedMissions')} · {event.linkedEssentialAssetIds.length} {t('ebios.workshop1.linkedAssets')}
                    </p>
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                    `bg-${getCriticalityColor(event.gravity)}-100 dark:bg-${getCriticalityColor(event.gravity)}-900/30`,
                    `text-${getCriticalityColor(event.gravity)}-700 dark:text-${getCriticalityColor(event.gravity)}-400`
                  )}>
                    G{event.gravity}
                  </span>
                </div>
              </div>
            ))}

            {!readOnly && (
              <button
                onClick={handleAddFearedEvent}
                className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-red-500"
              >
                <Plus className="w-5 h-5" />
                {t('ebios.workshop1.addFearedEvent')}
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* Security Baseline Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('securityBaseline')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop1.securityBaseline')}
              </h3>
              <p className="text-sm text-gray-500">
                {data.securityBaseline.implementedMeasures}/{data.securityBaseline.totalMeasures} {t('ebios.workshop1.measuresImplemented')}
              </p>
            </div>
          </div>
          {expandedSections.has('securityBaseline') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('securityBaseline') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <SecurityBaselinePanel
              baseline={data.securityBaseline}
              onChange={handleSecurityBaselineChange}
              readOnly={readOnly}
            />
          </div>
        )}
      </GlassCard>

      {/* Edit Modals */}
      {editingItem?.type === 'missions' && (
        <MissionForm
          mission={editingItem.item as Mission | null}
          onSave={handleSaveMission}
          onDelete={editingItem.item ? handleDeleteMission : undefined}
          onClose={() => setEditingItem(null)}
        />
      )}

      {editingItem?.type === 'essentialAssets' && (
        <EssentialAssetForm
          asset={editingItem.item as EssentialAsset | null}
          missions={data.scope.missions}
          onSave={handleSaveEssentialAsset}
          onDelete={editingItem.item ? handleDeleteEssentialAsset : undefined}
          onClose={() => setEditingItem(null)}
        />
      )}

      {editingItem?.type === 'supportingAssets' && (
        <SupportingAssetForm
          asset={editingItem.item as SupportingAsset | null}
          essentialAssets={data.scope.essentialAssets}
          onSave={handleSaveSupportingAsset}
          onDelete={editingItem.item ? handleDeleteSupportingAsset : undefined}
          onClose={() => setEditingItem(null)}
        />
      )}

      {editingItem?.type === 'fearedEvents' && (
        <FearedEventForm
          event={editingItem.item as FearedEvent | null}
          missions={data.scope.missions}
          essentialAssets={data.scope.essentialAssets}
          onSave={handleSaveFearedEvent}
          onDelete={editingItem.item ? handleDeleteFearedEvent : undefined}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Import from Inventory Modal */}
      {showImportModal && (
        <ImportFromInventoryModal
          onImport={handleImportFromInventory}
          onClose={() => setShowImportModal(false)}
          existingLinkedAssetIds={existingLinkedAssetIds}
          essentialAssetIds={data.scope.essentialAssets.map((a) => a.id)}
        />
      )}
    </div>
  );
};

export default Workshop1Content;
