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
import { PremiumCard } from '../../ui/PremiumCard';
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
 <div className="animate-fade-in-up delay-100">
 <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 border-border/40 rounded-3xl">
 <button
 onClick={() => toggleSection('missions')}
 aria-expanded={expandedSections.has('missions')}
 aria-controls="missions-section"
 className="w-full flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >

 <div className="flex items-center gap-4">
 <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300 shadow-sm">
 <Building2 className="w-6 h-6" />
 </div>
 <div className="text-left">
 <h3 className="text-lg font-bold text-foreground group-hover:text-primary dark:group-hover:text-primary/70 transition-colors">
  {t('ebios.workshop1.missions')}
 </h3>
 <p className="text-sm text-muted-foreground font-medium">
  {data.scope.missions.length} {t('ebios.workshop1.missionCount')}
 </p>
 </div>
 </div>
 {expandedSections.has('missions') ? (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-foreground transition-all">
 <ChevronUp className="w-5 h-5" />
 </div>
 ) : (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-muted transition-all">
 <ChevronDown className="w-5 h-5" />
 </div>
 )}
 </button>

 {expandedSections.has('missions') && (
 <div id="missions-section" className="mt-6 pt-6 border-t border-border/40 space-y-4 animate-accordion-down">

 {data.scope.missions.map((mission) => (
 <button
  key={mission.id || 'unknown'}
  type="button"
  onClick={() => !readOnly && handleEditMission(mission)}
  disabled={readOnly}
  aria-label={!readOnly ? `Modifier la mission ${mission.name}` : undefined}
  className={cn(
  "w-full text-left group p-4 rounded-3xl border transition-all duration-300",
  "bg-muted/30 border-border/40",
  !readOnly && "cursor-pointer hover:bg-card hover:border-primary/30/50 hover:shadow-apple-md hover:-translate-y-0.5",
  readOnly && "cursor-default"
  )}
 >


  <div className="flex items-start justify-between gap-4">
  <div className="flex-1 min-w-0">
  <h4 className="font-semibold text-foreground truncate text-base group-hover:text-primary dark:group-hover:text-primary/70 transition-colors">
  {mission.name}
  </h4>
  {mission.description && (
  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
  {mission.description}
  </p>
  )}
  </div>
  <span className={cn(
  "px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap uppercase tracking-wide border",
  `bg-${getCriticalityColor(mission.criticality)}-50 dark:bg-${getCriticalityColor(mission.criticality)}-900/20`,
  `text-${getCriticalityColor(mission.criticality)}-700 dark:text-${getCriticalityColor(mission.criticality)}-400`,
  `border-${getCriticalityColor(mission.criticality)}-200 dark:border-${getCriticalityColor(mission.criticality)}-800`
  )}>
  {getCriticalityLabel(mission.criticality)}
  </span>
  </div>
 </button>

 ))}

 {!readOnly && (
 <button
  onClick={handleAddMission}
  className="w-full p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-primary/40/50 hover:bg-primary/10/50 dark:hover:bg-primary/20 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-primary font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
  <div className="p-1 rounded-full bg-muted group-hover:bg-primary/20 dark:group-hover:bg-primary transition-colors">
  <Plus className="w-4 h-4" />
  </div>
  {t('ebios.workshop1.addMission')}
 </button>
 )}
 </div>
 )}
 </PremiumCard>
 </div>

 {/* Essential Assets Section */}
 <div className="animate-fade-in-up delay-200">
 <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5 border-border/40 rounded-3xl">
 <button
 onClick={() => toggleSection('essentialAssets')}
 aria-expanded={expandedSections.has('essentialAssets')}
 aria-controls="essential-assets-section"
 className="w-full flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >

 <div className="flex items-center gap-4">
 <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
 <Box className="w-6 h-6" />
 </div>
 <div className="text-left">
 <h3 className="text-lg font-bold text-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
  {t('ebios.workshop1.essentialAssets')}
 </h3>
 <p className="text-sm text-muted-foreground font-medium">
  {data.scope.essentialAssets.length} {t('ebios.workshop1.assetCount')}
 </p>
 </div>
 </div>
 {expandedSections.has('essentialAssets') ? (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-violet-500 group-hover:text-foreground transition-all">
 <ChevronUp className="w-5 h-5" />
 </div>
 ) : (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-muted transition-all">
 <ChevronDown className="w-5 h-5" />
 </div>
 )}
 </button>

 {expandedSections.has('essentialAssets') && (
 <div id="essential-assets-section" className="mt-6 pt-6 border-t border-border/40 space-y-4 animate-accordion-down">

 {data.scope.essentialAssets.map((asset) => (
 <button
  key={asset.id || 'unknown'}
  type="button"
  onClick={() => !readOnly && handleEditEssentialAsset(asset)}
  disabled={readOnly}
  aria-label={!readOnly ? `Modifier l'actif essentiel ${asset.name}` : undefined}
  className={cn(
  "w-full text-left group p-4 rounded-3xl border transition-all duration-300",
  "bg-muted/30 border-border/40",
  !readOnly && "cursor-pointer hover:bg-card hover:border-violet-200/50 hover:shadow-apple-md hover:-translate-y-0.5",
  readOnly && "cursor-default"
  )}
 >


  <div className="flex items-start justify-between gap-4">
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
  <h4 className="font-semibold text-foreground truncate text-base group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
  {asset.name}
  </h4>
  <span className="px-2 py-0.5 rounded-lg text-xs uppercase font-bold bg-muted/50 text-muted-foreground border border-border/40">
  {t(`ebios.assetTypes.${asset.type}`)}
  </span>
  </div>
  {asset.description && (
  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
  {asset.description}
  </p>
  )}
  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground font-medium">
  <div className="w-1.5 h-1.5 rounded-full bg-violet-500/50" />
  {asset.linkedMissionIds.length} {t('ebios.workshop1.linkedMissions')}
  </div>
  </div>
  <span className={cn(
  "px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap uppercase tracking-wide border",
  `bg-${getCriticalityColor(asset.criticality)}-50 dark:bg-${getCriticalityColor(asset.criticality)}-900/20`,
  `text-${getCriticalityColor(asset.criticality)}-700 dark:text-${getCriticalityColor(asset.criticality)}-400`,
  `border-${getCriticalityColor(asset.criticality)}-200 dark:border-${getCriticalityColor(asset.criticality)}-800`
  )}>
  {getCriticalityLabel(asset.criticality)}
  </span>
  </div>
 </button>

 ))}

 {!readOnly && (
 <button
  onClick={handleAddEssentialAsset}
  className="w-full p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-violet-300/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-violet-600 font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
  <div className="p-1 rounded-full bg-muted group-hover:bg-violet-200 dark:group-hover:bg-violet-800 transition-colors">
  <Plus className="w-4 h-4" />
  </div>
  {t('ebios.workshop1.addEssentialAsset')}
 </button>
 )}
 </div>
 )}
 </PremiumCard>
 </div>

 {/* Supporting Assets Section */}
 <div className="animate-fade-in-up delay-300">
 <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/5 border-border/40 rounded-3xl">
 <button
 onClick={() => toggleSection('supportingAssets')}
 aria-expanded={expandedSections.has('supportingAssets')}
 aria-controls="supporting-assets-section"
 className="w-full flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >

 <div className="flex items-center gap-4">
 <div className="p-3 rounded-2xl bg-muted/500/10 text-muted-foreground group-hover:scale-110 transition-transform duration-300 shadow-sm">
 <Server className="w-6 h-6" />
 </div>
 <div className="text-left">
 <h3 className="text-lg font-bold text-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground transition-colors">
  {t('ebios.workshop1.supportingAssets')}
 </h3>
 <p className="text-sm text-muted-foreground font-medium">
  {data.scope.supportingAssets.length} {t('ebios.workshop1.assetCount')}
 </p>
 </div>
 </div>
 {expandedSections.has('supportingAssets') ? (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-muted/500 group-hover:text-foreground transition-all">
 <ChevronUp className="w-5 h-5" />
 </div>
 ) : (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-muted transition-all">
 <ChevronDown className="w-5 h-5" />
 </div>
 )}
 </button>

 {expandedSections.has('supportingAssets') && (
 <div id="supporting-assets-section" className="mt-6 pt-6 border-t border-border/40 space-y-4 animate-accordion-down">

 {data.scope.supportingAssets.map((asset) => (
 <button
  key={asset.id || 'unknown'}
  type="button"
  onClick={() => !readOnly && handleEditSupportingAsset(asset)}
  disabled={readOnly}
  aria-label={!readOnly ? `Modifier l'actif de support ${asset.name}` : undefined}
  className={cn(
  "w-full text-left group p-4 rounded-3xl border transition-all duration-300",
  "bg-muted/30 border-border/40",
  !readOnly && "cursor-pointer hover:bg-card hover:border-border/40/50 hover:shadow-apple-md hover:-translate-y-0.5",
  readOnly && "cursor-default"
  )}
 >


  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
  <h4 className="font-semibold text-foreground truncate text-base group-hover:text-foreground dark:group-hover:text-muted-foreground transition-colors">
  {asset.name}
  </h4>
  <span className="px-2 py-0.5 rounded-lg text-xs uppercase font-bold bg-muted/50 text-muted-foreground border border-border/40">
  {t(`ebios.supportingAssetTypes.${asset.type}`)}
  </span>
  {asset.linkedAssetId && (
  <span
  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs uppercase font-bold bg-info-bg text-info-text border border-info-border"
  title={t('ebios.workshop1.linkedToInventory', 'Lié à l\'inventaire')}
  >
  <Link2 className="w-3 h-3" />
  {t('ebios.workshop1.linked', 'Lié')}
  </span>
  )}
  </div>
  {asset.description && (
  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
  {asset.description}
  </p>
  )}
  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground font-medium">
  <div className="w-1.5 h-1.5 rounded-full bg-muted/500/50" />
  {asset.linkedEssentialAssetIds.length} {t('ebios.workshop1.linkedEssentialAssets')}
  </div>
  </div>
 </button>

 ))}

 {!readOnly && (
 <div className="flex flex-col sm:flex-row gap-3">
  <button
  onClick={handleAddSupportingAsset}
  className="flex-1 p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-border/50 hover:bg-muted/50 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  >
  <div className="p-1 rounded-full bg-muted group-hover:bg-muted transition-colors">
  <Plus className="w-4 h-4" />
  </div>
  {t('ebios.workshop1.addSupportingAsset')}
  </button>
  <button
  onClick={() => setShowImportModal(true)}
  className="flex-1 p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-primary/40/50 hover:bg-primary/10/50 dark:hover:bg-primary/20 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-primary font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  >
  <div className="p-1 rounded-full bg-muted group-hover:bg-primary/20 dark:group-hover:bg-primary transition-colors">
  <Download className="w-4 h-4" />
  </div>
  {t('ebios.workshop1.importFromInventory', 'Importer depuis l\'inventaire')}
  </button>
 </div>
 )}
 </div>
 )}
 </PremiumCard>
 </div>

 {/* Feared Events Section */}
 <div className="animate-fade-in-up delay-400">
 <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-error/5 border-border/40 rounded-3xl">
 <button
 onClick={() => toggleSection('fearedEvents')}
 aria-expanded={expandedSections.has('fearedEvents')}
 aria-controls="feared-events-section"
 className="w-full flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >

 <div className="flex items-center gap-4">
 <div className="p-3 rounded-2xl bg-error-bg text-error-text group-hover:scale-110 transition-transform duration-300 shadow-sm">
 <AlertTriangle className="w-6 h-6" />
 </div>
 <div className="text-left">
 <h3 className="text-lg font-bold text-foreground group-hover:text-error-text transition-colors">
  {t('ebios.workshop1.fearedEvents')}
 </h3>
 <p className="text-sm text-muted-foreground font-medium">
  {data.fearedEvents.length} {t('ebios.workshop1.eventCount')}
 </p>
 </div>
 </div>
 {expandedSections.has('fearedEvents') ? (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-error group-hover:text-foreground transition-all">
 <ChevronUp className="w-5 h-5" />
 </div>
 ) : (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-muted transition-all">
 <ChevronDown className="w-5 h-5" />
 </div>
 )}
 </button>

 {expandedSections.has('fearedEvents') && (
 <div id="feared-events-section" className="mt-6 pt-6 border-t border-border/40 space-y-4 animate-accordion-down">

 {data.fearedEvents.map((event) => (
 <button
  key={event.id || 'unknown'}
  type="button"
  onClick={() => !readOnly && handleEditFearedEvent(event)}
  disabled={readOnly}
  aria-label={!readOnly ? `Modifier l'événement redouté ${event.name}` : undefined}
  className={cn(
  "w-full text-left group p-4 rounded-3xl border transition-all duration-300",
  "bg-muted/30 border-border/40",
  !readOnly && "cursor-pointer hover:bg-card hover:border-error/30 hover:shadow-apple-md hover:-translate-y-0.5",
  readOnly && "cursor-default"
  )}
 >


  <div className="flex items-start justify-between gap-4">
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
  <h4 className="font-semibold text-foreground truncate text-base group-hover:text-error-text transition-colors">
  {event.name}
  </h4>
  <span className={cn(
  "px-2 py-0.5 rounded-md text-xs uppercase font-bold border",
  event.impactType === 'confidentiality' && "bg-info-bg text-info-text border-info-border",
  event.impactType === 'integrity' && "bg-success-bg text-success-text border-success-border",
  event.impactType === 'availability' && "bg-warning-bg text-warning-text border-warning-border"
  )}>
  {t(`ebios.impactTypes.${event.impactType}`)}
  </span>
  </div>
  {event.description && (
  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
  {event.description}
  </p>
  )}
  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground font-medium">
  <span className="flex items-center gap-1.5">
  <div className="w-1.5 h-1.5 rounded-full bg-error/50" />
  {event.linkedMissionIds.length} {t('ebios.workshop1.linkedMissions')}
  </span>
  <span className="w-1 h-1 rounded-full bg-muted" />
  <span className="flex items-center gap-1.5">
  <div className="w-1.5 h-1.5 rounded-full bg-violet-500/50" />
  {event.linkedEssentialAssetIds.length} {t('ebios.workshop1.linkedAssets')}
  </span>
  </div>
  </div>
  <span className={cn(
  "px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap uppercase tracking-wide border",
  `bg-${getCriticalityColor(event.gravity)}-50 dark:bg-${getCriticalityColor(event.gravity)}-900/20`,
  `text-${getCriticalityColor(event.gravity)}-700 dark:text-${getCriticalityColor(event.gravity)}-400`,
  `border-${getCriticalityColor(event.gravity)}-200 dark:border-${getCriticalityColor(event.gravity)}-800`
  )}>
  G{event.gravity}
  </span>
  </div>
 </button>

 ))}

 {!readOnly && (
 <button
  onClick={handleAddFearedEvent}
  className="w-full p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-error/50 hover:bg-error-bg/50 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-error-text font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
  <div className="p-1 rounded-full bg-muted group-hover:bg-error-bg transition-colors">
  <Plus className="w-4 h-4" />
  </div>
  {t('ebios.workshop1.addFearedEvent')}
 </button>
 )}
 </div>
 )}
 </PremiumCard>
 </div>

 {/* Security Baseline Section */}
 <div className="animate-fade-in-up delay-500">
 <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-success/5 border-border/40 rounded-3xl">
 <button
 onClick={() => toggleSection('securityBaseline')}
 aria-expanded={expandedSections.has('securityBaseline')}
 aria-controls="security-baseline-section"
 className="w-full flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >

 <div className="flex items-center gap-4">
 <div className="p-3 rounded-2xl bg-success-bg text-success-text group-hover:scale-110 transition-transform duration-300 shadow-sm">
 <ShieldCheck className="w-6 h-6" />
 </div>
 <div className="text-left">
 <h3 className="text-lg font-bold text-foreground group-hover:text-success-text transition-colors">
  {t('ebios.workshop1.securityBaseline')}
 </h3>
 <p className="text-sm text-muted-foreground font-medium">
  {data.securityBaseline.implementedMeasures}/{data.securityBaseline.totalMeasures} {t('ebios.workshop1.measuresImplemented')}
 </p>
 </div>
 </div>
 {expandedSections.has('securityBaseline') ? (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-success group-hover:text-foreground transition-all">
 <ChevronUp className="w-5 h-5" />
 </div>
 ) : (
 <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:bg-muted transition-all">
 <ChevronDown className="w-5 h-5" />
 </div>
 )}
 </button>

 {expandedSections.has('securityBaseline') && (
 <div id="security-baseline-section" className="mt-6 pt-6 border-t border-border/40 animate-accordion-down">

 <SecurityBaselinePanel
 baseline={data.securityBaseline}
 onChange={handleSecurityBaselineChange}
 readOnly={readOnly}
 />
 </div>
 )}
 </PremiumCard>
 </div>

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
