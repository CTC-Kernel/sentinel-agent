/**
 * Framework Settings Component
 * Story 4.1: Framework Activation - Enable/disable compliance frameworks
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Check, AlertCircle, Shield, Scale, Landmark } from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { useStore } from '../../store';
import { useSettingsData } from '../../hooks/settings/useSettingsData';
import { FRAMEWORKS } from '../../data/frameworks';
import { Framework } from '../../types';
import { hasPermission } from '../../utils/permissions';
import { ErrorLogger } from '../../services/errorLogger';
import { logAction } from '../../services/logger';

const FRAMEWORK_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
 Compliance: Shield,
 Risk: AlertCircle,
 Governance: Scale,
};

const FRAMEWORK_TYPE_COLORS: Record<string, string> = {
 Compliance: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
 Risk: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
 Governance: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// Plan limits for frameworks
const PLAN_FRAMEWORK_LIMITS: Record<string, number> = {
 discovery: 1,
 professional: 6,
 enterprise: 999, // Unlimited
};

export const FrameworkSettings: React.FC = () => {
 const { user, addToast, t, activeFramework, setActiveFramework } = useStore();
 const { organization, updateOrganization } = useSettingsData();
 const [selectedFrameworks, setSelectedFrameworks] = useState<Framework[]>([]);
 const [saving, setSaving] = useState(false);
 const [hasChanges, setHasChanges] = useState(false);

 // Get plan limits
 const planId = organization?.subscription?.planId || 'discovery';
 const maxFrameworks = PLAN_FRAMEWORK_LIMITS[planId] || 1;
 const isAtLimit = selectedFrameworks.length >= maxFrameworks;

 // Initialize from organization data
 useEffect(() => {
 if (organization?.enabledFrameworks) {
 setSelectedFrameworks(organization.enabledFrameworks);
 }
 }, [organization?.enabledFrameworks]);

 // Track changes
 useEffect(() => {
 const currentFrameworks = organization?.enabledFrameworks || [];
 const hasChanged =
 selectedFrameworks.length !== currentFrameworks.length ||
 selectedFrameworks.some(f => !currentFrameworks.includes(f));
 setHasChanges(hasChanged);
 }, [selectedFrameworks, organization?.enabledFrameworks]);

 const handleToggleFramework = useCallback((frameworkId: Framework) => {
 setSelectedFrameworks(prev => {
 const isSelected = prev.includes(frameworkId);
 if (isSelected) {
 return prev.filter(f => f !== frameworkId);
 } else {
 // Check limit before adding
 if (prev.length >= maxFrameworks) {
  addToast(
  t('settings.frameworkLimitReached') ||
  `Votre plan est limité à ${maxFrameworks} framework(s). Passez à un plan supérieur pour en activer plus.`,
  'info'
  );
  return prev;
 }
 return [...prev, frameworkId];
 }
 });
 }, [maxFrameworks, addToast, t]);

 const handleSave = useCallback(async () => {
 if (!hasPermission(user, 'Settings', 'manage') || !organization) return;

 setSaving(true);
 try {
 await updateOrganization({ enabledFrameworks: selectedFrameworks });

 // Sync with global store: if current active framework is now disabled, clear it
 if (activeFramework && !selectedFrameworks.includes(activeFramework as Framework)) {
 setActiveFramework(null);
 }

 // If no framework is active but some are enabled, set the first one as active
 if (!activeFramework && selectedFrameworks.length > 0) {
 setActiveFramework(selectedFrameworks[0]);
 }

 await logAction(user, 'UPDATE', 'Organization', `Frameworks activés: ${selectedFrameworks.join(', ') || 'Aucun'}`);
 addToast(t('settings.frameworksUpdated') || 'Frameworks mis à jour avec succès', 'success');
 setHasChanges(false);
 } catch (e) {
 ErrorLogger.handleErrorWithToast(e, 'FrameworkSettings.handleSave', 'UPDATE_FAILED');
 } finally {
 setSaving(false);
 }
 }, [user, organization, selectedFrameworks, updateOrganization, addToast, t, activeFramework, setActiveFramework]);

 const handleReset = useCallback(() => {
 if (organization?.enabledFrameworks) {
 setSelectedFrameworks(organization.enabledFrameworks);
 } else {
 setSelectedFrameworks([]);
 }
 }, [organization?.enabledFrameworks]);

 // Group frameworks by type
 const frameworksByType = FRAMEWORKS.reduce((acc, fw) => {
 if (!acc[fw.type]) acc[fw.type] = [];
 acc[fw.type].push(fw);
 return acc;
 }, {} as Record<string, Array<typeof FRAMEWORKS[number]>>);

 if (!hasPermission(user, 'Settings', 'manage')) {
 return (
 <div className="glass-premium p-8 text-center rounded-3xl border border-border/40">
 <Landmark className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
 <h3 className="text-lg font-bold text-foreground mb-2">
  Accès restreint
 </h3>
 <p className="text-sm text-muted-foreground">
  Vous n'avez pas les permissions nécessaires pour modifier les frameworks.
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-6 sm:space-y-8">
 {/* Header */}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40">
 <div className="flex items-start justify-between mb-4">
  <div>
  <h2 className="text-xl font-bold text-foreground">
  {t('settings.frameworksTitle') || 'Référentiels de Conformité'}
  </h2>
  <p className="text-sm text-muted-foreground mt-1">
  {t('settings.frameworksDescription') ||
  'Sélectionnez les référentiels que votre organisation doit respecter.'}
  </p>
  </div>
  <Badge
  status={isAtLimit ? 'warning' : 'info'}
  variant="soft"
  size="sm"
  >
  {selectedFrameworks.length} / {maxFrameworks === 999 ? '∞' : maxFrameworks}
  </Badge>
 </div>

 {/* Plan limit warning */}
 {isAtLimit && planId !== 'enterprise' && (
  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-200 dark:border-amber-800 dark:border-amber-800">
  <div className="flex items-start gap-3">
  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
  <div>
  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
   Limite atteinte
  </p>
  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
   Votre plan {planId} est limité à {maxFrameworks} framework(s).
   Passez au plan supérieur pour en activer davantage.
  </p>
  </div>
  </div>
  </div>
 )}
 </div>

 {/* Framework Groups */}
 {Object.entries(frameworksByType).map(([type, frameworks]) => {
 const Icon = FRAMEWORK_TYPE_ICONS[type] || Shield;
 return (
  <div key={type || 'unknown'} className="space-y-4">
  <div className="flex items-center gap-2">
  <Icon className="w-5 h-5 text-muted-foreground" />
  <h3 className="text-lg font-semibold text-foreground">
  {type === 'Compliance' && 'Conformité'}
  {type === 'Risk' && 'Gestion des Risques'}
  {type === 'Governance' && 'Gouvernance'}
  </h3>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {frameworks.map(fw => {
  const isSelected = selectedFrameworks.includes(fw.id as Framework);
  const isDisabled = !isSelected && isAtLimit;

  return (
   <button
   key={fw.id || 'unknown'}
   onClick={() => handleToggleFramework(fw.id as Framework)}
   disabled={isDisabled}
   className={`
   relative p-4 rounded-3xl border-2 transition-all text-left
   ${isSelected
   ? 'border-primary bg-primary/10 dark:bg-primary'
   : 'border-border/40 hover:border-border/40 dark:hover:border-slate-600 bg-card/50'
   }
   ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
   `}
   aria-pressed={isSelected}
   aria-label={`${isSelected ? 'Désactiver' : 'Activer'} ${fw.label}`}
   >
   <div className="flex items-start justify-between">
   <div className="flex-1">
   <div className="flex items-center gap-2 mb-1">
    <span className="font-semibold text-foreground">
    {fw.id}
    </span>
    <span className={`text-xs px-2 py-0.5 rounded-full ${FRAMEWORK_TYPE_COLORS[fw.type]}`}>
    {fw.type}
    </span>
   </div>
   <p className="text-sm text-muted-foreground">
    {fw.label}
   </p>
   </div>
   <div className={`
   w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
   ${isSelected
    ? 'bg-primary text-primary-foreground'
    : 'border-2 border-border/40'
   }
   `}>
   {isSelected && <Check className="w-4 h-4" />}
   </div>
   </div>
   </button>
  );
  })}
  </div>
  </div>
 );
 })}

 {/* Actions */}
 <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
 {hasChanges && (
  <Button
  variant="ghost"
  onClick={handleReset}
  disabled={saving}
  >
  {t('common.cancel', { defaultValue: 'Annuler' })}
  </Button>
 )}
 <Button
  onClick={handleSave}
  disabled={!hasChanges || saving}
  isLoading={saving}
 >
  {saving ? t('common.saving', { defaultValue: 'Enregistrement...' }) : t('settings.saveChanges', { defaultValue: 'Enregistrer les modifications' })}
 </Button>
 </div>
 </div>
 );
};
