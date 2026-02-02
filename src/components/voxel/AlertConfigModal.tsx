/**
 * Epic 29: Story 29.8 - Alert Configuration UI
 *
 * Modal to configure anomaly alert settings:
 * - Configure which anomaly types trigger alerts
 * - Set severity thresholds
 * - Choose notification channels (in-app, email)
 * - Per-organization settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Save,
  RotateCcw,
  AlertTriangle,
  Clock,
  Shield,
} from '../ui/Icons';
import { ErrorLogger } from '@/services/errorLogger';
import type {
  VoxelAlertConfig,
  AlertThreshold,
  AlertChannelConfig,
  VoxelAnomalyType,
  VoxelAnomalySeverity,
} from '../../types/voxel';
import { DEFAULT_ALERT_CONFIG } from '../../types/voxel';

// ============================================================================
// Constants
// ============================================================================

const ANOMALY_TYPE_INFO: Record<
  VoxelAnomalyType,
  { label: string; description: string }
> = {
  orphan_control: {
    label: 'Contrôle orphelin',
    description: 'Contrôles non liés à des risques',
  },
  circular_dependency: {
    label: 'Dépendance circulaire',
    description: 'Cycles dans les relations risques/contrôles',
  },
  coverage_gap: {
    label: 'Lacune de couverture',
    description: 'Risques sans contrôles de mitigation',
  },
  stale_assessment: {
    label: 'Évaluation obsolète',
    description: 'Entités non évaluées depuis plus de 90 jours',
  },
  compliance_drift: {
    label: 'Dérive de conformité',
    description: 'Efficacité des contrôles sous le seuil',
  },
  orphan: {
    label: 'Entité orpheline',
    description: 'Entités sans relations',
  },
  stale: {
    label: 'Entité obsolète',
    description: 'Entités non mises à jour',
  },
  inconsistency: {
    label: 'Incohérence',
    description: 'Incohérences dans les données',
  },
  cycle: {
    label: 'Cycle détecté',
    description: 'Cycles dans le graphe',
  },
  cluster: {
    label: 'Cluster anormal',
    description: 'Regroupements suspects',
  },
  trend: {
    label: 'Tendance préoccupante',
    description: 'Évolution négative détectée',
  },
};

const SEVERITY_LEVELS: VoxelAnomalySeverity[] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_COLORS: Record<VoxelAnomalySeverity, string> = {
  critical: 'text-error',
  high: 'text-warning',
  medium: 'text-yellow-500',
  low: 'text-info',
};

const SEVERITY_BG: Record<VoxelAnomalySeverity, string> = {
  critical: 'bg-error',
  high: 'bg-warning',
  medium: 'bg-yellow-500',
  low: 'bg-info',
};

// ============================================================================
// Component Props
// ============================================================================

interface AlertConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoxelAlertConfig | null;
  onSave: (config: Partial<VoxelAlertConfig>) => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// ThresholdRow Component
// ============================================================================

interface ThresholdRowProps {
  threshold: AlertThreshold;
  onChange: (updated: AlertThreshold) => void;
}

const ThresholdRow: React.FC<ThresholdRowProps> = ({ threshold, onChange }) => {
  const info = ANOMALY_TYPE_INFO[threshold.anomalyType];

  const handleToggle = () => {
    onChange({ ...threshold, enabled: !threshold.enabled });
  };

  const handleSeverityChange = (severity: VoxelAnomalySeverity) => {
    onChange({ ...threshold, minSeverity: severity });
  };

  return (
    <div
      className={`
        p-4 rounded-3xl border transition-all
        ${threshold.enabled
          ? 'bg-white/5 border-border/40'
          : 'bg-white/[0.02] border-white/5 opacity-60'}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`
            mt-0.5 w-10 h-6 rounded-full relative transition-colors
            ${threshold.enabled ? 'bg-brand-500' : 'bg-white/10'}
          `}
        >
          <span
            className={`
              absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
              ${threshold.enabled ? 'left-5' : 'left-1'}
            `}
          />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {info?.label || threshold.anomalyType}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            {info?.description || 'Aucune description'}
          </p>

          {/* Severity Selector */}
          {threshold.enabled && (
            <div className="mt-3">
              <span className="text-[11px] text-white/40 uppercase tracking-wider">
                Sévérité minimum
              </span>
              <div className="flex gap-1 mt-1.5">
                {SEVERITY_LEVELS.map((severity) => {
                  const isSelected = threshold.minSeverity === severity;
                  const isAtOrAbove =
                    SEVERITY_LEVELS.indexOf(severity) <=
                    SEVERITY_LEVELS.indexOf(threshold.minSeverity);

                  return (
                    <button
                      key={severity || 'unknown'}
                      onClick={() => handleSeverityChange(severity)}
                      className={`
                        px-2.5 py-1 rounded text-[11px] font-medium uppercase transition-all
                        ${isSelected ? `${SEVERITY_BG[severity]} text-white` : ''}
                        ${isAtOrAbove && !isSelected ? `${SEVERITY_COLORS[severity]} bg-white/5` : ''}
                        ${!isAtOrAbove ? 'text-white/20 bg-white/[0.02]' : ''}
                      `}
                    >
                      {severity}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main AlertConfigModal Component
// ============================================================================

export const AlertConfigModal: React.FC<AlertConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  isLoading = false,
}) => {
  // Local state for editing
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [channels, setChannels] = useState<AlertChannelConfig>({
    inApp: true,
    email: false,
  });
  const [maxAlertsPerHour, setMaxAlertsPerHour] = useState(10);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Accessibility: Handle keyboard escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize from config
  useEffect(() => {
    if (config) {
      setThresholds(config.thresholds);
      setChannels(config.channels);
      setMaxAlertsPerHour(config.maxAlertsPerHour);
      setCooldownMinutes(config.cooldownMinutes);
    } else {
      setThresholds(DEFAULT_ALERT_CONFIG.thresholds);
      setChannels(DEFAULT_ALERT_CONFIG.channels);
      setMaxAlertsPerHour(DEFAULT_ALERT_CONFIG.maxAlertsPerHour);
      setCooldownMinutes(DEFAULT_ALERT_CONFIG.cooldownMinutes);
    }
    setHasChanges(false);
  }, [config, isOpen]);

  // Track changes
  const markChanged = useCallback(() => setHasChanges(true), []);

  const handleThresholdChange = (index: number, updated: AlertThreshold) => {
    setThresholds((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    markChanged();
  };

  const handleChannelToggle = (channel: keyof AlertChannelConfig) => {
    setChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
    markChanged();
  };

  const handleReset = () => {
    setThresholds(DEFAULT_ALERT_CONFIG.thresholds);
    setChannels(DEFAULT_ALERT_CONFIG.channels);
    setMaxAlertsPerHour(DEFAULT_ALERT_CONFIG.maxAlertsPerHour);
    setCooldownMinutes(DEFAULT_ALERT_CONFIG.cooldownMinutes);
    markChanged();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        thresholds,
        channels,
        maxAlertsPerHour,
        cooldownMinutes,
      });
      setHasChanges(false);
      onClose();
    } catch (error) {
      ErrorLogger.error(error, 'AlertConfigModal.handleSave');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] z-modal"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-config-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] bg-slate-900 rounded-2xl border border-border/40 shadow-2xl z-modal flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-border/40 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <Bell className="h-5 w-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="alert-config-title" className="text-lg font-bold text-white">
                      Configuration des Alertes
                    </h2>
                    <p className="text-xs text-white/50">
                      Gérez les notifications d'anomalies
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer la configuration des alertes"
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Notification Channels */}
              <section>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-white/50" />
                  Canaux de notification
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* In-App */}
                  <button
                    onClick={() => handleChannelToggle('inApp')}
                    className={`
                      p-4 rounded-3xl border transition-all text-left
                      ${channels.inApp
                        ? 'bg-brand-50 border-brand-300'
                        : 'bg-white/[0.02] border-white/5'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {channels.inApp ? (
                        <Bell className="h-5 w-5 text-brand-400" />
                      ) : (
                        <BellOff className="h-5 w-5 text-white/30" />
                      )}
                      <div>
                        <span className="text-sm font-medium text-white">
                          In-App
                        </span>
                        <p className="text-[11px] text-white/50">
                          Notifications dans l'application
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Email */}
                  <button
                    onClick={() => handleChannelToggle('email')}
                    className={`
                      p-4 rounded-3xl border transition-all text-left
                      ${channels.email
                        ? 'bg-brand-50 border-brand-300'
                        : 'bg-white/[0.02] border-white/5'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Mail
                        className={`h-5 w-5 ${channels.email ? 'text-brand-400' : 'text-white/30'}`}
                      />
                      <div>
                        <span className="text-sm font-medium text-white">
                          Email
                        </span>
                        <p className="text-[11px] text-white/50">
                          Alertes par courriel
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </section>

              {/* Rate Limiting */}
              <section>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-white/50" />
                  Limitation des alertes
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-3xl bg-white/5 border border-border/40">
                    <label htmlFor="max-alerts" className="flex items-center gap-2 text-xs text-white/60 mb-2">
                      <Clock className="h-3 w-3" />
                      Max alertes / heure
                    </label>
                    <input
                      id="max-alerts"
                      type="number"
                      min={1}
                      max={100}
                      value={maxAlertsPerHour}
                      onChange={(e) => {
                        setMaxAlertsPerHour(parseInt(e.target.value) || 10);
                        markChanged();
                      }}
                      className="w-full bg-white/5 border border-border/40 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="p-4 rounded-3xl bg-white/5 border border-border/40">
                    <label htmlFor="cooldown" className="flex items-center gap-2 text-xs text-white/60 mb-2">
                      <Clock className="h-3 w-3" />
                      Cooldown (minutes)
                    </label>
                    <input
                      id="cooldown"
                      type="number"
                      min={5}
                      max={1440}
                      value={cooldownMinutes}
                      onChange={(e) => {
                        setCooldownMinutes(parseInt(e.target.value) || 30);
                        markChanged();
                      }}
                      className="w-full bg-white/5 border border-border/40 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </section>

              {/* Anomaly Type Thresholds */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-white/50" />
                    Types d'anomalies
                  </h3>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Réinitialiser
                  </button>
                </div>
                <div className="space-y-3">
                  {thresholds.map((threshold, index) => (
                    <ThresholdRow
                      key={threshold.anomalyType || 'unknown'}
                      threshold={threshold}
                      onChange={(updated) => handleThresholdChange(index, updated)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/40 shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  {hasChanges ? 'Modifications non sauvegardées' : 'Aucune modification'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving || isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AlertConfigModal;
