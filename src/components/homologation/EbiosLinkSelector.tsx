/**
 * EbiosLinkSelector
 *
 * Component for selecting and linking EBIOS analyses to homologation dossiers.
 * Story 38-4: EBIOS-Homologation Link
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link as LinkIcon,
  Unlink,
  AlertTriangle,
  Check,
  Search,
  Loader2,
  FileText,
  RefreshCw
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from '../../lib/toast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import {
  getEligibleEbiosAnalyses,
  linkEbiosAnalysis,
  unlinkEbiosAnalysis,
  checkEbiosChanges,
  syncEbiosData
} from '../../services/HomologationService';
import type { EbiosAnalysis } from '../../types/ebios';
import type { HomologationDossier } from '../../types/homologation';

// ============================================================================
// Types
// ============================================================================

interface EbiosLinkSelectorProps {
  dossier: HomologationDossier;
  onLinkChanged: () => void;
  mode?: 'compact' | 'full';
  disabled?: boolean;
}

interface EligibleAnalysis {
  analysis: EbiosAnalysis;
  eligible: boolean;
  reason?: string;
}

// ============================================================================
// Component
// ============================================================================

export const EbiosLinkSelector: React.FC<EbiosLinkSelectorProps> = ({
  dossier,
  onLinkChanged,
  mode = 'full',
  disabled = false
}) => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { organization } = useStore();
  const { user } = useAuth();

  // State
  const [analyses, setAnalyses] = useState<EligibleAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // Change detection state
  const [changeStatus, setChangeStatus] = useState<{
    hasChanges: boolean;
    details?: string[];
    checking: boolean;
  }>({ hasChanges: false, checking: false });

  // Fetch eligible analyses
  const fetchAnalyses = useCallback(async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const result = await getEligibleEbiosAnalyses(organization.id);
      setAnalyses(result);
    } catch {
      toast.error(
        t('homologation.ebios.fetchError', 'Erreur de chargement'),
        t('homologation.ebios.fetchErrorDesc', 'Impossible de charger les analyses EBIOS')
      );
    } finally {
      setLoading(false);
    }
  }, [organization?.id, t]);

  // Check for EBIOS changes
  const checkChanges = useCallback(async () => {
    if (!organization?.id || !dossier.linkedEbiosAnalysisId) return;

    setChangeStatus(prev => ({ ...prev, checking: true }));
    try {
      const result = await checkEbiosChanges(organization.id, dossier.id);
      setChangeStatus({
        hasChanges: result.hasChanges,
        details: result.changes?.details,
        checking: false
      });
    } catch {
      setChangeStatus(prev => ({ ...prev, checking: false }));
    }
  }, [organization?.id, dossier.id, dossier.linkedEbiosAnalysisId]);

  // Load analyses when selector opens
  useEffect(() => {
    if (showSelector) {
      fetchAnalyses();
    }
  }, [showSelector, fetchAnalyses]);

  // Check for changes when dossier has a linked EBIOS
  useEffect(() => {
    if (dossier.linkedEbiosAnalysisId && dossier.ebiosSnapshot) {
      checkChanges();
    }
  }, [dossier.linkedEbiosAnalysisId, dossier.ebiosSnapshot, checkChanges]);

  // Filter analyses by search term
  const filteredAnalyses = analyses.filter(({ analysis }) =>
    analysis.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Handle link action
  const handleLink = async () => {
    if (!organization?.id || !user?.uid || !selectedAnalysisId) return;

    setIsLinking(true);
    try {
      await linkEbiosAnalysis(organization.id, dossier.id, user.uid, selectedAnalysisId, linkNote || undefined);

      toast.success(
        t('homologation.ebios.linkSuccess', 'EBIOS lié'),
        t('homologation.ebios.linkSuccessDesc', "L'analyse EBIOS a été liée au dossier")
      );

      setShowSelector(false);
      setSelectedAnalysisId(null);
      setLinkNote('');
      onLinkChanged();
    } catch {
      toast.error(
        t('homologation.ebios.linkError', 'Erreur de liaison'),
        t('homologation.ebios.linkErrorDesc', 'Impossible de lier l\'analyse EBIOS')
      );
    } finally {
      setIsLinking(false);
    }
  };

  // Handle unlink action
  const handleUnlink = async () => {
    if (!organization?.id || !user?.uid) return;

    setIsUnlinking(true);
    try {
      await unlinkEbiosAnalysis(organization.id, dossier.id, user.uid);

      toast.success(
        t('homologation.ebios.unlinkSuccess', 'EBIOS délié'),
        t('homologation.ebios.unlinkSuccessDesc', "L'analyse EBIOS a été déliée du dossier")
      );

      setShowUnlinkConfirm(false);
      onLinkChanged();
    } catch {
      toast.error(
        t('homologation.ebios.unlinkError', 'Erreur de déliaison'),
        t('homologation.ebios.unlinkErrorDesc', 'Impossible de délier l\'analyse EBIOS')
      );
    } finally {
      setIsUnlinking(false);
    }
  };

  // Handle sync action
  const handleSync = async () => {
    if (!organization?.id || !user?.uid) return;

    try {
      await syncEbiosData(organization.id, dossier.id, user.uid, 'Synchronisation manuelle');

      toast.success(
        t('homologation.ebios.syncSuccess', 'Données synchronisées'),
        t('homologation.ebios.syncSuccessDesc', 'Les données EBIOS ont été mises à jour')
      );

      setChangeStatus({ hasChanges: false, checking: false });
      onLinkChanged();
    } catch {
      toast.error(
        t('homologation.ebios.syncError', 'Erreur de synchronisation'),
        t('homologation.ebios.syncErrorDesc', 'Impossible de synchroniser les données EBIOS')
      );
    }
  };

  // Get eligibility reason text
  const getEligibilityReason = (reason?: string): string => {
    switch (reason) {
      case 'analysis_draft':
        return t('homologation.ebios.reasonDraft', 'Analyse en brouillon');
      case 'workshop1_incomplete':
        return t('homologation.ebios.reasonWorkshop1', 'Atelier 1 non complété');
      default:
        return '';
    }
  };

  // Render linked status
  const renderLinkedStatus = () => {
    if (!dossier.linkedEbiosAnalysisId || !dossier.ebiosSnapshot) {
      return (
        <div className="flex items-center gap-2 text-slate-500">
          <Unlink className="h-4 w-4" />
          <span className="text-sm">{t('homologation.ebios.notLinked', 'Aucune analyse EBIOS liée')}</span>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-green-600" />
            <span className="font-medium">{dossier.ebiosSnapshot.analysisName}</span>
            <Badge variant="outline" className="text-xs">
              {dossier.ebiosSnapshot.completionPercentage}%
            </Badge>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUnlinkConfirm(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Unlink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Workshop statuses */}
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5].map((ws) => {
            const status = dossier.ebiosSnapshot?.workshopStatuses[ws as 1 | 2 | 3 | 4 | 5];
            const isComplete = status === 'completed' || status === 'validated';
            return (
              <Badge
                key={ws}
                variant="outline"
                className={cn(
                  'text-xs',
                  isComplete ? 'bg-green-50 text-green-700 dark:text-green-400 border-green-300' : 'bg-slate-50 dark:bg-slate-900 text-slate-600'
                )}
              >
                {t(`homologation.ebios.workshop${ws}`, `Atelier ${ws}`)}
              </Badge>
            );
          })}
        </div>

        {/* Change detection warning */}
        {changeStatus.hasChanges && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {t('homologation.ebios.changesDetected', 'Modifications détectées')}
              </p>
              {changeStatus.details && changeStatus.details.length > 0 && (
                <ul className="mt-1 text-xs text-amber-700 dark:text-amber-400 list-disc list-inside">
                  {changeStatus.details.slice(0, 3).map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
              {!disabled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                  onClick={handleSync}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t('homologation.ebios.syncNow', 'Synchroniser')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Last synced info */}
        {dossier.ebiosLastSyncedAt && (
          <p className="text-xs text-slate-500">
            {t('homologation.ebios.lastSynced', 'Dernière synchronisation')}:{' '}
            {new Date(dossier.ebiosLastSyncedAt).toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}
      </div>
    );
  };

  // Compact mode render
  if (mode === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {dossier.linkedEbiosAnalysisId ? (
          <>
            <Badge variant="outline" className="bg-green-50 text-green-700 dark:text-green-400 border-green-300">
              <LinkIcon className="h-3 w-3 mr-1" />
              {dossier.ebiosSnapshot?.analysisName ?? 'EBIOS'}
            </Badge>
            {changeStatus.hasChanges && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:text-amber-400 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('homologation.ebios.updated', 'Mise à jour')}
              </Badge>
            )}
          </>
        ) : (
          <Badge variant="outline" className="text-slate-500 dark:text-slate-400">
            <Unlink className="h-3 w-3 mr-1" />
            {t('homologation.ebios.noLink', 'Pas de lien EBIOS')}
          </Badge>
        )}
        {!disabled && !dossier.linkedEbiosAnalysisId && (
          <Button variant="ghost" size="sm" onClick={() => setShowSelector(true)}>
            <LinkIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Full mode render
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {t('homologation.ebios.title', 'Lien EBIOS RM')}
        </h3>
        {!disabled && !dossier.linkedEbiosAnalysisId && (
          <Button variant="outline" size="sm" onClick={() => setShowSelector(true)}>
            <LinkIcon className="h-4 w-4 mr-1" />
            {t('homologation.ebios.linkAnalysis', 'Lier une analyse')}
          </Button>
        )}
      </div>

      {renderLinkedStatus()}

      {/* Selector Dialog */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('homologation.ebios.selectTitle', 'Sélectionner une analyse EBIOS')}</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('homologation.ebios.searchPlaceholder', 'Rechercher une analyse...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
            />
          </div>

          {/* Analysis list */}
          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : filteredAnalyses.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-60" />
                <p className="text-sm">
                  {searchTerm
                    ? t('homologation.ebios.noResults', 'Aucun résultat')
                    : t('homologation.ebios.noAnalyses', 'Aucune analyse EBIOS disponible')}
                </p>
              </div>
            ) : (
              filteredAnalyses.map(({ analysis, eligible, reason }) => (
                <button
                  key={analysis.id}
                  onClick={() => eligible && setSelectedAnalysisId(analysis.id)}
                  disabled={!eligible}
                  className={cn(
                    'w-full p-3 text-left transition-colors',
                    eligible
                      ? selectedAnalysisId === analysis.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      : 'opacity-70 cursor-not-allowed bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedAnalysisId === analysis.id && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="font-medium">{analysis.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {analysis.completionPercentage ?? 0}%
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        analysis.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      )}
                    >
                      {analysis.status}
                    </Badge>
                  </div>
                  {analysis.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 line-clamp-1">{analysis.description}</p>
                  )}
                  {!eligible && reason && (
                    <p className="mt-1 text-xs text-red-500">{getEligibilityReason(reason)}</p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Link note */}
          {selectedAnalysisId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('homologation.ebios.linkNote', 'Note (optionnel)')}
              </label>
              <input
                type="text"
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                placeholder={t('homologation.ebios.linkNotePlaceholder', 'Raison de la liaison...')}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelector(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              onClick={handleLink}
              disabled={!selectedAnalysisId || isLinking}
            >
              {isLinking && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('homologation.ebios.linkButton', 'Lier')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('homologation.ebios.unlinkTitle', 'Délier l\'analyse EBIOS ?')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {t(
              'homologation.ebios.unlinkWarning',
              'Cette action supprimera le lien avec l\'analyse EBIOS. Les documents générés ne seront plus synchronisés avec les données EBIOS.'
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkConfirm(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={isUnlinking}
            >
              {isUnlinking && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('homologation.ebios.unlinkButton', 'Délier')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EbiosLinkSelector;
