/**
 * EbiosChangeReview
 *
 * Banner component to display when linked EBIOS analysis has changed.
 * Shows change details and allows sync/acknowledge actions.
 * Story 38-4: EBIOS-Homologation Link
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/useToast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { checkEbiosChanges, syncEbiosData } from '../../services/HomologationService';
import type { HomologationDossier, EbiosLinkSnapshot } from '../../types/homologation';

// ============================================================================
// Types
// ============================================================================

interface EbiosChangeReviewProps {
  dossier: HomologationDossier;
  onSynced: () => void;
  className?: string;
}

interface ChangeDetails {
  hasChanges: boolean;
  completionChanged: boolean;
  workshopStatusChanged: boolean;
  itemCountsChanged: boolean;
  details: string[];
  currentSnapshot?: EbiosLinkSnapshot;
}

// ============================================================================
// Component
// ============================================================================

export const EbiosChangeReview: React.FC<EbiosChangeReviewProps> = ({
  dossier,
  onSynced,
  className
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useStore();
  const { user } = useAuth();
  const isEnglish = i18n.language === 'en';

  // State
  const [changes, setChanges] = useState<ChangeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Check for changes
  const checkForChanges = useCallback(async () => {
    if (!organization?.id || !dossier.linkedEbiosAnalysisId || !dossier.ebiosSnapshot) {
      setChanges(null);
      setLoading(false);
      return;
    }

    try {
      const result = await checkEbiosChanges(organization.id, dossier.id);
      if (result.hasChanges && result.changes) {
        setChanges({
          hasChanges: true,
          ...result.changes,
          currentSnapshot: result.currentSnapshot
        });
      } else {
        setChanges(null);
      }
    } catch {
      setChanges(null);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, dossier.id, dossier.linkedEbiosAnalysisId, dossier.ebiosSnapshot]);

  // Check on mount and when dossier changes
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // Handle sync
  const handleSync = async () => {
    if (!organization?.id || !user?.uid) return;

    setSyncing(true);
    try {
      await syncEbiosData(organization.id, dossier.id, user.uid, 'Synchronisation après revue des modifications');

      toast({
        title: t('homologation.ebios.syncSuccess', 'Données synchronisées'),
        description: t('homologation.ebios.syncSuccessDesc', 'Les données EBIOS ont été mises à jour')
      });

      setChanges(null);
      onSynced();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('homologation.ebios.syncError', 'Erreur de synchronisation'),
        description: t('homologation.ebios.syncErrorDesc', 'Impossible de synchroniser les données EBIOS')
      });
    } finally {
      setSyncing(false);
    }
  };

  // Handle dismiss (temporary hide)
  const handleDismiss = () => {
    setDismissed(true);
  };

  // Handle navigation to EBIOS analysis
  const handleViewEbios = () => {
    if (dossier.linkedEbiosAnalysisId) {
      navigate(`/ebios/${dossier.linkedEbiosAnalysisId}`);
    }
  };

  // Don't render if no linked EBIOS, no changes, dismissed, or loading
  if (loading || !dossier.linkedEbiosAnalysisId || !changes?.hasChanges || dismissed) {
    return null;
  }

  // Render comparison if we have both snapshots
  const renderComparison = () => {
    const stored = dossier.ebiosSnapshot;
    const current = changes.currentSnapshot;

    if (!stored || !current) return null;

    return (
      <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
        {/* Stored values */}
        <div className="p-2 bg-red-50 rounded border border-red-200">
          <p className="font-semibold text-red-800 mb-2">{t('homologation.ebios.previous', 'Précédent')}</p>
          <ul className="space-y-1 text-red-700">
            <li>{t('homologation.ebios.completion', 'Complétion')}: {stored.completionPercentage}%</li>
            <li>{t('homologation.ebios.fearedEvents', 'Événements redoutés')}: {stored.fearedEventsCount}</li>
            <li>{t('homologation.ebios.riskSources', 'Sources de risque')}: {stored.riskSourcesCount}</li>
            <li>{t('homologation.ebios.strategicScenarios', 'Scénarios stratégiques')}: {stored.strategicScenariosCount}</li>
            <li>{t('homologation.ebios.operationalScenarios', 'Scénarios opérationnels')}: {stored.operationalScenariosCount}</li>
            <li>{t('homologation.ebios.treatmentItems', 'Actions de traitement')}: {stored.treatmentItemsCount}</li>
          </ul>
        </div>

        {/* Current values */}
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <p className="font-semibold text-green-800 mb-2">{t('homologation.ebios.current', 'Actuel')}</p>
          <ul className="space-y-1 text-green-700">
            <li>{t('homologation.ebios.completion', 'Complétion')}: {current.completionPercentage}%</li>
            <li>{t('homologation.ebios.fearedEvents', 'Événements redoutés')}: {current.fearedEventsCount}</li>
            <li>{t('homologation.ebios.riskSources', 'Sources de risque')}: {current.riskSourcesCount}</li>
            <li>{t('homologation.ebios.strategicScenarios', 'Scénarios stratégiques')}: {current.strategicScenariosCount}</li>
            <li>{t('homologation.ebios.operationalScenarios', 'Scénarios opérationnels')}: {current.operationalScenariosCount}</li>
            <li>{t('homologation.ebios.treatmentItems', 'Actions de traitement')}: {current.treatmentItemsCount}</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-full">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900">
              {t('homologation.ebios.changesDetectedTitle', 'Analyse EBIOS mise à jour')}
            </h4>
            <p className="text-sm text-amber-700 mt-0.5">
              {t(
                'homologation.ebios.changesDetectedDesc',
                'L\'analyse EBIOS liée a été modifiée depuis la dernière synchronisation.'
              )}
            </p>

            {/* Change summary badges */}
            <div className="flex flex-wrap gap-1 mt-2">
              {changes.completionChanged && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                  {t('homologation.ebios.completionChanged', 'Progression modifiée')}
                </Badge>
              )}
              {changes.workshopStatusChanged && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                  {t('homologation.ebios.workshopChanged', 'Ateliers modifiés')}
                </Badge>
              )}
              {changes.itemCountsChanged && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                  {t('homologation.ebios.dataChanged', 'Données modifiées')}
                </Badge>
              )}
            </div>

            {/* Expanded details */}
            {expanded && changes.details && changes.details.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-amber-800 mb-1">
                  {t('homologation.ebios.changeDetails', 'Détail des modifications')}:
                </p>
                <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                  {changes.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
                {renderComparison()}
              </div>
            )}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="text-amber-500 hover:text-amber-700 transition-colors"
          aria-label={t('common.dismiss', 'Ignorer')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-amber-200">
        <Button
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          {t('homologation.ebios.syncAndAccept', 'Synchroniser et accepter')}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleViewEbios}
          className="border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          {t('homologation.ebios.viewAnalysis', 'Voir l\'analyse')}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
          className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 ml-auto"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              {t('common.showLess', 'Moins')}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              {t('common.showMore', 'Plus')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default EbiosChangeReview;
