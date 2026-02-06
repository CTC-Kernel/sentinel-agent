/**
 * Epic 29: Story 29.6 & 29.7 - Anomaly Panel UI with Quick Actions
 *
 * Sidebar panel listing all detected anomalies:
 * - Filter by severity (critical, high, medium, low)
 * - Filter by type
 * - Click to focus on anomalous node in 3D view
 * - Show anomaly count badges
 * - Quick actions: Resolve, Ignore, Create Task
 * - Bulk actions for multiple anomalies
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
 AlertTriangle,
 AlertCircle,
 AlertOctagon,
 Info,
 Check,
 X,
 Eye,
 EyeOff,
 Filter,
 ChevronDown,
 ChevronUp,
 ListTodo,
 RefreshCw,
 Settings,
 MoreVertical,
} from '../ui/Icons';
import { motion, AnimatePresence } from 'framer-motion';
import type {
 VoxelAnomaly,
 VoxelAnomalyType,
 VoxelAnomalySeverity,
 VoxelNode,
} from '../../types/voxel';
import { useVoxelStore, useActiveAnomalies, useAnomalyCountBySeverity } from '../../stores/voxelStore';
import { useLocale } from '@/hooks/useLocale';
import { getVoxelPanelStyles } from './voxelTheme';

// ============================================================================
// Constants & Types
// ============================================================================

const SEVERITY_CONFIG: Record<
 VoxelAnomalySeverity,
 { color: string; bgColor: string; icon: React.FC<{ className?: string }> }
> = {
 critical: {
 color: 'text-error',
 bgColor: 'bg-error/10 border-error/30',
 icon: AlertOctagon,
 },
 high: {
 color: 'text-warning',
 bgColor: 'bg-warning/10 border-warning/30',
 icon: AlertTriangle,
 },
 medium: {
 color: 'text-yellow-500',
 bgColor: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500/30',
 icon: AlertCircle,
 },
 low: {
 color: 'text-info',
 bgColor: 'bg-info/10 border-info/30',
 icon: Info,
 },
};

const ANOMALY_TYPE_LABELS: Record<VoxelAnomalyType, string> = {
 orphan_control: 'Contrôle orphelin',
 circular_dependency: 'Dépendance circulaire',
 coverage_gap: 'Lacune de couverture',
 stale_assessment: 'Évaluation obsolète',
 compliance_drift: 'Dérive de conformité',
 orphan: 'Entité orpheline',
 stale: 'Entité obsolète',
 inconsistency: 'Incohérence',
 cycle: 'Cycle',
 cluster: 'Cluster anormal',
 trend: 'Tendance',
};

interface AnomalyPanelProps {
 isOpen: boolean;
 onClose: () => void;
 onFocusNode: (nodeId: string) => void;
 onResolve?: (anomalyId: string) => Promise<void>;
 onDismiss?: (anomalyId: string, reason: string) => Promise<void>;
 onCreateTask?: (anomaly: VoxelAnomaly) => void;
 onOpenAlertConfig?: () => void;
 onRefresh?: () => Promise<void>;
}

// ============================================================================
// Anomaly Item Component
// ============================================================================

interface AnomalyItemProps {
 anomaly: VoxelAnomaly;
 node?: VoxelNode;
 isSelected: boolean;
 onSelect: (id: string) => void;
 onFocus: (nodeId: string) => void;
 onResolve?: (id: string) => void;
 onDismiss?: (id: string) => void;
 onCreateTask?: (anomaly: VoxelAnomaly) => void;
}

const AnomalyItem: React.FC<AnomalyItemProps> = ({
 anomaly,
 node,
 isSelected,
 onSelect,
 onFocus,
 onResolve,
 onDismiss,
 onCreateTask,
}) => {
 const { config: localeConfig } = useLocale();
 const [showActions, setShowActions] = useState(false);
 const [showDismissInput, setShowDismissInput] = useState(false);
 const [dismissReason, setDismissReason] = useState('');

 const config = SEVERITY_CONFIG[anomaly.severity];
 const Icon = config.icon;
 const typeLabel = ANOMALY_TYPE_LABELS[anomaly.type] || anomaly.type;

 const handleDismissConfirm = () => {
 if (onDismiss && dismissReason.trim()) {
 onDismiss(anomaly.id);
 setShowDismissInput(false);
 setDismissReason('');
 }
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 className={`
 p-3 rounded-3xl border transition-all cursor-pointer
 ${isSelected ? 'ring-2 ring-primary' : ''}
 ${config.bgColor}
 hover:border-border
 `}
 onClick={() => onSelect(anomaly.id)}
 >
 {/* Header */}
 <div className="flex items-start gap-3">
 <div className={`mt-0.5 ${config.color}`}>
 <Icon className="h-5 w-5" />
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span
 className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${config.color} bg-muted/50`}
 >
 {anomaly.severity}
 </span>
 <span className="text-xs text-foreground/40">{typeLabel}</span>
 </div>

 <p className="text-sm text-foreground/90 mt-1 line-clamp-2">
 {anomaly.message}
 </p>

 {node && (
 <p className="text-xs text-foreground/50 mt-1">
 Noeud: {node.label || node.id.substring(0, 8)}...
 </p>
 )}

 <p className="text-xs text-foreground/30 mt-2">
 Détecté le{' '}
 {anomaly.detectedAt instanceof Date
 ? anomaly.detectedAt.toLocaleDateString(localeConfig.intlLocale)
 : new Date(anomaly.detectedAt).toLocaleDateString(localeConfig.intlLocale)}
 </p>
 </div>

 {/* Actions Menu */}
 <div className="relative">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setShowActions(!showActions);
 }}
 className="p-1 rounded-lg hover:bg-muted text-foreground/60 hover:text-foreground transition-colors"
 >
 <MoreVertical className="h-4 w-4" />
 </button>

 <AnimatePresence>
 {showActions && (
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 className="absolute right-0 top-8 z-decorator w-48 bg-muted rounded-3xl border border-border/40 shadow-xl overflow-hidden"
 >
 <button
  onClick={(e) => {
  e.stopPropagation();
  onFocus(anomaly.nodeId);
  setShowActions(false);
  }}
  className="w-full px-4 py-2.5 text-left text-sm text-foreground/90 hover:bg-muted/50 flex items-center gap-2"
 >
  <Eye className="h-4 w-4" />
  Voir dans la vue 3D
 </button>

 {onResolve && (
  <button
  onClick={(e) => {
  e.stopPropagation();
  onResolve(anomaly.id);
  setShowActions(false);
  }}
  className="w-full px-4 py-2.5 text-left text-sm text-green-400 hover:bg-muted/50 flex items-center gap-2"
  >
  <Check className="h-4 w-4" />
  Marquer résolu
  </button>
 )}

 {onDismiss && (
  <button
  onClick={(e) => {
  e.stopPropagation();
  setShowDismissInput(true);
  setShowActions(false);
  }}
  className="w-full px-4 py-2.5 text-left text-sm text-yellow-400 hover:bg-muted/50 flex items-center gap-2"
  >
  <EyeOff className="h-4 w-4" />
  Ignorer
  </button>
 )}

 {onCreateTask && (
  <button
  onClick={(e) => {
  e.stopPropagation();
  onCreateTask(anomaly);
  setShowActions(false);
  }}
  className="w-full px-4 py-2.5 text-left text-sm text-primary/70 hover:bg-muted/50 flex items-center gap-2"
  >
  <ListTodo className="h-4 w-4" />
  Créer une tâche
  </button>
 )}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>

 {/* Dismiss Input */}
 <AnimatePresence>
 {showDismissInput && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="mt-3 pt-3 border-t border-border/40"
 >
 <input
 type="text"
 value={dismissReason}
 onChange={(e) => setDismissReason(e.target.value)}
 placeholder="Raison de l'exclusion..."
 className="w-full bg-muted/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary"
 onClick={(e) => e.stopPropagation()}
 />
 <div className="flex justify-end gap-2 mt-2">
 <button
 onClick={(e) => {
  e.stopPropagation();
  setShowDismissInput(false);
  setDismissReason('');
 }}
 className="px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground"
 >
 Annuler
 </button>
 <button
 onClick={(e) => {
  e.stopPropagation();
  handleDismissConfirm();
 }}
 disabled={!dismissReason.trim()}
 className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 disabled:bg-muted disabled:text-muted-foreground"
 >
 Confirmer
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
};

// ============================================================================
// Main AnomalyPanel Component
// ============================================================================

// Help content component
const AnomalyHelpContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="px-5 py-4 bg-gradient-to-r from-primary/10 to-purple-500/10 border-b border-border/40"
 >
 <div className="flex items-start justify-between mb-3">
 <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
 <Info className="w-4 h-4 text-primary/70" />
 Comment utiliser ce panneau
 </h3>
 <button onClick={onClose} className="text-foreground/40 hover:text-foreground">
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="space-y-3 text-xs text-foreground/70">
 <div className="flex gap-2">
 <span className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">1</span>
 <p><strong className="text-foreground">Détection automatique</strong> - Le système analyse votre graphe et détecte les anomalies : contrôles orphelins, dépendances circulaires, lacunes de couverture...</p>
 </div>
 <div className="flex gap-2">
 <span className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">2</span>
 <p><strong className="text-foreground">Filtrez par sévérité</strong> - Cliquez sur les badges Critique/Élevé/Moyen/Faible pour filtrer les anomalies.</p>
 </div>
 <div className="flex gap-2">
 <span className="w-5 h-5 rounded bg-info/20 flex items-center justify-center text-info shrink-0">3</span>
 <p><strong className="text-foreground">Actions rapides</strong> - Cliquez sur ⋮ pour : voir le nœud en 3D, marquer résolu, ignorer, ou créer une tâche.</p>
 </div>
 <div className="flex gap-2">
 <span className="w-5 h-5 rounded bg-success/20 flex items-center justify-center text-success shrink-0">4</span>
 <p><strong className="text-foreground">Actions groupées</strong> - Sélectionnez plusieurs anomalies pour les résoudre en lot.</p>
 </div>
 </div>
 </motion.div>
);

export const AnomalyPanel: React.FC<AnomalyPanelProps> = ({
 isOpen,
 onClose,
 onFocusNode,
 onResolve,
 onDismiss,
 onCreateTask,
 onOpenAlertConfig,
 onRefresh,
}) => {
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [showFilters, setShowFilters] = useState(false);
 const [severityFilter, setSeverityFilter] = useState<VoxelAnomalySeverity[]>([]);
 const [typeFilter, setTypeFilter] = useState<VoxelAnomalyType[]>([]);
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [showHelp, setShowHelp] = useState(false);

 const activeAnomalies = useActiveAnomalies();
 const severityCounts = useAnomalyCountBySeverity();
 const nodes = useVoxelStore((s) => s.nodes);

 // Apply filters
 const filteredAnomalies = useMemo(() => {
 return activeAnomalies.filter((a) => {
 if (severityFilter.length > 0 && !severityFilter.includes(a.severity)) {
 return false;
 }
 if (typeFilter.length > 0 && !typeFilter.includes(a.type)) {
 return false;
 }
 return true;
 });
 }, [activeAnomalies, severityFilter, typeFilter]);

 // Get unique anomaly types for filter
 const availableTypes = useMemo(() => {
 const types = new Set<VoxelAnomalyType>();
 activeAnomalies.forEach((a) => types.add(a.type));
 return Array.from(types);
 }, [activeAnomalies]);

 // Handlers
 const handleSelect = useCallback((id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) {
 next.delete(id);
 } else {
 next.add(id);
 }
 return next;
 });
 }, []);

 const handleSelectAll = useCallback(() => {
 if (selectedIds.size === filteredAnomalies.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(filteredAnomalies.map((a) => a.id)));
 }
 }, [filteredAnomalies, selectedIds.size]);

 const handleBulkResolve = useCallback(async () => {
 if (!onResolve) return;
 for (const id of selectedIds) {
 await onResolve(id);
 }
 setSelectedIds(new Set());
 }, [onResolve, selectedIds]);

 const handleRefresh = useCallback(async () => {
 if (!onRefresh) return;
 setIsRefreshing(true);
 try {
 await onRefresh();
 } finally {
 setIsRefreshing(false);
 }
 }, [onRefresh]);

 const toggleSeverityFilter = (severity: VoxelAnomalySeverity) => {
 setSeverityFilter((prev) =>
 prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
 );
 };

 const toggleTypeFilter = (type: VoxelAnomalyType) => {
 setTypeFilter((prev) =>
 prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
 );
 };

 const clearFilters = () => {
 setSeverityFilter([]);
 setTypeFilter([]);
 };

 return (
 <AnimatePresence>
 {isOpen && (
 <>
 {/* Backdrop */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="absolute inset-0 bg-background/80 backdrop-blur-sm z-voxel-ui"
 onClick={onClose}
 />
 <motion.aside
 initial={{ x: '100%', opacity: 0 }}
 animate={{ x: 0, opacity: 1 }}
 exit={{ x: '100%', opacity: 0 }}
 transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
 className="absolute inset-y-0 right-0 w-[400px] z-voxel-panel flex flex-col"
 style={getVoxelPanelStyles()}
 >
 {/* Header */}
 <div className="p-5 border-b border-border/40 shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20">
  <AlertTriangle className="h-5 w-5 text-foreground" />
  </div>
  <div>
  <h2 className="text-lg font-bold text-foreground">Anomalies</h2>
  <p className="text-xs text-foreground/50">
  {activeAnomalies.length} détectée{activeAnomalies.length !== 1 ? 's' : ''}
  </p>
  </div>
 </div>
 <button
  onClick={onClose}
  className="p-2 rounded-full hover:bg-muted text-foreground/60 hover:text-foreground transition-colors"
 >
  <X className="h-5 w-5" />
 </button>
 </div>

 {/* Severity Badges */}
 <div className="flex gap-2 mt-4">
 {(['critical', 'high', 'medium', 'low'] as VoxelAnomalySeverity[]).map(
  (severity) => {
  const count = severityCounts[severity];
  const config = SEVERITY_CONFIG[severity];
  return (
  <button
  key={severity || 'unknown'}
  onClick={() => toggleSeverityFilter(severity)}
  className={`
  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
  ${severityFilter.includes(severity) ? config.bgColor + ' ring-1 ring-white/20' : 'bg-muted/50'}
  ${config.color}
  `}
  >
  {severity === 'critical' && <AlertOctagon className="h-3 w-3" />}
  {severity === 'high' && <AlertTriangle className="h-3 w-3" />}
  {severity === 'medium' && <AlertCircle className="h-3 w-3" />}
  {severity === 'low' && <Info className="h-3 w-3" />}
  {count}
  </button>
  );
  }
 )}
 </div>
 </div>

 {/* Toolbar */}
 <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2 shrink-0">
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`
 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
 ${showFilters || typeFilter.length > 0 ? 'bg-primary/15 text-primary/70' : 'bg-muted/50 text-foreground/60 hover:text-foreground'}
 `}
 >
 <Filter className="h-3 w-3" />
 Filtres
 {typeFilter.length > 0 && (
  <span className="bg-primary text-primary-foreground px-1.5 rounded-full text-xs">
  {typeFilter.length}
  </span>
 )}
 {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
 </button>

 <div className="flex-1" />

 <button
 onClick={() => setShowHelp(!showHelp)}
 className={`p-1.5 rounded-lg transition-colors ${showHelp ? 'bg-primary/15 text-primary/70' : 'bg-muted/50 text-foreground/60 hover:text-foreground'}`}
 title="Aide"
 >
 <Info className="h-4 w-4" />
 </button>

 {onRefresh && (
 <button
  onClick={handleRefresh}
  disabled={isRefreshing}
  className="p-1.5 rounded-lg bg-muted/50 text-foreground/60 hover:text-foreground transition-colors disabled:bg-muted disabled:text-muted-foreground"
  title="Actualiser"
 >
  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
 </button>
 )}

 {onOpenAlertConfig && (
 <button
  onClick={onOpenAlertConfig}
  className="p-1.5 rounded-lg bg-muted/50 text-foreground/60 hover:text-foreground transition-colors"
  title="Configuration des alertes"
 >
  <Settings className="h-4 w-4" />
 </button>
 )}
 </div>

 {/* Help Content */}
 <AnimatePresence>
 {showHelp && <AnomalyHelpContent onClose={() => setShowHelp(false)} />}
 </AnimatePresence>

 {/* Type Filters */}
 <AnimatePresence>
 {showFilters && availableTypes.length > 0 && (
 <motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  className="px-5 py-3 border-b border-border/40 bg-muted/50 overflow-hidden"
 >
  <div className="flex items-center justify-between mb-2">
  <span className="text-xs text-foreground/50">Filtrer par type</span>
  {(severityFilter.length > 0 || typeFilter.length > 0) && (
  <button
  onClick={clearFilters}
  className="text-xs text-primary/70 hover:text-primary/50"
  >
  Effacer tout
  </button>
  )}
  </div>
  <div className="flex flex-wrap gap-1.5">
  {availableTypes.map((type) => (
  <button
  key={type || 'unknown'}
  onClick={() => toggleTypeFilter(type)}
  className={`
  px-2 py-1 rounded text-xs transition-colors
  ${typeFilter.includes(type) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/60 hover:text-foreground'}
  `}
  >
  {ANOMALY_TYPE_LABELS[type] || type}
  </button>
  ))}
  </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Bulk Actions */}
 {selectedIds.size > 0 && (
 <div className="px-5 py-3 border-b border-border/40 bg-primary/10 flex items-center gap-2">
 <button
  onClick={handleSelectAll}
  className="text-xs text-primary/70 hover:text-primary/50"
 >
  {selectedIds.size === filteredAnomalies.length ? 'Désélectionner tout' : 'Sélectionner tout'}
 </button>
 <span className="text-xs text-foreground/40">|</span>
 <span className="text-xs text-foreground/60">
  {selectedIds.size} sélectionné{selectedIds.size !== 1 ? 's' : ''}
 </span>
 <div className="flex-1" />
 {onResolve && (
  <button
  onClick={handleBulkResolve}
  className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
  >
  Résoudre tout
  </button>
 )}
 </div>
 )}

 {/* Anomaly List */}
 <div className="flex-1 overflow-y-auto p-5 space-y-3">
 <AnimatePresence mode="popLayout">
 {filteredAnomalies.length === 0 ? (
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="text-center py-12"
  >
  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
  <Check className="h-8 w-8 text-green-500" />
  </div>
  <p className="text-foreground/60 text-sm">Aucune anomalie détectée</p>
  <p className="text-foreground/40 text-xs mt-1">
  {severityFilter.length > 0 || typeFilter.length > 0
  ? 'Essayez de modifier les filtres'
  : 'Votre système est sain'}
  </p>
  </motion.div>
 ) : (
  filteredAnomalies.map((anomaly) => (
  <AnomalyItem
  key={anomaly.id || 'unknown'}
  anomaly={anomaly}
  node={nodes.get(anomaly.nodeId)}
  isSelected={selectedIds.has(anomaly.id)}
  onSelect={handleSelect}
  onFocus={onFocusNode}
  onResolve={onResolve ? () => onResolve(anomaly.id) : undefined}
  onDismiss={onDismiss ? () => onDismiss(anomaly.id, '') : undefined}
  onCreateTask={onCreateTask}
  />
  ))
 )}
 </AnimatePresence>
 </div>
 </motion.aside>
 </>
 )}
 </AnimatePresence>
 );
};

export default AnomalyPanel;
